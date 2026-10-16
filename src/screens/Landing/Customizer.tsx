import React, { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { calculateDailyPrayerTimes } from "../../lib/adhanCalc";
import { AppSettings, AsrSchool, CalculationMethodName } from "../../types";
import { City, CITIES, clock, useNow } from "./landingData";

const METHODS: { id: CalculationMethodName; label: string }[] = [
  { id: "MuslimWorldLeague", label: "Muslim World League" },
  { id: "NorthAmerica", label: "ISNA (North America)" },
  { id: "UmmAlQura", label: "Umm al-Qura" },
  { id: "Egyptian", label: "Egyptian" },
  { id: "Karachi", label: "Karachi" },
  { id: "Dubai", label: "Dubai" },
  { id: "Kuwait", label: "Kuwait" },
  { id: "Qatar", label: "Qatar" },
  { id: "Singapore", label: "Singapore" },
  { id: "Turkey", label: "Turkey (Diyanet)" },
  { id: "Tehran", label: "Tehran" },
  { id: "MoonsightingCommittee", label: "Moonsighting Committee" },
];

const Float: React.FC<{ label: string; children: React.ReactNode; i?: number }> = ({ label, children, i = 0 }) => (
  <div data-reveal style={{ ["--i" as string]: i }} className="ak-glass ak-corners ak-float">
    <div className="text-xs text-slate-400 mb-2.5">{label}</div>
    {children}
  </div>
);

const Range: React.FC<{ value: number; min: number; max: number; unit: string; onChange: (v: number) => void; label: string }> = ({
  value,
  min,
  max,
  unit,
  onChange,
  label,
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-3">
      <div className="font-mono text-lg text-white">
        {value}
        <span className="text-slate-500 text-sm"> {unit}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-slider"
        style={{ background: `linear-gradient(to right, #10b981 ${pct}%, rgba(30,41,59,0.9) ${pct}%)` }}
      />
    </div>
  );
};

export const Customizer: React.FC<{ city: City; onCity: (c: City) => void }> = ({ city, onCity }) => {
  const [method, setMethod] = useState<CalculationMethodName>(city.method);
  const [school, setSchool] = useState<AsrSchool>("Standard");
  const [lead, setLead] = useState(10);
  const [pause, setPause] = useState(15);
  const now = useNow(1000);
  const minute = Math.floor(now.getTime() / 60_000);

  const pickCity = (c: City) => {
    onCity(c);
    setMethod(c.method);
  };

  const prayers = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: city.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-");
    const day = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
    const settings = { latitude: city.lat, longitude: city.lng, calculationMethod: method, asrSchool: school, preLockMinutes: lead } as AppSettings;
    return calculateDailyPrayerTimes(settings, day, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, method, school, lead, minute]);

  const next = prayers.find((p) => p.lockTime > now) ?? prayers[prayers.length - 1];
  const opens = new Date(next.lockTime.getTime() + pause * 60_000);

  return (
    <section id="times" className="relative pt-32 md:pt-44" aria-labelledby="custom-title">
      <div className="text-center px-6">
        <div data-reveal className="ak-eyebrow">Make it yours</div>
        <h2
          data-reveal
          style={{ ["--i" as string]: 1 }}
          id="custom-title"
          className="ak-title mt-5 font-display font-semibold tracking-[-0.03em] leading-[1.05] text-[clamp(2.25rem,4.6vw,3.5rem)]"
        >
          Your city. Your pace.
        </h2>
        <p data-reveal style={{ ["--i" as string]: 2 }} className="mt-5 text-slate-400 max-w-lg mx-auto leading-relaxed">
          The same settings as the app, running the same calculation. Lock earlier if you walk to the masjid, shorten the pause if you
          pray quickly.
        </p>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 md:px-6 mt-14">
        <div className="ak-pool left-1/4 right-1/4 top-10 bottom-10" aria-hidden="true" />
        <div data-reveal style={{ ["--i" as string]: 3 }} className="relative ak-glass ak-corners p-2 md:p-3">
          <div className="flex items-center gap-1.5 px-2 pb-2 md:pb-3" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#070a11]/80 p-4 md:p-10 grid lg:grid-cols-[250px_1fr_250px] gap-4 lg:gap-8 items-center">
            <div className="space-y-4 order-2 lg:order-1">
              <Float label="City" i={1}>
                <select className="select-control" value={city.name} onChange={(e) => pickCity(CITIES.find((c) => c.name === e.target.value) ?? CITIES[0])}>
                  {CITIES.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </Float>
              <Float label="Calculation method" i={2}>
                <select className="select-control" value={method} onChange={(e) => setMethod(e.target.value as CalculationMethodName)}>
                  {METHODS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </Float>
              <Float label="Asr school" i={3}>
                <div className="grid grid-cols-2 rounded-lg bg-slate-900/80 border border-slate-800 p-1">
                  {(["Standard", "Hanafi"] as AsrSchool[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={school === s}
                      onClick={() => setSchool(s)}
                      className={`rounded-md py-1.5 text-sm transition-colors ${school === s ? "bg-slate-700/80 text-white" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Float>
            </div>

            {/* The dashboard, live */}
            <div className="order-1 lg:order-2 line-surface rounded-2xl overflow-hidden">
              <div className="px-5 md:px-6 pt-6 pb-5 border-b border-slate-800/80">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-widest text-slate-400 font-bold whitespace-nowrap">Upcoming Prayer</div>
                    <div className="text-4xl md:text-5xl font-black font-display tracking-tight text-white mt-2">{next.name}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 pt-1 shrink-0">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    {city.name.split(",")[0]}
                  </span>
                </div>
                {/* Phones: three rows. Wider: three tiles. */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    ["Screen locks", clock(next.lockTime, city.tz), "text-amber-300"],
                    ["Adhan", clock(next.time, city.tz), "text-white"],
                    ["Button opens", clock(opens, city.tz), "text-emerald-300"],
                  ].map(([k, v, c]) => (
                    <div
                      key={k}
                      className="min-w-0 rounded-lg border border-slate-800 bg-surface/50 px-4 py-2.5 sm:px-2 sm:py-3 flex items-center justify-between sm:flex-col sm:justify-center sm:text-center"
                    >
                      <div className="text-[10px] lg:text-[9px] xl:text-[10px] uppercase tracking-wider lg:tracking-normal xl:tracking-wider font-bold text-slate-500 whitespace-nowrap">{k}</div>
                      <div className={`sm:mt-1 font-mono text-lg sm:text-xl lg:text-lg xl:text-2xl font-bold tabular-nums whitespace-nowrap ${c}`}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Phones: a list. Wider: a five-column strip. */}
              <ul className="px-3 sm:px-5 md:px-6 py-3 sm:py-4 grid grid-cols-1 sm:grid-cols-5 gap-1">
                {prayers.map((p) => (
                  <li
                    key={p.name}
                    className={`min-w-0 rounded-lg border px-3 py-2 sm:px-1 flex items-center justify-between sm:flex-col sm:justify-center sm:text-center ${
                      p.name === next.name ? "bg-emerald-500/[0.08] border-emerald-500/30" : "border-transparent"
                    }`}
                  >
                    <div className={`text-xs sm:text-[11px] font-semibold truncate ${p.name === next.name ? "text-emerald-300" : "text-slate-400"}`}>{p.name}</div>
                    <div className="font-mono text-sm text-white sm:mt-0.5 tabular-nums">{clock(p.time, city.tz)}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4 order-3">
              <Float label="Lock before adhan" i={4}>
                <Range label="Lock before adhan" value={lead} min={0} max={30} unit="min" onChange={setLead} />
              </Float>
              <Float label="Forced pause" i={5}>
                <Range label="Forced pause" value={pause} min={1} max={20} unit="min" onChange={setPause} />
              </Float>
              <p className="text-xs text-slate-500 leading-relaxed px-1">Defaults: ten minutes early, fifteen minutes of pause. Calculated in your browser, as in the app.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
