import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../../lib/api";
import { 
  CreditCard, 
  RefreshCw, 
  LogOut, 
  ExternalLink,
  ShieldCheck,
  Zap,
  User as UserIcon
} from "lucide-react";
import clsx from "clsx";

const ProfileSection: React.FC = () => {
  const { user, subscription } = useAuthStore();
  const { logout, refresh } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (subscription?.expires_at) {
        try {
          const res = await api.get<{ status_message: string }>("/api/subscription/status");
          setStatusMessage(res.status_message);
        } catch (err) {
          console.error("Failed to fetch subscription status:", err);
        }
      }
    };
    fetchStatus();
  }, [subscription?.expires_at]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

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
        <p className="text-sm font-medium">Session information unavailable.</p>
        <button onClick={() => window.location.reload()} className="text-[11px] underline">Reload Application</button>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Plan Details Card */}
        <div className="p-5 rounded-2xl bg-[#252526] border border-white/5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-tighter">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Service Plan
            </div>
            <span className={clsx(
              "px-3 py-0.5 rounded-sm text-[10px] font-black uppercase italic shadow-sm",
              subscription?.plan === "enterprise" ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white" :
              subscription?.plan === "pro" ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white" : "bg-[#3e3e3e] text-gray-200"
            )}>
              {subscription?.plan || "Free"}
            </span>
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={clsx(
                "w-1.5 h-1.5 rounded-full pulse",
                subscription?.status === "expired" ? "bg-red-500" : "bg-green-500"
              )} />
              <span className="text-white font-medium text-sm leading-none">
                {statusMessage || (subscription?.status === "active" ? "Active Subscription" : subscription?.status)}
              </span>
            </div>
            <span className="text-[11px] text-gray-500 ml-3.5">
              Valid until {subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : "No expiry"}
            </span>
          </div>
        </div>

        {/* Usage Card */}
        <div className="p-5 rounded-2xl bg-[#252526] border border-white/5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-tighter">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              Compute Credits
            </div>
            <button 
              onClick={handleRefresh}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={clsx("w-2.5 h-2.5", isRefreshing && "animate-spin")} />
              Sync
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-end justify-between font-mono">
              <span className="text-xl text-white font-black leading-none">
                {subscription?.credits_remaining ?? 0}
              </span>
              <span className="text-[10px] text-gray-500 font-bold mb-0.5">
                / {subscription?.total_credits ?? '∞'} TOTAL
              </span>
            </div>
            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-[#007acc] to-[#4fc1ff] rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(79,193,255,0.4)]"
                style={{ width: `${Math.min(100, ((subscription?.credits_remaining || 0) / (subscription?.total_credits || 1)) * 100)}%` }}
              />
            </div>
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
