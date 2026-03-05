import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useUiStore } from '../../store/uiStore';
import { useDatabaseStore } from '../../store/databaseStore';
import { Loader2, Sparkles } from 'lucide-react';
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
    const { showDataAudit } = useUiStore();
    const { tables, activeTable } = useDatabaseStore();
    const [tableName, setTableName] = useState('');
    const [profile, setProfile] = useState<TableProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

    // Sync tableName with activeTable
    React.useEffect(() => {
        if (activeTable) {
            setTableName(activeTable);
        } else if (tables.length > 0 && !tableName) {
            setTableName(tables[0]);
        }
    }, [activeTable, tables]);

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
        <div className="flex flex-col h-full bg-panel text-primary border-l border-subtle font-sans">

            {/* Controls */}
            <div className="p-3 flex flex-col gap-3 border-b border-subtle">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <select
                            className="w-full bg-[#3c3c3c] border border-subtle rounded-sm px-2 py-1 text-[11px] h-[26px] focus:outline-none focus:border-[#007acc] text-[#cccccc] appearance-none"
                            value={tableName}
                            onChange={(e) => setTableName(e.target.value)}
                        >
                            <option value="" disabled>Select Table</option>
                            {tables.map((t: string) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    <button
                        onClick={runProfile}
                        disabled={loading || !tableName}
                        className="bg-[#007acc] hover:bg-[#005f9e] text-white px-3 py-1 rounded-sm text-[11px] font-medium disabled:opacity-50 flex items-center gap-1 transition-colors h-[26px]"
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
                            <div className="bg-[#2d2d2d] p-3 rounded-sm border border-subtle">
                                <div className="text-[10px] text-secondary uppercase font-semibold">Total Rows</div>
                                <div className="text-lg font-bold text-primary">{profile.row_count}</div>
                            </div>
                            <div className={clsx("p-3 rounded-sm border", profile.duplicates_count > 0 ? "bg-red-500/10 border-red-500/50" : "bg-[#2d2d2d] border-subtle")}>
                                <div className="text-[10px] text-secondary uppercase font-semibold">Duplicates</div>
                                <div className={clsx("text-lg font-bold", profile.duplicates_count > 0 ? "text-[#f14c4c]" : "text-primary")}>
                                    {profile.duplicates_count}
                                </div>
                            </div>
                        </div>

                        {/* Columns List */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-bold text-secondary uppercase tracking-wider">Columns Analysis</h3>
                            {profile.columns.map(col => (
                                <div key={col.name} className="bg-[#2d2d2d] rounded-sm border border-subtle p-3 text-[11px]">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="font-medium text-[#4fc1ff]">{col.name}</div>
                                        <div className="text-[9px] bg-[#3c3c3c] border border-subtle px-1.5 py-0.5 rounded-sm text-secondary uppercase">{col.inferred_type}</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-[10px] text-secondary">
                                        <div className="flex justify-between">
                                            <span>Nulls:</span>
                                            <span className={col.null_percentage > 0 ? "text-[#cca700]" : "text-primary"}>
                                                {col.null_count} ({col.null_percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Distinct:</span>
                                            <span className="text-primary">{col.distinct_count}</span>
                                        </div>
                                        {col.outliers_count > 0 && (
                                            <div className="col-span-2 flex justify-between text-[#f14c4c]">
                                                <span>Outliers (Z&gt;3):</span>
                                                <span>{col.outliers_count}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* AI Section */}
                        <div className="pt-4 border-t border-subtle">
                            {!aiSuggestion ? (
                                <button
                                    onClick={askAi}
                                    disabled={aiLoading}
                                    className="w-full bg-[#0E639C] hover:bg-[#1177BB] text-white py-1.5 rounded-sm flex items-center justify-center gap-2 text-[11px] font-medium transition-colors"
                                >
                                    {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5" /> Ask AI for Cleaning Strategy</>}
                                </button>
                            ) : (
                                <div className="bg-[#252526] border border-[#0E639C] rounded-sm p-3">
                                    <div className="flex items-center gap-2 mb-2 text-[#4fc1ff]">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-wide">AI Suggestions</span>
                                    </div>
                                    <pre className="text-[11px] whitespace-pre-wrap font-mono text-[#cccccc]">
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
