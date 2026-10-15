import React from "react";
import { Bell, Compass, FileJson, MapPin, Monitor, SunMedium } from "lucide-react";

// Positions are percentages of a 1000 x 520 board; the SVG traces use the same units.
const INPUTS = [
  { x: 170, icon: MapPin, label: "Your coordinates" },
  { x: 500, icon: Compass, label: "Calculation method" },
  { x: 830, icon: SunMedium, label: "Asr school" },
];
const OUTPUTS = [
  { x: 170, icon: Bell, label: "Reminders" },
  { x: 500, icon: Monitor, label: "Overlay on every display" },
  { x: 830, icon: FileJson, label: "store.json on your disk" },
];
const CHIP = { x: 500, y: 260 };

const Node: React.FC<{ x: number; y: number; icon: React.ElementType; label: string }> = ({ x, y, icon: Icon, label }) => (
  <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2.5" style={{ left: `${x / 10}%`, top: `${(y / 520) * 100}%` }}>
    <div className="ak-tile h-14 w-14">
      <Icon className="w-5 h-5" strokeWidth={1.75} />
    </div>
    <span className="whitespace-nowrap rounded-md border border-slate-700/70 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-300">{label}</span>
  </div>
);

export const OfflineDiagram: React.FC = () => (
  <section className="relative pt-32 md:pt-44" aria-labelledby="offline-title">
    <div className="text-center px-6">
      <div data-reveal className="ak-eyebrow">Offline by design</div>
      <h2
        data-reveal
        style={{ ["--i" as string]: 1 }}
        id="offline-title"
        className="ak-title mt-5 font-display font-semibold tracking-[-0.03em] leading-[1.05] text-[clamp(2.25rem,4.6vw,3.5rem)]"
      >
        Your times. Your machine.
        <br className="hidden md:block" />
        Nothing in between.
      </h2>
      <p data-reveal style={{ ["--i" as string]: 2 }} className="mt-5 text-slate-400 max-w-xl mx-auto leading-relaxed">
        Prayer times are calculated on your computer with adhan-js. No server, no account, no analytics. Turn your Wi-Fi off and the
        next pause still arrives on time.
      </p>
    </div>

    {/* Desktop: a circuit board */}
    <div data-reveal style={{ ["--i" as string]: 3 }} className="hidden md:block relative max-w-5xl mx-auto px-6 mt-16">
      <div className="relative aspect-[1000/520]">
        <svg viewBox="0 0 1000 520" className="absolute inset-0 w-full h-full" aria-hidden="true">
          {INPUTS.map((n) => (
            <path key={n.label} className="ak-trace" d={`M${n.x} 92 V170 Q${n.x} 190 ${n.x + (CHIP.x - n.x) * 0.15} 190 H${CHIP.x + (n.x - CHIP.x) * 0.25} Q${CHIP.x + (n.x - CHIP.x) * 0.18} 190 ${CHIP.x + (n.x - CHIP.x) * 0.18} 205 V220`} />
          ))}
          {OUTPUTS.map((n) => (
            <path key={n.label} className="ak-trace" d={`M${CHIP.x + (n.x - CHIP.x) * 0.18} 300 V315 Q${CHIP.x + (n.x - CHIP.x) * 0.18} 330 ${CHIP.x + (n.x - CHIP.x) * 0.25} 330 H${n.x + (CHIP.x - n.x) * 0.15} Q${n.x} 330 ${n.x} 350 V420`} />
          ))}
          <path className="ak-trace ak-trace--live" d="M500 92 V220" />
          <path className="ak-trace ak-trace--live" d="M500 300 V420" />
        </svg>

        {INPUTS.map((n) => (
          <Node key={n.label} x={n.x} y={70} icon={n.icon} label={n.label} />
        ))}
        {OUTPUTS.map((n) => (
          <Node key={n.label} x={n.x} y={450} icon={n.icon} label={n.label} />
        ))}

        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "50%", top: `${(CHIP.y / 520) * 100}%` }}>
          <div className="relative rounded-2xl p-3 bg-gradient-to-b from-slate-800/80 to-slate-950 border border-slate-600/50 shadow-[0_0_0_6px_rgba(15,23,42,0.6),0_0_60px_-10px_rgba(16,185,129,0.45)]">
            <div className="absolute inset-x-6 -top-[7px] flex justify-between" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => <span key={i} className="h-[7px] w-[3px] rounded-sm bg-slate-500/60" />)}
            </div>
            <div className="absolute inset-x-6 -bottom-[7px] flex justify-between" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => <span key={i} className="h-[7px] w-[3px] rounded-sm bg-slate-500/60" />)}
            </div>
            <div className="rounded-xl border border-emerald-400/30 bg-[#070a11] px-6 py-4 flex items-center gap-3">
              <img src="/logo.png" alt="" width={40} height={40} className="h-10 w-10" />
              <div className="text-left">
                <div className="font-display font-bold text-white">Waqt</div>
                <div className="text-[11px] font-mono text-emerald-300/80">computed locally</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Phone: the same flow, stacked */}
    <div data-reveal style={{ ["--i" as string]: 3 }} className="md:hidden mt-12 px-6 space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        {INPUTS.map((n) => (
          <div key={n.label} className="flex flex-col items-center gap-2">
            <div className="ak-tile h-12 w-12"><n.icon className="w-4 h-4" /></div>
            <span className="text-[11px] text-slate-400 leading-tight">{n.label}</span>
          </div>
        ))}
      </div>
      <div className="mx-auto h-8 w-px bg-emerald-400/50" />
      <div className="mx-auto w-fit rounded-xl border border-emerald-400/30 bg-[#070a11] px-5 py-3 flex items-center gap-3 shadow-[0_0_50px_-10px_rgba(16,185,129,0.45)]">
        <img src="/logo.png" alt="" width={32} height={32} className="h-8 w-8" />
        <span className="font-display font-bold text-white">Waqt</span>
      </div>
      <div className="mx-auto h-8 w-px bg-emerald-400/50" />
      <div className="grid grid-cols-3 gap-2 text-center">
        {OUTPUTS.map((n) => (
          <div key={n.label} className="flex flex-col items-center gap-2">
            <div className="ak-tile h-12 w-12"><n.icon className="w-4 h-4" /></div>
            <span className="text-[11px] text-slate-400 leading-tight">{n.label}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);
