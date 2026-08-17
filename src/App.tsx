import { useState, useEffect } from "react";
import { AppSettings, PrayerLogItem, PrayerName } from "./types";
import { loadSettingsFromStorage, saveSettingsToStorage, loadLogsFromStorage, addLogEntryToStorage } from "./lib/store";
import { Onboarding } from "./screens/Onboarding/Onboarding";
import { Dashboard } from "./screens/Dashboard/Dashboard";
import { Settings } from "./screens/Settings/Settings";
import { PrayerLog } from "./screens/Log/PrayerLog";
import { CountdownToast } from "./screens/CountdownToast/CountdownToast";
import { Overlay } from "./screens/Overlay/Overlay";

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettingsFromStorage());
  const [logs, setLogs] = useState<PrayerLogItem[]>(() => loadLogsFromStorage());
  const [currentScreen, setCurrentScreen] = useState<"dashboard" | "settings" | "log" | "onboarding" | "toast" | "overlay">("dashboard");
  const [activePrayer, setActivePrayer] = useState<PrayerName>("Dhuhr");

  useEffect(() => {
    if (!settings.onboardingCompleted) {
      setCurrentScreen("onboarding");
    }
  }, [settings.onboardingCompleted]);

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
    setCurrentScreen("dashboard");
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
    setCurrentScreen("dashboard");
  };

  const handleTriggerTestOverlay = () => {
    setActivePrayer("Dhuhr");
    setCurrentScreen("toast");
  };

  return (
    <div className="w-full min-h-screen bg-background text-slate-100">
      {currentScreen === "onboarding" && (
        <Onboarding settings={settings} onComplete={handleSaveSettings} />
      )}

      {currentScreen === "dashboard" && (
        <Dashboard
          settings={settings}
          onNavigate={(screen) => setCurrentScreen(screen)}
          onTriggerTestOverlay={handleTriggerTestOverlay}
        />
      )}

      {currentScreen === "settings" && (
        <Settings
          settings={settings}
          onSave={handleSaveSettings}
          onBack={() => setCurrentScreen("dashboard")}
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
        />
      )}
    </div>
  );
}

export default App;
