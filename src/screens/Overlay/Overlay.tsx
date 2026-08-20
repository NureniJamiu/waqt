import React, { useState, useEffect } from "react";
import { AppSettings, PrayerName } from "../../types";
import { CheckCircle2, AlertTriangle, Moon, ShieldAlert, AlarmClock, Clock, Lock, Volume2, VolumeX } from "lucide-react";
import { playSound, stopSound } from "../../lib/sound";

interface OverlayProps {
  prayerName: PrayerName;
  settings: AppSettings;
  onConfirmPrayed: () => void;
  onEmergencyDismiss: () => void;
  onSnooze?: () => void;
  hasSnoozed?: boolean;
  isEmergencyExhausted?: boolean;
  isTest?: boolean;
}

export const Overlay: React.FC<OverlayProps> = ({
  prayerName,
  settings,
  onConfirmPrayed,
  onEmergencyDismiss,
  onSnooze,
  hasSnoozed = false,
  isEmergencyExhausted = false,
  isTest = false,
}) => {
  const isDevelopment = import.meta.env.DEV;
  const isTestMode = isTest || isDevelopment || isEmergencyExhausted;
  const initialSeconds = isTestMode ? 60 : settings.forcedPauseSeconds;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(initialSeconds);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState<boolean>(false);
  const [snoozed, setSnoozed] = useState<boolean>(hasSnoozed);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(settings.soundEnabled);

  useEffect(() => {
    if (settings.soundEnabled) {
      playSound("takbeer", true);
      setIsPlayingAudio(true);
    }
    return () => {
      stopSound();
    };
  }, [settings.soundEnabled]);

  const handleToggleAudio = () => {
    if (isPlayingAudio) {
      stopSound();
      setIsPlayingAudio(false);
    } else {
      playSound("takbeer", true);
      setIsPlayingAudio(true);
    }
  };

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

  // ─── Keyboard bypass interceptor ───────────────────────────────────────────
  useEffect(() => {
    const BLOCKED_KEYS = new Set(["h", "m", "w", "q", "Tab", " "]);

    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey;
      const alt = e.altKey;

      if (meta && BLOCKED_KEYS.has(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (alt && e.key === "Tab") {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (e.key === "Escape" && !showEmergencyConfirm) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (e.key === "F3" || (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown"))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (e.key === "F11") {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [showEmergencyConfirm]);
  // ───────────────────────────────────────────────────────────────────────────

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

  // SVG Circular Ring Calculation
  const strokeWidth = 8;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="fixed inset-0 z-50 bg-[#05080e] text-slate-100 flex flex-col justify-between p-6 md:p-10 select-none overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(71,85,105,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(71,85,105,0.18)_1px,transparent_1px)] bg-[size:26px_26px] opacity-20" />

      {/* Top Bar */}
      <div className="flex justify-between items-center w-full max-w-5xl mx-auto relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-black tracking-tight text-white">
            <Moon className="w-4 h-4 text-emerald-400" />
            <span>Waqt Forced Pause</span>
          </div>

          <span className="text-slate-700 text-sm font-light">|</span>

          <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>

        {/* Top Right Action Controls */}
        <div className="flex items-center gap-3">
          {/* Stop / Toggle Audio Control */}
          <button
            type="button"
            onClick={handleToggleAudio}
            title={isPlayingAudio ? "Stop Takbeer Audio" : "Play Takbeer Audio"}
            className={`flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-lg border transition-all cursor-pointer active:scale-95 ${
              isPlayingAudio
                ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                : "bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800"
            }`}
          >
            {isPlayingAudio ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Stop Takbeer</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                <span>Audio Muted</span>
              </>
            )}
          </button>

          {/* Enhanced Emergency Dismiss Button */}
          {isEmergencyExhausted ? (
            <button
              disabled
              title="Emergency grace period has already been used for this prayer session."
              className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-900/60 px-4 py-2 rounded-lg border border-slate-800/80 cursor-not-allowed opacity-60"
            >
              <ShieldAlert className="w-4 h-4 text-amber-500/50" />
              <span>Emergency Grace Used</span>
            </button>
          ) : (
            <button
              onClick={() => setShowEmergencyConfirm(true)}
              className="group flex items-center gap-2 text-xs font-bold text-amber-300 hover:text-amber-100 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 hover:from-amber-500/25 hover:to-amber-500/25 px-4 py-2 rounded-lg border border-amber-500/40 hover:border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.15)] transition-all cursor-pointer active:scale-95"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Emergency Dismiss</span>
            </button>
          )}
        </div>
      </div>

      <div className="line-surface rounded-md flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6 relative z-10 px-6 py-8 border border-slate-700/70">
        <div className="relative flex items-center justify-center">
          <svg className="w-44 h-44 -rotate-90 transform">
            <circle
              cx="88"
              cy="88"
              r={radius}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <circle
              cx="88"
              cy="88"
              r={radius}
              stroke={isEmergencyExhausted ? "#f59e0b" : "#10b981"}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-3xl font-black text-white tracking-tight">
              {formatCountdown(secondsRemaining)}
            </span>
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 mt-1">
              {isPauseElapsed ? "Pause Complete" : isEmergencyExhausted ? "Re-locked Pause" : "Forced Pause"}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {isEmergencyExhausted ? (
            <span className="text-xs uppercase font-extrabold tracking-widest text-amber-300 bg-amber-500/10 px-3.5 py-1 rounded-full border border-amber-500/25">
              Emergency Prolongation Expired • System Lock Active
            </span>
          ) : (
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-300 bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/25">
              Time to step away
            </span>
          )}
          <h1 className="text-4xl md:text-5xl font-black font-display tracking-tight text-white">
            It's time for {prayerName}
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-sm leading-relaxed">
            {isEmergencyExhausted
              ? "Your 30-minute emergency extension has ended. Please step away from your screen and perform prayer."
              : "Take a respectful pause from your screen, perform wudu, and prepare for prayer."}
          </p>
        </div>

        <div className="pt-2 flex flex-col items-center gap-3 w-full">
          <button
            onClick={onConfirmPrayed}
            disabled={!isPauseElapsed}
            className={`w-full py-4 px-6 rounded-md font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all ${
              isPauseElapsed
                ? "bg-emerald-500/15 border border-emerald-500/45 text-emerald-200 hover:bg-emerald-500/20 cursor-pointer active:scale-98"
                : "bg-slate-900/90 text-slate-500 border border-slate-800 cursor-not-allowed opacity-75"
            }`}
          >
            {isPauseElapsed ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>I've Prayed</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-slate-500" />
                <span>Unlocks in {formatCountdown(secondsRemaining)}</span>
              </>
            )}
          </button>

          {settings.snoozeEnabled && !snoozed && !isEmergencyExhausted && (
            <button
              onClick={handleSnoozeClick}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-2 pt-1 transition-colors cursor-pointer"
            >
              <AlarmClock className="w-4 h-4 text-emerald-400" />
              <span>Snooze 5 minutes (1 use)</span>
            </button>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] font-mono text-slate-600 relative z-10">
        Waqt • Personal Accountability Overlay
      </div>

      {/* Emergency Dismiss Modal */}
      {showEmergencyConfirm && !isEmergencyExhausted && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] max-w-md w-full p-6 md:p-8 rounded-md border border-amber-500/45 space-y-5 text-left relative z-[101]">
            <div className="flex items-center gap-2.5 text-amber-400 font-extrabold text-lg font-display">
              <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
              <span>Emergency Dismiss (30m Extension)</span>
            </div>
            <p className="text-slate-200 text-xs md:text-sm leading-relaxed">
              Dismiss the overlay for a 30-minute grace period? This action temporarily unlocks your desktop for up to 30 minutes and logs an
              <code className="text-amber-400 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono text-xs ml-1 font-semibold">
                emergency_dismissed
              </code> entry to your local log.
            </p>
            <div className="bg-amber-950/40 border border-amber-500/25 rounded-md p-3 text-xs text-amber-200/90 leading-normal space-y-1">
              <p className="font-bold text-amber-300">Prolongation Schedule:</p>
              <p>• Warning notifications at T-15m, T-10m, and T-5m remaining.</p>
              <p>• System re-locks after 30 minutes with <strong>no emergency grace option</strong>.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEmergencyConfirm(false)}
                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-md text-xs transition-all cursor-pointer border border-slate-700 active:scale-95"
              >
                Cancel (Keep Paused)
              </button>
              <button
                type="button"
                onClick={onEmergencyDismiss}
                className="flex-1 py-3 px-4 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/45 text-amber-200 font-black rounded-md text-xs transition-all cursor-pointer active:scale-95"
              >
                Grant 30m Extension
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
