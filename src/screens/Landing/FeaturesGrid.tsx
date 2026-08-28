import React from "react";
import { Timer, ShieldAlert, WifiOff, Monitor, Lock, Cpu } from "lucide-react";

export const FeaturesGrid: React.FC = () => {
  const features = [
    {
      icon: <Timer className="h-6 w-6 text-emerald-400" />,
      title: "Forced Pause Friction",
      description:
        "During prayer time (T-0), Waqt displays a full-screen pause. The 'I've Prayed' confirmation button remains disabled for your configured reflection time (default 7 mins) so you don't instantly skip it.",
    },
    {
      icon: <ShieldAlert className="h-6 w-6 text-emerald-400" />,
      title: "Guaranteed Emergency Hatch",
      description:
        "Real emergency or critical meeting call? The emergency hatch button is immediately clickable at all times. Clicking it requires a single confirmation and logs the event without trapping you.",
    },
    {
      icon: <WifiOff className="h-6 w-6 text-emerald-400" />,
      title: "100% Offline Calculation",
      description:
        "Prayer times are computed locally on your device using astronomical calculation formulas (adhan-js). No internet connection or external server requests required.",
    },
    {
      icon: <Monitor className="h-6 w-6 text-emerald-400" />,
      title: "Multi-Monitor Elevation",
      description:
        "Queries all connected displays and spawns fullscreen borderless overlays across every screen. No cheating or hiding behind secondary monitors.",
    },
    {
      icon: <Lock className="h-6 w-6 text-emerald-400" />,
      title: "Absolute Local Privacy",
      description:
        "All logs and settings live inside standard local JSON (~/Library/Application Support/waqt/store.json). Zero cloud sync, zero telemetry, zero user tracking.",
    },
    {
      icon: <Cpu className="h-6 w-6 text-emerald-400" />,
      title: "Native Tauri v2 Speed",
      description:
        "Built with Tauri v2 (Rust backend + Webview frontend). Uses under 30MB of RAM and virtually zero idle CPU, ensuring your laptop battery stays healthy.",
    },
  ];

  return (
    <section id="features" className="py-24 bg-slate-950 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">
            Core Features
          </h2>
          <h3 className="text-3xl sm:text-5xl font-extrabold text-white font-heading">
            Built for peace of mind. <br />
            <span className="text-slate-400 font-normal">Engineered for absolute reliability.</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((item, index) => (
            <div
              key={index}
              className="group p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-emerald-500/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/20 backdrop-blur-sm"
            >
              <div className="h-12 w-12 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mb-5 group-hover:bg-emerald-950/40 group-hover:border-emerald-500/40 transition-colors">
                {item.icon}
              </div>
              <h4 className="text-lg font-bold text-slate-100 mb-2">{item.title}</h4>
              <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
