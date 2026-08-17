use chrono::{Datelike, Local, TimeZone};
use std::f64::consts::PI;

#[derive(Debug, Clone)]
pub struct PrayerTimeItem {
    pub name: String,
    pub timestamp: i64, // Unix timestamp in seconds
    pub next_timestamp: i64, // Start of next prayer (fireableUntil boundary)
}

#[derive(Debug, Clone)]
pub struct DailySchedule {
    pub fajr: i64,
    pub dhuhr: i64,
    pub asr: i64,
    pub maghrib: i64,
    pub isha: i64,
    pub tomorrow_fajr: i64,
}

pub fn get_method_angles(method: &str) -> (f64, f64, Option<f64>) {
    // Returns (fajr_angle, isha_angle, optional_isha_interval_minutes)
    match method {
        "Egyptian" => (19.5, 17.5, None),
        "Karachi" => (18.0, 18.0, None),
        "UmmAlQura" => (18.5, 0.0, Some(90.0)),
        "Dubai" => (18.2, 18.2, None),
        "MoonsightingCommittee" => (18.0, 18.0, None),
        "NorthAmerica" => (15.0, 15.0, None),
        "Kuwait" => (18.0, 17.5, None),
        "Qatar" => (18.0, 0.0, Some(90.0)),
        "Singapore" => (20.0, 18.0, None),
        "Turkey" => (18.0, 17.0, None),
        "Tehran" => (17.7, 14.0, None),
        "MuslimWorldLeague" | _ => (18.0, 17.0, None),
    }
}

fn julian_day(year: i32, month: u32, day: u32) -> f64 {
    let mut y = year as f64;
    let mut m = month as f64;
    if m <= 2.0 {
        y -= 1.0;
        m += 12.0;
    }
    let a = (y / 100.0).floor();
    let b = 2.0 - a + (a / 4.0).floor();
    (365.25 * (y + 4716.0)).floor() + (30.6001 * (m + 1.0)).floor() + (day as f64) + b - 1524.5
}

fn sun_position(jd: f64) -> (f64, f64, f64) {
    let d = jd - 2451545.0;
    let g = (357.529 + 0.98560028 * d).to_radians();
    let q = (280.459 + 0.98564736 * d) % 360.0;
    let l = ((q + 1.915 * g.sin() + 0.020 * (2.0 * g).sin()) % 360.0).to_radians();

    let e = (23.439 - 0.00000036 * d).to_radians();
    let decl = (e.sin() * l.sin()).asin();
    let mut ra = (e.cos() * l.sin()).atan2(l.cos()) * 180.0 / PI / 15.0;
    if ra < 0.0 {
        ra += 24.0;
    }
    let eot = (q / 15.0 - ra) * 60.0;
    (decl, eot, ra)
}

fn hour_angle(lat: f64, decl: f64, angle: f64) -> Option<f64> {
    let lat_rad = lat.to_radians();
    let angle_rad = angle.to_radians();
    let cos_h = (angle_rad.sin() - lat_rad.sin() * decl.sin()) / (lat_rad.cos() * decl.cos());
    if cos_h < -1.0 || cos_h > 1.0 {
        None
    } else {
        Some(cos_h.acos() * 180.0 / PI / 15.0)
    }
}

fn asr_hour_angle(lat: f64, decl: f64, shadow_ratio: f64) -> Option<f64> {
    let lat_rad = lat.to_radians();
    let diff = (lat_rad - decl).abs();
    let angle_rad = (1.0 / (shadow_ratio + diff.tan())).atan();
    let cos_h = (angle_rad.sin() - lat_rad.sin() * decl.sin()) / (lat_rad.cos() * decl.cos());
    if cos_h < -1.0 || cos_h > 1.0 {
        None
    } else {
        Some(cos_h.acos() * 180.0 / PI / 15.0)
    }
}

