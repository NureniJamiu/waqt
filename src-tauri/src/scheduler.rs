use crate::overlay_window;
use crate::prayer_calc;
use crate::store::{PrayerLogItem, StoreManager, WaqtStore};
use chrono::{Local, NaiveDate, TimeZone};
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

/// True when an emergency dismissal for this prayer is still inside its granted
/// grace period, so the scheduler must leave the prayer alone.
///
/// `relocked` means the extension already ended and the re-lock overlay fired;
/// such an extension no longer protects the prayer.
///
/// `expires_at` is parsed rather than string-compared: RFC3339 strings only sort
/// correctly when their UTC offsets match, which stops being true the moment the
/// user crosses a timezone or DST boundary — exactly the conditions this
/// scheduler already goes out of its way to handle.
pub fn has_live_extension(
    extensions: &[crate::store::EmergencyExtension],
    date: &str,
    prayer: &str,
    now_ts: i64,
) -> bool {
    extensions.iter().any(|ext| {
        ext.date == date
            && ext.prayer == prayer
            && !ext.relocked
            && chrono::DateTime::parse_from_rfc3339(&ext.expires_at)
                // An unparseable timestamp grants no protection, so a corrupt
                // record cannot block a prayer from ever being marked missed.
                .map(|dt| dt.timestamp() > now_ts)
                .unwrap_or(false)
    })
}

/// How far back the missed-prayer scan reaches when it does a full pass.
const MAX_DAYS_BACK: i64 = 7;

/// True when the log already holds a row for this prayer on this date.
///
/// Reads the caller's in-memory snapshot instead of re-opening `store.json`.
/// `StoreManager::has_logged_prayer` parses the whole store per call, and the
/// scheduler asks this question once per prayer per day scanned — 40 file reads
/// a tick, every ten seconds, all day.
fn is_logged(logs: &[PrayerLogItem], date: &str, prayer: &str) -> bool {
    logs.iter()
        .any(|item| item.date == date && item.prayer == prayer)
}

pub fn check_and_mark_missed_prayers(app_handle: &AppHandle) {
    let store_mgr = StoreManager::new(get_config_dir(app_handle));
    let store = store_mgr.load_store();
    check_and_mark_missed_prayers_in(app_handle, &store_mgr, &store, MAX_DAYS_BACK);
}

