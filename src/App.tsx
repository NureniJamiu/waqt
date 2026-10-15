import { useState, useEffect } from "react";
import { AppSettings, DesktopPrepOutcome, PrayerLogItem, PrayerName } from "./types";
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
  subscribeTimezoneChanged,
  subscribeDesktopPrep,
  subscribeScheduleRefreshed,
  dismissOverlayCommand,
  snoozeOverlayCommand,
  triggerOverlayCommand,
  triggerToastCommand,
  dismissToastCommand,
  syncAutostart,
} from "./lib/store";
import { getEffectivePrayerDateString } from "./lib/adhanCalc";
import { SplashScreen } from "./screens/SplashScreen/SplashScreen";
import { Onboarding } from "./screens/Onboarding/Onboarding";
import { Dashboard } from "./screens/Dashboard/Dashboard";
import { Settings } from "./screens/Settings/Settings";
import { PrayerLog } from "./screens/Log/PrayerLog";
import { CountdownToast } from "./screens/CountdownToast/CountdownToast";
import { Overlay } from "./screens/Overlay/Overlay";
import { LandingPage } from "./screens/Landing/LandingPage";
import { DesktopPrepNotice } from "./components/DesktopPrepNotice";

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ── URL-based window detection ──────────────────────────────────────────────
function getUrlParams(): { screen: string | null; prayer: string | null; emergencyExhausted: boolean; isTest: boolean; snoozed: boolean; startedAt: number | null } {
  const params = new URLSearchParams(window.location.search);
  return {
    screen: params.get("screen"),
    prayer: params.get("prayer"),
    emergencyExhausted: params.get("emergency_exhausted") === "true",
    isTest: params.get("is_test") === "true",
    snoozed: params.get("snoozed") === "true",
    startedAt: Number(params.get("started_at")) || null,
  };
}

const urlParams = getUrlParams();
const isOverlayWindow = urlParams.screen === "overlay";
const isToastWindow = urlParams.screen === "toast";
const isLandingWindow =
  urlParams.screen === "landing" ||
  (!urlParams.screen && typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__);
// ─────────────────────────────────────────────────────────────────────────────

