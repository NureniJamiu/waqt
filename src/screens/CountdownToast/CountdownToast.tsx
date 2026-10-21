import React, { useState, useEffect, useRef } from "react";
import { PrayerName } from "../../types";
import { Sparkles } from "lucide-react";
import { playSound } from "../../lib/sound";

interface CountdownToastProps {
  prayerName: PrayerName;
  onComplete: () => void;
  soundEnabled?: boolean;
  isToastWindow?: boolean;
}

export const CountdownToast: React.FC<CountdownToastProps> = ({
  prayerName,
  onComplete,
  soundEnabled = true,
  isToastWindow = false,
}) => {
  const [seconds, setSeconds] = useState<number>(10);
  // `onComplete` is a fresh closure on every parent render, so without this
  // the effect re-ran it — and re-triggered the overlay — on each re-render
  // after the countdown hit zero.
  const completedRef = useRef(false);

  useEffect(() => {
    playSound("chime", soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (seconds <= 0) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      return;
    }
    const timer = setTimeout(() => setSeconds((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds, onComplete]);

  const containerClasses = isToastWindow
    ? "w-full h-full flex items-center justify-center p-1.5 select-none"
    : "fixed bottom-6 right-6 z-50 animate-float";

  return (
    <div className={containerClasses}>
      <div className="relative bg-[#0c1017]/95 backdrop-blur-xl shadow-2xl p-4 rounded-xl border border-emerald-500/40 w-full h-full flex items-center gap-4 overflow-hidden">
        <div className="absolute top-0 left-0 h-[2px] w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
        <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
          <svg className="w-12 h-12 -rotate-90 transform">
            <circle cx="24" cy="24" r="18" stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="transparent" />
            <circle
              cx="24"
              cy="24"
              r="18"
              stroke="#10b981"
              strokeWidth="3"
              strokeDasharray={2 * Math.PI * 18}
              strokeDashoffset={((10 - seconds) / 10) * 2 * Math.PI * 18}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <span className="absolute font-mono font-black text-white text-base">{seconds}s</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-extrabold uppercase tracking-wider mb-0.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate">Pre-Lock Warning</span>
          </div>
          <h4 className="font-black font-display text-white text-base truncate">{prayerName}</h4>
          <p className="text-[11px] text-slate-400 font-medium truncate">Pre-lock starting soon... Get ready for prayer.</p>
        </div>
      </div>
    </div>
  );
};
