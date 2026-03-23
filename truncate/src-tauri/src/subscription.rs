use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SubscriptionStatus {
    pub is_active: bool,
    pub days_remaining: i64,
    pub status_message: String,
}

#[tauri::command]
pub fn get_subscription_status(expires_at: Option<String>) -> Result<SubscriptionStatus, String> {
    let now = Utc::now();
    
    let expiry = match expires_at {
        Some(date_str) => {
            // Try different ISO formats if needed, rfc3339 is standard for JSON strings
            DateTime::parse_from_rfc3339(&date_str)
                .map(|dt| dt.with_timezone(&Utc))
                .or_else(|_| {
                    // Fallback for simple date strings like "2026-12-31" 
                    // (though our mock uses rfc3339)
                    DateTime::parse_from_str(&(date_str + "T23:59:59Z"), "%Y-%m-%dT%H:%M:%S%#z")
                        .map(|dt| dt.with_timezone(&Utc))
                })
                .map_err(|e| format!("Invalid date format: {}. Expected ISO-8601.", e))?
        },
        None => return Ok(SubscriptionStatus {
            is_active: false,
            days_remaining: 0,
            status_message: "No active subscription found".to_string(),
        }),
    };

    let duration = expiry.signed_duration_since(now);
    let days = duration.num_days();

    if days < 0 {
        Ok(SubscriptionStatus {
            is_active: false,
            days_remaining: 0,
            status_message: "Subscription expired".to_string(),
        })
    } else {
        Ok(SubscriptionStatus {
            is_active: true,
            days_remaining: days,
            status_message: format!("Active — {} days remaining", days),
        })
    }
}
