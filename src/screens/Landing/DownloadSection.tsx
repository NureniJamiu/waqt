import React from "react";
import { Apple, ArrowUpRight, Github, Monitor } from "lucide-react";
import { RELEASES_URL, REPO_URL } from "./landingData";

const PLATFORMS = [
  { name: "macOS", icon: Apple, req: "Apple silicon & Intel · macOS 11+" },
  { name: "Windows", icon: Monitor, req: "Windows 10 / 11 · 64-bit" },
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

    <div className="max-w-4xl mx-auto px-4 md:px-6 mt-10 grid sm:grid-cols-2 gap-3">
      {PLATFORMS.map((p, i) => (
        <a
          key={p.name}
          data-reveal
          style={{ ["--i" as string]: i }}
          href={RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group ak-glass ak-corners p-6 md:p-7 flex items-center gap-5 hover:border-emerald-400/40 transition-colors"
        >
          <span className="ak-tile shrink-0">
            <p.icon className="w-6 h-6" strokeWidth={1.5} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display font-semibold text-lg text-white">Download for {p.name}</span>
            <span className="block text-sm text-slate-400 mt-0.5">{p.req}</span>
          </span>
          <ArrowUpRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
        </a>
      ))}
    </div>
    <p data-reveal className="mt-6 text-center text-xs text-slate-500 px-6">
      Linux builds and the source are on{" "}
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-300 hover:text-white">
        <Github className="w-3.5 h-3.5" /> GitHub
      </a>
      . If a build isn't under Releases yet, it hasn't been published.
    </p>
  </section>
);
