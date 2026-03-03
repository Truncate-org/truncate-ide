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
            <div className="flex flex-col h-full bg-panel text-[#cccccc] p-4">
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
            <div className="h-full bg-panel text-[#cccccc] select-none overflow-y-auto font-sans text-[13px]">
                <div className="flex flex-col">
                    {/* Header with Back + New Connection Buttons */}
                    <div className="flex items-center justify-between px-4 py-2 font-medium">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Layers className="w-3.5 h-3.5 shrink-0 text-secondary" />
                            <span className="truncate">{displayLabel}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                            {supportsCreateDb && (
                                <button
                                    onClick={() => setShowCreateDbModal(true)}
                                    className="flex items-center justify-center w-6 h-6 text-secondary hover:text-white hover:bg-[#333333] rounded transition-colors"
                                    title="Create a new database"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={() => setShowConnectionForm(true)}
                                className="flex items-center justify-center w-6 h-6 text-secondary hover:text-white hover:bg-[#333333] rounded transition-colors"
                                title="Add or change connection"
                            >
                                <Link className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => disconnect()}
                                className="flex items-center justify-center w-6 h-6 text-secondary hover:text-red-400 hover:bg-[#333333] rounded transition-colors"
                                title="Disconnect"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Database List with Connect Buttons */}
                    <div className="flex flex-col py-1">
                        {databases.length === 0 ? (
                            <div className="px-4 py-2 text-[12px] text-secondary italic">
                                No databases found
                            </div>
                        ) : (
                            databases.map((dbName) => (
                                <div
                                    key={dbName}
                                    className="flex items-center justify-between px-4 py-[5px] hover:bg-[#2a2d2e] cursor-pointer transition-colors group"
                                    onClick={() => selectDatabase(dbName)}
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <Database className="w-3.5 h-3.5 text-secondary shrink-0" />
                                        <span className="text-[#cccccc] text-[13px] truncate">{dbName}</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {supportsCreateDb && !isSystemDb(dbName) && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDbToDelete(dbName); }}
                                                className="p-1 text-[#858585] hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                                title="Delete Database"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
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
        <div className="h-full bg-panel text-[#cccccc] select-none overflow-y-auto font-sans text-[13px]">
            <div className="flex flex-col">
                {/* Header with Back Button */}
                <div className="flex items-center justify-between px-2 py-2">
                    <button
                        onClick={closeDatabase}
                        className="flex items-center gap-1 px-2 py-1 text-secondary hover:text-white hover:bg-[#333333] rounded transition-colors"
                        title="Back to database list"
                    >
                        <ChevronDown className="w-4 h-4 rotate-90" />
                        <span className="text-xs font-semibold">Databases</span>
                    </button>
                    <div className="flex items-center gap-1.5 text-[11px] text-secondary px-2">
                        <span className="text-[#007acc]">{activeDatabase}</span>
                    </div>
                </div>

                {/* Active Database with Tables */}
                <div className="flex flex-col pb-2">
                    <div className="flex items-center justify-between px-4 py-1.5 hover:bg-[#2a2d2e] cursor-pointer group" onClick={closeDatabase}>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <ChevronDown className="w-4 h-4 text-secondary shrink-0" />
                            <Database className="w-3.5 h-3.5 text-secondary shrink-0" />
                            <span className="text-white truncate font-medium">{activeDatabase}</span>
                        </div>
                    </div>

                    {/* Tables */}
                    <div className="flex flex-col">
                        {tables.length === 0 ? (
                            <div className="pl-12 py-2 text-[12px] text-secondary italic">No tables</div>
                        ) : (
                            tables.map((tableName: string) => (
                                <div
                                    key={tableName}
                                    onClick={() => selectTable(activeDatabase, tableName)}
                                    className={clsx(
                                        "flex items-center gap-2 px-4 py-[5px] pl-10 cursor-pointer transition-colors border-l-2",
                                        activeTable === tableName
                                            ? "bg-[#37373d] text-white border-[#007acc]"
                                            : "border-transparent text-[#cccccc] hover:bg-[#2a2d2e] hover:text-white"
                                    )}
                                >
                                    <Table className={clsx("w-3.5 h-3.5 shrink-0", activeTable === tableName ? "text-[#007acc]" : "text-secondary")} />
                                    <span className="text-[13px] truncate">{tableName}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* + Table Button */}
                    <div className="px-4 py-1.5 pl-10 mt-1">
                        <button
                            onClick={() => setShowCreateTableModal(true)}
                            className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-secondary hover:text-white hover:bg-[#333333] transition-colors rounded"
                            title="Create a new table"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            New Table
                        </button>
                    </div>
                </div>
            </div>
            <CreateTableModal isOpen={showCreateTableModal} onClose={() => setShowCreateTableModal(false)} />
        </div>
    );
};

export default DatabaseExplorer;
