import React from "react";
import { useUiStore } from "../../store/uiStore";
import { X, User, Settings, Palette } from "lucide-react";
import ProfileSection from "../settings/ProfileSection";
import clsx from "clsx";

const SettingsModal: React.FC = () => {
  const { showSettings, toggleSettings } = useUiStore();
  const [activeTab, setActiveTab] = React.useState<"profile" | "general" | "theme">("profile");

  if (!showSettings) return null;

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "general", label: "General", icon: Settings },
    { id: "theme", label: "Appearance", icon: Palette },
  ] as const;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#1e1e1e] w-full max-w-[800px] h-[600px] rounded-xl border border-subtle shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-[200px] bg-[#252526] border-r border-subtle flex flex-col p-4 gap-2">
          <div className="flex items-center gap-2 mb-6 px-2">
            <Settings className="w-5 h-5 text-[#007acc]" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Settings</h2>
          </div>

          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all",
                activeTab === tab.id 
                  ? "bg-[#007acc] text-white shadow-md shadow-[#007acc]/20" 
                  : "text-secondary hover:text-white hover:bg-[#2d2d2d]"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-8 border-b border-subtle">
            <h3 className="text-lg font-medium text-white capitalize">
              {activeTab}
            </h3>
            <button 
              onClick={toggleSettings}
              className="p-1.5 hover:bg-[#2d2d2d] rounded-md text-secondary hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto p-8 custom-scrollbar">
            {activeTab === "profile" && <ProfileSection />}
            
            {activeTab === "general" && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 opacity-50">
                <Settings className="w-12 h-12" />
                <p>General settings coming soon...</p>
              </div>
            )}

            {activeTab === "theme" && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 opacity-50">
                <Palette className="w-12 h-12" />
                <p>Appearance settings coming soon...</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Backdrop area click to close */}
      <div className="absolute inset-0 -z-10" onClick={toggleSettings} />
    </div>
  );
};

export default SettingsModal;
