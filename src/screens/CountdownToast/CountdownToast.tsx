import React, { useState, useEffect } from "react";
import { PrayerName, SoundOption } from "../../types";
import { Sparkles } from "lucide-react";
import { playSound } from "../../lib/sound";

interface CountdownToastProps {
  prayerName: PrayerName;
  onComplete: () => void;
  soundEnabled?: boolean;
  soundOption?: SoundOption;
}

export const CountdownToast: React.FC<CountdownToastProps> = ({
  prayerName,
  onComplete,
  soundEnabled = true,
  soundOption = "chime",
}) => {
  const [seconds, setSeconds] = useState<number>(10);

  useEffect(() => {
    playSound(soundOption, soundEnabled);
  }, [soundEnabled, soundOption]);

  useEffect(() => {
    if (seconds <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setSeconds((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds, onComplete]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-float">
      <div className="relative line-surface p-4 rounded-md border border-emerald-500/35 max-w-xs flex items-center gap-4 overflow-hidden">
        <div className="absolute top-0 left-0 h-[2px] w-full bg-emerald-400/80" />
        <div className="relative w-12 h-12 flex items-center justify-center">
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

        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-extrabold uppercase tracking-wider mb-0.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pre-Lock Warning</span>
          </div>
          <h4 className="font-black font-display text-white text-base">{prayerName}</h4>
          <p className="text-[11px] text-slate-400 font-medium">Pre-lock starting soon... Get ready for prayer.</p>
        </div>
      </div>
    </div>
  );
};
