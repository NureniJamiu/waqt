use crate::overlay_window;
use crate::prayer_calc;
use crate::store::StoreManager;
use chrono::{Local, TimeZone};
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

pub fn check_and_mark_missed_prayers(app_handle: &AppHandle) {
    let config_dir = get_config_dir(app_handle);
    let store_mgr = StoreManager::new(config_dir);
    let settings = store_mgr.load_settings();

    if !settings.onboarding_completed {
        return;
    }

    let now = Local::now();
    let now_ts = now.timestamp();

    let start_date = if let Some(ref created_str) = settings.created_at {
        chrono::NaiveDate::parse_from_str(created_str, "%Y-%m-%d")
            .unwrap_or_else(|_| now.naive_local().date())
    } else {
        now.naive_local().date()
    };

    let today_date = now.naive_local().date();
    let max_days_back = 7;
    let mut added_any_missed = false;

    for days_back in (0..=max_days_back).rev() {
        let check_date_naive = today_date - chrono::Duration::days(days_back);
        if check_date_naive < start_date {
            continue;
        }

        if let Some(check_datetime) = check_date_naive.and_hms_opt(12, 0, 0)
            .and_then(|ndt| Local.from_local_datetime(&ndt).single())
        {
            let date_str = check_date_naive.format("%Y-%m-%d").to_string();
            let prayers = prayer_calc::get_today_prayer_items(
                settings.latitude,
                settings.longitude,
                &settings.calculation_method,
                &settings.asr_school,
                check_datetime,
            );

            for item in &prayers {
                if now_ts >= item.next_timestamp {
                    if !store_mgr.has_logged_prayer(&date_str, &item.name) {
                        let sched_iso = chrono::DateTime::from_timestamp(item.timestamp, 0)
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_else(|| date_str.clone());
                        if store_mgr.mark_missed_prayer(&date_str, &item.name, &sched_iso).is_ok() {
                            println!("[Waqt Scheduler] Prayer {} for {} window elapsed -> marked as missed", item.name, date_str);
                            added_any_missed = true;
                        }
                    }
                }
            }
        }
    }

    if added_any_missed {
        use tauri::Emitter;
        let _ = app_handle.emit("waqt:log-updated", ());
    }
}

