mod api;
mod commands;
mod models;
mod native;
mod state;

use commands::{execute_action, get_state, pair_device, poll, set_permission, start_session, stop_session};
use state::load_initial_state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(load_initial_state())
        .invoke_handler(tauri::generate_handler![
            get_state,
            pair_device,
            start_session,
            stop_session,
            set_permission,
            poll,
            execute_action
        ])
        .run(tauri::generate_context!())
        .expect("error while running Auto Agent PC");
}
