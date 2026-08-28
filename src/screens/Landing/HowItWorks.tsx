import React from "react";
import { Sliders, Bell, AlertCircle, HeartHandshake } from "lucide-react";

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: "01",
      icon: <Sliders className="h-6 w-6 text-emerald-400" />,
      title: "Set Location & Method",
      description:
        "Select your city, astronomical calculation method (Muslim World League, ISNA, Makkah, etc.), and preferred forced pause duration (1–20 mins).",
    },
    {
      step: "02",
      icon: <Bell className="h-6 w-6 text-emerald-400" />,
      title: "Pre-Notifications (T-30m)",
      description:
        "Receive non-disruptive native notifications at T-30m, T-15m, and T-5m before prayer time, giving you ample time to wrap up ongoing calls and code.",
    },
    {
      step: "03",
      icon: <AlertCircle className="h-6 w-6 text-emerald-400" />,
      title: "10s Toast & Fullscreen Pause",
      description:
        "At exact prayer time (T-0), a 10-second corner toast countdown appears, followed by a multi-monitor forced-pause screen that locks in reflection time.",
    },
    {
      step: "04",
      icon: <HeartHandshake className="h-6 w-6 text-emerald-400" />,
      title: "Pray & Confirm Sincerity",
      description:
        "Step away, make wudhu, and pray with total focus. When your forced reflection timer hits 00:00, click 'I've Prayed' to log your habit and return to work.",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-slate-950/90 border-t border-slate-800/60 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">
            Simple Workflow
          </h2>
          <h3 className="text-3xl sm:text-5xl font-extrabold text-white font-heading">
            How Waqt works in practice
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {steps.map((item, idx) => (
            <div key={idx} className="relative flex flex-col justify-between p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="h-12 w-12 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="font-mono text-3xl font-black text-slate-800">{item.step}</span>
                </div>
                <h4 className="text-xl font-bold text-slate-100 mb-3">{item.title}</h4>
                <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
