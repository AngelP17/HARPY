// Reuse provider implementations from harpy-ingest so local-node behavior
// stays aligned with existing adapters while remaining single-process.
#[path = "../../../harpy-ingest/src/adapters/adsb_mock.rs"]
pub mod adsb_mock;
#[path = "../../../harpy-ingest/src/adapters/adsb_opensky.rs"]
pub mod adsb_opensky;
#[path = "../../../harpy-ingest/src/adapters/tle_celestrak.rs"]
pub mod tle_celestrak;
#[path = "../../../harpy-ingest/src/adapters/tle_mock.rs"]
pub mod tle_mock;

use async_trait::async_trait;
use harpy_proto::harpy::v1::TrackDelta;

#[async_trait]
pub trait Provider: Send + Sync {
    async fn fetch(&self) -> anyhow::Result<Vec<TrackDelta>>;
    fn provider_id(&self) -> &str;
}
