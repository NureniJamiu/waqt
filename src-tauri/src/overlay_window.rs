use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn spawn_overlay_windows(app: &AppHandle, prayer_name: &str, emergency_exhausted: bool, is_test: bool) -> Result<(), String> {
    let mut query = vec![format!("screen=overlay"), format!("prayer={}", prayer_name)];
    if emergency_exhausted {
        query.push("emergency_exhausted=true".to_string());
    }
    if is_test {
        query.push("is_test=true".to_string());
    }
    let url = format!("index.html?{}", query.join("&"));

    let monitors_res = app.available_monitors();

    let monitors = match monitors_res {
        Ok(m) if !m.is_empty() => m,
        _ => {
            return spawn_single_overlay(app, "overlay-primary", &url, is_test);
        }
    };

    let mut spawned_any = false;
    for (idx, monitor) in monitors.iter().enumerate() {
        let label = format!("overlay-monitor-{}", idx);
        if let Some(existing) = app.get_webview_window(&label) {
            let _ = existing.show();
            let _ = existing.set_focus();
            harden_window(&existing, is_test);
            spawned_any = true;
            continue;
        }

        let pos = monitor.position();
        let size = monitor.size();
        let scale_factor = monitor.scale_factor();
        let logical_pos = pos.to_logical::<f64>(scale_factor);
        let logical_size = size.to_logical::<f64>(scale_factor);

        let window_result = WebviewWindowBuilder::new(
            app,
            &label,
            WebviewUrl::App(url.clone().into()),
        )
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
            let _ = win.set_focus();
            harden_window(&win, is_test);
            spawned_any = true;
        }
    }

    if !spawned_any {
        return spawn_single_overlay(app, "overlay-primary", &url, is_test);
    }

    Ok(())
}

pub fn has_active_overlay(app: &AppHandle) -> bool {
    app.webview_windows().keys().any(|k| k.starts_with("overlay-"))
}

pub fn get_active_overlay_info(app: &AppHandle) -> Option<(String, bool, bool)> {
    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("overlay-") {
            if let Ok(url_val) = win.url() {
                let url_str = url_val.as_str();
                let is_emergency = url_str.contains("emergency_exhausted=true");
                let is_test = url_str.contains("is_test=true");
                if let Some(pos) = url_str.find("prayer=") {
                    let after = &url_str[pos + 7..];
                    let prayer = after.split('&').next().unwrap_or("Dhuhr").to_string();
                    return Some((prayer, is_emergency, is_test));
                }
            }
        }
    }
    None
}

pub fn sync_overlay_monitors(app: &AppHandle) {
    if let Some((prayer_name, emergency_exhausted, is_test)) = get_active_overlay_info(app) {
        let _ = spawn_overlay_windows(app, &prayer_name, emergency_exhausted, is_test);
        if let Ok(monitors) = app.available_monitors() {
            let active_count = monitors.len();
            for (label, win) in app.webview_windows() {
                if let Some(idx_str) = label.strip_prefix("overlay-monitor-") {
                    if let Ok(idx) = idx_str.parse::<usize>() {
                        if idx >= active_count {
                            let _ = win.close();
                        }
                    }
                }
            }
        }
    }
}



fn spawn_single_overlay(app: &AppHandle, label: &str, url: &str, is_test: bool) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        harden_window(&existing, is_test);
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(
        app,
        label,
        WebviewUrl::App(url.into()),
    )
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
        builder = builder.position(pos.x, pos.y).inner_size(size.width, size.height);
    }

    let win = builder.build().map_err(|e| e.to_string())?;

    harden_window(&win, is_test);

    Ok(())
}

/// Dispatches NSWindow hardening to the main thread.
/// All AppKit/NSWindow APIs are main-thread-only on macOS; calling them from
/// any other thread causes SIGILL. `run_on_main_thread` guarantees the closure
/// executes on the UI thread regardless of where `harden_window` was called from.
fn harden_window(win: &tauri::WebviewWindow, is_test: bool) {
    #[cfg(target_os = "macos")]
    {
        let win_for_closure = win.clone();
        // Ignore errors — if the dispatch fails the window still shows,
        // just without the extra NSWindow hardening.
        let _ = win.run_on_main_thread(move || {
            harden_macos(&win_for_closure, is_test);
        });
    }
    #[cfg(target_os = "windows")]
    {
        let _ = is_test;
        harden_windows(win);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (win, is_test);
    }
}

/// Applies Win32 top-most Z-order elevation and toolwindow style flags on Windows.
#[cfg(target_os = "windows")]
fn harden_windows(win: &tauri::WebviewWindow) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_TOPMOST,
        SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
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

