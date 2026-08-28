import React from "react";
import { Clock, ShieldCheck, CheckCircle2, MapPin, Sparkles, AlertCircle } from "lucide-react";

export const AppPreview: React.FC = () => {
  return (
    <div className="relative mx-auto w-full max-w-5xl rounded-2xl border border-slate-700/60 bg-slate-900/90 p-2 sm:p-3 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl transition-all duration-300 hover:border-slate-600/80">
      {/* Top Window Bar */}
      <div className="flex items-center justify-between rounded-t-xl bg-slate-950/80 px-4 py-2.5 border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          <div className="h-3 w-3 rounded-full bg-rose-500/80" />
          <div className="h-3 w-3 rounded-full bg-amber-500/80" />
          <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex items-center space-x-2 rounded-lg bg-slate-900/90 px-4 py-1 text-xs text-slate-400 border border-slate-800">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-mono text-[11px] text-slate-300">waqt.app // dashboard</span>
        </div>
        <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-mono">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">OFFLINE MODE</span>
        </div>
      </div>

      {/* Main App Canvas Simulation */}
      <div className="p-4 sm:p-6 space-y-5 bg-[#080d1a]/90 rounded-b-xl">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/70 border border-slate-800/90">
          <div>
            <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
              <MapPin className="h-3.5 w-3.5 text-emerald-400" />
              <span>Lagos, Nigeria • Muslim World League</span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Next: <span className="text-emerald-400">Asr</span>
              <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                in 1h 14m
              </span>
            </h3>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-2 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-300">Honor System Active</span>
            </div>
            <div className="flex items-center space-x-2 bg-amber-950/30 border border-amber-500/30 px-3 py-1.5 rounded-lg">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-300">7m Forced Pause</span>
            </div>
          </div>
        </div>

        {/* Prayer Time Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
          {/* Fajr */}
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 font-medium">Fajr</span>
            <div className="text-base font-bold text-slate-200 my-1">05:32 AM</div>
            <div className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-900/50">
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>Confirmed</span>
            </div>
          </div>

          {/* Dhuhr */}
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 font-medium">Dhuhr</span>
            <div className="text-base font-bold text-slate-200 my-1">01:05 PM</div>
            <div className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-900/50">
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>Confirmed</span>
            </div>
          </div>

          {/* Asr (Current Next) */}
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-center shadow-lg shadow-emerald-950/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-0.5 bg-emerald-400" />
            <span className="text-xs text-emerald-300 font-semibold">Asr</span>
            <div className="text-base font-bold text-emerald-100 my-1">04:22 PM</div>
            <div className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-500/40">
              <Clock className="h-2.5 w-2.5 animate-spin" />
              <span>Next Prayer</span>
            </div>
          </div>

          {/* Maghrib */}
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 font-medium">Maghrib</span>
            <div className="text-base font-bold text-slate-200 my-1">06:58 PM</div>
            <div className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full">
              <span>Upcoming</span>
            </div>
          </div>

          {/* Isha */}
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-center col-span-2 sm:col-span-1">
            <span className="text-xs text-slate-400 font-medium">Isha</span>
            <div className="text-base font-bold text-slate-200 my-1">08:12 PM</div>
            <div className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full">
              <span>Upcoming</span>
            </div>
          </div>
        </div>

        {/* Forced Pause Simulation Overlay Preview Card */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">Full-Screen Overlay Simulation</div>
              <div className="text-xs text-slate-400">At T-0, Waqt pauses your screen to give you time to step away.</div>
            </div>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-amber-400">
              Timer: 06:14
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium cursor-not-allowed opacity-75">
              I've Prayed (Unlocks at 00:00)
            </div>
            <div className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>Emergency Dismiss</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
