pub mod overlay_window;
pub mod prayer_calc;
pub mod scheduler;
pub mod store;

use store::{AppSettings, EmergencyExtension, PrayerLogItem, StoreManager};
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
fn clear_logs(app: AppHandle) -> Result<(), String> {
    let mgr = StoreManager::new(get_config_dir(&app));
    mgr.clear_logs()
}

#[tauri::command]
fn add_emergency_extension(app: AppHandle, ext: EmergencyExtension) -> Result<(), String> {
    let mgr = StoreManager::new(get_config_dir(&app));
    mgr.add_emergency_extension(ext)
}

#[tauri::command]
fn has_used_emergency_dismiss(app: AppHandle, date: String, prayer: String) -> Result<bool, String> {
    let mgr = StoreManager::new(get_config_dir(&app));
    Ok(mgr.has_used_emergency_dismiss(&date, &prayer))
}

/// Declared `async` so Tauri runs it on the worker pool instead of the main
/// thread. `spawn_overlay_windows` now blocks while the desktop is cleared, and
/// blocking the main thread would freeze the UI and stall the very AppleScript
/// sweep we are waiting on.
#[tauri::command(async)]
fn trigger_overlay(app: AppHandle, prayer_name: String, emergency_exhausted: Option<bool>, is_test: Option<bool>) -> Result<(), String> {
    let exhausted = emergency_exhausted.unwrap_or(false);
    let test_mode = is_test.unwrap_or(false);
    overlay_window::spawn_overlay_windows(&app, &prayer_name, exhausted, test_mode)
}

/// Also off the main thread: dismissing now kicks off the window-restore sweep.
#[tauri::command(async)]
fn dismiss_overlay(app: AppHandle) -> Result<(), String> {
    overlay_window::close_all_overlays(&app);
    Ok(())
}

#[tauri::command]
fn trigger_toast(app: AppHandle, prayer_name: String, is_test: Option<bool>) -> Result<(), String> {
    let test_mode = is_test.unwrap_or(false);
    overlay_window::spawn_toast_window(&app, &prayer_name, test_mode)
}

#[tauri::command]
fn dismiss_toast(app: AppHandle) -> Result<(), String> {
    overlay_window::close_toast_window(&app);
    Ok(())
}

#[tauri::command]
fn send_test_notification(app: AppHandle, prayer_name: Option<String>, minutes: Option<u32>) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    let p_name = prayer_name.unwrap_or_else(|| "Dhuhr".to_string());
    let mins = minutes.unwrap_or(15);
    let title = format!("Upcoming Prayer: {}", p_name);
    let body = format!("{} is in {} minutes.", p_name, mins);

    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| format!("Notification error: {:?}", e))
}

#[tauri::command]
fn check_accessibility_permission() -> bool {
    overlay_window::has_accessibility_permission()
}

/// Opens System Settings and registers the app in the Accessibility list.
/// `async` because it shells out to `open` and a probe script.
#[tauri::command(async)]
fn request_accessibility_permission() -> bool {
    overlay_window::request_accessibility_permission()
}

/// The flag `tauri_plugin_autostart` passes to the login item it installs.
/// Must stay in step with the argument registered in `run()`.
const AUTOSTART_FLAG: &str = "--autostart";

/// True when this process was started by the login item rather than by the user
/// opening the app.
pub fn launched_by_autostart() -> bool {
    std::env::args().any(|arg| arg == AUTOSTART_FLAG)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_FLAG]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_logs,
            add_log_entry,
            clear_logs,
            add_emergency_extension,
            has_used_emergency_dismiss,
            trigger_overlay,
            dismiss_overlay,
            trigger_toast,
            dismiss_toast,
            send_test_notification,
            check_accessibility_permission,
            request_accessibility_permission
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // ── Tray-first launch ──────────────────────────────────────────
            // The autostart plugin is registered with `--autostart`, but until
            // now nothing read it, and the main window was configured
            // `visible: true` — so logging in popped the dashboard every boot.
            // The window is now created hidden and shown here, except when the
            // login item is what launched us. Creating it hidden (rather than
            // hiding it after the fact) also avoids a frame of dashboard
            // flashing on screen at login.
            if !launched_by_autostart() {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            } else {
                println!("[Waqt] Launched at login — staying in the tray.");
            }

            if let Ok(show_item) = tauri::menu::MenuItemBuilder::with_id("show_dashboard", "Show Waqt Dashboard").build(app) {
                if let Ok(quit_item) = tauri::menu::MenuItemBuilder::with_id("quit", "Quit Waqt").build(app) {
                    if let Ok(menu) = tauri::menu::MenuBuilder::new(app).items(&[&show_item, &quit_item]).build() {
                        let mut tray_builder = tauri::tray::TrayIconBuilder::new()
                            .tooltip("Waqt - Prayer Accountability")
                            .menu(&menu)
                            .on_menu_event(|app, event| {
                                match event.id.as_ref() {
                                    "show_dashboard" => {
                                        if let Some(win) = app.get_webview_window("main") {
                                            let _ = win.show();
                                            let _ = win.set_focus();
                                        }
                                    }
                                    "quit" => {
                                        app.exit(0);
                                    }
                                    _ => {}
                                }
                            })
                            .on_tray_icon_event(|tray, event| {
                                if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                                    if button == tauri::tray::MouseButton::Left {
                                        let app_handle = tray.app_handle();
                                        if let Some(win) = app_handle.get_webview_window("main") {
                                            if win.is_visible().unwrap_or(false) {
                                                let _ = win.hide();
                                            } else {
                                                let _ = win.show();
                                                let _ = win.set_focus();
                                            }
                                        }
                                    }
                                }
                            });

                        if let Some(icon) = app.default_window_icon() {
                            tray_builder = tray_builder.icon(icon.clone());
                        }

                        let _ = tray_builder.build(app);
                    }
                }
            }

            tauri::async_runtime::spawn(async move {
                scheduler::start_background_scheduler(handle).await;
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
