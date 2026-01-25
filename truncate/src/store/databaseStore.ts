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

interface DatabaseStore {
    // Connection State
    isConnected: boolean;
    isConnecting: boolean;
    connectionError: string | null;
    connectionUser: string | null;

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
    connectServer: (host: string, port: number, user: string, pass: string) => Promise<void>;
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
                    const tables = await invoke<string[]>('mysql_list_tables', {});
                    set({ tables });
                } catch (e) {
                    console.error("Failed to fetch tables after sync:", e);
                }
            }
        });
    },

    connectServer: async (host, port, user, pass) => {
        set({ isConnecting: true, connectionError: null });
        try {
            const databases = await invoke<string[]>('mysql_connect_server', { host, port, user, pass });
            set({
                isConnected: true,
                databases,
                isConnecting: false,
                connectionUser: user
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
        // Reset preview on DB switch
        set({
            activeDatabase: dbName,
            tables: [],
            activeTable: null,
            previewState: 'idle',
            previewData: null,
            previewError: null,
            exportState: 'idle',
            exportResult: null
        });

        try {
            await invoke('mysql_select_database', { databaseName: dbName });
            const tables = await invoke<string[]>('mysql_list_tables', {});
            set({ tables });
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
            // Re-use mysql_preview_table but treat it as a query result
            const data = await invoke<TablePreview>('mysql_preview_table', { databaseName: dbName, tableName });

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
        invoke('sql_disconnect_database').catch(() => { });
        set({
            activeDatabase: null,
            tables: [],
            activeTable: null,
            previewState: 'idle',
            previewData: null,
            previewError: null,
            exportState: 'idle',
            exportResult: null
        });
    },

    disconnect: () => {
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
    }
}));

