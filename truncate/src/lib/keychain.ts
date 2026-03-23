import { invoke } from "@tauri-apps/api/core";

/**
 * Secure OS Keychain operations via Rust backend.
 * Uses the 'keyring' crate on the native side.
 */
export const keychain = {
  /**
   * Stores the auth token in the OS Keychain.
   */
  /**
   * Stores the auth token. Attempts OS Keychain first, then local storage.
   */
  async setToken(token: string): Promise<void> {
    try {
      // 1. Try OS Keychain first
      await invoke("set_keychain_token", { token });
      console.log("Token saved to OS Keychain");
      localStorage.removeItem("truncate_auth_token"); // Cleanup fallback
    } catch (error) {
      console.warn("Failed to set keychain token, using fallback storage:", error);
      localStorage.setItem("truncate_auth_token", token);
    }
  },

  getToken: async () => {
    try {
      // 1. Try OS Keychain first
      const osToken = await invoke<string>("get_keychain_token");
      if (osToken) return osToken;
    } catch (err) {
      console.warn("Keychain retrieval failed, trying fallback:", err);
    }

    // 2. Fall back to localStorage
    const fallbackToken = localStorage.getItem("truncate_auth_token");
    console.log("Fallback token check:", !!fallbackToken);
    return fallbackToken;
  },

  deleteToken: async () => {
    try {
      await invoke("delete_keychain_token");
    } catch (err) {
      console.warn("Failed to delete keychain token:", err);
    }
    localStorage.removeItem("truncate_auth_token");
  },
};
