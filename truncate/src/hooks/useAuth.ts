import { api } from "../lib/api";
import { keychain } from "../lib/keychain";
import { useAuthStore, User, Subscription } from "../store/authStore";

export function useAuth() {
  const {
    setAuth,
    clearAuth,
    setSubscription,
    setUser,
    setInitialLoading
  } = useAuthStore();

  /**
   * Startup verification logic
   */
  const verify = async () => {
    setInitialLoading(true);
    try {
      const token = await keychain.getToken();

      if (!token) {
        clearAuth();
        return;
      }

      // We call /api/auth/verify (handled by proxy to map to dashboard or mock)
      const res = await api.get<any>("/api/auth/verify", token);
      
      // Handle various backend response formats (Direct, Nested in .data, or Mock)
      const userData = res.user || res.data?.user;
      const subData = res.subscription || res.data || res.data?.subscription;

      if (userData && subData) {
        setUser(userData);
        setSubscription(subData);
      } else if (res.valid && res.subscription) {
        // Handle mock format
        if (res.user) setUser(res.user);
        setSubscription(res.subscription);
      } else {
        console.warn("Verification failed: incomplete data", res);
        await keychain.deleteToken();
        clearAuth();
      }
    } catch (error) {
      console.error("Verification error:", error);
      await keychain.deleteToken();
      clearAuth();
    } finally {
      setInitialLoading(false);
    }
  };

  /**
   * Login logic
   */
  const login = async (username: string, password: string) => {
    // The proxy handles mapping {username} to {email} if required by the backend
    const data = await api.post<{
      token: string;
      user: User;
      subscription: Subscription;
    }>("/api/auth/login", { username, password });

    await keychain.setToken(data.token);
    setAuth(data.user, data.subscription);
  };

  /**
   * Logout logic
   */
  const logout = async () => {
    await keychain.deleteToken();
    clearAuth();
  };

  /**
   * Refresh profile data
   */
  const refresh = async () => {
    const token = await keychain.getToken();
    if (!token) return;

    try {
      const data = await api.get<{
        valid: boolean;
        user?: User;
        subscription: Subscription
      }>("/api/auth/verify", token);

      if (data.valid || (data as any).user) {
        if (data.user) setUser(data.user);
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error("Failed to refresh profile:", error);
    }
  };

  return { verify, login, logout, refresh };
}
