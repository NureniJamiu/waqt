import React from "react";
import { AlertTriangle, Moon, Sun } from "lucide-react";

const Key: React.FC<{ children: React.ReactNode; dim?: boolean; wide?: boolean }> = ({ children, dim, wide }) => (
  <span
    className={`ak-tile !h-11 ${wide ? "!w-16" : "!w-11"} !rounded-lg font-mono text-sm ${dim ? "!text-slate-600" : ""}`}
    aria-hidden="true"
  >
    {children}
  </span>
);

const Card: React.FC<{ title: string; text: string; i: number; children: React.ReactNode; className?: string }> = ({ title, text, i, children, className = "" }) => (
  <li data-reveal style={{ ["--i" as string]: i }} className={`ak-glass ak-corners flex flex-col overflow-hidden ${className}`}>
    <div className="flex-1 grid place-items-center min-h-[190px] px-6 pt-8 pb-4">{children}</div>
    <div className="px-6 pb-6 text-center">
      <h3 className="text-[15px] text-white font-medium">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{text}</p>
    </div>
  </li>
);

export const HonorSystemManifesto: React.FC = () => (
  <section id="manifesto" className="relative pt-32 md:pt-44" aria-labelledby="trust-title">
    <div className="text-center px-6">
      <div data-reveal className="ak-eyebrow">The honor system</div>
      <h2
        data-reveal
        style={{ ["--i" as string]: 1 }}
        id="trust-title"
        className="ak-title mt-5 font-display font-semibold tracking-[-0.03em] leading-[1.05] text-[clamp(2.25rem,4.6vw,3.5rem)]"
      >
        Firm about the time.
        <br className="hidden md:block" />
        Honest about the rest.
      </h2>
      <p data-reveal style={{ ["--i" as string]: 2 }} className="mt-5 text-slate-400 max-w-lg mx-auto leading-relaxed">
        Waqt can't tell whether you prayed, and it never pretends to. It takes the screen away at the right moment, and the rest is
        between you and Allah.
      </p>
    </div>

    <ul className="mt-14 max-w-6xl mx-auto px-4 md:px-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Card i={0} title="Nothing is watched" text="No camera, no keylogging, no screenshots. Your keystrokes never leave the keyboard.">
        <div className="flex gap-2">
          {["W", "A", "Q", "T"].map((k) => <Key key={k} dim>{k}</Key>)}
        </div>
      </Card>

      <Card i={1} title="One honest way out" text="Emergency Dismiss works any time, once per prayer: thirty minutes of grace, logged.">
        <div className="flex flex-col items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-bold text-amber-300 bg-amber-500/10 px-4 py-2.5 rounded-lg border border-amber-500/40">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Emergency Dismiss
          </span>
          <span className="font-mono text-xs text-slate-500">1 of 1 per prayer</span>
        </div>
      </Card>

      <Card i={2} title="Force Quit always works" text="If the pause returns after the grace period, your system's Force Quit still closes Waqt.">
        <div className="flex gap-2 items-center">
          <Key>⌘</Key>
          <Key>⌥</Key>
          <Key wide>esc</Key>
        </div>
      </Card>

      <Card i={0} title="Every display, every Space" text="One overlay per monitor, above fullscreen apps. A screen plugged in mid-pause is covered in seconds.">
        <div className="flex items-end gap-3" aria-hidden="true">
          {[0.8, 1, 0.8].map((s, n) => (
            <div key={n} className="flex flex-col items-center" style={{ transform: `scale(${s})` }}>
              <div className="w-24 h-16 rounded-md border border-slate-600/70 bg-[#05080e] grid place-items-center">
                <svg width="26" height="26" viewBox="0 0 26 26" className="-rotate-90">
                  <circle cx="13" cy="13" r="10" stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="none" />
                  <circle cx="13" cy="13" r="10" stroke="#10b981" strokeWidth="3" fill="none" strokeDasharray="62.8" strokeDashoffset="40" strokeLinecap="round" />
                </svg>
              </div>
              <div className="w-6 h-2 bg-slate-700/70" />
              <div className="w-12 h-1 rounded bg-slate-700/70" />
            </div>
          ))}
        </div>
      </Card>

      <Card i={1} title="A log you can read" text="Every prayer is one line in a JSON file on your disk. No account, no sync.">
        <pre className="w-full max-w-[290px] rounded-lg border border-slate-800 bg-[#05080e] px-4 py-3 text-left text-[12px] leading-relaxed font-mono text-slate-400 overflow-hidden">
{`{
  "prayer": "Dhuhr",
  "status": `}<span className="text-emerald-300">"confirmed"</span>{`,
  "confirmedAt": "12:41"
}`}
        </pre>
      </Card>

      <Card i={2} title="Survives sleep" text="Wake with the prayer still open and the pause begins. If it has passed, it's logged as missed, never a surprise.">
        <div className="flex items-center gap-4" aria-hidden="true">
          <span className="ak-tile"><Moon className="w-5 h-5" /></span>
          <span className="h-px w-16 bg-gradient-to-r from-slate-600 to-emerald-400/70" />
          <span className="ak-tile" data-on="true"><Sun className="w-5 h-5" /></span>
        </div>
      </Card>
    </ul>
  </section>
);
