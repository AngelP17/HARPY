# Providers and terms

Last reviewed 2026-10-21. Re-check before any commercial use.

| Source | Status | License class | Terms | How HARPY uses it |
|---|---|---|---|---|
| USGS Earthquake Hazards Program, GeoJSON summary feeds | **Active** | `public-domain-us-gov` | US Government work, public domain. Credit "U.S. Geological Survey" requested. https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits | `all_day.geojson` each cycle; `all_week.geojson` once to seed an empty store |
| CelesTrak GP element sets (OMM JSON) | **Active** | `celestrak-public-attribution` | Free public data; attribute CelesTrak. Don't re-download a group more often than it updates (about every 2 h); abusive clients get blocked. https://celestrak.org/NORAD/documentation/gp-data-formats.php | Groups `stations`, `visual`, `gps-ops`, `weather`; each group at most once per 2 h (`HARPY_CELESTRAK_MIN_REFRESH_SECS`) |
| Natural Earth II imagery (shipped with CesiumJS) | **Active** | public domain | https://www.naturalearthdata.com/about/terms-of-use/ | Self-hosted base imagery. No external tile requests. |
| OpenSky Network | **Removed** | n/a | Requires written permission beyond research use | Was the old default aircraft source |
| adsb.lol | **Pending owner action** | ODbL | Contact the operator before production use | Aircraft layer, after confirmation |
| Cesium ion | Not used | n/a | Requires a token and account terms | No token is configured or needed |
| OpenStreetMap tiles | Not used | n/a | Tile usage policy forbids heavy or production use without your own infrastructure | Removed with the old proxy route |
| Camera feeds | Not used | n/a | Only official feeds with documented terms (DOT/511, Windy Webcams API) may be added later | Never scraped or unsecured cameras |

User-Agent sent on every request: `HARPY/0.1 (+https://github.com/AngelP17/HARPY; scheduled monitor)` (configurable).
