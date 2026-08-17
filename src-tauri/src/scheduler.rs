use tauri::AppHandle;
use tokio::time::{sleep, Duration};

pub async fn start_background_scheduler(app_handle: AppHandle) {
    loop {
        // Sleep for 30 seconds between schedule tick evaluations
        sleep(Duration::from_secs(30)).await;

        // Scheduler tick logic: recheck current time against scheduled pre-notifications (T-30, T-15, T-5)
        // and trigger overlay at T-0 if within fireableUntil window.
        let _ = &app_handle;
    }
}
