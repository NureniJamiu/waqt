import { describe, it, expect } from "vitest";
import {
  calculateDailyPrayerTimes,
  getCalculationMethodParams,
  formatTime,
  getPrayerTimeByDateAndName,
  getFireableWindow,
} from "../adhanCalc";
import { AppSettings } from "../../types";

const mockSettings: AppSettings = {
  latitude: 6.5244,
  longitude: 3.3792,
  cityName: "Lagos, Nigeria",
  calculationMethod: "MuslimWorldLeague",
  asrSchool: "Standard",
  forcedPauseSeconds: 420,
  soundEnabled: true,
  snoozeEnabled: false,
  notificationsEnabled: true,
  launchAtLogin: true,
  onboardingCompleted: true,
};

describe("adhanCalc Engine", () => {
  it("should calculate 5 daily prayers for Lagos, Nigeria", () => {
    const date = new Date(2026, 7, 17, 10, 0, 0); // 2026-08-17 10:00 AM
    const prayers = calculateDailyPrayerTimes(mockSettings, date, date);

    expect(prayers).toHaveLength(5);
    expect(prayers.map((p) => p.name)).toEqual([
      "Fajr",
      "Dhuhr",
      "Asr",
      "Maghrib",
      "Isha",
    ]);

    prayers.forEach((prayer) => {
      expect(prayer.time).toBeInstanceOf(Date);
      expect(prayer.fireableUntil).toBeInstanceOf(Date);
      expect(prayer.time.getTime()).toBeLessThan(prayer.fireableUntil.getTime());
      expect(typeof prayer.formattedTime).toBe("string");
    });

    const formatted = formatTime(date, true);
    expect(formatted).toMatch(/^\d{2}:\d{2}$/);
  });

  it("should handle reference time correctly for passed and next prayers", () => {
    const targetDate = new Date(2026, 7, 17, 12, 0, 0);
    // Reference time set to 2:00 PM (14:00)
    const referenceTime = new Date(2026, 7, 17, 14, 0, 0);

    const prayers = calculateDailyPrayerTimes(mockSettings, targetDate, referenceTime);

    const fajr = prayers.find((p) => p.name === "Fajr")!;
    const dhuhr = prayers.find((p) => p.name === "Dhuhr")!;
    const asr = prayers.find((p) => p.name === "Asr")!;

    // In Lagos on Aug 17, Fajr and Dhuhr are before 14:00
    expect(fajr.isPassed).toBe(true);
    expect(dhuhr.isPassed).toBe(true);
    // Asr is after 14:00, so it should be next
    expect(asr.isPassed).toBe(false);
    expect(asr.isNext).toBe(true);
  });

  it("should support Hanafi Asr school (later Asr time)", () => {
    const date = new Date(2026, 7, 17);

    const standardSettings = { ...mockSettings, asrSchool: "Standard" as const };
    const hanafiSettings = { ...mockSettings, asrSchool: "Hanafi" as const };

    const standardPrayers = calculateDailyPrayerTimes(standardSettings, date, date);
    const hanafiPrayers = calculateDailyPrayerTimes(hanafiSettings, date, date);

    const standardAsr = standardPrayers.find((p) => p.name === "Asr")!;
    const hanafiAsr = hanafiPrayers.find((p) => p.name === "Asr")!;

    expect(hanafiAsr.time.getTime()).toBeGreaterThan(standardAsr.time.getTime());
  });

  it("should support all calculation methods without errors", () => {
    const methods = [
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
    ] as const;

    methods.forEach((method) => {
      const params = getCalculationMethodParams(method);
      expect(params).toBeDefined();

      const settings = { ...mockSettings, calculationMethod: method };
      const prayers = calculateDailyPrayerTimes(settings, new Date());
      expect(prayers).toHaveLength(5);
    });
  });

  it("should return correct prayer time by date and name", () => {
    const date = new Date(2026, 7, 17);
    const fajrTime = getPrayerTimeByDateAndName(mockSettings, date, "Fajr");
    expect(fajrTime).toBeInstanceOf(Date);
  });

  it("should return fireable window for a prayer", () => {
    const date = new Date(2026, 7, 17);
    const window = getFireableWindow(mockSettings, date, "Dhuhr");

    expect(window).not.toBeNull();
    expect(window!.startTime).toBeInstanceOf(Date);
    expect(window!.fireableUntil).toBeInstanceOf(Date);
    expect(window!.startTime.getTime()).toBeLessThan(window!.fireableUntil.getTime());
  });
});
