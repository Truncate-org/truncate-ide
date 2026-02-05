import React, { useState } from 'react';
import { useDatabaseStore, CsvInspection } from '../../store/databaseStore';
import { Loader2, AlertCircle, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { CsvPreviewModal } from '../Modals/CsvPreviewModal';

export const ConnectionCard: React.FC = () => {
    const { connectServer, isConnecting, connectionError, inspectCsv } = useDatabaseStore();

    // Default values
    const [dbType, setDbType] = useState('mysql');
    const [form, setForm] = useState({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        filePath: '' // New field for SQLite/CSV
    });

    const [showCsvModal, setShowCsvModal] = useState(false);
    const [csvInspection, setCsvInspection] = useState<CsvInspection | null>(null);

    const handleTypeChange = (newType: string) => {
        setDbType(newType);
        // Auto-update port if user hasn't manually messed with it too much (simple heuristic or just reset)
        if (newType === 'mysql') setForm(prev => ({ ...prev, port: 3306 }));
        if (newType === 'postgres') setForm(prev => ({ ...prev, port: 5432 }));
        // Reset user default if changing type
        if (newType === 'postgres' && form.user === 'root') setForm(prev => ({ ...prev, user: 'postgres' }));
        if (newType === 'mysql' && form.user === 'postgres') setForm(prev => ({ ...prev, user: 'root' }));
    };

    const handleFilePick = async () => {
        try {
            const filters = dbType === 'csv' ? [{
                name: 'CSV Files',
                extensions: ['csv', 'tsv', 'tab', 'txt']
            }, {
                name: 'All Files',
                extensions: ['*']
            }] : [{
                name: 'SQLite Database',
                extensions: ['db', 'sqlite', 'sqlite3', 'db3', 's3db', 'sl3']
            }, {
                name: 'All Files',
                extensions: ['*']
            }];

            const selected = await open({
                multiple: false,
                filters: filters
            });

            if (selected) {
                if (typeof selected === 'string') {
                    setForm(prev => ({ ...prev, filePath: selected }));
                }
            }
        } catch (e) {
            console.error("Failed to open file picker", e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (dbType === 'sqlite') {
            if (!form.filePath) return;
            await connectServer(dbType, form.filePath, 0, '', '');
        } else if (dbType === 'csv') {
            if (!form.filePath) return;
            // Inspect first
            try {
                // We don't have a loading state for inspection specifically, but we can reuse isConnecting or local
                // But connectServer sets isConnecting globally.
                // Let's use local state or just optimistic UI.
                // Or call store action? But store doesn't have inspection state.
                const data = await inspectCsv(form.filePath);
                setCsvInspection(data);
                setShowCsvModal(true);
            } catch (e) {
                console.error("CSV Inspection failed", e);
                // Show error somehow? Maybe alert or toast. 
                // For now, let's use connectionError if we can inject it? No, store has it.
                // We'll just alert for now or set error in UI.
                alert(`Failed to inspect CSV: ${e}`);
            }
        } else {
            await connectServer(dbType, form.host, form.port, form.user, form.password);
        }
    };

    const handleCsvConfirm = async (config: any) => {
        try {
            // Pass config JSON as user field (hacky but standard)
            await connectServer('csv', form.filePath, 0, JSON.stringify(config), '');
            setShowCsvModal(false);
        } catch (e) {
            console.error("Failed to connect CSV", e);
            // Error is handled in store, shown in UI
        }
    };

    const handleChange = (field: keyof typeof form, value: string | number) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="flex flex-col h-full">
            <form onSubmit={handleSubmit} className="space-y-4 p-3">

                {/* Connection Type */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-gray-400 font-medium">Database Type</label>
                    <div className="relative">
                        <select
                            value={dbType}
                            onChange={(e) => handleTypeChange(e.target.value)}
                            className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none appearance-none cursor-pointer transition-colors"
                        >
                            <option value="mysql">MySQL</option>
                            <option value="postgres">PostgreSQL</option>
                            <option value="sqlite">SQLite</option>
                            <option value="csv">CSV File</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {dbType === 'sqlite' || dbType === 'csv' ? (
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-gray-400 font-medium">
                            {dbType === 'csv' ? 'CSV File' : 'Database File'}
                        </label>
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                readOnly
                                value={form.filePath}
                                className="flex-1 min-w-0 bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-sm text-gray-300 focus:outline-none truncate"
                                placeholder={dbType === 'csv' ? "Select .csv or .tsv file" : "Select a .db or .sqlite file"}
                            />
                            <button
                                type="button"
                                onClick={handleFilePick}
                                className="w-10 h-10 shrink-0 bg-[#3e3e3e] hover:bg-[#4e4e4e] text-white rounded flex items-center justify-center transition-colors"
                                title="Browse for file"
                            >
                                <FolderOpen className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Host */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400 font-medium">Host</label>
                            <input
                                type="text"
                                value={form.host}
                                onChange={e => handleChange('host', e.target.value)}
                                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder="localhost"
                            />
                        </div>

                        {/* Port */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400 font-medium">Port</label>
                            <input
                                type="number"
                                value={form.port}
                                onChange={e => handleChange('port', parseInt(e.target.value) || 0)}
                                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder={dbType === 'mysql' ? "3306" : "5432"}
                            />
                        </div>

                        {/* User */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400 font-medium">Username</label>
                            <input
                                type="text"
                                value={form.user}
                                onChange={e => handleChange('user', e.target.value)}
                                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder={dbType === 'mysql' ? "root" : "postgres"}
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400 font-medium">Password</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={e => handleChange('password', e.target.value)}
                                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                    </>
                )}

                {connectionError && (
                    <div className="bg-red-900/20 border border-red-800/50 text-red-200 p-3 rounded text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span className="break-all">{connectionError}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isConnecting || ((dbType === 'sqlite' || dbType === 'csv') && !form.filePath)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isConnecting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Connecting...
                        </>
                    ) : (
                        dbType === 'csv' ? 'Preview & Connect' : 'Connect'
                    )}
                </button>
            </form>

            <CsvPreviewModal
                isOpen={showCsvModal}
                onClose={() => setShowCsvModal(false)}
                onConfirm={handleCsvConfirm}
                inspection={csvInspection}
                filePath={form.filePath}
                isConnecting={isConnecting}
            />
        </div>
    );
};
