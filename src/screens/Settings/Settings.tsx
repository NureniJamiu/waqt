import React, { useState } from "react";
import { AppSettings, CalculationMethodName, AsrSchool, SoundOption } from "../../types";
import { ArrowLeft, Save, MapPin, Sliders, Bell, Volume2, Moon, Power, AlarmClock, Sparkles, CheckCircle2, Play } from "lucide-react";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { sendTestNotificationCommand } from "../../lib/store";
import { playSound } from "../../lib/sound";

interface SettingsProps {
  settings: AppSettings;
  onSave: (updated: AppSettings) => void;
  onBack: () => void;
  onPreviewSplash?: () => void;
}

const CITY_PRESETS = [
  { name: "Custom / Manual Input", lat: "", lng: "", method: "MuslimWorldLeague" as CalculationMethodName },
  { name: "Makkah, Saudi Arabia", lat: "21.3891", lng: "39.8579", method: "UmmAlQura" as CalculationMethodName },
  { name: "Medina, Saudi Arabia", lat: "24.5247", lng: "39.5692", method: "UmmAlQura" as CalculationMethodName },
  { name: "Lagos, Nigeria", lat: "6.5244", lng: "3.3792", method: "MuslimWorldLeague" as CalculationMethodName },
  { name: "London, UK", lat: "51.5074", lng: "-0.1278", method: "MuslimWorldLeague" as CalculationMethodName },
  { name: "New York, USA", lat: "40.7128", lng: "-74.0060", method: "NorthAmerica" as CalculationMethodName },
  { name: "Cairo, Egypt", lat: "30.0444", lng: "31.2357", method: "Egyptian" as CalculationMethodName },
  { name: "Istanbul, Turkey", lat: "41.0082", lng: "28.9784", method: "Turkey" as CalculationMethodName },
  { name: "Jakarta, Indonesia", lat: "-6.2088", lng: "106.8456", method: "Singapore" as CalculationMethodName },
  { name: "Kuala Lumpur, Malaysia", lat: "3.1390", lng: "101.6869", method: "Singapore" as CalculationMethodName },
  { name: "Dubai, UAE", lat: "25.2048", lng: "55.2708", method: "Dubai" as CalculationMethodName },
  { name: "Karachi, Pakistan", lat: "24.8607", lng: "67.0011", method: "Karachi" as CalculationMethodName },
  { name: "Toronto, Canada", lat: "43.6532", lng: "-79.3832", method: "NorthAmerica" as CalculationMethodName },
];

