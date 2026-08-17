import React, { useState, useEffect } from "react";
import { AppSettings, PrayerTime } from "../../types";
import { calculateDailyPrayerTimes } from "../../lib/adhanCalc";
import { MapPin, Settings as SettingsIcon, History, PlayCircle, ShieldCheck } from "lucide-react";

interface DashboardProps {
  settings: AppSettings;
  onNavigate: (screen: "dashboard" | "settings" | "log") => void;
  onTriggerTestOverlay?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ settings, onNavigate, onTriggerTestOverlay }) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [prayers, setPrayers] = useState<PrayerTime[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setPrayers(calculateDailyPrayerTimes(settings, currentTime));
  }, [settings, currentTime.getMinutes()]);

  const nextPrayer = prayers.find((p) => p.isNext) || prayers[0];

  const getTimeRemaining = (target: Date) => {
    const diff = target.getTime() - currentTime.getTime();
    if (diff <= 0) return "00:00:00";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col p-6 max-w-4xl mx-auto space-y-6">
      {/* Top Navbar */}
      <header className="flex justify-between items-center glass-panel px-6 py-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Waqt</h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{settings.cityName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate("log")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            <span>Prayer Log</span>
          </button>
          <button
            onClick={() => onNavigate("settings")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Hero Countdown Card */}
      {nextPrayer && (
        <div className="glass-panel p-8 rounded-3xl relative overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div>
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 mb-2">
                Next Prayer
              </span>
              <h2 className="text-4xl font-extrabold text-white">{nextPrayer.name}</h2>
              <p className="text-slate-400 text-sm mt-1">Scheduled for {nextPrayer.formattedTime}</p>
            </div>

            <div className="text-left md:text-right">
              <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Time Remaining
              </span>
              <span className="font-mono text-4xl md:text-5xl font-black text-emerald-400 tracking-tight">
                {getTimeRemaining(nextPrayer.time)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Daily 5 Prayer Cards Grid */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Today's Schedule</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {prayers.map((prayer) => (
            <div
              key={prayer.name}
              className={`glass-panel p-4 rounded-2xl flex flex-col justify-between transition-all ${
                prayer.isNext
                  ? "border-emerald-500/50 bg-emerald-950/20 ring-2 ring-emerald-500/20"
                  : prayer.isPassed
                  ? "opacity-60 bg-slate-900/40"
                  : "bg-slate-900/80"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">{prayer.name}</span>
                {prayer.isNext && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>

              <div className="mt-4">
                <span className="text-xl font-bold font-mono tracking-tight">{prayer.formattedTime}</span>
                <div className="mt-1">
                  {prayer.isPassed ? (
                    <span className="text-[10px] text-slate-500">Passed</span>
                  ) : prayer.isNext ? (
                    <span className="text-[10px] text-emerald-400 font-semibold">Upcoming</span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Scheduled</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dev Test Overlay Trigger */}
      {onTriggerTestOverlay && (
        <div className="pt-4 flex justify-end">
          <button
            onClick={onTriggerTestOverlay}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Test Overlay Screen</span>
          </button>
        </div>
      )}
    </div>
  );
};
