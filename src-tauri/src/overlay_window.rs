use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

#[cfg(target_os = "macos")]
use std::sync::atomic::AtomicBool;
#[cfg(target_os = "macos")]
use std::time::{Duration, Instant};

// ═══════════════════════════════════════════════════════════════════════════
// Desktop preparation (minimize-before-overlay)
// ═══════════════════════════════════════════════════════════════════════════

/// Outcome of the "clear the desktop before the overlay appears" sweep.
/// Emitted to the frontend on `waqt:desktop-prep` so the UI can surface a
/// permission problem instead of failing silently.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum DesktopPrepOutcome {
    /// Test-mode overlay, or a platform with no sweep implemented.
    Skipped,
    /// macOS Accessibility permission is not granted — nothing was minimized.
    PermissionDenied,
    /// The sweep ran past its deadline and was killed. Some windows may have
    /// been minimized; the overlay is shown anyway rather than hanging.
    TimedOut,
    /// osascript could not be run or returned an unexpected error.
    Failed { message: String },
    /// Sweep completed. `windows` is the number of windows actually changed.
    Completed { windows: usize },
}

/// One window the sweep actually changed, recorded so it can be put back.
/// Windows the user had *already* minimized are never recorded, so restoring
/// never un-minimizes something the user minimized themselves.
#[cfg(target_os = "macos")]
#[derive(Debug, Clone, PartialEq)]
struct RestoreTarget {
    /// `M` = we miniaturized it. `F` = we took it out of fullscreen.
    op: char,
    process: String,
    index: usize,
    title: String,
}

/// True while an overlay session owns the desktop. Prevents the sweep from
/// running once per monitor, and prevents `sync_overlay_monitors` (which fires
/// every scheduler tick) from re-running it every 10 seconds.
#[cfg(target_os = "macos")]
static SWEEP_ACTIVE: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "macos")]
static RESTORE_TARGETS: Mutex<Vec<RestoreTarget>> = Mutex::new(Vec::new());

/// How long the minimize sweep may run before we give up and show the overlay
/// anyway. Exiting fullscreen is animated and costs ~0.5s per window, so this
/// needs headroom for a few fullscreen apps.
#[cfg(target_os = "macos")]
const SWEEP_TIMEOUT: Duration = Duration::from_secs(15);

/// Extra budget per off-Space fullscreen app: switching to its Space, waiting
/// for AX to see the window, and the fullscreen-exit animation.
#[cfg(target_os = "macos")]
const SWEEP_TIMEOUT_PER_OFFSPACE_APP: Duration = Duration::from_secs(3);

#[cfg(target_os = "macos")]
const SWEEP_TIMEOUT_MAX: Duration = Duration::from_secs(30);

#[cfg(target_os = "macos")]
const RESTORE_TIMEOUT: Duration = Duration::from_secs(20);

#[cfg(target_os = "macos")]
fn sweep_timeout_for(offspace_apps: usize) -> Duration {
    (SWEEP_TIMEOUT + SWEEP_TIMEOUT_PER_OFFSPACE_APP * offspace_apps as u32).min(SWEEP_TIMEOUT_MAX)
}

/// PIDs of apps that own a screen-sized, normal-layer window that is not on
/// the current Space — i.e. almost certainly a native fullscreen window.
///
/// CoreGraphics' window list covers every Space, unlike AX, and reading
/// bounds/PID/layer needs no Screen Recording permission (only window *titles*
/// do). Run through JXA so no CoreFoundation bindings are needed here. A false
/// positive costs one extra Space switch; the sweep itself still checks
/// `AXFullScreen` before changing anything.
#[cfg(target_os = "macos")]
fn find_offspace_fullscreen_pids(own_pid: u32) -> Vec<u32> {
    const SCRIPT: &str = r#"
ObjC.import("CoreGraphics");
ObjC.import("AppKit");
const list = ObjC.deepUnwrap(ObjC.castRefToObject(
    $.CGWindowListCopyWindowInfo($.kCGWindowListOptionAll, $.kCGNullWindowID)));
const screens = $.NSScreen.screens;
const sizes = [];
for (let i = 0; i < screens.count; i++) {
    const f = screens.objectAtIndex(i).frame;
    sizes.push([f.size.width, f.size.height]);
}
const pids = new Set();
for (const w of (list || [])) {
    const b = w.kCGWindowBounds;
    if (w.kCGWindowLayer !== 0 || w.kCGWindowIsOnscreen || !b) continue;
    if ((w.kCGWindowAlpha || 0) <= 0) continue;
    if (sizes.some(s => Math.abs(s[0] - b.Width) <= 1 && Math.abs(s[1] - b.Height) <= 1)) {
        pids.add(w.kCGWindowOwnerPID);
    }
}
Array.from(pids).join(",");
"#;

    match run_osascript_lang("JavaScript", SCRIPT, Duration::from_secs(3)) {
        Ok(stdout) => parse_pid_list(&stdout, own_pid),
        Err(e) => {
            eprintln!("[Waqt] Could not list off-Space windows: {e:?}");
            Vec::new()
        }
    }
}

/// Parses the comma-separated PID list from `find_offspace_fullscreen_pids`,
/// dropping our own PID, junk, and duplicates while keeping order.
#[cfg(target_os = "macos")]
fn parse_pid_list(stdout: &str, own_pid: u32) -> Vec<u32> {
    let mut out = Vec::new();
    for pid in stdout.trim().split(',').filter_map(|s| s.trim().parse::<u32>().ok()) {
        if pid != own_pid && pid != 0 && !out.contains(&pid) {
            out.push(pid);
        }
    }
    out
}

/// Minimizes every other application's windows, taking fullscreen windows out
/// of their Space first.
///
/// **This blocks until the sweep finishes.** That is the point: the overlay must
/// not appear until the desktop is clear. Callers must therefore invoke it from
/// a worker thread, never the main thread — see `spawn_overlay_windows`.
///
/// Idempotent per overlay session: the second and subsequent calls (one per
/// extra monitor, plus every `sync_overlay_monitors` tick) return `Skipped`.
pub fn prepare_desktop_for_overlay(app: &AppHandle, is_test: bool) -> DesktopPrepOutcome {
    let outcome = prepare_desktop_inner(is_test);
    if outcome != DesktopPrepOutcome::Skipped {
        let _ = app.emit("waqt:desktop-prep", outcome.clone());
    }
    outcome
}

