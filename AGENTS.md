# Agent Steering Guidelines: Waqt

This document is the primary steering guide for AI agents and developers working
on **Waqt**. All code modifications, refactorings, and feature implementations
MUST strictly adhere to the guidelines and architectural decisions below.

**Maintenance rule:** this file describes what the code *does*, except where a
section is explicitly marked as a requirement the code does not yet meet. If you
change behavior described here, update this file in the same change. If you find
a divergence you are not fixing, record it under §8 rather than leaving the
description silently wrong.

Open work is tracked in `HANDOFF.md`.

---

## 1. Core Philosophy & Non-Negotiable Rules

Waqt is a **personal accountability desktop app**, NOT a surveillance or
enforcement tool.

1. **Honor System Only**: The app cannot verify whether a user actually prayed,
   and it MUST NOT pretend to. No camera use, no pose detection, no keylogging,
   no OS-level input blocking, no kernel-level lock screens.

2. **Mandatory Emergency Dismiss Hatch, once per prayer**: The full-screen
   overlay MUST include an emergency dismiss option that is **immediately
   clickable at all times** (never disabled by the forced-pause timer) *for the
   first overlay shown for a given prayer*. Clicking it presents a single
   confirmation prompt, grants a 30-minute grace period, and logs the event as
   `emergency_dismissed`.

   That hatch is **intentionally single-use per prayer**: once the grace period
   elapses and the overlay re-locks, `isEmergencyExhausted` is true and
   `src/screens/Overlay/Overlay.tsx` disables the dismiss button and the
   confirmation modal for that prayer's re-lock overlay — this is by design, not
   a bug. A second unconditional hatch would make the 30-minute grace period
   optional in practice, since re-triggering it forever is indistinguishable
   from never having a lock at all.

   This is a narrower guarantee than "never trap the user" in the abstract: it
   trades that for "there is still a way out, even if the app doesn't hand it
   to you." **macOS's system-level Force Quit** (⌘⌥Esc → Force Quit
   Applications, or Activity Monitor) still works on the re-lock overlay. That
   shortcut is intercepted by WindowServer before the keystroke reaches any
   app's webview, so it is unaffected by the overlay's key-blocking
   interceptor, its `closable(false)` / `minimizable(false)` window flags, or
   its `CGShieldingWindowLevel` placement (`overlay_window.rs`). This is the
   documented answer to "what does a user in a genuine emergency do on the
   re-lock overlay," and the re-lock overlay's own copy names it too
   (`src/screens/Overlay/Overlay.tsx`, the `isEmergencyExhausted` branch).

3. **Forced Pause Friction**: During the forced pause (default **15 minutes /
   900 seconds**, configurable 1–20 minutes in Settings), the "I've prayed"
   confirmation button is visually present but **disabled/greyed out**. It
   becomes enabled only after the forced pause timer reaches zero.

4. **Offline First (Zero Runtime API Dependency)**: Prayer times are calculated
   client-side from stored coordinates, calculation method, and Asr school. The
   app MUST function 100% offline. Note that this is calculated **twice** — see
   §2.

5. **Privacy First**: All settings and prayer logs are stored strictly locally in
   a single JSON file. On macOS this resolves via Tauri's `app_config_dir()` to
   `~/Library/Application Support/com.waqt.desktop/store.json` (the bundle
   identifier, not the product name). No analytics, no cloud sync, no tracking,
   no multi-user accounts.

---

## 2. Technical Stack Architecture

- **Framework**: Tauri v2 (Rust backend + Webview frontend). Chosen for tiny
  memory footprint and native multi-monitor window management.
- **Frontend**: React 18 + TypeScript + Vite.
- **Styling**: Tailwind CSS (sleek dark aesthetic, smooth micro-animations,
  glassmorphism).
- **Prayer-time calculation**: **two independent implementations.**
  - `src/lib/adhanCalc.ts` wraps the `adhan` npm package and drives everything
    the user sees (Dashboard countdown, Settings preview, Log).
  - `src-tauri/src/prayer_calc.rs` is a Rust implementation that drives the
    background scheduler — the notifications, the toast, and the overlay.

  **These must agree.** A change to method handling, Asr school, or the
  high-latitude rule in one is a bug unless it is mirrored in the other. The
  scheduler is the side that actually locks the screen, so a divergence shows up
  as an overlay firing at the wrong time while the Dashboard looks correct.
