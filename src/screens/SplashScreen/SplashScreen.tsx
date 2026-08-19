import React, { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  durationMs = 1800,
}) => {
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        setFadingOut(true);
        setTimeout(() => {
          if (onFinish) onFinish();
        }, 300);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [durationMs, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070a11] text-white transition-opacity duration-300 ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(71,85,105,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(71,85,105,0.18)_1px,transparent_1px)] bg-[size:28px_28px] opacity-25" />

      <div className="relative z-10 flex flex-col items-center space-y-6 max-w-sm px-6 text-center">
        <div className="relative">
          <img
            src="/logo.png?v=3"
            alt="Waqt Logo"
            className="h-28 w-28 object-contain animate-float"
          />
        </div>

        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold font-display tracking-tight text-white">
            Waqt
          </h1>
          <p className="text-xs uppercase tracking-widest font-semibold text-emerald-300">
            Personal Prayer Accountability
          </p>
        </div>

        <div className="w-full space-y-2 pt-4">
          <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>
              {progress < 40
                ? "Loading settings..."
                : progress < 80
                ? "Calculating prayer times..."
                : "Ready"}
            </span>
            <span>{progress}%</span>
          </div>
        </div>

        <div className="pt-8">
          <span className="text-[11px] font-mono text-slate-500 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800">
            v1.0.0 • Offline First
          </span>
        </div>
      </div>
    </div>
  );
};