export const Settings: React.FC<SettingsProps> = ({ settings, onSave, onBack, onPreviewSplash }) => {
  const isDevelopment = import.meta.env.DEV;
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [savedToast, setSavedToast] = useState(false);
  const [testNotifToast, setTestNotifToast] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<{ title: string; body: string } | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("Custom / Manual Input");

  const handleSendTestNotif = async (mins: number) => {
    playSound(form.soundOption ?? "chime", form.soundEnabled);
    const title = "Upcoming Prayer: Dhuhr";
    const body = `Dhuhr is in ${mins} minutes.`;
    setBannerPreview({ title, body });
    setTimeout(() => setBannerPreview(null), 4500);

    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === "granted";
      }
      if (!granted) {
        setTestNotifToast("macOS permission not granted");
        setTimeout(() => setTestNotifToast(null), 4000);
        return;
      }
      await sendTestNotificationCommand("Dhuhr", mins);
      setTestNotifToast(`Sent T-${mins}m test notification!`);
      setTimeout(() => setTestNotifToast(null), 3000);
    } catch {
      setTestNotifToast("Error triggering notification");
      setTimeout(() => setTestNotifToast(null), 3000);
    }
  };

  const handleFormChange = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (key === "notificationsEnabled" && value === true) {
      try {
        let granted = await isPermissionGranted();
        if (!granted) {
          await requestPermission();
        }
      } catch (err) {
        console.warn("Could not request notification permission:", err);
      }
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCityPresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    const found = CITY_PRESETS.find((p) => p.name === presetName);
    if (found && found.lat) {
      setForm((prev) => ({
        ...prev,
        cityName: found.name,
        latitude: parseFloat(found.lat),
        longitude: parseFloat(found.lng),
        calculationMethod: found.method,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="line-surface rounded-full px-6 py-4 flex justify-between items-center">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="font-extrabold font-display text-lg text-white">Settings</h1>
        <button
          onClick={handleSubmit}
          className="line-button flex items-center gap-2 text-emerald-300 px-5 py-2.5 rounded-full text-xs font-black transition-all active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </header>

      {savedToast && (
        <div className="line-surface border-emerald-400/40 text-emerald-300 p-3.5 rounded-full text-xs font-semibold text-center flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {bannerPreview && (
        <div className="fixed top-6 right-6 z-50 animate-float">
          <div className="line-surface p-4 rounded-full border border-emerald-500/40 max-w-sm flex items-start gap-3.5">
            <div className="p-2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">Notification Banner Sent</div>
              <div className="text-sm font-bold text-white mt-0.5">{bannerPreview.title}</div>
              <div className="text-xs text-slate-300 mt-0.5 font-medium">{bannerPreview.body}</div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="line-surface rounded-md overflow-hidden">
        <section className="px-6 py-6 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm font-display mb-4">
            <MapPin className="w-4 h-4" />
            <span>Location & Coordinates</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">City Preset</label>
              <select
                value={selectedPreset}
                onChange={(e) => handleCityPresetChange(e.target.value)}
                className="select-control"
              >
                {CITY_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">City Name</label>
              <input
                type="text"
                value={form.cityName}
                onChange={(e) => {
                  handleFormChange("cityName", e.target.value);
                  setSelectedPreset("Custom / Manual Input");
                }}
                className="w-full line-surface-soft rounded-full px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => {
                    handleFormChange("latitude", parseFloat(e.target.value) || 0);
                    setSelectedPreset("Custom / Manual Input");
                  }}
                  className="w-full line-surface-soft rounded-full px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => {
                    handleFormChange("longitude", parseFloat(e.target.value) || 0);
                    setSelectedPreset("Custom / Manual Input");
                  }}
                  className="w-full line-surface-soft rounded-full px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 font-mono text-slate-100"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-6 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm font-display mb-4">
            <Sliders className="w-4 h-4" />
            <span>Calculation Authority & Jurisprudence</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Calculation Method</label>
              <select
                value={form.calculationMethod}
                onChange={(e) => handleFormChange("calculationMethod", e.target.value as CalculationMethodName)}
                className="select-control"
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
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Asr School</label>
              <select
                value={form.asrSchool}
                onChange={(e) => handleFormChange("asrSchool", e.target.value as AsrSchool)}
                className="select-control"
              >
                <option value="Standard">Standard (Shafi, Maliki, Hanbali)</option>
                <option value="Hanafi">Hanafi</option>
              </select>
            </div>
          </div>
        </section>

        <section className="px-6 py-6 border-b border-slate-800/80">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm font-display">
              <AlarmClock className="w-4 h-4" />
              <span>Pre-Lock Lead Time</span>
            </div>
            <span className="font-extrabold font-mono text-emerald-300 text-base line-chip px-3 py-1 rounded-full">
              {form.preLockMinutes ?? 15} Minutes Before
            </span>
          </div>

          <div className="space-y-3">
            <input
              type="range"
              min="0"
              max="30"
              step="5"
              value={form.preLockMinutes ?? 15}
              onChange={(e) => handleFormChange("preLockMinutes", parseInt(e.target.value))}
              className="range-slider"
              style={{
                background: `linear-gradient(to right, #10b981 ${((form.preLockMinutes ?? 15) / 30) * 100}%, rgba(30,41,59,0.9) ${((form.preLockMinutes ?? 15) / 30) * 100}%)`
              }}
            />
            <div className="flex justify-between px-0.5">
              {[0, 5, 10, 15, 20, 30].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleFormChange("preLockMinutes", v)}
                  className={`text-[10px] font-mono transition-colors cursor-pointer ${
                    (form.preLockMinutes ?? 15) === v
                      ? 'text-emerald-400 font-bold'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {v}m
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Locks the laptop this many minutes before prayer time so you can get ready, perform wudu, and reach the Masjid for congregation.
            </p>
          </div>
        </section>

        <section className="px-6 py-6 border-b border-slate-800/80">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm font-display">
              <Moon className="w-4 h-4" />
              <span>Forced Pause Duration</span>
            </div>
            <span className="font-extrabold font-mono text-emerald-300 text-base line-chip px-3 py-1 rounded-full">
              {Math.round(form.forcedPauseSeconds / 60)} Minutes
            </span>
          </div>

          <div className="space-y-3">
            <input
              type="range"
              min="1"
              max="20"
              value={Math.round(form.forcedPauseSeconds / 60)}
              onChange={(e) => handleFormChange("forcedPauseSeconds", parseInt(e.target.value) * 60)}
              className="range-slider"
              style={{
                background: `linear-gradient(to right, #10b981 ${((Math.round(form.forcedPauseSeconds / 60) - 1) / 19) * 100}%, rgba(30,41,59,0.9) ${((Math.round(form.forcedPauseSeconds / 60) - 1) / 19) * 100}%)`
              }}
            />
            <div className="flex justify-between px-0.5">
              {[1, 5, 10, 15, 20].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleFormChange("forcedPauseSeconds", v * 60)}
                  className={`text-[10px] font-mono transition-colors cursor-pointer ${
                    Math.round(form.forcedPauseSeconds / 60) === v
                      ? 'text-emerald-400 font-bold'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {v}m
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              During this duration, the confirmation button is locked to guarantee focused friction.
            </p>
          </div>
        </section>

        <section className="px-6 py-6">
          <div className="mb-4">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">System Preferences</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-sm font-bold">Desktop Notifications</div>
                    <div className="text-xs text-slate-400">Send pre-notifications at T-30, T-15, and T-5 min</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.notificationsEnabled}
                  onChange={(e) => handleFormChange("notificationsEnabled", e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {isDevelopment && form.notificationsEnabled && (
                <div className="pl-7 pt-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400 mr-1">Test Reminders:</span>
                    <button
                      type="button"
                      onClick={() => handleSendTestNotif(30)}
                      className="line-button px-2.5 py-1 text-xs font-semibold rounded-full text-emerald-300 transition active:scale-95 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3" /> Test 30m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTestNotif(15)}
                      className="line-button px-2.5 py-1 text-xs font-semibold rounded-full text-emerald-300 transition active:scale-95 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3" /> Test 15m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTestNotif(5)}
                      className="line-button px-2.5 py-1 text-xs font-semibold rounded-full text-emerald-300 transition active:scale-95 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3" /> Test 5m
                    </button>
                    {testNotifToast && (
                      <span className="text-xs text-emerald-400 font-semibold animate-fade-in ml-1">
                        {testNotifToast}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400/90 leading-relaxed italic">
                    macOS note: when Waqt is focused, banners route to Notification Center (top-right date/time). Switch apps or open Notification Center to view native popups.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-slate-800/80 pt-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-sm font-bold">Chime Audio</div>
                    <div className="text-xs text-slate-400">Play chime during T-0 countdown toast</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.soundEnabled}
                  onChange={(e) => handleFormChange("soundEnabled", e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {form.soundEnabled && (
                <div className="pl-7 space-y-2">
                  <div className="flex items-center gap-3">
                    <select
                      value={form.soundOption ?? "chime"}
                      onChange={(e) => handleFormChange("soundOption", e.target.value as SoundOption)}
                      className="select-control flex-1 max-w-xs text-xs py-2"
                    >
                      <option value="chime">Resonant Chime (MP3)</option>
                      <option value="takbeer">Deep Takbeer Tone (MP3)</option>
                      <option value="oscillator">Sine Oscillator (Subtle Synthesized)</option>
                      <option value="mute">Mute Audio</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => playSound(form.soundOption ?? "chime", true)}
                      className="line-button px-3 py-1.5 text-xs font-bold rounded-full text-emerald-300 transition active:scale-95 flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Test Sound
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3.5">
              <div className="flex items-center gap-3">
                <AlarmClock className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-sm font-bold">Snooze Option</div>
                  <div className="text-xs text-slate-400">Allow 5-minute overlay snooze (max 1 use per prayer)</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.snoozeEnabled}
                onChange={(e) => handleFormChange("snoozeEnabled", e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3.5">
              <div className="flex items-center gap-3">
                <Power className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-sm font-bold">Launch at Power Up</div>
                  <div className="text-xs text-slate-400">Start Waqt automatically after the laptop powers on</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.launchAtLogin}
                onChange={(e) => handleFormChange("launchAtLogin", e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </section>

        {isDevelopment && onPreviewSplash && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onPreviewSplash}
              className="line-button flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-emerald-300 px-4 py-2.5 rounded-full transition-colors"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Preview Splash Screen</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
