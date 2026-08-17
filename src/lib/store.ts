import { AppSettings, PrayerLogItem } from "../types";

export const DEFAULT_SETTINGS: AppSettings = {
  latitude: 6.5244,
  longitude: 3.3792,
  cityName: "Lagos, Nigeria",
  calculationMethod: "MuslimWorldLeague",
  asrSchool: "Standard",
  forcedPauseSeconds: 420, // 7 minutes
  soundEnabled: true,
  snoozeEnabled: false,
  notificationsEnabled: true,
  launchAtLogin: true,
  onboardingCompleted: false,
};

const SETTINGS_KEY = "salah_guard_settings";
const LOGS_KEY = "salah_guard_logs";

export function loadSettingsFromStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.error("Failed to load settings from storage:", err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettingsToStorage(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save settings to storage:", err);
  }
}

export function loadLogsFromStorage(): PrayerLogItem[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load logs from storage:", err);
    return [];
  }
}

export function addLogEntryToStorage(entry: PrayerLogItem): PrayerLogItem[] {
  const current = loadLogsFromStorage();
  const updated = [entry, ...current];
  try {
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to add log entry:", err);
  }
  return updated;
}
