use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Freshness {
    Fresh,
    Aging,
    Stale,
    Critical,
}

impl Freshness {
    pub fn from_age(age: Duration) -> Self {
        if age < Duration::from_secs(60) {
            Freshness::Fresh
        } else if age < Duration::from_secs(300) {
            Freshness::Aging
        } else if age < Duration::from_secs(600) {
            Freshness::Stale
        } else {
            Freshness::Critical
        }
    }

    pub fn from_last_update(last_update: Instant) -> Self {
        Self::from_age(last_update.elapsed())
    }

    pub fn is_fresh(&self) -> bool {
        matches!(self, Freshness::Fresh)
    }

    pub fn is_stale_or_worse(&self) -> bool {
        matches!(self, Freshness::Stale | Freshness::Critical)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_freshness_levels() {
        assert_eq!(
            Freshness::from_age(Duration::from_secs(30)),
            Freshness::Fresh
        );
        assert_eq!(
            Freshness::from_age(Duration::from_secs(120)),
            Freshness::Aging
        );
        assert_eq!(
            Freshness::from_age(Duration::from_secs(400)),
            Freshness::Stale
        );
        assert_eq!(
            Freshness::from_age(Duration::from_secs(700)),
            Freshness::Critical
        );
    }

    #[test]
    fn test_freshness_checks() {
        assert!(Freshness::Fresh.is_fresh());
        assert!(!Freshness::Aging.is_fresh());
        assert!(Freshness::Stale.is_stale_or_worse());
        assert!(Freshness::Critical.is_stale_or_worse());
    }
}
