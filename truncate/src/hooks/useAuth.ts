import { invoke } from "@tauri-apps/api/core";
import { api } from "../lib/api";
import { keychain } from "../lib/keychain";
import { useAuthStore } from "../store/authStore";
import { logger } from "../lib/logger";

export interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string | null;
  id_token?: string | null;
  expires_in: number;
}

export function useAuth() {
  const {
    clearAuth,
    setSubscription,
    setUser,
    setInitialLoading
  } = useAuthStore();

  /**
   * Startup verification logic
   */
  const verify = async () => {
    // Only show loading screen on first startup (when not yet authenticated).
    // If already authenticated, re-validate silently in the background
    // without unmounting the IDE tree (which breaks the terminal).
    const alreadyAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!alreadyAuthenticated) {
      setInitialLoading(true);
    }

    try {
      const token = await keychain.getToken();

      if (!token) {
        if (alreadyAuthenticated) {
          logger.warn("Verify: No token but already authenticated in memory. Keeping session.");
          return;
        }
        logger.log("No token found, clearing auth");
        clearAuth();
        return;
      }

      // Use /api/auth/verify (maps to /api/dashboard) to get full profile + license
      const res = await api.get<any>("/api/auth/verify", token.accessToken);
      logger.log("Session verification response:", res);

      if (res.success && res.data) {
        // 1. Extract Subscription Info
        const isValidLicense = res.data.valid !== undefined ? res.data.valid : res.data.is_valid;
        const subData = res.data.subscription || {};
        const expiry = res.data.expires_at || subData.expires_at || subData.expiry_date;

        let derivedStatus = "expired";
        if (isValidLicense === true) {
          derivedStatus = "active";
        } else if (isValidLicense === false) {
          derivedStatus = "expired";
        } else if (subData.status === "active" || subData.status === "trialing" || subData.status === "ongoing") {
          derivedStatus = "active";
        } else if (subData.credits_remaining !== undefined && subData.credits_remaining > 0) {
          derivedStatus = "active";
        } else if (!subData.status && res.success) {
          // If the backend doesn't explicitly tell us but the request succeeded, assume active
          derivedStatus = "active";
        }

        setSubscription({
          status: derivedStatus,
          plan: subData.plan || "pro",
          expires_at: expiry,
          credits_remaining: subData.credits_remaining ?? 500
        } as any);

        // 2. Extract and Persist User Profile
        const userData = res.data.user;
        if (userData) {
          setUser(userData);
          keychain.setUser(userData);
          useAuthStore.getState().setAuthenticated(true);
        } else {
          // Fallback: Restore user profile from local persistence if not in API response
          const persistedUser = keychain.getUser();
          if (persistedUser) {
            setUser(persistedUser);
            useAuthStore.getState().setAuthenticated(true);
          } else {
            logger.warn("Verify: License valid but user profile missing from server and local persistence.");
            // We are authenticated but have no profile info. 
            // In this case, we'll keep the session but it might look empty.
            useAuthStore.getState().setAuthenticated(true);
          }
        }
      } else {
        logger.warn("Verification failed: invalid response", res);
        await keychain.deleteToken();
        clearAuth();
      }
    } catch (error: any) {
      logger.error("Verification error:", error);
      if (error.status === 401 || error.status === 403) {
        await keychain.deleteToken();
        clearAuth();
      }
      // For other errors (network, etc.), keep current session alive
    } finally {
      setInitialLoading(false);
    }
  };

  /**
   * Starts an OAuth 2.0 Device Authorization Grant (RFC 8628) against
   * Zitadel — returns the code/URL for the caller (LoginScreen) to display
   * and open in the user's browser.
   */
  const startDeviceLogin = async () => {
    return await invoke<DeviceAuthResponse>("start_device_login");
  };

  /**
   * Polls Zitadel's token endpoint until the user completes login in the
   * browser, then exchanges the resulting Zitadel access token with the Go
   * backend (resolving/creating the internal User row and registering the
   * session) before persisting the token bundle.
   */
  const completeDeviceLogin = async (deviceCode: string, interval: number, expiresIn: number) => {
    const tokenRes = await invoke<TokenResponse>("poll_device_token", {
      deviceCode,
      interval,
      expiresIn,
    });

    const exchangeRes = await api.post<any>(
      "/auth/zitadel/exchange",
      { client: "ide" },
      tokenRes.access_token
    );
    logger.log("Zitadel session exchange response:", exchangeRes);

    if (!exchangeRes.success || !exchangeRes.data) {
      throw new Error(exchangeRes.message || "Sign-in failed");
    }

    await keychain.setToken({
      accessToken: tokenRes.access_token,
      refreshToken: tokenRes.refresh_token,
      expiresAt: Date.now() + tokenRes.expires_in * 1000,
    });

    const userData = exchangeRes.data.user;
    setUser(userData);
    keychain.setUser(userData);

    const sub = exchangeRes.data.subscription;
    setSubscription({
      status: sub?.is_active ? "active" : "expired",
      plan: "pro",
      credits_remaining: 500, // Not tracked by the Subscription model — same placeholder verify() already falls back to.
      expires_at: sub?.end_date ?? null,
    } as any);

    useAuthStore.getState().setAuthenticated(true);
  };

  const logout = async () => {
    logger.log("Logging out...");
    await keychain.deleteToken();
    clearAuth();
  };

  const refresh = async () => {
    const token = await keychain.getToken();
    if (!token?.refreshToken) return;

    try {
      const tokenRes = await invoke<TokenResponse>("refresh_device_token", {
        refreshToken: token.refreshToken,
      });
      logger.log("Refresh response:", tokenRes);
      await keychain.setToken({
        accessToken: tokenRes.access_token,
        refreshToken: tokenRes.refresh_token ?? token.refreshToken,
        expiresAt: Date.now() + tokenRes.expires_in * 1000,
      });
    } catch (error) {
      logger.error("Failed to refresh session:", error);
    }
  };

  return { verify, startDeviceLogin, completeDeviceLogin, logout, refresh };
}
