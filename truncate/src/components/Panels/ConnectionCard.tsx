import React, { useState } from 'react';
import { useDatabaseStore } from '../../store/databaseStore';
import { Loader2, AlertCircle, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

export const ConnectionCard: React.FC = () => {
    const { connectServer, isConnecting, connectionError } = useDatabaseStore();

    // Default values
    const [dbType, setDbType] = useState('mysql');
    const [form, setForm] = useState({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        filePath: '' // New field for SQLite
    });

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
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'SQLite Database',
                    extensions: ['db', 'sqlite', 'sqlite3', 'db3', 's3db', 'sl3']
                }, {
                    name: 'All Files',
                    extensions: ['*']
                }]
            });
            if (selected) {
                // The open dialog returns string if multiple=false, or null
                // Wait, check types. It returns string | string[] | null.
                // With multiple: false, it returns string | null.
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
        // If sqlite, pass filePath as host (hacky but fits existing signature)
        if (dbType === 'sqlite') {
            if (!form.filePath) return;
            // connectServer signature: (dbType, host, port, user, pass)
            // We pass empty port/user/pass for sqlite
            await connectServer(dbType, form.filePath, 0, '', '');
        } else {
            await connectServer(dbType, form.host, form.port, form.user, form.password);
        }
    };

    const handleChange = (field: keyof typeof form, value: string | number) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">No active connection</div>

            <form onSubmit={handleSubmit} className="bg-[#252526] rounded border border-[#3e3e3e] p-3 space-y-3">

                {/* Connection Type */}
                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-gray-500 font-semibold">Database Type</label>
                    <div className="relative">
                        <select
                            value={dbType}
                            onChange={(e) => handleTypeChange(e.target.value)}
                            className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-1.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-none appearance-none cursor-pointer"
                        >
                            <option value="mysql">MySQL</option>
                            <option value="postgres">PostgreSQL</option>
                            <option value="sqlite">SQLite</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {dbType === 'sqlite' ? (
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-gray-500 font-semibold">Database File</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={form.filePath}
                                className="flex-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none cursor-not-allowed opacity-70"
                                placeholder="Select a .db or .sqlite file"
                            />
                            <button
                                type="button"
                                onClick={handleFilePick}
                                className="bg-[#3e3e3e] hover:bg-[#4e4e4e] text-white px-3 rounded flex items-center justify-center transition-colors"
                            >
                                <FolderOpen className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Host */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-gray-500 font-semibold">Host</label>
                            <input
                                type="text"
                                value={form.host}
                                onChange={e => handleChange('host', e.target.value)}
                                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-1 text-xs text-gray-300 focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder="localhost"
                            />
                        </div>

                        {/* Port */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-gray-500 font-semibold">Port</label>
                            <input
                                type="number"
                                value={form.port}
                                onChange={e => handleChange('port', parseInt(e.target.value) || 0)}
                                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-1 text-xs text-gray-300 focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder={dbType === 'mysql' ? "3306" : "5432"}
                            />
                        </div>

                        {/* User */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-gray-500 font-semibold">User</label>
                            <input
                                type="text"
                                value={form.user}
                                onChange={e => handleChange('user', e.target.value)}
                                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-1 text-xs text-gray-300 focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder={dbType === 'mysql' ? "root" : "postgres"}
                            />
                        </div>

                        {/* Password is masked */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-gray-500 font-semibold">Password</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={e => handleChange('password', e.target.value)}
                                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-1 text-xs text-gray-300 focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                    </>
                )}

                {connectionError && (
                    <div className="bg-red-900/20 border border-red-800/50 text-red-200 p-2 rounded text-xs flex items-start gap-1.5 break-all">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{connectionError}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isConnecting || (dbType === 'sqlite' && !form.filePath)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-1.5 rounded text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isConnecting ? (
                        <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Connecting...
                        </>
                    ) : (
                        '[ Connect ]'
                    )}
                </button>
            </form>
        </div>
    );
};
