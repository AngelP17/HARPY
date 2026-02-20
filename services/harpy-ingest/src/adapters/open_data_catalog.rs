use super::Provider;
use anyhow::Context;
use async_trait::async_trait;
use chrono::DateTime;
use harpy_proto::harpy::v1::{Position, TrackDelta, TrackKind};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::time::Duration;

const DEFAULT_PROVIDER_ID: &str = "open-data-catalog";
const DEFAULT_AIDDATA_CATALOG_URL: &str = "https://www.aiddata.org/geoquery/data-documentation";
const DEFAULT_GEE_CATALOG_URL: &str =
    "https://raw.githubusercontent.com/samapriya/awesome-gee-community-datasets/master/community_datasets.json";
const DEFAULT_DATAVERSE_SEARCH_URL: &str = "https://dataverse.harvard.edu/api/search";
const DEFAULT_DATAVERSE_QUERY: &str = "*";
const DEFAULT_DATAVERSE_GEO_POINT: &str = "0,0";

#[derive(Debug, Clone, Copy)]
struct BBox {
    west_lon: f64,
    east_lon: f64,
    north_lat: f64,
    south_lat: f64,
}

impl BBox {
    fn centroid(self) -> (f64, f64) {
        let lat = ((self.north_lat + self.south_lat) / 2.0).clamp(-90.0, 90.0);
        let lon = if self.west_lon <= self.east_lon {
            (self.west_lon + self.east_lon) / 2.0
        } else {
            let wrapped = (self.west_lon + self.east_lon + 360.0) / 2.0;
            if wrapped > 180.0 {
                wrapped - 360.0
            } else {
                wrapped
            }
        }
        .clamp(-180.0, 180.0);

        (lat, lon)
    }
}

pub struct OpenDataCatalogProvider {
    provider_id: String,
    client: reqwest::Client,
    aiddata_catalog_url: String,
    aiddata_max_items: usize,
    enable_aiddata: bool,
    gee_catalog_url: String,
    gee_max_items: usize,
    enable_gee: bool,
    dataverse_search_url: String,
    dataverse_query: String,
    dataverse_geo_point: Option<(f64, f64)>,
    dataverse_geo_radius_km: Option<f64>,
    dataverse_per_page: usize,
    dataverse_max_items: usize,
    dataverse_max_pages: usize,
    enable_dataverse: bool,
}

#[derive(Debug, Clone)]
struct AidDataCatalogEntry {
    title: String,
    description: String,
    publisher: String,
    tags: String,
    dataset_url: String,
    slug: String,
}

