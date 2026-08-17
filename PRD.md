# Product Requirements Document: Salah Guard
### A prayer-time accountability desktop app

**Version:** 1.0
**Owner:** Jamiu
**Target platform:** macOS (primary), Windows (stretch)
**Intended reader:** An AI coding agent implementing this from scratch, with no further clarifying questions.

---

## 1. Purpose & Philosophy

Salah Guard is a personal accountability tool, not a surveillance or enforcement tool. It cannot verify that a person actually prayed, and it must not pretend to. Its job is to interrupt work at the right times, apply enough friction that ignoring prayer is harder than doing it, and then get out of the way. There is no camera use, no pose detection, and no punitive logging designed to shame the user. The "lock" is a forced pause, not a technical prison — it must always have a documented emergency escape hatch so the app can never brick productivity during a genuine emergency.

## 2. Goals

- Calculate accurate daily prayer times for the user's location and preferred calculation method.
- Notify the user at T-30, T-15, and T-5 minutes before each of the five daily prayers.
- At prayer time, run a 10→0 second countdown, then present a full-screen, always-on-top overlay.
- The overlay stays up for a **minimum forced-pause duration** (configurable, default 7 minutes) during which the "I've prayed" confirmation button is disabled.
- After the forced pause elapses, the user can dismiss the overlay via an honor-system "I've prayed" button.
- Provide an emergency dismiss option that always works, logged separately, never blocked.
- Persist settings and a simple prayer log locally; no cloud sync, no account system in v1.

## 3. Non-Goals (explicitly out of scope for v1)

- No camera-based or sensor-based prayer detection.
- No OS-level input blocking, keyboard/mouse hooks, or kernel-level lock screens.
- No social features, streaks-as-competition, sharing, or leaderboards.
- No mobile app (desktop only).
- No multi-user accounts.

## 4. Tech Stack

- **Framework:** Tauri v2 (Rust backend + web frontend). Chosen over Electron for smaller footprint and because it does not require broad OS-level accessibility permissions to run a topmost overlay window.
- **Frontend:** React + TypeScript + Vite.
- **Styling:** Tailwind CSS.
- **State/storage:** Local JSON file via Tauri's filesystem API (or `tauri-plugin-store`) — no database needed for v1 given low data volume (settings + prayer log of 5 rows/day).
- **Prayer time calculation:** `adhan-js` npm package (client-side, offline, no network dependency once coordinates are known). Do **not** depend on a live API call at runtime — the app must work with no internet connection.
- **Geolocation:** Manual entry only in v1 (city name → lat/long via a one-time lookup, or direct lat/long input). No continuous location tracking.
- **Notifications:** Tauri's notification plugin (`tauri-plugin-notification`) for OS-native desktop notifications.
- **Background scheduling:** A Rust-side background task (tokio interval loop) inside the Tauri backend, not a JS `setInterval` in the webview, so scheduling survives even if the frontend window is closed/minimized.

## 5. Core User Flows