export function App() {
  const isDevelopment = import.meta.env.DEV;
  const [showSplash, setShowSplash] = useState<boolean>(!isOverlayWindow && !isToastWindow && !isLandingWindow);
  const [isHydrating, setIsHydrating] = useState<boolean>(true);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettingsFromStorage());
  const [logs, setLogs] = useState<PrayerLogItem[]>(() => loadLogsFromStorage());
  const [currentScreen, setCurrentScreen] = useState<"dashboard" | "settings" | "log" | "onboarding" | "toast" | "overlay" | "landing">(
    isLandingWindow ? "landing" : isOverlayWindow ? "overlay" : isToastWindow ? "toast" : "dashboard"
  );
  const [activePrayer, _setActivePrayer] = useState<PrayerName>(
    (isOverlayWindow || isToastWindow) && urlParams.prayer ? (urlParams.prayer as PrayerName) : "Dhuhr"
  );
  const [snoozedPrayers, setSnoozedPrayers] = useState<Set<string>>(new Set());
  const [isEmergencyExhausted, setIsEmergencyExhausted] = useState<boolean>(urlParams.emergencyExhausted);
  const [isTestOverlay, setIsTestOverlay] = useState<boolean>(urlParams.isTest);
  // Last failed desktop sweep, surfaced in the dashboard window. Kept in state
  // rather than shown immediately because the main window is usually hidden in
  // the tray when the sweep runs — the user sees it next time they open Waqt.
  const [desktopPrepIssue, setDesktopPrepIssue] = useState<DesktopPrepOutcome | null>(null);

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

    if (!urlParams.isTest) {
      const effectiveDateStr = getEffectivePrayerDateString(activePrayer);
      hasUsedEmergencyDismiss(effectiveDateStr, activePrayer).then((used) => {
        if (used || urlParams.emergencyExhausted) {
          setIsEmergencyExhausted(true);
        }
      });
    }

    const unsubscribeLog = subscribeLogUpdated(() => {
      loadLogs().then((updated) => setLogs(updated));
      if (!urlParams.isTest) {
        const currentEffectiveDateStr = getEffectivePrayerDateString(activePrayer);
        hasUsedEmergencyDismiss(currentEffectiveDateStr, activePrayer).then((used) => {
          if (used || urlParams.emergencyExhausted) {
            setIsEmergencyExhausted(true);
          }
        });
      }
    });

    const unsubscribeTz = subscribeTimezoneChanged(() => {
      loadSettings().then((s) => setSettings(s));
      loadLogs().then((l) => setLogs(l));
    });

    // The OS slept through one or more scheduler ticks; every countdown on
    // screen is stale.
    const unsubscribeWake = subscribeScheduleRefreshed(() => {
      loadSettings().then((s) => setSettings(s));
      loadLogs().then((l) => setLogs(l));
    });

    // The desktop sweep reports itself here. Only the main window renders the
    // notice — putting it over the prayer overlay would be the wrong moment,
    // and the toast window has no room for it.
    const unsubscribePrep = subscribeDesktopPrep((outcome) => {
      if (isOverlayWindow || isToastWindow || isLandingWindow) return;
      if (outcome.status === "completed" || outcome.status === "skipped") {
        setDesktopPrepIssue(null);
      } else {
        setDesktopPrepIssue(outcome);
      }
    });

    let unlistenToast: (() => void) | null = null;
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen<string>("waqt:trigger-toast", (event) => {
          if (event.payload && isToastWindow) {
            _setActivePrayer(event.payload as PrayerName);
            setCurrentScreen("toast");
          }
        }).then((unlistenFn) => {
          unlistenToast = unlistenFn;
        });
      }).catch((err) => console.warn("Failed to listen for waqt:trigger-toast:", err));
    }

    return () => {
      unsubscribeLog();
      unsubscribeTz();
      unsubscribeWake();
      unsubscribePrep();
      if (unlistenToast) {
        unlistenToast();
      }
    };
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOverlayWindow || isToastWindow || isLandingWindow || isHydrating) return;

    if (!settings.onboardingCompleted) {
      setCurrentScreen("onboarding");
    } else {
      setCurrentScreen((prev) => (prev === "onboarding" ? "dashboard" : prev));
      syncAutostart(settings.launchAtLogin);
    }
  }, [isOverlayWindow, isToastWindow, isHydrating, settings.onboardingCompleted, settings.launchAtLogin]);

  const handleSaveSettings = (updated: AppSettings) => {
    setSettings(updated);
    saveSettings(updated);
    if (currentScreen === "onboarding") {
      setCurrentScreen("dashboard");
    }
  };

  const handleConfirmPrayed = async () => {
    if (!isTestOverlay && !urlParams.isTest) {
      const now = new Date();
      const prayerDateStr = getEffectivePrayerDateString(activePrayer, now);
      const newEntry: PrayerLogItem = {
        id: Date.now().toString(),
        date: prayerDateStr,
        prayer: activePrayer,
        scheduledTime: now.toISOString(),
        status: "confirmed",
        confirmedAt: now.toISOString(),
      };
      const updatedLogs = await addLogEntry(newEntry);
      setLogs(updatedLogs);
    }

    setIsTestOverlay(false);
    setIsEmergencyExhausted(false);

    if (isOverlayWindow || isToastWindow) {
      dismissOverlayCommand();
      dismissToastCommand();
    } else {
      dismissOverlayCommand();
      dismissToastCommand();
      setCurrentScreen("dashboard");
    }
  };

  const handleEmergencyDismiss = async () => {
    if (isTestOverlay || urlParams.isTest) {
      dismissOverlayCommand();
      dismissToastCommand();
      setCurrentScreen("dashboard");

      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        import("@tauri-apps/plugin-notification")
          .then(({ isPermissionGranted, requestPermission, sendNotification }) => {
            isPermissionGranted().then((granted: boolean) => {
              if (granted) {
                sendNotification({
                  title: "Test Emergency Extension",
                  body: "10-second test grace period active. System will re-lock once expired.",
                });
              } else {
                requestPermission().then((perm: string) => {
                  if (perm === "granted") {
                    sendNotification({
                      title: "Test Emergency Extension",
                      body: "10-second test grace period active. System will re-lock once expired.",
                    });
                  }
                });
              }
            });
          })
          .catch(() => {});
      }

      setTimeout(() => {
        setIsTestOverlay(true);
        setIsEmergencyExhausted(true);
        if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
          triggerOverlayCommand(activePrayer, true, true);
        } else {
          setCurrentScreen("overlay");
        }
      }, 10000);
      return;
    }

    const now = new Date();
    const prayerDateStr = getEffectivePrayerDateString(activePrayer, now);
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    const newEntry: PrayerLogItem = {
      id: Date.now().toString(),
      date: prayerDateStr,
      prayer: activePrayer,
      scheduledTime: now.toISOString(),
      status: "emergency_dismissed",
      confirmedAt: now.toISOString(),
    };

    const extensionItem = {
      id: `ext-${Date.now()}`,
      date: prayerDateStr,
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

    if (isOverlayWindow || isToastWindow) {
      dismissOverlayCommand();
      dismissToastCommand();
    } else {
      dismissOverlayCommand();
      dismissToastCommand();
      setCurrentScreen("dashboard");
    }
  };

  const handleTriggerTestOverlay = () => {
    setIsTestOverlay(true);
    setIsEmergencyExhausted(false);
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      triggerOverlayCommand("Dhuhr", false, true);
    } else {
      setCurrentScreen("overlay");
    }
  };

  const handleTriggerTestToast = () => {
    setIsTestOverlay(true);
    setIsEmergencyExhausted(false);
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      triggerToastCommand("Dhuhr", true);
    } else {
      setCurrentScreen("toast");
    }
  };

  const handleToggleNotifications = () => {
    const updated = { ...settings, notificationsEnabled: !settings.notificationsEnabled };
    setSettings(updated);
    saveSettings(updated);
  };

  // The 5-minute timer runs in the backend: dismissing the overlay destroys
  // this webview, so a setTimeout here would never fire.
  const handleSnooze = () => {
    const snoozeKey = `${getLocalDateString()}:${activePrayer}`;
    setSnoozedPrayers((prev) => new Set(prev).add(snoozeKey));
    dismissToastCommand();
    snoozeOverlayCommand(activePrayer, isEmergencyExhausted, isTestOverlay || urlParams.isTest);
    if (!isOverlayWindow) {
      setCurrentScreen("dashboard");
    }
  };

  const todayStr = getLocalDateString();
  const activeSnoozeKey = `${todayStr}:${activePrayer}`;
  const hasSnoozedForCurrentPrayer = urlParams.snoozed || snoozedPrayers.has(activeSnoozeKey);

  return (
    <div className={`w-full min-h-screen ${isToastWindow ? "bg-transparent overflow-hidden flex items-center justify-center p-2" : "bg-[#070a11] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200"}`}>
      {showSplash && (
        <SplashScreen durationMs={1800} onFinish={() => setShowSplash(false)} />
      )}

      {!showSplash && (
        <>
          {desktopPrepIssue &&
            (currentScreen === "dashboard" ||
              currentScreen === "settings" ||
              currentScreen === "log") && (
              <div className="px-4 pt-4">
                <DesktopPrepNotice
                  outcome={desktopPrepIssue}
                  onDismiss={() => setDesktopPrepIssue(null)}
                />
              </div>
            )}

          {currentScreen === "onboarding" && (
            <Onboarding settings={settings} onComplete={handleSaveSettings} />
          )}

          {currentScreen === "dashboard" && (
            <Dashboard
              settings={settings}
              onNavigate={(screen) => setCurrentScreen(screen)}
              onTriggerTestOverlay={isDevelopment ? handleTriggerTestOverlay : undefined}
              onTriggerTestToast={isDevelopment ? handleTriggerTestToast : undefined}
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
              isToastWindow={isToastWindow}
              onComplete={() => {
                if (isToastWindow) {
                  triggerOverlayCommand(activePrayer, isEmergencyExhausted, isTestOverlay || urlParams.isTest);
                  dismissToastCommand();
                } else {
                  dismissToastCommand();
                  setCurrentScreen("dashboard");
                  triggerOverlayCommand(activePrayer, isEmergencyExhausted, isTestOverlay || urlParams.isTest);
                }
              }}
            />
          )}

          {currentScreen === "landing" && (
            <LandingPage />
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
              isTest={isTestOverlay || urlParams.isTest}
              startedAt={urlParams.startedAt ?? undefined}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
