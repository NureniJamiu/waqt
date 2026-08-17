use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn spawn_overlay_windows(app: &AppHandle, prayer_name: &str) -> Result<(), String> {
    let monitors_res = app.available_monitors();

    let monitors = match monitors_res {
        Ok(m) if !m.is_empty() => m,
        _ => {
            return spawn_single_overlay(app, "overlay-primary", prayer_name);
        }
    };

    let mut spawned_any = false;
    for (idx, monitor) in monitors.iter().enumerate() {
        let label = format!("overlay-monitor-{}", idx);
        if let Some(existing) = app.get_webview_window(&label) {
            let _ = existing.show();
            let _ = existing.set_focus();
            harden_window(&existing);
            spawned_any = true;
            continue;
        }

        let pos = monitor.position();
        let size = monitor.size();

        let window_result = WebviewWindowBuilder::new(
            app,
            &label,
            WebviewUrl::App(format!("index.html?screen=overlay&prayer={}", prayer_name).into()),
        )
        .title("Waqt Overlay")
        .inner_size(size.width as f64, size.height as f64)
        .position(pos.x as f64, pos.y as f64)
        .decorations(false)
        .always_on_top(true)
        .fullscreen(true)
        .minimizable(false)
        .maximizable(false)
        .closable(false)
        .resizable(false)
        .shadow(false)
        .build();

        if let Ok(win) = window_result {
            let _ = win.set_focus();
            harden_window(&win);
            spawned_any = true;
        }
    }

    if !spawned_any {
        return spawn_single_overlay(app, "overlay-primary", prayer_name);
    }

    Ok(())
}

fn spawn_single_overlay(app: &AppHandle, label: &str, prayer_name: &str) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        harden_window(&existing);
        return Ok(());
    }

    let win = WebviewWindowBuilder::new(
        app,
        label,
        WebviewUrl::App(format!("index.html?screen=overlay&prayer={}", prayer_name).into()),
    )
    .title("Waqt Overlay")
    .decorations(false)
    .always_on_top(true)
    .fullscreen(true)
    .minimizable(false)
    .maximizable(false)
    .closable(false)
    .resizable(false)
    .shadow(false)
    .build()
    .map_err(|e| e.to_string())?;

    harden_window(&win);

    Ok(())
}

/// Dispatches NSWindow hardening to the main thread.
/// All AppKit/NSWindow APIs are main-thread-only on macOS; calling them from
/// any other thread causes SIGILL. `run_on_main_thread` guarantees the closure
/// executes on the UI thread regardless of where `harden_window` was called from.
fn harden_window(win: &tauri::WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        let win_for_closure = win.clone();
        // Ignore errors — if the dispatch fails the window still shows,
        // just without the extra NSWindow hardening.
        let _ = win.run_on_main_thread(move || {
            harden_macos(&win_for_closure);
        });
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = win;
    }
}

/// Called exclusively from within `run_on_main_thread`, so the main-thread
/// invariant required by AppKit is always satisfied.
#[cfg(target_os = "macos")]
fn harden_macos(win: &tauri::WebviewWindow) {
    use objc2_app_kit::{NSApplication, NSWindow};

    // NSWindowLevel: kCGScreenSaverWindowLevel = 2001
    // Sits above Dock (20), Spotlight (101), menu bar (25),
    // notification banners (500), and all normal app windows.
    const SCREEN_SAVER_WINDOW_LEVEL: isize = 2001;

    // NSWindowCollectionBehavior flags (values are NSUInteger / usize):
    // CanJoinAllSpaces    = 1 << 0 = 1   → visible on every Space
    // Stationary         = 1 << 4 = 16  → pinned; doesn't move in Mission Control
    // IgnoresCycle       = 1 << 6 = 64  → excluded from ⌘+Tab switcher
    // FullScreenPrimary  = 1 << 7 = 128 → claims full-screen space
    const COLLECTION_BEHAVIOR: usize = 1 | 16 | 64 | 128;

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

        // 1. Elevate to screen-saver window level — above everything the user
        //    can interact with including Dock, Spotlight, and notification banners.
        ns_win_ref.setLevel(SCREEN_SAVER_WINDOW_LEVEL);

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

        // 4. Bring to front unconditionally (works even when app is not active).
        ns_win_ref.orderFrontRegardless();

        // 5. Activate our app so keyboard events route here.
        //    MainThreadMarker::new_unchecked() is safe: we are on the main thread.
        let mtm = objc2::MainThreadMarker::new_unchecked();
        let app = NSApplication::sharedApplication(mtm);
        app.activate();
    }
}

pub fn close_all_overlays(app: &AppHandle) {
    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("overlay-") {
            let _ = win.close();
        }
    }
}
