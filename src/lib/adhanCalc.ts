import {
  Coordinates,
  CalculationMethod,
  CalculationParameters,
  PrayerTimes,
  Madhab,
} from "adhan";
import { AppSettings, PrayerName, PrayerTime } from "../types";

export function getCalculationMethodParams(methodName: string): CalculationParameters {
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
      return CalculationMethod.Turkey();
    case "Tehran":
      return CalculationMethod.Tehran();
    case "MuslimWorldLeague":
    default:
      return CalculationMethod.MuslimWorldLeague();
  }
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function calculateDailyPrayerTimes(settings: AppSettings, targetDate: Date = new Date()): PrayerTime[] {
  const coordinates = new Coordinates(settings.latitude, settings.longitude);
  const params = getCalculationMethodParams(settings.calculationMethod);

  if (settings.asrSchool === "Hanafi") {
    params.madhab = Madhab.Hanafi;
  } else {
    params.madhab = Madhab.Shafi;
  }

  const prayerTimes = new PrayerTimes(coordinates, targetDate, params);
  const now = new Date();

  // Next day prayer times for Fajr fireableUntil boundary calculation
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
    const isPassed = now > item.time;
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
