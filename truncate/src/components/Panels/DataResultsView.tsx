import React from 'react';
import { useDatabaseStore, TablePreview } from '../../store/databaseStore';
import { Loader2, AlertCircle, Table as TableIcon } from 'lucide-react';
import ResultSetTable from './ResultSetTable';

const DataResultsView: React.FC = () => {
    const { previewState, previewData, previewError } = useDatabaseStore();

    // 1. Idle State
    if (previewState === 'idle') {
        return (
            <div className="flex flex-col h-full items-center justify-center text-secondary select-none bg-[#1f1f1f]">
                <div className="flex flex-col items-center max-w-sm text-center">
                    <div className="w-16 h-16 bg-[#2d2d2d] rounded-full flex items-center justify-center mb-4 text-gray-600">
                        <TableIcon className="w-8 h-8 opacity-50" />
                    </div>
                    <h3 className="text-gray-300 font-medium mb-1">No Data Selected</h3>
                    <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
                        Select a table from the <span className="text-blue-400">Explorer</span> to view its contents, or run a query below.
                    </p>
                </div>
            </div>
        );
    }

    // 2. Loading State
    if (previewState === 'loading') {
        return (
            <div className="flex flex-col h-full items-center justify-center text-secondary select-none">
                <Loader2 className="w-6 h-6 mb-3 animate-spin text-blue-500" />
                <p className="text-sm text-gray-400">Running query…</p>
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
                <div className="flex flex-col h-full bg-editor-bg">
                    {/* Status Banner */}
                    <div className="h-8 bg-green-500/10 border-b border-green-500/20 flex items-center px-4 justify-between animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center text-xs text-green-400 font-medium">
                            <span className="mr-2">✔</span>
                            Query executed successfully
                        </div>
                        {previewData.executionDuration !== undefined && (
                            <span className="text-[10px] uppercase tracking-wider text-green-500/60 font-mono">
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
                <div className="flex flex-col h-full">
                    {/* Status Header */}
                    <div className="h-8 border-b border-subtle flex items-center px-3 justify-between bg-editor-bg shrink-0">
                        <div className="flex items-center text-xs text-green-400">
                            <span className="mr-2">✔</span>
                            <span className="font-medium">Query executed successfully</span>
                        </div>
                        {previewData.executionDuration !== undefined && (
                            <div className="flex items-center space-x-3">
                                <span className="text-[10px] uppercase tracking-wider text-green-500/50 font-mono">
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
