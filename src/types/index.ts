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

export type SoundOption = "chime" | "takbeer";

export interface AppSettings {
  latitude: number;
  longitude: number;
  cityName: string;
  calculationMethod: CalculationMethodName;
  asrSchool: AsrSchool;
  forcedPauseSeconds: number; // default 900 (15 mins)
  preLockMinutes: number; // default 10 mins (lock offset before prayer)
  soundEnabled: boolean;
  soundOption?: SoundOption; // default "chime"
  snoozeEnabled: boolean;
  notificationsEnabled: boolean;
  launchAtLogin: boolean;
  onboardingCompleted: boolean;
  demoModeEnabled?: boolean;
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
  lockTime: Date;
  formattedTime: string;
  formattedLockTime: string;
  isNext: boolean;
  isPassed: boolean;
  fireableUntil: Date;
}

/**
 * Result of the backend's "clear the desktop before the overlay appears" sweep,
 * emitted on `waqt:desktop-prep`.
 *
 * Mirrors `DesktopPrepOutcome` in `src-tauri/src/overlay_window.rs`, which
 * serialises with `#[serde(tag = "status", rename_all = "snake_case")]`. The
 * backend suppresses `skipped`, but it is part of the enum.
 */
export type DesktopPrepOutcome =
  | { status: "skipped" }
  | { status: "permission_denied" }
  | { status: "timed_out" }
  | { status: "failed"; message: string }
  | { status: "completed"; windows: number };

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
