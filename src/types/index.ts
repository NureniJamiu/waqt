export type CalculationMethodName =
  | "MuslimWorldLeague"
  | "Egyptian"
  | "Karachi"
  | "UmmAlQura"
  | "Dubai"
  | "MoonsightingCommittee"
  | "NorthAmerica"
  | "Kuwait"
  | "Qatar"
  | "Singapore"
  | "Turkey"
  | "Tehran";

export type AsrSchool = "Standard" | "Hanafi";

export interface AppSettings {
  latitude: number;
  longitude: number;
  cityName: string;
  calculationMethod: CalculationMethodName;
  asrSchool: AsrSchool;
  forcedPauseSeconds: number; // default 420 (7 mins)
  soundEnabled: boolean;
  snoozeEnabled: boolean;
  notificationsEnabled: boolean;
  launchAtLogin: boolean;
  onboardingCompleted: boolean;
}

export type PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export type PrayerStatus = "confirmed" | "emergency_dismissed" | "missed";

export interface PrayerLogItem {
  id: string;
  date: string; // YYYY-MM-DD
  prayer: PrayerName;
  scheduledTime: string; // ISO 8601 string
  status: PrayerStatus;
  confirmedAt?: string; // ISO 8601 string
}

export interface PrayerTime {
  name: PrayerName;
  time: Date;
  formattedTime: string;
  isNext: boolean;
  isPassed: boolean;
  fireableUntil: Date;
}

export interface EmergencyExtension {
  id: string;
  date: string;
  prayer: PrayerName;
  dismissedAt: string;
  expiresAt: string;
  notified15m?: boolean;
  notified10m?: boolean;
  notified5m?: boolean;
  relocked?: boolean;
}
