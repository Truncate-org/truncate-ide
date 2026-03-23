import React, { useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";
import LoginScreen from "./LoginScreen";
import CreditsExhausted from "./CreditsExhausted";
import { Loader2 } from "lucide-react";

interface AuthGateProps {
  children: React.ReactNode;
}

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { verify } = useAuth();
  const { 
    isAuthenticated, 
    isInitialLoading, 
    subscription 
  } = useAuthStore();

  useEffect(() => {
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
  const isExhausted = subscription?.credits_remaining === 0;

  if (isExpired || isExhausted) {
    return <CreditsExhausted />;
  }

  // 4. Authorized Access
  return <>{children}</>;
};

export default AuthGate;
