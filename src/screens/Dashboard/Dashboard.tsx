import React, { useState, useEffect } from "react";
import { AppSettings, PrayerTime } from "../../types";
import { calculateDailyPrayerTimes, getUpcomingPrayer } from "../../lib/adhanCalc";
import {
  MapPin,
  Settings as SettingsIcon,
  History,
  PlayCircle,
  Clock,
  Bell,
  BellOff,
  CheckCircle2,
} from "lucide-react";

interface DashboardProps {
  settings: AppSettings;
  onNavigate: (screen: "dashboard" | "settings" | "log") => void;
  onTriggerTestOverlay?: () => void;
  onToggleNotifications?: () => void;
  onPreviewSplash?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  settings,
  onNavigate,
  onTriggerTestOverlay,
  onToggleNotifications,
  onPreviewSplash,
}) => {
  const isDevelopment = import.meta.env.DEV;
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [prayers, setPrayers] = useState<PrayerTime[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setPrayers(calculateDailyPrayerTimes(settings, currentTime, currentTime));
    // Recalculate on every minute boundary (and hour, so we don't miss midnight rollover).
    // The countdown display is handled by the 1s timer above; this effect only needs
    // to update isPassed/isNext which change at prayer-time boundaries.
  }, [settings, currentTime.getHours(), currentTime.getMinutes()]);


  const nextPrayer = getUpcomingPrayer(settings, currentTime);

  const getTimeRemainingMs = (target: Date) => {
    return Math.max(0, target.getTime() - currentTime.getTime());
  };

  const formattedCountdown = (target: Date) => {
    const diff = getTimeRemainingMs(target);
    if (diff <= 0) return "00:00:00";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const formattedDate = currentTime.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 flex flex-col p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="line-surface rounded-md px-4 md:px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          {isDevelopment && onPreviewSplash ? (
            <button
              type="button"
              onClick={onPreviewSplash}
              className="group shrink-0"
              aria-label="Preview splash screen"
            >
              <img
                src="/logo.png?v=3"
                alt="Waqt Logo"
                className="h-14 w-14 object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </button>
          ) : (
            <img
              src="/logo.png?v=3"
              alt="Waqt Logo"
              className="h-14 w-14 shrink-0 object-contain"
            />
          )}

          <div className="min-w-0 pt-0.5">
            <h1 className="font-extrabold font-display text-xl leading-tight text-white">
              Waqt
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span className="truncate max-w-[14rem] font-medium text-slate-300">{settings.cityName}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="inline-flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{formattedDate}</span>
                <span className="text-slate-600">•</span>
                <span>{formattedTime}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 self-stretch lg:self-auto">
          {onToggleNotifications && (
            <button
              onClick={onToggleNotifications}
              title={settings.notificationsEnabled ? "Notifications Active" : "Notifications Disabled"}
              aria-label={settings.notificationsEnabled ? "Disable notifications" : "Enable notifications"}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                settings.notificationsEnabled
                  ? "border-emerald-400/20 bg-emerald-500/8 text-emerald-300"
                  : "border-slate-700/70 bg-transparent text-slate-400 hover:border-slate-600 hover:bg-slate-900/40 hover:text-slate-200"
              }`}
            >
              {settings.notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={() => onNavigate("settings")}
            aria-label="Settings"
            title="Settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/70 bg-transparent text-slate-400 transition-colors hover:border-slate-600 hover:bg-slate-900/40 hover:text-slate-200"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate("log")}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/14 hover:text-white"
          >
            <History className="w-4 h-4 text-emerald-300" />
            <span>Prayer Log</span>
          </button>
        </div>
      </header>

      <div className="line-surface rounded-3xl overflow-hidden">
        {nextPrayer && (
          <section className="px-5 md:px-7 py-6 border-b border-slate-800/80">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Upcoming Prayer</div>
                <h2 className="text-4xl md:text-5xl font-black font-display tracking-tight text-white mt-2">{nextPrayer.name}</h2>
                <div className="text-slate-300 text-sm mt-2 space-y-0.5">
                  <p>
                    Adhan Time: <strong className="text-emerald-300 font-mono">{nextPrayer.formattedTime}</strong>
                  </p>
                  {(settings.preLockMinutes ?? 15) > 0 && (
                    <p className="text-xs text-slate-400">
                      Locks laptop at <strong className="text-amber-300 font-mono">{nextPrayer.formattedLockTime}</strong> ({settings.preLockMinutes ?? 15}m lead time for Masjid)
                    </p>
                  )}
                </div>
              </div>

              <div className="w-full md:w-auto md:text-right">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  {(settings.preLockMinutes ?? 15) > 0 ? "Time Until Lock" : "Time Remaining"}
                </div>
                <div className="font-mono text-4xl md:text-5xl font-black text-emerald-300 tracking-tight mt-1">
                  {formattedCountdown((settings.preLockMinutes ?? 15) > 0 ? nextPrayer.lockTime : nextPrayer.time)}
                </div>
                <div className="text-[11px] text-slate-500 mt-2">{settings.asrSchool} Asr school</div>
              </div>
            </div>
          </section>
        )}

        <section className="px-4 md:px-5 py-5 border-b border-slate-800/80">
          <div className="px-1 py-1 flex justify-between items-center">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Today's Schedule</h3>
            <span className="text-xs text-slate-500 font-mono">5 daily prayers</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-4">
            {prayers.map((prayer) => (
              <div
                key={prayer.name}
                className={`relative overflow-hidden rounded-md p-3.5 border transition-colors ${
                  prayer.isNext
                    ? "border-emerald-400/50 bg-emerald-500/5"
                    : prayer.isPassed
                    ? "border-slate-700/80 bg-slate-950/45"
                    : "line-surface-soft"
                }`}
              >
                <div
                  className={`absolute left-0 top-0 h-[2px] w-full ${
                    prayer.isNext ? "bg-emerald-400/80" : prayer.isPassed ? "bg-slate-700" : "bg-slate-600/70"
                  }`}
                />

                <div className="flex items-center justify-between gap-3">
                  <span className={`font-bold text-sm font-display ${prayer.isNext ? "text-emerald-300" : "text-slate-200"}`}>
                    {prayer.name}
                  </span>
                  {prayer.isNext ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                  ) : prayer.isPassed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </div>

                <div className="mt-4">
                  <span className="text-lg font-black font-mono tracking-tight text-white">{prayer.formattedTime}</span>
                  {(settings.preLockMinutes ?? 15) > 0 && (
                    <div className="text-[11px] text-amber-300/80 font-mono mt-0.5">
                      Lock: {prayer.formattedLockTime}
                    </div>
                  )}
                  {prayer.isPassed ? (
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Passed</div>
                  ) : prayer.isNext ? (
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mt-1">Next</div>
                  ) : (
                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-1">Scheduled</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="px-5 md:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-slate-400 flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Pre-Lock Lead: <strong className="text-slate-200">{settings.preLockMinutes ?? 15}m</strong>
            </span>
            <span>•</span>
            <span>
              Forced Pause: <strong className="text-slate-200">{Math.round(settings.forcedPauseSeconds / 60)}m</strong>
            </span>
            <span>•</span>
            <span>
              Snooze: <strong className="text-slate-200">{settings.snoozeEnabled ? "Enabled (5m)" : "Disabled"}</strong>
            </span>
          </div>

          {isDevelopment && onTriggerTestOverlay && (
            <button
              onClick={onTriggerTestOverlay}
              className="line-button flex items-center gap-2 text-xs font-semibold text-emerald-300 px-4 py-2 rounded-full"
            >
              <PlayCircle className="w-4 h-4 text-emerald-400" />
              <span>Test Overlay Screen</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
