use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn spawn_overlay_windows(app: &AppHandle, prayer_name: &str) -> Result<(), String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;

    if monitors.is_empty() {
        spawn_single_overlay(app, "overlay-primary", prayer_name)?;
    } else {
        for (idx, monitor) in monitors.iter().enumerate() {
            let label = format!("overlay-monitor-{}", idx);
            if let Some(existing) = app.get_webview_window(&label) {
                let _ = existing.show();
                let _ = existing.set_focus();
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
            .build();

            if let Ok(win) = window_result {
                let _ = win.set_focus();
            }
        }
    }

    Ok(())
}

fn spawn_single_overlay(app: &AppHandle, label: &str, prayer_name: &str) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app,
        label,
        WebviewUrl::App(format!("index.html?screen=overlay&prayer={}", prayer_name).into()),
    )
    .title("Waqt Overlay")
    .decorations(false)
    .always_on_top(true)
    .fullscreen(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn close_all_overlays(app: &AppHandle) {
    let windows = app.webview_windows();
    for (label, win) in windows {
        if label.starts_with("overlay-") {
            let _ = win.close();
        }
    }
}
