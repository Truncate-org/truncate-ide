import React, { useState, useMemo, useEffect } from 'react';
import { TablePreview } from '../../store/databaseStore';
import { ArrowUp, ArrowDown, Filter, X, Search } from 'lucide-react';
import { processRows, inferColumnTypes, SortState, FilterState, ColumnType } from '../../utils/dataProcessing';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ResultSetTableProps {
    data: TablePreview;
}

const OPERATORS = {
    string: [
        { value: 'contains', label: 'Contains' },
        { value: 'eq', label: 'Equals' },
        { value: 'starts_with', label: 'Starts with' },
        { value: 'ends_with', label: 'Ends with' },
    ],
    number: [
        { value: 'eq', label: 'Equals' },
        { value: 'gt', label: 'Greater than' },
        { value: 'lt', label: 'Less than' },
        { value: 'between', label: 'Between' },
    ],
    date: [
        { value: 'before', label: 'Before' },
        { value: 'after', label: 'After' },
        { value: 'between', label: 'Between' },
    ],
    boolean: [
        { value: 'eq', label: 'Is' } // Simplification for bool
    ]
};

const ResultSetTable: React.FC<ResultSetTableProps> = ({ data }) => {
    const [sortState, setSortState] = useState<SortState | null>(null);
    const [filterState, setFilterState] = useState<FilterState>({});
    const [globalSearch, setGlobalSearch] = useState('');
    const [activeFilterCol, setActiveFilterCol] = useState<number | null>(null);

    // Reset state when data changes (new query run)
    useEffect(() => {
        setSortState(null);
        setFilterState({});
        setGlobalSearch('');
        setActiveFilterCol(null);
    }, [data.rows]); // Depend on rows reference changing which happens on new query

    // 1. Infer Types (Memoized)
    const columnTypes = useMemo(() => inferColumnTypes(data.rows, data.columns), [data.rows, data.columns]);

    // 2. Process Data (Memoized)
    const visibleRows = useMemo(() => {
        return processRows(data.rows, columnTypes, sortState, filterState, globalSearch);
    }, [data.rows, columnTypes, sortState, filterState, globalSearch]);

    const handleHeaderClick = (colIdx: number) => {
        setSortState(prev => {
            if (prev?.columnIndex === colIdx) {
                if (prev.direction === 'asc') return { columnIndex: colIdx, direction: 'desc' };
                if (prev.direction === 'desc') return null; // Reset
            }
            return { columnIndex: colIdx, direction: 'asc' };
        });
    };

    const toggleFilterMenu = (e: React.MouseEvent, colIdx: number) => {
        e.stopPropagation(); // Prevent sort
        setActiveFilterCol(prev => prev === colIdx ? null : colIdx);
    };

    const updateFilter = (colIdx: number, operator: string, value: string, value2?: string) => {
        setFilterState(prev => {
            const newState = { ...prev };
            if (!value && operator !== 'empty') {
                // Remove filter if value is empty (unless operator is 'is empty' which we didn't implement yet)
                delete newState[colIdx];
                return newState;
            }
            newState[colIdx] = [{ operator, value, value2 }];
            return newState;
        });
        // Keep menu open for refinement or close? Google sheets closes on apply usually or stays open.
        // Let's close for now for cleaner UX or provide a "Close" button.
        // setActiveFilterCol(null); 
    };

    const clearFilter = (colIdx: number) => {
        setFilterState(prev => {
            const newState = { ...prev };
            delete newState[colIdx];
            return newState;
        });
        setActiveFilterCol(null);
    };

    return (
        <div className="flex flex-col h-full bg-editor-bg">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b border-subtle bg-surface-secondary/50">
                <div className="flex items-center flex-1 max-w-sm relative">
                    <Search className="w-4 h-4 absolute left-3 text-secondary opacity-70" />
                    <input
                        type="text"
                        placeholder="Search results..."
                        className="w-full bg-[#1e1e1e] border-none text-sm text-primary pl-9 pr-2 py-1.5 rounded focus:ring-1 focus:ring-blue-500/50 focus:outline-none placeholder-gray-600"
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center text-xs space-x-2 text-secondary ml-4">
                    <span>{visibleRows.length} rows</span>
                    {(visibleRows.length !== data.rows.length) && (
                        <span className="text-amber-500">(Filtered from {data.rows.length})</span>
                    )}
                    {data.limited && (
                        <span className="text-[10px] uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20" title="Query result limited to 1000 rows by backend">
                            Limited
                        </span>
                    )}
                    <button
                        onClick={() => { setFilterState({}); setSortState(null); setGlobalSearch(''); }}
                        className="px-2 py-1 hover:bg-white/10 rounded transition-colors"
                        disabled={!sortState && Object.keys(filterState).length === 0 && !globalSearch}
                    >
                        Reset View
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto relative">
                {visibleRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-20 text-secondary opacity-60">
                        <Filter className="w-8 h-8 mb-2" />
                        <p>No rows match the current filters</p>
                        <button
                            onClick={() => { setFilterState({}); setGlobalSearch(''); }}
                            className="mt-4 text-blue-400 hover:underline text-sm"
                        >
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#252526] sticky top-0 z-20 shadow-sm">
                            <tr>
                                {data.columns.map((col, idx) => {
                                    const isSorted = sortState?.columnIndex === idx;
                                    const isFiltered = !!filterState[idx];
                                    const type = columnTypes[idx];

                                    return (
                                        <th key={idx} className="group relative border-b border-r border-[#3e3e3e] min-w-[120px]">
                                            {/* Header Content */}
                                            <div
                                                className={twMerge(
                                                    "flex items-center justify-between px-4 py-2 text-xs font-semibold text-secondary cursor-pointer hover:bg-[#2a2d2e] select-none h-full transition-colors",
                                                    isSorted && "bg-[#2a2d2e] text-primary"
                                                )}
                                                onClick={() => handleHeaderClick(idx)}
                                            >
                                                <div className="flex items-center truncate mr-2">
                                                    <span className="truncate" title={col}>{col}</span>
                                                </div>

                                                <div className="flex items-center space-x-1 shrink-0">
                                                    {/* Sort Indicator */}
                                                    {isSorted && (
                                                        sortState.direction === 'asc'
                                                            ? <ArrowUp className="w-3 h-3 text-blue-400" />
                                                            : <ArrowDown className="w-3 h-3 text-blue-400" />
                                                    )}

                                                    {/* Filter Trigger */}
                                                    <div
                                                        className={twMerge(
                                                            "p-1 rounded hover:bg-white/10 transition-colors",
                                                            isFiltered ? "text-blue-400 opacity-100" : "opacity-0 group-hover:opacity-50",
                                                            activeFilterCol === idx && "opacity-100 bg-white/10"
                                                        )}
                                                        onClick={(e) => toggleFilterMenu(e, idx)}
                                                    >
                                                        <Filter className={clsx("w-3 h-3", isFiltered && "fill-current")} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Filter Dropdown */}
                                            {activeFilterCol === idx && (
                                                <FilterDropdown
                                                    colIdx={idx}
                                                    type={type}
                                                    currentFilter={filterState[idx]?.[0]}
                                                    onApply={updateFilter}
                                                    onClear={() => clearFilter(idx)}
                                                    onClose={() => setActiveFilterCol(null)}
                                                    alignment={idx < data.columns.length / 2 ? 'left' : 'right'}
                                                />
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="text-sm text-primary font-mono">
                            {visibleRows.map((row, rowIdx) => (
                                <tr key={rowIdx} className="hover:bg-[#2a2d2e] transition-colors group">
                                    {row.map((cell, cellIdx) => (
                                        <td
                                            key={cellIdx}
                                            className="px-4 py-1.5 border-b border-r border-[#3e3e3e] whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]"
                                            title={String(cell)}
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            {/* Dim background helper to close menus? Optional, usually click-outside listener is better */}
            {activeFilterCol !== null && (
                <div className="fixed inset-0 z-10" onClick={() => setActiveFilterCol(null)} />
            )}
        </div>
    );
};

// Filter Dropdown Component
interface FilterDropdownProps {
    colIdx: number;
    type: ColumnType;
    currentFilter?: { operator: string, value: string, value2?: string };
    onApply: (colIdx: number, op: string, val: string, val2?: string) => void;
    onClear: () => void;
    onClose: () => void;
    alignment: 'left' | 'right';
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({ colIdx, type, currentFilter, onApply, onClear, onClose, alignment }) => {
    // Local state for the form
    const [operator, setOperator] = useState(currentFilter?.operator || OPERATORS[type][0].value);
    const [value, setValue] = useState(currentFilter?.value || '');
    const [value2, setValue2] = useState(currentFilter?.value2 || '');

    // Reset when type changes
    useEffect(() => {
        if (!currentFilter) {
            setOperator(OPERATORS[type][0].value);
            setValue('');
            setValue2('');
        }
    }, [type, currentFilter]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onApply(colIdx, operator, value, value2);
        onClose();
    };

    // Determine horizontal alignment based on column index
    // If it's in the first half of columns, align left. Otherwise align right.
    // We need to pass totalColumns to this component or calculate it.
    // But wait, the parent knows. Let's make the parent pass "alignment" or we just infer from colIdx if we had total.
    // Actually, simply checking if colIdx < 3 (arbitrary) or just passing an alignment prop is cleaner.
    // Let's modify the props of FilterDropdown to accept `align: 'left' | 'right'`.

    return (
        <div
            className={twMerge(
                "absolute top-full mt-1 w-72 bg-[#1e1e1e] border border-[#454545] shadow-2xl rounded-lg z-50 flex flex-col font-sans overflow-hidden ring-1 ring-black/20",
                alignment === 'right' ? "right-0" : "left-0"
            )}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-[#3e3e3e]">
                <span className="text-xs font-semibold text-gray-300">Filter by condition</span>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-[#3e3e3e] rounded text-gray-400 hover:text-gray-200 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-3 flex flex-col gap-3">

                {/* Operator Select */}
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider ml-0.5">Condition</label>
                    <div className="relative">
                        <select
                            className="w-full appearance-none bg-[#2d2d2d] border border-[#3e3e3e] hover:border-[#505050] rounded px-2 py-1.5 text-xs text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-colors"
                            value={operator}
                            onChange={(e) => setOperator(e.target.value)}
                        >
                            {OPERATORS[type].map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                        </select>
                        {/* Custom Arrow for select */}
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                            <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>

                {/* Value Input */}
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider ml-0.5">Value</label>
                    <input
                        type={type === 'number' ? 'number' : 'text'}
                        placeholder="Enter value..."
                        className="w-full bg-[#2d2d2d] border border-[#3e3e3e] hover:border-[#505050] rounded px-2 py-1.5 text-xs text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none placeholder-gray-600 transition-colors"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* Second Value (Between) */}
                {(operator === 'between') && (
                    <div className="flex flex-col gap-1 animate-in slide-in-from-top-1 duration-200">
                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider ml-0.5">End Value</label>
                        <input
                            type={type === 'number' ? 'number' : 'text'}
                            placeholder="Enter end value..."
                            className="w-full bg-[#2d2d2d] border border-[#3e3e3e] hover:border-[#505050] rounded px-2 py-1.5 text-xs text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none placeholder-gray-600 transition-colors"
                            value={value2}
                            onChange={(e) => setValue2(e.target.value)}
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center mt-2 pt-3 border-t border-[#3e3e3e]">
                    <button
                        type="button"
                        onClick={() => { onClear(); onClose(); }}
                        className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded hover:bg-[#3e3e3e]"
                    >
                        Clear filter
                    </button>
                    <div className="flex space-x-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-xs text-gray-300 hover:bg-[#3e3e3e] border border-transparent hover:border-[#454545] px-3 py-1.5 rounded transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="text-xs bg-[#007fd4] hover:bg-[#0063a5] text-white px-4 py-1.5 rounded font-medium shadow-sm transition-colors focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ResultSetTable;
