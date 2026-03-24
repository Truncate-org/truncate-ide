use keyring::Entry;

#[tauri::command]
pub async fn set_keychain_token(token: String) -> Result<(), String> {
    let entry =
        Entry::new("app.truncateide.account", "truncate_auth_token").map_err(|e| e.to_string())?;
    entry.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_keychain_token() -> Result<Option<String>, String> {
    let entry =
        Entry::new("app.truncateide.account", "truncate_auth_token").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn delete_keychain_token() -> Result<(), String> {
    let entry =
        Entry::new("app.truncateide.account", "truncate_auth_token").map_err(|e| e.to_string())?;

    // Some OSs return NoEntry if deleting non-existent key, which is fine for us
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
