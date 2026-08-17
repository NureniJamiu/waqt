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
    pub sound_enabled: bool,
    pub snooze_enabled: bool,
    pub notifications_enabled: bool,
    pub launch_at_login: bool,
    pub onboarding_completed: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            latitude: 6.5244,
            longitude: 3.3792,
            city_name: "Lagos, Nigeria".to_string(),
            calculation_method: "MuslimWorldLeague".to_string(),
            asr_school: "Standard".to_string(),
            forced_pause_seconds: 420,
            sound_enabled: true,
            snooze_enabled: false,
            notifications_enabled: true,
            launch_at_login: true,
            onboarding_completed: false,
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
pub struct WaqtStore {
    #[serde(default)]
    pub settings: AppSettings,
    #[serde(default)]
    pub log: Vec<PrayerLogItem>,
}

impl Default for WaqtStore {
    fn default() -> Self {
        Self {
            settings: AppSettings::default(),
            log: Vec::new(),
        }
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
            if let Ok(store) = serde_json::from_str::<WaqtStore>(&content) {
                return store;
            }
        }
        WaqtStore::default()
    }

    pub fn save_store(&self, store: &WaqtStore) -> Result<(), String> {
        let path = self.get_store_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let json = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())
    }

    pub fn load_settings(&self) -> AppSettings {
        self.load_store().settings
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), String> {
        let mut store = self.load_store();
        store.settings = settings.clone();
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
}
