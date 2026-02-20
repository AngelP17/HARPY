//! Redis Publisher for Fusion Alerts
//!
//! Publishes AlertUpsert and LinkUpsert messages to Redis channels
//! for relay fanout to WebSocket clients.

use crate::{AlertUpsertRecord, LinkUpsertRecord};
use redis::AsyncCommands;
use serde_json::json;

#[derive(Clone)]
pub struct RedisPublisher {
    client: redis::aio::ConnectionManager,
}

impl RedisPublisher {
    pub async fn new(redis_url: &str) -> anyhow::Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let connection = redis::aio::ConnectionManager::new(client).await?;
        Ok(Self { client: connection })
    }

    /// Publish an alert to Redis pub/sub channel
    pub async fn publish_alert(&self, alert: &AlertUpsertRecord) -> anyhow::Result<()> {
        let channel = "alerts:updates";
        
        let payload = json!({
            "id": alert.id,
            "severity": alert.severity,
            "title": alert.title,
            "description": alert.description,
            "ts_ms": alert.ts_ms,
            "status": alert.status,
            "evidence_link_ids": alert.evidence_link_ids,
            "meta": alert.meta,
        });

        let mut client = self.client.clone();
        client.publish::<_, _, ()>(channel, payload.to_string()).await?;
        
        tracing::debug!(
            alert_id = %alert.id,
            severity = %alert.severity,
            "Published alert to Redis"
        );
        
        Ok(())
    }

    /// Publish a link to Redis pub/sub channel
    pub async fn publish_link(&self, link: &LinkUpsertRecord) -> anyhow::Result<()> {
        let channel = "links:updates";
        
        let payload = json!({
            "id": link.id,
            "from_type": link.from_type,
            "from_id": link.from_id,
            "rel": link.rel,
            "to_type": link.to_type,
            "to_id": link.to_id,
            "ts_ms": link.ts_ms,
            "meta": link.meta,
        });

        let mut client = self.client.clone();
        client.publish::<_, _, ()>(channel, payload.to_string()).await?;
        
        tracing::debug!(
            link_id = %link.id,
            rel = %link.rel,
            "Published link to Redis"
        );
        
        Ok(())
    }

    /// Store provider status in Redis (for health monitoring)
    pub async fn update_provider_status(
        &self,
        provider_id: &str,
        circuit_state: &str,
        freshness: &str,
        success: bool,
    ) -> anyhow::Result<()> {
        let key = format!("provider:status:{}", provider_id);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis() as u64;

        let status = json!({
            "provider_id": provider_id,
            "circuit_state": circuit_state,
            "freshness": freshness,
            "last_update_ts_ms": now,
            "last_success": success,
        });

        let mut client = self.client.clone();
        client.set::<_, _, ()>(key, status.to_string()).await?;
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Note: These tests require a running Redis instance
    // Run with: cargo test --features integration_tests
    
    fn create_test_alert() -> AlertUpsertRecord {
        AlertUpsertRecord {
            id: "test-alert-001".to_string(),
            severity: "MEDIUM".to_string(),
            title: "Test Alert".to_string(),
            description: "Test description".to_string(),
            ts_ms: 1000,
            status: "ACTIVE".to_string(),
            evidence_link_ids: vec!["link-001".to_string()],
            meta: json!({"test": true}),
        }
    }

    fn create_test_link() -> LinkUpsertRecord {
        LinkUpsertRecord {
            id: "test-link-001".to_string(),
            from_type: "Track".to_string(),
            from_id: "track-001".to_string(),
            rel: "associated_with".to_string(),
            to_type: "Track".to_string(),
            to_id: "track-002".to_string(),
            ts_ms: 1000,
            meta: json!({"test": true}),
        }
    }

    #[tokio::test]
    #[ignore = "Requires Redis"]
    async fn test_publish_alert() {
        let publisher = RedisPublisher::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");
        
        let alert = create_test_alert();
        publisher.publish_alert(&alert).await.expect("Failed to publish alert");
    }

    #[tokio::test]
    #[ignore = "Requires Redis"]
    async fn test_publish_link() {
        let publisher = RedisPublisher::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");
        
        let link = create_test_link();
        publisher.publish_link(&link).await.expect("Failed to publish link");
    }
}