#[derive(Debug, Deserialize)]
struct GeeCommunityEntry {
    title: String,
    id: String,
    provider: Option<String>,
    tags: Option<String>,
    docs: Option<String>,
    license: Option<String>,
    thematic_group: Option<String>,
    #[serde(rename = "type")]
    item_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DataverseSearchResponse {
    data: DataverseSearchData,
}

#[derive(Debug, Deserialize)]
struct DataverseSearchData {
    total_count: usize,
    items: Vec<DataverseDatasetItem>,
}

#[derive(Debug, Deserialize)]
struct DataverseDatasetItem {
    name: String,
    #[serde(default)]
    global_id: String,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    publisher: Option<String>,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    subjects: Vec<String>,
    #[serde(default, rename = "metadataBlocks")]
    metadata_blocks: HashMap<String, DataverseMetadataBlock>,
}

#[derive(Debug, Deserialize)]
struct DataverseMetadataBlock {
    #[serde(default)]
    fields: Vec<DataverseMetadataField>,
}

#[derive(Debug, Deserialize)]
struct DataverseMetadataField {
    #[serde(rename = "typeName")]
    type_name: String,
    value: Value,
}

impl OpenDataCatalogProvider {
    pub fn from_env() -> anyhow::Result<Self> {
        let aiddata_catalog_url = std::env::var("AIDDATA_CATALOG_URL")
            .unwrap_or_else(|_| DEFAULT_AIDDATA_CATALOG_URL.to_string());
        let gee_catalog_url = std::env::var("GEE_COMMUNITY_CATALOG_URL")
            .unwrap_or_else(|_| DEFAULT_GEE_CATALOG_URL.to_string());
        let dataverse_search_url = std::env::var("DATAVERSE_SEARCH_URL")
            .unwrap_or_else(|_| DEFAULT_DATAVERSE_SEARCH_URL.to_string());
        let dataverse_query = std::env::var("DATAVERSE_SEARCH_QUERY")
            .unwrap_or_else(|_| DEFAULT_DATAVERSE_QUERY.to_string());

        let dataverse_geo_point = match std::env::var("DATAVERSE_GEO_POINT") {
            Ok(raw) => parse_lat_lon_pair(&raw)
                .with_context(|| format!("invalid DATAVERSE_GEO_POINT value: {raw}"))?,
            Err(_) => parse_lat_lon_pair(DEFAULT_DATAVERSE_GEO_POINT)
                .context("invalid default DATAVERSE_GEO_POINT")?,
        };

        let dataverse_geo_radius_km = match std::env::var("DATAVERSE_GEO_RADIUS_KM") {
            Ok(raw) => {
                let parsed = raw
                    .parse::<f64>()
                    .with_context(|| format!("invalid DATAVERSE_GEO_RADIUS_KM value: {raw}"))?;
                if parsed <= 0.0 {
                    None
                } else {
                    Some(parsed)
                }
            }
            Err(_) => Some(20_000.0),
        };

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("failed to build open-data HTTP client")?;

        Ok(Self {
            provider_id: DEFAULT_PROVIDER_ID.to_string(),
            client,
            aiddata_catalog_url,
            aiddata_max_items: env_usize("AIDDATA_MAX_ITEMS", 150),
            enable_aiddata: env_bool("ENABLE_AIDDATA_GEOQUERY_CATALOG", true),
            gee_catalog_url,
            gee_max_items: env_usize("GEE_CATALOG_MAX_ITEMS", 150),
            enable_gee: env_bool("ENABLE_GEE_COMMUNITY_CATALOG", true),
            dataverse_search_url,
            dataverse_query,
            dataverse_geo_point,
            dataverse_geo_radius_km,
            dataverse_per_page: env_usize("DATAVERSE_PER_PAGE", 100).clamp(1, 1000),
            dataverse_max_items: env_usize("DATAVERSE_MAX_ITEMS", 200),
            dataverse_max_pages: env_usize("DATAVERSE_MAX_PAGES", 10),
            enable_dataverse: env_bool("ENABLE_DATAVERSE_CATALOG", true),
        })
    }

    async fn fetch_aiddata_tracks(&self) -> anyhow::Result<Vec<TrackDelta>> {
        let html = self
            .client
            .get(&self.aiddata_catalog_url)
            .send()
            .await
            .context("AidData catalog request failed")?
            .error_for_status()
            .context("AidData catalog request returned non-success status")?
            .text()
            .await
            .context("failed reading AidData catalog body")?;

        let now = now_ms();
        let entries = parse_aiddata_entries(&html, self.aiddata_max_items);
        let tracks = entries
            .into_iter()
            .map(|entry| {
                let synthetic = synthetic_position(&entry.slug, "aiddata");
                let mut meta = HashMap::new();
                meta.insert("catalog_source".to_string(), "AidData GeoQuery".to_string());
                meta.insert("dataset_title".to_string(), entry.title);
                meta.insert("description".to_string(), entry.description);
                meta.insert("publisher".to_string(), entry.publisher);
                meta.insert("tags".to_string(), entry.tags);
                meta.insert("dataset_url".to_string(), entry.dataset_url);
                meta.insert("position_mode".to_string(), "synthetic_catalog".to_string());

                TrackDelta {
                    id: make_track_id("AIDDATA", &entry.slug),
                    kind: TrackKind::Ground as i32,
                    position: Some(synthetic),
                    heading: 0.0,
                    speed: 0.0,
                    ts_ms: now,
                    provider_id: self.provider_id.clone(),
                    meta,
                }
            })
            .collect();

        Ok(tracks)
    }

