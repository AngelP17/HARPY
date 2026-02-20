use std::env;

pub fn get_env_var(key: &str) -> Option<String> {
    env::var(key).ok()
}

pub fn get_env_var_or_default(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

pub fn get_env_var_or_error(key: &str) -> Result<String, String> {
    env::var(key).map_err(|_| format!("Missing required environment variable: {}", key))
}
