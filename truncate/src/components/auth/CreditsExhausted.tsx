import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CreditCard, LogOut, ArrowRight } from "lucide-react";

const CreditsExhausted: React.FC = () => {
  const { logout } = useAuth();

  const handleManage = () => {
    openUrl("https://account.truncateide.app");
  };

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] flex items-center justify-center z-[9999] select-none text-center">
      <div className="w-full max-w-[400px] p-8 flex flex-col items-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
          <CreditCard className="w-8 h-8 text-red-500" />
        </div>

        {/* Text */}
        <h2 className="text-xl font-bold text-white mb-3">
          Your Truncate credits have run out
        </h2>
        <p className="text-sm text-gray-400 mb-8 leading-relaxed">
          Add credits or upgrade your plan to continue using Truncate.
        </p>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleManage}
            className="w-full bg-[#007acc] hover:bg-[#0062a3] text-white font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/20"
          >
            Manage subscription
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={logout}
            className="mt-4 flex items-center gap-2 text-[11px] text-gray-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Sign in with a different account
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditsExhausted;
