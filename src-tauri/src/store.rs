use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

/// Serializes every read-modify-write of `store.json` in this process.
///
/// Sync Tauri commands run on the main thread and the scheduler on a tokio
/// worker; each did load → mutate → save with nothing in between, so a
/// confirmation landing between the scheduler's load and its save was
/// silently overwritten. The atomic rename only ever prevented torn files,
/// not lost updates. All saves also shared one `store.json.tmp.{pid}` path,
/// so two concurrent writers could clobber each other's temp file.
static STORE_WRITE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub latitude: f64,
    pub longitude: f64,
    pub city_name: String,
    pub calculation_method: String,
    pub asr_school: String,
    pub forced_pause_seconds: u64,
    #[serde(default = "default_pre_lock_minutes")]
    pub pre_lock_minutes: u64,
    pub sound_enabled: bool,
    #[serde(default = "default_sound_option")]
    pub sound_option: String,
    pub snooze_enabled: bool,
    pub notifications_enabled: bool,
    pub launch_at_login: bool,
    pub onboarding_completed: bool,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub demo_mode_enabled: bool,
}

fn default_pre_lock_minutes() -> u64 {
    10
}

fn default_sound_option() -> String {
    "chime".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            latitude: 6.5244,
            longitude: 3.3792,
            city_name: "Lagos, Nigeria".to_string(),
            calculation_method: "MuslimWorldLeague".to_string(),
            asr_school: "Standard".to_string(),
            forced_pause_seconds: 900,
            pre_lock_minutes: 10,
            sound_enabled: true,
            sound_option: "chime".to_string(),
            snooze_enabled: false,
            notifications_enabled: true,
            launch_at_login: true,
            onboarding_completed: false,
            created_at: None,
            demo_mode_enabled: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PrayerLogItem {
    pub id: String,
    pub date: String,
    pub prayer: String,
    pub scheduled_time: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirmed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EmergencyExtension {
    pub id: String,
    pub date: String,
    pub prayer: String,
    pub dismissed_at: String,
    pub expires_at: String,
    #[serde(default)]
    pub notified_15m: bool,
    #[serde(default)]
    pub notified_10m: bool,
    #[serde(default)]
    pub notified_5m: bool,
    #[serde(default)]
    pub relocked: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct WaqtStore {
    #[serde(default)]
    pub settings: AppSettings,
    #[serde(default)]
    pub log: Vec<PrayerLogItem>,
    #[serde(default)]
    pub emergency_extensions: Vec<EmergencyExtension>,
}

/// Precedence used to resolve two log writes for the same prayer.
///
/// Higher wins. The ordering encodes what the user actually did: a prayer they
/// confirmed is not "missed" just because the scheduler's cutoff elapsed while
/// they were still in the forced pause, and an emergency dismissal is a
/// deliberate act that likewise outranks an automatic `missed`.
pub fn status_rank(status: &str) -> u8 {
    match status {
        "confirmed" => 3,
        "emergency_dismissed" => 2,
        "missed" => 1,
        _ => 0,
    }
}

/// Merges one entry into the log, keyed on `(date, prayer)`.
///
/// The log holds at most one record per prayer per day, but nothing used to
/// enforce that on the write path: `mark_missed_prayer` checked
/// `has_logged_prayer` first, while the frontend's "I've prayed" handler went
/// straight to `add_log_entry`. Because the scheduler's missed-cutoff and the
/// overlay's active window expire at the same instant, a user still inside the
/// forced pause was written as `missed` and their confirmation then appended a
/// *second*, contradictory row for the same prayer.
///
/// Conflicts resolve by [`status_rank`]: a stronger status overwrites a weaker
/// one, a weaker status is discarded, and an equal status refreshes the record
/// so repeat confirmations stay idempotent.
pub fn upsert_log_entry(log: &mut Vec<PrayerLogItem>, entry: PrayerLogItem) {
    match log
        .iter()
        .position(|item| item.date == entry.date && item.prayer == entry.prayer)
    {
        Some(pos) => {
            if status_rank(&entry.status) >= status_rank(&log[pos].status) {
                log[pos] = entry;
            }
        }
        None => log.insert(0, entry),
    }
}

pub struct StoreManager {
    pub config_dir: PathBuf,
}

impl StoreManager {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { config_dir }
    }

    pub fn get_store_path(&self) -> PathBuf {
        self.config_dir.join("store.json")
    }

    pub fn load_store(&self) -> WaqtStore {
        let path = self.get_store_path();
        if let Ok(content) = fs::read_to_string(&path) {
            match serde_json::from_str::<WaqtStore>(&content) {
                Ok(store) => return store,
                Err(err) => {
                    eprintln!("[Waqt Store] Corrupted JSON store detected: {err}");
                    let timestamp = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs())
                        .unwrap_or(0);
                    let backup_path = self.config_dir.join(format!("store.json.corrupted.{}.bak", timestamp));
                    if let Err(b_err) = fs::copy(&path, &backup_path) {
                        eprintln!("[Waqt Store] Failed to create corrupted backup: {b_err}");
                    } else {
                        eprintln!("[Waqt Store] Saved corrupted store backup to {:?}", backup_path);
                    }
                }
            }
        }
        WaqtStore::default()
    }

    /// Loads, applies `f`, and saves, holding `STORE_WRITE_LOCK` throughout.
    /// Every mutation goes through here; `f` must not call back into
    /// `StoreManager` writes (the lock is not reentrant).
    pub fn modify<R>(&self, f: impl FnOnce(&mut WaqtStore) -> R) -> Result<R, String> {
        let _guard = STORE_WRITE_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let mut store = self.load_store();
        let out = f(&mut store);
        self.write_store(&store)?;
        Ok(out)
    }

    /// Replaces the whole store. Prefer `modify` for anything that starts from
    /// the current contents.
    pub fn save_store(&self, store: &WaqtStore) -> Result<(), String> {
        let _guard = STORE_WRITE_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        self.write_store(store)
    }

    fn write_store(&self, store: &WaqtStore) -> Result<(), String> {
        let path = self.get_store_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let temp_path = self.config_dir.join(format!("store.json.tmp.{}", std::process::id()));
        let json = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
        fs::write(&temp_path, json).map_err(|e| e.to_string())?;
        fs::rename(&temp_path, &path).map_err(|e| e.to_string())
    }

    pub fn load_settings(&self) -> AppSettings {
        self.load_store().settings
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), String> {
        self.modify(|store| {
            let mut updated = settings.clone();
            if updated.created_at.is_none() {
                if store.settings.created_at.is_some() {
                    updated.created_at = store.settings.created_at.clone();
                } else {
                    updated.created_at = Some(chrono::Local::now().format("%Y-%m-%d").to_string());
                }
            }
            store.settings = updated;
        })
    }

    pub fn load_logs(&self) -> Vec<PrayerLogItem> {
        self.load_store().log
    }

    /// Writes a log entry, upserting on `(date, prayer)` rather than blindly
    /// appending.
    ///
    /// The log holds at most one record per prayer per day, but nothing used to
    /// enforce that on the write path: `mark_missed_prayer` checked
    /// `has_logged_prayer` first, while the frontend's "I've prayed" handler
    /// went straight to `add_log_entry`. When the missed-cutoff fired while the
    /// user was still in the forced pause, the scheduler wrote `missed` and the
    /// confirmation then appended a *second*, contradictory row for the same
    /// prayer.
    ///
    /// Conflicts now resolve by `status_rank`: a stronger status overwrites a
    /// weaker one, a weaker status is discarded, and an equal status refreshes
    /// the record (so repeat confirmations stay idempotent).
    pub fn add_log_entry(&self, entry: PrayerLogItem) -> Result<Vec<PrayerLogItem>, String> {
        self.modify(|store| {
            upsert_log_entry(&mut store.log, entry);
            store.log.clone()
        })
    }

    pub fn clear_logs(&self) -> Result<(), String> {
        self.modify(|store| {
            store.log.clear();
            store.emergency_extensions.clear();
        })
    }

    pub fn has_logged_prayer(&self, date: &str, prayer: &str) -> bool {
        let logs = self.load_logs();
        logs.iter().any(|item| item.date == date && item.prayer == prayer)
    }

    /// The "already logged?" check happens under the write lock, so a
    /// confirmation that lands concurrently is never overwritten by `missed`.
    pub fn mark_missed_prayer(&self, date: &str, prayer: &str, scheduled_time: &str) -> Result<(), String> {
        let entry = PrayerLogItem {
            id: format!("missed-{}-{}", date, prayer),
            date: date.to_string(),
            prayer: prayer.to_string(),
            scheduled_time: scheduled_time.to_string(),
            status: "missed".to_string(),
            confirmed_at: None,
        };
        self.modify(|store| {
            if !store.log.iter().any(|item| item.date == date && item.prayer == prayer) {
                upsert_log_entry(&mut store.log, entry);
            }
        })
    }

    pub fn add_emergency_extension(&self, ext: EmergencyExtension) -> Result<(), String> {
        self.modify(|store| {
            store.emergency_extensions.retain(|e| !(e.date == ext.date && e.prayer == ext.prayer));
            store.emergency_extensions.push(ext);
        })
    }

    pub fn load_emergency_extensions(&self) -> Vec<EmergencyExtension> {
        self.load_store().emergency_extensions
    }

    pub fn update_emergency_extension(&self, ext: &EmergencyExtension) -> Result<(), String> {
        self.modify(|store| {
            if let Some(pos) = store.emergency_extensions.iter().position(|e| e.id == ext.id) {
                store.emergency_extensions[pos] = ext.clone();
            }
        })
    }

    pub fn has_used_emergency_dismiss(&self, date: &str, prayer: &str) -> bool {
        let store = self.load_store();
        is_emergency_exhausted(
            &store.emergency_extensions,
            date,
            prayer,
            chrono::Local::now().timestamp(),
        )
    }
}

/// True when this prayer's one emergency dismissal has already been spent —
/// either it was re-locked, or its grace period has run out.
///
/// `expires_at` is parsed rather than string-compared. RFC3339 strings only
/// sort correctly when their UTC offsets match; the moment the user crosses a
/// timezone or DST boundary the date parts sort the wrong way and the
/// comparison inverts — handing back a spent emergency dismissal, or denying a
/// live one. This mirrors `scheduler::has_live_extension`, which had the same
/// bug; see its test `grace_period_comparison_survives_a_timezone_change`.
///
/// An unparseable `expires_at` counts as expired, matching `has_live_extension`
/// treating it as "not live": a corrupt record must not become an unbounded
/// grace period.
pub fn is_emergency_exhausted(
    extensions: &[EmergencyExtension],
    date: &str,
    prayer: &str,
    now_ts: i64,
) -> bool {
    extensions.iter().any(|e| {
        e.date == date
            && e.prayer == prayer
            && (e.relocked
                || chrono::DateTime::parse_from_rfc3339(&e.expires_at)
                    .map(|dt| dt.timestamp() <= now_ts)
                    .unwrap_or(true))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn concurrent_writers_do_not_lose_updates() {
        let dir = std::env::temp_dir().join(format!(
            "waqt_race_{}",
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
        ));
        let handles: Vec<_> = (0..16)
            .map(|i| {
                let dir = dir.clone();
                std::thread::spawn(move || {
                    let mgr = StoreManager::new(dir);
                    mgr.add_log_entry(PrayerLogItem {
                        id: i.to_string(),
                        date: format!("2026-10-{:02}", i + 1),
                        prayer: "Dhuhr".into(),
                        scheduled_time: String::new(),
                        status: "confirmed".into(),
                        confirmed_at: None,
                    })
                    .unwrap();
                })
            })
            .collect();
        for h in handles {
            h.join().unwrap();
        }
        assert_eq!(StoreManager::new(dir.clone()).load_logs().len(), 16);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_emergency_extension_store_and_check() {
        let unique_name = format!("waqt_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let temp_dir = std::env::temp_dir().join(unique_name);
        let mgr = StoreManager::new(temp_dir.clone());

        let now = chrono::Local::now();
        let today_str = now.format("%Y-%m-%d").to_string();
        let expires_future = (now + chrono::Duration::minutes(30)).to_rfc3339();

        assert!(!mgr.has_used_emergency_dismiss(&today_str, "Dhuhr"));

        let mut ext = EmergencyExtension {
            id: "ext-1".to_string(),
            date: today_str.clone(),
            prayer: "Dhuhr".to_string(),
            dismissed_at: now.to_rfc3339(),
            expires_at: expires_future,
            notified_15m: false,
            notified_10m: false,
            notified_5m: false,
            relocked: false,
        };

        mgr.add_emergency_extension(ext.clone()).unwrap();

        // While relocked is false and expires_at is in the future (grace period active), emergency is not exhausted
        assert!(!mgr.has_used_emergency_dismiss(&today_str, "Dhuhr"));

        // Once relocked is true (30m grace period elapsed), emergency is exhausted
        ext.relocked = true;
        mgr.update_emergency_extension(&ext).unwrap();
        assert!(mgr.has_used_emergency_dismiss(&today_str, "Dhuhr"));
        assert!(!mgr.has_used_emergency_dismiss(&today_str, "Asr"));

        let loaded = mgr.load_emergency_extensions();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].prayer, "Dhuhr");

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_mark_missed_prayer_behavior() {
        let unique_name = format!("waqt_missed_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let temp_dir = std::env::temp_dir().join(unique_name);
        let mgr = StoreManager::new(temp_dir.clone());

        let date = "2026-08-20";
        let prayer = "Fajr";

        assert!(!mgr.has_logged_prayer(date, prayer));

        // 1. Mark prayer as missed
        mgr.mark_missed_prayer(date, prayer, "2026-08-20T05:30:00Z").unwrap();
        assert!(mgr.has_logged_prayer(date, prayer));

        let logs = mgr.load_logs();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].status, "missed");

        // 2. Calling mark_missed_prayer again for the same prayer should not duplicate
        mgr.mark_missed_prayer(date, prayer, "2026-08-20T05:30:00Z").unwrap();
        let logs_after = mgr.load_logs();
        assert_eq!(logs_after.len(), 1);

        // 3. Mark a confirmed prayer and ensure mark_missed_prayer doesn't overwrite it
        let confirmed_item = PrayerLogItem {
            id: "conf-1".to_string(),
            date: "2026-08-20".to_string(),
            prayer: "Dhuhr".to_string(),
            scheduled_time: "2026-08-20T13:00:00Z".to_string(),
            status: "confirmed".to_string(),
            confirmed_at: Some("2026-08-20T13:05:00Z".to_string()),
        };
        mgr.add_log_entry(confirmed_item).unwrap();

        mgr.mark_missed_prayer("2026-08-20", "Dhuhr", "2026-08-20T13:00:00Z").unwrap();
        let dhuhr_log = mgr.load_logs().into_iter().find(|l| l.prayer == "Dhuhr").unwrap();
        assert_eq!(dhuhr_log.status, "confirmed");

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    fn temp_mgr(tag: &str) -> (StoreManager, std::path::PathBuf) {
        let unique = format!(
            "waqt_{}_{}",
            tag,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let dir = std::env::temp_dir().join(unique);
        (StoreManager::new(dir.clone()), dir)
    }

    fn entry(date: &str, prayer: &str, status: &str) -> PrayerLogItem {
        PrayerLogItem {
            id: format!("{}-{}-{}", status, date, prayer),
            date: date.to_string(),
            prayer: prayer.to_string(),
            scheduled_time: format!("{}T13:00:00Z", date),
            status: status.to_string(),
            confirmed_at: None,
        }
    }

    #[test]
    fn confirming_after_the_missed_cutoff_replaces_the_missed_row() {
        // The race: the scheduler's missed-cutoff and the overlay's active
        // window expire at the same instant, so a user still in the forced
        // pause gets marked `missed`, then confirms.
        let (mgr, dir) = temp_mgr("race");

        mgr.mark_missed_prayer("2026-08-22", "Dhuhr", "2026-08-22T13:00:00Z")
            .unwrap();
        mgr.add_log_entry(entry("2026-08-22", "Dhuhr", "confirmed"))
            .unwrap();

        let logs = mgr.load_logs();
        assert_eq!(logs.len(), 1, "must not leave two rows for one prayer");
        assert_eq!(logs[0].status, "confirmed");

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_missed_write_never_downgrades_a_confirmed_prayer() {
        let (mgr, dir) = temp_mgr("downgrade");

        mgr.add_log_entry(entry("2026-08-22", "Asr", "confirmed"))
            .unwrap();
        // Reaches add_log_entry directly, bypassing mark_missed_prayer's guard.
        mgr.add_log_entry(entry("2026-08-22", "Asr", "missed"))
            .unwrap();

        let logs = mgr.load_logs();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].status, "confirmed");

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn emergency_dismissal_outranks_missed_but_not_confirmed() {
        let (mgr, dir) = temp_mgr("emergency");

        mgr.add_log_entry(entry("2026-08-22", "Isha", "missed"))
            .unwrap();
        mgr.add_log_entry(entry("2026-08-22", "Isha", "emergency_dismissed"))
            .unwrap();
        assert_eq!(mgr.load_logs()[0].status, "emergency_dismissed");

        mgr.add_log_entry(entry("2026-08-22", "Isha", "missed"))
            .unwrap();
        assert_eq!(mgr.load_logs()[0].status, "emergency_dismissed");

        // The user came back and prayed after the grace period.
        mgr.add_log_entry(entry("2026-08-22", "Isha", "confirmed"))
            .unwrap();
        let logs = mgr.load_logs();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].status, "confirmed");

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn repeat_confirmations_stay_idempotent() {
        let (mgr, dir) = temp_mgr("idempotent");

        for _ in 0..3 {
            mgr.add_log_entry(entry("2026-08-22", "Fajr", "confirmed"))
                .unwrap();
        }
        assert_eq!(mgr.load_logs().len(), 1);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn different_prayers_and_dates_remain_separate() {
        let (mgr, dir) = temp_mgr("separate");

        mgr.add_log_entry(entry("2026-08-22", "Fajr", "confirmed"))
            .unwrap();
        mgr.add_log_entry(entry("2026-08-22", "Dhuhr", "confirmed"))
            .unwrap();
        mgr.add_log_entry(entry("2026-08-21", "Fajr", "missed"))
            .unwrap();

        assert_eq!(mgr.load_logs().len(), 3);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn status_precedence_is_ordered() {
        assert!(status_rank("confirmed") > status_rank("emergency_dismissed"));
        assert!(status_rank("emergency_dismissed") > status_rank("missed"));
        assert!(status_rank("missed") > status_rank("something_unknown"));
    }

    fn dhuhr_ext(expires_at: &str, relocked: bool) -> EmergencyExtension {
        EmergencyExtension {
            id: "ext-dhuhr".to_string(),
            date: "2026-08-22".to_string(),
            prayer: "Dhuhr".to_string(),
            dismissed_at: "2026-08-22T13:00:00+01:00".to_string(),
            expires_at: expires_at.to_string(),
            notified_15m: false,
            notified_10m: false,
            notified_5m: false,
            relocked,
        }
    }

    #[test]
    fn a_running_grace_period_is_not_yet_exhausted() {
        // 2026-08-22T13:30:00+01:00 == 1787401800
        let now = 1787401800i64;
        let exts = vec![dhuhr_ext("2026-08-22T14:00:00+01:00", false)];
        assert!(!is_emergency_exhausted(&exts, "2026-08-22", "Dhuhr", now));
        // A different prayer or date has spent nothing.
        assert!(!is_emergency_exhausted(&exts, "2026-08-22", "Asr", now));
        assert!(!is_emergency_exhausted(&exts, "2026-08-21", "Dhuhr", now));
    }

    #[test]
    fn an_elapsed_or_relocked_grace_period_is_exhausted() {
        let now = 1787401800i64;
        assert!(is_emergency_exhausted(
            &[dhuhr_ext("2026-08-22T13:00:00+01:00", false)],
            "2026-08-22",
            "Dhuhr",
            now
        ));
        assert!(is_emergency_exhausted(
            &[dhuhr_ext("2026-08-22T14:00:00+01:00", true)],
            "2026-08-22",
            "Dhuhr",
            now
        ));
    }

    #[test]
    fn exhaustion_check_survives_a_timezone_change() {
        // Written in +09:00; the user has since moved to -04:00. The grace
        // period ended an hour ago in real time, so the dismissal is spent.
        let expires_at = "2026-08-23T01:00:00+09:00"; // == 2026-08-22T16:00Z
        let now_iso = "2026-08-22T13:00:00-04:00"; // == 2026-08-22T17:00Z
        let now_ts = 1787418000i64; // the same instant as now_iso

        // The old lexicographic comparison read the spent extension as still
        // running, because the date parts sort the wrong way once the offsets
        // differ — handing the user a second emergency dismissal.
        assert!(expires_at > now_iso, "the naive comparison is fooled here");

        assert!(is_emergency_exhausted(
            &[dhuhr_ext(expires_at, false)],
            "2026-08-22",
            "Dhuhr",
            now_ts
        ));
    }

    #[test]
    fn a_corrupt_expiry_counts_as_exhausted() {
        // Mirrors has_live_extension: unparseable is "not live", so it must not
        // become an unbounded grace period.
        assert!(is_emergency_exhausted(
            &[dhuhr_ext("not-a-timestamp", false)],
            "2026-08-22",
            "Dhuhr",
            1787401800
        ));
    }

    #[test]
    fn test_corrupted_store_backup_recovery() {
        let unique_name = format!("waqt_corrupt_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let temp_dir = std::env::temp_dir().join(unique_name);
        let mgr = StoreManager::new(temp_dir.clone());
        let store_path = mgr.get_store_path();

        let _ = std::fs::create_dir_all(&temp_dir);
        std::fs::write(&store_path, "{ invalid_json_syntax: true ").unwrap();

        let loaded = mgr.load_store();
        assert!(!loaded.settings.onboarding_completed);

        let entries = std::fs::read_dir(&temp_dir).unwrap();
        let backup_exists = entries.filter_map(|e| e.ok()).any(|e| {
            e.file_name().to_string_lossy().contains("store.json.corrupted.")
        });
        assert!(backup_exists, "Corrupted backup file should be created");

        let _ = std::fs::remove_dir_all(temp_dir);
    }
}

