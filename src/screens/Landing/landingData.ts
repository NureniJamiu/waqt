import { useEffect, useState } from "react";
import { calculateDailyPrayerTimes } from "../../lib/adhanCalc";
import { AppSettings, CalculationMethodName, PrayerName } from "../../types";

export const REPO_URL = "https://github.com/NureniJamiu/waqt";
export const RELEASES_URL = `${REPO_URL}/releases`;

export interface City {
  name: string;
  lat: number;
  lng: number;
  method: CalculationMethodName;
  tz: string;
}

// Same presets and methods as the app's onboarding (src/screens/Onboarding).
export const CITIES: City[] = [
  { name: "Lagos, Nigeria", lat: 6.5244, lng: 3.3792, method: "MuslimWorldLeague", tz: "Africa/Lagos" },
  { name: "London, UK", lat: 51.5074, lng: -0.1278, method: "MuslimWorldLeague", tz: "Europe/London" },
  { name: "New York, USA", lat: 40.7128, lng: -74.006, method: "NorthAmerica", tz: "America/New_York" },
  { name: "Toronto, Canada", lat: 43.6532, lng: -79.3832, method: "NorthAmerica", tz: "America/Toronto" },
  { name: "Cairo, Egypt", lat: 30.0444, lng: 31.2357, method: "Egyptian", tz: "Africa/Cairo" },
  { name: "Istanbul, Turkey", lat: 41.0082, lng: 28.9784, method: "Turkey", tz: "Europe/Istanbul" },
  { name: "Makkah, Saudi Arabia", lat: 21.3891, lng: 39.8579, method: "UmmAlQura", tz: "Asia/Riyadh" },
  { name: "Medina, Saudi Arabia", lat: 24.5247, lng: 39.5692, method: "UmmAlQura", tz: "Asia/Riyadh" },
  { name: "Dubai, UAE", lat: 25.2048, lng: 55.2708, method: "Dubai", tz: "Asia/Dubai" },
  { name: "Karachi, Pakistan", lat: 24.8607, lng: 67.0011, method: "Karachi", tz: "Asia/Karachi" },
  { name: "Kuala Lumpur, Malaysia", lat: 3.139, lng: 101.6869, method: "Singapore", tz: "Asia/Kuala_Lumpur" },
  { name: "Jakarta, Indonesia", lat: -6.2088, lng: 106.8456, method: "Singapore", tz: "Asia/Jakarta" },
];

/** The preset whose time zone matches the visitor's, else Lagos (the app's default). */
export function guessCity(): City {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return CITIES.find((c) => c.tz === tz) ?? CITIES[0];
  } catch {
    return CITIES[0];
  }
}

const PRE_LOCK_MINUTES = 10;
const FORCED_PAUSE_MINUTES = 15;

export interface DayPrayer {
  name: PrayerName;
  time: Date;
  lock: Date;
  pauseEnds: Date;
}

/** Calendar date (y, m, d) as seen in the city's own zone, `offsetDays` from today. */
function cityDate(city: City, offsetDays: number, now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: city.tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + offsetDays, 12);
}

/** The five prayers for one day in the city, computed offline with the app's own adhan-js wrapper. */
export function cityDay(city: City, offsetDays: number, now = new Date()): { date: Date; prayers: DayPrayer[] } {
  const date = cityDate(city, offsetDays, now);
  const settings = {
    latitude: city.lat,
    longitude: city.lng,
    calculationMethod: city.method,
    asrSchool: "Standard",
    preLockMinutes: PRE_LOCK_MINUTES,
  } as AppSettings;
  const prayers = calculateDailyPrayerTimes(settings, date, now).map((p) => ({
    name: p.name,
    time: p.time,
    lock: p.lockTime,
    pauseEnds: new Date(p.lockTime.getTime() + FORCED_PAUSE_MINUTES * 60_000),
  }));
  return { date, prayers };
}

export function nextPrayer(city: City, now = new Date()): DayPrayer {
  for (const offset of [0, 1]) {
    const hit = cityDay(city, offset, now).prayers.find((p) => p.time > now);
    if (hit) return hit;
  }
  return cityDay(city, 1, now).prayers[0];
}

export function clock(date: Date, tz: string): string {
  return date.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
}

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Adds `is-in` to every [data-reveal] / .shutter under `root` as it scrolls into view, once. */
export function useReveal() {
  useEffect(() => {
    const root = document.querySelector(".lp");
    if (!root) return;
    root.classList.add("js");
    const targets = root.querySelectorAll("[data-reveal], .shutter");
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    // A closed shutter is clipped to nothing, and IntersectionObserver honours
    // clip-path, so it is watched through its parent instead.
    const watched = new Map<Element, Element>();
    targets.forEach((el) => watched.set(el.classList.contains("shutter") && el.parentElement ? el.parentElement : el, el));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            watched.get(e.target)?.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    watched.forEach((_, el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
