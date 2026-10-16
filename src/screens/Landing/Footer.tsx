import React from "react";
import { Github } from "lucide-react";
import { REPO_URL } from "./landingData";

export const Footer: React.FC = () => (
  <footer className="relative mt-32 md:mt-44">
    <div className="ak-hr" />
    <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-slate-500">
      <div className="flex items-center gap-2.5">
        <img src="/logo.png" alt="" width={24} height={24} className="h-6 w-6" />
        <span className="font-display font-semibold text-slate-200">Waqt</span>
        <span className="hidden sm:inline">· Personal prayer accountability</span>
      </div>
      <nav aria-label="Footer" className="flex items-center gap-6">
        <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
        <a href="#manifesto" className="hover:text-white transition-colors">Honor system</a>
        <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="hover:text-white transition-colors">
          <Github className="w-4 h-4" />
        </a>
      </nav>
      <span className="font-mono text-xs">© 2026 · MIT licence</span>
    </div>
  </footer>
);
