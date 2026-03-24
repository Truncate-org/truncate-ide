import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";

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
      // 1. Try OS Keychain (Mandatory for high-stakes sectors)
      await invoke("set_keychain_token", { token });
      logger.log("Token saved to OS Keychain");
    } catch (error) {
      logger.error("Critical Security Error: OS Keychain unavailable.", error);
      throw new Error("Failed to secure auth token. Please ensure your OS Keychain is accessible.");
    }
  },

  getToken: async () => {
    try {
      // 1. Try OS Keychain first
      return await invoke<string>("get_keychain_token");
    } catch (err) {
      logger.error("Keychain retrieval failed:", err);
      return null;
    }
  },

  deleteToken: async () => {
    try {
      await invoke("delete_keychain_token");
    } catch (err) {
      logger.warn("Failed to delete keychain token:", err);
    }
  },
};
