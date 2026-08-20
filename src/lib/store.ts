import { AppSettings, PrayerLogItem } from "../types";

export const DEFAULT_SETTINGS: AppSettings = {
  latitude: 6.5244,
  longitude: 3.3792,
  cityName: "Lagos, Nigeria",
  calculationMethod: "MuslimWorldLeague",
  asrSchool: "Standard",
  forcedPauseSeconds: 900, // 15 minutes default
  preLockMinutes: 10, // 10 minutes default
  soundEnabled: true,
  soundOption: "chime",
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

// Unified async Store API (works seamlessly with Tauri IPC, Store & fallback)

export async function loadSettings(): Promise<AppSettings> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res = await invoke<AppSettings>("get_settings");
      if (res) return { ...DEFAULT_SETTINGS, ...res };
    } catch {
      // fallback to store plugin / localStorage below
    }
  }
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

export async function syncAutostart(launchAtLogin: boolean): Promise<void> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { enable, disable, isEnabled } = await import("@tauri-apps/plugin-autostart");
      const currentlyEnabled = await isEnabled();
      if (launchAtLogin && !currentlyEnabled) {
        await enable();
      } else if (!launchAtLogin && currentlyEnabled) {
        await disable();
      }
      // No-op if already in the desired state — prevents duplicate login items
    } catch (err) {
      console.warn("Failed to sync autostart setting via Tauri autostart plugin:", err);
    }
  }
}

export async function isAutostartEnabled(): Promise<boolean> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { isEnabled } = await import("@tauri-apps/plugin-autostart");
      return await isEnabled();
    } catch (err) {
      console.warn("Failed to check autostart status:", err);
    }
  }
  return false;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  saveSettingsToStorage(settings);
  await syncAutostart(settings.launchAtLogin);
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_settings", { settings });
    } catch {
      // fallback to store plugin below
    }
  }
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
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res = await invoke<PrayerLogItem[]>("get_logs");
      if (res) return res;
    } catch {
      // fallback
    }
  }
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

const logListeners = new Set<() => void>();

export function notifyLogUpdated(): void {
  logListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error("Error in logListener callback:", err);
    }
  });

  if (typeof window !== "undefined") {
    if (typeof window.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
      window.dispatchEvent(new CustomEvent("waqt:log-updated"));
    }
    if ("__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/event")
        .then(({ emit }) => emit("waqt:log-updated"))
        .catch((err) => console.warn("Failed to emit Tauri log update event:", err));
    }
  }
}

export function subscribeLogUpdated(callback: () => void): () => void {
  logListeners.add(callback);

  const handleCustomEvent = () => callback();
  const handleStorageEvent = (e: StorageEvent) => {
    if (!e.key || e.key === LOGS_KEY) {
      callback();
    }
  };

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("waqt:log-updated", handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("focus", handleCustomEvent);
  }

  let unlistenTauri: (() => void) | null = null;

  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        listen("waqt:log-updated", () => callback()).then((unlistenFn) => {
          unlistenTauri = unlistenFn;
        });
      })
      .catch((err) => console.warn("Failed to listen for Tauri log update event:", err));
  }

  return () => {
    logListeners.delete(callback);
    if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
      window.removeEventListener("waqt:log-updated", handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("focus", handleCustomEvent);
    }
    if (unlistenTauri) {
      unlistenTauri();
    }
  };
}

/**
 * Subscribes to backend system timezone/DST shift events (`waqt:timezone-changed`).
 * Invokes the callback whenever the background scheduler detects a system offset change.
 */
export function subscribeTimezoneChanged(callback: () => void): () => void {
  const handleCustomEvent = () => callback();

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("waqt:timezone-changed", handleCustomEvent);
  }

  let unlistenTauri: (() => void) | null = null;

  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        listen("waqt:timezone-changed", () => callback()).then((unlistenFn) => {
          unlistenTauri = unlistenFn;
        });
      })
      .catch((err) => console.warn("Failed to listen for Tauri timezone-changed event:", err));
  }

  return () => {
    if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
      window.removeEventListener("waqt:timezone-changed", handleCustomEvent);
    }
    if (unlistenTauri) {
      unlistenTauri();
    }
  };
}