pub async fn start_background_scheduler(app_handle: AppHandle) {
    let mut last_tick_instant = Instant::now();
    let mut notified_events: HashSet<String> = HashSet::new();

    // ── Startup initialization pass ────────────────────────────────────────
    // Pre-mark any prayer whose overlay window is currently active or already
    // past so the scheduler never fires a phantom overlay the moment the app
    // launches. Only prayers whose T-0 crosses zero *while the scheduler is
    // running* will produce an overlay.
    {
        check_and_mark_missed_prayers(&app_handle);
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
            // If we're currently inside a fireable window OR past it,
            // pre-seed the key so we won't fire an overlay for it.
            if now_ts >= item.timestamp {
                let overlay_key = format!("{}:{}:overlay", today_str, item.name);
                notified_events.insert(overlay_key);
                println!(
                    "[Waqt Scheduler] Startup: pre-seeding overlay key for {} (already at or past T-0)",
                    item.name
                );
            }
            // Also pre-seed pre-notification keys for past prayers or pre-notification times
            // that occurred well in the past (more than 5 minutes ago) so we don't fire stale
            // notifications from hours ago on startup.
            for (label, seconds_before) in [("30m", 30 * 60i64), ("15m", 15 * 60), ("5m", 5 * 60)] {
                let pre_ts = item.timestamp - seconds_before;
                // Only pre-seed as done if prayer itself has passed OR if pre-notification time was > 5 minutes ago
                if now_ts >= item.timestamp || now_ts >= (pre_ts + 300) {
                    let key = format!("{}:{}:pre:{}", today_str, item.name, label);
                    notified_events.insert(key);
                }
            }
        }
        println!("[Waqt Scheduler] Startup initialization complete. Pre-seeded {} event keys.", notified_events.len());
    }
    // ──────────────────────────────────────────────────────────────────────

    loop {
        // Sleep 30s between ticks
        sleep(Duration::from_secs(30)).await;

        let elapsed = last_tick_instant.elapsed();
        last_tick_instant = Instant::now();

        let is_sleep_wake = elapsed > Duration::from_secs(65);
        if is_sleep_wake {
            println!("[Waqt Scheduler] OS sleep-wake detected! Elapsed: {:?}", elapsed);
        }

        check_and_mark_missed_prayers(&app_handle);

        let config_dir = get_config_dir(&app_handle);
        let store_mgr = StoreManager::new(config_dir);
        let settings = store_mgr.load_settings();

        let now = Local::now();
        let today_str = now.format("%Y-%m-%d").to_string();
        let now_ts = now.timestamp();

        // Prune old date notification keys to prevent unbounded set growth over long uptimes
        if notified_events.len() > 100 {
            notified_events.retain(|k| k.starts_with(&today_str));
        }

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
                        // Trigger pre-notification if current time has reached pre-notification time and prayer has not yet passed
                        if now_ts >= pre_ts && now_ts < item.timestamp {
                            notified_events.insert(key);
                            let title = format!("Upcoming Prayer: {}", p_name);
                            let body = format!("{} is in {} minutes.", p_name, label.trim_end_matches('m'));
                            println!("[Waqt Scheduler] Triggering pre-notification ({}) for {}", label, p_name);
                            if let Err(e) = app_handle
                                .notification()
                                .builder()
                                .title(title)
                                .body(body)
                                .show()
                            {
                                println!("[Waqt Scheduler] Pre-notification error for {}: {:?}", p_name, e);
                            }
                        }
                    }
                }
            }

            // 2. Overlay / Forced Pause at T-0 & fireableUntil Window Rule
            let overlay_key = format!("{}:{}:overlay", today_str, p_name);
            let is_past_fireable_window = now_ts >= item.next_timestamp;
            let in_fireable_window = now_ts >= item.timestamp && now_ts < item.next_timestamp;

            if is_past_fireable_window {
                notified_events.insert(overlay_key);
            } else if in_fireable_window && !notified_events.contains(&overlay_key) {
                // Check if user already logged this prayer today
                if store_mgr.has_logged_prayer(&today_str, p_name) {
                    notified_events.insert(overlay_key);
                } else {
                    notified_events.insert(overlay_key);
                    println!("[Waqt Scheduler] Triggering overlay for {}", p_name);

                    // Send T-0 notification if enabled
                    if settings.notifications_enabled {
                        if let Err(e) = app_handle
                            .notification()
                            .builder()
                            .title(format!("Time for {}", p_name))
                            .body(format!("It is now time for {}. Take a pause for prayer.", p_name))
                            .show()
                        {
                            println!("[Waqt Scheduler] T-0 notification error for {}: {:?}", p_name, e);
                        }
                    }

                    // Spawn borderless overlay windows across monitors
                    let _ = overlay_window::spawn_overlay_windows(&app_handle, p_name, false);
                }
            }
        }

        // 3. Emergency Extension Prolongation Checks (30m extension with T-15m, T-10m, T-5m notifications and re-lock at T-0m)
        let exts = store_mgr.load_emergency_extensions();
        for mut ext in exts {
            if !ext.relocked {
                let is_resolved = store_mgr.load_logs().iter().any(|l| l.date == ext.date && l.prayer == ext.prayer && (l.status == "confirmed" || l.status == "missed"));
                if is_resolved {
                    ext.relocked = true;
                    let _ = store_mgr.update_emergency_extension(&ext);
                    continue;
                }

                if let Ok(exp_dt) = chrono::DateTime::parse_from_rfc3339(&ext.expires_at) {
                    let exp_ts = exp_dt.timestamp();
                    let rem_secs = exp_ts - now_ts;

                    if rem_secs <= 15 * 60 && rem_secs > 10 * 60 && !ext.notified_15m {
                        ext.notified_15m = true;
                        let _ = store_mgr.update_emergency_extension(&ext);
                        if settings.notifications_enabled {
                            let _ = app_handle
                                .notification()
                                .builder()
                                .title(format!("Emergency Extension: {}", ext.prayer))
                                .body(format!("15 minutes remaining before Waqt re-locks for {}. Grace period will expire.", ext.prayer))
                                .show();
                        }
                    }

                    if rem_secs <= 10 * 60 && rem_secs > 5 * 60 && !ext.notified_10m {
                        ext.notified_10m = true;
                        let _ = store_mgr.update_emergency_extension(&ext);
                        if settings.notifications_enabled {
                            let _ = app_handle
                                .notification()
                                .builder()
                                .title(format!("Emergency Extension: {}", ext.prayer))
                                .body(format!("10 minutes remaining before Waqt re-locks for {}. Grace period will expire.", ext.prayer))
                                .show();
                        }
                    }

                    if rem_secs <= 5 * 60 && rem_secs > 0 && !ext.notified_5m {
                        ext.notified_5m = true;
                        let _ = store_mgr.update_emergency_extension(&ext);
                        if settings.notifications_enabled {
                            let _ = app_handle
                                .notification()
                                .builder()
                                .title(format!("Emergency Extension: {}", ext.prayer))
                                .body(format!("5 minutes remaining before Waqt re-locks for {}. Grace period will expire.", ext.prayer))
                                .show();
                        }
                    }

                    if rem_secs <= 0 {
                        ext.relocked = true;
                        let _ = store_mgr.update_emergency_extension(&ext);

                        if settings.notifications_enabled {
                            let _ = app_handle
                                .notification()
                                .builder()
                                .title(format!("Emergency Prolongation Expired: {}", ext.prayer))
                                .body(format!("30-minute grace period for {} has ended. Re-locking system.", ext.prayer))
                                .show();
                        }

                        let _ = overlay_window::spawn_overlay_windows(&app_handle, &ext.prayer, true);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_pre_notification_trigger_window() {
        let prayer_ts = 10000i64;
        let pre_30m = prayer_ts - 30 * 60; // 8200

        // Before pre-notification time
        let now_before = 8199i64;
        assert!(!(now_before >= pre_30m && now_before < prayer_ts));

        // Exact pre-notification time
        let now_exact = 8200i64;
        assert!(now_exact >= pre_30m && now_exact < prayer_ts);

        // 2 minutes after pre-notification time (still before prayer)
        let now_lag = 8320i64;
        assert!(now_lag >= pre_30m && now_lag < prayer_ts);

        // After prayer time
        let now_after = 10001i64;
        assert!(!(now_after >= pre_30m && now_after < prayer_ts));
    }

    #[test]
    fn test_startup_pre_seeding_condition() {
        let prayer_ts = 10000i64;
        let pre_30m = prayer_ts - 30 * 60; // 8200

        // If app starts 2 minutes after 30m boundary (now = 8320 < 8200 + 300 = 8500), it should NOT be pre-seeded
        let now_recent = 8320i64;
        let should_pre_seed_recent = now_recent >= prayer_ts || now_recent >= (pre_30m + 300);
        assert!(!should_pre_seed_recent);

        // If app starts 10 minutes after 30m boundary (now = 8800 >= 8500), it SHOULD be pre-seeded
        let now_old = 8800i64;
        let should_pre_seed_old = now_old >= prayer_ts || now_old >= (pre_30m + 300);
        assert!(should_pre_seed_old);
    }
}

