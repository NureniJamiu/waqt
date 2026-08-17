# Agent Steering Guidelines: Salah Guard

This document serves as the primary steering guide for AI agents and developers working on **Salah Guard**. All code modifications, refactorings, and feature implementations MUST strictly adhere to the guidelines and architectural decisions detailed below.

---

## 1. Core Philosophy & Non-Negotiable Rules

Salah Guard is a **personal accountability desktop app**, NOT a surveillance or enforcement tool.

1. **Honor System Only**: The app cannot verify whether a user actually prayed, and it MUST NOT pretend to. No camera use, no pose detection, no keylogging, no OS-level input blocking, no kernel-level lock screens.
2. **Mandatory Emergency Dismiss Hatch**: The full-screen overlay MUST always include an emergency dismiss option that is **immediately clickable at all times** (never disabled by the forced-pause timer). Clicking it presents a single confirmation prompt and logs the event as `emergency_dismissed`. This guarantees the app can NEVER trap the user during a real emergency.
3. **Forced Pause Friction**: During the forced pause (default 7 minutes, configurable 1–20 minutes), the "I've prayed" confirmation button is visually present but **disabled/greyed out**. It becomes enabled only after the forced pause timer reaches zero.
4. **Offline First (Zero Runtime API Dependency)**: Prayer times are calculated client-side using `adhan-js` (or Rust equivalent) based on stored coordinates, calculation method, and Asr school. The app MUST function 100% offline without requiring internet access.
5. **Privacy First**: All settings and prayer logs are stored strictly locally in a JSON file (`~/Library/Application Support/salah-guard/store.json` on macOS). No analytics, no cloud sync, no tracking, no multi-user accounts.

---

## 2. Technical Stack Architecture

- **Framework**: Tauri v2 (Rust backend + Webview frontend). Chosen for tiny memory footprint and native multi-monitor window management.
- **Frontend**: React 18 + TypeScript + Vite.
- **Styling**: Tailwind CSS (sleek dark aesthetic, smooth micro-animations, glassmorphism).
- **Calculation Library**: `adhan` (npm package).
- **State & Storage**: Tauri Store (`tauri-plugin-store`) saving local JSON.
- **Notifications**: Tauri Notification plugin (`tauri-plugin-notification`).
- **Autostart**: Tauri Autostart plugin (`tauri-plugin-autostart`).
- **Background Scheduler**: Rust Tokio interval loop in `src-tauri` running continuously in the background, ensuring schedule enforcement even when the webview dashboard window is closed/minimized.

---

## 3. Architecture & Code Boundaries

```
salah-guard/
├── AGENTS.md                  # This steering document
├── TASKS.md                   # Phased task tracking breakdown
├── PRD.md                     # Product Requirements Document
├── package.json               # Frontend dependencies & scripts
├── vite.config.ts             # Vite build setup for Tauri
├── src-tauri/                 # Rust Backend (Tauri v2)
│   ├── Cargo.toml             # Crates: tauri, tokio, serde, tauri-plugin-store, etc.
│   ├── tauri.conf.json        # Window specs, plugin permissions
│   └── src/
│       ├── main.rs            # Application entrypoint & Tauri command registry
│       ├── lib.rs             # Core Tauri setup & plugin registrations
│       ├── scheduler.rs       # Tokio interval loop & sleep-wake listener
│       ├── store.rs           # Rust local JSON state management wrapper
│       └── overlay_window.rs  # Multi-monitor borderless overlay spawner
└── src/                       # React Frontend
    ├── main.tsx               # React root renderer
    ├── App.tsx                # App router & window context switcher
    ├── index.css              # Global styles, Tailwind directives, dark theme tokens
    ├── types/                 # TypeScript interfaces (Settings, PrayerLogItem, etc.)
    ├── lib/
    │   ├── adhanCalc.ts       # adhan-js wrapper & calculation utilities
    │   └── store.ts           # Store sync & Tauri invocation wrappers
    └── screens/
        ├── Onboarding/        # First-run setup wizard (Location, Method, Asr School, Pause)
        ├── Dashboard/         # Today's 5 prayer times, live countdown to next prayer
        ├── Settings/          # Location, calculation method, school, sound/snooze options
        ├── Log/               # Prayer log history table (confirmed, emergency, missed)
        ├── CountdownToast/    # 10s bottom-right corner countdown toast
        └── Overlay/           # Full-screen forced-pause lock overlay
```

---

## 4. Key Execution Workflows & Rules

### 4.1 Daily Schedule Calculation & Pre-Notifications
- On launch and at midnight local time, compute prayer times for Fajr, Dhuhr, Asr, Maghrib, and Isha.
- Schedule pre-notifications at **T-30m**, **T-15m**, and **T-5m** before each prayer.
- If app launches mid-window, skip past pre-notifications but still trigger T-0 if the prayer is within its "still fireable" window.

### 4.2 Multi-Monitor Overlay Spawning
- At T-0 (after a 10s countdown toast), Tauri's Rust backend queries connected monitors (`app_handle.available_monitors()`).
- Tauri creates/opens one borderless, always-on-top, fullscreen overlay window per monitor to prevent bypassing the overlay on secondary screens.

### 4.3 Edge Case Constraints
- **`fireableUntil` Window**: Each prayer's window is fireable until the start of the next prayer. If current time is past `fireableUntil` (e.g. laptop opened at 3 PM when Dhuhr was at 1 PM and Asr is 3:30 PM), log as `missed` without popping retroactive overlays.
- **Sleep / Wake Recovery**: Listen to OS wake events. Re-evaluate current time against scheduled prayer times. If a prayer's T-0 passed during sleep and current time is still before `fireableUntil`, trigger the overlay immediately upon wake.
- **Multiple Overlays**: Only ever display one overlay sequence at a time; queue subsequent overlays if necessary.

---

## 5. Local Data Model Standard (`store.json`)

```json
{
  "settings": {
    "latitude": 6.5244,
    "longitude": 3.3792,
    "cityName": "Lagos, Nigeria",
    "calculationMethod": "MuslimWorldLeague",
    "asrSchool": "Standard",
    "forcedPauseSeconds": 420,
    "soundEnabled": true,
    "snoozeEnabled": false,
    "notificationsEnabled": true,
    "launchAtLogin": true,
    "onboardingCompleted": false
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

Status enum values: `confirmed | emergency_dismissed | missed`.

---

## 6. Coding & Quality Standards

1. **Design System**: Use modern dark theme CSS variables, HSL tailored colors, Inter font typography, subtle glassmorphism cards, micro-animations for timers, and clean status badges.
2. **Error Handling**: Gracefully handle missing coordinates, store read/write failures, and notification permission denials.
3. **No Unused Imports / Clean Linting**: Maintain clean, strictly typed TypeScript code and idiomatic Rust code (`clippy` clean).
