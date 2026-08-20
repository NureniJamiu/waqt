import { useState, useEffect } from "react";
import { AppSettings, PrayerLogItem, PrayerName } from "./types";
import {
  loadSettingsFromStorage,
  loadSettings,
  saveSettings,
  loadLogsFromStorage,
  loadLogs,
  addLogEntry,
  addEmergencyExtension,
  hasUsedEmergencyDismiss,
  subscribeLogUpdated,
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

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ── URL-based overlay detection ──────────────────────────────────────────────
function getUrlParams(): { screen: string | null; prayer: string | null; emergencyExhausted: boolean } {
  const params = new URLSearchParams(window.location.search);
  return {
    screen: params.get("screen"),
    prayer: params.get("prayer"),
    emergencyExhausted: params.get("emergency_exhausted") === "true",
  };
}

const urlParams = getUrlParams();
const isOverlayWindow = urlParams.screen === "overlay";
// ─────────────────────────────────────────────────────────────────────────────

export function App() {
  const isDevelopment = import.meta.env.DEV;
  const [showSplash, setShowSplash] = useState<boolean>(!isOverlayWindow);
  const [isHydrating, setIsHydrating] = useState<boolean>(true);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettingsFromStorage());
  const [logs, setLogs] = useState<PrayerLogItem[]>(() => loadLogsFromStorage());
  const [currentScreen, setCurrentScreen] = useState<"dashboard" | "settings" | "log" | "onboarding" | "toast" | "overlay">(
    isOverlayWindow ? "overlay" : "dashboard"
  );
  const [activePrayer, _setActivePrayer] = useState<PrayerName>(
    isOverlayWindow && urlParams.prayer ? (urlParams.prayer as PrayerName) : "Dhuhr"
  );
  const [snoozedPrayers, setSnoozedPrayers] = useState<Set<string>>(new Set());
  const [isEmergencyExhausted, setIsEmergencyExhausted] = useState<boolean>(urlParams.emergencyExhausted);

  useEffect(() => {
    loadSettings()
      .then((hydrated) => {
        setSettings((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(hydrated)) {
            return hydrated;
          }
          return prev;
        });
      })
      .finally(() => {
        setIsHydrating(false);
      });

    loadLogs().then((hydratedLogs) => {
      setLogs(hydratedLogs);
    });

    const todayStr = getLocalDateString();
    hasUsedEmergencyDismiss(todayStr, activePrayer).then((used) => {
      if (used || urlParams.emergencyExhausted) {
        setIsEmergencyExhausted(true);
      }
    });

    const unsubscribe = subscribeLogUpdated(() => {
      loadLogs().then((updated) => setLogs(updated));
      hasUsedEmergencyDismiss(todayStr, activePrayer).then((used) => {
        if (used || urlParams.emergencyExhausted) {
          setIsEmergencyExhausted(true);
        }
      });
    });

    return unsubscribe;
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOverlayWindow || isHydrating) return;

    if (!settings.onboardingCompleted) {
      setCurrentScreen("onboarding");
    } else {
      setCurrentScreen((prev) => (prev === "onboarding" ? "dashboard" : prev));
      syncAutostart(settings.launchAtLogin);
    }
  }, [isOverlayWindow, isHydrating, settings.onboardingCompleted, settings.launchAtLogin]);

  const handleSaveSettings = (updated: AppSettings) => {
    setSettings(updated);
    saveSettings(updated);
    if (currentScreen === "onboarding") {
      setCurrentScreen("dashboard");
    }
  };

  const handleConfirmPrayed = async () => {
    const now = new Date();
    const newEntry: PrayerLogItem = {
      id: Date.now().toString(),
      date: getLocalDateString(now),
      prayer: activePrayer,
      scheduledTime: now.toISOString(),
      status: "confirmed",
      confirmedAt: now.toISOString(),
    };
    const updatedLogs = await addLogEntry(newEntry);
    setLogs(updatedLogs);

    if (isOverlayWindow) {
      dismissOverlayCommand();
    } else {
      dismissOverlayCommand();
      setCurrentScreen("dashboard");
    }
  };

  const handleEmergencyDismiss = async () => {
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    const newEntry: PrayerLogItem = {
      id: Date.now().toString(),
      date: todayStr,
      prayer: activePrayer,
      scheduledTime: now.toISOString(),
      status: "emergency_dismissed",
      confirmedAt: now.toISOString(),
    };

    const extensionItem = {
      id: `ext-${Date.now()}`,
      date: todayStr,
      prayer: activePrayer,
      dismissedAt: now.toISOString(),
      expiresAt,
      notified15m: false,
      notified10m: false,
      notified5m: false,
      relocked: false,
    };

    await addEmergencyExtension(extensionItem);
    const updatedLogs = await addLogEntry(newEntry);
    setLogs(updatedLogs);
    setIsEmergencyExhausted(true);

    if (isOverlayWindow) {
      dismissOverlayCommand();
    } else {
      dismissOverlayCommand();
      setCurrentScreen("dashboard");
    }
  };

  const handleTriggerTestOverlay = () => {
    triggerOverlayCommand("Dhuhr", isEmergencyExhausted);
  };

  const handleToggleNotifications = () => {
    const updated = { ...settings, notificationsEnabled: !settings.notificationsEnabled };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleSnooze = () => {
    dismissOverlayCommand();
    const todayStr = getLocalDateString();
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

  const todayStr = getLocalDateString();
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
              onTriggerTestOverlay={isDevelopment ? handleTriggerTestOverlay : undefined}
              onToggleNotifications={handleToggleNotifications}
              onPreviewSplash={isDevelopment ? () => setShowSplash(true) : undefined}
            />
          )}

          {currentScreen === "settings" && (
            <Settings
              settings={settings}
              onSave={handleSaveSettings}
              onBack={() => setCurrentScreen("dashboard")}
              onPreviewSplash={isDevelopment ? () => setShowSplash(true) : undefined}
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
              isEmergencyExhausted={isEmergencyExhausted}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