    async fn fetch_gee_tracks(&self) -> anyhow::Result<Vec<TrackDelta>> {
        let entries: Vec<GeeCommunityEntry> = self
            .client
            .get(&self.gee_catalog_url)
            .send()
            .await
            .context("GEE community catalog request failed")?
            .error_for_status()
            .context("GEE community catalog returned non-success status")?
            .json()
            .await
            .context("failed parsing GEE community catalog JSON")?;

        let now = now_ms();
        let mut tracks = Vec::with_capacity(entries.len().min(self.gee_max_items));
        let mut seen = HashSet::new();

        for entry in entries.into_iter().take(self.gee_max_items) {
            let key = entry.id.trim();
            if key.is_empty() || !seen.insert(key.to_string()) {
                continue;
            }

            let synthetic = synthetic_position(key, "gee");
            let mut meta = HashMap::new();
            meta.insert(
                "catalog_source".to_string(),
                "GEE Community Catalog".to_string(),
            );
            meta.insert("dataset_title".to_string(), entry.title.clone());
            meta.insert("dataset_id".to_string(), entry.id.clone());
            if let Some(group) = entry.thematic_group {
                meta.insert("thematic_group".to_string(), group);
            }
            if let Some(provider) = entry.provider {
                meta.insert("publisher".to_string(), provider);
            }
            if let Some(tags) = entry.tags {
                meta.insert("tags".to_string(), tags);
            }
            if let Some(license) = entry.license {
                meta.insert("license".to_string(), license);
            }
            if let Some(docs) = entry.docs {
                meta.insert("dataset_url".to_string(), docs);
            }
            if let Some(item_type) = entry.item_type {
                meta.insert("asset_type".to_string(), item_type);
            }
            meta.insert("position_mode".to_string(), "synthetic_catalog".to_string());

            tracks.push(TrackDelta {
                id: make_track_id("GEE", &entry.id),
                kind: TrackKind::Ground as i32,
                position: Some(synthetic),
                heading: 0.0,
                speed: 0.0,
                ts_ms: now,
                provider_id: self.provider_id.clone(),
                meta,
            });
        }

        Ok(tracks)
    }

    async fn fetch_dataverse_tracks(&self) -> anyhow::Result<Vec<TrackDelta>> {
        let mut tracks = Vec::new();
        let mut start = 0usize;
        let mut scanned_pages = 0usize;
        let mut total_count = usize::MAX;
        let now = now_ms();

        while tracks.len() < self.dataverse_max_items
            && scanned_pages < self.dataverse_max_pages
            && start < total_count
        {
            let mut query = vec![
                ("q", self.dataverse_query.clone()),
                ("type", "dataset".to_string()),
                ("sort", "date".to_string()),
                ("order", "desc".to_string()),
                ("per_page", self.dataverse_per_page.to_string()),
                ("start", start.to_string()),
                ("metadata_fields", "geospatial:*".to_string()),
            ];

            if let (Some((lat, lon)), Some(radius)) =
                (self.dataverse_geo_point, self.dataverse_geo_radius_km)
            {
                query.push(("geo_point", format!("{lat},{lon}")));
                query.push(("geo_radius", radius.to_string()));
            }

            let payload: DataverseSearchResponse = self
                .client
                .get(&self.dataverse_search_url)
                .query(&query)
                .send()
                .await
                .context("Dataverse catalog request failed")?
                .error_for_status()
                .context("Dataverse catalog request returned non-success status")?
                .json()
                .await
                .context("failed parsing Dataverse search response")?;

            total_count = payload.data.total_count;
            if payload.data.items.is_empty() {
                break;
            }

            for item in payload.data.items {
                if tracks.len() >= self.dataverse_max_items {
                    break;
                }

                let Some(track) = self.dataverse_item_to_track(item, now) else {
                    continue;
                };
                tracks.push(track);
            }

            start = start.saturating_add(self.dataverse_per_page);
            scanned_pages = scanned_pages.saturating_add(1);
        }

        Ok(tracks)
    }

