import React from 'react';
import { useUpdater } from '../../hooks/useUpdater';
import { Download, X } from 'lucide-react';

export const UpdateBanner: React.FC = () => {
  const { updateAvailable, updateInfo, isUpdating, installUpdate, dismissUpdate } = useUpdater();

  if (!updateAvailable || !updateInfo) return null;

  return (
    <div className="fixed bottom-12 right-6 z-[9999] animate-in slide-in-from-right duration-300">
      <div className="w-80 p-4 rounded-xl bg-[#1e1e1e] border border-blue-500/30 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm font-bold text-gray-200">Update Available</span>
          </div>
          <button 
            onClick={dismissUpdate}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">
            Version {updateInfo.version} is now available.
          </span>
          {updateInfo.body && (
            <div className="text-[11px] text-gray-500 line-clamp-2 italic">
              "{updateInfo.body}"
            </div>
          )}
        </div>

        <button
          onClick={installUpdate}
          disabled={isUpdating}
          className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all ${
            isUpdating 
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
          }`}
        >
          <Download size={14} />
          {isUpdating ? 'Installing...' : 'Install & Relaunch'}
        </button>
      </div>
    </div>
  );
};
