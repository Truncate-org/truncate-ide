import React, { useState } from 'react';
import { useDatabaseStore } from '../../store/databaseStore';
import { Loader2, AlertCircle } from 'lucide-react';

export const ConnectionCard: React.FC = () => {
    const { connectServer, isConnecting, connectionError } = useDatabaseStore();

    // Default values
    const [dbType, setDbType] = useState('mysql');
    const [form, setForm] = useState({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: ''
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await connectServer(dbType, form.host, form.port, form.user, form.password);
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
                    <div className="flex bg-[#1e1e1e] border border-[#3e3e3e] rounded p-0.5">
                        <button
                            type="button"
                            onClick={() => handleTypeChange('mysql')}
                            className={`flex-1 text-xs py-1 rounded transition-colors ${dbType === 'mysql' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                        >
                            MySQL
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTypeChange('postgres')}
                            className={`flex-1 text-xs py-1 rounded transition-colors ${dbType === 'postgres' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                        >
                            PostgreSQL
                        </button>
                    </div>
                </div>

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

                {connectionError && (
                    <div className="bg-red-900/20 border border-red-800/50 text-red-200 p-2 rounded text-xs flex items-start gap-1.5 break-all">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{connectionError}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isConnecting}
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
