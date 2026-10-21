//! SGP4 propagation (via the `sgp4` crate, AFSPC compatibility mode, which is what the
//! Vallado verification vectors and operational GP element sets assume) and TEME -> geodetic.
//!
//! Frame handling: SGP4 outputs TEME. We rotate by IAU-82 GMST to get an Earth-fixed frame,
//! then convert to WGS84 geodetic. Polar motion and the equation of the equinoxes are ignored;
//! that is a sub-100 m effect at LEO, far below SGP4's own error growth (~1-3 km/day).

use anyhow::{anyhow, Result};
use serde::Serialize;

const WGS84_A_KM: f64 = 6378.137;
const WGS84_F: f64 = 1.0 / 298.257_223_563;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Geodetic {
    pub lat_deg: f64,
    pub lon_deg: f64,
    pub alt_km: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Position {
    pub geodetic: Geodetic,
    pub teme_km: [f64; 3],
    pub speed_km_s: f64,
    pub minutes_since_epoch: f64,
}

/// Element epoch as unix milliseconds (UTC).
pub fn epoch_ms(elements: &sgp4::Elements) -> i64 {
    elements.datetime.and_utc().timestamp_millis()
}

/// Validate that a set of elements can initialise SGP4 and propagate at epoch.
pub fn validate(elements: &sgp4::Elements) -> Result<()> {
    if elements.mean_motion.is_nan() || elements.mean_motion <= 0.0 {
        return Err(anyhow!("non-positive mean motion"));
    }
    if !(0.0..1.0).contains(&elements.eccentricity) {
        return Err(anyhow!("eccentricity out of range"));
    }
    let constants = sgp4::Constants::from_elements_afspc_compatibility_mode(elements)
        .map_err(|e| anyhow!("{e}"))?;
    constants
        .propagate_afspc_compatibility_mode(sgp4::MinutesSinceEpoch(0.0))
        .map_err(|e| anyhow!("{e}"))?;
    Ok(())
}

/// Element epoch as fractional unix milliseconds (keeps the sub-ms part of the epoch).
fn epoch_ms_f64(elements: &sgp4::Elements) -> f64 {
    let dt = elements.datetime.and_utc();
    dt.timestamp() as f64 * 1000.0 + dt.timestamp_subsec_nanos() as f64 / 1e6
}

/// Propagate `elements` to `at_ms` (unix ms, UTC).
pub fn propagate(elements: &sgp4::Elements, at_ms: i64) -> Result<Position> {
    let minutes = (at_ms as f64 - epoch_ms_f64(elements)) / 60_000.0;
    propagate_minutes(elements, minutes, at_ms as f64)
}

/// Propagate by minutes since epoch; `at_ms` is only used for the Earth rotation angle.
pub fn propagate_minutes(elements: &sgp4::Elements, minutes: f64, at_ms: f64) -> Result<Position> {
    let constants = sgp4::Constants::from_elements_afspc_compatibility_mode(elements)
        .map_err(|e| anyhow!("{e}"))?;
    let p = constants
        .propagate_afspc_compatibility_mode(sgp4::MinutesSinceEpoch(minutes))
        .map_err(|e| anyhow!("{e}"))?;
    let gmst = gmst_rad_f64(at_ms);
    let geodetic = teme_to_geodetic(p.position, gmst);
    let v = p.velocity;
    Ok(Position {
        geodetic,
        teme_km: p.position,
        speed_km_s: (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt(),
        minutes_since_epoch: minutes,
    })
}

/// IAU-82 Greenwich mean sidereal time (radians) for a unix-ms UTC instant.
/// Same expression satellite.js uses (`gstime`), so client and server agree.
pub fn gmst_rad(at_ms: i64) -> f64 {
    gmst_rad_f64(at_ms as f64)
}

fn gmst_rad_f64(at_ms: f64) -> f64 {
    let jd = at_ms / 86_400_000.0 + 2_440_587.5;
    let years_since_j2000 = (jd - 2_451_545.0) / 365.25;
    sgp4::iau_epoch_to_sidereal_time(years_since_j2000)
}

pub fn teme_to_geodetic(r: [f64; 3], gmst: f64) -> Geodetic {
    let (s, c) = gmst.sin_cos();
    let x = r[0] * c + r[1] * s;
    let y = -r[0] * s + r[1] * c;
    let z = r[2];
    ecef_to_geodetic(x, y, z)
}

/// Iterative ECEF -> WGS84 geodetic (Bowring-style fixed point, converges in a few steps).
pub fn ecef_to_geodetic(x: f64, y: f64, z: f64) -> Geodetic {
    let e2 = WGS84_F * (2.0 - WGS84_F);
    let p = (x * x + y * y).sqrt();
    let lon = y.atan2(x);
    let mut lat = z.atan2(p * (1.0 - e2));
    let mut n = WGS84_A_KM;
    for _ in 0..10 {
        let sin_lat = lat.sin();
        n = WGS84_A_KM / (1.0 - e2 * sin_lat * sin_lat).sqrt();
        let next = (z + n * e2 * sin_lat).atan2(p);
        if (next - lat).abs() < 1e-12 {
            lat = next;
            break;
        }
        lat = next;
    }
    let alt = if lat.cos().abs() > 1e-9 {
        p / lat.cos() - n
    } else {
        z.abs() - n * (1.0 - e2)
    };
    Geodetic {
        lat_deg: lat.to_degrees(),
        lon_deg: normalize_lon(lon.to_degrees()),
        alt_km: alt,
    }
}

fn normalize_lon(mut lon: f64) -> f64 {
    while lon > 180.0 {
        lon -= 360.0;
    }
    while lon < -180.0 {
        lon += 360.0;
    }
    lon
}

#[cfg(test)]
mod tests {
    use super::*;

    // Vallado SGP4 verification set, satellite 00005 (TEME example), from SGP4-VER.TLE / tcppver.out.
    // Values as reproduced in the sgp4 crate's tests/test_cases.toml (MIT).
    const L1: &str = "1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753";
    const L2: &str = "2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667";
    const VECTORS: &[(f64, [f64; 3])] = &[
        (0.0, [7022.46529266, -1400.08296755, 0.03995155]),
        (360.0, [-7154.03120202, -3783.17682504, -3536.19412294]),
        (720.0, [-7134.59340119, 6531.68641334, 3260.27186483]),
        (1440.0, [-938.55923943, -6268.18748831, -4294.02924751]),
    ];

    fn vallado_elements() -> sgp4::Elements {
        sgp4::Elements::from_tle(None, L1.as_bytes(), L2.as_bytes()).unwrap()
    }

    #[test]
    fn matches_vallado_verification_vectors() {
        let el = vallado_elements();
        validate(&el).unwrap();
        let epoch = epoch_ms_f64(&el);
        for (minutes, expected) in VECTORS {
            let p = propagate_minutes(&el, *minutes, epoch + minutes * 60_000.0).unwrap();
            for (axis, want) in expected.iter().enumerate() {
                let err_m = (p.teme_km[axis] - want).abs() * 1000.0;
                assert!(err_m < 0.01, "t={minutes} axis={axis} err={err_m} m");
            }
        }
    }

    #[test]
    fn ecef_round_numbers() {
        // On the equator at the prime meridian, on the ellipsoid surface.
        let g = ecef_to_geodetic(WGS84_A_KM, 0.0, 0.0);
        assert!(g.lat_deg.abs() < 1e-9 && g.lon_deg.abs() < 1e-9 && g.alt_km.abs() < 1e-6);
        // North pole.
        let b = WGS84_A_KM * (1.0 - WGS84_F);
        let pole = ecef_to_geodetic(0.0, 0.0, b + 100.0);
        assert!((pole.lat_deg - 90.0).abs() < 1e-6);
        assert!((pole.alt_km - 100.0).abs() < 1e-6);
    }

    #[test]
    fn gmst_at_j2000_matches_reference() {
        // GMST at 2000-01-01 12:00 UTC (JD 2451545.0) is 280.46061837 deg.
        let j2000_ms = 946_728_000_000_i64;
        let deg = gmst_rad(j2000_ms).to_degrees();
        assert!((deg - 280.46061837).abs() < 1e-6, "{deg}");
    }

    #[test]
    fn iss_fixture_is_physically_plausible() {
        let raw = include_str!("../../../tests/fixtures/celestrak/iss.2020-07-12.omm.json");
        let list: Vec<sgp4::Elements> = serde_json::from_str(raw).unwrap();
        let iss = &list[0];
        validate(iss).unwrap();
        let p = propagate(iss, epoch_ms(iss) + 45 * 60_000).unwrap();
        assert!(
            (350.0..460.0).contains(&p.geodetic.alt_km),
            "alt {}",
            p.geodetic.alt_km
        );
        assert!(
            p.geodetic.lat_deg.abs() <= 51.7,
            "lat {}",
            p.geodetic.lat_deg
        );
        assert!((7.4..7.9).contains(&p.speed_km_s), "speed {}", p.speed_km_s);
    }

    #[test]
    fn rejects_unusable_elements() {
        let mut el = vallado_elements();
        el.mean_motion = 0.0;
        assert!(validate(&el).is_err());
        let mut el = vallado_elements();
        el.eccentricity = 1.2;
        assert!(validate(&el).is_err());
    }
}

#[cfg(test)]
mod golden {
    //! Cross-implementation golden file: the web client (satellite.js) must reproduce these
    //! positions (apps/web/src/lib/orbit.test.ts). Regenerate with HARPY_UPDATE_GOLDEN=1.
    use super::*;

    const GOLDEN: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../tests/fixtures/golden/iss_positions.json"
    );

    #[test]
    fn iss_golden_positions() {
        let raw = include_str!("../../../tests/fixtures/celestrak/iss.2020-07-12.omm.json");
        let iss: Vec<sgp4::Elements> = serde_json::from_str(raw).unwrap();
        let epoch = epoch_ms(&iss[0]);
        let rows: Vec<serde_json::Value> = [0i64, 30, 60, 600, 1440, 2880]
            .iter()
            .map(|m| {
                let at = epoch + m * 60_000;
                let p = propagate(&iss[0], at).unwrap();
                serde_json::json!({"at_ms": at, "lat": p.geodetic.lat_deg, "lon": p.geodetic.lon_deg,
                                   "alt_km": p.geodetic.alt_km})
            })
            .collect();
        let doc =
            serde_json::json!({"source": "harpy-core orbit.rs", "norad_id": 25544, "rows": rows});
        if std::env::var("HARPY_UPDATE_GOLDEN").is_ok() {
            std::fs::write(GOLDEN, serde_json::to_string_pretty(&doc).unwrap() + "\n").unwrap();
        }
        let stored: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(GOLDEN).unwrap()).unwrap();
        for (a, b) in stored["rows"].as_array().unwrap().iter().zip(rows.iter()) {
            for k in ["lat", "lon", "alt_km"] {
                let d = (a[k].as_f64().unwrap() - b[k].as_f64().unwrap()).abs();
                assert!(d < 1e-9, "{k} drifted by {d}");
            }
        }
    }
}
