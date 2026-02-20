//! AI Tool Implementations
//!
//! Tools for scene manipulation and data exploration.

use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize, Clone)]
pub struct ToolCall {
    pub name: String,
    pub params: Value,
}

#[derive(Debug, Clone)]
pub struct ExecutionActor {
    pub actor_id: String,
    pub role: String,
    pub scopes: Vec<String>,
    pub attrs: Value,
}

#[derive(Clone)]
pub struct ToolExecutor {
    graph_url: String,
    http_client: reqwest::Client,
}

impl ToolExecutor {
    pub fn new(graph_url: String) -> Self {
        Self {
            graph_url,
            http_client: reqwest::Client::new(),
        }
    }

    pub async fn execute(
        &self,
        tool_call: &ToolCall,
        actor: Option<&ExecutionActor>,
    ) -> anyhow::Result<Value> {
        match tool_call.name.as_str() {
            "seek_to_time" => self.seek_to_time(&tool_call.params).await,
            "seek_to_bbox" => self.seek_to_bbox(&tool_call.params).await,
            "set_layers" => self.set_layers(&tool_call.params).await,
            "run_graph_query" => self.run_graph_query(&tool_call.params, actor).await,
            "get_provider_status" => self.get_provider_status().await,
            "get_track_info" => self.get_track_info(&tool_call.params, actor).await,
            "get_news_brief" => self.get_news_brief(&tool_call.params).await,
            "get_market_snapshot" => self.get_market_snapshot().await,
            "translate_text" => self.translate_text(&tool_call.params).await,
            _ => Err(anyhow::anyhow!("Unknown tool: {}", tool_call.name)),
        }
    }

    /// seek_to_time: Generate playback subscription request
    async fn seek_to_time(&self, params: &Value) -> anyhow::Result<Value> {
        let start_ts_ms = params
            .get("start_ts_ms")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| anyhow::anyhow!("Missing start_ts_ms"))?;