- **State & Storage**: Local JSON via `src-tauri/src/store.rs`
  (`tauri-plugin-store` is registered but the log and settings go through
  `StoreManager`).
- **Notifications**: Tauri Notification plugin (`tauri-plugin-notification`).
- **Autostart**: Tauri Autostart plugin (`tauri-plugin-autostart`).
- **Updater**: `tauri-plugin-updater`. **Currently non-functional** — see §8.
- **Background Scheduler**: Rust Tokio loop on a 10-second tick in `src-tauri`,
  running continuously so enforcement survives the dashboard being closed.

---

## 3. Architecture & Code Boundaries

```
waqt/
├── AGENTS.md                  # This steering document
├── HANDOFF.md                 # Open work / known issues
├── README.md
├── package.json
├── vite.config.ts
├── src-tauri/                 # Rust Backend (Tauri v2)
│   ├── Cargo.toml
│   ├── tauri.conf.json        # Window specs, bundle + plugin config
│   ├── Info.plist             # Merged into the bundle: Apple Events usage string
│   ├── Entitlements.plist     # Apple Events entitlement for hardened runtime
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs            # Thin entrypoint -> lib::run()
│       ├── lib.rs             # Tauri setup, tray, command registry
│       ├── scheduler.rs       # Tokio tick loop, notifications, missed-marking
│       ├── prayer_calc.rs     # Rust prayer-time calculation (scheduler side)
│       ├── store.rs           # Local JSON state, log merge policy
│       └── overlay_window.rs  # Multi-monitor overlay + macOS desktop sweep
└── src/                       # React Frontend
    ├── main.tsx
    ├── App.tsx                # Router / window-context switcher
    ├── index.css
    ├── types/index.ts
    ├── lib/
    │   ├── adhanCalc.ts       # adhan-js wrapper (UI side)
    │   ├── sound.ts
    │   ├── store.ts           # Tauri invoke wrappers + event subscriptions
    │   └── __tests__/
    └── screens/
        ├── Onboarding/        # First-run setup wizard
        ├── Dashboard/         # Today's 5 prayer times, live countdown
        ├── Settings/          # Location, method, school, pause, sound
        ├── Log/               # Prayer log history
        ├── Landing/           # Marketing page components
        ├── SplashScreen/
        ├── CountdownToast/    # 10s corner countdown toast
        └── Overlay/           # Full-screen forced-pause overlay
```

One React bundle serves every window. `App.tsx` switches on the `screen` query
parameter (`overlay`, `toast`, `landing`, otherwise the dashboard), which the
Rust side sets when it builds each window.

---

## 4. Key Execution Workflows & Rules

### 4.1 Daily Schedule & Pre-Notifications

- The scheduler ticks every 10 seconds and recomputes the day's prayer items each
  tick.
- Pre-notifications fire at **T-30m**, **T-15m**, and **T-5m** before each
  prayer's adhan time.
- Fired events are deduplicated through an **in-memory** `HashSet` of keys
  (`notified_events`). This is not persisted: restarting the app re-seeds it from
  the current time, which is what allows wake/restart recovery, but also means a
  crash loop can re-fire an overlay.
- On startup, keys for events already past are pre-seeded so the app does not
  fire a backlog of stale notifications.

### 4.2 Lock Timing and Overlay Spawning

**The overlay does not fire at T-0.** It fires at `lock_timestamp`, which is
`adhan_time - preLockMinutes` (default 10 minutes *before* the adhan,
configurable 0–30 in Settings). The countdown toast appears 10 seconds before
that. `prayer_calc.rs` computes both timestamps.

At `lock_timestamp` the Rust backend:

