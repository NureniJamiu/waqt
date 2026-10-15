use chrono::{Datelike, Local, TimeZone};
use std::f64::consts::PI;

#[derive(Debug, Clone)]
pub struct PrayerTimeItem {
    pub name: String,
    pub timestamp: i64, // Unix timestamp in seconds (Adhan time)
    pub lock_timestamp: i64, // Unix timestamp in seconds (Lock trigger time)
    pub next_lock_timestamp: i64, // Start of next prayer's pre-lock (fireableUntil boundary)
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

// ═══════════════════════════════════════════════════════════════════════════
// A faithful port of adhan-js 3.0.0 (`node_modules/adhan/Adhan.js`), which
// drives the UI (`src/lib/adhanCalc.ts`).
//
// The two engines must agree to the second: this side decides when the screen
// locks, that side what the Dashboard says. The previous hand-rolled
// low-precision formula drifted by up to ~2.5 min everywhere, skipped adhan's
// per-method minute adjustments, rounding, the Moonsighting Committee seasonal
// twilight and the middle-of-the-night high-latitude rule — hours off in a
// London summer. `fixtures/prayer_times.json` (generated from adhan-js) pins
// the contract; see `fixture_matches_adhan_js` below.
//
// JS quirks reproduced on purpose: instants are integer milliseconds created
// by truncation (`new Date(ms)` → TimeClip), hour fractions are split with
// `TimeComponents`' floors, `roundedMinute` only looks at whole seconds, and
// `Math.round` rounds halves towards +∞.
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy, Default)]
struct MinuteAdjustments {
    fajr: f64,
    dhuhr: f64,
    asr: f64,
    maghrib: f64,
    isha: f64,
}

#[derive(Debug, Clone, Copy)]
struct MethodParams {
    fajr_angle: f64,
    isha_angle: f64,
    /// Minutes after Maghrib; 0 means "use `isha_angle`".
    isha_interval: f64,
    moonsighting_committee: bool,
    adjustments: MinuteAdjustments,
}

/// Mirrors `getCalculationMethodParams` in `adhanCalc.ts`, including its
/// Turkey / Tehran variants built on Muslim World League (and so keeping its
/// +1 min Dhuhr adjustment).
fn method_params(method: &str) -> MethodParams {
    let p = |fajr, isha, interval, adjustments| MethodParams {
        fajr_angle: fajr,
        isha_angle: isha,
        isha_interval: interval,
        moonsighting_committee: false,
        adjustments,
    };
    let dhuhr1 = MinuteAdjustments { dhuhr: 1.0, ..Default::default() };
    match method {
        "Egyptian" => p(19.5, 17.5, 0.0, dhuhr1),
        "Karachi" => p(18.0, 18.0, 0.0, dhuhr1),
        "UmmAlQura" => p(18.5, 0.0, 90.0, MinuteAdjustments::default()),
        "Dubai" => p(
            18.2,
            18.2,
            0.0,
            MinuteAdjustments { dhuhr: 3.0, asr: 3.0, maghrib: 3.0, ..Default::default() },
        ),
        "MoonsightingCommittee" => MethodParams {
            moonsighting_committee: true,
            ..p(18.0, 18.0, 0.0, MinuteAdjustments { dhuhr: 5.0, maghrib: 3.0, ..Default::default() })
        },
        "NorthAmerica" => p(15.0, 15.0, 0.0, dhuhr1),
        "Kuwait" => p(18.0, 17.5, 0.0, MinuteAdjustments::default()),
        "Qatar" => p(18.0, 0.0, 90.0, MinuteAdjustments::default()),
        "Singapore" => p(20.0, 18.0, 0.0, dhuhr1),
        "Turkey" => p(18.0, 17.0, 0.0, dhuhr1),
        "Tehran" => p(17.7, 14.0, 0.0, dhuhr1),
        _ => p(18.0, 17.0, 0.0, dhuhr1),
    }
}

fn to_rad(d: f64) -> f64 {
    d * PI / 180.0
}

fn to_deg(r: f64) -> f64 {
    r * 180.0 / PI
}

