import React, { useState, useEffect, useRef } from "react";
import { AppSettings, CalculationMethodName, AsrSchool } from "../../types";
import { MapPin, Sliders, Clock, CheckCircle2, ChevronRight, Bell, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import {
  checkAccessibilityPermission,
  requestAccessibilityPermission,
} from "../../lib/store";

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
  const [preLockMinutes, setPreLockMinutes] = useState(settings.preLockMinutes ?? 10);

  // Notification permission state
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null); // null = checking
  const [notifRequesting, setNotifRequesting] = useState(false);

  // Accessibility permission state (macOS)
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null); // null = checking
  const [accessRequesting, setAccessRequesting] = useState(false);

  // Track whether we've auto-prompted for notifications on step 3 mount
  const hasAutoPromptedNotif = useRef(false);

  // ── When entering Step 3, check both permissions and auto-prompt notifications ──
  useEffect(() => {
    if (step !== 3) return;

    // Check notification permission (real OS state)
    const checkNotif = async () => {
      try {
        const granted = await isPermissionGranted();
        setNotifGranted(granted);

        // Auto-prompt once if not yet granted
        if (!granted && !hasAutoPromptedNotif.current) {
          hasAutoPromptedNotif.current = true;
          setNotifRequesting(true);
          try {
            const perm = await requestPermission();
            setNotifGranted(perm === "granted");
          } catch {
            setNotifGranted(false);
          } finally {
            setNotifRequesting(false);
          }
        }
      } catch {
        // Fallback: assume granted if API is unavailable (web dev mode)
        setNotifGranted(true);
      }
    };

    // Check accessibility permission
    const checkAccess = async () => {
      try {
        const granted = await checkAccessibilityPermission();
        setAccessGranted(granted);
      } catch {
        setAccessGranted(true); // Non-macOS / dev fallback
      }
    };

    checkNotif();
    checkAccess();
  }, [step]);

  // ── Poll accessibility permission while step 3 is visible so the card
  //    updates live when the user toggles the switch in System Preferences ──
  useEffect(() => {
    if (step !== 3) return;
    if (accessGranted === true) return; // Already granted, no need to poll

    const interval = setInterval(async () => {
      try {
        const granted = await checkAccessibilityPermission();
        setAccessGranted(granted);
      } catch {
        // ignore
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [step, accessGranted]);

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
    if (notifRequesting) return;
    setNotifRequesting(true);
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
      setNotifGranted(granted);
    } catch {
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        setNotifGranted(permission === "granted");
      }
    } finally {
      setNotifRequesting(false);
    }
  };

  const handleRequestAccessibilityPermission = async () => {
    if (accessRequesting) return;
    setAccessRequesting(true);
    try {
      const granted = await requestAccessibilityPermission();
      setAccessGranted(granted);
    } catch {
      setAccessGranted(false);
    } finally {
      setAccessRequesting(false);
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
        preLockMinutes,
        notificationsEnabled: notifGranted === true,
        onboardingCompleted: true,
      };
      onComplete(updated);
    }
  };

  const allPermissionsGranted = notifGranted === true && accessGranted === true;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8 max-w-xl mx-auto text-slate-100">
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="mb-4">
          <img src="/logo.png?v=3" alt="Waqt Logo" className="h-20 w-20 object-contain animate-float" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-white">
          Welcome to Waqt
        </h1>
        <p className="text-slate-400 mt-2 text-xs md:text-sm max-w-sm font-medium">
          Personal accountability desktop app for daily prayer timing.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-8 w-full">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? "bg-emerald-400" : "bg-slate-800"
            }`}
          />
        ))}
      </div>

      <div className="w-full line-surface rounded-md p-6 md:p-8">
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Display City Name</label>
                <input
                  type="text"
                  value={cityName}
                  onChange={(e) => {
                    setCityName(e.target.value);
                    setSelectedPreset("Custom / Manual Input");
                  }}
                  className="w-full line-surface-soft rounded-md px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
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
                    className="w-full line-surface-soft rounded-md px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-500 text-slate-100"
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
                    className="w-full line-surface-soft rounded-md px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-500 text-slate-100"
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
                  className="select-control"
                >
                  <option value="MuslimWorldLeague">Muslim World League (Recommended)</option>
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
                  className="select-control"
                >
                  <option value="Standard">Standard (Shafi, Maliki, Hanbali) (Recommended)</option>
                  <option value="Hanafi">Hanafi</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest mb-3">
                <Clock className="w-4 h-4" />
                <span>Step 3 of 3: Pause &amp; Permissions</span>
              </div>
              <h2 className="text-2xl font-black font-display text-white">Forced Pause &amp; Access</h2>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                Configure your pause duration and grant required OS permissions so the app works correctly from the first prayer.
              </p>
            </div>

            {/* Pre-Lock Lead Time card */}
            <div className="line-surface-soft rounded-xl p-5 space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-0.5">Pre-Lock Lead Time</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-emerald-300 tabular-nums leading-none">{preLockMinutes}</span>
                    <span className="text-sm font-semibold text-slate-400">min before Adhan</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-600 font-medium">Range</div>
                  <div className="text-xs text-slate-400 font-mono">0 – 30 min</div>
                </div>
              </div>

              <div className="pt-1">
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="5"
                  value={preLockMinutes}
                  onChange={(e) => setPreLockMinutes(parseInt(e.target.value))}
                  className="range-slider"
                  style={{
                    background: `linear-gradient(to right, #10b981 ${(preLockMinutes / 30) * 100}%, rgba(30,41,59,0.9) ${(preLockMinutes / 30) * 100}%)`
                  }}
                />
                <div className="flex justify-between mt-2 px-0.5">
                  {[0, 5, 10, 15, 20, 30].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPreLockMinutes(v)}
                      className={`text-[10px] font-mono transition-colors cursor-pointer ${
                        preLockMinutes === v ? 'text-emerald-400 font-bold' : 'text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      {v}m
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Locks laptop before Adhan to give you time to perform wudu and arrive at the Masjid on time.
              </p>
            </div>

            {/* Slider card */}
            <div className="line-surface-soft rounded-xl p-5 space-y-4">
              {/* Value display */}
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-0.5">Forced Pause Duration</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-emerald-300 tabular-nums leading-none">{pauseMinutes}</span>
                    <span className="text-sm font-semibold text-slate-400">min</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-600 font-medium">Range</div>
                  <div className="text-xs text-slate-400 font-mono">1 – 20 min</div>
                </div>
              </div>

              {/* Slider */}
              <div className="pt-1">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={pauseMinutes}
                  onChange={(e) => setPauseMinutes(parseInt(e.target.value))}
                  className="range-slider"
                  style={{
                    background: `linear-gradient(to right, #10b981 ${((pauseMinutes - 1) / 19) * 100}%, rgba(30,41,59,0.9) ${((pauseMinutes - 1) / 19) * 100}%)`
                  }}
                />
                {/* Tick labels */}
                <div className="flex justify-between mt-2 px-0.5">
                  {[1, 5, 10, 15, 20].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPauseMinutes(v)}
                      className={`text-[10px] font-mono transition-colors cursor-pointer ${
                        pauseMinutes === v ? 'text-emerald-400 font-bold' : 'text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      {v}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Permissions section ── */}
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Required Permissions</div>

              {/* Notification permission card */}
              <div className="line-surface-soft rounded-xl p-4 flex items-center gap-4">
                <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  notifGranted === true
                    ? 'bg-emerald-500/15 border border-emerald-500/30'
                    : notifGranted === null
                    ? 'bg-slate-800/60 border border-slate-700/50'
                    : 'bg-amber-500/10 border border-amber-500/30'
                }`}>
                  {notifGranted === null || notifRequesting
                    ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    : notifGranted === true
                    ? <Bell className="w-5 h-5 text-emerald-400" />
                    : <Bell className="w-5 h-5 text-amber-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-100">Desktop Notifications</span>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      Recommended
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {notifGranted === true
                      ? "Granted — T-30m, T-15m & T-5m prayer alerts enabled."
                      : notifGranted === false
                      ? "Denied — prayer pre-notifications will be disabled."
                      : "Checking…"}
                  </div>
                </div>
                {notifGranted !== true && (
                  <button
                    onClick={handleRequestNotificationPermission}
                    disabled={notifRequesting}
                    type="button"
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {notifRequesting ? "Requesting…" : "Allow"}
                  </button>
                )}
                {notifGranted === true && (
                  <div className="shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                )}
              </div>

              {/* Accessibility permission card (macOS) */}
              <div className="line-surface-soft rounded-xl p-4 flex items-center gap-4">
                <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  accessGranted === true
                    ? 'bg-emerald-500/15 border border-emerald-500/30'
                    : accessGranted === null
                    ? 'bg-slate-800/60 border border-slate-700/50'
                    : 'bg-amber-500/10 border border-amber-500/30'
                }`}>
                  {accessGranted === null || accessRequesting
                    ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    : accessGranted === true
                    ? <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    : <ShieldAlert className="w-5 h-5 text-amber-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-100">Accessibility Access</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {accessGranted === true
                      ? "Granted — overlay can minimize other windows on prayer time."
                      : accessGranted === false
                      ? "Required to minimize fullscreen apps when overlay fires. Grant in System Settings."
                      : "Checking…"}
                  </div>
                  {accessGranted === false && (
                    <div className="text-[10px] text-amber-500/80 mt-1">
                      Waiting for you to toggle the switch in System Settings…
                    </div>
                  )}
                </div>
                {accessGranted !== true && (
                  <button
                    onClick={handleRequestAccessibilityPermission}
                    disabled={accessRequesting}
                    type="button"
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {accessRequesting ? "Opening…" : "Grant Access"}
                  </button>
                )}
                {accessGranted === true && (
                  <div className="shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                )}
              </div>

              {/* Summary hint */}
              {!allPermissionsGranted && notifGranted !== null && accessGranted !== null && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-300/80 leading-relaxed">
                    You can continue without granting all permissions, but some features may be limited. You can grant access later in Settings.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleNext}
            className="line-button flex items-center gap-2 text-emerald-300 font-black px-6 py-3 rounded-md transition-all active:scale-95 text-xs uppercase tracking-wider"
          >
            <span>{step === 3 ? "Complete Setup" : "Continue"}</span>
            {step === 3 ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
