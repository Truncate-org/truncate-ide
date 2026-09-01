import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";
import { User } from "../store/authStore";

/**
 * Secure OS Keychain operations via Rust backend.
 * Uses the 'keyring' crate on the native side.
 */
export interface TokenBundle {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: number; // epoch ms
}

export const keychain = {
  /**
   * Stores the Zitadel token bundle. Attempts OS Keychain first, then local
   * storage. `set_keychain_token`/`get_keychain_token` on the Rust side are
   * format-agnostic (they just persist whatever string they're given), so
   * the bundle is JSON-encoded into that same single-string slot rather than
   * needing a second keyring entry.
   */
  async setToken(bundle: TokenBundle): Promise<void> {
    const serialized = JSON.stringify(bundle);
    try {
      // 1. Try OS Keychain (Primary)
      await invoke("set_keychain_token", { token: serialized });
      logger.log("Token saved to OS Keychain");
      // Keychain succeeded: clear any stale localStorage copy so the token
      // isn't left readable outside the OS-protected store.
      localStorage.removeItem("truncate_ide_token");
    } catch (error) {
      logger.warn("OS Keychain unavailable, using fallback.", error);
      // 2. Fall back to localStorage only when the keychain write failed
      localStorage.setItem("truncate_ide_token", serialized);
    }
  },

  getToken: async (): Promise<TokenBundle | null> => {
    let raw: string | null = null;

    try {
      // 1. Try OS Keychain first
      raw = await invoke<string>("get_keychain_token");
    } catch (err) {
      logger.warn("Keychain retrieval failed, trying fallback:", err);
    }

    if (!raw) {
      // 2. Fallback to localStorage
      raw = localStorage.getItem("truncate_ide_token");
    }

    if (!raw) return null;

    try {
      return JSON.parse(raw) as TokenBundle;
    } catch {
      // Pre-migration value: a bare token string from the old username/secret-key
      // flow. Treat it as an access token with no known refresh/expiry so
      // verify() can still use it once; re-auth takes over once it's rejected.
      return { accessToken: raw, expiresAt: 0 };
    }
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
