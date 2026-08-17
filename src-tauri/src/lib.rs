pub mod overlay_window;
pub mod scheduler;
pub mod store;

use tauri::{AppHandle, Manager};

#[tauri::command]
fn trigger_overlay(app: AppHandle, prayer_name: String) -> Result<(), String> {
    overlay_window::spawn_overlay_windows(&app, &prayer_name)
}

#[tauri::command]
fn dismiss_overlay(app: AppHandle) -> Result<(), String> {
    overlay_window::close_all_overlays(&app);
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::AppleScript,
            Some(vec!["--autostart"]),
        ))
        .invoke_handler(tauri::generate_handler![trigger_overlay, dismiss_overlay])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                scheduler::start_background_scheduler(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
