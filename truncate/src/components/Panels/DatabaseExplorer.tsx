import React from 'react';
import { useDatabaseStore } from '../../store/databaseStore';
import { ConnectionCard } from './ConnectionCard';
import { CreateDatabaseModal } from '../Modals/CreateDatabaseModal';
import { CreateTableModal } from '../Modals/CreateTableModal';
import { DeleteDatabaseModal } from '../Modals/DeleteDatabaseModal';
import { Database, Table, ChevronDown, Layers, LogOut, Link, Plus, Trash2 } from 'lucide-react';
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
        connectionType,
        connectionHost,
        disconnect
    } = useDatabaseStore();

    // For CSV/SQLite, show filename instead of raw config JSON
    const displayLabel = React.useMemo(() => {
        if (connectionType === 'csv' || connectionType === 'sqlite') {
            if (connectionHost) {
                const parts = connectionHost.replace(/\\/g, '/').split('/');
                return parts[parts.length - 1] || connectionHost;
            }
            return connectionType.toUpperCase();
        }
        return connectionUser || connectionType || 'Connection';
    }, [connectionType, connectionHost, connectionUser]);

    // Local state
    const [showConnectionForm, setShowConnectionForm] = React.useState(false);
    const [showCreateDbModal, setShowCreateDbModal] = React.useState(false);
    const [showCreateTableModal, setShowCreateTableModal] = React.useState(false);
    const [dbToDelete, setDbToDelete] = React.useState<string | null>(null);

    const supportsCreateDb = connectionType === 'mysql' || connectionType === 'postgres';

    const isSystemDb = (name: string) => {
        if (connectionType === 'mysql') {
            return ['information_schema', 'mysql', 'performance_schema', 'sys'].includes(name);
        }
        if (connectionType === 'postgres') {
            return ['postgres', 'template0', 'template1'].includes(name); // 'postgres' is roughly equivalent to 'mysql'
        }
        return false;
    };

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
                    {/* Header with Back + New Connection Buttons */}
                    <div className="flex items-center justify-between px-2 py-2 text-gray-300 font-medium border-b border-subtle">
                        <div className="flex items-center gap-1.5 text-blue-400 min-w-0">
                            <Layers className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{displayLabel}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {supportsCreateDb && (
                                <button
                                    onClick={() => setShowCreateDbModal(true)}
                                    className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-green-400 hover:bg-green-400/10 rounded transition-colors border border-green-400/20"
                                    title="Create a new database"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>DB</span>
                                </button>
                            )}
                            <button
                                onClick={() => setShowConnectionForm(true)}
                                className="px-2 py-0.5 text-[10px] font-medium text-gray-400 hover:text-blue-400 hover:bg-subtle rounded transition-colors"
                                title="Add or change connection"
                            >
                                <Link className="w-3 h-3" />
                            </button>
                            <button
                                onClick={() => disconnect()}
                                className="px-2 py-0.5 text-[10px] font-medium text-gray-400 hover:text-red-400 hover:bg-subtle rounded transition-colors"
                                title="Disconnect and return to connection page"
                            >
                                <LogOut className="w-3 h-3" />
                            </button>
                        </div>
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
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {supportsCreateDb && !isSystemDb(dbName) && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDbToDelete(dbName); }}
                                                className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                                title="Delete Database"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => selectDatabase(dbName)}
                                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-400/30 rounded hover:bg-blue-400/10 transition-colors shrink-0"
                                            title={`Connect to ${dbName}`}
                                        >
                                            <Link className="w-3 h-3" />
                                            Connect
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <CreateDatabaseModal isOpen={showCreateDbModal} onClose={() => setShowCreateDbModal(false)} />
                <DeleteDatabaseModal
                    isOpen={!!dbToDelete}
                    databaseName={dbToDelete}
                    onClose={() => setDbToDelete(null)}
                />
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

                    {/* + Table Button */}
                    <div className="px-2 py-1.5 pl-10">
                        <button
                            onClick={() => setShowCreateTableModal(true)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-green-400 hover:bg-green-400/10 rounded transition-colors border border-green-400/20 border-dashed"
                            title="Create a new table"
                        >
                            <Plus className="w-3 h-3" />
                            New Table
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
            <CreateTableModal isOpen={showCreateTableModal} onClose={() => setShowCreateTableModal(false)} />
        </div>
    );
};

export default DatabaseExplorer;