    fn dataverse_item_to_track(&self, item: DataverseDatasetItem, ts_ms: u64) -> Option<TrackDelta> {
        let geospatial_block = item.metadata_blocks.get("geospatial")?;
        let bbox = extract_bbox_from_geospatial_block(geospatial_block)?;
        let (lat, lon) = bbox.centroid();

        let mut meta = HashMap::new();
        meta.insert(
            "catalog_source".to_string(),
            "Harvard Dataverse".to_string(),
        );
        meta.insert("dataset_title".to_string(), item.name.clone());
        if !item.global_id.is_empty() {
            meta.insert("global_id".to_string(), item.global_id.clone());
        }
        if let Some(url) = item.url {
            meta.insert("dataset_url".to_string(), url);
        }
        if let Some(publisher) = item.publisher {
            meta.insert("publisher".to_string(), publisher);
        }
        if !item.subjects.is_empty() {
            meta.insert("subjects".to_string(), item.subjects.join(", "));
        }
        if let Some(published) = item.published_at {
            meta.insert("source_published_at".to_string(), published);
        }

        meta.insert("bbox_west_lon".to_string(), bbox.west_lon.to_string());
        meta.insert("bbox_east_lon".to_string(), bbox.east_lon.to_string());
        meta.insert("bbox_north_lat".to_string(), bbox.north_lat.to_string());
        meta.insert("bbox_south_lat".to_string(), bbox.south_lat.to_string());
        meta.insert("position_mode".to_string(), "bbox_centroid".to_string());

        let identity = if item.global_id.is_empty() {
            item.name
        } else {
            item.global_id
        };

        Some(TrackDelta {
            id: make_track_id("DATAVERSE", &identity),
            kind: TrackKind::Ground as i32,
            position: Some(Position { lat, lon, alt: 0.0 }),
            heading: 0.0,
            speed: 0.0,
            ts_ms,
            provider_id: self.provider_id.clone(),
            meta,
        })
    }
}

#[async_trait]
impl Provider for OpenDataCatalogProvider {
    async fn fetch(&self) -> anyhow::Result<Vec<TrackDelta>> {
        let mut tracks = Vec::new();
        let mut errors = Vec::new();

        if self.enable_aiddata {
            match self.fetch_aiddata_tracks().await {
                Ok(mut result) => tracks.append(&mut result),
                Err(e) => errors.push(format!("aiddata={e}")),
            }
        }

        if self.enable_gee {
            match self.fetch_gee_tracks().await {
                Ok(mut result) => tracks.append(&mut result),
                Err(e) => errors.push(format!("gee={e}")),
            }
        }

        if self.enable_dataverse {
            match self.fetch_dataverse_tracks().await {
                Ok(mut result) => tracks.append(&mut result),
                Err(e) => errors.push(format!("dataverse={e}")),
            }
        }

        if tracks.is_empty() && !errors.is_empty() {
            anyhow::bail!(
                "open-data catalog fetch failed for all enabled sources: {}",
                errors.join("; ")
            );
        }

        Ok(tracks)
    }