#[cfg(target_os = "macos")]
fn prepare_desktop_inner(is_test: bool) -> DesktopPrepOutcome {
    if is_test {
        return DesktopPrepOutcome::Skipped;
    }

    // Claim the session. `Err` means a sweep already ran for this overlay.
    if SWEEP_ACTIVE
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return DesktopPrepOutcome::Skipped;
    }

    // Cheap, non-prompting, in-process check. Unlike the old System Events
    // probe this tests Accessibility (which `AXMinimized` needs), not
    // Automation.
    if !has_accessibility_permission() {
        eprintln!(
            "[Waqt] Accessibility permission not granted — cannot minimize windows before the overlay."
        );
        return DesktopPrepOutcome::PermissionDenied;
    }

    // The Accessibility API only enumerates windows on the *current* Space, so
    // a fullscreen app parked on another Space is invisible to the AX sweep and
    // stays reachable by a three-finger swipe. Find those apps through
    // CoreGraphics (which sees every Space) and let the sweep visit each one.
    let own_pid = std::process::id();
    let offspace_pids = find_offspace_fullscreen_pids(own_pid);
    let script = build_minimize_script(own_pid, &offspace_pids);
    let timeout = sweep_timeout_for(offspace_pids.len());

    match run_osascript(&script, timeout) {
        Ok(stdout) => {
            let targets = parse_sweep_output(&stdout);
            let count = targets.len();
            if let Ok(mut guard) = RESTORE_TARGETS.lock() {
                *guard = targets;
            }
            println!("[Waqt] Desktop sweep complete: {count} window(s) minimized.");
            DesktopPrepOutcome::Completed { windows: count }
        }
        Err(OsaError::TimedOut) => {
            eprintln!("[Waqt] Desktop sweep exceeded {timeout:?} and was killed.");
            DesktopPrepOutcome::TimedOut
        }
        Err(OsaError::PermissionDenied(msg)) => {
            // AXIsProcessTrusted said yes but the Apple Event was still
            // refused — this is the hardened-runtime / missing-usage-string
            // case, or Automation consent was revoked for System Events.
            eprintln!("[Waqt] Desktop sweep denied by macOS: {msg}");
            DesktopPrepOutcome::PermissionDenied
        }
        Err(OsaError::Other(msg)) => {
            eprintln!("[Waqt] Desktop sweep failed: {msg}");
            DesktopPrepOutcome::Failed { message: msg }
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn prepare_desktop_inner(_is_test: bool) -> DesktopPrepOutcome {
    // Windows/Linux rely on always-on-top + topmost Z-order instead.
    DesktopPrepOutcome::Skipped
}

/// Puts back exactly the windows `prepare_desktop_for_overlay` changed, and
/// releases the sweep guard so the next overlay can sweep again.
///
/// Best-effort and fire-and-forget: unlike the sweep there is no ordering
/// requirement on the way out, so this runs on a detached thread.
pub fn restore_desktop_after_overlay() {
    #[cfg(target_os = "macos")]
    {
        if !SWEEP_ACTIVE.swap(false, Ordering::SeqCst) {
            return;
        }

        let targets = match RESTORE_TARGETS.lock() {
            Ok(mut guard) => std::mem::take(&mut *guard),
            Err(_) => return,
        };

        if targets.is_empty() {
            return;
        }

        std::thread::spawn(move || {
            let script = build_restore_script(&targets);
            if let Err(e) = run_osascript(&script, RESTORE_TIMEOUT) {
                eprintln!("[Waqt] Failed to restore windows after overlay: {e:?}");
            } else {
                println!("[Waqt] Restored {} window(s) after overlay.", targets.len());
            }
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// AppleScript generation
// ═══════════════════════════════════════════════════════════════════════════

/// Builds the sweep script.
///
/// What it has to get right:
///
/// 1. **Fullscreen windows are not miniaturizable.** A window in a native
///    fullscreen Space rejects minimizing. It has to leave fullscreen first via
///    the `AXFullScreen` accessibility attribute, and the Space-collapse
///    animation has to finish before the minimize will take — so the script
///    polls `AXFullScreen` rather than sleeping a fixed amount.
/// 2. **AX only sees the current Space.** Fullscreen apps on other Spaces
///    (`offspace_pids`, found via CoreGraphics) are made frontmost first, which
///    switches to their Space so their windows become visible to AX.
/// 3. **Minimize through `AXMinimized`.** `miniaturized` is a Cocoa-scripting
///    property that System Events' UI-element windows only inherit by
///    class-extension; whether it is backed is undocumented, and any failure
///    was swallowed by its `try`. `AXMinimized` is the attribute the
///    Accessibility API actually exposes.
/// 4. **`every application process` includes agents and daemons**, most of
///    which throw on `windows`. `whose background only is false` skips them.
/// 5. **Only genuine changes are recorded.** A window the user had already
///    minimized is left out of the restore list.
///
/// Output is one line per changed window: `OP \t process \t index \t title`.
/// `OP` comes first so the title (which may itself contain a tab) can be the
/// unbounded final field.
#[cfg(target_os = "macos")]
fn build_minimize_script(own_pid: u32, offspace_pids: &[u32]) -> String {
    let offspace = offspace_pids
        .iter()
        .map(|p| p.to_string())
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        r#"
global changedList
set changedList to {{}}
set myPid to {own_pid}
set offspacePids to {{{offspace}}}

on sweepWindows(proc)
    global changedList
    tell application "System Events"
        set procName to name of proc
        set winCount to 0
        try
            set winCount to count of windows of proc
        end try
        repeat with i from 1 to winCount
            set wTitle to ""
            try
                set wTitle to name of window i of proc
            end try

            -- 1. Leave the fullscreen Space, if any. Must finish before the
            --    minimize below or the minimize is rejected.
            try
                if (value of attribute "AXFullScreen" of window i of proc) is true then
                    set value of attribute "AXFullScreen" of window i of proc to false
                    set end of changedList to "F" & tab & procName & tab & i & tab & wTitle
                    repeat 20 times
                        delay 0.1
                        try
                            if (value of attribute "AXFullScreen" of window i of proc) is false then exit repeat
                        end try
                    end repeat
                    delay 0.4
                end if
            end try

            -- 2. Minimize, but only if the user had not already done so.
            try
                if (value of attribute "AXMinimized" of window i of proc) is false then
                    set value of attribute "AXMinimized" of window i of proc to true
                    set end of changedList to "M" & tab & procName & tab & i & tab & wTitle
                end if
            end try
        end repeat
    end tell
end sweepWindows

-- Pass 1: fullscreen apps on other Spaces. Bringing one frontmost switches to
-- its Space, after which AX can see (and un-fullscreen) its window.
repeat with targetPid in offspacePids
    try
        tell application "System Events"
            set proc to first application process whose unix id is (targetPid as integer)
            set frontmost of proc to true
        end tell
        repeat 15 times
            delay 0.1
            tell application "System Events"
                try
                    if (count of windows of proc) > 0 then exit repeat
                end try
            end tell
        end repeat
        delay 0.3
        sweepWindows(proc)
    end try
end repeat

-- Pass 2: everything visible on the Space we ended up on.
tell application "System Events"
    set procList to every application process whose background only is false
end tell
repeat with proc in procList
    try
        tell application "System Events" to set procPid to unix id of proc
        if procPid is not myPid then sweepWindows(contents of proc)
    end try
end repeat

set AppleScript's text item delimiters to linefeed
set outText to changedList as text
set AppleScript's text item delimiters to ""
return outText
"#
    )
}

/// Builds the restore script from the recorded targets.
///
/// Un-miniaturizes first, then re-enters fullscreen, so a window that was both
/// un-fullscreened and minimized comes back the way it started. Windows are
/// looked up by title where possible because indices shift as windows are
/// minimized; the recorded index is the fallback for untitled windows.
#[cfg(target_os = "macos")]
fn build_restore_script(targets: &[RestoreTarget]) -> String {
    let mut body = String::from("tell application \"System Events\"\n");

    // Un-miniaturize before re-fullscreening: a miniaturized window cannot
    // enter fullscreen.
    for op in ['M', 'F'] {
        for t in targets.iter().filter(|t| t.op == op) {
            let proc = escape_applescript(&t.process);
            let title = escape_applescript(&t.title);
            let lookup = if t.title.is_empty() {
                format!("set _w to window {} of _p", t.index)
            } else {
                format!(
                    "try\n                set _w to (first window of _p whose name is \"{title}\")\n            end try\n            if _w is missing value then set _w to window {} of _p",
                    t.index
                )
            };
            let action = if op == 'M' {
                "set value of attribute \"AXMinimized\" of _w to false"
            } else {
                "set value of attribute \"AXFullScreen\" of _w to true"
            };
            body.push_str(&format!(
                "    try\n        set _p to application process \"{proc}\"\n        set _w to missing value\n            {lookup}\n        {action}\n    end try\n"
            ));
        }
        if op == 'M' && targets.iter().any(|t| t.op == 'F') {
            body.push_str("    delay 0.3\n");
        }
    }

    body.push_str("end tell\n");
    body
}

/// Escapes a string for embedding in an AppleScript double-quoted literal.
#[cfg(target_os = "macos")]
fn escape_applescript(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Parses `OP \t process \t index \t title` lines emitted by the sweep.
#[cfg(target_os = "macos")]
fn parse_sweep_output(stdout: &str) -> Vec<RestoreTarget> {
    stdout
        .lines()
        .filter_map(|line| {
            let line = line.trim_end_matches('\r');
            if line.is_empty() {
                return None;
            }
            let mut parts = line.splitn(4, '\t');
            let op = match parts.next()? {
                "M" => 'M',
                "F" => 'F',
                _ => return None,
            };
            let process = parts.next()?.to_string();
            let index = parts.next()?.trim().parse::<usize>().ok()?;
            let title = parts.next().unwrap_or("").to_string();
            Some(RestoreTarget {
                op,
                process,
                index,
                title,
            })
        })
        .collect()
}

// ═══════════════════════════════════════════════════════════════════════════
// osascript execution
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(target_os = "macos")]
#[derive(Debug)]
enum OsaError {
    TimedOut,
    PermissionDenied(String),
    Other(String),
}

/// Runs an AppleScript with a hard deadline, killing the child if it overruns.
///
/// A sweep that hangs (a wedged app not answering Apple Events, a modal system
/// dialog) must never wedge the prayer overlay, so the deadline is enforced
/// rather than relying on osascript to return.
#[cfg(target_os = "macos")]
fn run_osascript(script: &str, timeout: Duration) -> Result<String, OsaError> {
    run_osascript_lang("AppleScript", script, timeout)
}

#[cfg(target_os = "macos")]
fn run_osascript_lang(language: &str, script: &str, timeout: Duration) -> Result<String, OsaError> {
    use std::process::{Command, Stdio};

    let mut child = Command::new("/usr/bin/osascript")
        .arg("-l")
        .arg(language)
        .arg("-e")
        .arg(script)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| OsaError::Other(format!("could not spawn osascript: {e}")))?;

    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(OsaError::TimedOut);
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(OsaError::Other(format!("osascript wait failed: {e}"))),
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|e| OsaError::Other(format!("could not read osascript output: {e}")))?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    if is_permission_error(&stderr) {
        Err(OsaError::PermissionDenied(stderr))
    } else {
        Err(OsaError::Other(stderr))
    }
}

/// The macOS error codes that mean "TCC said no", as opposed to a script bug.
///
/// -1743 errAEEventNotPermitted — Automation consent missing, or the app is
///        under hardened runtime without `NSAppleEventsUsageDescription`.
/// -1728 errAENoSuchObject      — usually a genuine script bug, not included.
/// -25211 kAXErrorAPIDisabled   — Accessibility is off globally.
#[cfg(target_os = "macos")]
fn is_permission_error(stderr: &str) -> bool {
    let lower = stderr.to_lowercase();
    stderr.contains("-1743")
        || stderr.contains("-25211")
        || lower.contains("not allowed assistive")
        || lower.contains("not authorized")
        || lower.contains("accessibility")
        || lower.contains("assistive access")
}

// ═══════════════════════════════════════════════════════════════════════════
// Accessibility permission
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    /// Returns the calling process's Accessibility trust state without
    /// prompting. Returns a C `Boolean` (`unsigned char`), hence `u8`.
    fn AXIsProcessTrusted() -> u8;
}

/// True when this process is trusted for Accessibility.
///
/// The previous implementation ran `tell application "System Events" to return
/// name of every application process`, which only exercises the **Automation**
/// TCC bucket. `set miniaturized` and the `AXFullScreen` attribute need
/// **Accessibility**, a different bucket — so the old check returned `true`
/// while every window write silently failed.
#[cfg(target_os = "macos")]
pub fn has_accessibility_permission() -> bool {
    unsafe { AXIsProcessTrusted() != 0 }
}

/// Opens System Settings → Privacy & Security → Accessibility.
///
/// An app does not appear in that list until it has *attempted* an
/// accessibility call, so a throwaway AX request is fired first — otherwise the
/// user arrives at a pane with no Waqt row to toggle.
#[cfg(target_os = "macos")]
pub fn request_accessibility_permission() -> bool {
    if has_accessibility_permission() {
        return true;
    }

    // Registers this app in the Accessibility list. Expected to fail.
    let _ = run_osascript(
        r#"tell application "System Events" to tell (first application process whose frontmost is true) to get value of attribute "AXFocused" of window 1"#,
        Duration::from_secs(5),
    );

    open_accessibility_settings();
    false
}

#[cfg(not(target_os = "macos"))]
pub fn has_accessibility_permission() -> bool {
    true
}

#[cfg(not(target_os = "macos"))]
pub fn request_accessibility_permission() -> bool {
    true
}

#[cfg(target_os = "macos")]
fn open_accessibility_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .status();
}

/// Exit-path variant of `restore_desktop_after_overlay`.
///
/// The process is about to die, so a worker thread that waits on osascript
/// would be killed mid-restore and the user's windows would stay minimized.
/// Instead the osascript child is spawned and *not* waited on: it outlives us.
pub fn restore_desktop_on_exit() {
    #[cfg(target_os = "macos")]
    {
        if !SWEEP_ACTIVE.swap(false, Ordering::SeqCst) {
            return;
        }
        let targets = match RESTORE_TARGETS.lock() {
            Ok(mut guard) => std::mem::take(&mut *guard),
            Err(_) => return,
        };
        if targets.is_empty() {
            return;
        }
        let _ = std::process::Command::new("/usr/bin/osascript")
            .arg("-e")
            .arg(build_restore_script(&targets))
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Snooze
// ═══════════════════════════════════════════════════════════════════════════

/// How long a snooze hides the overlay.
pub const SNOOZE_SECS: i64 = 5 * 60;

/// How long a snooze counts as "used" for its prayer. Comfortably longer than
/// any prayer's active lock window, so the single snooze cannot be renewed.
const SNOOZE_MEMORY_SECS: i64 = 3 * 60 * 60;

/// `(prayer, snoozed_at)` for recent snoozes.
///
/// The snooze used to live in the overlay webview's React state with a
/// `setTimeout` to bring the overlay back — but dismissing the overlay closes
/// that very webview, so the timer died with it and a snooze was a permanent
/// dismiss. It is owned by the backend now.
static SNOOZES: Mutex<Vec<(String, i64)>> = Mutex::new(Vec::new());

fn snooze_age(snoozes: &[(String, i64)], prayer: &str, now_ts: i64) -> Option<i64> {
    snoozes
        .iter()
        .filter(|(p, _)| p == prayer)
        .map(|(_, at)| now_ts - at)
        .filter(|age| *age >= 0)
        .min()
}

pub fn record_snooze(prayer: &str, now_ts: i64) {
    if let Ok(mut guard) = SNOOZES.lock() {
        guard.retain(|(_, at)| now_ts - at < SNOOZE_MEMORY_SECS);
        guard.push((prayer.to_string(), now_ts));
    }
}

/// True if this prayer's single snooze has already been spent.
pub fn was_snoozed(prayer: &str, now_ts: i64) -> bool {
    SNOOZES
        .lock()
        .ok()
        .and_then(|g| snooze_age(&g, prayer, now_ts))
        .is_some_and(|age| age < SNOOZE_MEMORY_SECS)
}

/// True while a snooze is counting down (plus a minute of slack for the
/// re-show). The missed-prayer scan must leave the prayer alone meanwhile,
/// exactly as it does for a live overlay.
pub fn snooze_pending(prayer: &str, now_ts: i64) -> bool {
    SNOOZES
        .lock()
        .ok()
        .and_then(|g| snooze_age(&g, prayer, now_ts))
        .is_some_and(|age| age < SNOOZE_SECS + 60)
}

// ═══════════════════════════════════════════════════════════════════════════
// Toast window
// ═══════════════════════════════════════════════════════════════════════════

pub fn spawn_toast_window(app: &AppHandle, prayer_name: &str, is_test: bool) -> Result<(), String> {
    let label = "toast-window";

    let mut query = vec![format!("screen=toast"), format!("prayer={}", prayer_name)];
    if is_test {
        query.push("is_test=true".to_string());
    }
    let url = format!("index.html?{}", query.join("&"));

    if let Some(existing) = app.get_webview_window(label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        harden_toast_window(&existing);
        return Ok(());
    }

    let toast_width = 360.0;
    let toast_height = 140.0;
    let margin = 24.0;

    let mut toast_x = 100.0;
    let mut toast_y = 100.0;

    if let Ok(Some(primary)) = app.primary_monitor() {
        let scale_factor = primary.scale_factor();
        let pos = primary.position().to_logical::<f64>(scale_factor);
        let size = primary.size().to_logical::<f64>(scale_factor);

        toast_x = pos.x + size.width - toast_width - margin;
        toast_y = pos.y + size.height - toast_height - margin;
    }

    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title("Waqt Countdown Toast")
        .position(toast_x, toast_y)
        .inner_size(toast_width, toast_height)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .fullscreen(false)
        .minimizable(false)
        .maximizable(false)
        .closable(false)
        .resizable(false)
        .shadow(false);

    let win = builder.build().map_err(|e| e.to_string())?;
    let _ = win.set_focus();

    harden_toast_window(&win);

    Ok(())
}

pub fn close_toast_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("toast-window") {
        let _ = win.close();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Overlay windows
// ═══════════════════════════════════════════════════════════════════════════

/// What the currently displayed overlay is for.
#[derive(Debug, Clone, PartialEq)]
struct OverlaySession {
    generation: u64,
    prayer: String,
    emergency_exhausted: bool,
    is_test: bool,
    /// Unix ms when this overlay generation first went up. Passed to every
    /// window as `started_at` so the forced pause counts down against the wall
    /// clock: each monitor's webview agrees, a window added for a new monitor
    /// does not restart the pause, and WebKit's throttling of timers in
    /// occluded windows cannot stretch it.
    started_at_ms: i64,
}

/// Source of truth for the live overlay.
///
/// This replaces reading `prayer=` back out of the window URL. That scheme had
/// two problems: the URL was never updated when a window was reused, so a
/// second prayer's overlay kept displaying the first prayer's name; and any
/// navigation inside the webview would have desynced it.
static ACTIVE_OVERLAY: Mutex<Option<OverlaySession>> = Mutex::new(None);

/// Bumped whenever a genuinely different overlay is shown. Window labels carry
/// the generation, so replacing one prayer's overlay with another never
/// collides with labels still being torn down.
static OVERLAY_GENERATION: AtomicU64 = AtomicU64::new(0);

fn overlay_label(generation: u64, monitor_index: usize) -> String {
    format!("overlay-{}-{}", generation, monitor_index)
}

fn parse_overlay_label(label: &str) -> Option<(u64, usize)> {
    let rest = label.strip_prefix("overlay-")?;
    let (generation, index) = rest.split_once('-')?;
    Some((generation.parse().ok()?, index.parse().ok()?))
}

/// Whether an incoming overlay request can reuse the live overlay's windows.
///
/// Reuse is only safe when every URL-borne parameter matches, because a reused
/// window keeps the URL it was built with.
fn needs_new_generation(
    current: Option<&OverlaySession>,
    prayer: &str,
    emergency_exhausted: bool,
    is_test: bool,
) -> bool {
    match current {
        Some(session) => {
            session.prayer != prayer
                || session.emergency_exhausted != emergency_exhausted
                || session.is_test != is_test
        }
        None => true,
    }
}

/// Clears the desktop, then puts one overlay window on every monitor.
///
/// # Threading
///
/// This blocks for as long as the minimize sweep takes (up to `SWEEP_TIMEOUT`).
/// **It must not be called on the main thread.** The Tauri commands that reach
/// it are declared `#[tauri::command(async)]` so they run on the worker pool,
/// and the scheduler wraps its calls in `spawn_blocking`.
pub fn spawn_overlay_windows(
    app: &AppHandle,
    prayer_name: &str,
    emergency_exhausted: bool,
    is_test: bool,
) -> Result<(), String> {
    // ── Step 0: decide whether this is the overlay already on screen (a
    //    re-show or a monitor re-sync) or a different one.
    let current = ACTIVE_OVERLAY.lock().ok().and_then(|guard| guard.clone());
    let is_new = needs_new_generation(current.as_ref(), prayer_name, emergency_exhausted, is_test);
    let started_at_ms = match (&current, is_new) {
        (Some(session), false) => session.started_at_ms,
        _ => chrono::Utc::now().timestamp_millis(),
    };
    let generation = if is_new {
        // Retire the old windows rather than calling `.show()` on them: the
        // reused window would still be rendering the previous prayer.
        // `close_overlay_windows_only` deliberately leaves the desktop cleared
        // and the restore snapshot intact — we are swapping overlays, not
        // dismissing one.
        close_overlay_windows_only(app);
        OVERLAY_GENERATION.fetch_add(1, Ordering::SeqCst) + 1
    } else {
        current.as_ref().map(|s| s.generation).unwrap_or(0)
    };

    // ── Step 1: clear the desktop. Runs to completion before any overlay
    //    window exists, which is the whole ordering guarantee. Failure is not
    //    fatal — a prayer overlay that cannot minimize is still better than no
    //    overlay — but it is reported to the frontend. The sweep guard makes
    //    this a no-op when an overlay is merely being replaced or re-synced.
    let prep = prepare_desktop_for_overlay(app, is_test);
    if matches!(
        prep,
        DesktopPrepOutcome::PermissionDenied | DesktopPrepOutcome::Failed { .. }
    ) {
        eprintln!("[Waqt] Showing overlay without a cleared desktop: {prep:?}");
    }

    // ── Step 2: build the overlay windows.
    let mut query = vec![format!("screen=overlay"), format!("prayer={}", prayer_name)];
    if emergency_exhausted {
        query.push("emergency_exhausted=true".to_string());
    }
    if was_snoozed(prayer_name, chrono::Local::now().timestamp()) {
        query.push("snoozed=true".to_string());
    }
    if is_test {
        query.push("is_test=true".to_string());
    }
    query.push(format!("started_at={started_at_ms}"));
    let url = format!("index.html?{}", query.join("&"));

    let outcome = build_overlay_windows(app, &url, generation);

    // ── Step 3: record what is on screen, so the next call can tell whether it
    //    is the same overlay.
    if outcome.is_ok() {
        if let Ok(mut guard) = ACTIVE_OVERLAY.lock() {
            *guard = Some(OverlaySession {
                generation,
                prayer: prayer_name.to_string(),
                emergency_exhausted,
                is_test,
                started_at_ms,
            });
        }
    }

    outcome
}

fn build_overlay_windows(app: &AppHandle, url: &str, generation: u64) -> Result<(), String> {
    let monitors = match app.available_monitors() {
        Ok(m) if !m.is_empty() => m,
        _ => return spawn_single_overlay(app, &overlay_label(generation, 0), url),
    };

    let mut spawned_any = false;
    let mut created_any = false;

    for (idx, monitor) in monitors.iter().enumerate() {
        let label = overlay_label(generation, idx);
        if let Some(existing) = app.get_webview_window(&label) {
            let _ = existing.show();
            // Re-assert level and Space behavior, but do NOT re-activate the
            // app: this branch is hit by `sync_overlay_monitors` on every
            // scheduler tick, and activating there stole focus every 10s.
            // Reaching here means the label matched, which now implies the
            // generation matched, which implies the URL is already correct.
            harden_window(&existing, false);
            spawned_any = true;
            continue;
        }

        let scale_factor = monitor.scale_factor();
        let logical_pos = monitor.position().to_logical::<f64>(scale_factor);
        let logical_size = monitor.size().to_logical::<f64>(scale_factor);

        let window_result =
            WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.to_string().into()))
                .title("Waqt Overlay")
                .position(logical_pos.x, logical_pos.y)
                .inner_size(logical_size.width, logical_size.height)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .fullscreen(false)
                .minimizable(false)
                .maximizable(false)
                .closable(false)
                .resizable(false)
                .shadow(false)
                .build();

        if let Ok(win) = window_result {
            harden_window(&win, false);
            spawned_any = true;
            created_any = true;
        }
    }

    if !spawned_any {
        return spawn_single_overlay(app, &overlay_label(generation, 0), url);
    }

    // One activation for the whole set, not one per monitor.
    if created_any {
        activate_app(app);
    }

    Ok(())
}

fn spawn_single_overlay(app: &AppHandle, label: &str, url: &str) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(label) {
        let _ = existing.show();
        harden_window(&existing, false);
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title("Waqt Overlay")
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .fullscreen(false)
        .minimizable(false)
        .maximizable(false)
        .closable(false)
        .resizable(false)
        .shadow(false);

    if let Ok(Some(primary)) = app.primary_monitor() {
        let scale_factor = primary.scale_factor();
        let pos = primary.position().to_logical::<f64>(scale_factor);
        let size = primary.size().to_logical::<f64>(scale_factor);
        builder = builder
            .position(pos.x, pos.y)
            .inner_size(size.width, size.height);
    }

    let win = builder.build().map_err(|e| e.to_string())?;
    harden_window(&win, false);
    activate_app(app);

    Ok(())
}

pub fn has_active_overlay(app: &AppHandle) -> bool {
    app.webview_windows()
        .keys()
        .any(|k| k.starts_with("overlay-"))
}

/// The prayer the live overlay is for, if any.
///
/// Read from `ACTIVE_OVERLAY` rather than parsed out of a window URL, and
/// cross-checked against the windows actually being open so a stale session
/// record can never make the scheduler think an overlay is up.
pub fn get_active_overlay_info(app: &AppHandle) -> Option<(String, bool, bool)> {
    if !has_active_overlay(app) {
        return None;
    }
    let session = ACTIVE_OVERLAY.lock().ok()?.clone()?;
    Some((session.prayer, session.emergency_exhausted, session.is_test))
}

pub fn sync_overlay_monitors(app: &AppHandle) {
    let Some((prayer_name, emergency_exhausted, is_test)) = get_active_overlay_info(app) else {
        return;
    };

    // Params match the live session by construction, so this reuses the current
    // generation: no desktop sweep, no rebuild, no re-activation.
    let _ = spawn_overlay_windows(app, &prayer_name, emergency_exhausted, is_test);

    let current_generation = OVERLAY_GENERATION.load(Ordering::SeqCst);
    if let Ok(monitors) = app.available_monitors() {
        let active_count = monitors.len();
        for (label, win) in app.webview_windows() {
            if let Some((generation, index)) = parse_overlay_label(&label) {
                // Close windows for monitors that went away, and any stragglers
                // left over from a previous overlay generation.
                if generation != current_generation || index >= active_count {
                    let _ = win.close();
                }
            }
        }
    }
}

/// Closes the overlay windows and leaves the desktop alone.
///
/// Used when one overlay replaces another (a different prayer, or the emergency
/// re-lock): the windows must be rebuilt to pick up the new URL, but the
/// desktop should stay cleared and the restore snapshot must survive.
fn close_overlay_windows_only(app: &AppHandle) {
    for (label, win) in app.webview_windows() {
        if label.starts_with("overlay-") {
            let _ = win.close();
        }
    }
}

pub fn close_all_overlays(app: &AppHandle) {
    close_overlay_windows_only(app);

    if let Ok(mut guard) = ACTIVE_OVERLAY.lock() {
        *guard = None;
    }

    release_lockdown(app);
    #[cfg(target_os = "macos")]
    YIELDED_TO_FORCE_QUIT.store(false, Ordering::SeqCst);

    // Replaces the old NSWorkspace `unhide()` loop, which reversed Cmd+H
    // hiding — something the app never did — and left every window it
    // minimized sitting in the Dock. It also ran AppKit calls on whatever
    // thread the Tauri command landed on; this path touches no AppKit at all.
    restore_desktop_after_overlay();
}

// ═══════════════════════════════════════════════════════════════════════════
// Native window hardening
// ═══════════════════════════════════════════════════════════════════════════

/// Dispatches NSWindow hardening to the main thread.
/// All AppKit/NSWindow APIs are main-thread-only on macOS; calling them from
/// any other thread causes SIGILL. `run_on_main_thread` guarantees the closure
/// executes on the UI thread regardless of where `harden_window` was called from.
fn harden_window(win: &tauri::WebviewWindow, bring_to_front: bool) {
    #[cfg(target_os = "macos")]
    {
        let win_for_closure = win.clone();
        let _ = win.run_on_main_thread(move || {
            harden_macos(&win_for_closure, bring_to_front);
        });
    }
    #[cfg(target_os = "windows")]
    {
        let _ = bring_to_front;
        harden_windows(win);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (win, bring_to_front);
    }
}

/// Activates the app and puts it into kiosk presentation mode for as long as
/// an overlay is up. See `lockdown_presentation_options`.
fn activate_app(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let _ = app.run_on_main_thread(|| unsafe {
            use objc2_app_kit::NSApplication;
            let mtm = objc2::MainThreadMarker::new_unchecked();
            let ns_app = NSApplication::sharedApplication(mtm);
            force_activate(&ns_app);
            ns_app.setPresentationOptions(lockdown_presentation_options());
        });
    }
    #[cfg(target_os = "windows")]
    {
        // A low-level hook must live on a thread that pumps messages: the
        // main (event loop) thread does.
        let _ = app.run_on_main_thread(win_keyboard::install);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = app;
    }
}

/// Drops kiosk presentation mode. Called when the last overlay is dismissed.
fn release_lockdown(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let _ = app.run_on_main_thread(|| unsafe {
            use objc2_app_kit::{NSApplication, NSApplicationPresentationOptions};
            let mtm = objc2::MainThreadMarker::new_unchecked();
            NSApplication::sharedApplication(mtm)
                .setPresentationOptions(NSApplicationPresentationOptions::Default);
        });
    }
    #[cfg(target_os = "windows")]
    {
        let _ = app.run_on_main_thread(win_keyboard::uninstall);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = app;
    }
}

