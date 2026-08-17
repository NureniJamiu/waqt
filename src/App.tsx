import { useState, useEffect } from "react";
import { AppSettings, PrayerLogItem, PrayerName } from "./types";
import {
  loadSettingsFromStorage,
  loadSettings,
  saveSettingsToStorage,
  loadLogsFromStorage,
  addLogEntryToStorage,
  dismissOverlayCommand,
  triggerOverlayCommand,
  syncAutostart,
} from "./lib/store";
import { SplashScreen } from "./screens/SplashScreen/SplashScreen";
import { Onboarding } from "./screens/Onboarding/Onboarding";
import { Dashboard } from "./screens/Dashboard/Dashboard";
import { Settings } from "./screens/Settings/Settings";
import { PrayerLog } from "./screens/Log/PrayerLog";
import { CountdownToast } from "./screens/CountdownToast/CountdownToast";
import { Overlay } from "./screens/Overlay/Overlay";

// ── URL-based overlay detection ──────────────────────────────────────────────
// The Rust backend spawns overlay windows at:
//   index.html?screen=overlay&prayer=<PrayerName>
// We read these params once at module load so the overlay window renders the
// correct screen immediately, rather than defaulting to the dashboard.
function getUrlParams(): { screen: string | null; prayer: string | null } {
  const params = new URLSearchParams(window.location.search);
  return {
    screen: params.get("screen"),
    prayer: params.get("prayer"),
  };
}

const urlParams = getUrlParams();
const isOverlayWindow = urlParams.screen === "overlay";
// ─────────────────────────────────────────────────────────────────────────────


