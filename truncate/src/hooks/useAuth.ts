import { api } from "../lib/api";
import { keychain } from "../lib/keychain";
import { useAuthStore } from "../store/authStore";
import { logger } from "../lib/logger";

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

      // Aligned with GET /api/license/validate
      const res = await api.get<any>("/api/license/validate", token);
      logger.log("License validation response:", res);

      if (res.success && res.data) {
        // Backend returns is_valid and expiry_date
        const isValidLicense = res.data.valid !== undefined ? res.data.valid : res.data.is_valid;
        const expiry = res.data.expires_at || res.data.expiry_date;

        if (!isValidLicense) {
          logger.warn("License no longer valid", res.data);
          setSubscription({ status: "expired", plan: "pro", expires_at: expiry } as any);
        } else {
          setSubscription({ status: "active", plan: "pro", expires_at: expiry } as any);
          useAuthStore.getState().setAuthenticated(true);
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

  const login = async (username: string, secret_key: string) => {
    // Aligned with POST /auth/ide/login
    const res = await api.post<any>("/auth/ide/login", { username, secret_key });
    logger.log("IDE Login successful:", res);

    if (res.success && res.data) {
      const { token, email, username: resUsername, expires_at } = res.data;
      if (token) {
        await keychain.setToken(token);
      }

      setUser({
        id: resUsername, // Use username as ID if not provided
        username: resUsername,
        email: email,
        display_name: resUsername
      });

      setSubscription({
        status: "active",
        plan: "pro",
        credits_remaining: 500, // Mocked for now as not in API
        expires_at: expires_at
      } as any);
    }
  };

  const logout = async () => {
    logger.log("Logging out...");
    await keychain.deleteToken();
    clearAuth();
  };

  const refresh = async () => {
    const token = await keychain.getToken();
    if (!token) return;

    try {
      // Aligned with GET /api/ide/access
      const res = await api.get<any>("/api/ide/access", token);
      logger.log("Refresh response:", res);
      if (res.success && res.data && res.data.token) {
        await keychain.setToken(res.data.token);
        // After refresh, we might want to re-validate license
        // or just update local state if the response included user data
      }
    } catch (error) {
      logger.error("Failed to refresh session:", error);
    }
  };

  return { verify, login, logout, refresh };
}
