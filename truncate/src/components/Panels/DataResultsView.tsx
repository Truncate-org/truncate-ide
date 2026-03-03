import React from 'react';
import { useDatabaseStore, TablePreview } from '../../store/databaseStore';
import { Loader2, AlertCircle, Table as TableIcon } from 'lucide-react';
import ResultSetTable from './ResultSetTable';

const DataResultsView: React.FC = () => {
    const { previewState, previewData, previewError } = useDatabaseStore();

    // 1. Idle State
    if (previewState === 'idle') {
        return (
            <div className="flex flex-col h-full items-center justify-center text-secondary select-none bg-app">
                <div className="flex flex-col items-center max-w-sm text-center">
                    <TableIcon className="w-12 h-12 mb-4 text-[#3c3c3c]" strokeWidth={1} />
                    <h3 className="text-[#cccccc] font-medium mb-1">No Data Selected</h3>
                    <p className="text-[13px] text-secondary leading-relaxed max-w-[200px]">
                        Select a table from the Explorer to view its contents, or run a query.
                    </p>
                </div>
            </div>
        );
    }

    // 2. Loading State
    if (previewState === 'loading') {
        return (
            <div className="flex flex-col h-full items-center justify-center text-secondary select-none bg-app">
                <Loader2 className="w-6 h-6 mb-3 animate-spin text-[#007acc]" />
                <p className="text-[13px] text-secondary">Running query…</p>
            </div>
        );
    }

    // 3. Error State
    if (previewState === 'error') {
        return (
            <div className="flex flex-col h-full items-center justify-center text-red-400 select-none p-4 text-center">
                <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-semibold mb-2">Error</p>
                <p className="text-sm opacity-80">{previewError || "Unknown error occurred"}</p>
            </div>
        );
    }

    // 4. Result State
    if (previewState === 'result' && previewData) {
        // Case A: Success Message (Non-row result)
        if (previewData.type === 'Success') {
            return (
                <div className="flex flex-col h-full bg-app">
                    {/* Status Banner */}
                    <div className="h-8 bg-[#1e1e1e] border-b border-subtle flex items-center px-4 justify-between animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center text-[12px] text-[#89d185]">
                            <span className="mr-2">✔</span>
                            Query executed successfully
                        </div>
                        {previewData.executionDuration !== undefined && (
                            <span className="text-[11px] uppercase tracking-wider text-secondary font-mono">
                                {previewData.executionDuration}ms
                            </span>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
                        <div className="p-4 rounded-lg bg-surface-secondary/50 border border-subtle/50 mb-4 max-w-md">
                            <p className="text-sm text-secondary font-mono">{previewData.data as string}</p>
                        </div>
                    </div>
                </div>
            );
        }

        // Case B: Table Result
        if (previewData.type === 'ResultSet') {
            const tableData = previewData.data as TablePreview;

            if (tableData.columns.length === 0) {
                return (
                    <div className="flex flex-col h-full items-center justify-center text-secondary select-none">
                        <p>Query returned no data.</p>
                    </div>
                );
            }

            return (
                <div className="flex flex-col h-full bg-app">
                    {/* Status Header */}
                    <div className="h-8 border-b border-subtle flex items-center px-3 justify-between bg-[#1e1e1e] shrink-0">
                        <div className="flex items-center text-[12px] text-[#89d185]">
                            <span className="mr-2">✔</span>
                            <span>Query executed successfully</span>
                        </div>
                        {previewData.executionDuration !== undefined && (
                            <div className="flex items-center space-x-3">
                                <span className="text-[11px] uppercase tracking-wider text-secondary font-mono">
                                    {previewData.executionDuration}ms
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Responsive Table */}
                    <ResultSetTable data={tableData} />
                </div>
            );
        }
    }

    // Fallback? Should not happen if state machine is correct.
    return null;
};

export default DataResultsView;
