//! Redis Consumer for Track Processing
//!
//! Consumes tracks from Redis pub/sub and processes them through the fusion engine.

use crate::rules::RuleEngine;
use crate::{persist_fusion_outputs, AlertUpsertRecord, AppState, LinkUpsertRecord, TrackObservation};
use futures_util::StreamExt;
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::Mutex;

/// JSON representation of TrackDelta from Redis
#[derive(Debug, Deserialize)]
struct TrackDeltaJson {
    id: String,
    kind: i32,
    position: Option<PositionJson>,
    heading: f64,
    speed: f64,
    ts_ms: u64,
    provider_id: String,
    #[serde(default)]
    meta: std::collections::HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct PositionJson {
    lat: f64,
    lon: f64,
    alt: f64,
}

pub struct RedisConsumer {
    client: redis::aio::ConnectionManager,
    state: AppState,
    rule_engine: Arc<RuleEngine>,
    track_buffer: Arc<Mutex<Vec<TrackObservation>>>,
    buffer_size: usize,
}

impl RedisConsumer {
    pub async fn new(redis_url: &str, state: AppState, rule_engine: Arc<RuleEngine>) -> anyhow::Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let connection = redis::aio::ConnectionManager::new(client).await?;
        
        Ok(Self {
            client: connection,
            state,
            rule_engine,
            track_buffer: Arc::new(Mutex::new(Vec::new())),
            buffer_size: 100, // Process in batches of 100 tracks
        })
    }

    pub async fn run(&self) -> anyhow::Result<()> {
        tracing::info!("Starting Redis consumer for track processing");

        // Clone for the processing task
        let buffer = self.track_buffer.clone();
        let state = self.state.clone();
        let rule_engine = self.rule_engine.clone();
        
        // Spawn buffer processing task
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
            
            loop {
                interval.tick().await;
                
                let tracks_to_process = {
                    let mut buf = buffer.lock().await;
                    if buf.len() >= 10 { // Process if we have at least 10 tracks
                        std::mem::take(&mut *buf)
                    } else {
                        Vec::new()
                    }
                };
                
                if !tracks_to_process.is_empty() {
                    if let Err(e) = process_tracks(&state, &rule_engine, tracks_to_process).await {
                        tracing::error!("Failed to process tracks: {}", e);
                    }
                }
            }
        });

        // Create a new connection for pub/sub
        let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        let client = redis::Client::open(redis_url)?;
        
        let mut pubsub_conn = loop {
            match client.get_async_connection().await {
                Ok(conn) => break conn.into_pubsub(),
                Err(e) => {
                    tracing::warn!("Failed to create pubsub connection: {}, retrying...", e);
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    continue;
                }
            }
        };
        
        pubsub_conn.subscribe("tracks:updates").await?;
        tracing::info!("Subscribed to tracks:updates channel");

        let mut msg_stream = pubsub_conn.on_message();

        loop {
            match msg_stream.next().await {
                Some(msg) => {
                    let payload: String = match msg.get_payload::<String>() {
                        Ok(p) => p,
                        Err(e) => {
                            tracing::warn!("Failed to get payload: {}", e);
                            continue;
                        }
                    };

                    if let Err(e) = self.handle_track_batch(payload).await {
                        tracing::warn!("Failed to handle track batch: {}", e);
                    }
                }
                None => {
                    tracing::warn!("Redis pub/sub stream closed, reconnecting...");
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
            }
        }
    }

    async fn handle_track_batch(&self, payload: String) -> anyhow::Result<()> {
        let tracks_json: Vec<TrackDeltaJson> = serde_json::from_str(&payload)?;
        
        let tracks: Vec<TrackObservation> = tracks_json
            .into_iter()
            .map(|t| TrackObservation {
                id: t.id,
                kind: match t.kind {
                    1 => "AIRCRAFT".to_string(),
                    2 => "SATELLITE".to_string(),
                    3 => "GROUND".to_string(),
                    4 => "VESSEL".to_string(),
                    _ => "UNKNOWN".to_string(),
                },
                lat: t.position.as_ref().map(|p| p.lat).unwrap_or(0.0),
                lon: t.position.as_ref().map(|p| p.lon).unwrap_or(0.0),
                alt: t.position.as_ref().map(|p| p.alt).unwrap_or(0.0),
                heading: Some(t.heading),
                speed: Some(t.speed),
                ts_ms: t.ts_ms as i64,
                provider_id: t.provider_id,
                meta: serde_json::to_value(t.meta).unwrap_or_default(),
            })
            .collect();

        // Add to buffer
        let mut buffer = self.track_buffer.lock().await;
        buffer.extend(tracks);
        
        // If buffer is full, process immediately
        if buffer.len() >= self.buffer_size {
            let tracks_to_process = std::mem::take(&mut *buffer);
            drop(buffer); // Release lock before processing
            
            if let Err(e) = process_tracks(&self.state, &self.rule_engine, tracks_to_process).await {
                tracing::error!("Failed to process tracks: {}", e);
            }
        }

        Ok(())
    }
}

async fn process_tracks(
    state: &AppState,
    rule_engine: &RuleEngine,
    tracks: Vec<TrackObservation>,
) -> anyhow::Result<()> {
    if tracks.is_empty() {
        return Ok(());
    }

    let now_ms = crate::now_ms();
    
    // Group tracks by H3 cell
    let mut cell_buckets: std::collections::HashMap<String, Vec<TrackObservation>> = std::collections::HashMap::new();
    for track in &tracks {
        match crate::to_h3_cell(track.lat, track.lon, state.h3_resolution) {
            Ok(cell) => {
                cell_buckets.entry(cell).or_default().push(track.clone());
            }
            Err(error) => {
                tracing::warn!(track_id = %track.id, %error, "failed to compute H3 cell");
            }
        }
    }

    // Run rules
    let rule_results = rule_engine.evaluate(&tracks, &cell_buckets, now_ms).await;

    let mut all_alerts: Vec<AlertUpsertRecord> = Vec::new();
    let mut all_links: Vec<LinkUpsertRecord> = Vec::new();

    for result in rule_results {
        match result {
            crate::rules::RuleResult::Alert { alert, links } => {
                // Check deduplication
                let dedup_key = format!("{}:{}", alert.title, alert.description);
                let should_skip = if let Some(last_seen) = state.dedup_cache.get(&dedup_key) {
                    now_ms - *last_seen < state.dedup_ttl_ms
                } else {
                    false
                };

                if should_skip {
                    continue;
                }
                state.dedup_cache.insert(dedup_key, now_ms);

                all_alerts.push(alert);
                all_links.extend(links);
            }
            crate::rules::RuleResult::Link(link) => {
                all_links.push(link);
            }
        }
    }

    // Publish to Redis
    if let Some(ref publisher) = state.redis_publisher {
        for alert in &all_alerts {
            if let Err(e) = publisher.publish_alert(alert).await {
                tracing::warn!("Failed to publish alert: {}", e);
            }
        }
        for link in &all_links {
            if let Err(e) = publisher.publish_link(link).await {
                tracing::warn!("Failed to publish link: {}", e);
            }
        }
    }

    // Persist to database
    if !all_alerts.is_empty() {
        if let Some(ref pool) = state.db_pool {
            if let Err(e) = persist_fusion_outputs(pool, &all_alerts, &all_links).await {
                tracing::error!("Failed to persist fusion outputs: {}", e);
            } else {
                tracing::info!(
                    "Processed {} tracks, generated {} alerts, {} links",
                    tracks.len(),
                    all_alerts.len(),
                    all_links.len()
                );
            }
        }
    }

    Ok(())
}
