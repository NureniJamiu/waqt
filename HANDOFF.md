# Waqt — Open Work

Updated 2026-10-15 — see "Open items (updated 2026-10-15)" below. Before that:
updated 2026-08-28, **nothing was open.** Everything tracked as of 2026-08-24 —
the emergency-hatch decision, the updater key, Google Fonts, and (as of today)
the last remaining item, the GitHub Actions secrets — is resolved. See "What
changed on 2026-08-24" and "What changed on 2026-08-28" below. This file is
kept as the historical record and as the place to add the next thing that
comes up; the numbered "open items" sections below are all empty for now.
`cargo check`, `cargo test`, `npm run build`, `npm test`, and `npm run tauri
build` have all been run successfully on macOS — see §0. The Apple Developer ID
/ notarization gap noted in §0 is real but was never a numbered item here,
since it's a separate, larger undertaking (an actual paid account) rather than
a fix to apply.

> Project memory already covers two topics in depth:
> `minimize_before_overlay.md` and `prayer_log_invariants.md`. Read those before
> touching `overlay_window.rs` or the prayer log.

---

## 0. Verified on macOS — build, tests, and the Info.plist merge all check out

**As of 2026-08-24, this repo has been compiled for the first time.** Earlier
sessions ran in a Linux container with no macOS toolchain, or had no crates.io /
npm access at all. On this machine, all four came back clean:

```bash
cd src-tauri && cargo check && cargo test   # 44 passed, 0 failed
npm run build   # tsc && vite build — clean
npm test        # vitest — 16 passed
```

No compiler complaints anywhere on the list below — including the
`spawn_blocking(...).await` borrow in `scheduler.rs` — and no test needed a
timestamp-constant fix.

- `scheduler.rs`'s restructured tick loop (2026-08-23 record below) compiles as
  written, including `let settings = &store.settings;` held across the
  `spawn_blocking(...).await` in the prayer loop.
- `overlay_window.rs`'s `AXIsProcessTrusted` extern block
  (`#[link(name = "ApplicationServices", kind = "framework")]`) and
  `activate_app`'s `run_on_main_thread` closure compile fine — this only proves
  they typecheck and link, not that the Accessibility / Apple Events behavior is
  correct at runtime. Still exercise them by hand on a real launch.
- All 44 Rust tests pass, including the eight added 2026-08-23 (`is_emergency_exhausted`
  in `store.rs`; `is_logged` / `days_to_scan` in `scheduler.rs`) — their
  hand-checked timestamp constants were correct.
- The main window (`"visible": false`, shown from `setup()`) was not re-verified
  interactively this round — `npm run tauri build` was used for the checks below,
  not a normal `open`/launch. If it ever fails to appear on a normal launch,
  `setup()` is still the single place that shows it.

### `tauri dev` cannot test the minimize sweep — and neither can an unsigned `tauri build`

TCC attributes Apple Events to the *terminal* in dev, so the sweep can appear to
work there and be completely dead in the packaged `.app`. `npm run tauri build`
was run on 2026-08-24 and both checks were confirmed:

```bash
npm run tauri build
plutil -p "src-tauri/target/release/bundle/macos/Waqt.app/Contents/Info.plist" | grep AppleEvents
codesign -d --entitlements - "src-tauri/target/release/bundle/macos/Waqt.app"
```

- **The Info.plist merge assumption is confirmed true.** `NSAppleEventsUsageDescription`
  shows up in the built `Info.plist` with the string from `src-tauri/Info.plist`,
  unprompted — tauri-bundler does merge it.