/// Windows counterpart of macOS kiosk mode: a low-level keyboard hook that
/// swallows the shell's switching shortcuts while an overlay is live. The
/// webview's own key interceptor never sees these — the shell handles them
/// before any window gets the keystroke.
///
/// Blocked: both Windows keys (Start, Win+Tab, Win+D, Win+Ctrl+←/→ virtual
/// desktop switching, …), Alt+Tab, Alt+Esc, Ctrl+Esc and Alt+F4.
///
/// Deliberately **not** blocked, as the Windows equivalent of macOS Force
/// Quit (AGENTS.md §1.2): Ctrl+Shift+Esc (Task Manager) — and Ctrl+Alt+Del,
/// which Windows never lets an app intercept anyway.
#[cfg(target_os = "windows")]
mod win_keyboard {
    use std::sync::atomic::{AtomicIsize, Ordering};
    use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_CONTROL, VK_ESCAPE, VK_F4, VK_LWIN, VK_RWIN, VK_SHIFT, VK_TAB,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, SetWindowsHookExW, UnhookWindowsHookEx, HC_ACTION, KBDLLHOOKSTRUCT,
        LLKHF_ALTDOWN, WH_KEYBOARD_LL,
    };

    static HOOK: AtomicIsize = AtomicIsize::new(0);

    pub fn install() {
        if HOOK.load(Ordering::SeqCst) != 0 {
            return;
        }
        // SAFETY: plain Win32 calls; `hook_proc` matches HOOKPROC.
        let hook = unsafe {
            SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook_proc), GetModuleHandleW(std::ptr::null()), 0)
        };
        if hook.is_null() {
            eprintln!("[Waqt] Could not install the overlay keyboard hook.");
        } else {
            HOOK.store(hook as isize, Ordering::SeqCst);
        }
    }

    pub fn uninstall() {
        let hook = HOOK.swap(0, Ordering::SeqCst);
        if hook != 0 {
            // SAFETY: `hook` came from SetWindowsHookExW and is unhooked once.
            unsafe { UnhookWindowsHookEx(hook as _) };
        }
    }

    fn key_down(vk: u16) -> bool {
        // SAFETY: no preconditions.
        unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 }
    }

    /// Pure policy, so it can be reasoned about apart from the hook plumbing.
    pub(super) fn should_block(vk: u32, alt: bool, ctrl: bool, shift: bool) -> bool {
        let vk = vk as u16;
        vk == VK_LWIN
            || vk == VK_RWIN
            || (vk == VK_TAB && alt)
            || (vk == VK_F4 && alt)
            || (vk == VK_ESCAPE && alt)
            // Ctrl+Esc opens Start; Ctrl+Shift+Esc (Task Manager) stays open.
            || (vk == VK_ESCAPE && ctrl && !shift)
    }

    unsafe extern "system" fn hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            let info = &*(lparam as *const KBDLLHOOKSTRUCT);
            let alt = info.flags & LLKHF_ALTDOWN != 0;
            if should_block(info.vkCode, alt, key_down(VK_CONTROL), key_down(VK_SHIFT)) {
                return 1;
            }
        }
        CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
    }
}

