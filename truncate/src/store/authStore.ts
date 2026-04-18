import { create } from "zustand";

export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
}

export interface Subscription {
  status: "active" | "ongoing" | "expired";
  plan: "free" | "pro" | "enterprise";
  credits_remaining: number;
  total_credits?: number; // Total credits for the plan (for progress bar)
  expires_at: string | null;
}

interface AuthState {
  user: User | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  isInitialLoading: boolean; // For initial startup check
  setUser: (user: User | null) => void;
  setSubscription: (sub: Subscription | null) => void;
  setAuth: (user: User, subscription: Subscription) => void;
  setInitialLoading: (loading: boolean) => void;
  clearAuth: () => void;
  setAuthenticated: (isAuth: boolean) => void;
}

/**
 * Auth store for in-memory state.
 * SECURITY: This store is NOT persisted to localStorage.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  subscription: null,
  isAuthenticated: false,
  isInitialLoading: true,

  setUser: (user) => set((_state) => ({ 
    user, 
    isAuthenticated: true 
  })),

  setSubscription: (subscription) => set({ subscription }),

  setAuth: (user, subscription) => set({
    user,
    subscription,
    isAuthenticated: true,
    isInitialLoading: false
  }),

  setInitialLoading: (loading) => set({ isInitialLoading: loading }),

  clearAuth: () => set({
    user: null,
    subscription: null,
    isAuthenticated: false,
    isInitialLoading: false
  }),

  setAuthenticated: (isAuth) => set({ isAuthenticated: isAuth }),
}));
