import React from 'react';
import { useDatabaseStore } from '../../store/databaseStore';
import { ConnectionCard } from './ConnectionCard';
import { Database, Table, ChevronDown, Layers, LogOut, Link } from 'lucide-react';
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
        connectionUser,
        connectionType
    } = useDatabaseStore();

    // Local state to toggle between database list and connection form
    const [showConnectionForm, setShowConnectionForm] = React.useState(false);

    // Reset connection form view when successfully connected
    React.useEffect(() => {
        if (isConnected && databases.length > 0) {
            setShowConnectionForm(false);
        }
    }, [isConnected, databases]);

    // Always show connection form when not connected
    if (!isConnected) {
        return (
            <div className="flex flex-col h-full bg-panel text-gray-300 p-4">
                <ConnectionCard />
            </div>
        );
    }

    // Show connection form when user clicks "New Connection" button
    if (showConnectionForm) {
        return (
            <div className="flex flex-col h-full bg-panel text-gray-300 p-4">
                <ConnectionCard />
            </div>
        );
    }

    // SERVER-LEVEL VIEW: No active database selected
    if (!activeDatabase) {
        return (
            <div className="h-full bg-panel text-gray-300 select-none overflow-y-auto font-sans text-[13px]">
                <div className="flex flex-col">
                    {/* Header with New Connection Button */}
                    <div className="flex items-center justify-between px-2 py-2 text-gray-300 font-medium border-b border-subtle">
                        <div className="flex items-center gap-1.5 text-blue-400">
                            <Layers className="w-3.5 h-3.5" />
                            <span>{connectionUser || connectionType || 'Connection'}</span>
                        </div>
                        <button
                            onClick={() => setShowConnectionForm(true)}
                            className="px-2 py-0.5 text-[10px] font-medium text-gray-400 hover:text-blue-400 hover:bg-subtle rounded transition-colors"
                            title="Add or change connection"
                        >
                            <Link className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Database List with Connect Buttons */}
                    <div className="flex flex-col p-2 gap-1">
                        {databases.length === 0 ? (
                            <div className="px-2 py-4 text-xs text-gray-600 italic text-center">
                                No databases found
                            </div>
                        ) : (
                            databases.map((dbName) => (
                                <div
                                    key={dbName}
                                    className="flex items-center justify-between px-2 py-1.5 hover:bg-subtle rounded transition-colors group"
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <Database className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                        <span className="text-gray-300 truncate">{dbName}</span>
                                    </div>
                                    <button
                                        onClick={() => selectDatabase(dbName)}
                                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-400/30 rounded hover:bg-blue-400/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                                        title={`Connect to ${dbName}`}
                                    >
                                        <Link className="w-3 h-3" />
                                        Connect
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // DATABASE-LEVEL VIEW: Active database selected
    return (
        <div className="h-full bg-panel text-gray-300 select-none overflow-y-auto font-sans text-[13px]">
            <div className="flex flex-col">
                {/* Header with Back Button */}
                <div className="flex items-center justify-between px-2 py-2 border-b border-subtle">
                    <button
                        onClick={closeDatabase}
                        className="flex items-center gap-1 px-2 py-1 text-blue-400 hover:bg-subtle rounded transition-colors"
                        title="Back to database list"
                    >
                        <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                        <span className="text-xs font-medium">Databases</span>
                    </button>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        <span>Connected:</span>
                        <span className="text-blue-400 font-medium">{activeDatabase}</span>
                    </div>
                </div>

                {/* Active Database with Tables */}
                <div className="flex flex-col">
                    <div className="flex items-center justify-between px-2 py-1 pl-6 bg-[#094771]/20 border-l-2 border-blue-400 group">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="text-white truncate">{activeDatabase}</span>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                closeDatabase();
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 hover:text-white hover:bg-subtle rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                            title="Disconnect from database"
                        >
                            <LogOut className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Tables */}
                    <div className="flex flex-col pb-1">
                        {tables.length === 0 ? (
                            <div className="pl-14 py-2 text-xs text-gray-600 italic">No tables</div>
                        ) : (
                            tables.map((tableName: string) => (
                                <div
                                    key={tableName}
                                    onClick={() => selectTable(activeDatabase, tableName)}
                                    className={clsx(
                                        "flex items-center gap-2 px-2 py-1 pl-12 cursor-pointer transition-colors border-l-2",
                                        activeTable === tableName
                                            ? "bg-[#094771] text-white border-blue-400"
                                            : "border-transparent text-gray-400 hover:bg-subtle hover:text-gray-300"
                                    )}
                                >
                                    <Table className={clsx("w-3.5 h-3.5 shrink-0", activeTable === tableName ? "text-blue-200" : "text-gray-500")} />
                                    <span className="truncate">{tableName}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseExplorer;