export function App() {
  // If this window was spawned as an overlay, skip splash entirely and boot
  // straight into the overlay screen with the correct prayer name.
  const [showSplash, setShowSplash] = useState<boolean>(!isOverlayWindow);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettingsFromStorage());
  const [logs, setLogs] = useState<PrayerLogItem[]>(() => loadLogsFromStorage());
  const [currentScreen, setCurrentScreen] = useState<"dashboard" | "settings" | "log" | "onboarding" | "toast" | "overlay">(
    isOverlayWindow ? "overlay" : "dashboard"
  );
  const [activePrayer, _setActivePrayer] = useState<PrayerName>(
    isOverlayWindow && urlParams.prayer ? (urlParams.prayer as PrayerName) : "Dhuhr"
  );
  const [snoozedPrayers, setSnoozedPrayers] = useState<Set<string>>(new Set());

  // On mount, async-hydrate settings from the canonical Tauri store (IPC →
  // plugin-store → localStorage). The initial useState uses the fast sync
  // localStorage read, but Tauri's JSON file may have newer values (e.g. if
  // the user changed settings and the IPC write succeeded but localStorage
  // wasn't flushed identically). This is especially critical in the overlay
  // window where forcedPauseSeconds must be accurate.
  useEffect(() => {
    loadSettings().then((hydrated) => {
      setSettings((prev) => {
        // Only update if something actually differs to avoid re-renders.
        if (JSON.stringify(prev) !== JSON.stringify(hydrated)) {
          return hydrated;
        }
        return prev;
      });
    });
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Don't run onboarding logic in overlay windows — they are independent
    // Tauri WebviewWindows with a single job: show the forced-pause overlay.
    if (isOverlayWindow) return;

    if (!settings.onboardingCompleted) {
      setCurrentScreen("onboarding");
    } else {
      syncAutostart(settings.launchAtLogin);
    }
  }, [settings.onboardingCompleted, settings.launchAtLogin]);

  const handleSaveSettings = (updated: AppSettings) => {
    setSettings(updated);
    saveSettingsToStorage(updated);
    if (currentScreen === "onboarding") {
      setCurrentScreen("dashboard");
    }
  };

  const handleConfirmPrayed = () => {
    const newEntry: PrayerLogItem = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      prayer: activePrayer,
      scheduledTime: new Date().toISOString(),
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
    };
    const updatedLogs = addLogEntryToStorage(newEntry);
    setLogs(updatedLogs);

    if (isOverlayWindow) {
      // In the overlay window, dismiss via IPC (which closes this window).
      // There is no dashboard to navigate back to in this window context.
      dismissOverlayCommand();
    } else {
      dismissOverlayCommand();
      setCurrentScreen("dashboard");
    }
  };

  const handleEmergencyDismiss = () => {
    const newEntry: PrayerLogItem = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      prayer: activePrayer,
      scheduledTime: new Date().toISOString(),
      status: "emergency_dismissed",
      confirmedAt: new Date().toISOString(),
    };
    const updatedLogs = addLogEntryToStorage(newEntry);
    setLogs(updatedLogs);

    if (isOverlayWindow) {
      // In the overlay window, IPC dismiss closes this window.
      dismissOverlayCommand();
    } else {
      dismissOverlayCommand();
      setCurrentScreen("dashboard");
    }
  };

  const handleTriggerTestOverlay = () => {
    // Spawn the real OS-level hardened window via Tauri IPC —
    // identical to what the scheduler triggers at prayer time.
    triggerOverlayCommand("Dhuhr");
  };

  const handleToggleNotifications = () => {
    const updated = { ...settings, notificationsEnabled: !settings.notificationsEnabled };
    setSettings(updated);
    saveSettingsToStorage(updated);
  };

  const handleSnooze = () => {
    dismissOverlayCommand();
    const todayStr = new Date().toISOString().split("T")[0];
    const snoozeKey = `${todayStr}:${activePrayer}`;

    setSnoozedPrayers((prev) => new Set(prev).add(snoozeKey));
    setCurrentScreen("dashboard");

    setTimeout(() => {
      const currentLogs = loadLogsFromStorage();
      const isAlreadyLogged = currentLogs.some(
        (entry) => entry.date === todayStr && entry.prayer === activePrayer
      );
      if (!isAlreadyLogged) {
        setCurrentScreen("overlay");
      }
    }, 5 * 60 * 1000);
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const activeSnoozeKey = `${todayStr}:${activePrayer}`;
  const hasSnoozedForCurrentPrayer = snoozedPrayers.has(activeSnoozeKey);

  return (
    <div className="w-full min-h-screen bg-[#070a11] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {showSplash && (
        <SplashScreen durationMs={1800} onFinish={() => setShowSplash(false)} />
      )}

      {!showSplash && (
        <>
          {currentScreen === "onboarding" && (
            <Onboarding settings={settings} onComplete={handleSaveSettings} />
          )}

          {currentScreen === "dashboard" && (
            <Dashboard
              settings={settings}
              onNavigate={(screen) => setCurrentScreen(screen)}
              onTriggerTestOverlay={handleTriggerTestOverlay}
              onToggleNotifications={handleToggleNotifications}
              onPreviewSplash={() => setShowSplash(true)}
            />
          )}

          {currentScreen === "settings" && (
            <Settings
              settings={settings}
              onSave={handleSaveSettings}
              onBack={() => setCurrentScreen("dashboard")}
              onPreviewSplash={() => setShowSplash(true)}
            />
          )}

          {currentScreen === "log" && (
            <PrayerLog logs={logs} onBack={() => setCurrentScreen("dashboard")} />
          )}

          {currentScreen === "toast" && (
            <CountdownToast
              prayerName={activePrayer}
              soundEnabled={settings.soundEnabled}
              onComplete={() => setCurrentScreen("overlay")}
            />
          )}

          {currentScreen === "overlay" && (
            <Overlay
              prayerName={activePrayer}
              settings={settings}
              onConfirmPrayed={handleConfirmPrayed}
              onEmergencyDismiss={handleEmergencyDismiss}
              onSnooze={handleSnooze}
              hasSnoozed={hasSnoozedForCurrentPrayer}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
