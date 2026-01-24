import React from 'react';
import { useDatabaseStore } from '../../store/databaseStore';
import { ConnectionCard } from './ConnectionCard';
import { Database, Table, Play, Power, XCircle, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

const DatabaseExplorer: React.FC = () => {
    const {
        isConnected,
        databases,
        activeDatabase,
        tables,
        activeTable,
        selectDatabase,
        selectTable,
        closeDatabase,
        disconnect,
        connectionUser
    } = useDatabaseStore();

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-gray-300">
            {/* Header */}
            <div className="h-9 border-b border-[#3e3e3e] flex items-center justify-between px-3 font-semibold text-white select-none bg-[#252526]">
                <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs uppercase tracking-wide">
                        {activeDatabase ? 'Explorer' : 'Databases'}
                    </span>
                </div>
                {isConnected && !activeDatabase && (
                    <button
                        onClick={disconnect}
                        className="p-1 hover:bg-[#3e3e3e] rounded text-gray-400 hover:text-white transition-colors"
                        title="Disconnect Server"
                    >
                        <Power className="w-3.5 h-3.5 text-red-400" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-auto">
                {/* State 1: No Connection */}
                {!isConnected && (
                    <ConnectionCard />
                )}

                {/* State 2 & 3: Connected */}
                {isConnected && (
                    <div className="p-2 space-y-2">

                        {/* 
                            VIEW MODE 1: LIST MODE
                            Show only if NO database is active.
                        */}
                        {!activeDatabase && (
                            <>
                                {/* Server Info Header */}
                                <div className="px-2 py-1 text-xs text-green-500 flex items-center gap-2 mb-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="font-mono">{connectionUser || 'Unknown'}</span>
                                </div>

                                <div className="space-y-1">
                                    {databases.map((dbName) => (
                                        <div key={dbName} className="select-none group">
                                            <div
                                                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors hover:bg-[#2a2d2e] text-gray-400"
                                            >
                                                <Database className="w-3.5 h-3.5 text-gray-500" />
                                                <span className="flex-1 truncate text-xs">{dbName}</span>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        selectDatabase(dbName);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#4e4e4e] rounded text-green-400 transition-opacity"
                                                    title="Connect"
                                                >
                                                    <Play className="w-3 h-3 fill-current" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* 
                            VIEW MODE 2: ACTIVE DATABASE (FOCUS MODE)
                            Show only if A database IS active.
                        */}
                        {activeDatabase && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-200">
                                {/* Active DB Header with Disconnect */}
                                <div className="mb-4 pb-2 border-b border-[#3e3e3e]">
                                    <div className="flex items-center justify-between px-1 mb-2">
                                        <div className="font-bold text-white flex items-center gap-2">
                                            <Database className="w-3.5 h-3.5 text-blue-500" />
                                            <span className="text-sm">{activeDatabase}</span>
                                        </div>
                                        <div className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-blue-900/30 text-blue-400 border border-blue-800/50">
                                            Active
                                        </div>
                                    </div>

                                    <button
                                        onClick={closeDatabase}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-1 bg-[#2a2d2e] hover:bg-[#323638] text-gray-400 hover:text-white text-[10px] uppercase tracking-wide rounded transition-colors border border-[#3e3e3e]"
                                    >
                                        <ArrowLeft className="w-3 h-3" />
                                        Disconnect
                                    </button>
                                </div>

                                {/* Tables List */}
                                <div className="space-y-0.5">
                                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">
                                        Tables
                                    </div>

                                    {tables.length === 0 ? (
                                        <div className="px-2 py-4 text-center text-xs text-gray-500 italic">
                                            No tables found.
                                        </div>
                                    ) : (
                                        tables.map(table => (
                                            <div
                                                key={table}
                                                onClick={() => selectTable(activeDatabase, table)}
                                                className={clsx(
                                                    "flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors text-xs",
                                                    activeTable === table
                                                        ? "bg-[#094771] text-white font-medium"
                                                        : "text-gray-400 hover:bg-[#2a2d2e] hover:text-gray-300"
                                                )}
                                            >
                                                <Table className={clsx("w-3 h-3", activeTable === table ? "text-blue-200" : "text-gray-500")} />
                                                <span className="truncate">{table}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
};

export default DatabaseExplorer;
