// Shared prayer-time fixture: the contract between the two calculators.
//
// `adhanCalc.ts` (adhan-js) drives everything the user sees; `prayer_calc.rs`
// drives the scheduler that actually locks the screen. A divergence shows up
// as an overlay firing at the wrong time while the Dashboard looks right, so
// both sides are checked against `fixtures/prayer_times.json`:
//   - this file asserts adhanCalc reproduces it exactly;
//   - `prayer_calc.rs` asserts the Rust engine lands within a minute of it.
//
// Regenerate (only after a deliberate change to the UI-side calculation):
//   UPDATE_PRAYER_FIXTURES=1 npx vitest run src/lib/__tests__/prayerFixtures.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { calculateDailyPrayerTimes } from "../adhanCalc";
import { AppSettings, AsrSchool, CalculationMethodName } from "../../types";

const FIXTURE_PATH = resolve(__dirname, "../../../fixtures/prayer_times.json");

interface FixtureCase {
  city: string;
  latitude: number;
  longitude: number;
  /** Standard UTC offset the Rust side computes in, hours. */
  utcOffsetHours: number;
  date: string;
  method: CalculationMethodName;
  asrSchool: AsrSchool;
  /** Unix seconds. */
  expected: Record<"Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha", number>;
}

const LOCATIONS = [
  { city: "Lagos", latitude: 6.5244, longitude: 3.3792, utcOffsetHours: 1 },
  { city: "Makkah", latitude: 21.4225, longitude: 39.8262, utcOffsetHours: 3 },
  { city: "Istanbul", latitude: 41.0082, longitude: 28.9784, utcOffsetHours: 3 },
  { city: "Jakarta", latitude: -6.2088, longitude: 106.8456, utcOffsetHours: 7 },
  { city: "New York", latitude: 40.7128, longitude: -74.006, utcOffsetHours: -5 },
  { city: "London", latitude: 51.5074, longitude: -0.1278, utcOffsetHours: 0 },
  // Above 55°N: twilight angles go unreachable in summer, exercising the
  // middle-of-the-night rule and Moonsighting Committee's >= 55° branch.
  { city: "Oslo", latitude: 59.9139, longitude: 10.7522, utcOffsetHours: 1 },
];

const DATES = ["2026-01-15", "2026-03-20", "2026-06-21", "2026-10-15"];

const METHODS: CalculationMethodName[] = [
  "MuslimWorldLeague",
  "Egyptian",
  "Karachi",
  "UmmAlQura",
  "Dubai",
  "MoonsightingCommittee",
  "NorthAmerica",
  "Kuwait",
  "Qatar",
  "Singapore",
  "Turkey",
  "Tehran",
];

function settingsFor(c: Omit<FixtureCase, "expected" | "city" | "date" | "utcOffsetHours">): AppSettings {
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    cityName: "",
    calculationMethod: c.method,
    asrSchool: c.asrSchool,
    forcedPauseSeconds: 900,
    preLockMinutes: 0,
    soundEnabled: false,
    snoozeEnabled: false,
    notificationsEnabled: false,
    launchAtLogin: false,
    onboardingCompleted: true,
  } as AppSettings;
}

function compute(c: Omit<FixtureCase, "expected">): FixtureCase["expected"] {
  const [y, m, d] = c.date.split("-").map(Number);
  // adhan-js picks the calendar day from the Date's local components and
  // returns absolute instants, so the process timezone does not matter here.
  const times = calculateDailyPrayerTimes(settingsFor(c), new Date(y, m - 1, d, 12), new Date(y, m - 1, d, 0));
  const out = {} as FixtureCase["expected"];
  for (const t of times) out[t.name] = Math.round(t.time.getTime() / 1000);
  return out;
}

function buildCases(): Omit<FixtureCase, "expected">[] {
  const cases: Omit<FixtureCase, "expected">[] = [];
  for (const loc of LOCATIONS) {
    for (const date of DATES) {
      for (const method of METHODS) {
        cases.push({ ...loc, date, method, asrSchool: "Standard" });
      }
      cases.push({ ...loc, date, method: "Karachi", asrSchool: "Hanafi" });
    }
  }
  return cases;
}

describe("shared prayer-time fixture", () => {
  if (process.env.UPDATE_PRAYER_FIXTURES) {
    it("regenerates fixtures/prayer_times.json", () => {
      const cases = buildCases().map((c) => ({ ...c, expected: compute(c) }));
      writeFileSync(FIXTURE_PATH, JSON.stringify(cases, null, 2) + "\n");
    });
    return;
  }

  it("adhanCalc reproduces every fixture case exactly", () => {
    const cases: FixtureCase[] = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
    expect(cases.length).toBe(buildCases().length);
    for (const c of cases) {
      expect(compute(c), `${c.city} ${c.date} ${c.method} ${c.asrSchool}`).toEqual(c.expected);
    }
  });
});