- **The entitlements check needs one extra step this repo doesn't do yet.**
  `tauri.conf.json` has no `bundle.macOS.signingIdentity`, so with no identity on
  this machine `npm run tauri build` produced a **completely unsigned** `.app` —
  `codesign -d --entitlements -` reported "code object is not signed at all",
  not a missing entitlement. Ad-hoc signing it manually with the same
  entitlements file did embed `com.apple.security.automation.apple-events`
  correctly:
  ```bash
  codesign --force --deep --sign - --entitlements src-tauri/Entitlements.plist \
    "src-tauri/target/release/bundle/macos/Waqt.app"
  ```
  So the entitlements file itself is fine, but an ad-hoc signature's TCC
  identity is unstable across rebuilds (Apple re-derives it from the binary
  hash each time), so it is not a substitute for a real signing identity for
  anything beyond this one check. A real Apple Developer ID is a *separate*
  requirement from the updater signing key (resolved 2026-08-28, see below) —
  `.github/workflows/release.yml` already has the env plumbing for one
  (`APPLE_CERTIFICATE`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_TEAM_ID`,
  etc.), so someone still needs to provide the actual Apple account and
  certificate for CI to notarize a distributable build.

Remove any stale Waqt row from System Settings → Privacy & Security →
Accessibility before the first run, so you get a clean grant.

---

## Open items (updated 2026-10-15)

Everything below needs a person: an Apple account, real hardware, or a
release. The code-side items from this morning's list are fixed — see
"What changed on 2026-10-15".

1. **Developer ID signing + notarization.** An unsigned or ad-hoc app gets a new
   TCC identity every build, so each update silently drops the Accessibility
   grant and the sweep returns `PermissionDenied`. This is the biggest blocker
   for distributing the macOS build. Needs a paid Apple Developer account; the
   `release.yml` plumbing is already there.
2. **Hand-test the macOS lock on a packaged, Accessibility-trusted build:**
   - kiosk mode blocks the three-finger Spaces swipe and ⌘Tab (the dev Test
     Overlay is enough for this; it gets kiosk mode, not the sweep);
   - the off-Space sweep un-fullscreens apps on other Spaces;
   - ⌘⌥Esc on the overlay shows the Force Quit panel *above* it (the yield
     assumes the panel belongs to `com.apple.loginwindow`; if it doesn't,
     log `frontmostApplication` from `overlay_focus_changed` and fix
     `FORCE_QUIT_OWNER`).
3. **Run the Windows build once.** The keyboard hook module type-checks and is
   clippy-clean for `x86_64-pc-windows-msvc` in isolation (the full crate can't
   be cross-checked from macOS — `ring` needs Windows SDK headers), but it has
   never executed. Check Win key, Alt+Tab,
   Win+Tab are swallowed during an overlay and Ctrl+Shift+Esc still opens Task
   Manager.
4. **Updater never exercised end to end** against a tagged release.

## What changed on 2026-10-19

- **White screen on overlay & countdown toast notifications fixed (macOS & Windows)**:
  - **macOS WKWebView/AppKit white canvas**:
    Tauri v2 runtime defaults webviews without an explicit `background_color` to `(255, 255, 255, 255)` (pure white).
    On macOS:
    1. The toast window was created with `decorations(false)` and rendered with `bg-transparent` in CSS; because macOS webviews are opaque by default, the transparent CSS revealed WKWebView's white canvas, turning the countdown toast into a solid white box.
    2. The overlay window was ordered front with `CGShieldingWindowLevel` (`2147483647`) before the CSS bundle was evaluated, exposing WKWebView's default white drawing buffer.
    3. Now, `WebviewWindowBuilder::background_color` is configured on all windows (`#070a11` for main, `#05080e` for overlay, `#0c1017` for toast), `harden_macos` explicitly applies `[NSColor colorWithSRGBRed:green:blue:alpha:]` to the native `NSWindow`, and `isToastWindow` has `bg-[#0c1017]`.
  - **Windows DirectComposition detachment**:
    `harden_windows` was mutating `GWL_EXSTYLE` post-creation via `SetWindowLongPtrW`,
    which detaches WebView2's DirectComposition DComp visual tree and permanently freezes
    it into an unresponsive blank white canvas. Now only safely elevates `HWND_TOPMOST`
    with `SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE`.
  - Added inline dark styling to `index.html` to eliminate pre-load white flashing.
  - Added React `ErrorBoundary` in `main.tsx` with immediate URL-based dark background
    matching (`overlay`, `toast`, `dashboard`) so unexpected component crashes never
    unmount into a white screen.

## What changed on 2026-10-15

- **Fullscreen / Spaces bypass** — off-Space fullscreen apps found via
  CGWindowList and swept; kiosk presentation mode while an overlay is up;
  `AXMinimized` instead of `miniaturized`; `activateIgnoringOtherApps:` (the
  old `-activate` crashed below macOS 14). Commit `770fdfa`.
- **Snooze** moved to the backend (it used to die with the webview it lived
  in); ⌘Q refused during a prayer overlay; swept windows restored on exit.
- **Force Quit visibility** — overlay steps down to normal level while the
  ⌘⌥Esc panel is frontmost (`overlay_focus_changed`).
- **`store.json` lost updates** — `StoreManager::modify` + `STORE_WRITE_LOCK`;
  `mark_missed_prayer`'s "already logged?" check now runs under the lock.
- **Forced-pause drift** — wall-clock countdown to `started_at + pause`.
- **Two prayer engines** — `prayer_calc.rs` is now a port of adhan-js and
  matches `fixtures/prayer_times.json` to the second for all 364 cases (7
  cities incl. Oslo, 4 dates, 12 methods, both Asr schools). Before the port
  it was ~2 min off everywhere and hours off for summer high-latitude Isha.
- **Windows** — `WH_KEYBOARD_LL` hook during overlays.
- **Clippy** — the two `collapsible_if` warnings in `scheduler.rs`.

---

## Known limits of the overlay work

Not bugs to chase — just things to know before you trust the sweep code.

**The sweep delays the overlay by up to 15 seconds.** That is the deliberate cost
of the minimize-first ordering (`SWEEP_TIMEOUT` in `overlay_window.rs`), and it
scales with how many fullscreen windows are open, since leaving a fullscreen
Space costs ~0.5s each. If the overlay lands too late, the fix is to start the
sweep at toast time — there is already a 10-second warning window before T-0 —
rather than at T-0.

**Restore is best-effort.** Windows are matched back by title, with the recorded
index as fallback, because indices shift as windows minimize. Untitled windows
are restored by index only and may be missed.

**Quitting with an overlay open** — closed 2026-10-15: `RunEvent::Exit` now
calls `restore_desktop_on_exit`, and ⌘Q is refused while a prayer overlay is
live. Force Quit (SIGKILL) still skips the restore; nothing can hook that.

**Overlay replacement keeps the desktop cleared.** When one prayer's overlay
replaces another, `close_overlay_windows_only` runs instead of
`close_all_overlays`, so the sweep does not re-run and windows do not pop back
mid-prayer. Anything the user opened during the first overlay is therefore not
swept.

---

## What changed on 2026-08-23

### `waqt:desktop-prep` now has a listener *(was §2)*

`prepare_desktop_for_overlay` emitted a `DesktopPrepOutcome` and nothing
subscribed, so a denied Accessibility permission reached only a stderr the user
never sees.

- `src/types/index.ts` — `DesktopPrepOutcome`, a discriminated union mirroring
  the Rust enum's `#[serde(tag = "status", rename_all = "snake_case")]` shape.
- `src/lib/store.ts` — `subscribeDesktopPrep`, alongside the existing
  `subscribeLogUpdated` / `subscribeTimezoneChanged`.
- `src/components/DesktopPrepNotice.tsx` — a dismissible banner. On
  `permission_denied` it offers a button wired to the existing
  `requestAccessibilityPermission()`; `timed_out` and `failed` each get their own
  explanation.
- `App.tsx` — subscribes on mount, holds the last failure in state, and renders
  the banner on the dashboard / settings / log screens.

**Why the dashboard and not the overlay.** The event fires while the prayer
overlay is going up, and the main window is usually hidden in the tray at that
moment. A permissions banner over the prayer screen would be the wrong
interruption, so the notice waits and appears the next time the user opens Waqt.

**Resolved along the way:** the open question about whether `Onboarding.tsx`
gates on `checkAccessibilityPermission()` — it does. Step 3 has an Accessibility
card that checks on entry, polls while visible so it updates live when the user
toggles the switch in System Settings, and calls
`requestAccessibilityPermission()` from its button. No change was needed there.

### Sleep/wake recovery uses its flag *(was §3)*

`is_sleep_wake` was computed, printed, and dropped. It now drives the recovery.
On a detected wake the tick scans the full `MAX_DAYS_BACK` back-catalogue instead
of just today, prunes notification keys that are not from today (the machine may
have woken on a different date), and emits `waqt:schedule-refreshed`, which
`App.tsx` uses to reload settings and logs so countdowns are not left showing
pre-sleep state.

No `NSWorkspace.didWakeNotification` observer was added. The tick-gap heuristic
covers the same cases without new macOS-only code — and macOS-only code is
exactly what could not be compiled or tested. `AGENTS.md` §4.3 now describes this
rather than the polling-only behavior.

### `has_used_emergency_dismiss` parses timestamps *(was §5)*

Was `e.expires_at <= now_iso`, a lexicographic compare that inverts once the UTC
offsets differ. Extracted to `store::is_emergency_exhausted(extensions, date,
prayer, now_ts)`, parsing with `chrono::DateTime::parse_from_rfc3339` — the same
approach `scheduler::has_live_extension` already used.

An unparseable `expires_at` counts as *expired*, matching `has_live_extension`
treating it as "not live": a corrupt record must not become an unbounded grace
period.

Four tests added, including `exhaustion_check_survives_a_timezone_change`, which
asserts that the naive comparison is fooled by the very data the parsed one gets
right.

### Scheduler I/O churn *(was §6)*

The tick used to construct a `StoreManager` and re-parse `store.json` roughly ten
times — `load_settings`, `load_logs`, `load_emergency_extensions`, one
`load_logs` per `has_logged_prayer`, and another per emergency extension — then
recompute 8 days of prayer times.

- One `load_store()` per tick. Settings, logs and extensions all read off that
  snapshot, via the new `is_logged(&store.log, date, prayer)` helper.
- **Writes still do their own read-modify-write.** This is deliberate: a tick can
  sit inside a 15-second `spawn_blocking` sweep, and batching the whole store
  into one write at the end would clobber anything the frontend saved in the
  meantime. Only reads are cached. When `check_and_mark_missed_prayers_in`
  reports that it wrote, the snapshot is re-read before the rest of the tick uses
  it.
- The back-catalogue scan is gated by `days_to_scan(date_rolled_over,
  is_sleep_wake, offset_shifted)`: `MAX_DAYS_BACK` when one of those holds,
  otherwise `0` (today only). Those are the only three ways a day older than
  today can newly become missed.
- `notified_events` is pruned on the date rollover and on wake, instead of once
  the set passed 100 entries — which at ~25 keys/day took four days.

`check_and_mark_missed_prayers(app_handle)` is kept as a public wrapper that
loads the store and does a full scan; the scheduler calls
`check_and_mark_missed_prayers_in` directly.

### Autostart no longer pops the dashboard *(was §7)*

`lib.rs` gained `AUTOSTART_FLAG` / `launched_by_autostart()`, and `setup()` shows
the main window only when the flag is absent. The window is now configured
`"visible": false` and shown from `setup()`, rather than created visible and
hidden afterwards, so there is no frame of dashboard flashing at login.

### CSP *(was §8)*

`app.security.csp` was `null`. It is now a real policy, plus a looser `devCsp` so
`tauri dev` keeps working (Vite's HMR client needs `'unsafe-inline'` /
`'unsafe-eval'` and `ws://localhost:1420`).

`asset:` / `http://asset.localhost` are deliberately *not* in the policy, since
`assetProtocol` is not enabled. If you enable it, add them to `img-src` and
`media-src`. The Google Fonts allowances (`style-src https://fonts.googleapis.com`,
`font-src https://fonts.gstatic.com`) were removed on 2026-08-24 once the fonts
were self-hosted — see below.

---

## What changed on 2026-08-24

### The emergency-hatch product decision is resolved *(was §1)*

`AGENTS.md` §1.2 read as an unqualified rule — "immediately clickable at all
times" — while `src/screens/Overlay/Overlay.tsx` disables the dismiss button
and confirmation modal once `isEmergencyExhausted` is true, i.e. on a prayer's
re-lock overlay after its 30-minute emergency extension has already run out.

Decision: **amend the rule**, not the code that was already there. §1.2 now
states the hatch as single-use per prayer explicitly, and explains why: an
unconditionally live hatch would make the 30-minute grace period optional,
since re-triggering it forever is indistinguishable from no lock at all. It
also documents the fallback for a genuine emergency on the re-lock overlay —
macOS's system-level Force Quit (⌘⌥Esc, or Activity Monitor), which is
intercepted by WindowServer before the keystroke reaches the webview and so is
unaffected by the overlay's own key-blocking, `closable(false)`/`minimizable(false)`,
or `CGShieldingWindowLevel`. `Overlay.tsx`'s dismiss-button/modal behavior was
already what the amended rule describes and did not need to change; the one
code change that *did* land is the small follow-up below (the fallback wasn't
named anywhere in the app itself). `AGENTS.md` §1.2 and §8 are updated to
match; this file's open items were renumbered down to fill the gap left by
this one closing.

### Re-lock overlay now names the Force Quit fallback *(was §3)*

The gap flagged right after the decision above: `AGENTS.md` documented ⌘⌥Esc as
the answer for a genuine emergency on the re-lock overlay, but nothing in the
app said so. `src/screens/Overlay/Overlay.tsx`'s `isEmergencyExhausted` branch
now has a line under the existing copy: "Genuine emergency? Force Quit Waqt
(⌘⌥Esc) from the system menu."

### Fonts are self-hosted *(was §2)*

`index.html`'s three Google Fonts `<link>` tags are gone. `Inter` (300/400/500/600/700)
and `Plus Jakarta Sans` (500/600/700/800), latin + latin-ext subsets, are now
`public/fonts/*.woff2` (4 files — Google serves one file per subset across
several `font-weight` rules, so self-hosting is 4 files, not 18), with matching
`@font-face` rules added to the top of `src/index.css`. The `@font-face` rules
are byte-for-byte what Google's own stylesheet served for these weights, just
with `src` repointed at the local files. The CSP's `style-src https://fonts.googleapis.com`
and `font-src https://fonts.gstatic.com` allowances are gone with them —
`font-src 'self' data:` already covers `/fonts/*`. Verified: `npm run build`
copies all 4 files into `dist/fonts/` and the built CSS references them by
that path; `npm test` still passes (16/16); `cargo check` is unaffected (no
Rust touched).

### Updater signing key generated and verified end-to-end *(was §1)*

`npm run tauri signer generate -w ~/.tauri/waqt.key` produced a real minisign
keypair (previously `tauri.conf.json`'s `pubkey` decoded to a comment line with
no key bytes). The public key is now in `tauri.conf.json`; the private key and
its password live only in `~/.tauri/waqt.key`, outside this repo, and were
handed to the user directly in-session rather than written anywhere else.
Confirmed working, not just generated: `npm run tauri build` with
`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` set produced
`Waqt.app.tar.gz.sig`, and its key-ID bytes match the `pubkey` now committed —
the pair is real and consistent. What was left — adding the two secrets to
GitHub Actions — was entirely outside this checkout at the time; see "What
changed on 2026-08-28" below for how that closed out.

### Build verified on macOS for the first time *(was §0)*

See §0 above for the full detail: `cargo check`/`cargo test` (44 tests),
`npm run build`, and `npm test` (16 tests) all pass with no changes needed.
`npm run tauri build` also confirmed the `Info.plist` merge (§0's previously
unverified assumption) is real, and found that this repo's release build is
currently unsigned by default — a gap that's about a *code-signing* (Apple
Developer ID) identity, separate from the updater signing key resolved above.

