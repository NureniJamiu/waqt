import React from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export const ProblemSolution: React.FC = () => {
  return (
    <section className="py-20 bg-slate-950/80 border-t border-b border-slate-800/60 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">
            Why Waqt Was Built
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white font-heading">
            Work flows don't respect prayer times. <br />
            <span className="text-slate-400 font-normal">Waqt puts intention back on your desktop.</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Problem Card */}
          <div className="rounded-2xl bg-slate-900/60 border border-rose-500/20 p-8 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <AlertTriangle className="h-32 w-32 text-rose-500" />
            </div>

            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-medium mb-6">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>The Tab Trap & Distraction</span>
              </div>

              <h4 className="text-2xl font-bold text-slate-100 mb-4">
                Pushing Salah to the final 5 minutes
              </h4>

              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                When you're locked into deep work or back-to-back meetings, desktop OS notifications are easy to click away or swipe ignore. Next thing you know, Dhuhr is about to expire, and you rush through prayer without focus or khushu.
              </p>

              <ul className="space-y-3 text-xs text-slate-400">
                <li className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  <span>Ignoring simple banners while working</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  <span>Rushing prayer right before window expiration</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  <span>Feeling disconnected and unorganized</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Solution Card */}
          <div className="rounded-2xl bg-gradient-to-b from-slate-900/90 to-emerald-950/20 border border-emerald-500/30 p-8 relative overflow-hidden flex flex-col justify-between shadow-xl shadow-emerald-950/10">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <CheckCircle2 className="h-32 w-32 text-emerald-400" />
            </div>

            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-medium mb-6">
                <Clock className="h-3.5 w-3.5" />
                <span>Intentional Forced Pause</span>
              </div>

              <h4 className="text-2xl font-bold text-emerald-100 mb-4">
                Gentle friction that helps you step away
              </h4>

              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                Waqt introduces a non-intrusive full-screen reflection pause across your monitors at exact prayer time. The pause timer forces a mandatory 7-minute breather—long enough to stand up, make wudhu, and pray peacefully.
              </p>

              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Full-screen pause screen across multi-monitors</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Configurable reflection timer (1–20 mins)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Always-available single-click emergency dismiss</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