### 5.1 First-run setup
1. User is prompted to enter location: either "Search city" (resolves to lat/long via a bundled or looked-up geocoding step, done once and cached) or manual lat/long entry.
2. User selects a calculation method from a dropdown: `MuslimWorldLeague`, `Egyptian`, `Karachi`, `UmmAlQura`, `Dubai`, `MoonsightingCommittee`, `NorthAmerica` (ISNA), `Kuwait`, `Qatar`, `Singapore`, `Turkey`, `Tehran`. Default: `MuslimWorldLeague`.
3. User selects Asr calculation school: `Standard` (Shafi/Maliki/Hanbali) or `Hanafi`. Default: `Standard`.
4. User sets forced-pause duration per prayer (default 7 minutes, adjustable 1–20 minutes in Settings).
5. User grants OS notification permission (triggered via the Tauri notification plugin's permission request).
6. Settings are written to local store; setup does not repeat on subsequent launches.

### 5.2 Daily operation
1. On launch (and once daily at midnight local time), the backend computes all five prayer times plus sunrise for the day using `adhan-js`'s `PrayerTimes` class, based on stored coordinates/method/school.
2. For each of the five prayers (Fajr, Dhuhr, Asr, Maghrib, Isha — **not** sunrise, which is not a prayer), the backend schedules:
   - Notification at T-30 min: *"Fajr in 30 minutes"*
   - Notification at T-15 min: *"Fajr in 15 minutes"*
   - Notification at T-5 min: *"Fajr in 5 minutes"*
   - At T-0: trigger the countdown sequence (see 5.3).
3. If the app is launched after a prayer's T-30 mark but before T-0 (e.g., app was closed and reopened), skip missed pre-notifications for that prayer but still fire the T-0 countdown if the current time is still within a "still fireable" window (see 8.3).
4. If the app was closed entirely through T-0, on next launch check whether the missed prayer's overlay should retroactively show (see 8.3 for exact rule) — default behavior: do **not** retroactively lock the user out for a prayer time that has already fully passed; only show a passive "You missed the Fajr window" note in the log.

### 5.3 Countdown → Overlay → Forced pause → Release
1. At T-0, a small non-blocking countdown widget appears (bottom-right corner toast), counting 10 → 0, with the prayer name and a subtle audio chime (optional, toggle in settings).
2. At 0, a full-screen, always-on-top, borderless window opens covering the entire primary display (see 8.1 for multi-monitor behavior). This is the "overlay."
3. Overlay content:
   - Prayer name and current time.
   - A calm, non-shaming message, e.g., *"It's time for Dhuhr."*
   - A visible countdown/progress indicator showing time remaining in the forced pause (e.g., "6:42 remaining").
   - An "I've prayed" button — **visually present but disabled/greyed out** until the forced-pause timer reaches zero.
   - A small, always-clickable "Emergency dismiss" link/button in a corner (see 5.4).
4. Once the forced-pause timer hits zero, the "I've prayed" button becomes enabled (visual state change — color shift, no longer greyed out).
5. User clicks "I've prayed" → overlay closes, event is written to the local prayer log with timestamp and prayer name, status `confirmed`.

### 5.4 Emergency dismiss
- Always clickable, never subject to the forced-pause timer.
- On click, show a single confirmation step: *"Dismiss without confirming prayer? This will be logged."* → Yes/No.
- On "Yes": overlay closes immediately, log entry written with status `emergency_dismissed` and a timestamp. No further friction, no guilt copy, no follow-up nag.
- This exists specifically so the app can never trap the user during a real emergency (video call, urgent deploy, etc.). This is a hard product requirement, not optional.

### 5.5 Snooze (optional, off by default)
- If enabled in settings, a "Snooze 5 min" button may appear on the overlay *before* the forced pause begins, capped at 1 use per prayer, disabled entirely if the user disables it in settings. This is a concession to real-world usability, not a way to indefinitely dodge the overlay. Default: disabled — user should opt in deliberately.

## 6. Screens / UI Inventory

| Screen | Purpose |
|---|---|
| Onboarding — Location | City/coords entry |
| Onboarding — Method | Calculation method + Asr school dropdowns |
| Onboarding — Pause duration | Slider/input, 1–20 min, default 7 |
| Main window (dashboard) | Today's five prayer times, countdown to next prayer, toggle app on/off, link to Settings and Log |
| Settings | Location, method, school, pause duration, sound toggle, snooze toggle, notification toggle, launch-at-login toggle |
| Prayer Log | Table of past prayers: date, prayer name, status (`confirmed` / `emergency_dismissed` / `missed`), timestamp |
| Countdown toast | Small corner widget, 10→0 |
| Overlay (lock screen) | Full-screen forced-pause screen, per 5.3 |

## 7. Data Model

Local JSON store, e.g. `~/Library/Application Support/salah-guard/store.json` (macOS path via Tauri's app data dir API):

```json
{
  "settings": {
    "latitude": 6.5244,
    "longitude": 3.3792,
    "calculationMethod": "MuslimWorldLeague",
    "asrSchool": "Standard",
    "forcedPauseSeconds": 420,
    "soundEnabled": true,
    "snoozeEnabled": false,
    "notificationsEnabled": true,
    "launchAtLogin": true
  },
  "log": [
    {
      "date": "2026-08-17",
      "prayer": "Dhuhr",
      "scheduledTime": "2026-08-17T13:02:00+01:00",
      "status": "confirmed",
      "confirmedAt": "2026-08-17T13:09:14+01:00"
    }
  ]
}
```

Status enum: `confirmed | emergency_dismissed | missed`.

## 8. Edge Cases & Required Handling

### 8.1 Multi-monitor
Overlay must cover **all** connected displays (spawn one borderless always-on-top window per display), not just the primary one — otherwise the user can simply work on a second monitor and defeat the purpose.

### 8.2 Sleep/wake
If the laptop is asleep when a T-0 moment passes, the countdown/overlay should trigger immediately on wake **if** the prayer's overlay window has not yet fully elapsed (current time is before that prayer's `scheduledTime + reasonableWindow`, see 8.3). Use OS wake events (Tauri exposes window/app lifecycle events) to re-check schedule state after wake, don't rely solely on pre-scheduled timers which may not fire correctly across sleep.

### 8.3 "Still fireable" window
Each prayer has a natural end boundary (next prayer's start, or a hard cap — e.g., Isha's window extends until midnight or Fajr, whichever the calculation library defines). Define a per-prayer `fireableUntil` = the start of the *next* prayer time. If current time is past `fireableUntil` when the app checks, mark that prayer `missed` in the log and do not show the overlay retroactively. This prevents a stacked pile of overlays if the laptop was off all day.

### 8.4 Multiple overlays queued
If somehow two prayers' T-0 moments are both pending (should not happen given real prayer spacing, but guard anyway), only ever show one overlay at a time, queue the next.

### 8.5 App not running at all
If the Tauri app process isn't running, no notifications or overlays can fire — this is expected and acceptable for v1 (no OS-level daemon). Document this limitation clearly to the user in onboarding: *"Salah Guard needs to be running in the background to work — enable 'Launch at login' in Settings."*

### 8.6 Timezone/DST changes and travel
Recompute prayer times fresh at each local midnight using the device's current timezone, not a cached timezone from onboarding — this handles both DST shifts and the user traveling with the laptop.

### 8.7 Force-quit / crash
If the user force-quits the app to bypass the overlay (macOS Force Quit, Task Manager), this is possible and cannot be fully prevented without OS-level privilege escalation, which is explicitly out of scope (see Non-Goals). Log this as a gap in documentation, not as something to engineer around. If the app relaunches later that day, do not aggressively re-show a missed overlay — respect the `fireableUntil` rule in 8.3.

## 9. Non-Functional Requirements

- App must function fully offline once initial coordinates are set (no runtime dependency on a prayer-times API).
- Overlay render must be near-instant (<300ms) at T-0; no jank.
- Memory footprint should stay low since this runs continuously in the background all day — Tauri's Rust backend is well suited here versus Electron.
- No telemetry, no analytics, no external network calls beyond the one-time optional geocoding lookup during onboarding.

## 10. Suggested File/Module Structure

```
salah-guard/
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── scheduler.rs        # tokio interval loop, computes + tracks next fire times
│   │   ├── prayer_times.rs     # wraps adhan calc logic (or calls into JS via command)
│   │   ├── store.rs            # local JSON read/write
│   │   └── overlay_window.rs   # spawns overlay window(s) across displays
│   └── tauri.conf.json
├── src/                        # React frontend
│   ├── screens/
│   │   ├── Onboarding/
│   │   ├── Dashboard/
│   │   ├── Settings/
│   │   ├── Log/
│   │   ├── CountdownToast/
│   │   └── Overlay/
│   ├── lib/
│   │   └── adhanCalc.ts        # adhan-js wrapper
│   └── App.tsx
└── package.json
```

## 11. MVP Cut Line

If time-boxing is needed, the true MVP is: onboarding (location + method) → daily schedule computed on launch → three pre-notifications → countdown → single-display overlay with forced pause and emergency dismiss → local log. Multi-monitor support, snooze, and launch-at-login can be v1.1.

## 12. Open Decisions Left to the Builder

These are implementation details not prescribed above, left to engineering judgment: exact visual design of the overlay, choice of geocoding service for city lookup (if any — manual lat/long entry alone is an acceptable MVP substitute), and whether prayer log data should ever be exportable (not required for v1).