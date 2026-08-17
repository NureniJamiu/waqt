import React, { useState, useEffect } from "react";
import { AppSettings, PrayerTime } from "../../types";
import { calculateDailyPrayerTimes } from "../../lib/adhanCalc";
import {
  MapPin,
  Settings as SettingsIcon,
  History,
  PlayCircle,
  Clock,
  Bell,
  BellOff,
  CheckCircle2,
  Sparkles,
  Zap,
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
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [prayers, setPrayers] = useState<PrayerTime[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setPrayers(calculateDailyPrayerTimes(settings, currentTime));
    // Recalculate on every minute boundary (and hour, so we don't miss midnight rollover).
    // The countdown display is handled by the 1s timer above; this effect only needs
    // to update isPassed/isNext which change at prayer-time boundaries.
  }, [settings, currentTime.getHours(), currentTime.getMinutes()]);


  const nextPrayer = prayers.find((p) => p.isNext) || prayers[0];

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
    <div className="min-h-screen bg-[#070a11] text-slate-100 flex flex-col p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Navigation Bar */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-panel p-4 md:px-6 md:py-4 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="relative group cursor-pointer" onClick={onPreviewSplash}>
            <div className="absolute -inset-1 rounded-2xl bg-emerald-500/30 blur-sm group-hover:bg-emerald-500/50 transition" />
            <div className="relative w-11 h-11 rounded-2xl glass-panel p-1.5 ring-1 ring-white/10 flex items-center justify-center bg-slate-900">
              <img src="/logo.png" alt="Waqt Logo" className="w-full h-full object-contain rounded-xl" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold font-display text-xl leading-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Waqt
              </h1>
              <span className="text-[10px] font-bold font-mono tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                PRO
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className="flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                {settings.cityName}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-slate-300">
                <Clock className="w-3 h-3 text-slate-400" />
                {formattedDate}, {formattedTime}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onToggleNotifications && (
            <button
              onClick={onToggleNotifications}
              title={settings.notificationsEnabled ? "Notifications Active" : "Notifications Disabled"}
              className={`p-2.5 rounded-xl text-xs transition-all border ${
                settings.notificationsEnabled
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-glow-emerald"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {settings.notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={() => onNavigate("log")}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all text-slate-200"
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Prayer Log</span>
          </button>

          <button
            onClick={() => onNavigate("settings")}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all text-slate-200"
          >
            <SettingsIcon className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* Hero Countdown Card */}
      {nextPrayer && (
        <div className="relative glass-panel-emerald p-6 md:p-8 rounded-3xl overflow-hidden border border-emerald-500/40 shadow-2xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
                  Upcoming Prayer
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {settings.asrSchool} Asr
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black font-display tracking-tight text-white">
                {nextPrayer.name}
              </h2>
              <p className="text-slate-300 text-sm font-medium">
                Scheduled today at <strong className="text-emerald-400 font-mono text-base">{nextPrayer.formattedTime}</strong>
              </p>
            </div>

            <div className="text-left md:text-right bg-slate-950/60 p-5 md:p-6 rounded-2xl border border-white/10 backdrop-blur-md w-full md:w-auto">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Time Remaining
              </span>
              <div className="font-mono text-4xl md:text-5xl font-black text-emerald-400 tracking-tight shadow-glow-emerald">
                {formattedCountdown(nextPrayer.time)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily 5 Prayer Cards Grid */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            Today's Schedule
          </h3>
          <span className="text-xs text-slate-500 font-mono">5 Daily Mandatory Prayers</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
          {prayers.map((prayer) => (
            <div
              key={prayer.name}
              className={`glass-panel p-4 rounded-2xl flex flex-col justify-between transition-all duration-300 ${
                prayer.isNext
                  ? "glass-panel-emerald ring-2 ring-emerald-500/40 shadow-glow-emerald scale-[1.02]"
                  : prayer.isPassed
                  ? "opacity-60 bg-slate-950/50 border-slate-800"
                  : "glass-panel-hover bg-slate-900/80 hover:bg-slate-800/90"
              }`}
            >
              <div className="flex justify-between items-center">
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

              <div className="mt-5">
                <span className="text-xl font-black font-mono tracking-tight text-white">
                  {prayer.formattedTime}
                </span>
                <div className="mt-1.5 flex items-center gap-1">
                  {prayer.isPassed ? (
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Passed</span>
                  ) : prayer.isNext ? (
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Active Next</span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Scheduled</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Accountability Controls & Footer Info */}
      <footer className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-4 glass-panel px-6 py-4 rounded-2xl border border-white/5">
        <div className="text-xs text-slate-400 flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Forced Pause: <strong className="text-slate-200">{Math.round(settings.forcedPauseSeconds / 60)}m</strong>
          </span>
          <span>•</span>
          <span>
            Snooze: <strong className="text-slate-200">{settings.snoozeEnabled ? "Enabled (5m)" : "Disabled"}</strong>
          </span>
        </div>

        {onTriggerTestOverlay && (
          <button
            onClick={onTriggerTestOverlay}
            className="flex items-center gap-2 text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 rounded-xl transition-all shadow-glow-emerald"
          >
            <PlayCircle className="w-4 h-4 text-emerald-400" />
            <span>Test Overlay Screen</span>
          </button>
        )}
      </footer>
    </div>
  );
};
