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
                settings.pre_lock_minutes,
                check_datetime,
            );

            let grace_secs = std::cmp::max(settings.forced_pause_seconds, 15 * 60) as i64;
            for item in &prayers {
                let missed_cutoff = item.timestamp + grace_secs;
                if now_ts >= missed_cutoff {
                    if !store_mgr.has_logged_prayer(&date_str, &item.name) {
                        let sched_iso = chrono::DateTime::from_timestamp(item.timestamp, 0)
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_else(|| date_str.clone());
                        if store_mgr.mark_missed_prayer(&date_str, &item.name, &sched_iso).is_ok() {
                            println!("[Waqt Scheduler] Prayer {} for {} active window elapsed -> marked as missed", item.name, date_str);
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
    {
        let config_dir = get_config_dir(&app_handle);
        let store_mgr = StoreManager::new(config_dir);
        let settings = store_mgr.load_settings();

        if settings.onboarding_completed {
            check_and_mark_missed_prayers(&app_handle);
            let now = Local::now();
            let today_str = now.format("%Y-%m-%d").to_string();
            let now_ts = now.timestamp();

            let prayers = prayer_calc::get_today_prayer_items(
                settings.latitude,
                settings.longitude,
                &settings.calculation_method,
                &settings.asr_school,
                settings.pre_lock_minutes,
                now,
            );

            let grace_secs = std::cmp::max(settings.forced_pause_seconds, 15 * 60) as i64;
            for item in &prayers {
                let active_expiry = item.timestamp + grace_secs;
                if now_ts >= item.lock_timestamp {
                    let toast_key = format!("{}:{}:toast", today_str, item.name);
                    notified_events.insert(toast_key);
                }
                if now_ts >= active_expiry {
                    let overlay_key = format!("{}:{}:overlay", today_str, item.name);
                    notified_events.insert(overlay_key);
                    println!(
                        "[Waqt Scheduler] Startup: pre-seeding overlay key for {} (already past active lock window)",
                        item.name
                    );
                }
                for (label, seconds_before) in [("30m", 30 * 60i64), ("15m", 15 * 60), ("5m", 5 * 60)] {
                    let pre_ts = item.timestamp - seconds_before;
                    if now_ts >= item.lock_timestamp || now_ts >= (pre_ts + 300) {
                        let key = format!("{}:{}:pre:{}", today_str, item.name, label);
                        notified_events.insert(key);
                    }
                }
            }
            println!("[Waqt Scheduler] Startup initialization complete. Pre-seeded {} event keys.", notified_events.len());
        } else {
            println!("[Waqt Scheduler] Startup: Onboarding not completed. Skipping scheduler initialization pass.");
        }
    }
    // ──────────────────────────────────────────────────────────────────────

    loop {
        // Sleep 10s between ticks for fine-grained 10s toast handling
        sleep(Duration::from_secs(10)).await;

        let elapsed = last_tick_instant.elapsed();
        last_tick_instant = Instant::now();

        let is_sleep_wake = elapsed > Duration::from_secs(65);
        if is_sleep_wake {
            println!("[Waqt Scheduler] OS sleep-wake detected! Elapsed: {:?}", elapsed);
        }

        let config_dir = get_config_dir(&app_handle);
        let store_mgr = StoreManager::new(config_dir);
        let settings = store_mgr.load_settings();

        if !settings.onboarding_completed {
            continue;
        }

        check_and_mark_missed_prayers(&app_handle);

        let now = Local::now();
        let today_str = now.format("%Y-%m-%d").to_string();
        let now_ts = now.timestamp();

        if notified_events.len() > 100 {
            notified_events.retain(|k| k.starts_with(&today_str));
        }

        let prayers = prayer_calc::get_today_prayer_items(
            settings.latitude,
            settings.longitude,
            &settings.calculation_method,
            &settings.asr_school,
            settings.pre_lock_minutes,
            now,
        );

        let grace_secs = std::cmp::max(settings.forced_pause_seconds, 15 * 60) as i64;
        for item in &prayers {
            let p_name = &item.name;

            // 1. Pre-Notifications (T-30m, T-15m, T-5m relative to Adhan time)
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
                        if now_ts >= pre_ts && now_ts < item.lock_timestamp {
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

            // 2. Toast warning (strictly 10 seconds before lock_timestamp)
            let toast_key = format!("{}:{}:toast", today_str, p_name);
            if !notified_events.contains(&toast_key) {
                if now_ts >= item.lock_timestamp {
                    notified_events.insert(toast_key);
                } else if now_ts >= (item.lock_timestamp - 10) && now_ts < item.lock_timestamp {
                    if !store_mgr.has_logged_prayer(&today_str, p_name) {
                        notified_events.insert(toast_key);
                        use tauri::Emitter;
                        let _ = app_handle.emit("waqt:trigger-toast", p_name.clone());
                        println!("[Waqt Scheduler] Emitted waqt:trigger-toast event for {}", p_name);
                    }
                }
            }

            // 3. Overlay / Forced Pause at lock_timestamp during active lock window
            let overlay_key = format!("{}:{}:overlay", today_str, p_name);
            let active_expiry = item.timestamp + grace_secs;
            let is_past_active_window = now_ts >= active_expiry;
            let in_active_lock_window = now_ts >= item.lock_timestamp && now_ts < active_expiry;

            if is_past_active_window {
                notified_events.insert(overlay_key);
            } else if in_active_lock_window && !notified_events.contains(&overlay_key) {
                if store_mgr.has_logged_prayer(&today_str, p_name) {
                    notified_events.insert(overlay_key);
                } else {
                    notified_events.insert(overlay_key);
                    println!("[Waqt Scheduler] Triggering pre-lock overlay for {}", p_name);

                    if settings.notifications_enabled {
                        if let Err(e) = app_handle
                            .notification()
                            .builder()
                            .title(format!("Pre-lock Time for {}", p_name))
                            .body(format!("System is locking for {}. Prepare for prayer.", p_name))
                            .show()
                        {
                            println!("[Waqt Scheduler] Lock notification error for {}: {:?}", p_name, e);
                        }
                    }

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
    fn test_toast_trigger_window_strict() {
        let lock_ts = 10000i64;

        // 15 seconds before lock: toast should not trigger yet
        let now_early = 9985i64;
        let should_toast_early = now_early >= (lock_ts - 10) && now_early < lock_ts;
        assert!(!should_toast_early);

        // 5 seconds before lock: toast SHOULD trigger
        let now_exact = 9995i64;
        let should_toast_exact = now_exact >= (lock_ts - 10) && now_exact < lock_ts;
        assert!(should_toast_exact);

        // At or after lock time (e.g. 10005i64): toast MUST NOT trigger retroactively
        let now_past = 10005i64;
        let should_toast_past = now_past >= (lock_ts - 10) && now_past < lock_ts;
        assert!(!should_toast_past);
    }

    #[test]
    fn test_active_lock_window_expiry_and_missed_cutoff() {
        let timestamp = 10000i64; // Adhan time
        let lock_ts = 9580i64;    // 7 mins (420s) pre-lock
        let grace_secs = 15 * 60i64; // 900s
        let active_expiry = timestamp + grace_secs; // 10900

        // During active lock window (e.g. 10000 -> 10 mins after lock trigger): overlay SHOULD fire
        let now_active = 9980i64;
        let in_active_window = now_active >= lock_ts && now_active < active_expiry;
        assert!(in_active_window);

        // Past active lock window (e.g. 11000 -> 16 mins after Adhan): SHOULD be past active window & marked missed
        let now_past = 11000i64;
        let is_past_active_window = now_past >= active_expiry;
        assert!(is_past_active_window);

        let in_active_window_past = now_past >= lock_ts && now_past < active_expiry;
        assert!(!in_active_window_past);
    }
}



