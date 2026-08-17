use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
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

    pub fn load_settings(&self) -> AppSettings {
        let path = self.get_store_path();
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                return settings;
            }
        }
        AppSettings::default()
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), String> {
        let path = self.get_store_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())
    }
}
