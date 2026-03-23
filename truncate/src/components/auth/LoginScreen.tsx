import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Loader2, ExternalLink, Eye, EyeOff } from "lucide-react";
import clsx from "clsx";

const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login(username, password);
    } catch (err: any) {
      if (err.status === 401) {
        setError("Incorrect username or password");
      } else if (err.status === 403) {
        setError("Account suspended. Visit account.truncateide.app");
      } else if (err.status === 429) {
        setError("Too many attempts. Please wait a few minutes.");
      } else {
        setError(err.message || "Cannot reach Truncate servers. Check your connection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSite = () => {
    openUrl("https://account.truncateide.app");
  };

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] flex items-center justify-center z-[9999] select-none">
      <div className="w-full max-w-[360px] p-8 flex flex-col items-center">
        {/* Logo / Wordmark */}
        <div className="flex items-center gap-3 mb-10 group">
          <div className="w-10 h-10 bg-[#007acc] rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(0,122,204,0.3)] group-hover:shadow-[0_0_25px_rgba(0,122,204,0.5)] transition-all">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase italic">Truncate</h1>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400 ml-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className="w-full bg-[#2d2d2d] border border-[#3e3e3e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#007acc] focus:ring-1 focus:ring-[#007acc] transition-all disabled:opacity-50"
              placeholder="Enter username"
              autoComplete="username"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400 ml-1">Password</label>
            <div className="relative group/pass">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full bg-[#2d2d2d] border border-[#3e3e3e] rounded-md pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-[#007acc] focus:ring-1 focus:ring-[#007acc] transition-all disabled:opacity-50"
                placeholder="Enter password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-md p-2.5 mt-2">
              <p className="text-[11px] text-[#f14c4c] text-center leading-normal">
                {error}
              </p>
            </div>
          )}

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={clsx(
              "w-full bg-[#007acc] hover:bg-[#0062a3] text-white font-semibold py-2.5 rounded-md mt-4 transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/20",
              isLoading && "opacity-80 cursor-not-allowed"
            )}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Secondary Link */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            onClick={handleOpenSite}
            className="group flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-[#cccccc] transition-colors"
          >
            Manage account or sign up
            <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
          <span className="text-[10px] text-gray-600">account.truncateide.app</span>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
