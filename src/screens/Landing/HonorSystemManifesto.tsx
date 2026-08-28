import React from "react";
import { ShieldCheck, Heart, EyeOff, Lock } from "lucide-react";

export const HonorSystemManifesto: React.FC = () => {
  return (
    <section id="manifesto" className="py-20 bg-slate-950 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-emerald-950/30 border border-slate-800 p-8 sm:p-12 relative overflow-hidden shadow-2xl shadow-emerald-950/20">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Honor System Manifesto</span>
            </div>

            <h3 className="text-3xl sm:text-4xl font-extrabold text-white font-heading">
              Built on Sincerity, <br className="hidden sm:inline" />
              <span className="text-emerald-400">Never on Surveillance.</span>
            </h3>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Waqt is a tool for personal accountability, not enforcement. The app cannot verify whether you actually prayed—and it strictly promises never to pretend it can.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-slate-200 font-bold text-sm">
                  <EyeOff className="h-4 w-4 text-emerald-400" />
                  <span>No Cameras & Cameras</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No webcams, no pose detection, no keylogging, and no background tracking of any kind.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-slate-200 font-bold text-sm">
                  <Lock className="h-4 w-4 text-emerald-400" />
                  <span>No OS Hijacking</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No kernel-level lock screens. You remain in complete control of your operating system.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-slate-200 font-bold text-sm">
                  <Heart className="h-4 w-4 text-emerald-400" />
                  <span>Always Safe Hatch</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The emergency dismiss hatch is clickable at all times—ensuring Waqt never traps you during a real emergency.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
