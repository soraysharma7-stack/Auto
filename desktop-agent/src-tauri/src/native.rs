use std::{fs, path::PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine};
use enigo::{Enigo, KeyboardControllable, MouseButton, MouseControllable};
use screenshots::Screen;
use serde_json::Value;

use crate::models::{DeviceAction, Permission};

fn required_permission(action_type: &str) -> &'static str {
    match action_type {
        "screen_snapshot" => "screen",
        "read_file" | "write_file" => "files",
        _ => "input",
    }
}

fn validate_file_path(raw: &str, permissions: &[Permission], write: bool) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(raw);
    if !candidate.is_absolute() {
        return Err("Only absolute paths inside granted folders are allowed".to_string());
    }
    let normalized = if write {
        let parent = candidate.parent().ok_or_else(|| "Invalid file path".to_string())?;
        let parent = fs::canonicalize(parent).map_err(|_| "The target folder does not exist".to_string())?;
        let target = parent.join(candidate.file_name().ok_or_else(|| "Invalid file name".to_string())?);
        match fs::symlink_metadata(&target) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    return Err("Symbolic-link file targets are not allowed".to_string());
                }
                fs::canonicalize(&target).map_err(|error| error.to_string())?
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => target,
            Err(error) => return Err(error.to_string()),
        }
    } else {
        fs::canonicalize(&candidate).map_err(|_| "The target file does not exist".to_string())?
    };
    let allowed = permissions.iter().find(|permission| permission.capability == "files" && permission.enabled)
        .map(|permission| &permission.paths)
        .ok_or_else(|| "File permission is not granted on this PC".to_string())?
        .iter()
        .filter_map(|base| fs::canonicalize(base).ok())
        .any(|base| normalized.starts_with(base));
    if !allowed {
        return Err("The path is outside every locally granted folder".to_string());
    }
    Ok(normalized)
}

fn capture_screen() -> Result<Value, String> {
    let screens = Screen::all().map_err(|error| error.to_string())?;
    let screen = screens.first().ok_or_else(|| "No screen is available".to_string())?;
    let image = screen.capture().map_err(|error| error.to_string())?;
    let path = std::env::temp_dir().join(format!("auto-snapshot-{}.png", uuid::Uuid::new_v4()));
    image.save(&path).map_err(|error| error.to_string())?;
    let bytes = fs::read(&path).map_err(|error| error.to_string())?;
    let _ = fs::remove_file(&path);
    if bytes.len() > 5_000_000 {
        return Err("Screen snapshot exceeds the 5 MB safety limit".to_string());
    }
    Ok(serde_json::json!({
        "image": STANDARD.encode(bytes),
        "width": image.width(),
        "height": image.height()
    }))
}

pub fn execute(action: &DeviceAction, permissions: &[Permission]) -> Result<Value, String> {
    let capability = required_permission(&action.action_type);
    if !permissions.iter().any(|permission| permission.capability == capability && permission.enabled) {
        return Err(format!("Local {capability} permission is not granted"));
    }
    match action.action_type.as_str() {
        "screen_snapshot" => capture_screen(),
        "mouse_move" => {
            let x = action.payload.get("x").and_then(Value::as_i64).ok_or_else(|| "Missing x coordinate".to_string())?;
            let y = action.payload.get("y").and_then(Value::as_i64).ok_or_else(|| "Missing y coordinate".to_string())?;
            if x < 0 || y < 0 || x > 100_000 || y > 100_000 {
                return Err("Mouse coordinates are outside the accepted range".to_string());
            }
            Enigo::new().mouse_move_to(x as i32, y as i32);
            Ok(serde_json::json!({"moved": true}))
        }
        "mouse_click" => {
            let button = match action.payload.get("button").and_then(Value::as_str).unwrap_or("left") {
                "left" => MouseButton::Left,
                "right" => MouseButton::Right,
                "middle" => MouseButton::Middle,
                _ => return Err("Unsupported mouse button".to_string()),
            };
            Enigo::new().mouse_click(button);
            Ok(serde_json::json!({"clicked": true}))
        }
        "type_text" => {
            let text = action.payload.get("text").and_then(Value::as_str).ok_or_else(|| "Missing text".to_string())?;
            if text.len() > 5000 { return Err("Text is too long".to_string()); }
            Enigo::new().key_sequence(text);
            Ok(serde_json::json!({"characters": text.chars().count()}))
        }
        "read_file" => {
            let raw = action.payload.get("path").and_then(Value::as_str).ok_or_else(|| "Missing file path".to_string())?;
            let path = validate_file_path(raw, permissions, false)?;
            if fs::metadata(&path).map_err(|error| error.to_string())?.len() > 500_000 {
                return Err("File is too large".to_string());
            }
            let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
            Ok(serde_json::json!({"path": path, "content": content}))
        }
        "write_file" => {
            let raw = action.payload.get("path").and_then(Value::as_str).ok_or_else(|| "Missing file path".to_string())?;
            let content = action.payload.get("content").and_then(Value::as_str).ok_or_else(|| "Missing file content".to_string())?;
            if content.len() > 500_000 { return Err("File is too large".to_string()); }
            let path = validate_file_path(raw, permissions, true)?;
            fs::write(&path, content).map_err(|error| error.to_string())?;
            Ok(serde_json::json!({"path": path, "written": true}))
        }
        _ => Err("Unsupported native action".to_string()),
    }
}
