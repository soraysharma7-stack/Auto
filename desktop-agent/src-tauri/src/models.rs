use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Permission {
    pub capability: String,
    pub enabled: bool,
    pub paths: Vec<String>,
}

impl Permission {
    pub fn defaults() -> Vec<Self> {
        ["screen", "input", "files"]
            .into_iter()
            .map(|capability| Self {
                capability: capability.to_string(),
                enabled: false,
                paths: vec![],
            })
            .collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub server_url: String,
    pub device_id: String,
    pub user_id: String,
    pub device_name: String,
    pub app_version: String,
    pub permissions: Vec<Permission>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicState {
    pub paired: bool,
    pub config: Option<Config>,
    pub session_id: Option<String>,
    pub notice: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAction {
    pub id: String,
    pub session_id: String,
    #[serde(rename = "type")]
    pub action_type: String,
    pub payload: serde_json::Value,
    pub status: String,
    pub expires_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PollResult {
    pub state: PublicState,
    pub actions: Vec<DeviceAction>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionOutcome {
    pub id: String,
    pub status: String,
    pub notice: Option<String>,
}
