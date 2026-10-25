use std::{fs, path::PathBuf, sync::Mutex};

use keyring::Entry;

use crate::models::{Config, PublicState};

#[derive(Debug, Default)]
pub struct StateData {
    pub config: Option<Config>,
    pub session_id: Option<String>,
}

#[derive(Debug, Default)]
pub struct AppState {
    pub inner: Mutex<StateData>,
}

impl AppState {
    pub fn public_state(&self, notice: Option<String>) -> PublicState {
        let data = self.inner.lock().expect("state mutex poisoned");
        PublicState {
            paired: data.config.is_some(),
            config: data.config.clone(),
            session_id: data.session_id.clone(),
            notice,
        }
    }

    pub fn config(&self) -> Result<Config, String> {
        self.inner
            .lock()
            .map_err(|_| "State lock failed".to_string())?
            .config
            .clone()
            .ok_or_else(|| "Pair this computer first".to_string())
    }

    pub fn set_session(&self, session_id: Option<String>) -> Result<(), String> {
        self.inner
            .lock()
            .map_err(|_| "State lock failed".to_string())?
            .session_id = session_id;
        Ok(())
    }

    pub fn session(&self) -> Option<String> {
        self.inner.lock().ok()?.session_id.clone()
    }
}

fn config_path() -> Result<PathBuf, String> {
    let directory = dirs::config_dir()
        .ok_or_else(|| "No operating-system configuration directory is available".to_string())?
        .join("Auto");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("agent-pc.json"))
}

pub fn load_initial_state() -> AppState {
    let config = config_path()
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|content| serde_json::from_str::<Config>(&content).ok());
    AppState {
        inner: Mutex::new(StateData {
            config,
            session_id: None,
        }),
    }
}

pub fn save_config(config: &Config) -> Result<(), String> {
    let path = config_path()?;
    let content = serde_json::to_string_pretty(config).map_err(|error| error.to_string())?;
    // Windows rename does not replace an existing destination. This file contains no token;
    // the credential remains in the OS store, so a direct bounded config write is sufficient.
    fs::write(path, content).map_err(|error| error.to_string())?;
    Ok(())
}

pub fn store_token(config: &Config, token: &str) -> Result<(), String> {
    Entry::new("ai.auto.agentpc", &config.device_id)
        .map_err(|error| error.to_string())?
        .set_password(token)
        .map_err(|error| error.to_string())
}

pub fn load_token(config: &Config) -> Result<String, String> {
    Entry::new("ai.auto.agentpc", &config.device_id)
        .map_err(|error| error.to_string())?
        .get_password()
        .map_err(|_| "The device token is unavailable. Pair this computer again.".to_string())
}