fn normalize_to_scale(n: f64, max: f64) -> f64 {
    n - max * (n / max).floor()
}

fn unwind_angle(a: f64) -> f64 {
    normalize_to_scale(a, 360.0)
}

fn quadrant_shift_angle(a: f64) -> f64 {
    if (-180.0..=180.0).contains(&a) {
        a
    } else {
        a - 360.0 * js_round(a / 360.0)
    }
}

/// JavaScript `Math.round`: halves go towards +∞.
fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}

fn julian_day(year: i32, month: u32, day: u32) -> f64 {
    let (y, m) = if month > 2 { (year as f64, month as f64) } else { (year as f64 - 1.0, month as f64 + 12.0) };
    let a = (y / 100.0).trunc();
    let b = (2.0 - a + (a / 4.0).trunc()).trunc();
    let i0 = (365.25 * (y + 4716.0)).trunc();
    let i1 = (30.6001 * (m + 1.0)).trunc();
    i0 + i1 + day as f64 + b - 1524.5
}

struct SolarCoordinates {
    declination: f64,
    right_ascension: f64,
    apparent_sidereal_time: f64,
}

impl SolarCoordinates {
    fn new(jd: f64) -> Self {
        let t = (jd - 2451545.0) / 36525.0;
        let l0 = unwind_angle(280.4664567 + 36000.76983 * t + 0.0003032 * t.powi(2));
        let lp = unwind_angle(218.3165 + 481267.8813 * t);
        let omega = unwind_angle(125.04452 - 1934.136261 * t + 0.0020708 * t.powi(2) + t.powi(3) / 450000.0);

        let m = unwind_angle(357.52911 + 35999.05029 * t - 0.0001537 * t.powi(2));
        let m_rad = to_rad(m);
        let center = (1.914602 - 0.004817 * t - 0.000014 * t.powi(2)) * m_rad.sin()
            + (0.019993 - 0.000101 * t) * (2.0 * m_rad).sin()
            + 0.000289 * (3.0 * m_rad).sin();
        let o = 125.04 - 1934.136 * t;
        let lambda = to_rad(unwind_angle(l0 + center - 0.00569 - 0.00478 * to_rad(o).sin()));

        let jd_back = t * 36525.0 + 2451545.0;
        let theta0 = unwind_angle(
            280.46061837 + 360.98564736629 * (jd_back - 2451545.0) + 0.000387933 * t.powi(2)
                - t.powi(3) / 38710000.0,
        );
        let d_psi = (-17.2 / 3600.0) * to_rad(omega).sin() - (1.32 / 3600.0) * (2.0 * to_rad(l0)).sin()
            - (0.23 / 3600.0) * (2.0 * to_rad(lp)).sin()
            + (0.21 / 3600.0) * (2.0 * to_rad(omega)).sin();
        let d_epsilon = (9.2 / 3600.0) * to_rad(omega).cos() + (0.57 / 3600.0) * (2.0 * to_rad(l0)).cos()
            + (0.10 / 3600.0) * (2.0 * to_rad(lp)).cos()
            - (0.09 / 3600.0) * (2.0 * to_rad(omega)).cos();

        let epsilon0 = 23.439291 - 0.013004167 * t - 0.0000001639 * t.powi(2) + 0.0000005036 * t.powi(3);
        let epsilon_apparent = to_rad(epsilon0 + 0.00256 * to_rad(o).cos());

        SolarCoordinates {
            declination: to_deg((epsilon_apparent.sin() * lambda.sin()).asin()),
            right_ascension: unwind_angle(to_deg(
                (epsilon_apparent.cos() * lambda.sin()).atan2(lambda.cos()),
            )),
            apparent_sidereal_time: theta0
                + ((d_psi * 3600.0) * to_rad(epsilon0 + d_epsilon).cos()) / 3600.0,
        }
    }
}

fn interpolate(y2: f64, y1: f64, y3: f64, n: f64) -> f64 {
    let a = y2 - y1;
    let b = y3 - y2;
    y2 + (n / 2.0) * (a + b + n * (b - a))
}

