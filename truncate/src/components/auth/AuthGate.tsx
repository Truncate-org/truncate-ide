import React, { useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";
import LoginScreen from "./LoginScreen";
import CreditsExhausted from "./CreditsExhausted.tsx";
import { Loader2 } from "lucide-react";

// Module-level flag: survives React StrictMode's unmount/remount cycle
// so verify() is guaranteed to run exactly once per app session.
let verifyRan = false;

interface AuthGateProps {
  children: React.ReactNode;
}

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { verify } = useAuth();

  // Granular selectors — each only re-renders when its own value changes
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialLoading = useAuthStore((s) => s.isInitialLoading);
  const subscription = useAuthStore((s) => s.subscription);

  // Guard to prevent verify() running more than once (React StrictMode safe)
  useEffect(() => {
    if (verifyRan) return;
    verifyRan = true;
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1. Startup Loading State
  if (isInitialLoading) {
    return (
      <div className="fixed inset-0 bg-[#1e1e1e] flex flex-col items-center justify-center z-[9999] select-none">
        <Loader2 className="w-10 h-10 text-[#007acc] animate-spin mb-4" />
        <p className="text-secondary text-sm animate-pulse tracking-wide uppercase font-semibold">
          Authenticating...
        </p>
      </div>
    );
  }

  // 2. Auth Check
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // 3. Subscription Check
  const isExpired = subscription?.status === "expired";

  if (isExpired) {
    return <CreditsExhausted />;
  }

  // 4. Authorized Access
  return <>{children}</>;
};

export default AuthGate;