/// Called exclusively from within `run_on_main_thread`, so the main-thread
/// invariant required by AppKit is always satisfied.
#[cfg(target_os = "macos")]
fn harden_macos(win: &tauri::WebviewWindow, is_test: bool) {
    use objc2_app_kit::{NSApplication, NSWindow};

    // NSWindowLevel: i32::MAX (2147483647) = Maximum Window Level (CGShieldingWindowLevel)
    // Sits above Dock, Spotlight, menu bar, notification banners, Mission Control,
    // Space transition animations, and all Fullscreen Spaces.
    const MAXIMUM_WINDOW_LEVEL: isize = i32::MAX as isize;

    // NSWindowCollectionBehavior flags (values are NSUInteger / usize):
    // CanJoinAllSpaces    = 1 << 0 = 1   → visible on every Space
    // Stationary         = 1 << 4 = 16  → pinned; doesn't move in Mission Control or Space transitions
    // IgnoresCycle       = 1 << 6 = 64  → excluded from ⌘+Tab switcher
    // FullScreenAuxiliary = 1 << 8 = 256 → floats above fullscreen spaces without entering a separate space
    const COLLECTION_BEHAVIOR: usize = 1 | 16 | 64 | 256;

    // NSWindowStyleMask bits to strip:
    // Miniaturizable = 1 << 2 = 4  → ⌘+M becomes a no-op
    // Resizable      = 1 << 3 = 8
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
    // ns_window() returns a valid, retained *mut NSWindow pointer that is alive
    // for the duration of this closure because the WebviewWindow clone keeps it so.
    unsafe {
        let ns_win: *mut NSWindow = ns_window_ptr as *mut NSWindow;
        if ns_win.is_null() {
            return;
        }
        let ns_win_ref = &*ns_win;

        // 1. Elevate to Maximum Window Level (2147483647) — sits above everything in macOS
        //    including Fullscreen Spaces, Space transitions, Dock, and Mission Control.
        ns_win_ref.setLevel(MAXIMUM_WINDOW_LEVEL);

        // 2. Exclude from Mission Control / Exposé / ⌘+Tab; appear on all Spaces.
        ns_win_ref.setCollectionBehavior(
            objc2_app_kit::NSWindowCollectionBehavior(COLLECTION_BEHAVIOR),
        );

        // 3. Strip Miniaturizable + Resizable from the style mask so ⌘+M is inert.
        let current_mask = ns_win_ref.styleMask();
        let new_mask = objc2_app_kit::NSWindowStyleMask(
            current_mask.0 & !(MASK_MINIATURIZABLE | MASK_RESIZABLE),
        );
        ns_win_ref.setStyleMask(new_mask);

        // 4. Prevent hiding on app switch or ⌘+H
        ns_win_ref.setCanHide(false);
        ns_win_ref.setHidesOnDeactivate(false);

        // 5. Before bringing overlay to front, minimize all other app windows asynchronously if not in test mode.
        if !is_test {
            std::thread::spawn(|| {
                minimize_all_other_windows();
            });
        }

        // 6. Bring to front unconditionally (works even when app is not active).
        ns_win_ref.orderFrontRegardless();

        // 7. Activate our app so keyboard events route here.
        let mtm = objc2::MainThreadMarker::new_unchecked();
        let app = NSApplication::sharedApplication(mtm);
        app.activate();
    }
}

#[cfg(target_os = "macos")]
pub fn build_minimize_all_windows_script() -> String {
    r#"
    tell application "System Events"
        repeat with proc in every application process
            if name of proc is not "waqt" then
                try
                    repeat with aWindow in windows of proc
                        set miniaturized of aWindow to true
                    end repeat
                end try
            end if
        end repeat
    end tell
    "#
    .trim()
    .to_string()
}

#[cfg(target_os = "macos")]
pub fn has_accessibility_permission() -> bool {
    let result = std::process::Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to return name of every application process")
        .output();

    match result {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

/// Trigger the native macOS "Allow Accessibility Access" dialog by calling
/// AXIsProcessTrustedWithOptions with kAXTrustedCheckOptionPrompt = true.
/// If the permission is already granted it returns true immediately.
/// If not, it shows the system prompt and opens System Preferences to the
/// Accessibility pane so the user can grant it, then returns false (the user
/// must toggle the switch in System Preferences — we cannot grant it for them).
#[cfg(target_os = "macos")]
pub fn request_accessibility_permission() -> bool {
    // Call AXIsProcessTrustedWithOptions via osascript to avoid linking against
    // ApplicationServices directly. The osascript attempt itself triggers the prompt.
    // First try the direct CF approach via a small osascript that accesses System Events
    // (which forces the AX prompt), then open System Preferences for manual granting.
    let already_granted = has_accessibility_permission();
    if already_granted {
        return true;
    }

    // Opening System Preferences to the Accessibility pane causes macOS to
    // show the "Allow Waqt to control your computer" system alert.
    open_accessibility_settings();
    false
}

#[cfg(not(target_os = "macos"))]
pub fn has_accessibility_permission() -> bool {
    // Non-macOS platforms don't need this permission.
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

#[cfg(target_os = "macos")]
fn minimize_all_other_windows() {
    if !has_accessibility_permission() {
        eprintln!(
            "[Waqt] macOS Accessibility permission is required to minimize fullscreen windows before an overlay is shown."
        );
        open_accessibility_settings();
        return;
    }

    let script = build_minimize_all_windows_script();
    let result = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output();

    match result {
        Ok(output) => {
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                eprintln!("[Waqt] Failed to minimize other app windows: {}", stderr);
                if stderr.to_lowercase().contains("not authorized") || stderr.to_lowercase().contains("accessibility") {
                    open_accessibility_settings();
                }
            }
        }
        Err(err) => {
            eprintln!("[Waqt] Could not execute osascript to minimize apps: {}", err);
        }
    }
}

pub fn close_all_overlays(app: &AppHandle) {
    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("overlay-") {
            let _ = win.close();
        }
    }

    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::NSWorkspace;
        let workspace = NSWorkspace::sharedWorkspace();
        let running_apps = workspace.runningApplications();
        for running_app in running_apps {
            let _ = running_app.unhide();
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_minimize_all_windows_script_targets_all_application_windows() {
        let script = super::build_minimize_all_windows_script();

        assert!(script.contains("every application process"));
        assert!(script.contains("if name of proc is not \"waqt\""));
        assert!(script.contains("set miniaturized of aWindow to true"));
    }
}
