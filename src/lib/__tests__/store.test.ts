import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  loadSettingsFromStorage,
  saveSettingsToStorage,
  loadLogsFromStorage,
  addLogEntryToStorage,
  addLogEntry,
  clearLogsFromStorage,
  subscribeLogUpdated,
} from "../store";
import { AppSettings, PrayerLogItem } from "../../types";

// In-memory mock for localStorage in node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("store.ts Persistence Layer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should return DEFAULT_SETTINGS when storage is empty", () => {
    const settings = loadSettingsFromStorage();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("should save and load updated settings", () => {
    const customSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      cityName: "London, UK",
      latitude: 51.5074,
      longitude: -0.1278,
      forcedPauseSeconds: 600,
    };

    saveSettingsToStorage(customSettings);
    const loaded = loadSettingsFromStorage();
    expect(loaded.cityName).toBe("London, UK");
    expect(loaded.latitude).toBe(51.5074);
    expect(loaded.forcedPauseSeconds).toBe(600);
  });

  it("should start with empty logs and add entries", () => {
    expect(loadLogsFromStorage()).toEqual([]);

    const log1: PrayerLogItem = {
      id: "log-1",
      date: "2026-08-17",
      prayer: "Dhuhr",
      scheduledTime: "2026-08-17T13:02:00+01:00",
      status: "confirmed",
      confirmedAt: "2026-08-17T13:09:14+01:00",
    };

    const updated = addLogEntryToStorage(log1);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toEqual(log1);

    const log2: PrayerLogItem = {
      id: "log-2",
      date: "2026-08-17",
      prayer: "Asr",
      scheduledTime: "2026-08-17T16:15:00+01:00",
      status: "emergency_dismissed",
    };

    const updated2 = addLogEntryToStorage(log2);
    expect(updated2).toHaveLength(2);
    expect(updated2[0].id).toBe("log-2"); // Newest first
  });

  it("should notify log listeners when addLogEntry is called", async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeLogUpdated(callback);

    const log: PrayerLogItem = {
      id: "log-async-1",
      date: "2026-08-19",
      prayer: "Maghrib",
      scheduledTime: "2026-08-19T19:00:00+01:00",
      status: "confirmed",
    };

    await addLogEntry(log);

    expect(loadLogsFromStorage()).toHaveLength(1);
    expect(callback).toHaveBeenCalled();

    unsubscribe();
  });

  it("should clear logs when requested", () => {
    const log: PrayerLogItem = {
      id: "log-1",
      date: "2026-08-17",
      prayer: "Fajr",
      scheduledTime: "2026-08-17T05:30:00+01:00",
      status: "confirmed",
    };

    addLogEntryToStorage(log);
    expect(loadLogsFromStorage()).toHaveLength(1);

    clearLogsFromStorage();
    expect(loadLogsFromStorage()).toEqual([]);
  });

  it("should generate and seed realistic demo logs", async () => {
    const { generateDemoLogs, seedDemoLogs } = await import("../store");
    const demoLogs = generateDemoLogs();
    expect(demoLogs.length).toBeGreaterThan(10);
    expect(demoLogs.some((l) => l.status === "confirmed")).toBe(true);
    expect(demoLogs.some((l) => l.status === "emergency_dismissed")).toBe(true);
    expect(demoLogs.some((l) => l.status === "missed")).toBe(true);

    const seeded = await seedDemoLogs();
    expect(seeded.length).toEqual(demoLogs.length);
    expect(loadLogsFromStorage().length).toEqual(demoLogs.length);
  });
});
