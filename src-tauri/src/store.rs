use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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

    pub fn save_store(&self, store: &WaqtStore) -> Result<(), String> {
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
        let mut store = self.load_store();
        let mut updated = settings.clone();
        if updated.created_at.is_none() {
            if store.settings.created_at.is_some() {
                updated.created_at = store.settings.created_at.clone();
            } else {
                updated.created_at = Some(chrono::Local::now().format("%Y-%m-%d").to_string());
            }
        }
        store.settings = updated;
        self.save_store(&store)
    }

    pub fn load_logs(&self) -> Vec<PrayerLogItem> {
        self.load_store().log
    }

    pub fn add_log_entry(&self, entry: PrayerLogItem) -> Result<Vec<PrayerLogItem>, String> {
        let mut store = self.load_store();
        store.log.insert(0, entry);
        self.save_store(&store)?;
        Ok(store.log)
    }

    pub fn clear_logs(&self) -> Result<(), String> {
        let mut store = self.load_store();
        store.log.clear();
        store.emergency_extensions.clear();
        self.save_store(&store)
    }

    pub fn has_logged_prayer(&self, date: &str, prayer: &str) -> bool {
        let logs = self.load_logs();
        logs.iter().any(|item| item.date == date && item.prayer == prayer)
    }

    pub fn mark_missed_prayer(&self, date: &str, prayer: &str, scheduled_time: &str) -> Result<(), String> {
        if self.has_logged_prayer(date, prayer) {
            return Ok(());
        }
        let entry = PrayerLogItem {
            id: format!("missed-{}-{}", date, prayer),
            date: date.to_string(),
            prayer: prayer.to_string(),
            scheduled_time: scheduled_time.to_string(),
            status: "missed".to_string(),
            confirmed_at: None,
        };
        self.add_log_entry(entry)?;
        Ok(())
    }

    pub fn add_emergency_extension(&self, ext: EmergencyExtension) -> Result<(), String> {
        let mut store = self.load_store();
        store.emergency_extensions.retain(|e| !(e.date == ext.date && e.prayer == ext.prayer));
        store.emergency_extensions.push(ext);
        self.save_store(&store)
    }

    pub fn load_emergency_extensions(&self) -> Vec<EmergencyExtension> {
        self.load_store().emergency_extensions
    }

    pub fn update_emergency_extension(&self, ext: &EmergencyExtension) -> Result<(), String> {
        let mut store = self.load_store();
        if let Some(pos) = store.emergency_extensions.iter().position(|e| e.id == ext.id) {
            store.emergency_extensions[pos] = ext.clone();
            self.save_store(&store)?;
        }
        Ok(())
    }

    pub fn has_used_emergency_dismiss(&self, date: &str, prayer: &str) -> bool {
        let store = self.load_store();
        let now_iso = chrono::Local::now().to_rfc3339();
        store.emergency_extensions.iter().any(|e| {
            e.date == date && e.prayer == prayer && (e.relocked || e.expires_at <= now_iso)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_emergency_extension_store_and_check() {
        let unique_name = format!("waqt_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let temp_dir = std::env::temp_dir().join(unique_name);
        let mgr = StoreManager::new(temp_dir.clone());

        assert!(!mgr.has_used_emergency_dismiss("2026-08-20", "Dhuhr"));

        let mut ext = EmergencyExtension {
            id: "ext-1".to_string(),
            date: "2026-08-20".to_string(),
            prayer: "Dhuhr".to_string(),
            dismissed_at: "2026-08-20T13:00:00Z".to_string(),
            expires_at: "2026-08-20T13:30:00Z".to_string(),
            notified_15m: false,
            notified_10m: false,
            notified_5m: false,
            relocked: false,
        };

        mgr.add_emergency_extension(ext.clone()).unwrap();

        // While relocked is false (grace period active), emergency is not exhausted
        assert!(!mgr.has_used_emergency_dismiss("2026-08-20", "Dhuhr"));

        // Once relocked is true (30m grace period elapsed), emergency is exhausted
        ext.relocked = true;
        mgr.update_emergency_extension(&ext).unwrap();
        assert!(mgr.has_used_emergency_dismiss("2026-08-20", "Dhuhr"));
        assert!(!mgr.has_used_emergency_dismiss("2026-08-20", "Asr"));

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

