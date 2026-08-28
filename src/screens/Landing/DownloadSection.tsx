import React from "react";
import { Download, Apple, Monitor, Terminal, Check, Github } from "lucide-react";

export const DownloadSection: React.FC = () => {
  const handleDownload = (osName: string) => {
    alert(`Starting download placeholder for Waqt v1.0.0 (${osName}). Releases will be linked to GitHub Releases.`);
  };

  return (
    <section id="download" className="py-24 bg-slate-950 border-t border-slate-800/60 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">
            Download Waqt
          </h2>
          <h3 className="text-3xl sm:text-5xl font-extrabold text-white font-heading mb-4">
            Available on all major desktop platforms
          </h3>
          <p className="text-slate-400 text-base">
            Free & Open Source forever. No subscriptions, no ads, no cloud accounts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* macOS Card */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-emerald-500/40 transition-all text-center">
            <div>
              <div className="h-14 w-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 mx-auto flex items-center justify-center mb-6 text-slate-100">
                <Apple className="h-7 w-7" />
              </div>
              <h4 className="text-2xl font-bold text-slate-100 mb-2">macOS</h4>
              <p className="text-xs text-slate-400 mb-6">Apple Silicon (M1/M2/M3/M4) & Intel Macs (macOS 11+)</p>

              <div className="space-y-2 text-xs text-slate-300 mb-8 text-left bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Native Apple Silicon Binary</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Multi-monitor overlay support</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDownload("macOS")}
              className="w-full flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm"
            >
              <Download className="h-4 w-4" />
              <span>Download for macOS</span>
            </button>
          </div>

          {/* Windows Card */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-emerald-500/40 transition-all text-center">
            <div>
              <div className="h-14 w-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 mx-auto flex items-center justify-center mb-6 text-slate-100">
                <Monitor className="h-7 w-7" />
              </div>
              <h4 className="text-2xl font-bold text-slate-100 mb-2">Windows</h4>
              <p className="text-xs text-slate-400 mb-6">Windows 10 / 11 (64-bit Edition)</p>

              <div className="space-y-2 text-xs text-slate-300 mb-8 text-left bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Single MSI / EXE Installer</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Autostart on startup option</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDownload("Windows")}
              className="w-full flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm"
            >
              <Download className="h-4 w-4" />
              <span>Download for Windows</span>
            </button>
          </div>

          {/* Linux Card */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-emerald-500/40 transition-all text-center">
            <div>
              <div className="h-14 w-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 mx-auto flex items-center justify-center mb-6 text-slate-100">
                <Terminal className="h-7 w-7" />
              </div>
              <h4 className="text-2xl font-bold text-slate-100 mb-2">Linux</h4>
              <p className="text-xs text-slate-400 mb-6">AppImage, DEB, and RPM packages</p>

              <div className="space-y-2 text-xs text-slate-300 mb-8 text-left bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Portable AppImage binary</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>X11 & Wayland compatible</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDownload("Linux")}
              className="w-full flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm"
            >
              <Download className="h-4 w-4" />
              <span>Download for Linux</span>
            </button>
          </div>
        </div>

        <div className="mt-12 text-center">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Github className="h-4 w-4" />
            <span>View Source Code & Verify Releases on GitHub</span>
          </a>
        </div>
      </div>
    </section>
  );
};