fn interpolate_angles(y2: f64, y1: f64, y3: f64, n: f64) -> f64 {
    let a = unwind_angle(y2 - y1);
    let b = unwind_angle(y3 - y2);
    y2 + (n / 2.0) * (a + b + n * (b - a))
}

struct SolarTime {
    lat: f64,
    lng: f64,
    solar: SolarCoordinates,
    prev: SolarCoordinates,
    next: SolarCoordinates,
    approx_transit: f64,
}

impl SolarTime {
    fn new(day: chrono::NaiveDate, lat: f64, lng: f64) -> Self {
        let jd_of = |d: chrono::NaiveDate| julian_day(d.year(), d.month(), d.day());
        let solar = SolarCoordinates::new(jd_of(day));
        let prev = SolarCoordinates::new(jd_of(day - chrono::Duration::days(1)));
        let next = SolarCoordinates::new(jd_of(day + chrono::Duration::days(1)));
        let approx_transit =
            normalize_to_scale((solar.right_ascension - lng - solar.apparent_sidereal_time) / 360.0, 1.0);
        SolarTime { lat, lng, solar, prev, next, approx_transit }
    }

    /// UTC hours.
    fn transit(&self) -> f64 {
        let m0 = self.approx_transit;
        let theta = unwind_angle(self.solar.apparent_sidereal_time + 360.985647 * m0);
        let a = unwind_angle(interpolate_angles(
            self.solar.right_ascension,
            self.prev.right_ascension,
            self.next.right_ascension,
            m0,
        ));
        let h = quadrant_shift_angle(theta + self.lng - a);
        (m0 + h / -360.0) * 24.0
    }

    /// UTC hours; NaN when the sun never reaches `angle` that day.
    fn hour_angle(&self, angle: f64, after_transit: bool) -> f64 {
        let (lat, d2) = (self.lat, self.solar.declination);
        let term1 = to_rad(angle).sin() - to_rad(lat).sin() * to_rad(d2).sin();
        let term2 = to_rad(lat).cos() * to_rad(d2).cos();
        let h0 = to_deg((term1 / term2).acos());
        let m = if after_transit {
            self.approx_transit + h0 / 360.0
        } else {
            self.approx_transit - h0 / 360.0
        };
        let theta = unwind_angle(self.solar.apparent_sidereal_time + 360.985647 * m);
        let a = unwind_angle(interpolate_angles(
            self.solar.right_ascension,
            self.prev.right_ascension,
            self.next.right_ascension,
            m,
        ));
        let delta = interpolate(d2, self.prev.declination, self.next.declination, m);
        let h = theta + self.lng - a;
        let alt = to_deg(
            (to_rad(lat).sin() * to_rad(delta).sin()
                + to_rad(lat).cos() * to_rad(delta).cos() * to_rad(h).cos())
            .asin(),
        );
        let dm = (alt - angle) / (360.0 * to_rad(delta).cos() * to_rad(lat).cos() * to_rad(h).sin());
        (m + dm) * 24.0
    }

    fn afternoon(&self, shadow_length: f64) -> f64 {
        let tangent = (self.lat - self.solar.declination).abs();
        let inverse = shadow_length + to_rad(tangent).tan();
        self.hour_angle(to_deg((1.0 / inverse).atan()), true)
    }
}

/// `TimeComponents(hours).UTCDate(y, m, d)` as epoch milliseconds, or `None`
/// for NaN (adhan's "Invalid Date").
fn utc_ms(day: chrono::NaiveDate, hours: f64) -> Option<i64> {
    if !hours.is_finite() {
        return None;
    }
    let h = hours.floor();
    let m = ((hours - h) * 60.0).floor();
    let s = ((hours - (h + m / 60.0)) * 3600.0).floor();
    let midnight = day.and_hms_opt(0, 0, 0)?.and_utc().timestamp_millis();
    Some(midnight + ((h * 3600.0 + m * 60.0 + s) as i64) * 1000)
}

/// `dateByAddingSeconds`: `new Date(ms + secs * 1000)` truncates to integer ms.
fn add_secs(ms: i64, secs: f64) -> i64 {
    (ms as f64 + secs * 1000.0).trunc() as i64
}

