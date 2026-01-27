import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface TablePreview {
    columns: string[];
    rows: string[][];
    limited?: boolean;
}

export interface QueryResult {
    type: 'ResultSet' | 'Success';
    data: TablePreview | string;
    executionDuration?: number;
}

const stripSqlComments = (sql: string): string => {
    // Basic stripping (improve with parser if needed later)
    return sql
        .replace(/--.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .trim();
};

export type PreviewState = 'idle' | 'loading' | 'result' | 'error';
export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ACTIVE';

interface DatabaseStore {
    // Connection State
    isConnected: boolean;
    isConnecting: boolean;
    connectionError: string | null;
    connectionUser: string | null;
    connectionType: 'mysql' | 'postgres' | null;
    connectionStatus: ConnectionStatus;

    // Schema State
    databases: string[];
    activeDatabase: string | null;
    tables: string[];
    activeTable: string | null;

    // Preview / Data State
    previewState: PreviewState;
    previewData: QueryResult | null;
    previewError: string | null;

    // Actions
    connectServer: (dbType: string, host: string, port: number, user: string, pass: string) => Promise<void>;
    selectDatabase: (dbName: string) => Promise<void>;
    selectTable: (dbName: string, tableName: string) => Promise<void>;
    runQuery: (sql: string) => Promise<void>;
    closeDatabase: () => void;
    disconnect: () => void;

    // Export State
    exportState: 'idle' | 'loading' | 'success' | 'error';
    exportResult: ExportResult | null;
    exportSchema: () => Promise<void>;
    clearExportStatus: () => void;
    refreshDatabases: () => Promise<void>;
    refreshTables: () => Promise<void>;

    // Internal
    initializeListeners: () => void;
}

export interface ExportResult {
    success: boolean;
    json_path: string;
    dot_path: string;
    markdown_path: string;
    export_dir: string;
    svg_path?: string;
    message: string;
}

export const useDatabaseStore = create<DatabaseStore>((set, get) => ({
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    connectionUser: null,
    connectionType: null,
    connectionStatus: 'DISCONNECTED',

    databases: [],
    activeDatabase: null,
    tables: [],
    activeTable: null,

    previewState: 'idle',
    previewData: null,
    previewError: null,

    exportState: 'idle',
    exportResult: null,

    initializeListeners: () => {
        // Listen for backend db-switched events
        listen<string>('db-switched', async (event) => {
            const dbName = event.payload;
            const currentActive = get().activeDatabase;

            // Only update if different to avoid redundant fetches if triggered by UI
            if (dbName !== currentActive) {
                console.log(`[Store] DB Sync Event: Switched to ${dbName}`);
                // Update active DB state and reset preview
                set({
                    activeDatabase: dbName,
                    activeTable: null,
                    previewState: 'idle',
                    previewData: null,
                    previewError: null,
                    exportState: 'idle'
                });
                // Fetch tables for the new DB
                try {
                    const tables = await invoke<string[]>('list_tables', {});
                    set({ tables });
                } catch (e) {
                    console.error("Failed to fetch tables after sync:", e);
                }
            }
        });
    },

    connectServer: async (dbType, host, port, user, pass) => {
        set({ isConnecting: true, connectionError: null });
        try {
            const databases = await invoke<string[]>('connect_server', { dbType, host, port, user, pass });
            set({
                isConnected: true,
                databases,
                isConnecting: false,
                connectionUser: user,
                connectionType: dbType as 'mysql' | 'postgres',
                connectionStatus: 'CONNECTED' // Base connection established, but no DB active yet
            });
            get().initializeListeners(); // Start listening
        } catch (error: any) {
            set({
                connectionError: error.toString(),
                isConnecting: false,
                isConnected: false
            });
            throw error;
        }
    },

    selectDatabase: async (dbName) => {
        // Strict Check: active connecting must exist
        const { connectionStatus, isConnected } = get();
        if (!isConnected) {
            console.warn("Attempted to select database without connection");
            return;
        }

        // Reset preview on DB switch (Optimistic UI update for VIEW ports only, NOT connection state)
        set({
            tables: [],
            activeTable: null,
            previewState: 'idle',
            previewData: null,
            previewError: null,
            exportState: 'idle',
            exportResult: null
        });

        try {
            // BACKEND FIRST: Switch the actual connection context
            await invoke('select_database', { databaseName: dbName });

            // THEN: Update state to ACTIVE. 
            // This ensures TerminalPanel seeing 'activeDatabase' implies backend is ready.
            const tables = await invoke<string[]>('list_tables', {});

            set({
                activeDatabase: dbName,
                tables,
                connectionStatus: 'ACTIVE'
            });
        } catch (error: any) {
            console.error("Failed to select DB:", error);
            set({ previewState: 'error', previewError: error.toString() });
        }
    },

    selectTable: async (dbName, tableName) => {
        set({
            activeTable: tableName,
            previewState: 'loading',
            previewError: null
        });

        try {
            // Re-use preview_table but treat it as a query result
            const data = await invoke<TablePreview>('preview_table', { databaseName: dbName, tableName });

            set({
                previewState: 'result',
                previewData: { type: 'ResultSet', data }
            });
        } catch (error: any) {
            set({
                previewState: 'error',
                previewError: error.toString(),
                previewData: null
            });
        }
    },

    runQuery: async (sql) => {
        set({
            previewState: 'loading',
            previewError: null,
            activeTable: null // clear active table highlight for custom query
        });

        // 1. Strip comments
        const cleanSql = stripSqlComments(sql);

        // 2. Check if empty
        if (!cleanSql) {
            set({
                previewState: 'result',
                previewData: {
                    type: 'Success',
                    data: 'No executable SQL found.',
                    executionDuration: 0
                }
            });
            return;
        }

        const startTime = performance.now();

        try {
            const result = await invoke<QueryResult>('sql_run_query', { sql: cleanSql });
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);

            // Inject duration into result (hacky since backend doesn't return it yet, but effective)
            result.executionDuration = duration;

            set({
                previewState: 'result',
                previewData: result
            });
        } catch (error: any) {
            set({
                previewState: 'error',
                previewError: error.toString(),
                previewData: null
            });
        }
    },

    closeDatabase: () => {
        set({
            activeDatabase: null,
            connectionStatus: 'CONNECTED', // Downgrade to connected but no DB
            tables: [],
            activeTable: null,
            previewState: 'idle',
            previewData: null,
            previewError: null,
            exportState: 'idle',
            exportResult: null
        });
    },

    disconnect: async () => {
        // 1. Set status first (optimistic)
        set({ connectionStatus: 'DISCONNECTED' });

        try {
            // 2. Kill Backend Terminal PTY
            await invoke('stop_terminal', { id: 'term-1' });
        } catch (e) {
            console.warn("Failed to stop terminal during disconnect", e);
        }

        // 3. Close Database Connection
        try {
            await invoke('disconnect_database');
        } catch (e) {
            console.warn("Failed to disconnect database", e);
        }

        // 4. Wipe Store State
        set({
            isConnected: false,
            databases: [],
            activeDatabase: null,
            tables: [],
            activeTable: null,
            previewState: 'idle',
            previewData: null,
            previewError: null,
            connectionUser: null,
            connectionType: null,
            connectionStatus: 'DISCONNECTED',
            exportState: 'idle',
            exportResult: null
        });
    },

    exportSchema: async () => {
        set({ exportState: 'loading', exportResult: null });
        try {
            const result = await invoke<ExportResult>('export_database_schema');
            set({ exportState: 'success', exportResult: result });
        } catch (error: any) {
            set({
                exportState: 'error', exportResult: {
                    success: false,
                    message: error.toString(),
                    json_path: '',
                    dot_path: '',
                    markdown_path: '',
                    export_dir: ''
                }
            });
        }
    },

    clearExportStatus: () => {
        set({ exportState: 'idle', exportResult: null });
    },

    refreshDatabases: async () => {
        if (!get().isConnected) return;
        try {
            const databases = await invoke<string[]>('refresh_databases');
            // Check if active DB was dropped?
            // If active DB is not in new list, maybe deselect it?
            // For now, simple list update is safer.
            set({ databases });
        } catch (error) {
            console.error("[Store] Failed to refresh databases:", error);
        }
    },

    refreshTables: async () => {
        const { isConnected, activeDatabase } = get();
        if (!isConnected || !activeDatabase) return;

        try {
            // We reuse the existing list_tables command which uses the active connection state
            const tables = await invoke<string[]>('list_tables');
            set({ tables });
        } catch (error) {
            console.error("[Store] Failed to refresh tables:", error);
        }
    }
}));