1. **Clears the desktop** (macOS only) — `prepare_desktop_for_overlay` runs a
   synchronous AppleScript sweep that takes every other application's windows out
   of fullscreen and minimizes them. This **must complete before any overlay
   window is built**; that ordering is the whole point and is easy to break.
   Bounded by a 15-second deadline, plus 3 s per off-Space fullscreen app
   (capped at 30 s).

   **The Accessibility API only sees windows on the current Space.** A
   fullscreen app on another Space is invisible to it, so the sweep first asks
   CoreGraphics (via a JXA `CGWindowListCopyWindowInfo` call, which sees every
   Space and needs no Screen Recording permission for bounds/PIDs) for apps that
   own an off-screen, screen-sized, layer-0 window, makes each one frontmost to
   switch to its Space, and un-fullscreens it there. Minimizing goes through the
   `AXMinimized` attribute, never the Cocoa-scripting `miniaturized` property.
2. **Builds one borderless, always-on-top window per monitor** from
   `app.available_monitors()`, so the overlay cannot be bypassed on a second
   screen.
3. **Activates the app once** for the whole set — not once per window — via
   `activateIgnoringOtherApps:` (`-activate` is macOS 14+ only and would crash
   on the 10.15+ systems the bundle supports), and enters **kiosk presentation
   mode**: `HideDock | HideMenuBar | DisableProcessSwitching |
   DisableHideApplication`. `DisableProcessSwitching` is what blocks ⌘Tab and
   Mission Control / Spaces switching, including the three-finger swipe.
   `DisableForceQuit` is deliberately never set (§1.2). `close_all_overlays`
   resets the options to default; `close_overlay_windows_only` leaves them.

**Quitting**: `RunEvent::ExitRequested` with `code: None` (⌘Q and other
unrequested exits) is prevented while a non-test overlay is live. On
`RunEvent::Exit`, `restore_desktop_on_exit` spawns the restore osascript
without waiting, so the child outlives the process.

**Snooze** is owned by the backend (`snooze_overlay` command, `SNOOZES` in
`overlay_window.rs`): the overlay webview that used to hold the 5-minute
`setTimeout` is destroyed by the dismiss. A spent snooze is passed to the
rebuilt overlay as `snoozed=true`, and `snooze_pending` keeps the missed-prayer
scan off the prayer while it counts down.

**Window labels carry a generation**: `overlay-{generation}-{monitor}`. A window
is only reused when the prayer, `emergency_exhausted`, and `is_test` all match the
live overlay, because a reused window keeps the URL it was built with. Anything
else retires the old windows and builds a new generation. `ACTIVE_OVERLAY` in
`overlay_window.rs` is the source of truth for what is on screen — do not go back
to parsing the window URL.

**Platform hardening**:
- **macOS**: window level `i32::MAX` (2147483647, the maximum window level /
  `CGShieldingWindowLevel`), which sits above the Dock, menu bar, Mission Control
  and fullscreen Spaces. Collection behavior is
  `CanJoinAllSpaces | Stationary | IgnoresCycle | FullScreenAuxiliary`.
  `Miniaturizable` and `Resizable` are stripped from the style mask so ⌘M is
  inert, and `canHide` / `hidesOnDeactivate` are disabled. All AppKit calls go
  through `run_on_main_thread` — calling them from any other thread is a SIGILL.
- **Windows**: `HWND_TOPMOST` Z-order plus `WS_EX_TOOLWINDOW` / `WS_EX_TOPMOST`
  extended styles via `windows-sys`. There is no desktop sweep on Windows.

### 4.3 Edge Case Constraints

- **`fireableUntil` window**: each prayer is fireable until the start of the next
  prayer's pre-lock. Past that, the prayer is logged as `missed` without popping a
  retroactive overlay.
- **Missed-marking**: `check_and_mark_missed_prayers_in` sweeps back to
  `settings.createdAt`, up to `MAX_DAYS_BACK` (7). It **skips** any prayer that
  currently has a live overlay or a live emergency extension, so a user inside
  the forced pause is never marked missed under the very overlay waiting on them.
  The full back-catalogue is only scanned when `days_to_scan` says something
  moved — the date rolled over, the OS slept, or the UTC offset shifted;
  every other tick scans today alone, since those are the only three ways an
  older day can newly qualify.
