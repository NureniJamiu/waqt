import React from "react";
import { Download, Play, Shield, Zap, Lock, Compass, ArrowRight } from "lucide-react";
import { AppPreview } from "./AppPreview";

export const HeroSection: React.FC = () => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-hidden pt-6 pb-20">
      {/* Background Video Layer with Dark Tint Overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/hero-poster.jpg"
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover opacity-25 scale-105 pointer-events-none will-change-transform filter blur-[1px]"
        >
          <source src="/video/mosque-ambient.webm" type="video/webm" />
          <source src="/video/mosque-ambient.mp4" type="video/mp4" />
        </video>

        {/* Ambient Gradients for Text Legibility & Visual Depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/80 to-slate-950" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />
      </div>

      {/* Hero Layout Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation Bar */}
        <header className="flex items-center justify-between py-4 mb-12 sm:mb-16 border-b border-slate-800/60 backdrop-blur-md bg-slate-950/40 rounded-2xl px-5">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Compass className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-heading">
              Waqt<span className="text-emerald-400">.</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
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
          </nav>

          <button
            onClick={() => scrollToSection("download")}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-500/20 hover:shadow-emerald-400/30 text-sm"
          >
            <Download className="h-4 w-4" />
            <span>Download Free</span>
          </button>
        </header>

        {/* Hero Copy & Headline */}
        <div className="text-center max-w-4xl mx-auto space-y-6 sm:space-y-8">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs font-medium text-emerald-300 shadow-sm backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Personal Desktop Accountability for Daily Salah</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white font-heading leading-[1.1]">
            Stop guessing prayer windows. <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
              Start praying on time.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Waqt is a privacy-first desktop app that introduces gentle forced-pause friction during prayer times—helping you step away from your screen the moment Salah arrives.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => scrollToSection("download")}
              className="w-full sm:w-auto flex items-center justify-center space-x-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-4 rounded-xl text-base transition-all shadow-xl shadow-emerald-500/25 hover:scale-[1.02]"
            >
              <span>Download for Free</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <button
              onClick={() => scrollToSection("how-it-works")}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-medium px-6 py-4 rounded-xl text-base border border-slate-700/80 backdrop-blur-md transition-all hover:border-slate-600"
            >
              <Play className="h-4 w-4 fill-slate-300 text-slate-300" />
              <span>See How It Works</span>
            </button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-medium text-slate-400">
            <div className="flex items-center space-x-1.5">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span>100% Offline & Client-Side</span>
            </div>
            <span className="hidden sm:inline text-slate-700">•</span>
            <div className="flex items-center space-x-1.5">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Emergency Dismiss Hatch</span>
            </div>
            <span className="hidden sm:inline text-slate-700">•</span>
            <div className="flex items-center space-x-1.5">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span>Zero Cloud & Local Privacy</span>
            </div>
          </div>
        </div>

        {/* Floating App Preview Mockup */}
        <div className="mt-14 sm:mt-20">
          <AppPreview />
        </div>
      </div>
    </div>
  );
};
