import React, { useState } from "react";
import { AppSettings, CalculationMethodName, AsrSchool } from "../../types";
import { ArrowLeft, Save, MapPin, Sliders, Bell, Volume2, Moon, Power } from "lucide-react";

interface SettingsProps {
  settings: AppSettings;
  onSave: (updated: AppSettings) => void;
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onSave, onBack }) => {
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [savedToast, setSavedToast] = useState(false);

  const handleFormChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center glass-panel px-6 py-4 rounded-2xl">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="font-bold text-lg">Settings</h1>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-emerald-500/20"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </header>

      {savedToast && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs font-medium text-center">
          ✓ Settings saved successfully
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Location */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <MapPin className="w-4 h-4" />
            <span>Location Settings</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">City Name</label>
              <input
                type="text"
                value={form.cityName}
                onChange={(e) => handleFormChange("cityName", e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => handleFormChange("latitude", parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => handleFormChange("longitude", parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Calculation Method */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <Sliders className="w-4 h-4" />
            <span>Calculation Authority & Jurisprudence</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Calculation Method</label>
              <select
                value={form.calculationMethod}
                onChange={(e) => handleFormChange("calculationMethod", e.target.value as CalculationMethodName)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
              >
                <option value="MuslimWorldLeague">Muslim World League (Default)</option>
                <option value="Egyptian">Egyptian General Authority</option>
                <option value="Karachi">University of Islamic Sciences, Karachi</option>
                <option value="UmmAlQura">Umm Al-Qura University, Makkah</option>
                <option value="Dubai">Dubai</option>
                <option value="MoonsightingCommittee">Moonsighting Committee</option>
                <option value="NorthAmerica">ISNA (North America)</option>
                <option value="Kuwait">Kuwait</option>
                <option value="Qatar">Qatar</option>
                <option value="Singapore">Singapore (MUIS)</option>
                <option value="Turkey">Diyanet İşleri Başkanlığı (Turkey)</option>
                <option value="Tehran">Institute of Geophysics, Tehran</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Asr School</label>
              <select
                value={form.asrSchool}
                onChange={(e) => handleFormChange("asrSchool", e.target.value as AsrSchool)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
              >
                <option value="Standard">Standard (Shafi, Maliki, Hanbali)</option>
                <option value="Hanafi">Hanafi</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Overlay Pause Duration */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Moon className="w-4 h-4" />
              <span>Forced Pause Duration</span>
            </div>
            <span className="font-bold text-emerald-400 text-sm">
              {Math.round(form.forcedPauseSeconds / 60)} Minutes
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="20"
            value={Math.round(form.forcedPauseSeconds / 60)}
            onChange={(e) => handleFormChange("forcedPauseSeconds", parseInt(e.target.value) * 60)}
            className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
          />
        </div>

        {/* Section 4: Toggles */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Preferences</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-sm font-medium">Desktop Notifications</div>
                  <div className="text-xs text-slate-500">Send pre-notifications at T-30, T-15, and T-5 min</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.notificationsEnabled}
                onChange={(e) => handleFormChange("notificationsEnabled", e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-sm font-medium">Chime Audio</div>
                  <div className="text-xs text-slate-500">Play subtle chime during T-0 countdown toast</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.soundEnabled}
                onChange={(e) => handleFormChange("soundEnabled", e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
              <div className="flex items-center gap-3">
                <Power className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-sm font-medium">Launch at Login</div>
                  <div className="text-xs text-slate-500">Ensure background scheduler runs on startup</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.launchAtLogin}
                onChange={(e) => handleFormChange("launchAtLogin", e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