- **Sleep / wake recovery**: there is **no OS wake-event listener.** The wake is
  inferred from tick drift instead: when a 10-second tick finds that more than 65
  seconds of wall-clock time elapsed, the process was suspended, and
  `is_sleep_wake` forces the same full re-evaluation the app does at startup —
  the missed-prayer scan reaches back over the whole back-catalogue rather than
  just today, `notified_events` is pruned (the machine may have woken on a
  different date), and `waqt:schedule-refreshed` is emitted so the frontend
  recomputes its countdowns instead of showing pre-sleep state. A prayer whose
  window is still open fires on that tick; one whose window closed during the
  sleep is logged `missed` with no retroactive overlay.
- **Timezone & DST shift**: the local UTC offset is compared each tick. On a
  change, `notified_events` is cleared and `waqt:timezone-changed` is emitted to
  refresh frontend state. When comparing stored timestamps, **parse them** —
  RFC3339 strings only sort correctly when their offsets match.
- **Multiple overlays**: there is **no queue.** A second overlay request for a
  different prayer *replaces* the current one via the generation mechanism in
  §4.2. When replacing, `close_overlay_windows_only` is used rather than
  `close_all_overlays`, so the desktop stays cleared and the user's windows do not
  pop back up between two prayers.
- **Monitor plug/unplug**: `sync_overlay_monitors` runs each tick while an overlay
  is live, adding windows for new monitors and closing windows for departed ones
  and for stale generations. It must not re-run the desktop sweep or re-activate
  the app — both were focus-stealing bugs.

---

## 5. Local Data Model (`store.json`)

```json
{
  "settings": {
    "latitude": 6.5244,
    "longitude": 3.3792,
    "cityName": "Lagos, Nigeria",
    "calculationMethod": "MuslimWorldLeague",
    "asrSchool": "Standard",
    "forcedPauseSeconds": 900,
    "preLockMinutes": 10,
    "soundEnabled": true,
    "soundOption": "chime",
    "snoozeEnabled": false,
    "notificationsEnabled": true,
    "launchAtLogin": true,
    "onboardingCompleted": false,
    "createdAt": "2026-08-17",
    "demoModeEnabled": false
  },
  "log": [
    {
      "id": "1755432554000",
      "date": "2026-08-17",
      "prayer": "Dhuhr",
      "scheduledTime": "2026-08-17T13:02:00+01:00",
      "status": "confirmed",
      "confirmedAt": "2026-08-17T13:09:14+01:00"
    }
  ],
  "emergencyExtensions": [
    {
      "id": "ext-1755432554000",
      "date": "2026-08-17",
      "prayer": "Dhuhr",
      "dismissedAt": "2026-08-17T13:04:00+01:00",
      "expiresAt": "2026-08-17T13:34:00+01:00",
      "notified15m": false,
      "notified10m": false,
      "notified5m": false,
      "relocked": false
    }
  ]
}
```

`createdAt` is written by the Rust `save_settings` and is deliberately absent from
the TypeScript `AppSettings` interface; the backend preserves it across saves that
omit it. Do not "fix" this by having the frontend send it.

### Log invariants

- **At most one row per `(date, prayer)`.** All writes go through
  `store::upsert_log_entry` — never append to `store.log` directly.
- Conflicts resolve by `store::status_rank`:
  `confirmed` (3) > `emergency_dismissed` (2) > `missed` (1) > unknown (0).
  Stronger overwrites weaker, weaker is discarded, equal refreshes. A new status
  without a rank falls to 0 and will be silently discarded — always add it to
  `status_rank`.
- The date key must agree across the FE/BE boundary. The frontend's
  `getEffectivePrayerDateString` attributes an Isha before 05:00 to the previous
  day; the scheduler keys off the calendar date it computed prayers for. These
  currently agree. If either changes, duplicate rows come back.

---

## 6. macOS Permissions & Packaging

The desktop sweep in §4.2 needs **Accessibility** permission (for the
`AXFullScreen` attribute and `miniaturized`), which is a different TCC bucket from
**Automation**. Check it with `AXIsProcessTrusted()`, never by probing System
Events for process names — that only proves Automation was granted.

