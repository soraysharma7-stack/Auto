use reqwest::{Method, StatusCode};
use serde_json::Value;

use crate::{models::Config, state::load_token};

pub fn validate_server_url(value: &str) -> Result<String, String> {
    let url = reqwest::Url::parse(value.trim()).map_err(|_| "Enter a valid Auto server URL".to_string())?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1"));
    if url.scheme() != "https" && !(url.scheme() == "http" && local) {
        return Err("Use HTTPS, or HTTP only for a local development server".to_string());
    }
    Ok(value.trim().trim_end_matches('/').to_string())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())
}

async fn parse_response(response: reqwest::Response) -> Result<Value, String> {
    let status = response.status();
    let body = response.text().await.map_err(|error| error.to_string())?;
    let value = serde_json::from_str::<Value>(&body).unwrap_or(Value::Null);
    if !status.is_success() {
        let message = value
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or(if status == StatusCode::UNAUTHORIZED {
                "Device authorization was rejected"
            } else {
                "The Auto server rejected the request"
            });
        return Err(message.to_string());
    }
    Ok(value)
}

pub async fn pairing(server_url: &str, code: &str, device_name: &str) -> Result<Value, String> {
    let server_url = validate_server_url(server_url)?;
    let response = client()?
        .post(format!("{server_url}/api/devices/pair"))
        .json(&serde_json::json!({
            "code": code,
            "deviceName": device_name,
            "appVersion": env!("CARGO_PKG_VERSION")
        }))
        .send()
        .await
        .map_err(|_| "The Auto server could not be reached".to_string())?;
    parse_response(response).await
}

pub async fn authorized(
    config: &Config,
    method: Method,
    path: &str,
    body: Value,
) -> Result<Value, String> {
    let token = load_token(config)?;
    let response = client()?
        .request(method, format!("{}{}", config.server_url, path))
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|_| "The Auto server could not be reached".to_string())?;
    parse_response(response).await
}
