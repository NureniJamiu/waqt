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
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-xl mx-auto text-slate-100">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-4 border border-emerald-500/20">
          <Clock className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Waqt</h1>
        <p className="text-slate-400 mt-2 text-sm">
          A respectful, offline prayer-time accountability tool.
        </p>
      </div>

      {/* Progress Indicators */}
      <div className="flex items-center gap-2 mb-8 w-full">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? "bg-emerald-500" : "bg-slate-800"
            }`}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="w-full glass-panel rounded-2xl p-6 shadow-2xl border border-slate-800">
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <MapPin className="w-4 h-4" />
              <span>Step 1: Your Location</span>
            </div>
            <h2 className="text-xl font-bold">Set Prayer Location</h2>
            <p className="text-slate-400 text-sm">
              Select a major city preset or enter your custom city name and coordinates for offline calculations.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">City Preset</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handleCityPresetChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
                >
                  {CITY_PRESETS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">City Display Name</label>
                <input
                  type="text"
                  value={cityName}
                  onChange={(e) => {
                    setCityName(e.target.value);
                    setSelectedPreset("Custom / Manual Input");
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. London, UK"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => {
                      setLatitude(e.target.value);
                      setSelectedPreset("Custom / Manual Input");
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => {
                      setLongitude(e.target.value);
                      setSelectedPreset("Custom / Manual Input");
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Sliders className="w-4 h-4" />
              <span>Step 2: Calculation Method</span>
            </div>
            <h2 className="text-xl font-bold">Prayer Authority & School</h2>
            <p className="text-slate-400 text-sm">
              Choose your preferred calculation authority and Asr jurisprudence school.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Calculation Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as CalculationMethodName)}
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
                  value={asrSchool}
                  onChange={(e) => setAsrSchool(e.target.value as AsrSchool)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
                >
                  <option value="Standard">Standard (Shafi, Maliki, Hanbali)</option>
                  <option value="Hanafi">Hanafi</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Clock className="w-4 h-4" />
              <span>Step 3: Forced Pause Duration & Permissions</span>
            </div>
            <h2 className="text-xl font-bold">Overlay Friction & Pre-Notifications</h2>
            <p className="text-slate-400 text-sm">
              Set how long the full-screen overlay disables the "I've prayed" button to give you time to step away.
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Duration:</span>
                  <span className="font-bold text-emerald-400">{pauseMinutes} Minutes</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={pauseMinutes}
                  onChange={(e) => setPauseMinutes(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>1 min</span>
                  <span>7 min (default)</span>
                  <span>20 min</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Desktop Notifications</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Receive pre-notifications at T-30m, T-15m, and T-5m.
                  </div>
                </div>

                <button
                  onClick={handleRequestNotificationPermission}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    notifGranted
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  }`}
                >
                  {notifGranted ? "✓ Enabled" : "Enable Prompt"}
                </button>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed">
                ℹ️ <strong>Emergency Escape:</strong> The overlay will always include an immediately clickable 
                <em> Emergency Dismiss</em> button for real work emergencies.
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleNext}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <span>{step === 3 ? "Complete Setup" : "Continue"}</span>
            {step === 3 ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

