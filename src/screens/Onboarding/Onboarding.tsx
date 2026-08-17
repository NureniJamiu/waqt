import React, { useState } from "react";
import { AppSettings, CalculationMethodName, AsrSchool } from "../../types";
import { MapPin, Sliders, Clock, CheckCircle2, ChevronRight, Bell } from "lucide-react";

interface OnboardingProps {
  settings: AppSettings;
  onComplete: (updatedSettings: AppSettings) => void;
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

export const Onboarding: React.FC<OnboardingProps> = ({ settings, onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPreset, setSelectedPreset] = useState<string>("Custom / Manual Input");
  const [cityName, setCityName] = useState(settings.cityName || "Lagos, Nigeria");
  const [latitude, setLatitude] = useState(settings.latitude.toString());
  const [longitude, setLongitude] = useState(settings.longitude.toString());
  const [method, setMethod] = useState<CalculationMethodName>(settings.calculationMethod);
  const [asrSchool, setAsrSchool] = useState<AsrSchool>(settings.asrSchool);
  const [pauseMinutes, setPauseMinutes] = useState(Math.round(settings.forcedPauseSeconds / 60));
  const [notifGranted, setNotifGranted] = useState<boolean>(false);

  const handleCityPresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    const found = CITY_PRESETS.find((p) => p.name === presetName);
    if (found && found.lat) {
      setCityName(found.name);
      setLatitude(found.lat);
      setLongitude(found.lng);
      setMethod(found.method);
    }
  };

  const handleRequestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotifGranted(permission === "granted");
    }
  };

  const handleNext = () => {
    if (step < 3) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3);
    } else {
      const updated: AppSettings = {
        ...settings,
        cityName,
        latitude: parseFloat(latitude) || settings.latitude,
        longitude: parseFloat(longitude) || settings.longitude,
        calculationMethod: method,
        asrSchool,
        forcedPauseSeconds: pauseMinutes * 60,
        notificationsEnabled: notifGranted || settings.notificationsEnabled,
        onboardingCompleted: true,
      };
      onComplete(updated);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8 max-w-xl mx-auto text-slate-100">
      {/* Header Badge */}
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="relative group mb-4">
          <div className="absolute -inset-1 rounded-3xl bg-emerald-500/30 blur-md group-hover:bg-emerald-500/50 transition" />
          <div className="relative w-20 h-20 rounded-3xl glass-panel p-2 flex items-center justify-center bg-slate-900 border border-white/10 shadow-2xl">
            <img src="/logo.png" alt="Waqt Logo" className="w-full h-full object-contain rounded-2xl animate-float" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          Welcome to Waqt
        </h1>
        <p className="text-slate-400 mt-2 text-xs md:text-sm max-w-sm font-medium">
          Personal accountability desktop app for daily prayer timing.
        </p>
      </div>

      {/* Progress Dots */}
      <div className="flex items-center gap-2 mb-8 w-full">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-glow-emerald" : "bg-slate-800"
            }`}
          />
        ))}
      </div>

      {/* Step Container Card */}
      <div className="w-full glass-panel rounded-3xl p-6 md:p-8 shadow-2xl border border-white/10 backdrop-blur-2xl">
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest">
              <MapPin className="w-4 h-4" />
              <span>Step 1 of 3: Location</span>
            </div>
            <h2 className="text-2xl font-black font-display text-white">Set Your Prayer Location</h2>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Select a major city preset or enter your custom city name and geographic coordinates.
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">City Preset</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handleCityPresetChange(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
                >
                  {CITY_PRESETS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Display City Name</label>
                <input
                  type="text"
                  value={cityName}
                  onChange={(e) => {
                    setCityName(e.target.value);
                    setSelectedPreset("Custom / Manual Input");
                  }}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
                  placeholder="e.g. London, UK"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => {
                      setLatitude(e.target.value);
                      setSelectedPreset("Custom / Manual Input");
                    }}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-500 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => {
                      setLongitude(e.target.value);
                      setSelectedPreset("Custom / Manual Input");
                    }}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-500 text-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest">
              <Sliders className="w-4 h-4" />
              <span>Step 2 of 3: Calculation</span>
            </div>
            <h2 className="text-2xl font-black font-display text-white">Prayer Calculation Authority</h2>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Choose your preferred calculation method and Asr jurisprudence school.
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Calculation Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as CalculationMethodName)}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
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
                  value={asrSchool}
                  onChange={(e) => setAsrSchool(e.target.value as AsrSchool)}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
                >
                  <option value="Standard">Standard (Shafi, Maliki, Hanbali)</option>
                  <option value="Hanafi">Hanafi</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest">
              <Clock className="w-4 h-4" />
              <span>Step 3 of 3: Friction & Notifications</span>
            </div>
            <h2 className="text-2xl font-black font-display text-white">Forced Pause Duration</h2>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Configure how long the full-screen overlay locks the confirm button to give you focused step-away time.
            </p>

            <div className="space-y-5 pt-2">
              <div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-slate-400 font-medium">Pause Friction Duration:</span>
                  <span className="font-extrabold font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    {pauseMinutes} Minutes
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={pauseMinutes}
                  onChange={(e) => setPauseMinutes(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 h-2.5 rounded-lg cursor-pointer"
                />
              </div>

              <div className="p-4 bg-slate-900/80 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-emerald-400" />
                    <span>Desktop Pre-Notifications</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Receive gentle alerts at T-30m, T-15m, and T-5m before prayer time.
                  </div>
                </div>

                <button
                  onClick={handleRequestNotificationPermission}
                  type="button"
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    notifGranted
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-glow-emerald"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  }`}
                >
                  {notifGranted ? "✓ Enabled" : "Enable Alerts"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleNext}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-6 py-3 rounded-2xl transition-all shadow-glow-emerald active:scale-95 text-xs uppercase tracking-wider"
          >
            <span>{step === 3 ? "Complete Setup" : "Continue"}</span>
            {step === 3 ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
