use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

pub struct CircuitBreaker {
    state: CircuitState,
    failure_count: u32,
    failure_threshold: u32,
    timeout: Duration,
    last_failure_time: Option<Instant>,
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, timeout: Duration) -> Self {
        Self {
            state: CircuitState::Closed,
            failure_count: 0,
            failure_threshold,
            timeout,
            last_failure_time: None,
        }
    }

    pub fn call<F, T, E>(&mut self, f: F) -> Result<T, CircuitBreakerError<E>>
    where
        F: FnOnce() -> Result<T, E>,
    {
        match self.state {
            CircuitState::Open => {
                if let Some(last_failure) = self.last_failure_time {
                    if last_failure.elapsed() >= self.timeout {
                        self.state = CircuitState::HalfOpen;
                    } else {
                        return Err(CircuitBreakerError::CircuitOpen);
                    }
                }
            }
            _ => {}
        }

        match f() {
            Ok(result) => {
                self.on_success();
                Ok(result)
            }
            Err(e) => {
                self.on_failure();
                Err(CircuitBreakerError::CallFailed(e))
            }
        }
    }

    fn on_success(&mut self) {
        self.failure_count = 0;
        self.state = CircuitState::Closed;
    }

    fn on_failure(&mut self) {
        self.failure_count += 1;
        self.last_failure_time = Some(Instant::now());

        if self.failure_count >= self.failure_threshold {
            self.state = CircuitState::Open;
        }
    }

    pub fn state(&self) -> CircuitState {
        self.state
    }

    pub fn failure_count(&self) -> u32 {
        self.failure_count
    }

    pub fn reset(&mut self) {
        self.state = CircuitState::Closed;
        self.failure_count = 0;
        self.last_failure_time = None;
    }
}

#[derive(Debug)]
pub enum CircuitBreakerError<E> {
    CircuitOpen,
    CallFailed(E),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_breaker_opens_after_failures() {
        let mut cb = CircuitBreaker::new(3, Duration::from_secs(10));

        // Simulate failures
        for _ in 0..3 {
            let _ = cb.call(|| Err::<(), _>("error"));
        }

        assert_eq!(cb.state(), CircuitState::Open);
    }

    #[test]
    fn test_circuit_breaker_resets_on_success() {
        let mut cb = CircuitBreaker::new(3, Duration::from_secs(10));

        let _ = cb.call(|| Err::<(), _>("error"));
        let _ = cb.call(|| Ok::<_, String>(()));

        assert_eq!(cb.state(), CircuitState::Closed);
        assert_eq!(cb.failure_count(), 0);
    }

    #[test]
    fn test_circuit_breaker_stays_closed() {
        let mut cb = CircuitBreaker::new(3, Duration::from_secs(10));

        for _ in 0..10 {
            let _ = cb.call(|| Ok::<_, String>(()));
        }

        assert_eq!(cb.state(), CircuitState::Closed);
    }
}
