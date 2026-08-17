import React, { useState, useEffect } from "react";
import { AppSettings, PrayerName } from "../../types";
import { CheckCircle2, AlertTriangle, Moon, ShieldAlert, AlarmClock, Clock } from "lucide-react";

interface OverlayProps {
  prayerName: PrayerName;
  settings: AppSettings;
  onConfirmPrayed: () => void;
  onEmergencyDismiss: () => void;
  onSnooze?: () => void;
}

export const Overlay: React.FC<OverlayProps> = ({
  prayerName,
  settings,
  onConfirmPrayed,
  onEmergencyDismiss,
  onSnooze,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(settings.forcedPauseSeconds);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState<boolean>(false);
  const [snoozed, setSnoozed] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const isPauseElapsed = secondsRemaining === 0;

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = Math.min(
    100,
    Math.max(0, ((settings.forcedPauseSeconds - secondsRemaining) / settings.forcedPauseSeconds) * 100)
  );

  const handleSnoozeClick = () => {
    setSnoozed(true);
    if (onSnooze) onSnooze();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070a0f] text-slate-100 flex flex-col justify-between p-8 select-none overflow-hidden">
      {/* Top Emergency Bar */}
      <div className="flex justify-between items-center w-full max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800">
            <Moon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Waqt Forced Pause</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800/80">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>

        {/* Emergency Dismiss Button - ALWAYS CLICKABLE */}
        <button
          onClick={() => setShowEmergencyConfirm(true)}
          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-1.5 rounded-full border border-amber-500/30 transition-colors cursor-pointer"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Emergency Dismiss</span>
        </button>
      </div>

      {/* Main Center Content */}
      <div className="flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6">
        {/* Calm Icon */}
        <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-2xl shadow-emerald-500/10">
          <Moon className="w-10 h-10 animate-pulse-subtle" />
        </div>

        {/* Non-shaming copy */}
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-emerald-400">Time to step away</span>
          <h1 className="text-4xl font-extrabold tracking-tight mt-1 text-white">It's time for {prayerName}</h1>
          <p className="text-slate-400 text-sm mt-2 max-w-md">
            Take a moment to pause work, perform wudu, and prepare for prayer.
          </p>
        </div>

        {/* Forced Pause Progress Ring / Bar */}
        <div className="w-full space-y-2 pt-2">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400">
            <span>Forced Pause</span>
            <span className="font-bold text-emerald-400">{formatCountdown(secondsRemaining)} remaining</span>
          </div>
          <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col items-center gap-3 w-full">
          {/* I've Prayed Button - DISABLED until forced pause elapses */}
          <button
            onClick={onConfirmPrayed}
            disabled={!isPauseElapsed}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-xl ${
              isPauseElapsed
                ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/25 active:scale-98 cursor-pointer"
                : "bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60"
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isPauseElapsed ? "I've Prayed" : `Button unlocks in ${formatCountdown(secondsRemaining)}`}</span>
          </button>

          {/* Optional Snooze Button */}
          {settings.snoozeEnabled && !snoozed && (
            <button
              onClick={handleSnoozeClick}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 pt-1 transition-colors cursor-pointer"
            >
              <AlarmClock className="w-3.5 h-3.5 text-slate-400" />
              <span>Snooze 5 minutes (1 use)</span>
            </button>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-slate-600">
        Waqt • Respectful Accountability Overlay
      </div>

      {/* Emergency Modal Confirmation */}
      {showEmergencyConfirm && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-amber-500/30 space-y-4 text-left">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
              <ShieldAlert className="w-5 h-5" />
              <span>Emergency Dismiss</span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Dismiss without confirming prayer? This action will immediately close the overlay and write an
              <code className="text-amber-400 bg-amber-950/40 px-1 py-0.5 rounded text-xs ml-1 font-mono">
                emergency_dismissed
              </code> entry to your local log.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEmergencyConfirm(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel (Keep Paused)
              </button>
              <button
                onClick={onEmergencyDismiss}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-md shadow-amber-500/20 cursor-pointer"
              >
                Yes, Dismiss Immediately
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

