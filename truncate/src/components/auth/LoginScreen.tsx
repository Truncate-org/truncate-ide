import React, { useState } from "react";
import { useAuth, DeviceAuthResponse } from "../../hooks/useAuth";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

import logo from "../../assets/logo.png";

type Phase = "idle" | "starting" | "waiting" | "error";

const LoginScreen: React.FC = () => {
  const { startDeviceLogin, completeDeviceLogin } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [deviceAuth, setDeviceAuth] = useState<DeviceAuthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setPhase("starting");

    try {
      const auth = await startDeviceLogin();
      setDeviceAuth(auth);
      setPhase("waiting");
      openUrl(auth.verification_uri_complete);

      await completeDeviceLogin(auth.device_code, auth.interval, auth.expires_in);
      // AuthGate re-renders once isAuthenticated flips — nothing else to do here.
    } catch (err: any) {
      // Rust command failures (Result<T, String>) reject with a plain string,
      // not an Error — only api.post()'s ApiError has .status/.message.
      if (err?.status === 429) {
        setError("Too many attempts. Please wait a few minutes.");
      } else if (typeof err === "string") {
        setError(err);
      } else {
        setError(err?.message || "Sign-in failed. Please try again.");
      }
      setPhase("error");
      setDeviceAuth(null);
    }
  };

  const handleOpenSite = () => {
    openUrl("https://account.truncateide.app");
  };

  const handleReopenBrowser = () => {
    if (deviceAuth) openUrl(deviceAuth.verification_uri_complete);
  };

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] flex items-center justify-center z-[9999] select-none">
      <div className="w-full max-w-[360px] p-8 flex flex-col items-center">
        {/* Logo / Wordmark */}
        <div className="flex items-center gap-3 mb-10 group">
          <div className="w-10 h-10 flex items-center justify-center group-hover:scale-105 transition-transform">
            <img src={logo} alt="Truncate Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(0,122,204,0.3)]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase italic">Truncate</h1>
        </div>

        <div className="w-full flex flex-col gap-4">
          {phase === "waiting" && deviceAuth ? (
            <div className="w-full flex flex-col items-center gap-4 text-center">
              <p className="text-xs text-gray-400">Confirm this code in the browser window we just opened:</p>
              <div className="w-full bg-[#2d2d2d] border border-[#3e3e3e] rounded-md py-3 px-4">
                <span className="text-2xl font-bold tracking-[0.2em] text-white">{deviceAuth.user_code}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Waiting for confirmation...
              </div>
              <button
                type="button"
                onClick={handleReopenBrowser}
                className="group flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-[#cccccc] transition-colors"
              >
                Didn't open? Click to open the browser again
                <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              disabled={phase === "starting"}
              className={clsx(
                "w-full bg-[#007acc] hover:bg-[#0062a3] text-white font-semibold py-2.5 rounded-md transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/20",
                phase === "starting" && "opacity-80 cursor-not-allowed"
              )}
            >
              {phase === "starting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {phase === "starting" ? "Starting..." : "Sign in with Truncate Account"}
            </button>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-md p-2.5 mt-2">
              <p className="text-[11px] text-[#f14c4c] text-center leading-normal">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Secondary Link */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            onClick={handleOpenSite}
            className="group flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-[#cccccc] transition-colors"
          >
            Don't have an account?
            <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
          <span className="text-[10px] text-gray-600">account.truncateide.app</span>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
