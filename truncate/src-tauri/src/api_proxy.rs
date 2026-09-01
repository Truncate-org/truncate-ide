use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct ProxyRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub data: Value,
}

#[tauri::command]
pub async fn api_proxy(mut request: ProxyRequest) -> Result<ProxyResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    // 1. Virtual Endpoint for /api/subscription/status
    if request.url.contains("/api/subscription/status") {
        let base_url = request.url.split("/api/").next().unwrap_or("");
        let dashboard_url = format!("{}/api/dashboard", base_url);
        let mut dash_builder = client.get(&dashboard_url);
        for (key, value) in &request.headers {
            dash_builder = dash_builder.header(key, value);
        }

        let expires_at = if let Ok(res) = dash_builder.send().await {
            if res.status().as_u16() == 200 {
                if let Ok(dash_data) = res.json::<Value>().await {
                    dash_data
                        .get("subscription")
                        .and_then(|s| s.get("expires_at").or(s.get("end_date")))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .or_else(|| {
                            dash_data
                                .get("data")
                                .and_then(|d| d.get("end_date"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                        })
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        let status = crate::subscription::get_subscription_status(expires_at).unwrap_or(
            crate::subscription::SubscriptionStatus {
                is_active: false,
                days_remaining: 0,
                status_message: "Syncing...".to_string(),
            },
        );

        return Ok(ProxyResponse {
            status: 200,
            data: serde_json::to_value(status).unwrap(),
        });
    }

    // 2. Endpoint Normalization
    // If the frontend calls /api/auth/verify, and we don't have a specific mock,
    // we map it to /api/dashboard as a "token validity probe".
    let target_url = if request.url.contains("/api/auth/verify") {
        request.url.replace("/api/auth/verify", "/api/dashboard")
    } else if request.url.contains("/api/auth/") {
        request.url.replace("/api/auth/", "/auth/")
    } else {
        request.url.clone()
    };

    // Mapping 'username' to 'email' field in body for backend compatibility
    if let Some(ref mut body) = request.body {
        if let Some(obj) = body.as_object_mut() {
            if obj.contains_key("username") && !obj.contains_key("email") {
                let username = obj["username"].clone();
                obj.insert("email".to_string(), username);
            }
        }
    }

    // 3. Perform Proxy Request
    let mut builder = match request.method.to_uppercase().as_str() {
        "GET" => client.get(&target_url),
        "POST" => client.post(&target_url),
        "DELETE" => client.delete(&target_url),
        "PUT" => client.put(&target_url),
        _ => return Err(format!("Unsupported method: {}", request.method)),
    };

    for (key, value) in &request.headers {
        builder = builder.header(key, value);
    }

    if let Some(body) = &request.body {
        builder = builder.json(&body);
    }

    let response_result = builder.send().await;

    match response_result {
        Ok(response) => {
            let status = response.status().as_u16();
            let data: Value = response.json().await.unwrap_or(Value::Null);

            Ok(ProxyResponse { status, data })
        }
        Err(e) => Err(format!("Network error: {}", e)),
    }
}
