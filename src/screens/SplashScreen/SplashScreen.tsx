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
      {/* Background Radial Glow */}
      <div className="absolute w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse-glow pointer-events-none" />

      {/* Main Logo & Title Stack */}
      <div className="relative z-10 flex flex-col items-center space-y-6 max-w-sm px-6 text-center">
        {/* Glowing Logo Badge */}
        <div className="relative group">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-400 opacity-50 blur-xl group-hover:opacity-75 transition duration-500 animate-pulse-subtle" />
          <div className="relative w-28 h-28 rounded-3xl overflow-hidden glass-panel p-2 shadow-2xl ring-1 ring-white/10 flex items-center justify-center bg-slate-900/90">
            <img
              src="/logo.png"
              alt="Waqt Logo"
              className="w-full h-full object-contain rounded-2xl animate-float"
            />
          </div>
        </div>

        {/* Title & Tagline */}
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold font-display tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            Waqt
          </h1>
          <p className="text-xs uppercase tracking-widest font-semibold text-emerald-400/90">
            Personal Prayer Accountability
          </p>
        </div>

        {/* Progress Bar & Status */}
        <div className="w-full space-y-2 pt-4">
          <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-75 shadow-glow-emerald"
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

        {/* Footer Badge */}
        <div className="pt-8">
          <span className="text-[11px] font-mono text-slate-500 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800">
            v1.0.0 • Offline First
          </span>
        </div>
      </div>
    </div>
  );
};
