import React, { useState } from "react";
import { AppSettings, CalculationMethodName, AsrSchool } from "../../types";
import { MapPin, Sliders, Clock, CheckCircle2, ChevronRight } from "lucide-react";

interface OnboardingProps {
  settings: AppSettings;
  onComplete: (updatedSettings: AppSettings) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ settings, onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cityName, setCityName] = useState(settings.cityName || "Lagos, Nigeria");
  const [latitude, setLatitude] = useState(settings.latitude.toString());
  const [longitude, setLongitude] = useState(settings.longitude.toString());
  const [method, setMethod] = useState<CalculationMethodName>(settings.calculationMethod);
  const [asrSchool, setAsrSchool] = useState<AsrSchool>(settings.asrSchool);
  const [pauseMinutes, setPauseMinutes] = useState(Math.round(settings.forcedPauseSeconds / 60));

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
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Salah Guard</h1>
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
              Enter your city or precise latitude and longitude for offline prayer calculation.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">City Name</label>
                <input
                  type="text"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
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
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
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
              <span>Step 3: Forced Pause Duration</span>
            </div>
            <h2 className="text-xl font-bold">Overlay Pause Friction</h2>
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
