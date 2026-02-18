import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useUiStore } from '../../store/uiStore';
import { Loader2, Sparkles, Database } from 'lucide-react';
import clsx from 'clsx';

// Types (Mirroring Backend)
interface ColumnProfile {
    name: string;
    total_rows: number;
    null_count: number;
    null_percentage: number;
    distinct_count: number;
    inferred_type: string;
    min?: string;
    max?: string;
    mean?: number;
    std_dev?: number;
    outliers_count: number;
}

interface TableProfile {
    table_name: string;
    row_count: number;
    columns: ColumnProfile[];
    duplicates_count: number;
}

export const DataAuditPanel: React.FC = () => {
    const { showDataAudit, toggleDataAudit } = useUiStore();
    const [tableName, setTableName] = useState('');
    const [profile, setProfile] = useState<TableProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

    if (!showDataAudit) return null;

    const runProfile = async () => {
        if (!tableName) return;
        setLoading(true);
        setProfile(null);
        setAiSuggestion(null);
        try {
            const result = await invoke<TableProfile>('run_data_profiling', { tableName });
            setProfile(result);
        } catch (e) {
            console.error(e);
            alert('Failed to profile table: ' + e);
        } finally {
            setLoading(false);
        }
    };

    const askAi = async () => {
        if (!profile) return;
        setAiLoading(true);
        try {
            const json = JSON.stringify(profile, null, 2);
            const result = await invoke<string>('ask_audit_ai', { profileJson: json });
            setAiSuggestion(result);
        } catch (e) {
            console.error(e);
            alert('AI Failed: ' + e);
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-gray-200 border-l border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    <h2 className="font-semibold text-sm tracking-wider">DATA AUDIT</h2>
                </div>
                <button onClick={toggleDataAudit} className="text-xs hover:text-white">✕</button>
            </div>

            {/* Controls */}
            <div className="p-4 flex flex-col gap-3 border-b border-white/10">
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Table Name"
                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:border-purple-500"
                        value={tableName}
                        onChange={(e) => setTableName(e.target.value)}
                    />
                    <button
                        onClick={runProfile}
                        disabled={loading || !tableName}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'RUN'}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-6">
                {profile && (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white/5 p-3 rounded border border-white/5">
                                <div className="text-xs text-gray-400">Total Rows</div>
                                <div className="text-xl font-bold">{profile.row_count}</div>
                            </div>
                            <div className={clsx("p-3 rounded border", profile.duplicates_count > 0 ? "bg-red-500/10 border-red-500/50" : "bg-white/5 border-white/5")}>
                                <div className="text-xs text-gray-400">Duplicates</div>
                                <div className={clsx("text-xl font-bold", profile.duplicates_count > 0 ? "text-red-400" : "text-gray-200")}>
                                    {profile.duplicates_count}
                                </div>
                            </div>
                        </div>

                        {/* Columns List */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-gray-500 uppercase">Columns Analysis</h3>
                            {profile.columns.map(col => (
                                <div key={col.name} className="bg-white/5 rounded border border-white/5 p-3 text-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-medium text-purple-300">{col.name}</div>
                                        <div className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400">{col.inferred_type}</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs text-gray-400">
                                        <div className="flex justify-between">
                                            <span>Nulls:</span>
                                            <span className={col.null_percentage > 0 ? "text-yellow-500" : ""}>
                                                {col.null_count} ({col.null_percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Distinct:</span>
                                            <span>{col.distinct_count}</span>
                                        </div>
                                        {col.outliers_count > 0 && (
                                            <div className="col-span-2 flex justify-between text-red-400">
                                                <span>Outliers (Z&gt;3):</span>
                                                <span>{col.outliers_count}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* AI Section */}
                        <div className="pt-4 border-t border-white/10">
                            {!aiSuggestion ? (
                                <button
                                    onClick={askAi}
                                    disabled={aiLoading}
                                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white py-2 rounded flex items-center justify-center gap-2 text-sm font-medium"
                                >
                                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Ask AI for Cleaning Strategy</>}
                                </button>
                            ) : (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                                    <div className="flex items-center gap-2 mb-2 text-blue-400">
                                        <Sparkles className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase">AI Suggestions</span>
                                    </div>
                                    <pre className="text-xs whitespace-pre-wrap font-mono text-blue-200">
                                        {aiSuggestion}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </>
                )}
                {!profile && !loading && (
                    <div className="text-center text-gray-600 text-sm py-10">
                        Select a table to run audit.
                    </div>
                )}
            </div>
        </div>
    );
};
