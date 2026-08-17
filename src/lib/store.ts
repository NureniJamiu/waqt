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

const SETTINGS_KEY = "waqt_settings";
const LOGS_KEY = "waqt_logs";

let tauriStore: any = null;

async function getTauriStore() {
  if (tauriStore) return tauriStore;
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const { Store } = await import("@tauri-apps/plugin-store");
      tauriStore = await Store.load("store.json");
      return tauriStore;
    }
  } catch (err) {
    console.warn("Tauri Store plugin not available, falling back to localStorage:", err);
  }
  return null;
}

export function loadSettingsFromStorage(): AppSettings {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.error("Failed to load settings from localStorage:", err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettingsToStorage(settings: AppSettings): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save settings to localStorage:", err);
  }
}

export function loadLogsFromStorage(): PrayerLogItem[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(LOGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load logs from localStorage:", err);
    return [];
  }
}

export function addLogEntryToStorage(entry: PrayerLogItem): PrayerLogItem[] {
  const current = loadLogsFromStorage();
  const updated = [entry, ...current];
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.error("Failed to add log entry to localStorage:", err);
  }
  return updated;
}

export function clearLogsFromStorage(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LOGS_KEY);
    }
  } catch (err) {
    console.error("Failed to clear logs from localStorage:", err);
  }
}

// Unified async Store API (works seamlessly with Tauri Store & fallback)

export async function loadSettings(): Promise<AppSettings> {
  const store = await getTauriStore();
  if (store) {
    try {
      const saved = await store.get("settings");
      if (saved) {
        const parsed = typeof saved === "string" ? JSON.parse(saved) : saved;
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (err) {
      console.error("Failed to read settings from Tauri Store:", err);
    }
  }
  return loadSettingsFromStorage();
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  saveSettingsToStorage(settings);
  const store = await getTauriStore();
  if (store) {
    try {
      await store.set("settings", settings);
      await store.save();
    } catch (err) {
      console.error("Failed to save settings to Tauri Store:", err);
    }
  }
}

export async function loadLogs(): Promise<PrayerLogItem[]> {
  const store = await getTauriStore();
  if (store) {
    try {
      const saved = await store.get("log");
      if (saved) {
        return typeof saved === "string" ? JSON.parse(saved) : saved;
      }
    } catch (err) {
      console.error("Failed to read log from Tauri Store:", err);
    }
  }
  return loadLogsFromStorage();
}

export async function addLogEntry(entry: PrayerLogItem): Promise<PrayerLogItem[]> {
  const updated = addLogEntryToStorage(entry);
  const store = await getTauriStore();
  if (store) {
    try {
      await store.set("log", updated);
      await store.save();
    } catch (err) {
      console.error("Failed to append log entry to Tauri Store:", err);
    }
  }
  return updated;
}
