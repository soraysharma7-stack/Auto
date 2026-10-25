use reqwest::Method;
use serde_json::Value;
use tauri::State;

use crate::{
    api,
    models::{ActionOutcome, Config, DeviceAction, Permission, PollResult, PublicState},
    native,
    state::{save_config, store_token, AppState},
};

#[tauri::command]
pub fn get_state(state: State<'_, AppState>) -> Result<PublicState, String> {
    Ok(state.public_state(None))
}

#[tauri::command]
pub async fn pair_device(
    state: State<'_, AppState>,
    server_url: String,
    code: String,
    device_name: String,
) -> Result<PublicState, String> {
    let server_url = api::validate_server_url(&server_url)?;
    if code.trim().len() != 8 || device_name.trim().len() < 2 {
        return Err("Enter an eight-character code and a device name".to_string());
    }
    let response = api::pairing(&server_url, code.trim(), device_name.trim()).await?;
    let device = response.get("device").ok_or_else(|| "The server returned an invalid pairing response".to_string())?;
    let token = response.get("deviceToken").and_then(Value::as_str).ok_or_else(|| "The server did not return a device token".to_string())?;
    let config = Config {
        server_url,
        device_id: device.get("id").and_then(Value::as_str).ok_or_else(|| "Missing device id".to_string())?.to_string(),
        user_id: device.get("user_id").and_then(Value::as_str).ok_or_else(|| "Missing user id".to_string())?.to_string(),
        device_name: device_name.trim().to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        permissions: Permission::defaults(),
    };
    store_token(&config, token)?;
    save_config(&config)?;
    state.inner.lock().map_err(|_| "State lock failed".to_string())?.config = Some(config);
    Ok(state.public_state(Some("Device paired. All local permissions are off.".to_string())))
}

#[tauri::command]
pub async fn start_session(state: State<'_, AppState>) -> Result<PublicState, String> {
    let config = state.config()?;
    let response = api::authorized(&config, Method::POST, "/api/agent/sessions", serde_json::json!({})).await?;
    let session_id = response.get("session").and_then(|session| session.get("id")).and_then(Value::as_str)
        .ok_or_else(|| "The server returned an invalid session".to_string())?.to_string();
    state.set_session(Some(session_id))?;
    Ok(state.public_state(Some("Session started locally. Stop is always available.".to_string())))
}

#[tauri::command]
pub async fn stop_session(state: State<'_, AppState>) -> Result<PublicState, String> {
    let session_id = state.session();
    state.set_session(None)?;
    let mut notice = Some("Agent stopped locally".to_string());
    if let (Ok(config), Some(session_id)) = (state.config(), session_id) {
        let result = api::authorized(
            &config,
            Method::POST,
            &format!("/api/agent/sessions/{session_id}/stop"),
            serde_json::json!({}),
        ).await;
        if result.is_err() {
            notice = Some("Stopped locally. The server is offline and will expire the session.".to_string());
        }
    }
    Ok(state.public_state(notice))
}

#[tauri::command]
pub async fn set_permission(
    state: State<'_, AppState>,
    capability: String,
    enabled: bool,
    paths: Vec<String>,
) -> Result<PublicState, String> {
    if !["screen", "input", "files"].contains(&capability.as_str()) {
        return Err("Unknown permission".to_string());
    }
    let mut config = state.config()?;
    for permission in &mut config.permissions {
        if permission.capability == capability {
            permission.enabled = enabled;
            permission.paths = if capability == "files" { paths.clone() } else { vec![] };
        }
    }
    let body = serde_json::json!({"permissions": [{"capability": capability, "enabled": enabled, "paths": paths}]});

    if enabled {
        api::authorized(&config, Method::PUT, "/api/agent/permissions", body).await?;
        save_config(&config)?;
        state.inner.lock().map_err(|_| "State lock failed".to_string())?.config = Some(config);
        return Ok(state.public_state(Some("Permission granted and synchronized".to_string())));
    }

    save_config(&config)?;
    state.inner.lock().map_err(|_| "State lock failed".to_string())?.config = Some(config.clone());
    let result = api::authorized(&config, Method::PUT, "/api/agent/permissions", body).await;
    Ok(state.public_state(Some(if result.is_err() {
        "Permission revoked locally. Server synchronization is pending.".to_string()
    } else {
        "Permission revoked".to_string()
    })))
}

#[tauri::command]
pub async fn poll(state: State<'_, AppState>) -> Result<PollResult, String> {
    let config = state.config()?;
    let session_id = state.session();
    let response = api::authorized(
        &config,
        Method::POST,
        "/api/agent/poll",
        serde_json::json!({"sessionId": session_id}),
    ).await;
    let value = match response {
        Ok(value) => value,
        Err(error) => {
            state.set_session(None)?;
            return Ok(PollResult {
                state: state.public_state(Some(format!("Connection lost; local control stopped: {error}"))),
                actions: vec![],
            });
        }
    };
    let session_status = value.get("session").and_then(|session| session.get("status")).and_then(Value::as_str);
    if session_status != Some("active") {
        state.set_session(None)?;
    }
    let actions = serde_json::from_value::<Vec<DeviceAction>>(value.get("actions").cloned().unwrap_or(Value::Array(vec![])))
        .map_err(|_| "The server returned invalid device actions".to_string())?;
    Ok(PollResult {
        state: state.public_state(None),
        actions: if state.session().is_some() { actions } else { vec![] },
    })
}

#[tauri::command]
pub async fn execute_action(state: State<'_, AppState>, action_id: String) -> Result<ActionOutcome, String> {
    let config = state.config()?;
    let session_id = state.session().ok_or_else(|| "Start a visible local session first".to_string())?;
    let response = api::authorized(
        &config,
        Method::POST,
        &format!("/api/agent/actions/{action_id}/start"),
        serde_json::json!({}),
    ).await?;
    let action = serde_json::from_value::<DeviceAction>(response.get("action").cloned().ok_or_else(|| "Missing action".to_string())?)
        .map_err(|_| "The server returned an invalid action".to_string())?;
    if action.session_id != session_id || state.session().as_deref() != Some(action.session_id.as_str()) {
        return Err("The active session changed before native execution".to_string());
    }

    let permissions = config.permissions.clone();
    let native_action = action.clone();
    let native_result = tauri::async_runtime::spawn_blocking(move || native::execute(&native_action, &permissions))
        .await
        .map_err(|_| "Native execution thread failed".to_string())?;
    let (status, result, error) = match native_result {
        Ok(result) => ("completed", result, Value::Null),
        Err(error) => ("failed", serde_json::json!({}), Value::String(error)),
    };
    let report = api::authorized(
        &config,
        Method::POST,
        &format!("/api/agent/actions/{action_id}/result"),
        serde_json::json!({"status": status, "result": result, "error": error}),
    ).await;
    Ok(ActionOutcome {
        id: action_id,
        status: status.to_string(),
        notice: report.err().map(|_| "Action ran locally, but its result could not be synchronized".to_string()),
    })
}
