import {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
  Madhab,
} from "adhan";
import { AppSettings, CalculationMethodName, PrayerName, PrayerTime } from "../types";

export function getCalculationMethodParams(methodName: CalculationMethodName): any {
  switch (methodName) {
    case "Egyptian":
      return CalculationMethod.Egyptian();
    case "Karachi":
      return CalculationMethod.Karachi();
    case "UmmAlQura":
      return CalculationMethod.UmmAlQura();
    case "Dubai":
      return CalculationMethod.Dubai();
    case "MoonsightingCommittee":
      return CalculationMethod.MoonsightingCommittee();
    case "NorthAmerica":
      return CalculationMethod.NorthAmerica();
    case "Kuwait":
      return CalculationMethod.Kuwait();
    case "Qatar":
      return CalculationMethod.Qatar();
    case "Singapore":
      return CalculationMethod.Singapore();
    case "Turkey":
    case "Tehran":
    case "MuslimWorldLeague":
    default:
      return CalculationMethod.MuslimWorldLeague();
  }
}

export function formatTime(date: Date, is24Hour: boolean = false): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: !is24Hour,
  });
}

export function calculateDailyPrayerTimes(
  settings: AppSettings,
  targetDate: Date = new Date(),
  referenceTime: Date = new Date()
): PrayerTime[] {
  const lat = isNaN(Number(settings?.latitude)) ? 0 : Number(settings.latitude);
  const lng = isNaN(Number(settings?.longitude)) ? 0 : Number(settings.longitude);
  const coordinates = new Coordinates(lat, lng);
  const params = getCalculationMethodParams(settings?.calculationMethod || "MuslimWorldLeague");

  if (settings?.asrSchool === "Hanafi") {
    params.madhab = Madhab.Hanafi;
  } else {
    params.madhab = Madhab.Shafi;
  }

  const prayerTimes = new PrayerTimes(coordinates, targetDate, params);

  // Tomorrow's Fajr for Isha's fireableUntil boundary
  const tomorrow = new Date(targetDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowPrayerTimes = new PrayerTimes(coordinates, tomorrow, params);

  const rawList: { name: PrayerName; time: Date; nextTime: Date }[] = [
    { name: "Fajr", time: prayerTimes.fajr, nextTime: prayerTimes.dhuhr },
    { name: "Dhuhr", time: prayerTimes.dhuhr, nextTime: prayerTimes.asr },
    { name: "Asr", time: prayerTimes.asr, nextTime: prayerTimes.maghrib },
    { name: "Maghrib", time: prayerTimes.maghrib, nextTime: prayerTimes.isha },
    { name: "Isha", time: prayerTimes.isha, nextTime: tomorrowPrayerTimes.fajr },
  ];

  let nextFound = false;

  return rawList.map((item) => {
    const isPassed = referenceTime > item.time;
    let isNext = false;
    if (!isPassed && !nextFound) {
      isNext = true;
      nextFound = true;
    }

    return {
      name: item.name,
      time: item.time,
      formattedTime: formatTime(item.time),
      isNext,
      isPassed,
      fireableUntil: item.nextTime,
    };
  });
}

export function getPrayerTimeByDateAndName(
  settings: AppSettings,
  date: Date,
  prayerName: PrayerName
): Date | null {
  const daily = calculateDailyPrayerTimes(settings, date, date);
  const found = daily.find((p) => p.name === prayerName);
  return found ? found.time : null;
}

export function getFireableWindow(
  settings: AppSettings,
  date: Date,
  prayerName: PrayerName
): { startTime: Date; fireableUntil: Date } | null {
  const daily = calculateDailyPrayerTimes(settings, date, date);
  const found = daily.find((p) => p.name === prayerName);
  if (!found) return null;
  return {
    startTime: found.time,
    fireableUntil: found.fireableUntil,
  };
}