export async function addLogEntry(entry: PrayerLogItem): Promise<PrayerLogItem[]> {
  const updated = addLogEntryToStorage(entry);
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res = await invoke<PrayerLogItem[]>("add_log_entry", { entry });
      if (res) {
        notifyLogUpdated();
        return res;
      }
    } catch {
      // fallback
    }
  }
  const store = await getTauriStore();
  if (store) {
    try {
      await store.set("log", updated);
      await store.save();
    } catch (err) {
      console.error("Failed to append log entry to Tauri Store:", err);
    }
  }
  notifyLogUpdated();
  return updated;
}

export async function addEmergencyExtension(ext: import("../types").EmergencyExtension): Promise<void> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("add_emergency_extension", { ext });
    } catch (err) {
      console.error("Failed to add emergency extension IPC:", err);
    }
  }
  const store = await getTauriStore();
  if (store) {
    try {
      const exts: any[] = (await store.get("emergency_extensions")) || [];
      const updated = exts.filter((e) => !(e.date === ext.date && e.prayer === ext.prayer));
      updated.push(ext);
      await store.set("emergency_extensions", updated);
      await store.save();
    } catch (err) {
      console.error("Failed to save emergency extension to Tauri Store:", err);
    }
  }
}

export async function hasUsedEmergencyDismiss(date: string, prayer: string): Promise<boolean> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<boolean>("has_used_emergency_dismiss", { date, prayer });
    } catch {
      // fallback
    }
  }
  const logs = await loadLogs();
  return logs.some((l) => l.date === date && l.prayer === prayer && l.status === "emergency_dismissed");
}

export async function triggerOverlayCommand(prayerName: string, emergencyExhausted?: boolean, isTest?: boolean): Promise<void> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("trigger_overlay", { prayerName, emergencyExhausted: emergencyExhausted || false, isTest: isTest || false });
    } catch (err) {
      console.error("Failed to trigger overlay IPC:", err);
    }
  }
}

export async function dismissOverlayCommand(): Promise<void> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("dismiss_overlay");
    } catch (err) {
      console.error("Failed to dismiss overlay IPC:", err);
    }
  }
}

export async function sendTestNotificationCommand(prayerName?: string, minutes?: number): Promise<void> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("send_test_notification", { prayerName, minutes });
      return;
    } catch (err) {
      console.warn("Failed to invoke send_test_notification IPC, falling back to plugin API:", err);
    }
  }
  try {
    const { sendNotification, isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
    let granted = await isPermissionGranted();
    if (!granted) {
      const perm = await requestPermission();
      granted = perm === "granted";
    }
    if (granted) {
      const pName = prayerName || "Dhuhr";
      const mins = minutes || 15;
      sendNotification({
        title: `Upcoming Prayer: ${pName}`,
        body: `${pName} is in ${mins} minutes.`,
      });
    }
  } catch (err) {
    console.error("Failed to send test notification:", err);
  }
}

/** Returns true if the macOS Accessibility permission is currently granted. */
export async function checkAccessibilityPermission(): Promise<boolean> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<boolean>("check_accessibility_permission");
    } catch (err) {
      console.warn("Failed to check accessibility permission:", err);
    }
  }
  // Non-Tauri / non-macOS: no permission needed.
  return true;
}

/**
 * Triggers the native macOS "Allow Accessibility Access" dialog / opens
 * System Preferences to the Accessibility pane.
 * Returns true if permission is already granted, false if the user still
 * needs to toggle the switch in System Preferences.
 */
export async function requestAccessibilityPermission(): Promise<boolean> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<boolean>("request_accessibility_permission");
    } catch (err) {
      console.warn("Failed to request accessibility permission:", err);
    }
  }
  return true;
}
