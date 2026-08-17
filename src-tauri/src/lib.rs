pub mod overlay_window;
pub mod prayer_calc;
pub mod scheduler;
pub mod store;

use store::{AppSettings, PrayerLogItem, StoreManager};
use tauri::{AppHandle, Manager};

fn get_config_dir(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("./"))
}

#[tauri::command]
fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let mgr = StoreManager::new(get_config_dir(&app));
    Ok(mgr.load_settings())
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let mgr = StoreManager::new(get_config_dir(&app));
    mgr.save_settings(&settings)
}

#[tauri::command]
fn get_logs(app: AppHandle) -> Result<Vec<PrayerLogItem>, String> {
    let mgr = StoreManager::new(get_config_dir(&app));
    Ok(mgr.load_logs())
}

#[tauri::command]
fn add_log_entry(app: AppHandle, entry: PrayerLogItem) -> Result<Vec<PrayerLogItem>, String> {
    let mgr = StoreManager::new(get_config_dir(&app));
    mgr.add_log_entry(entry)
}

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
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_logs,
            add_log_entry,
            trigger_overlay,
            dismiss_overlay
        ])
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
