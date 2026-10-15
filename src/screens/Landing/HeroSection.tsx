import React, { useState } from "react";
import { Download, Github, Lock, ShieldAlert } from "lucide-react";
import { OverlayCard, Toast, usePause, useToastLoop } from "./Fragments";
import { City, clock, cityDay, nextPrayer, REPO_URL, useNow } from "./landingData";

export const HeroSection: React.FC<{ city: City }> = ({ city }) => {
  const [relock, setRelock] = useState(false);
  const { remaining } = usePause(900);
  const toast = useToastLoop();
  const now = useNow(30_000);
  const next = nextPrayer(city, now);
  const { prayers } = cityDay(city, 0, now);

  return (
    <header className="relative">
      <div className="ak-beam" aria-hidden="true" />

      <nav className="relative z-10 max-w-6xl mx-auto px-6 h-20 grid grid-cols-2 md:grid-cols-3 items-center" aria-label="Main">
        <a href="#top" className="flex items-center gap-2 font-display font-bold text-white tracking-tight text-[17px] justify-self-start">
          <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 md:hidden" />
          Waqt
        </a>
        <img src="/logo.png" alt="" width={34} height={34} className="hidden md:block h-[34px] w-[34px] justify-self-center opacity-90" />
        <div className="flex items-center gap-2 justify-self-end">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Waqt on GitHub"
            className="grid place-items-center h-9 w-9 rounded-full border border-slate-700/70 bg-slate-900/50 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>
          <a
            href="#download"
            className="inline-flex h-9 items-center rounded-full border border-slate-700/70 bg-slate-900/60 px-4 text-sm text-slate-100 hover:border-emerald-400/40 hover:bg-emerald-500/10 transition-colors"
          >
            Download
          </a>
        </div>
      </nav>
      <div className="ak-hr" />

      <div id="top" className="relative z-10 text-center pt-16 md:pt-24 px-6">
        <div className="ak-eyebrow ak-fade" style={{ ["--d" as string]: "100ms" }}>Introducing</div>
        <h1
          className="ak-title ak-rise mt-5 font-display font-semibold tracking-[-0.045em] leading-[0.95] text-[clamp(5rem,16vw,11rem)]"
          style={{ ["--d" as string]: "150ms" }}
        >
          Waqt
        </h1>
        <p className="ak-rise mt-6 text-[clamp(1.125rem,2vw,1.5rem)] leading-snug text-slate-300" style={{ ["--d" as string]: "300ms" }}>
          The prayer pause for your desktop,
          <br />
          offline and on the honor system.
        </p>
      </div>

      {/* Three stacked product cards, the overlay in front */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 mt-16 md:mt-20 h-[600px] md:h-[640px]">
        <div
          className="ak-rise ak-glass ak-corners hidden md:block absolute left-6 lg:left-10 top-14 w-[330px] opacity-80 -rotate-[0.001deg]"
          style={{ ["--d" as string]: "550ms" }}
          aria-hidden="true"
        >
          <div className="px-6 pt-6 pb-5 text-left">
            <div className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Upcoming Prayer</div>
            <div className="text-4xl font-black font-display tracking-tight text-white mt-2">{next.name}</div>
            <p className="text-sm text-slate-300 mt-2">
              Adhan Time: <strong className="text-emerald-300 font-mono">{clock(next.time, city.tz)}</strong>
            </p>
            <p className="text-xs text-slate-400">
              Locks laptop at <strong className="text-amber-300 font-mono">{clock(next.lock, city.tz)}</strong>
            </p>
          </div>
          <ul className="border-t border-slate-800/80 px-6 py-4 space-y-2.5 text-sm">
            {prayers.map((p) => (
              <li key={p.name} className="flex justify-between">
                <span className={p.name === next.name ? "text-emerald-300 font-semibold" : "text-slate-400"}>{p.name}</span>
                <span className="font-mono text-slate-200">{clock(p.time, city.tz)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="ak-rise ak-glass ak-corners hidden md:block absolute right-6 lg:right-10 top-14 w-[340px] opacity-80"
          style={{ ["--d" as string]: "650ms" }}
          aria-hidden="true"
        >
          <Toast prayer={next.name} seconds={toast} className="rounded-t-2xl" />
          <div className="border-t border-slate-800/80 px-6 py-5 text-left space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-extrabold font-display text-sm">
              <ShieldAlert className="w-4 h-4" /> Emergency Dismiss (30m)
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Once per prayer. Unlocks for up to 30 minutes and logs an emergency_dismissed entry.
            </p>
            <div className="flex gap-2">
              <span className="flex-1 py-2 text-center bg-slate-800 text-slate-200 font-bold rounded-md text-[11px] border border-slate-700">Keep Paused</span>
              <span className="flex-1 py-2 text-center bg-amber-500/15 border border-amber-500/40 text-amber-200 font-black rounded-md text-[11px]">Grant 30m</span>
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[min(400px,calc(100%-3rem))] z-10">
          <div className="ak-rise ak-glass ak-corners !bg-[#0a0f1a]/95 shadow-[0_50px_120px_-30px_rgba(16,185,129,0.25)]" style={{ ["--d" as string]: "450ms" }}>
            <OverlayCard prayer={next.name} remaining={remaining} relock={relock} />
          </div>
        </div>
      </div>

      <div className="relative z-10 ak-hr -mt-6" />
      <div className="relative z-10 flex flex-col items-center gap-3 pt-10 pb-4 px-6">
        <div role="radiogroup" aria-label="Overlay state" className="inline-flex rounded-full border border-slate-700/70 bg-slate-900/70 p-1">
          {[
            { on: !relock, label: "First pause", icon: Lock, set: false },
            { on: relock, label: "Re-lock", icon: ShieldAlert, set: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={o.on}
              onClick={() => setRelock(o.set)}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-colors ${
                o.on ? "bg-slate-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <o.icon className={`w-3.5 h-3.5 ${o.on ? (o.set ? "text-amber-400" : "text-emerald-400") : ""}`} />
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-400 text-center">
          {relock ? "After the emergency grace ends, the pause comes back without an escape hatch." : "The real overlay, counting down a real fifteen minutes."}
        </p>
        <a
          href="#download"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-emerald-500 px-6 text-[15px] font-semibold text-emerald-950 hover:bg-emerald-400 transition-colors active:scale-[0.98]"
        >
          <Download className="w-4 h-4" /> Download for free
        </a>
      </div>
    </header>
  );
};
