import React, { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";
import { openUrl } from "@tauri-apps/plugin-opener";
import { logger } from "../../lib/logger";
import {
  LogOut,
  ExternalLink,
  ShieldCheck,
  Zap,
  User as UserIcon
} from "lucide-react";
import clsx from "clsx";

const ProfileSection: React.FC = () => {
  const { user, subscription, isAuthenticated } = useAuthStore();
  const { logout, verify } = useAuth();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  logger.log("ProfileSection State Check:", {
    hasUser: !!user,
    hasSub: !!subscription,
    isAuthenticated,
    userValue: user
  });



  const getAvatarColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 45%, 45%)`;
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4 opacity-50">
        <UserIcon className="w-12 h-12" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Session information unavailable.</p>
          <p className="text-[10px] text-gray-500">Auth state: {isAuthenticated ? "Authenticated" : "Not authenticated"}</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => verify()}
            className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-md text-xs font-bold hover:bg-blue-600/40 transition-all border border-blue-500/30"
          >
            Reconnect Session
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white/5 text-gray-400 rounded-md text-xs font-bold hover:bg-white/10 transition-all border border-white/10"
          >
            Reload UI
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-400 max-w-2xl mx-auto pb-8">
      {/* 1. Profile Header Layer */}
      <div className="flex items-center gap-6 p-6 rounded-2xl bg-gradient-to-br from-[#252526] to-[#1e1e1e] border border-white/5 shadow-xl shadow-black/20">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-2xl relative group overflow-hidden shrink-0"
          style={{ backgroundColor: getAvatarColor(user.id) }}
        >
          {user.display_name.charAt(0).toUpperCase()}
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-white tracking-tight truncate">
              {user.display_name}
            </h3>
            {subscription?.plan !== "free" && (
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-secondary font-medium whitespace-nowrap overflow-hidden">
            <span className="truncate">@{user.username}</span>
            <span className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
            <span className="text-xs opacity-60 font-normal truncate">{user.email}</span>
          </div>

          <div className="mt-3 flex gap-2">
            <span className="px-2.5 py-0.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#007acc]">
              ID: {user.id.slice(0, 8)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Subscription Information */}
      <div className="flex flex-col gap-4">
        {/* Plan Details Card */}
        <div className="p-5 rounded-2xl bg-[#252526] border border-white/5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-tighter">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Service Plan
            </div>
            <span className="px-3 py-0.5 rounded-sm text-[10px] font-black uppercase italic shadow-sm bg-gradient-to-r from-emerald-600 to-green-500 text-white">
              PRO
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={clsx(
                "w-1.5 h-1.5 rounded-full pulse",
                subscription?.status === "expired" ? "bg-red-500" : "bg-green-500"
              )} />
              <span className="text-white font-medium text-sm leading-none">
              {subscription?.status === "active" ? "Active Subscription" : subscription?.status ?? "No subscription found"}
              </span>
            </div>
            <span className="text-[11px] text-gray-500 ml-3.5">
              Valid until {subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : "No expiry"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Action Grid */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => openUrl("https://account.truncateide.app")}
          className="flex items-center justify-between p-4 bg-[#2d2d2d]/30 hover:bg-[#2d2d2d]/60 border border-white/5 rounded-2xl transition-all duration-200 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-white">Manage In Portal</span>
              <span className="text-[11px] text-gray-500">Edit profile details and billing history</span>
            </div>
          </div>
          <span className="text-xs text-[#007acc] font-bold group-hover:translate-x-1 transition-transform">Visit Account</span>
        </button>

        <div className="pt-2">
          {!showSignOutConfirm ? (
            <button
              onClick={() => setShowSignOutConfirm(true)}
              className="w-full flex items-center justify-center gap-2 p-3 text-sm text-[#f14c4c] border border-white/5 hover:border-[#f14c4c]/40 hover:bg-[#f14c4c]/5 rounded-2xl transition-all font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sign out session
            </button>
          ) : (
            <div className="flex flex-col gap-4 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col gap-1 text-center">
                <p className="text-sm font-bold text-white">Sign out for security?</p>
                <p className="text-xs text-secondary">You will be required to re-authenticate on next launch.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={logout}
                  className="flex-1 bg-[#f14c4c] hover:bg-[#e81123] text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-[#f14c4c]/20"
                >
                  Yes, Sign out
                </button>
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold py-2.5 rounded-xl transition-all border border-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-center text-gray-600 uppercase tracking-[0.2em] font-black mt-4">
        Truncate IDE • Production Build v1.0
      </p>
    </div>
  );
};

export default ProfileSection;