The packaged app additionally needs both of:

- `NSAppleEventsUsageDescription` in `Info.plist` — without it macOS denies the
  Apple Event outright and shows the user no prompt.
- `com.apple.security.automation.apple-events` in `Entitlements.plist` — the
  hardened runtime used for release builds blocks Apple Events without it.

**`tauri dev` cannot test any of this.** In dev, TCC attributes the Apple Event to
the terminal, which is usually already trusted, so the sweep can appear to work in
dev and be completely dead in the `.app`. Always verify against
`npm run tauri build`.

---

## 7. Coding & Quality Standards

1. **Design System**: modern dark theme CSS variables, HSL colors, Inter
   typography, subtle glassmorphism cards, micro-animations for timers, clean
   status badges.
2. **Error Handling**: gracefully handle missing coordinates, store read/write
   failures, and notification permission denials. A corrupt `store.json` is backed
   up and replaced with defaults rather than crashing.
3. **Threading**: anything that shells out to `osascript` or otherwise blocks must
   stay off the main thread. Tauri runs non-`async` commands on the main thread —
   use `#[tauri::command(async)]`, and `spawn_blocking` from the scheduler.
4. **No Unused Imports / Clean Linting**: strictly typed TypeScript, `clippy`-clean
   Rust.
5. **Tests**: keep policy logic in pure functions so it can be unit-tested without
   a running app — `needs_new_generation`, `upsert_log_entry`, `status_rank`,
   `has_live_extension`, and the AppleScript builders all follow this pattern.

---

## 8. Known Divergences

Recorded here so they are not mistaken for the intended design. Full detail and
suggested fixes are in `HANDOFF.md`.

**Unverified (2026-10-15):** §4.2's claim that kiosk
`DisableProcessSwitching` blocks the Spaces three-finger swipe rests on
Apple's "all Exposé functionality is also disabled" wording, not on a
hand test; and §1.2's claim that Force Quit is usable on the re-lock overlay
may not hold while the overlay sits at `i32::MAX`. Both are tracked in
`HANDOFF.md` "Open items (added 2026-10-15)".

Before 2026-10-15: none open. The one item on this list as of 2026-08-24 — the
updater's release workflow not having its signing secrets — was closed
2026-08-28: `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
are now set on the `NureniJamiu/waqt` repo's GitHub Actions secrets (`gh
secret list` confirms both present). Untested: the workflow has not itself run
against a tagged release since, so "the secrets are readable and correctly
named" is confirmed, but "the workflow produces a working signed update" is
not yet observed in CI.

One separate, larger gap remains outside anything this list tracks as a fix to
apply: `release.yml`'s Apple notarization secrets (`APPLE_CERTIFICATE`,
`APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_TEAM_ID`, etc.) still need a real
Apple Developer ID account behind them — unrelated to the updater key, and not
something `gh secret set` alone can resolve.

Closed since this list was written: the desktop-prep listener, the unused
`is_sleep_wake` flag, `has_used_emergency_dismiss`'s string comparison, the
scheduler's per-tick I/O churn, the `--autostart` flag, the null CSP, the §1.2
emergency-hatch question (amended to an explicit single-use-per-prayer rule,
see §1.2), the Google Fonts / offline-first divergence (both families are now
self-hosted from `public/fonts/`), generating the updater's signing keypair,
and (2026-08-28) wiring that keypair into GitHub Actions. See `HANDOFF.md` for
what each one turned into.

As of 2026-08-24, `cargo check`, `cargo test` (44 tests), `npm run build`
(`tsc && vite build`), `npm test` (16 tests, vitest), and a packaged
`npm run tauri build` have all been run successfully on macOS — the first time
any of this repo's Rust has compiled. The `Info.plist` merge into the built
`.app` and the updater signature were both confirmed against the built
artifacts, not just assumed. See `HANDOFF.md` §0 for what's still unverified
(interactive launch behavior, Accessibility/Apple Events at runtime) and its
"What changed on 2026-08-28" for how the secrets item above closed out.
