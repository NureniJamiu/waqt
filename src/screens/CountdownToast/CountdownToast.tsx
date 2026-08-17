import React, { useState, useEffect } from "react";
import { PrayerName } from "../../types";
import { Bell, Clock } from "lucide-react";

interface CountdownToastProps {
  prayerName: PrayerName;
  onComplete: () => void;
  soundEnabled?: boolean;
}

export const CountdownToast: React.FC<CountdownToastProps> = ({
  prayerName,
  onComplete,
}) => {
  const [seconds, setSeconds] = useState<number>(10);

  useEffect(() => {
    if (seconds <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setSeconds((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds, onComplete]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-subtle">
      <div className="glass-panel p-4 rounded-2xl shadow-2xl border border-emerald-500/40 bg-slate-950/90 max-w-xs flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex flex-col items-center justify-center font-mono font-bold text-lg">
          {seconds}s
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-0.5">
            <Bell className="w-3.5 h-3.5" />
            <span>Time for Prayer</span>
          </div>
          <h4 className="font-bold text-slate-100 text-sm">{prayerName}</h4>
          <p className="text-[11px] text-slate-400">Lock overlay starting soon...</p>
        </div>
      </div>
    </div>
  );
};
