pub mod adsb_mock;
pub mod adsb_opensky;
pub mod radar_nexrad;
pub mod seismic_usgs;
pub mod tle_celestrak;
pub mod tle_mock;
pub mod weather_nws;

use async_trait::async_trait;
use harpy_proto::harpy::v1::TrackDelta;

#[async_trait]
pub trait Provider: Send + Sync {
    async fn fetch(&self) -> anyhow::Result<Vec<TrackDelta>>;
    fn provider_id(&self) -> &str;
}