---

## What changed on 2026-08-28

### GitHub Actions has the updater signing secrets *(was the last open item)*

The one thing 2026-08-24 couldn't finish: this machine had no `gh` CLI and no
GitHub credentials. Both are now in place — `gh` was installed (`brew install
gh`), the user authenticated it themselves (`gh auth login`, browser flow,
confirmed via `gh auth status` as `NureniJamiu` with `repo` scope and `ADMIN`
permission on `NureniJamiu/waqt`), and both secrets were pushed straight from
the key material generated on 2026-08-24:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo NureniJamiu/waqt < ~/.tauri/waqt.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo NureniJamiu/waqt --body "<password>"
```

Confirmed via `gh secret list --repo NureniJamiu/waqt`: both `TAURI_SIGNING_PRIVATE_KEY`
and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are present. The next tagged release
(`.github/workflows/release.yml`, triggered on a `v*` tag push) should now
produce a working, signature-verified auto-update — that path has not itself
been run end-to-end (no release has been tagged since), so treat "the workflow
picks up the secrets correctly" as strongly likely, not yet observed in CI.

`~/.tauri/waqt.key` and its password remain the only copy outside GitHub's
encrypted secret store now that they're no longer needed in-session. **They
still need a durable backup** (password manager, etc.) — GitHub secrets are
write-only (nothing can read them back out), so this local file is the sole
recovery path if the CI secret is ever accidentally deleted or rotated.

---

## File-by-file change log

### 2026-08-28

No files in this checkout changed — this was entirely GitHub-side. `gh` was
installed and authenticated (user's own `gh auth login`), then
`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` were pushed
to the `NureniJamiu/waqt` repo's Actions secrets via `gh secret set`, closing
out the one item left from 2026-08-24. `HANDOFF.md` updated to record it and
to note that no numbered open items remain.

### 2026-08-24

| File | Change |
|---|---|
| `AGENTS.md` | §1.2 amended to an explicit single-use-per-prayer hatch, with the Force Quit fallback documented; §8 pruned to drop the now-resolved item and record the successful macOS build/test verification |
| `HANDOFF.md` | §0 rewritten with verified build/test/`tauri build` results; emergency hatch, Google Fonts, and updater key items resolved and moved to this record; remaining item (GitHub secrets) renumbered to §1 (later resolved 2026-08-28, see above) |
| `src/screens/Overlay/Overlay.tsx` | Re-lock (`isEmergencyExhausted`) copy now names the ⌘⌥Esc Force Quit fallback |
| `index.html` | Removed the three Google Fonts `<link>`/`<link rel="preconnect">` tags |
| `src/index.css` | Added self-hosted `@font-face` rules for Inter and Plus Jakarta Sans (latin + latin-ext) |
| `public/fonts/` | New — `Inter-latin.woff2`, `Inter-latin-ext.woff2`, `PlusJakartaSans-latin.woff2`, `PlusJakartaSans-latin-ext.woff2` |
| `src-tauri/tauri.conf.json` | Real updater `pubkey`; CSP's Google Fonts `style-src`/`font-src` allowances removed |

No Rust source changed this round. `cargo check` and `cargo test` were run as
verification only; `npm run build`, `npm test`, and `npm run tauri build` (run
twice — once before the font/copy changes to verify §0, once after with the
signing env vars set to verify §1) covered the frontend and packaging changes
above.

### 2026-08-23

| File | Change |
|---|---|
| `src-tauri/src/scheduler.rs` | One store read per tick; `is_logged` helper; `check_and_mark_missed_prayers_in(app, mgr, store, max_days_back)`; `days_to_scan`; `MAX_DAYS_BACK`; `is_sleep_wake` drives a full re-evaluation, key pruning and `waqt:schedule-refreshed`; key pruning moved off the 100-entry threshold onto the date rollover |
| `src-tauri/src/store.rs` | `is_emergency_exhausted` — `has_used_emergency_dismiss` parses RFC3339 instead of string-comparing |
| `src-tauri/src/lib.rs` | `AUTOSTART_FLAG`, `launched_by_autostart()`; `setup()` shows `main` only when not launched at login |
| `src-tauri/tauri.conf.json` | `main` window `visible: false`; real `csp` + `devCsp` |
| `src/types/index.ts` | `DesktopPrepOutcome` |
| `src/lib/store.ts` | `subscribeDesktopPrep`, `subscribeScheduleRefreshed` |
| `src/components/DesktopPrepNotice.tsx` | New — the sweep-failure banner |
| `src/App.tsx` | Subscribes to both new events; renders the notice |
| `AGENTS.md` | §4.3 sleep/wake and missed-marking updated to match the code; §8 pruned to what is still open |

### 2026-08-22

| File | Change |
|---|---|
| `overlay_window.rs` | Rewrote the minimize sweep (AXFullScreen before miniaturize, daemon filter, PID filter, records only genuine changes); synchronous with a killed-on-deadline timeout; `AXIsProcessTrusted` replaces the System Events permission probe; restore-on-dismiss replaces `NSWorkspace.unhide()`; generation-based window labels; `ACTIVE_OVERLAY` replaces URL parsing |
| `store.rs` | `upsert_log_entry` + `status_rank` — one row per `(date, prayer)`, merged by precedence |
| `scheduler.rs` | Missed-marking skips prayers with a live overlay or live emergency extension; overlay spawns moved to `spawn_blocking` |
| `lib.rs` | `trigger_overlay` / `dismiss_overlay` / `request_accessibility_permission` are now `#[tauri::command(async)]` so they leave the main thread |
| `tauri.conf.json` | Added `bundle.macOS.entitlements` + `minimumSystemVersion` |
| `Info.plist`, `Entitlements.plist` | New — `NSAppleEventsUsageDescription` and `com.apple.security.automation.apple-events` |
