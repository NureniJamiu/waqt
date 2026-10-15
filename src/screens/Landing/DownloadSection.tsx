import React from "react";
import { Apple, Download, Github, Monitor } from "lucide-react";
import { DMG_URL, RELEASES_URL, REPO_URL } from "./landingData";

// Waqt is not yet signed with an Apple Developer ID, so macOS asks the user to
// approve it once. The steps below say so plainly rather than let it look broken.
const STEPS = [
  { title: "Open the download", text: "Drag Waqt into your Applications folder." },
  {
    title: "Approve it once",
    text: "macOS will say it can't verify the developer. Open System Settings → Privacy & Security and click Open Anyway.",
  },
  {
    title: "Allow Accessibility",
    text: "Waqt asks for this so it can move fullscreen apps out of the way before the pause. Nothing is recorded.",
  },
];

export const DownloadSection: React.FC = () => (
  <section id="download" className="relative pt-32 md:pt-44" aria-labelledby="download-title">
    <div className="ak-hr" />
    <div className="relative max-w-6xl mx-auto">
      <div className="ak-pool left-1/4 right-1/4 -top-10 h-80" aria-hidden="true" />
      <div className="relative mx-auto max-w-xl border-x border-[var(--ak-line)] py-14 md:py-16 text-center px-6">
        <h2 data-reveal id="download-title" className="ak-title font-display font-semibold tracking-[-0.03em] text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.05]">
          Start praying on time
        </h2>
        <p data-reveal style={{ ["--i" as string]: 1 }} className="mt-4 text-slate-400">
          Free and open source. No account, no subscription.
        </p>
      </div>
    </div>
    <div className="ak-hr" />

    <div className="max-w-4xl mx-auto px-4 md:px-6 mt-10 grid sm:grid-cols-[1.4fr_1fr] gap-3">
      <a
        data-reveal
        href={DMG_URL}
        className="group ak-glass ak-corners p-6 md:p-7 flex items-center gap-5 !border-emerald-500/40 hover:!border-emerald-400/70 transition-colors"
      >
        <span className="ak-tile shrink-0" data-on="true">
          <Apple className="w-6 h-6" strokeWidth={1.5} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display font-semibold text-lg text-white">Download for macOS</span>
          <span className="block text-sm text-slate-400 mt-0.5">Apple silicon &amp; Intel · macOS 10.15 or later</span>
        </span>
        <span className="grid place-items-center h-10 w-10 rounded-full bg-emerald-500 text-emerald-950 shrink-0 transition-transform group-hover:translate-y-0.5">
          <Download className="w-4 h-4" />
        </span>
      </a>

      <div data-reveal style={{ ["--i" as string]: 1 }} className="ak-glass ak-corners p-6 md:p-7 flex items-center gap-5 opacity-70" aria-disabled="true">
        <span className="ak-tile shrink-0 !text-slate-500">
          <Monitor className="w-6 h-6" strokeWidth={1.5} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display font-semibold text-lg text-slate-300">Windows</span>
          <span className="block text-sm text-slate-500 mt-0.5">Coming soon</span>
        </span>
      </div>
    </div>

    <ol className="max-w-4xl mx-auto px-4 md:px-6 mt-3 grid sm:grid-cols-3 gap-3" aria-label="Installing Waqt">
      {STEPS.map((s, i) => (
        <li key={s.title} data-reveal style={{ ["--i" as string]: i + 2 }} className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-6 w-6 rounded-full border border-slate-700 font-mono text-[11px] text-emerald-300">{i + 1}</span>
            <span className="text-sm font-medium text-white">{s.title}</span>
          </div>
          <p className="mt-2 text-[13px] text-slate-400 leading-relaxed">{s.text}</p>
        </li>
      ))}
    </ol>

    <p data-reveal className="mt-6 text-center text-xs text-slate-500 px-6">
      Every version, the release notes and the source are on{" "}
      <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-300 hover:text-white">
        <Github className="w-3.5 h-3.5" /> GitHub
      </a>
      . Prefer to build it yourself?{" "}
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white underline-offset-4 hover:underline">
        Read the README
      </a>
      .
    </p>
  </section>
);
