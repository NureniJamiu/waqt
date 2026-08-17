use crate::overlay_window;
use crate::prayer_calc;
use crate::store::StoreManager;
use chrono::Local;
use std::collections::HashSet;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;
use tokio::time::{sleep, Duration, Instant};

fn get_config_dir(app_handle: &AppHandle) -> std::path::PathBuf {
    app_handle
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("./"))
}

pub async fn start_background_scheduler(app_handle: AppHandle) {
    let mut last_tick_instant = Instant::now();
    let mut notified_events: HashSet<String> = HashSet::new();

    loop {
        // Sleep 30s between ticks
        sleep(Duration::from_secs(30)).await;

        let elapsed = last_tick_instant.elapsed();
        last_tick_instant = Instant::now();

        let is_sleep_wake = elapsed > Duration::from_secs(65);
        if is_sleep_wake {
            println!("[Waqt Scheduler] OS sleep-wake detected! Elapsed: {:?}", elapsed);
        }

        let config_dir = get_config_dir(&app_handle);
        let store_mgr = StoreManager::new(config_dir);
        let settings = store_mgr.load_settings();

        let now = Local::now();
        let today_str = now.format("%Y-%m-%d").to_string();
        let now_ts = now.timestamp();

        let prayers = prayer_calc::get_today_prayer_items(
            settings.latitude,
            settings.longitude,
            &settings.calculation_method,
            &settings.asr_school,
            now,
        );

        for item in &prayers {
            let p_name = &item.name;

            // 1. Pre-Notifications (T-30m, T-15m, T-5m)
            if settings.notifications_enabled {
                let pre_intervals = [
                    ("30m", 30 * 60),
                    ("15m", 15 * 60),
                    ("5m", 5 * 60),
                ];

                for (label, seconds_before) in pre_intervals {
                    let pre_ts = item.timestamp - seconds_before;
                    let key = format!("{}:{}:pre:{}", today_str, p_name, label);

                    if !notified_events.contains(&key) {
                        // Check if current time is within 60s window around pre-notification time
                        if now_ts >= pre_ts && now_ts < (pre_ts + 60) {
                            notified_events.insert(key);
                            let title = format!("Upcoming Prayer: {}", p_name);
                            let body = format!("{} is in {} minutes.", p_name, label.trim_end_matches('m'));
                            let _ = app_handle
                                .notification()
                                .builder()
                                .title(title)
                                .body(body)
                                .show();
                        }
                    }
                }
            }

            // 2. Overlay / Forced Pause at T-0 (or Sleep/Wake Recovery)
            let overlay_key = format!("{}:{}:overlay", today_str, p_name);
            let in_fireable_window = now_ts >= item.timestamp && now_ts < item.next_timestamp;

            if in_fireable_window && !notified_events.contains(&overlay_key) {
                notified_events.insert(overlay_key);
                println!("[Waqt Scheduler] Triggering overlay for {}", p_name);

                // Send T-0 notification if enabled
                if settings.notifications_enabled {
                    let _ = app_handle
                        .notification()
                        .builder()
                        .title(format!("Time for {}", p_name))
                        .body(format!("It is now time for {}. Take a pause for prayer.", p_name))
                        .show();
                }

                // Spawn borderless overlay windows across monitors
                let _ = overlay_window::spawn_overlay_windows(&app_handle, p_name);
            }
        }
    }
}
