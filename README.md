# Salah Guard (waqt) 🕌

[![Tauri v2](https://img.shields.io/badge/Tauri-v2.2-blue?logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-2021-orange?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-v18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Salah Guard** is a minimalist, privacy-first personal accountability desktop application designed to interrupt work smoothly at prayer times, enforce a brief forced pause, and foster consistent prayer habits without trapping the user.

---

## 🌟 Overview & Philosophy

Salah Guard operates on a simple principle: **personal accountability, not surveillance or punishment**. 

* **Honor System Only**: The application does not monitor your camera, log keypresses, block system inputs, or act as a OS-level lock screen.
* **Forced Pause Friction**: At prayer time, a full-screen overlay appears with a configurable forced pause duration (default 7 minutes). During this window, the *"I've prayed"* confirmation button is present but disabled, giving you space to disengage from your computer screen.
* **Mandatory Emergency Escape Hatch**: The overlay features an always-accessible emergency dismiss option. Clicking it presents a simple prompt and logs the event as `emergency_dismissed`, ensuring you are never locked out during urgent situations.
* **100% Offline & Private**: All prayer times are calculated client-side using `adhan-js` based on your coordinates and preferred calculation method. All settings and history logs remain strictly local on your device (`~/Library/Application Support/salah-guard/store.json`). Zero cloud telemetry, tracking, or network calls.

---

## ✨ Features

- **Offline Prayer Calculations**: Accurately computes Fajr, Dhuhr, Asr, Maghrib, and Isha times locally across major calculation methods (MWL, ISNA, Umm Al-Qura, Egyptian, Karachi, etc.) and Asr schools (Standard / Hanafi).
- **Pre-Prayer Notifications**: Timely desktop reminders delivered at **T-30m**, **T-15m**, and **T-5m** before each prayer time.
- **10-Second Countdown Toast**: Non-intrusive corner toast notifying you 10 seconds before the overlay activates.
- **Multi-Monitor Overlay**: Full-screen, always-on-top overlay spawned across all connected displays to maintain focus.
- **Sleep & Wake Recovery**: Automatically evaluates OS wake events to seamlessly trigger or skip overlays based on the prayer's fireable time window.
- **Local Accountability Log**: View past prayer history with detailed status breakdown (`confirmed`, `emergency_dismissed`, `missed`).
- **Autostart & Background Daemon**: Managed by a Rust Tokio interval loop running continuously in the background even when the dashboard window is closed.

---

## 🛠 Tech Stack

- **Desktop Framework**: [Tauri v2](https://tauri.app/) (Rust backend + Webview frontend)
- **Frontend UI**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS (Dark aesthetic, modern glassmorphism, micro-animations)
- **Calculation Library**: `adhan` (npm package)
- **State & Storage**: Tauri Store (`tauri-plugin-store`) saving local JSON
- **OS Integrations**: `tauri-plugin-notification`, `tauri-plugin-autostart`
- **Background Scheduler**: Tokio interval loop in Rust (`src-tauri`)

---

## 📁 Repository Structure

```
salah-guard/
├── AGENTS.md                  # Developer & AI agent steering guidelines
├── PRD.md                     # Product Requirements Document
├── TASKS.md                   # Feature implementation roadmap
├── package.json               # Node.js dependencies & frontend scripts
├── vite.config.ts             # Vite build configuration for Tauri
├── src-tauri/                 # Rust Backend (Tauri v2)
│   ├── Cargo.toml             # Rust dependencies (tauri, tokio, serde, etc.)
│   ├── tauri.conf.json        # Tauri app configuration & window settings
│   └── src/
│       ├── main.rs            # Rust entrypoint & Tauri command registration
│       ├── lib.rs             # Tauri setup & plugin initializations
│       ├── scheduler.rs       # Tokio background interval & OS wake listener
│       ├── store.rs           # Local JSON state management wrapper
│       └── overlay_window.rs  # Multi-monitor borderless overlay spawner
└── src/                       # React Frontend
    ├── main.tsx               # React application root
    ├── App.tsx                # Context router & view switcher
    ├── index.css              # Global design tokens, Tailwind directives & dark theme
    ├── types/                 # TypeScript type definitions
    ├── lib/
    │   ├── adhanCalc.ts       # adhan-js wrapper & date/time helpers
    │   └── store.ts           # Tauri store synchronization wrapper
    └── screens/
        ├── Onboarding/        # Initial setup wizard (Location, Method, Asr School, Pause)
        ├── Dashboard/         # Today's 5 prayer times & live countdown
        ├── Settings/          # User preferences & calculation configuration
        ├── Log/               # Prayer log history table
        ├── CountdownToast/    # 10s bottom-right countdown toast
        └── Overlay/           # Full-screen forced-pause lock overlay
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your system:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable toolchain)
- Platform build essentials:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `build-essential`, `libssl-dev`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`
  - **Windows**: C++ Build Tools or Visual Studio

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/NureniJamiu/waqt.git
   cd waqt
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Run in Development Mode:**
   ```bash
   npm run tauri dev
   ```
   This will start the Vite dev server and launch the Tauri desktop application with hot-reloading.

4. **Build for Production:**
   ```bash
   npm run tauri build
   ```
   The compiled executable and installer bundles will be generated in `src-tauri/target/release/bundle/`.

---

## 🔒 Data & Privacy Model

Salah Guard stores all configuration settings and logs in a single local JSON file (`~/Library/Application Support/salah-guard/store.json` on macOS).

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

*Status Enum Values:* `confirmed` | `emergency_dismissed` | `missed`

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
