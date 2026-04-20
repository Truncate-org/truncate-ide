import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";
import { User } from "../store/authStore";

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
      // 1. Try OS Keychain (Primary)
      await invoke("set_keychain_token", { token });
      logger.log("Token saved to OS Keychain");
    } catch (error) {
      logger.warn("OS Keychain unavailable, using fallback.", error);
    } finally {
      // 2. Always set localStorage as fallback
      localStorage.setItem("truncate_ide_token", token);
    }
  },

  getToken: async () => {
    try {
      // 1. Try OS Keychain first
      const token = await invoke<string>("get_keychain_token");
      if (token) return token;
    } catch (err) {
      logger.warn("Keychain retrieval failed, trying fallback:", err);
    }
    
    // 2. Fallback to localStorage
    return localStorage.getItem("truncate_ide_token");
  },

  deleteToken: async () => {
    localStorage.removeItem("truncate_ide_token");
    localStorage.removeItem("truncate_ide_user");
    try {
      await invoke("delete_keychain_token");
    } catch (err) {
      logger.warn("Failed to delete keychain token:", err);
    }
  },

  setUser(user: User): void {
    try {
      localStorage.setItem("truncate_ide_user", JSON.stringify(user));
    } catch (e) {
      logger.error("Failed to save user to localStorage", e);
    }
  },

  getUser(): User | null {
    try {
      const data = localStorage.getItem("truncate_ide_user");
      return data ? JSON.parse(data) : null;
    } catch (e) {
      logger.error("Failed to parse user from localStorage", e);
      return null;
    }
  },
};