fn rounded_minute(ms: i64) -> i64 {
    let secs = ms.div_euclid(1000).rem_euclid(60);
    let offset = if secs >= 30 { 60 - secs } else { -secs };
    ms + offset * 1000
}

fn is_leap_year(y: i32) -> bool {
    (y % 4 == 0) && !(y % 100 == 0 && y % 400 != 0)
}

fn days_since_solstice(day_of_year: i64, year: i32, lat: f64) -> i64 {
    let days_in_year = if is_leap_year(year) { 366 } else { 365 };
    if lat >= 0.0 {
        let d = day_of_year + 10;
        if d >= days_in_year { d - days_in_year } else { d }
    } else {
        let d = day_of_year - if is_leap_year(year) { 173 } else { 172 };
        if d < 0 { d + days_in_year } else { d }
    }
}

/// Minutes, from adhan's `seasonAdjusted{Morning,Evening}Twilight` tables.
fn season_adjustment(coeffs: [f64; 4], signs: [f64; 4], lat: f64, dyy: i64) -> f64 {
    let v = |i: usize| 75.0 + signs[i] * (coeffs[i] / 55.0) * lat.abs();
    let (a, b, c, d) = (v(0), v(1), v(2), v(3));
    let dyy = dyy as f64;
    if dyy < 91.0 {
        a + (b - a) / 91.0 * dyy
    } else if dyy < 137.0 {
        b + (c - b) / 46.0 * (dyy - 91.0)
    } else if dyy < 183.0 {
        c + (d - c) / 46.0 * (dyy - 137.0)
    } else if dyy < 229.0 {
        d + (c - d) / 46.0 * (dyy - 183.0)
    } else if dyy < 275.0 {
        c + (b - c) / 46.0 * (dyy - 229.0)
    } else {
        b + (a - b) / 91.0 * (dyy - 275.0)
    }
}

/// The five prayer instants for one calendar day, in epoch milliseconds,
/// exactly as adhan-js' `PrayerTimes` produces them (after rounding).
fn prayer_times_ms(day: chrono::NaiveDate, lat: f64, lng: f64, method: &str, asr_school: &str) -> [i64; 5] {
    let params = method_params(method);
    let shadow = if asr_school == "Hanafi" { 2.0 } else { 1.0 };
    let st = SolarTime::new(day, lat, lng);
    let solar_altitude = -50.0 / 60.0;

    // Sunrise / sunset can only be NaN inside the polar circle, where adhan
    // itself produces Invalid Dates; fall back to transit ± 6h there rather
    // than panicking the scheduler.
    let dhuhr = utc_ms(day, st.transit()).unwrap_or(0);
    let sunrise = utc_ms(day, st.hour_angle(solar_altitude, false)).unwrap_or(dhuhr - 6 * 3_600_000);
    let maghrib = utc_ms(day, st.hour_angle(solar_altitude, true)).unwrap_or(dhuhr + 6 * 3_600_000);
    let asr = utc_ms(day, st.afternoon(shadow)).unwrap_or(dhuhr + 3 * 3_600_000);

    // `dateByAddingDays(sunrise, 1)` keeps the UTC wall time.
    let night_secs = ((sunrise + 86_400_000) - maghrib) as f64 / 1000.0;
    let day_of_year = day.ordinal() as i64;
    let mc = params.moonsighting_committee;

    let mut fajr = utc_ms(day, st.hour_angle(-params.fajr_angle, false));
    if mc && lat >= 55.0 {
        fajr = Some(add_secs(sunrise, -(night_secs / 7.0)));
    }
    let safe_fajr = if mc {
        let adj = season_adjustment(
            [28.65, 19.44, 32.74, 48.10],
            [1.0, 1.0, 1.0, 1.0],
            lat,
            days_since_solstice(day_of_year, day.year(), lat),
        );
        add_secs(sunrise, js_round(adj * -60.0))
    } else {
        add_secs(sunrise, -(0.5 * night_secs))
    };
    let fajr = match fajr {
        Some(f) if safe_fajr <= f => f,
        _ => safe_fajr,
    };

    let isha = if params.isha_interval > 0.0 {
        add_secs(maghrib, params.isha_interval * 60.0)
    } else {
        let mut isha = utc_ms(day, st.hour_angle(-params.isha_angle, true));
        if mc && lat >= 55.0 {
            isha = Some(add_secs(maghrib, night_secs / 7.0));
        }
        let safe_isha = if mc {
            let adj = season_adjustment(
                [25.60, 2.050, 9.210, 6.140],
                [1.0, 1.0, -1.0, 1.0],
                lat,
                days_since_solstice(day_of_year, day.year(), lat),
            );
            add_secs(maghrib, js_round(adj * 60.0))
        } else {
            add_secs(maghrib, 0.5 * night_secs)
        };
        match isha {
            Some(i) if safe_isha >= i => i,
            _ => safe_isha,
        }
    };

    let adj = params.adjustments;
    [
        rounded_minute(add_secs(fajr, adj.fajr * 60.0)),
        rounded_minute(add_secs(dhuhr, adj.dhuhr * 60.0)),
        rounded_minute(add_secs(asr, adj.asr * 60.0)),
        rounded_minute(add_secs(maghrib, adj.maghrib * 60.0)),
        rounded_minute(add_secs(isha, adj.isha * 60.0)),
    ]
}

