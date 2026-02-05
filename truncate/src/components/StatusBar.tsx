import React from 'react';
import { useDatabaseStore } from '../store/databaseStore';
import { Database, Server, FileText, Activity } from 'lucide-react';
import clsx from 'clsx';

const StatusBar: React.FC = () => {
    const { isConnected, activeDatabase, connectionUser, connectionType, connectionHost } = useDatabaseStore();

    // Helper to determine display values
    const getConnectionInfo = () => {
        if (!isConnected) return { type: 'Disconnected', icon: Server, label: 'No Connection' };

        const typeLabel = connectionType
            ? connectionType.charAt(0).toUpperCase() + connectionType.slice(1)
            : 'Unknown';

        // For File-based DBs (SQLite, CSV), Host is the path
        const isFileBased = connectionType === 'sqlite' || connectionType === 'csv' || connectionType?.includes('csv');

        if (isFileBased) {
            // Clean up host path for display (basename?)
            // Just return raw host, CSS will truncate
            return {
                type: typeLabel,
                icon: FileText,
                label: connectionHost || 'Unknown File',
                isPath: true
            };
        }

        // For Server-based (MySQL, Postgres)
        return {
            type: typeLabel,
            icon: Server,
            label: `${connectionUser || 'user'}@${connectionHost || 'localhost'}`,
            isPath: false
        };
    };

    const info = getConnectionInfo();

    return (
        <div className="h-6 bg-[#007acc] text-white flex items-center px-3 text-[11px] justify-between select-none font-sans shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            {/* Left Section: Context */}
            <div className="flex items-center gap-3 overflow-hidden">

                {/* Connection Status */}
                <div
                    className={clsx(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors max-w-[200px] shrink-0",
                        isConnected ? "hover:bg-white/10 cursor-pointer" : "opacity-70"
                    )}
                    title={isConnected ? `Connected to ${info.type}\n${info.label}` : "No active connection"}
                >
                    <info.icon className="w-3 h-3 shrink-0" />
                    <span className="font-semibold">{info.type}</span>
                </div>

                {/* Active Database / File Path */}
                {isConnected && (
                    <>
                        {/* If file based, show path. If server, show DB name */}
                        {info.isPath ? (
                            <div
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer overflow-hidden"
                                title={info.label} // Full path on hover
                            >
                                <span className="opacity-60 hidden sm:inline">Path:</span>
                                <span className="truncate max-w-[150px] sm:max-w-[300px]">{info.label}</span>
                            </div>
                        ) : (
                            // Server: Show Host Info
                            <div
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer overflow-hidden"
                                title={`Host: ${info.label}`}
                            >
                                <span className="truncate max-w-[150px]">{info.label}</span>
                            </div>
                        )}

                        {/* Active Database Name (always relevant if selected) */}
                        {activeDatabase && (
                            <div
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                                title={`Active Database: ${activeDatabase}`}
                            >
                                <Database className="w-3 h-3 shrink-0 opacity-80" />
                                <span className="font-medium truncate max-w-[120px]">{activeDatabase}</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Right Section: Environment / Meta */}
            <div className="flex items-center gap-4 shrink-0">
                {isConnected && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-white/10 rounded transition-colors cursor-default" title="Database Mode">
                        <Activity className="w-3 h-3 opacity-80" />
                        <span>Standard</span>
                    </div>
                )}

                <div className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-white/10 rounded transition-colors cursor-pointer" title="Encoding">
                    <span>UTF-8</span>
                </div>
            </div>
        </div>
    );
};

export default StatusBar;