/// Kiosk options applied while an overlay is live.
///
/// `DisableProcessSwitching` turns off ⌘Tab *and* Mission Control / Spaces
/// switching (including the three-finger swipe) while Waqt is the active app —
/// the window level alone cannot stop the user swiping to another Space.
/// AppKit throws on invalid combinations: `HideMenuBar` and
/// `DisableProcessSwitching` both require `HideDock`, which is present.
///
/// `DisableForceQuit` is deliberately **absent**: ⌘⌥Esc is the documented
/// escape hatch on the re-lock overlay (AGENTS.md §1.2).
#[cfg(target_os = "macos")]
fn lockdown_presentation_options() -> objc2_app_kit::NSApplicationPresentationOptions {
    use objc2_app_kit::NSApplicationPresentationOptions as O;
    O::HideDock | O::HideMenuBar | O::DisableProcessSwitching | O::DisableHideApplication
}

/// Activates regardless of what the user is doing in another app.
///
/// `-[NSApplication activate]` only exists on macOS 14+; calling it on an
/// older system is an unrecognized-selector crash, and `minimumSystemVersion`
/// is 10.15. It is also cooperative, so it can decline to activate. The
/// deprecated `activateIgnoringOtherApps:` works on every supported version.
#[cfg(target_os = "macos")]
fn force_activate(ns_app: &objc2_app_kit::NSApplication) {
    #[allow(deprecated)]
    ns_app.activateIgnoringOtherApps(true);
}

