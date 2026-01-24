import React from 'react';
import { useDatabaseStore, TablePreview } from '../../store/databaseStore';
import { Loader2, AlertCircle, Table as TableIcon } from 'lucide-react';

const DataResultsView: React.FC = () => {
    const { previewState, previewData, previewError, activeTable } = useDatabaseStore();

    // 1. Idle State
    if (previewState === 'idle') {
        return (
            <div className="flex flex-col h-full items-center justify-center text-secondary select-none">
                <TableIcon className="w-8 h-8 mb-3 opacity-10" />
                <p className="text-xs text-gray-500">Select a table or run a query</p>
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
                <div className="flex flex-col h-full items-center justify-center text-green-400 select-none p-4 text-center">
                    <p className="font-semibold mb-2">Success</p>
                    <p className="text-sm opacity-80">{previewData.data as string}</p>
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
                    <div className="h-10 border-b border-subtle flex items-center px-4 font-semibold text-primary select-none bg-surface-secondary justify-between">
                        <div className="flex items-center">
                            <TableIcon className="w-4 h-4 mr-2" />
                            Preview: {activeTable || 'Query Result'}
                        </div>
                        {tableData.limited && (
                            <span className="text-[10px] uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                Result limited to 1000 rows
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-auto bg-editor-bg">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-surface-secondary sticky top-0 z-10">
                                <tr>
                                    {tableData.columns.map((col, idx) => (
                                        <th
                                            key={idx}
                                            className="px-4 py-2 text-xs font-semibold text-secondary border-b border-r border-[#3e3e3e] whitespace-nowrap bg-[#252526]"
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-sm text-primary font-mono">
                                {tableData.rows.map((row, rowIdx) => (
                                    <tr key={rowIdx} className="hover:bg-[#2a2d2e] transition-colors">
                                        {row.map((cell, cellIdx) => (
                                            <td
                                                key={cellIdx}
                                                className="px-4 py-1.5 border-b border-r border-[#3e3e3e] whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]"
                                                title={cell}
                                            >
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-2 text-xs text-secondary border-t border-[#3e3e3e]">
                            Showing first {tableData.rows.length} rows
                        </div>
                    </div>
                </div>
            );
        }
    }

    // Fallback? Should not happen if state machine is correct.
    return null;
};

export default DataResultsView;
