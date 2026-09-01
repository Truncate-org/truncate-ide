// OAuth 2.0 Device Authorization Grant (RFC 8628) against self-hosted Zitadel.
// Hand-rolled on top of the crate's existing `reqwest` client rather than a new
// OAuth crate — this is just two JSON/form endpoints plus a poll loop.

use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

// TODO(zitadel-migration): replace with the real issuer + Native app client ID
// once Phase 0's console setup is complete (see docs/ZITADEL_MIGRATION.md).
const ZITADEL_ISSUER: &str = "https://auth.truncateide.app";
const ZITADEL_CLIENT_ID: &str = "REPLACE_WITH_ZITADEL_NATIVE_APP_CLIENT_ID";
const DEVICE_AUTH_SCOPE: &str = "openid profile email offline_access";

#[derive(Debug, Serialize)]
pub struct DeviceAuthResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub verification_uri_complete: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Deserialize)]
struct RawDeviceAuthResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    #[serde(default)]
    verification_uri_complete: Option<String>,
    expires_in: u64,
    #[serde(default = "default_interval")]
    interval: u64,
}

fn default_interval() -> u64 {
    5
}

#[derive(Debug, Serialize, Clone)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub id_token: Option<String>,
    pub expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct RawTokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    id_token: Option<String>,
    expires_in: Option<u64>,
    error: Option<String>,
    error_description: Option<String>,
}

#[tauri::command]
pub async fn start_device_login() -> Result<DeviceAuthResponse, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/oauth/v2/device_authorization", ZITADEL_ISSUER);

    let res = client
        .post(&url)
        .form(&[
            ("client_id", ZITADEL_CLIENT_ID),
            ("scope", DEVICE_AUTH_SCOPE),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to start device login: {}", e))?;

    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Device authorization failed: {}", body));
    }

    let raw: RawDeviceAuthResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse device authorization response: {}", e))?;

    let verification_uri_complete = raw
        .verification_uri_complete
        .unwrap_or_else(|| format!("{}?user_code={}", raw.verification_uri, raw.user_code));

    Ok(DeviceAuthResponse {
        device_code: raw.device_code,
        user_code: raw.user_code,
        verification_uri: raw.verification_uri,
        verification_uri_complete,
        expires_in: raw.expires_in,
        interval: raw.interval,
    })
}

#[tauri::command]
pub async fn poll_device_token(
    device_code: String,
    interval: u64,
    expires_in: u64,
) -> Result<TokenResponse, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/oauth/v2/token", ZITADEL_ISSUER);
    let mut wait_secs = interval.max(1);
    let deadline = Instant::now() + Duration::from_secs(expires_in);

    loop {
        if Instant::now() >= deadline {
            return Err("The login code expired. Please try again.".to_string());
        }

        tokio::time::sleep(Duration::from_secs(wait_secs)).await;

        let res = client
            .post(&url)
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("device_code", device_code.as_str()),
                ("client_id", ZITADEL_CLIENT_ID),
            ])
            .send()
            .await
            .map_err(|e| format!("Network error while polling: {}", e))?;

        let raw: RawTokenResponse = res
            .json()
            .await
            .map_err(|e| format!("Failed to parse token response: {}", e))?;

        if let Some(access_token) = raw.access_token {
            return Ok(TokenResponse {
                access_token,
                refresh_token: raw.refresh_token,
                id_token: raw.id_token,
                expires_in: raw.expires_in.unwrap_or(3600),
            });
        }

        match raw.error.as_deref() {
            Some("authorization_pending") => continue,
            Some("slow_down") => {
                wait_secs += 5;
                continue;
            }
            Some("access_denied") => return Err("Sign-in was denied.".to_string()),
            Some("expired_token") => {
                return Err("The login code expired. Please try again.".to_string())
            }
            Some(other) => {
                return Err(raw
                    .error_description
                    .unwrap_or_else(|| format!("Login failed: {}", other)))
            }
            None => return Err("Unexpected response from the login server.".to_string()),
        }
    }
}

#[tauri::command]
pub async fn refresh_device_token(refresh_token: String) -> Result<TokenResponse, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/oauth/v2/token", ZITADEL_ISSUER);

    let res = client
        .post(&url)
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token.as_str()),
            ("client_id", ZITADEL_CLIENT_ID),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error while refreshing token: {}", e))?;

    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Token refresh failed: {}", body));
    }

    let raw: RawTokenResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    let access_token = raw
        .access_token
        .ok_or_else(|| "Token refresh response missing access_token".to_string())?;

    Ok(TokenResponse {
        access_token,
        refresh_token: raw.refresh_token.or(Some(refresh_token)),
        id_token: raw.id_token,
        expires_in: raw.expires_in.unwrap_or(3600),
    })
}