fn harden_toast_window(win: &tauri::WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        let win_for_closure = win.clone();
        let _ = win.run_on_main_thread(move || {
            harden_macos(&win_for_closure, true);
        });
    }
    #[cfg(target_os = "windows")]
    {
        harden_windows(win);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = win;
    }
}

/// Applies Win32 top-most Z-order elevation and toolwindow style flags on Windows.
#[cfg(target_os = "windows")]
fn harden_windows(win: &tauri::WebviewWindow) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_TOPMOST, SWP_NOMOVE,
        SWP_NOSIZE, SWP_SHOWWINDOW, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
    };

    if let Ok(hwnd_raw) = win.hwnd() {
        let hwnd = hwnd_raw.0 as HWND;
        unsafe {
            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            SetWindowLongPtrW(
                hwnd,
                GWL_EXSTYLE,
                ex_style | (WS_EX_TOOLWINDOW | WS_EX_TOPMOST) as isize,
            );

            SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
            );
        }
    }
}

// NSWindowLevel: i32::MAX (2147483647) = Maximum Window Level (CGShieldingWindowLevel)
#[cfg(target_os = "macos")]
const MAXIMUM_WINDOW_LEVEL: isize = i32::MAX as isize;

#[cfg(target_os = "macos")]
const NORMAL_WINDOW_LEVEL: isize = 0;

