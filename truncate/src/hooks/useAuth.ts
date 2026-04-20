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

      // Use /api/auth/verify (maps to /api/dashboard) to get full profile + license
      const res = await api.get<any>("/api/auth/verify", token);
      logger.log("Session verification response:", res);

      if (res.success && res.data) {
        // 1. Extract Subscription Info
        const isValidLicense = res.data.valid !== undefined ? res.data.valid : res.data.is_valid;
        const subData = res.data.subscription || {};
        const expiry = res.data.expires_at || subData.expires_at || subData.expiry_date;

        setSubscription({
          status: isValidLicense ? "active" : "expired",
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

  const login = async (username: string, secret_key: string) => {
    // Aligned with POST /auth/ide/login
    const res = await api.post<any>("/auth/ide/login", { username, secret_key });
    logger.log("IDE Login successful:", res);

    if (res.success && res.data) {
      const { token, email, username: resUsername, expires_at } = res.data;
      if (token) {
        await keychain.setToken(token);
      }

      const userData = {
        id: resUsername, // Use username as ID if not provided
        username: resUsername,
        email: email,
        display_name: resUsername
      };

      setUser(userData);
      keychain.setUser(userData);

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