    fn provider_id(&self) -> &str {
        &self.provider_id
    }
}

fn parse_aiddata_entries(html: &str, max_items: usize) -> Vec<AidDataCatalogEntry> {
    let mut entries = Vec::new();
    let mut seen_slugs = HashSet::new();

    for chunk in html
        .split("<div role=\"listitem\" class=\"card w-dyn-item\">")
        .skip(1)
    {
        if entries.len() >= max_items {
            break;
        }

        let Some(href) = extract_between(chunk, "<a href=\"", "\"") else {
            continue;
        };
        if !href.starts_with("/geoquery-datasets/") {
            continue;
        }

        let Some(title_raw) = extract_between(chunk, "<h2 class=\"card-title-2\">", "</h2>") else {
            continue;
        };

        let details = extract_all_between(chunk, "<p class=\"card-body-text\">", "</p>");
        let description = details.first().cloned().unwrap_or_default();
        let publisher = details.get(1).cloned().unwrap_or_default();
        let tags = details.get(2).cloned().unwrap_or_default();

        let slug = href
            .trim_start_matches("/geoquery-datasets/")
            .trim()
            .to_string();
        if slug.is_empty() || !seen_slugs.insert(slug.clone()) {
            continue;
        }

        entries.push(AidDataCatalogEntry {
            title: decode_html_entities(title_raw).trim().to_string(),
            description: decode_html_entities(description).trim().to_string(),
            publisher: decode_html_entities(publisher).trim().to_string(),
            tags: decode_html_entities(tags).trim().to_string(),
            dataset_url: format!("https://www.aiddata.org{href}"),
            slug,
        });
    }

    entries
}

fn extract_bbox_from_geospatial_block(block: &DataverseMetadataBlock) -> Option<BBox> {
    for field in &block.fields {
        if field.type_name != "geographicBoundingBox" {
            continue;
        }

        let boxes = field.value.as_array()?;
        for candidate in boxes {
            let west_lon = extract_nested_value(candidate, "westLongitude")?;
            let east_lon = extract_nested_value(candidate, "eastLongitude")?;
            let north_lat = extract_nested_value(candidate, "northLatitude")?;
            let south_lat = extract_nested_value(candidate, "southLatitude")?;

            if !(-180.0..=180.0).contains(&west_lon)
                || !(-180.0..=180.0).contains(&east_lon)
                || !(-90.0..=90.0).contains(&north_lat)
                || !(-90.0..=90.0).contains(&south_lat)
            {
                continue;
            }

            let (north_lat, south_lat) = if north_lat >= south_lat {
                (north_lat, south_lat)
            } else {
                (south_lat, north_lat)
            };

            return Some(BBox {
                west_lon,
                east_lon,
                north_lat,
                south_lat,
            });
        }
    }

    None
}

fn extract_nested_value(value: &Value, key: &str) -> Option<f64> {
    value
        .get(key)?
        .get("value")?
        .as_str()?
        .parse::<f64>()
        .ok()
}

fn extract_between<'a>(text: &'a str, start: &str, end: &str) -> Option<&'a str> {
    let start_idx = text.find(start)? + start.len();
    let rest = &text[start_idx..];
    let end_idx = rest.find(end)?;
    Some(&rest[..end_idx])
}

fn extract_all_between(text: &str, start: &str, end: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut cursor = text;

    while let Some(start_idx) = cursor.find(start) {
        let rest = &cursor[start_idx + start.len()..];
        let Some(end_idx) = rest.find(end) else {
            break;
        };

        values.push(rest[..end_idx].to_string());
        cursor = &rest[end_idx + end.len()..];
    }

    values
}

fn decode_html_entities(input: impl AsRef<str>) -> String {
    input
        .as_ref()
        .replace("&amp;", "&")
        .replace("&#x27;", "'")
        .replace("&#39;", "'")
        .replace("&quot;", "\"")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn parse_lat_lon_pair(raw: &str) -> anyhow::Result<Option<(f64, f64)>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let mut parts = trimmed.split(',').map(str::trim);
    let lat = parts
        .next()
        .context("missing latitude")?
        .parse::<f64>()
        .context("invalid latitude")?;
    let lon = parts
        .next()
        .context("missing longitude")?
        .parse::<f64>()
        .context("invalid longitude")?;

    if parts.next().is_some() {
        anyhow::bail!("expected exactly two comma-separated values");
    }
    if !(-90.0..=90.0).contains(&lat) {
        anyhow::bail!("latitude out of range [-90, 90]");
    }
    if !(-180.0..=180.0).contains(&lon) {
        anyhow::bail!("longitude out of range [-180, 180]");
    }

    Ok(Some((lat, lon)))
}

