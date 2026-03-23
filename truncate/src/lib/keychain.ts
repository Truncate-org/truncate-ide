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
      await invoke("set_keychain_token", { token });
      localStorage.removeItem("truncate_fallback_token"); // Cleanup fallback if successful
    } catch (error) {
      console.warn("Failed to set keychain token, using fallback storage:", error);
      localStorage.setItem("truncate_fallback_token", token);
    }
  },

  /**
   * Retrieves the auth token.
   */
  async getToken(): Promise<string | null> {
    try {
      const token = await invoke<string | null>("get_keychain_token");
      if (token) return token;
    } catch (error) {
      console.warn("Failed to get keychain token, checking fallback:", error);
    }
    return localStorage.getItem("truncate_fallback_token");
  },

  /**
   * Deletes the auth token from the OS Keychain.
   */
  async deleteToken(): Promise<void> {
    try {
      localStorage.removeItem("truncate_fallback_token");
      await invoke("delete_keychain_token");
    } catch (error) {
      console.error("Failed to delete keychain token:", error);
    }
  },
};
