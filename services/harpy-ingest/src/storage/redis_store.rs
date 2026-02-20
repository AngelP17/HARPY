use harpy_proto::harpy::v1::TrackDelta;
use redis::{aio::ConnectionManager, AsyncCommands};
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct RedisStore {
    client: ConnectionManager,
}

/// JSON-serializable representation of TrackDelta for Redis storage
#[derive(Serialize, Deserialize)]
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

#[derive(Serialize, Deserialize)]
struct PositionJson {
    lat: f64,
    lon: f64,
    alt: f64,
}

impl RedisStore {
    pub async fn new(redis_url: &str) -> anyhow::Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let connection = ConnectionManager::new(client).await?;
        Ok(Self { client: connection })
    }

    /// Convert TrackDelta to JSON representation
    fn to_json(track: &TrackDelta) -> TrackDeltaJson {
        TrackDeltaJson {
            id: track.id.clone(),
            kind: track.kind,
            position: track.position.as_ref().map(|p| PositionJson {
                lat: p.lat,
                lon: p.lon,
                alt: p.alt,
            }),
            heading: track.heading,
            speed: track.speed,
            ts_ms: track.ts_ms,
            provider_id: track.provider_id.clone(),
            meta: track.meta.clone(),
        }
    }

    /// Store a track in Redis with 1-hour TTL
    pub async fn store_track(&mut self, track: &TrackDelta) -> anyhow::Result<()> {
        let key = format!("track:{}", track.id);
        let json_track = Self::to_json(track);
        let value = serde_json::to_string(&json_track)?;

        // Store with 1-hour TTL (3600 seconds)
        self.client.set_ex::<_, _, ()>(&key, value, 3600).await?;

        tracing::debug!("Stored track {} in Redis", track.id);
        Ok(())
    }

    /// Store multiple tracks
    pub async fn store_tracks(&mut self, tracks: &[TrackDelta]) -> anyhow::Result<()> {
        for track in tracks {
            if let Err(e) = self.store_track(track).await {
                tracing::warn!("Failed to store track {} in Redis: {}", track.id, e);
            }
        }
        Ok(())
    }

    /// Publish track batch to Redis pub/sub channel
    pub async fn publish_track_batch(&mut self, tracks: &[TrackDelta]) -> anyhow::Result<()> {
        if tracks.is_empty() {
            return Ok(());
        }

        let channel = "tracks:updates";
        let json_tracks: Vec<TrackDeltaJson> = tracks.iter().map(Self::to_json).collect();
        let batch_json = serde_json::to_string(&json_tracks)?;

        self.client.publish::<_, _, ()>(channel, batch_json).await?;

        tracing::debug!("Published {} tracks to Redis channel", tracks.len());
        Ok(())
    }

    /// Update provider health status
    pub async fn update_provider_status(
        &mut self,
        provider_id: &str,
        circuit_state: &str,
        freshness: &str,
        success: bool,
    ) -> anyhow::Result<()> {
        let key = format!("provider:status:{}", provider_id);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis() as u64;

        let status = serde_json::json!({
            "provider_id": provider_id,
            "circuit_state": circuit_state,
            "freshness": freshness,
            "last_update_ts_ms": now,
            "last_success": success,
        });

        self.client
            .set::<_, _, ()>(&key, status.to_string())
            .await?;

        tracing::debug!("Updated provider status for {}", provider_id);
        Ok(())
    }
}