fn synthetic_position(seed: &str, namespace: &str) -> Position {
    let hash = stable_hash(format!("{namespace}:{seed}").as_bytes());

    let lat_fraction = (hash & 0x0000_FFFF) as f64 / 65_535.0;
    let lon_fraction = ((hash >> 16) & 0x0000_FFFF) as f64 / 65_535.0;

    Position {
        lat: (lat_fraction * 150.0) - 75.0,
        lon: (lon_fraction * 360.0) - 180.0,
        alt: 0.0,
    }
}

fn make_track_id(prefix: &str, value: &str) -> String {
    format!("{prefix}-{:016x}", stable_hash(value.as_bytes()))
}

fn stable_hash(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x1000_0000_01b3);
    }
    hash
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(default)
}

fn env_bool(name: &str, default: bool) -> bool {
    match std::env::var(name) {
        Ok(value) => matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => default,
    }
}

fn _parse_published_ts_ms(value: &str) -> Option<u64> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|datetime| datetime.timestamp_millis().max(0) as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_aiddata_cards() {
        let html = r#"
        <div role="listitem" class="card w-dyn-item">
          <a href="/geoquery-datasets/test-dataset" class="white-card-link w-inline-block">
            <div class="card-text-wrap">
              <h2 class="card-title-2">Test &amp; Dataset</h2>
              <h4 class="card-subheading-2">Description</h4>
              <p class="card-body-text">Description text</p>
              <h4 class="card-subheading-2">Publisher</h4>
              <p class="card-body-text">AidData</p>
              <h4 class="card-subheading-2">Tags</h4>
              <p class="card-body-text">aid, geospatial</p>
            </div>
          </a>
        </div>
        "#;

        let entries = parse_aiddata_entries(html, 10);
        assert_eq!(entries.len(), 1);
        let entry = &entries[0];
        assert_eq!(entry.slug, "test-dataset");
        assert_eq!(entry.title, "Test & Dataset");
        assert_eq!(entry.publisher, "AidData");
        assert_eq!(entry.dataset_url, "https://www.aiddata.org/geoquery-datasets/test-dataset");
    }

    #[test]
    fn extracts_dataverse_bbox() {
        let value = serde_json::json!({
            "fields": [
                {
                    "typeName": "geographicBoundingBox",
                    "value": [
                        {
                            "westLongitude": { "value": "-77.5" },
                            "eastLongitude": { "value": "-77.0" },
                            "northLatitude": { "value": "39.0" },
                            "southLatitude": { "value": "38.5" }
                        }
                    ]
                }
            ]
        });

        let block: DataverseMetadataBlock = serde_json::from_value(value).expect("valid block");
        let bbox = extract_bbox_from_geospatial_block(&block).expect("bbox present");

        assert!((bbox.west_lon + 77.5).abs() < f64::EPSILON);
        assert!((bbox.east_lon + 77.0).abs() < f64::EPSILON);
        assert!((bbox.north_lat - 39.0).abs() < f64::EPSILON);
        assert!((bbox.south_lat - 38.5).abs() < f64::EPSILON);

        let (lat, lon) = bbox.centroid();
        assert!((lat - 38.75).abs() < f64::EPSILON);
        assert!((lon + 77.25).abs() < f64::EPSILON);
    }

    #[test]
    fn synthetic_position_is_deterministic() {
        let one = synthetic_position("projects/sat-io/open-datasets/demo", "gee");
        let two = synthetic_position("projects/sat-io/open-datasets/demo", "gee");
        assert!((one.lat - two.lat).abs() < f64::EPSILON);
        assert!((one.lon - two.lon).abs() < f64::EPSILON);
    }

    #[test]
    fn parses_lat_lon_pair() {
        let parsed = parse_lat_lon_pair("42.3601,-71.0589")
            .expect("parse succeeds")
            .expect("value present");
        assert!((parsed.0 - 42.3601).abs() < f64::EPSILON);
        assert!((parsed.1 + 71.0589).abs() < f64::EPSILON);
    }
}