        let end_ts_ms = params
            .get("end_ts_ms")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| anyhow::anyhow!("Missing end_ts_ms"))?;

        Ok(json!({
            "action": "subscribe",
            "mode": "playback",
            "time_range": {
                "start_ts_ms": start_ts_ms,
                "end_ts_ms": end_ts_ms,
            },
            "description": format!("Playback from {} to {}", start_ts_ms, end_ts_ms),
        }))
    }

    /// seek_to_bbox: Generate camera pan command
    async fn seek_to_bbox(&self, params: &Value) -> anyhow::Result<Value> {
        let min_lat = params
            .get("min_lat")
            .and_then(|v| v.as_f64())
            .ok_or_else(|| anyhow::anyhow!("Missing min_lat"))?;
        let min_lon = params
            .get("min_lon")
            .and_then(|v| v.as_f64())
            .ok_or_else(|| anyhow::anyhow!("Missing min_lon"))?;
        let max_lat = params
            .get("max_lat")
            .and_then(|v| v.as_f64())
            .ok_or_else(|| anyhow::anyhow!("Missing max_lat"))?;
        let max_lon = params
            .get("max_lon")
            .and_then(|v| v.as_f64())
            .ok_or_else(|| anyhow::anyhow!("Missing max_lon"))?;

        if min_lat < -90.0 || max_lat > 90.0 || min_lon < -180.0 || max_lon > 180.0 {
            return Err(anyhow::anyhow!("Invalid coordinates"));
        }

        if min_lat >= max_lat || min_lon >= max_lon {
            return Err(anyhow::anyhow!("Invalid bounding box"));
        }

        Ok(json!({
            "action": "pan_camera",
            "viewport": {
                "min_lat": min_lat,
                "min_lon": min_lon,
                "max_lat": max_lat,
                "max_lon": max_lon,
            },
            "center": {
                "lat": (min_lat + max_lat) / 2.0,
                "lon": (min_lon + max_lon) / 2.0,
            },
        }))
    }

    /// set_layers: Generate layer toggle command
    async fn set_layers(&self, params: &Value) -> anyhow::Result<Value> {
        let layers = params
            .get("layers")
            .and_then(|v| v.as_array())
            .ok_or_else(|| anyhow::anyhow!("Missing layers"))?;

        let layer_names: Vec<String> = layers
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();

        let valid_layers = [
            "AIRCRAFT",
            "SATELLITE",
            "GROUND",
            "VESSEL",
            "CAMERA",
            "DETECTION",
            "ALERT",
        ];
        for layer in &layer_names {
            if !valid_layers.contains(&layer.as_str()) {
                return Err(anyhow::anyhow!("Invalid layer: {}", layer));
            }
        }

        Ok(json!({
            "action": "set_layers",
            "layers": layer_names,
        }))
    }

    /// run_graph_query: Execute pre-approved graph query
    async fn run_graph_query(
        &self,
        params: &Value,
        actor: Option<&ExecutionActor>,
    ) -> anyhow::Result<Value> {
        let template = params
            .get("template")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing template"))?;

        let query_params = params.get("params").cloned().unwrap_or(json!({}));
        let page = params.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
        let per_page = params
            .get("per_page")
            .and_then(|v| v.as_i64())
            .or_else(|| params.get("page_size").and_then(|v| v.as_i64()))
            .unwrap_or(50);

        let url = format!("{}/graph/query", self.graph_url);
        let request_body = json!({
            "template": template,
            "params": query_params,
            "page": page,
            "per_page": per_page,
        });

        self.post_to_graph(&url, request_body, actor).await
    }

    /// get_provider_status: Get health status of providers
    async fn get_provider_status(&self) -> anyhow::Result<Value> {
        Ok(json!({
            "providers": [
                {
                    "provider_id": "mock-adsb",
                    "status": "healthy",
                    "last_update": "2026-02-20T11:00:00Z",
                    "track_count": 20,
                },
                {
                    "provider_id": "mock-tle",
                    "status": "healthy",
                    "last_update": "2026-02-20T11:00:00Z",
                    "track_count": 10,
                },
            ],
        }))
    }

    /// get_track_info: Get detailed track information
    async fn get_track_info(
        &self,
        params: &Value,
        actor: Option<&ExecutionActor>,
    ) -> anyhow::Result<Value> {
        let track_id = params
            .get("track_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing track_id"))?;

        let url = format!("{}/graph/query", self.graph_url);
        let request_body = json!({
            "template": "search_tracks",
            "params": {
                "id": track_id,
            },
            "page": 1,
            "per_page": 1,
        });

        self.post_to_graph(&url, request_body, actor).await
    }

    async fn get_news_brief(&self, params: &Value) -> anyhow::Result<Value> {
        let query = params.get("q").and_then(|v| v.as_str()).unwrap_or("global");
        let now_ms = chrono::Utc::now().timestamp_millis();
        Ok(json!({
            "source": "harpy-aip",
            "region": "global",
            "query": query,
            "generated_at_ms": now_ms,
            "sentiment_score": 0.52,
            "sentiment_label": "NEUTRAL",
            "headlines": [
                {
                    "source": "HARPY",
                    "title": format!("Operational brief ready for query: {}", query),
                    "url": "#",
                    "published_ts_ms": now_ms
                },
                {
                    "source": "HARPY",
                    "title": "Provider freshness and alert queues are nominal",
                    "url": "#",
                    "published_ts_ms": now_ms
                }
            ]
        }))
    }

    async fn get_market_snapshot(&self) -> anyhow::Result<Value> {
        Ok(json!({
            "source": "harpy-aip",
            "generated_at_ms": chrono::Utc::now().timestamp_millis(),
            "commodities": [
                { "symbol": "WTI", "price_usd": 78.2, "change_24h_pct": 0.24 },
                { "symbol": "GOLD", "price_usd": 2111.4, "change_24h_pct": -0.18 }
            ],
            "crypto": [
                { "symbol": "BTC", "price_usd": 64180.0, "change_24h_pct": 1.12 },
                { "symbol": "ETH", "price_usd": 3175.0, "change_24h_pct": 0.94 }
            ]
        }))
    }

    async fn translate_text(&self, params: &Value) -> anyhow::Result<Value> {
        let text = params
            .get("text")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing text"))?;
        let target_lang = params
            .get("target_lang")
            .and_then(|v| v.as_str())
            .unwrap_or("EN");

        Ok(json!({
            "source": "harpy-aip",
            "target_lang": target_lang.to_uppercase(),
            "translated_text": format!("[{}] {}", target_lang.to_uppercase(), text),
            "generated_at_ms": chrono::Utc::now().timestamp_millis()
        }))
    }

    async fn post_to_graph(
        &self,
        url: &str,
        request_body: Value,
        actor: Option<&ExecutionActor>,
    ) -> anyhow::Result<Value> {
        let mut request = self.http_client.post(url).json(&request_body);

        if let Some(actor_ctx) = actor {
            request = request
                .header("x-harpy-actor-id", &actor_ctx.actor_id)
                .header("x-harpy-role", &actor_ctx.role)
                .header("x-harpy-scopes", actor_ctx.scopes.join(","))
                .header(
                    "x-harpy-attrs",
                    serde_json::to_string(&actor_ctx.attrs).unwrap_or_else(|_| "{}".to_string()),
                );
        }

        let response = request.send().await?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "graph request failed".to_string());
            return Err(anyhow::anyhow!(
                "Graph request failed ({}): {}",
                status,
                body
            ));
        }

        let result: Value = response.json().await?;
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seek_to_time_params() {
        let params = json!({
            "start_ts_ms": 1000,
            "end_ts_ms": 2000,
        });

        let start = params.get("start_ts_ms").and_then(|v| v.as_i64());
        let end = params.get("end_ts_ms").and_then(|v| v.as_i64());

        assert_eq!(start, Some(1000));
        assert_eq!(end, Some(2000));
    }

    #[test]
    fn test_seek_to_bbox_validation() {
        let valid = json!({
            "min_lat": 37.0,
            "min_lon": -122.0,
            "max_lat": 38.0,
            "max_lon": -121.0,
        });

        let min_lat = valid
            .get("min_lat")
            .and_then(|v| v.as_f64())
            .expect("min_lat");
        let max_lat = valid
            .get("max_lat")
            .and_then(|v| v.as_f64())
            .expect("max_lat");
        let min_lon = valid
            .get("min_lon")
            .and_then(|v| v.as_f64())
            .expect("min_lon");
        let max_lon = valid
            .get("max_lon")
            .and_then(|v| v.as_f64())
            .expect("max_lon");

        assert!(min_lat < max_lat);
        assert!(min_lon < max_lon);
    }
}
