import React, { useEffect, useState } from "react";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import { mmss } from "./landingData";

// Pieces of the real app's interface, rebuilt with the same classes and copy as
// src/screens/Overlay, CountdownToast and Dashboard.

const RING_R = 70;
const RING_C = 2 * Math.PI * RING_R;

/** A forced pause that starts on mount and counts down on the wall clock. */
export function usePause(totalSeconds: number) {
  const [started, setStarted] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const remaining = Math.max(0, totalSeconds - (now - started) / 1000);
  return {
    remaining,
    restart: () => {
      setStarted(Date.now());
      setNow(Date.now());
    },
  };
}

interface OverlayCardProps {
  prayer: string;
  remaining: number;
  total?: number;
  /** The re-lock overlay shown after the emergency grace period ends. */
  relock?: boolean;
  className?: string;
}

export const OverlayCard: React.FC<OverlayCardProps> = ({ prayer, remaining, total = 900, relock = false, className = "" }) => {
  const open = remaining <= 0;
  const progress = Math.min(1, Math.max(0, (total - remaining) / total));
  const [nudge, setNudge] = useState(false);

  return (
    <div className={`flex flex-col items-center text-center space-y-5 px-7 py-8 ${className}`}>
      <div className="relative flex items-center justify-center">
        <svg className="w-40 h-40 -rotate-90" viewBox="0 0 176 176" aria-hidden="true">
          <circle cx="88" cy="88" r={RING_R} stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
          <circle
            cx="88"
            cy="88"
            r={RING_R}
            stroke={relock ? "#f59e0b" : "#10b981"}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C - progress * RING_C}
            className="transition-[stroke-dashoffset,stroke] duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-black text-white tracking-tight tabular-nums">{mmss(remaining)}</span>
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 mt-1">
            {open ? "Pause Complete" : relock ? "Re-locked Pause" : "Forced Pause"}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {relock ? (
          <span className="text-[11px] uppercase font-extrabold tracking-widest text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/25">
            System lock active
          </span>
        ) : (
          <span className="text-[11px] uppercase font-extrabold tracking-widest text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/25">
            Time to step away
          </span>
        )}
        <div className="text-3xl font-black font-display tracking-tight text-white pt-1">It's time for {prayer}</div>
        <p className="text-slate-400 text-xs leading-relaxed max-w-[17rem] mx-auto">
          {relock
            ? "Your 30-minute emergency extension has ended. Please step away from your screen and perform prayer."
            : "Take a respectful pause from your screen, perform wudu, and prepare for prayer."}
        </p>
      </div>
      <button
        type="button"
        aria-disabled={!open}
        onClick={() => {
          if (open) return;
          setNudge(true);
          window.setTimeout(() => setNudge(false), 300);
        }}
        className={`w-full py-3.5 px-5 rounded-md font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all ${
          nudge ? "translate-x-1" : ""
        } ${
          open
            ? "bg-emerald-500/15 border border-emerald-500/45 text-emerald-200 hover:bg-emerald-500/20"
            : "bg-slate-900/90 text-slate-400 border border-slate-800 cursor-not-allowed"
        }`}
      >
        {open ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
        <span className="tabular-nums">{open ? "I've Prayed" : `Unlocks in ${mmss(remaining)}`}</span>
      </button>
    </div>
  );
};

export const Toast: React.FC<{ prayer: string; seconds: number; className?: string }> = ({ prayer, seconds, className = "" }) => {
  const c = 2 * Math.PI * 18;
  return (
    <div className={`relative p-4 flex items-center gap-4 overflow-hidden ${className}`}>
      <div className="absolute top-0 left-0 h-[2px] w-full bg-emerald-500" />
      <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="18" stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="none" />
          <circle
            cx="24"
            cy="24"
            r="18"
            stroke="#10b981"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={((10 - seconds) / 10) * c}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <span className="absolute font-mono font-black text-white text-sm">{seconds}s</span>
      </div>
      <div className="min-w-0 text-left">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
          <Sparkles className="w-3 h-3" />
          Pre-lock warning
        </div>
        <div className="text-base font-extrabold text-white font-display">{prayer}</div>
        <div className="text-xs text-slate-400 truncate">Pre-lock starting soon… Get ready for prayer.</div>
      </div>
    </div>
  );
};

/** Loops the toast's real ten-second countdown. */
export function useToastLoop() {
  const [s, setS] = useState(10);
  useEffect(() => {
    const id = window.setInterval(() => setS((v) => (v <= 1 ? 10 : v - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return s;
}
