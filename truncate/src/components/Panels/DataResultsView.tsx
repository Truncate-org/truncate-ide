import React from 'react';
import { useDatabaseStore } from '../../store/databaseStore';
import { Loader2, AlertCircle, Table as TableIcon } from 'lucide-react';

const DataResultsView: React.FC = () => {
    const { activeTable, tableData, isLoadingData, dataError } = useDatabaseStore();

    if (!activeTable) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-secondary select-none">
                <TableIcon className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a table to view data</p>
            </div>
        );
    }

    if (isLoadingData) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-secondary select-none">
                <Loader2 className="w-8 h-8 mb-4 animate-spin text-blue-500" />
                <p>Loading data for {activeTable}...</p>
            </div>
        );
    }

    if (dataError) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-red-400 select-none p-4 text-center">
                <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-semibold mb-2">Error loading data</p>
                <p className="text-sm opacity-80">{dataError}</p>
            </div>
        );
    }

    if (!tableData || tableData.columns.length === 0) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-secondary select-none">
                <p>Table is empty or no data returned.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="h-10 border-b border-subtle flex items-center px-4 font-semibold text-primary select-none bg-surface-secondary">
                <TableIcon className="w-4 h-4 mr-2" />
                Preview: {activeTable}
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
                                        title={cell} // Tooltip for long content
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
};

export default DataResultsView;