pub fn calculate_daily_schedule(
    lat: f64,
    lng: f64,
    method: &str,
    asr_school: &str,
    date: chrono::DateTime<Local>,
) -> DailySchedule {
    let timezone_offset_hours = date.offset().local_minus_utc() as f64 / 3600.0;
    let (fajr_angle, isha_angle, isha_interval) = get_method_angles(method);
    let shadow_ratio = if asr_school == "Hanafi" { 2.0 } else { 1.0 };

    let calc_times_for_day = |d: chrono::DateTime<Local>| -> (f64, f64, f64, f64, f64) {
        let jd = julian_day(d.year(), d.month(), d.day());
        let (decl, eot, _) = sun_position(jd);
        let transit = 12.0 + (timezone_offset_hours - lng / 15.0) - eot / 60.0;

        let fajr_h = hour_angle(lat, decl, -fajr_angle).unwrap_or(2.0);
        let sunset_h = hour_angle(lat, decl, -0.8333).unwrap_or(6.0);
        let asr_h = asr_hour_angle(lat, decl, shadow_ratio).unwrap_or(3.0);

        let fajr_t = transit - fajr_h;
        let dhuhr_t = transit;
        let asr_t = transit + asr_h;
        let maghrib_t = transit + sunset_h;

        let isha_t = if let Some(interval) = isha_interval {
            maghrib_t + (interval / 60.0)
        } else {
            let isha_h = hour_angle(lat, decl, -isha_angle).unwrap_or(sunset_h + 1.5);
            transit + isha_h
        };

        (fajr_t, dhuhr_t, asr_t, maghrib_t, isha_t)
    };

    let hours_to_timestamp = |d: chrono::DateTime<Local>, hours: f64| -> i64 {
        let total_seconds = (hours * 3600.0).round() as i64;
        let hour = (total_seconds / 3600).rem_euclid(24) as u32;
        let minute = ((total_seconds % 3600) / 60).rem_euclid(60) as u32;
        let second = (total_seconds % 60).rem_euclid(60) as u32;

        let naive_date = d.naive_local().date();
        if let Some(naive_dt) = naive_date.and_hms_opt(hour, minute, second) {
            if let Some(local_dt) = Local.from_local_datetime(&naive_dt).single() {
                return local_dt.timestamp();
            }
        }
        d.timestamp()
    };

    let (fajr_h, dhuhr_h, asr_h, maghrib_h, isha_h) = calc_times_for_day(date);
    let tomorrow = date + chrono::Duration::days(1);
    let (t_fajr_h, _, _, _, _) = calc_times_for_day(tomorrow);

    DailySchedule {
        fajr: hours_to_timestamp(date, fajr_h),
        dhuhr: hours_to_timestamp(date, dhuhr_h),
        asr: hours_to_timestamp(date, asr_h),
        maghrib: hours_to_timestamp(date, maghrib_h),
        isha: hours_to_timestamp(date, isha_h),
        tomorrow_fajr: hours_to_timestamp(tomorrow, t_fajr_h),
    }
}

pub fn get_today_prayer_items(
    lat: f64,
    lng: f64,
    method: &str,
    asr_school: &str,
    date: chrono::DateTime<Local>,
) -> Vec<PrayerTimeItem> {
    let sched = calculate_daily_schedule(lat, lng, method, asr_school, date);
    vec![
        PrayerTimeItem {
            name: "Fajr".to_string(),
            timestamp: sched.fajr,
            next_timestamp: sched.dhuhr,
        },
        PrayerTimeItem {
            name: "Dhuhr".to_string(),
            timestamp: sched.dhuhr,
            next_timestamp: sched.asr,
        },
        PrayerTimeItem {
            name: "Asr".to_string(),
            timestamp: sched.asr,
            next_timestamp: sched.maghrib,
        },
        PrayerTimeItem {
            name: "Maghrib".to_string(),
            timestamp: sched.maghrib,
            next_timestamp: sched.isha,
        },
        PrayerTimeItem {
            name: "Isha".to_string(),
            timestamp: sched.isha,
            next_timestamp: sched.tomorrow_fajr,
        },
    ]
}
