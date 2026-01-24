import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface TablePreview {
    columns: string[];
    rows: string[][];
}

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

    // Data State
    tableData: TablePreview | null;
    isLoadingData: boolean;
    dataError: string | null;

    // Actions
    connectServer: (host: string, port: number, user: string, pass: string) => Promise<void>;
    selectDatabase: (dbName: string) => Promise<void>;
    selectTable: (dbName: string, tableName: string) => Promise<void>;
    closeDatabase: () => void;
    disconnect: () => void;
}

export const useDatabaseStore = create<DatabaseStore>((set) => ({
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    connectionUser: null,

    databases: [],
    activeDatabase: null,
    tables: [],
    activeTable: null,

    tableData: null,
    isLoadingData: false,
    dataError: null,

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
        set({ activeDatabase: dbName, tables: [], activeTable: null, tableData: null });
        try {
            await invoke('mysql_select_database', { databaseName: dbName });
            const tables = await invoke<string[]>('mysql_list_tables', {});
            set({ tables });
        } catch (error: any) {
            console.error("Failed to select DB:", error);
            // We don't reset activeDatabase immediately to allow retries or show error in UI?
            // But valid flow implies we should probably properly handle this.
        }
    },

    selectTable: async (dbName, tableName) => {
        set({ activeTable: tableName, isLoadingData: true, dataError: null });
        try {
            const data = await invoke<TablePreview>('mysql_preview_table', { databaseName: dbName, tableName });
            set({ tableData: data, isLoadingData: false });
        } catch (error: any) {
            set({
                dataError: error.toString(),
                isLoadingData: false,
                tableData: null
            });
        }
    },

    closeDatabase: () => {
        set({
            activeDatabase: null,
            tables: [],
            activeTable: null,
            tableData: null
        });
    },

    disconnect: () => {
        set({
            isConnected: false,
            databases: [],
            activeDatabase: null,
            tables: [],
            activeTable: null,
            tableData: null,
            connectionUser: null
        });
    }
}));