/// Marks elapsed, unlogged prayers as missed, reading from `store` rather than
/// re-loading it.
///
/// `max_days_back` bounds the back-catalogue: the caller passes `0` on an
/// ordinary tick (today only) and [`MAX_DAYS_BACK`] when the date has rolled
/// over, at startup, or after an OS sleep — the only moments a day older than
/// today can newly qualify as missed. Recomputing eight days of prayer times
/// every ten seconds was pure battery drain.
///
/// Returns true if anything was written, which invalidates the caller's
/// snapshot of the store.
pub fn check_and_mark_missed_prayers_in(
    app_handle: &AppHandle,
    store_mgr: &StoreManager,
    store: &WaqtStore,
    max_days_back: i64,
) -> bool {
    let settings = &store.settings;

    if !settings.onboarding_completed {
        return false;
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
    let mut added_any_missed = false;

    // ── Do not mark a prayer missed while the user is still being asked about
    //    it. The missed cutoff and the overlay's active window expire at the
    //    same instant, so without these guards a user sitting in the forced
    //    pause — or inside a granted emergency grace period — was written as
    //    `missed` under the very overlay that was waiting on them.
    let overlay_prayer = overlay_window::get_active_overlay_info(app_handle).map(|(p, _, _)| p);
    let extensions = &store.emergency_extensions;

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
                // An overlay is on screen for this prayer, or snoozed and about
                // to come back: it owns the outcome.
                if overlay_prayer.as_deref() == Some(item.name.as_str())
                    || overlay_window::snooze_pending(&item.name, now_ts)
                {
                    continue;
                }

                // An emergency dismissal bought a grace period that has not
                // expired and has not been re-locked yet.
                if has_live_extension(extensions, &date_str, &item.name, now_ts) {
                    continue;
                }

                let missed_cutoff = item.timestamp + grace_secs;
                if now_ts >= missed_cutoff {
                    // Read from the snapshot; the write below still does its own
                    // read-modify-write, so a confirmation the user made during
                    // this tick cannot be clobbered.
                    if !is_logged(&store.log, &date_str, &item.name) {
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

    added_any_missed
}

/// How far back this tick's missed-prayer scan should reach.
///
/// Only three things can make a day older than today newly qualify as missed:
/// the calendar date rolled over, the OS slept through one or more prayer
/// windows, or the UTC offset moved under us. Every other tick only needs
/// today, which turns eight prayer-time computations per tick into one.
pub fn days_to_scan(date_rolled_over: bool, is_sleep_wake: bool, offset_shifted: bool) -> i64 {
    if date_rolled_over || is_sleep_wake || offset_shifted {
        MAX_DAYS_BACK
    } else {
        0
    }
}

pub fn check_timezone_shift(
    last_offset: &mut Option<chrono::FixedOffset>,
    current_offset: chrono::FixedOffset,
) -> bool {
    match *last_offset {
        Some(prev) if prev != current_offset => {
            *last_offset = Some(current_offset);
            true
        }
        None => {
            *last_offset = Some(current_offset);
            false
        }
        _ => false,
    }
}

pub async fn start_background_scheduler(app_handle: AppHandle) {
    let mut last_tick_instant = Instant::now();
    let mut notified_events: HashSet<String> = HashSet::new();
    let mut last_offset: Option<chrono::FixedOffset> = Some(*Local::now().offset());
    // The calendar date the back-catalogue was last scanned for. A day older
    // than today can only newly become "missed" when the date rolls over, so
    // outside that moment the scan is limited to today. See `days_to_scan`.
    let mut last_full_scan_date: Option<NaiveDate> = None;

    // ── Startup initialization pass ────────────────────────────────────────
    {
        let config_dir = get_config_dir(&app_handle);
        let store_mgr = StoreManager::new(config_dir);
        let store = store_mgr.load_store();
        let settings = &store.settings;

        if settings.onboarding_completed {
            check_and_mark_missed_prayers_in(&app_handle, &store_mgr, &store, MAX_DAYS_BACK);
            let now = Local::now();
            last_full_scan_date = Some(now.naive_local().date());
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

        // A tick that took far longer than its 10s sleep means the process was
        // suspended — the machine slept, or the app was frozen. Everything the
        // loop derives from wall-clock time is stale on the far side of that
        // gap, so the flag forces the same full re-evaluation the app does at
        // startup rather than waiting for the next tick to drift back into
        // agreement.
        let is_sleep_wake = elapsed > Duration::from_secs(65);
        if is_sleep_wake {
            println!(
                "[Waqt Scheduler] OS sleep-wake detected (elapsed: {:?}). Forcing a full schedule re-evaluation.",
                elapsed
            );
        }

        let config_dir = get_config_dir(&app_handle);
        let store_mgr = StoreManager::new(config_dir);
        // One read of store.json for the whole tick. Settings, logs and
        // extensions all come off this snapshot; the handful of write paths
        // below still re-read before writing, so a frontend write landing
        // mid-tick is not clobbered.
        let mut store = store_mgr.load_store();

        if !store.settings.onboarding_completed {
            continue;
        }

        let now = Local::now();
        let today_date = now.naive_local().date();
        let today_str = now.format("%Y-%m-%d").to_string();
        let now_ts = now.timestamp();

        let current_offset = *now.offset();
        let offset_shifted = check_timezone_shift(&mut last_offset, current_offset);
        if offset_shifted {
            println!(
                "[Waqt Scheduler] Timezone / DST offset shift detected! Invalidating notification cache and emitting schedule refresh."
            );
            notified_events.clear();
            use tauri::Emitter;
            let _ = app_handle.emit("waqt:timezone-changed", ());
        }

        // Full back-catalogue scan only when a day older than today could have
        // newly qualified: the date rolled over, the clock jumped, or the OS
        // slept through one or more prayer windows.
        let date_rolled_over = last_full_scan_date != Some(today_date);
        let scan_days = days_to_scan(date_rolled_over, is_sleep_wake, offset_shifted);
        if scan_days > 0 {
            last_full_scan_date = Some(today_date);
        }

        if check_and_mark_missed_prayers_in(&app_handle, &store_mgr, &store, scan_days) {
            // The snapshot is stale now: re-read so the rest of the tick sees
            // the rows that were just written.
            store = store_mgr.load_store();
        }

        let settings = &store.settings;

        // Keys are namespaced by date, so anything not from today is dead
        // weight. Pruning on the date rollover (rather than once the set passed
        // 100 entries, which at ~25 keys/day took four days to trigger) keeps
        // the set at one day's worth. Sleep-wake prunes too: the machine may
        // have woken on a different date entirely.
        if date_rolled_over || is_sleep_wake {
            notified_events.retain(|k| k.starts_with(&today_str));
        }

        // Waking to a changed world: let the frontend recompute its countdowns
        // and re-read the log instead of showing pre-sleep state until the user
        // happens to interact.
        if is_sleep_wake {
            use tauri::Emitter;
            let _ = app_handle.emit("waqt:schedule-refreshed", ());
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

                    if !notified_events.contains(&key) && now_ts >= pre_ts && now_ts < item.lock_timestamp {
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

            // 2. Toast warning (strictly 10 seconds before lock_timestamp)
            let toast_key = format!("{}:{}:toast", today_str, p_name);
            if !notified_events.contains(&toast_key) {
                if now_ts >= item.lock_timestamp {
                    notified_events.insert(toast_key);
                } else if now_ts >= (item.lock_timestamp - 10)
                    && now_ts < item.lock_timestamp
                    && !is_logged(&store.log, &today_str, p_name)
                {
                    notified_events.insert(toast_key);
                    use tauri::Emitter;
                    let _ = app_handle.emit("waqt:trigger-toast", p_name.clone());
                    println!("[Waqt Scheduler] Emitted waqt:trigger-toast event and spawning floating toast window for {}", p_name);
                    let _ = overlay_window::spawn_toast_window(&app_handle, p_name, false);
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
                if is_logged(&store.log, &today_str, p_name) {
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

                    // Offloaded: spawn_overlay_windows now blocks for the
                    // duration of the minimize sweep (up to ~15s). Running that
                    // inline would stall this tokio worker and delay the next
                    // scheduler tick.
                    let overlay_app = app_handle.clone();
                    let overlay_prayer = p_name.clone();
                    let _ = tauri::async_runtime::spawn_blocking(move || {
                        overlay_window::spawn_overlay_windows(&overlay_app, &overlay_prayer, false, false)
                    })
                    .await;
                }
            }
        }

        // 3. Emergency Extension Prolongation Checks (30m extension with T-15m, T-10m, T-5m notifications and re-lock at T-0m)
        // From the tick's snapshot, cloned so each record can be mutated and
        // written back individually. The old code re-read store.json here and
        // again inside the loop, once per extension.
        let exts = store.emergency_extensions.clone();
        for mut ext in exts {
            if !ext.relocked {
                let is_resolved = store.log.iter().any(|l| l.date == ext.date && l.prayer == ext.prayer && (l.status == "confirmed" || l.status == "missed"));
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

                        // If extension expired while laptop slept (now_ts > exp_ts + 15m), mark as missed instead of locking retroactively
                        if now_ts > (exp_ts + 15 * 60) {
                            println!("[Waqt Scheduler] Emergency extension expired while OS was asleep for {}. Marking as missed.", ext.prayer);
                            let _ = store_mgr.mark_missed_prayer(&ext.date, &ext.prayer, &ext.dismissed_at);
                        } else {
                            if settings.notifications_enabled {
                                let _ = app_handle
                                    .notification()
                                    .builder()
                                    .title(format!("Emergency Prolongation Expired: {}", ext.prayer))
                                    .body(format!("30-minute grace period for {} has ended. Re-locking system.", ext.prayer))
                                    .show();
                            }

                            let overlay_app = app_handle.clone();
                            let overlay_prayer = ext.prayer.clone();
                            let _ = tauri::async_runtime::spawn_blocking(move || {
                                overlay_window::spawn_overlay_windows(&overlay_app, &overlay_prayer, true, false)
                            })
                            .await;
                        }
                    }
                }
            }
        }

        // 4. Dynamic Multi-Monitor Overlay Synchronization (Handles monitor plug/unplug mid-overlay)
        if overlay_window::has_active_overlay(&app_handle) {
            overlay_window::sync_overlay_monitors(&app_handle);
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

    fn ext(prayer: &str, expires_at: &str, relocked: bool) -> crate::store::EmergencyExtension {
        crate::store::EmergencyExtension {
            id: format!("ext-{prayer}"),
            date: "2026-08-22".to_string(),
            prayer: prayer.to_string(),
            dismissed_at: "2026-08-22T13:00:00+01:00".to_string(),
            expires_at: expires_at.to_string(),
            notified_15m: false,
            notified_10m: false,
            notified_5m: false,
            relocked,
        }
    }

    #[test]
    fn a_running_grace_period_protects_its_prayer() {
        use super::has_live_extension;
        // 2026-08-22T13:30:00+01:00 == 1787401800
        let now = 1787401800i64;
        let exts = vec![ext("Dhuhr", "2026-08-22T14:00:00+01:00", false)];
        assert!(has_live_extension(&exts, "2026-08-22", "Dhuhr", now));
        assert!(!has_live_extension(&exts, "2026-08-22", "Asr", now));
        assert!(!has_live_extension(&exts, "2026-08-21", "Dhuhr", now));
    }

    #[test]
    fn an_expired_or_relocked_grace_period_protects_nothing() {
        use super::has_live_extension;
        let now = 1787401800i64;
        assert!(!has_live_extension(
            &[ext("Dhuhr", "2026-08-22T13:00:00+01:00", false)],
            "2026-08-22",
            "Dhuhr",
            now
        ));
        assert!(!has_live_extension(
            &[ext("Dhuhr", "2026-08-22T14:00:00+01:00", true)],
            "2026-08-22",
            "Dhuhr",
            now
        ));
    }

    #[test]
    fn grace_period_comparison_survives_a_timezone_change() {
        use super::has_live_extension;

        // The extension was written in +09:00; the user has since moved to
        // -04:00. The grace period ended an hour ago in real time.
        let expires_at = "2026-08-23T01:00:00+09:00"; // == 2026-08-22T16:00Z
        let now_iso = "2026-08-22T13:00:00-04:00"; // == 2026-08-22T17:00Z
        let now_ts = 1787418000i64; // the same instant as now_iso

        // Lexicographic comparison — what `has_used_emergency_dismiss` still
        // does — reads the expired extension as live, because the date parts
        // sort the wrong way once the offsets differ.
        assert!(expires_at > now_iso, "the naive comparison is fooled here");

        // Parsing gets it right, so the prayer can be marked missed.
        assert!(!has_live_extension(
            &[ext("Dhuhr", expires_at, false)],
            "2026-08-22",
            "Dhuhr",
            now_ts
        ));
    }

    #[test]
    fn a_corrupt_expiry_never_blocks_missed_marking() {
        use super::has_live_extension;
        let exts = vec![ext("Dhuhr", "not-a-timestamp", false)];
        assert!(!has_live_extension(&exts, "2026-08-22", "Dhuhr", 1787401800));
    }

    fn log(date: &str, prayer: &str) -> crate::store::PrayerLogItem {
        crate::store::PrayerLogItem {
            id: format!("{date}-{prayer}"),
            date: date.to_string(),
            prayer: prayer.to_string(),
            scheduled_time: format!("{date}T13:00:00Z"),
            status: "confirmed".to_string(),
            confirmed_at: None,
        }
    }

    #[test]
    fn is_logged_matches_on_date_and_prayer() {
        use super::is_logged;
        let logs = vec![log("2026-08-22", "Dhuhr"), log("2026-08-21", "Asr")];

        assert!(is_logged(&logs, "2026-08-22", "Dhuhr"));
        assert!(!is_logged(&logs, "2026-08-22", "Asr"));
        assert!(!is_logged(&logs, "2026-08-21", "Dhuhr"));
        assert!(!is_logged(&[], "2026-08-22", "Dhuhr"));
    }

    #[test]
    fn an_ordinary_tick_only_scans_today() {
        use super::days_to_scan;
        assert_eq!(days_to_scan(false, false, false), 0);
    }

    #[test]
    fn the_back_catalogue_is_scanned_when_the_world_moved() {
        use super::{days_to_scan, MAX_DAYS_BACK};
        // Date rollover: yesterday's late prayers can now be missed.
        assert_eq!(days_to_scan(true, false, false), MAX_DAYS_BACK);
        // Slept through one or more prayer windows.
        assert_eq!(days_to_scan(false, true, false), MAX_DAYS_BACK);
        // The UTC offset moved, so every cached prayer time is suspect.
        assert_eq!(days_to_scan(false, false, true), MAX_DAYS_BACK);
    }

    #[test]
    fn stale_notification_keys_are_pruned_by_date() {
        // What the loop does on a rollover or a wake: keys are namespaced by
        // date, so anything not from today is dead weight.
        let mut keys: std::collections::HashSet<String> = [
            "2026-08-22:Dhuhr:toast",
            "2026-08-22:Dhuhr:overlay",
            "2026-08-21:Isha:overlay",
            "2026-08-20:Fajr:pre:30m",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();

        let today_str = "2026-08-22";
        keys.retain(|k| k.starts_with(today_str));

        assert_eq!(keys.len(), 2);
        assert!(keys.iter().all(|k| k.starts_with(today_str)));
    }

    #[test]
    fn test_timezone_shift_detection() {
        use super::check_timezone_shift;
        use chrono::FixedOffset;

        let mut last_offset: Option<FixedOffset> = None;
        let offset_utc_plus_1 = FixedOffset::east_opt(3600).unwrap();
        let offset_utc_plus_2 = FixedOffset::east_opt(7200).unwrap();

        // 1. Initial assignment sets offset and returns false (no shift yet)
        let shifted_init = check_timezone_shift(&mut last_offset, offset_utc_plus_1);
        assert!(!shifted_init);
        assert_eq!(last_offset, Some(offset_utc_plus_1));

        // 2. Same offset returns false
        let shifted_same = check_timezone_shift(&mut last_offset, offset_utc_plus_1);
        assert!(!shifted_same);
        assert_eq!(last_offset, Some(offset_utc_plus_1));

        // 3. Changed offset returns true (shift detected) and updates stored offset
        let shifted_change = check_timezone_shift(&mut last_offset, offset_utc_plus_2);
        assert!(shifted_change);
        assert_eq!(last_offset, Some(offset_utc_plus_2));
    }
}



