import { useState, useEffect } from "react";
import { AppSettings, PrayerLogItem, PrayerName } from "./types";
import {
  loadSettingsFromStorage,
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

export function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettingsFromStorage());
  const [logs, setLogs] = useState<PrayerLogItem[]>(() => loadLogsFromStorage());
  const [currentScreen, setCurrentScreen] = useState<"dashboard" | "settings" | "log" | "onboarding" | "toast" | "overlay">("dashboard");
  const [activePrayer, setActivePrayer] = useState<PrayerName>("Dhuhr");
  const [snoozedPrayers, setSnoozedPrayers] = useState<Set<string>>(new Set());

  useEffect(() => {
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
    dismissOverlayCommand();
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
    setCurrentScreen("dashboard");
  };

  const handleEmergencyDismiss = () => {
    dismissOverlayCommand();
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
    setCurrentScreen("dashboard");
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
