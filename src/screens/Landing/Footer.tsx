import React from "react";
import { Compass, Github, Heart } from "lucide-react";

export const Footer: React.FC = () => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="bg-slate-950 border-t border-slate-800/80 py-12 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800/60">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 p-0.5">
              <div className="h-full w-full bg-slate-950 rounded-[6px] flex items-center justify-center">
                <Compass className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <span className="text-lg font-bold tracking-tight text-white font-heading">
              Waqt<span className="text-emerald-400">.</span>
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">|</span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Intentional Salah Accountability for Desktop
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-300">
            <button onClick={() => scrollToSection("features")} className="hover:text-emerald-400 transition-colors">
              Features
            </button>
            <button onClick={() => scrollToSection("how-it-works")} className="hover:text-emerald-400 transition-colors">
              How It Works
            </button>
            <button onClick={() => scrollToSection("manifesto")} className="hover:text-emerald-400 transition-colors">
              Manifesto
            </button>
            <button onClick={() => scrollToSection("faq")} className="hover:text-emerald-400 transition-colors">
              FAQ
            </button>
            <button onClick={() => scrollToSection("download")} className="hover:text-emerald-400 transition-colors">
              Download
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Waqt. Open Source & Privacy-First.</p>
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <span>Made with</span>
              <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
              <span>for Ummah</span>
            </span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