/// Owner of the ⌘⌥Esc "Force Quit Applications" panel.
#[cfg(target_os = "macos")]
const FORCE_QUIT_OWNER: &str = "com.apple.loginwindow";

/// True while the overlay has stepped down to normal level so the Force Quit
/// panel can be seen. Read by `harden_macos`, so the scheduler's per-tick
/// `sync_overlay_monitors` does not slam the level back up over the panel.
#[cfg(target_os = "macos")]
static YIELDED_TO_FORCE_QUIT: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "macos")]
fn current_overlay_level() -> isize {
    if YIELDED_TO_FORCE_QUIT.load(Ordering::SeqCst) {
        NORMAL_WINDOW_LEVEL
    } else {
        MAXIMUM_WINDOW_LEVEL
    }
}

/// Whether the overlay should step aside for the app that just took focus.
#[cfg(target_os = "macos")]
fn should_yield_to(frontmost_bundle_id: Option<&str>) -> bool {
    frontmost_bundle_id == Some(FORCE_QUIT_OWNER)
}

/// Keeps Force Quit — the documented escape hatch on the re-lock overlay
/// (AGENTS.md §1.2) — usable. At `i32::MAX` the overlay sits above the
/// ⌘⌥Esc panel, which then opens invisibly behind it. When an overlay window
/// loses focus to loginwindow (the panel's owner) every overlay window drops
/// to normal level, still covering the desktop but under the panel; regaining
/// focus restores the maximum level.
///
/// Called from the overlay webview's `blur` / `focus` events. On blur the
/// frontmost-app switch can land a beat after the window resigns key, so it
/// is checked a few times.
pub fn overlay_focus_changed(app: &AppHandle, focused: bool) {
    #[cfg(target_os = "macos")]
    {
        if focused {
            if YIELDED_TO_FORCE_QUIT.swap(false, Ordering::SeqCst) {
                set_overlay_levels(app, MAXIMUM_WINDOW_LEVEL);
            }
            return;
        }
        let app = app.clone();
        std::thread::spawn(move || {
            for delay_ms in [0u64, 150, 400, 1000] {
                std::thread::sleep(Duration::from_millis(delay_ms));
                let (tx, rx) = std::sync::mpsc::channel();
                let _ = app.run_on_main_thread(move || {
                    use objc2_app_kit::NSWorkspace;
                    let front = NSWorkspace::sharedWorkspace()
                        .frontmostApplication()
                        .and_then(|a| a.bundleIdentifier())
                        .map(|s| s.to_string());
                    let _ = tx.send(front);
                });
                let front = rx.recv_timeout(Duration::from_secs(1)).ok().flatten();
                if should_yield_to(front.as_deref()) {
                    YIELDED_TO_FORCE_QUIT.store(true, Ordering::SeqCst);
                    set_overlay_levels(&app, NORMAL_WINDOW_LEVEL);
                    return;
                }
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, focused);
    }
}

#[cfg(target_os = "macos")]
fn set_overlay_levels(app: &AppHandle, level: isize) {
    for (label, win) in app.webview_windows() {
        if !label.starts_with("overlay-") {
            continue;
        }
        let w = win.clone();
        let _ = win.run_on_main_thread(move || {
            if let Ok(ptr) = w.ns_window() {
                let ns_win = ptr as *mut objc2_app_kit::NSWindow;
                if !ns_win.is_null() {
                    // SAFETY: main thread (run_on_main_thread), non-null NSWindow.
                    unsafe { (*ns_win).setLevel(level) };
                }
            }
        });
    }
}

/// Called exclusively from within `run_on_main_thread`, so the main-thread
/// invariant required by AppKit is always satisfied.
#[cfg(target_os = "macos")]
fn harden_macos(win: &tauri::WebviewWindow, bring_to_front: bool) {
    use objc2_app_kit::NSWindow;

    // CanJoinAllSpaces (1) | Stationary (16) | IgnoresCycle (64) | FullScreenAuxiliary (256)
    const COLLECTION_BEHAVIOR: usize = 1 | 16 | 64 | 256;

    const MASK_MINIATURIZABLE: usize = 1 << 2;
    const MASK_RESIZABLE: usize = 1 << 3;

    let ns_window_ptr = match win.ns_window() {
        Ok(ptr) => ptr,
        Err(e) => {
            eprintln!("[Waqt] ns_window() failed: {e}");
            return;
        }
    };

    // SAFETY: We are on the main thread (enforced by run_on_main_thread).
    unsafe {
        let ns_win: *mut NSWindow = ns_window_ptr as *mut NSWindow;
        if ns_win.is_null() {
            return;
        }
        let ns_win_ref = &*ns_win;

        ns_win_ref.setLevel(current_overlay_level());
        ns_win_ref.setCollectionBehavior(objc2_app_kit::NSWindowCollectionBehavior(
            COLLECTION_BEHAVIOR,
        ));

        let current_mask = ns_win_ref.styleMask();
        let new_mask = objc2_app_kit::NSWindowStyleMask(
            current_mask.0 & !(MASK_MINIATURIZABLE | MASK_RESIZABLE),
        );
        ns_win_ref.setStyleMask(new_mask);

        ns_win_ref.setCanHide(false);
        ns_win_ref.setHidesOnDeactivate(false);

        ns_win_ref.orderFrontRegardless();

        if bring_to_front {
            use objc2_app_kit::NSApplication;
            let mtm = objc2::MainThreadMarker::new_unchecked();
            force_activate(&NSApplication::sharedApplication(mtm));
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn sweep_script_exits_fullscreen_before_miniaturizing() {
        let script = build_minimize_script(4242, &[]);

        // The bug this replaces: minimizing alone cannot touch a window in a
        // native fullscreen Space.
        let fullscreen_at = script
            .find("set value of attribute \"AXFullScreen\"")
            .expect("script must clear AXFullScreen");
        let miniaturize_at = script
            .find("set value of attribute \"AXMinimized\" of window i of proc to true")
            .expect("script must miniaturize");
        assert!(
            fullscreen_at < miniaturize_at,
            "fullscreen must be exited before miniaturizing"
        );
    }

    #[test]
    fn sweep_script_skips_daemons_and_our_own_process() {
        let script = build_minimize_script(4242, &[]);
        assert!(script.contains("whose background only is false"));
        assert!(script.contains("set myPid to 4242"));
        assert!(script.contains("if procPid is not myPid then"));
    }

    #[test]
    fn sweep_script_only_records_windows_it_changed() {
        let script = build_minimize_script(1, &[]);
        // Already-minimized windows must not enter the restore list, or
        // dismissing the overlay would un-minimize the user's own windows.
        assert!(script
            .contains("if (value of attribute \"AXMinimized\" of window i of proc) is false then"));
    }

    #[test]
    fn sweep_script_never_uses_the_unimplemented_miniaturized_property() {
        // Stick to the AX attribute; a `miniaturized` failure would be
        // swallowed by the surrounding `try` and minimize nothing.
        assert!(!build_minimize_script(1, &[7]).contains("miniaturized"));
        assert!(!build_restore_script(&[RestoreTarget {
            op: 'M',
            process: "Safari".into(),
            index: 1,
            title: "x".into(),
        }])
        .contains("miniaturized"));
    }

    #[test]
    fn sweep_script_visits_offspace_fullscreen_apps_first() {
        let script = build_minimize_script(1, &[501, 777]);
        assert!(script.contains("set offspacePids to {501, 777}"));
        let pass1 = script.find("repeat with targetPid in offspacePids").unwrap();
        let pass2 = script.find("set procList to every application process").unwrap();
        assert!(pass1 < pass2);
        assert!(build_minimize_script(1, &[]).contains("set offspacePids to {}"));
    }

    #[test]
    fn generated_applescript_compiles() {
        // Catches syntax errors that would otherwise only surface as a
        // `Failed` sweep at prayer time. osacompile only parses; nothing runs.
        let dir = std::env::temp_dir().join(format!("waqt-osacompile-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let restore = build_restore_script(&[
            RestoreTarget { op: 'M', process: "Safari".into(), index: 1, title: "A \"b\"".into() },
            RestoreTarget { op: 'F', process: "Code".into(), index: 2, title: String::new() },
        ]);
        for (name, script) in [
            ("sweep", build_minimize_script(42, &[501, 777])),
            ("sweep_empty", build_minimize_script(42, &[])),
            ("restore", restore),
        ] {
            let out = std::process::Command::new("/usr/bin/osacompile")
                .arg("-o")
                .arg(dir.join(format!("{name}.scpt")))
                .arg("-e")
                .arg(&script)
                .output()
                .unwrap();
            assert!(
                out.status.success(),
                "{name} failed to compile: {}",
                String::from_utf8_lossy(&out.stderr)
            );
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn yields_only_to_the_force_quit_panel() {
        assert!(should_yield_to(Some("com.apple.loginwindow")));
        assert!(!should_yield_to(Some("com.apple.Safari")));
        assert!(!should_yield_to(None));
    }

    #[test]
    fn parses_offspace_pid_list() {
        assert_eq!(parse_pid_list("414,9,414, 12\n", 9), vec![414, 12]);
        assert!(parse_pid_list("", 1).is_empty());
        assert!(parse_pid_list("abc,0", 1).is_empty());
    }

    #[test]
    fn sweep_timeout_scales_with_offspace_apps_but_is_capped() {
        assert_eq!(sweep_timeout_for(0), SWEEP_TIMEOUT);
        assert_eq!(sweep_timeout_for(2), SWEEP_TIMEOUT + Duration::from_secs(6));
        assert_eq!(sweep_timeout_for(50), SWEEP_TIMEOUT_MAX);
    }

    #[test]
    fn parses_sweep_output() {
        let out = "M\tSafari\t1\tApple\nF\tCode\t2\tmain.rs\nM\tTerminal\t3\t\n";
        let targets = parse_sweep_output(out);
        assert_eq!(targets.len(), 3);
        assert_eq!(targets[0].op, 'M');
        assert_eq!(targets[0].process, "Safari");
        assert_eq!(targets[0].index, 1);
        assert_eq!(targets[0].title, "Apple");
        assert_eq!(targets[1].op, 'F');
        assert_eq!(targets[2].title, "");
    }

    #[test]
    fn parses_titles_containing_tabs() {
        let targets = parse_sweep_output("M\tSafari\t1\tA\tB\n");
        assert_eq!(targets.len(), 1);
        assert_eq!(targets[0].title, "A\tB");
    }

    #[test]
    fn ignores_malformed_sweep_lines() {
        assert!(parse_sweep_output("\n\nnonsense\nX\tA\t1\tT\n").is_empty());
    }

    #[test]
    fn restore_unminimizes_before_re_entering_fullscreen() {
        let targets = vec![
            RestoreTarget {
                op: 'F',
                process: "Code".into(),
                index: 2,
                title: "main.rs".into(),
            },
            RestoreTarget {
                op: 'M',
                process: "Code".into(),
                index: 2,
                title: "main.rs".into(),
            },
        ];
        let script = build_restore_script(&targets);
        let unmin = script.find("AXMinimized\" of _w to false").unwrap();
        let refull = script.find("AXFullScreen\" of _w to true").unwrap();
        assert!(
            unmin < refull,
            "a miniaturized window cannot enter fullscreen"
        );
    }

    #[test]
    fn restore_escapes_quotes_in_window_titles() {
        let targets = vec![RestoreTarget {
            op: 'M',
            process: "Note\"s".into(),
            index: 1,
            title: "a \"quoted\" title".into(),
        }];
        let script = build_restore_script(&targets);
        assert!(script.contains("Note\\\"s"));
        assert!(script.contains("a \\\"quoted\\\" title"));
    }

    #[test]
    fn restore_falls_back_to_index_for_untitled_windows() {
        let targets = vec![RestoreTarget {
            op: 'M',
            process: "Preview".into(),
            index: 7,
            title: String::new(),
        }];
        let script = build_restore_script(&targets);
        assert!(script.contains("set _w to window 7 of _p"));
        assert!(!script.contains("whose name is"));
    }

    #[test]
    fn detects_tcc_denials_but_not_ordinary_script_errors() {
        assert!(is_permission_error(
            "execution error: Not authorized to send Apple events to System Events. (-1743)"
        ));
        assert!(is_permission_error("osascript is not allowed assistive access. (-25211)"));
        assert!(!is_permission_error(
            "execution error: System Events got an error: Can't get window 1. (-1728)"
        ));
    }
}

#[cfg(test)]
mod overlay_session_tests {
    use super::*;

    #[test]
    fn snooze_age_tracks_the_latest_snooze_for_that_prayer_only() {
        let snoozes = vec![("Dhuhr".to_string(), 1_000), ("Asr".to_string(), 5_000)];
        assert_eq!(snooze_age(&snoozes, "Dhuhr", 1_300), Some(300));
        assert_eq!(snooze_age(&snoozes, "Maghrib", 1_300), None);
        // A snooze recorded "in the future" (clock moved back) is ignored.
        assert_eq!(snooze_age(&snoozes, "Asr", 1_300), None);
    }

    fn session(prayer: &str, emergency: bool, test: bool) -> OverlaySession {
        OverlaySession {
            generation: 7,
            prayer: prayer.to_string(),
            emergency_exhausted: emergency,
            is_test: test,
            started_at_ms: 0,
        }
    }

    #[test]
    fn same_overlay_reuses_its_windows() {
        let live = session("Dhuhr", false, false);
        assert!(!needs_new_generation(Some(&live), "Dhuhr", false, false));
    }

    #[test]
    fn a_different_prayer_forces_a_rebuild() {
        // The bug this guards: `.show()` on a reused window left the previous
        // prayer's URL — and therefore the previous prayer's name — on screen.
        let live = session("Dhuhr", false, false);
        assert!(needs_new_generation(Some(&live), "Asr", false, false));
    }

    #[test]
    fn emergency_relock_forces_a_rebuild() {
        // Same prayer, but `emergency_exhausted=true` must reach the webview.
        let live = session("Maghrib", false, false);
        assert!(needs_new_generation(Some(&live), "Maghrib", true, false));
    }

    #[test]
    fn test_mode_change_forces_a_rebuild() {
        let live = session("Isha", false, true);
        assert!(needs_new_generation(Some(&live), "Isha", false, false));
    }

    #[test]
    fn no_live_overlay_always_needs_a_generation() {
        assert!(needs_new_generation(None, "Fajr", false, false));
    }

    #[test]
    fn overlay_labels_round_trip() {
        assert_eq!(overlay_label(3, 2), "overlay-3-2");
        assert_eq!(parse_overlay_label("overlay-3-2"), Some((3, 2)));
        assert_eq!(parse_overlay_label("overlay-12-0"), Some((12, 0)));
    }

    #[test]
    fn non_overlay_labels_are_ignored() {
        assert_eq!(parse_overlay_label("main"), None);
        assert_eq!(parse_overlay_label("toast-window"), None);
        // The old fallback label must not parse as a generation.
        assert_eq!(parse_overlay_label("overlay-primary"), None);
    }
}
