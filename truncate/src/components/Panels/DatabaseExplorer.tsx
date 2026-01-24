import React from 'react';
import { useDatabaseStore } from '../../store/databaseStore';
import { ConnectionPanel } from './ConnectionPanel';
import { Database, Table, Plug, Play } from 'lucide-react';
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
        disconnect
    } = useDatabaseStore();

    // If not connected, show connection panel
    if (!isConnected) {
        return <ConnectionPanel />;
    }

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-gray-300">
            <div className="h-10 border-b border-[#3e3e3e] flex items-center justify-between px-4 font-semibold text-white select-none bg-[#252526]">
                <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    <span>Explorer</span>
                </div>
                <button
                    onClick={disconnect}
                    className="p-1 hover:bg-[#3e3e3e] rounded text-gray-400 hover:text-white transition-colors"
                    title="Disconnect"
                >
                    <Plug className="w-4 h-4 transform rotate-45" />
                </button>
            </div>

            <div className="flex-1 overflow-auto p-2">
                <div className="space-y-1">
                    {databases.map((dbName) => {
                        const isActive = activeDatabase === dbName;

                        return (
                            <div key={dbName} className="select-none">
                                <div
                                    className={clsx(
                                        "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors group",
                                        isActive ? "bg-[#37373d] text-white" : "hover:bg-[#2a2d2e] text-gray-400"
                                    )}
                                // Clicking the DB row itself could connect, or we need a specific connect button as per req?
                                // Req: "User clicks the 'connect' icon next to a database"
                                // Let's implement that.
                                >
                                    <Database className={clsx("w-4 h-4", isActive ? "text-blue-400" : "text-gray-500")} />
                                    <span className="flex-1 truncate text-sm">{dbName}</span>

                                    {!isActive && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // We don't need credentials anymore, store handles it (via Backend)
                                                // Wait, I updated Backend to store creds, but I need to update Store to NOT send them.
                                                // Updating Store next.
                                                // For now, assume store.selectDatabase signature is updated.
                                                selectDatabase(dbName);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#4e4e4e] rounded text-green-400"
                                            title="Connect to Database"
                                        >
                                            <Play className="w-3 h-3 fill-current" />
                                        </button>
                                    )}
                                </div>

                                {isActive && (
                                    <div className="ml-4 mt-1 space-y-0.5 border-l border-[#3e3e3e] pl-2">
                                        {/* Loading state for tables? Store should handle it? 
                                            We don't have explicit loadingTables state, maybe just check if empty?
                                            Or assume fast enough.
                                        */}
                                        {tables.length === 0 ? (
                                            <div className="px-2 py-1 text-xs text-gray-500 italic">No tables found</div>
                                        ) : (
                                            tables.map(table => (
                                                <div
                                                    key={table}
                                                    onClick={() => selectTable(dbName, table)}
                                                    className={clsx(
                                                        "flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors text-sm",
                                                        activeTable === table ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e] text-gray-400"
                                                    )}
                                                >
                                                    <Table className="w-3 h-3" />
                                                    <span className="truncate">{table}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DatabaseExplorer;
