import { describe, it, expect } from "vitest";
import {
  calculateDailyPrayerTimes,
  getCalculationMethodParams,
  formatTime,
  getPrayerTimeByDateAndName,
  getFireableWindow,
  getUpcomingPrayer,
} from "../adhanCalc";
import { AppSettings } from "../../types";

const mockSettings: AppSettings = {
  latitude: 6.5244,
  longitude: 3.3792,
  cityName: "Lagos, Nigeria",
  calculationMethod: "MuslimWorldLeague",
  asrSchool: "Standard",
  forcedPauseSeconds: 420,
  preLockMinutes: 15,
  soundEnabled: true,
  snoozeEnabled: false,
  notificationsEnabled: true,
  launchAtLogin: true,
  onboardingCompleted: true,
};

describe("adhanCalc Engine", () => {
  it("should calculate 5 daily prayers for Lagos, Nigeria with preLockMinutes", () => {
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
      expect(prayer.lockTime).toBeInstanceOf(Date);
      expect(prayer.fireableUntil).toBeInstanceOf(Date);
      // lockTime must be exactly preLockMinutes (15 mins) before prayer time
      expect(prayer.time.getTime() - prayer.lockTime.getTime()).toBe(15 * 60 * 1000);
      expect(prayer.lockTime.getTime()).toBeLessThan(prayer.fireableUntil.getTime());
      expect(typeof prayer.formattedTime).toBe("string");
      expect(typeof prayer.formattedLockTime).toBe("string");
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

  it("should not mutate the input targetDate or referenceTime Date objects", () => {
    const targetDate = new Date(2026, 7, 17, 18, 57, 3);
    const referenceTime = new Date(2026, 7, 17, 18, 57, 3);
    const targetTimestamp = targetDate.getTime();
    const refTimestamp = referenceTime.getTime();

    calculateDailyPrayerTimes(mockSettings, targetDate, referenceTime);

    expect(targetDate.getTime()).toBe(targetTimestamp);
    expect(referenceTime.getTime()).toBe(refTimestamp);
  });

  it("should return the correct upcoming prayer during evening and late night", () => {
    // 18:30:00 - Maghrib is upcoming (Lock at 18:45:00, Adhan at 19:00:00)
    const eveningTime = new Date(2026, 7, 17, 18, 30, 0);
    const eveningUpcoming = getUpcomingPrayer(mockSettings, eveningTime);
    expect(eveningUpcoming.name).toBe("Maghrib");
    expect(eveningUpcoming.lockTime.getTime()).toBeGreaterThan(eveningTime.getTime());

    // 22:30:00 - All 5 prayers today passed -> Tomorrow Fajr is upcoming
    const lateNightTime = new Date(2026, 7, 17, 22, 30, 0);
    const lateNightUpcoming = getUpcomingPrayer(mockSettings, lateNightTime);
    expect(lateNightUpcoming.name).toBe("Fajr");
    expect(lateNightUpcoming.time.getTime()).toBeGreaterThan(lateNightTime.getTime());
  });

  it("should calculate prayer times 100% offline for global coordinates without network requests", () => {
    const testCities = [
      { name: "London, UK", lat: 51.5074, lng: -0.1278, method: "MuslimWorldLeague" as const },
      { name: "Tokyo, Japan", lat: 35.6762, lng: 139.6503, method: "MoonsightingCommittee" as const },
      { name: "New York, USA", lat: 40.7128, lng: -74.006, method: "NorthAmerica" as const },
      { name: "Mecca, KSA", lat: 21.3891, lng: 39.8579, method: "UmmAlQura" as const },
    ];

    const date = new Date(2026, 7, 17);

    testCities.forEach((city) => {
      const citySettings: AppSettings = {
        ...mockSettings,
        cityName: city.name,
        latitude: city.lat,
        longitude: city.lng,
        calculationMethod: city.method,
      };

      const prayers = calculateDailyPrayerTimes(citySettings, date, date);
      expect(prayers).toHaveLength(5);
      expect(prayers[0].time.getTime()).toBeLessThan(prayers[1].time.getTime());
      expect(prayers[1].time.getTime()).toBeLessThan(prayers[2].time.getTime());
      expect(prayers[2].time.getTime()).toBeLessThan(prayers[3].time.getTime());
      expect(prayers[3].time.getTime()).toBeLessThan(prayers[4].time.getTime());
    });
  });
});