/// Epoch ms → seconds the way the UI sees it (`Math.round(ms / 1000)`).
fn ms_to_secs(ms: i64) -> i64 {
    js_round(ms as f64 / 1000.0) as i64
}

/// Generic over the timezone so tests can pin a fixed offset; the app always
/// passes `Local`. Only the calendar date of `date` matters, as in adhan-js.
pub fn calculate_daily_schedule<Tz: TimeZone>(
    lat: f64,
    lng: f64,
    method: &str,
    asr_school: &str,
    date: chrono::DateTime<Tz>,
) -> DailySchedule {
    let day = date.naive_local().date();
    let today = prayer_times_ms(day, lat, lng, method, asr_school);
    let tomorrow = prayer_times_ms(day + chrono::Duration::days(1), lat, lng, method, asr_school);

    DailySchedule {
        fajr: ms_to_secs(today[0]),
        dhuhr: ms_to_secs(today[1]),
        asr: ms_to_secs(today[2]),
        maghrib: ms_to_secs(today[3]),
        isha: ms_to_secs(today[4]),
        tomorrow_fajr: ms_to_secs(tomorrow[0]),
    }
}

pub fn get_today_prayer_items(
    lat: f64,
    lng: f64,
    method: &str,
    asr_school: &str,
    pre_lock_minutes: u64,
    date: chrono::DateTime<Local>,
) -> Vec<PrayerTimeItem> {
    let pre_lock_sec = (pre_lock_minutes * 60) as i64;
    let sched = calculate_daily_schedule(lat, lng, method, asr_school, date);
    vec![
        PrayerTimeItem {
            name: "Fajr".to_string(),
            timestamp: sched.fajr,
            lock_timestamp: sched.fajr - pre_lock_sec,
            next_lock_timestamp: sched.dhuhr - pre_lock_sec,
            next_timestamp: sched.dhuhr,
        },
        PrayerTimeItem {
            name: "Dhuhr".to_string(),
            timestamp: sched.dhuhr,
            lock_timestamp: sched.dhuhr - pre_lock_sec,
            next_lock_timestamp: sched.asr - pre_lock_sec,
            next_timestamp: sched.asr,
        },
        PrayerTimeItem {
            name: "Asr".to_string(),
            timestamp: sched.asr,
            lock_timestamp: sched.asr - pre_lock_sec,
            next_lock_timestamp: sched.maghrib - pre_lock_sec,
            next_timestamp: sched.maghrib,
        },
        PrayerTimeItem {
            name: "Maghrib".to_string(),
            timestamp: sched.maghrib,
            lock_timestamp: sched.maghrib - pre_lock_sec,
            next_lock_timestamp: sched.isha - pre_lock_sec,
            next_timestamp: sched.isha,
        },
        PrayerTimeItem {
            name: "Isha".to_string(),
            timestamp: sched.isha,
            lock_timestamp: sched.isha - pre_lock_sec,
            next_lock_timestamp: sched.tomorrow_fajr - pre_lock_sec,
            next_timestamp: sched.tomorrow_fajr,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FixtureCase {
        city: String,
        latitude: f64,
        longitude: f64,
        utc_offset_hours: i32,
        date: String,
        method: String,
        asr_school: String,
        expected: std::collections::HashMap<String, i64>,
    }

    /// Diffs (seconds) between this engine and adhan-js for every fixture
    /// case, as (label, prayer, rust - adhan).
    fn fixture_diffs() -> Vec<(String, &'static str, i64)> {
        let cases: Vec<FixtureCase> =
            serde_json::from_str(include_str!("../../fixtures/prayer_times.json")).unwrap();
        let mut out = Vec::new();
        for c in &cases {
            let tz = chrono::FixedOffset::east_opt(c.utc_offset_hours * 3600).unwrap();
            let day = chrono::NaiveDate::parse_from_str(&c.date, "%Y-%m-%d").unwrap();
            let noon = tz.from_local_datetime(&day.and_hms_opt(12, 0, 0).unwrap()).unwrap();
            let s = calculate_daily_schedule(c.latitude, c.longitude, &c.method, &c.asr_school, noon);
            let label = format!("{} {} {} {}", c.city, c.date, c.method, c.asr_school);
            for (name, got) in [
                ("Fajr", s.fajr),
                ("Dhuhr", s.dhuhr),
                ("Asr", s.asr),
                ("Maghrib", s.maghrib),
                ("Isha", s.isha),
            ] {
                out.push((label.clone(), name, got - c.expected[name]));
            }
        }
        out
    }

    /// The scheduler (this engine) and the Dashboard (adhan-js) must agree to
    /// the second on every case in the shared fixture. A mismatch here means
    /// the screen would lock at a different time than the UI shows.
    #[test]
    fn fixture_matches_adhan_js() {
        let diffs = fixture_diffs();
        assert!(!diffs.is_empty());
        let mismatches: Vec<_> = diffs.iter().filter(|(_, _, d)| *d != 0).collect();
        assert!(
            mismatches.is_empty(),
            "{} of {} prayer times diverge from adhan-js, e.g. {:?}",
            mismatches.len(),
            diffs.len(),
            &mismatches[..mismatches.len().min(5)]
        );
    }

    #[test]
    fn test_rust_offline_prayer_calculation() {
        let now = Local::now();
        let items = get_today_prayer_items(6.5244, 3.3792, "MuslimWorldLeague", "Standard", 15, now);

        assert_eq!(items.len(), 5);
        assert_eq!(items[0].name, "Fajr");
        assert_eq!(items[1].name, "Dhuhr");
        assert_eq!(items[2].name, "Asr");
        assert_eq!(items[3].name, "Maghrib");
        assert_eq!(items[4].name, "Isha");

        // Verify strictly ascending timestamps
        assert!(items[0].timestamp < items[1].timestamp);
        assert!(items[1].timestamp < items[2].timestamp);
        assert!(items[2].timestamp < items[3].timestamp);
        assert!(items[3].timestamp < items[4].timestamp);
        assert!(items[4].timestamp < items[4].next_timestamp);

        // Verify lock_timestamp is exactly 15 minutes (900s) before timestamp
        for item in &items {
            assert_eq!(item.timestamp - item.lock_timestamp, 15 * 60);
        }
    }

    #[test]
    fn test_hanafi_asr_delay_rust() {
        let now = Local::now();
        let standard_items = get_today_prayer_items(6.5244, 3.3792, "MuslimWorldLeague", "Standard", 15, now);
        let hanafi_items = get_today_prayer_items(6.5244, 3.3792, "MuslimWorldLeague", "Hanafi", 15, now);

        let std_asr = items_by_name(&standard_items, "Asr");
        let hanafi_asr = items_by_name(&hanafi_items, "Asr");

        assert!(hanafi_asr > std_asr);
    }

    fn items_by_name(items: &[PrayerTimeItem], name: &str) -> i64 {
        items.iter().find(|i| i.name == name).unwrap().timestamp
    }
}

