# Project Task Tracking: Salah Guard

This document outlines the detailed breakdown of tasks for implementing **Salah Guard**. Track progress by checking off tasks (`[x]`) as they are completed and verified.

---

## Phase 1: Environment & Project Scaffolding
- [x] Create project steering document (`AGENTS.md`)
- [x] Create project task tracking outline (`TASKS.md`)
- [x] Initialize `package.json` with React 18, TypeScript, Vite, Tailwind CSS, `adhan`, `@tauri-apps/api`, and Lucide icons
- [x] Configure `vite.config.ts` and `tsconfig.json` for Tauri frontend
- [x] Configure `src/index.css` with Tailwind directives and dark theme design tokens
- [x] Initialize `src-tauri` Cargo package (`Cargo.toml`) with Tauri v2 plugins (`store`, `notification`, `autostart`, `serde`, `tokio`)
- [x] Configure `tauri.conf.json` with multi-window capabilities, permissions, and app identity

## Phase 2: Core Data Engine & Calculation Utilities
- [ ] Implement TypeScript interfaces in `src/types/index.ts` (`AppSettings`, `PrayerLogItem`, `PrayerTime`, `PrayerStatus`)
- [ ] Build `src/lib/adhanCalc.ts` wrapper around `adhan-js` for calculation method mapping, Asr school, and daily 5-prayer generation
- [ ] Build `src/lib/store.ts` for Tauri Store integration with local JSON persistence (`store.json`)
- [ ] Write unit tests / verification for prayer time calculations against reference coordinates

## Phase 3: Tauri Backend & Rust Service Layer
- [ ] Implement `src-tauri/src/store.rs` for Rust-side settings & log reading
- [ ] Implement `src-tauri/src/overlay_window.rs` for multi-monitor display detection & borderless overlay window spawner
- [ ] Implement `src-tauri/src/scheduler.rs` tokio background interval loop for schedule tracking, sleep-wake handling, and pre-notifications
- [ ] Expose Tauri IPC commands in `src-tauri/src/main.rs` / `lib.rs` (`get_settings`, `save_settings`, `trigger_overlay`, `get_logs`, `add_log_entry`)

## Phase 4: Frontend UI Screens & Components
- [ ] **Onboarding Screen (`src/screens/Onboarding/`)**
  - [ ] Step 1: Location selection (City search / manual Lat/Long input)
  - [ ] Step 2: Calculation method & Asr school dropdowns
  - [ ] Step 3: Forced pause duration slider (1–20 min, default 7 min) & Notification permission prompt
- [ ] **Main Dashboard (`src/screens/Dashboard/`)**
  - [ ] Today's 5 prayer cards with highlight on upcoming prayer
  - [ ] Live countdown widget to next prayer
  - [ ] Quick toggles (App pause, notifications) & navigation links to Settings / Log
- [ ] **Settings Screen (`src/screens/Settings/`)**
  - [ ] Edit Location, Calculation Method, Asr School
  - [ ] Forced pause duration slider
  - [ ] Toggles for Sound, Snooze, Notifications, Launch at login
- [ ] **Prayer Log Screen (`src/screens/Log/`)**
  - [ ] Table of recorded prayers (`Date`, `Prayer`, `Scheduled Time`, `Status`, `Confirmed At`)
  - [ ] Status badges (`confirmed` in green, `emergency_dismissed` in amber, `missed` in muted red)
  - [ ] Filter / Summary stats (e.g. Total confirmed, Emergency count)
- [ ] **Countdown Toast (`src/screens/CountdownToast/`)**
  - [ ] Toast window rendering 10→0 second countdown at T-0 with prayer name & subtle audio chime
- [ ] **Overlay Lock Screen (`src/screens/Overlay/`)**
  - [ ] Full-screen always-on-top layout across monitors
  - [ ] Prayer name, current time, calm non-shaming message
  - [ ] Remaining forced pause countdown ring / progress bar
  - [ ] "I've prayed" button — visually greyed out & disabled until pause timer reaches zero
  - [ ] Always-clickable "Emergency Dismiss" button in corner with confirmation modal (*"Dismiss without confirming prayer? This will be logged."*)

## Phase 5: Edge Case Handling & Integration
- [ ] Implement `fireableUntil` window rule (suppress stacked retroactive overlays if prayer window elapsed)
- [ ] Implement multi-monitor overlay test & fallback
- [ ] Implement sleep/wake re-evaluation handler
- [ ] Implement Snooze (5 min cap, max 1 use per prayer if enabled)
- [ ] Implement Launch at login toggle via Tauri autostart plugin

## Phase 6: Testing, Polish & Build
- [ ] Verify offline functionality (disconnect network, calculate times)
- [ ] Perform visual regression & UI polish (smooth transitions, glassmorphism design)
- [ ] Execute build checks (`npm run build` and `cargo check`)
- [ ] Generate final release artifact walkthrough (`walkthrough.md`)
