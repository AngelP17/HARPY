use futures::{SinkExt, StreamExt};
use harpy_proto::harpy::v1::envelope::Payload;
use harpy_proto::harpy::v1::{
    time_range, BoundingBox, Envelope, LayerType, LiveMode, SubscriptionMode, SubscriptionRequest,
    TimeRange,
};
use prost::Message;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::process::Command;
use tokio::time::{sleep, timeout};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message as WsMessage;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

fn default_subscription() -> Envelope {
    Envelope {
        schema_version: "1.0.0".to_string(),
        server_ts_ms: 0,
        payload: Some(Payload::SubscriptionRequest(SubscriptionRequest {
            viewport: Some(BoundingBox {
                min_lat: -90.0,
                min_lon: -180.0,
                max_lat: 90.0,
                max_lon: 180.0,
            }),
            layers: vec![LayerType::Aircraft as i32, LayerType::Satellite as i32],
            time_range: Some(TimeRange {
                range: Some(time_range::Range::Live(LiveMode {})),
            }),
            mode: SubscriptionMode::Live as i32,
        })),
    }
}

async fn wait_for_health(port: u16) -> anyhow::Result<()> {
    let addr = format!("127.0.0.1:{port}");
    let started = Instant::now();
    while started.elapsed() < Duration::from_secs(10) {
        if TcpStream::connect(&addr).await.is_ok() {
            return Ok(());
        }
        sleep(Duration::from_millis(100)).await;
    }
    anyhow::bail!("timed out waiting for node listener on {}", addr);
}

async fn recv_envelope(
    read: &mut futures::stream::SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>,
) -> anyhow::Result<Envelope> {
    let msg = timeout(Duration::from_secs(3), read.next())
        .await
        .map_err(|_| anyhow::anyhow!("timeout waiting for ws message"))?
        .ok_or_else(|| anyhow::anyhow!("ws stream ended"))??;

    let WsMessage::Binary(bytes) = msg else {
        anyhow::bail!("expected binary protobuf message, got {:?}", msg);
    };

    let envelope = Envelope::decode(bytes.as_slice())?;
    Ok(envelope)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn ws_contract_emits_subscription_ack_tracks_and_provider_status() -> anyhow::Result<()> {
    let port = 18080u16;
    let binary = std::env::var("CARGO_BIN_EXE_harpy-node")
        .unwrap_or_else(|_| "../../target/debug/harpy-node".to_string());
    let mut child = Command::new(binary)
        .env("NODE_PORT", port.to_string())
        .env("ENABLE_REAL_ADSB", "false")
        .env("ENABLE_REAL_TLE", "false")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .expect("failed to spawn harpy-node");

    wait_for_health(port).await?;

    let ws_url = format!("ws://127.0.0.1:{port}/ws");
    let (ws, _resp) = timeout(Duration::from_secs(3), connect_async(ws_url)).await??;
    let (mut write, mut read) = ws.split();

    let sub = default_subscription();
    write.send(WsMessage::Binary(sub.encode_to_vec())).await?;

    let mut saw_ack = false;
    let mut saw_tracks = false;
    let mut saw_provider_status = false;
    for _ in 0..40 {
        let envelope = recv_envelope(&mut read).await?;
        match envelope.payload {
            Some(Payload::SubscriptionAck(ack)) if ack.success => saw_ack = true,
            Some(Payload::TrackDeltaBatch(batch)) if !batch.deltas.is_empty() => saw_tracks = true,
            Some(Payload::ProviderStatus(_)) => saw_provider_status = true,
            _ => {}
        }

        if saw_ack && saw_tracks && saw_provider_status {
            break;
        }
    }

    let _ = child.kill().await;

    assert!(saw_ack, "did not observe successful subscription ack");
    assert!(saw_tracks, "did not observe non-empty track batch");
    assert!(saw_provider_status, "did not observe provider status");
    Ok(())
}
