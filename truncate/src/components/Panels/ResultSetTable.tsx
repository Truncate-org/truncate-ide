import React, { useState, useMemo, useEffect } from 'react';
import { TablePreview } from '../../store/databaseStore';
import { ArrowUp, ArrowDown, Filter, X, Search } from 'lucide-react';
import { processRows, SortState, FilterState, ColumnType } from '../../utils/dataProcessing';
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

    useEffect(() => {
        setSortState(null);
        setFilterState({});
        setGlobalSearch('');
        setActiveFilterCol(null);
    }, [data.rows]);

    // Map backend types to frontend simplified types for filtering/sorting
    const columnTypes: ColumnType[] = useMemo(() => {
        return data.columns.map(col => {
            const t = col.type_name.toLowerCase();
            if (t.includes('int') || t.includes('float') || t.includes('decimal') || t.includes('double') || t.includes('numeric') || t.includes('real')) return 'number';
            if (t.includes('date') || t.includes('time') || t.includes('timestamp')) return 'date';
            if (t.includes('bool') || t.includes('bit')) return 'boolean';
            return 'string';
        });
    }, [data.columns]);

    const visibleRows = useMemo(() => {
        return processRows(data.rows, columnTypes, sortState, filterState, globalSearch);
    }, [data.rows, columnTypes, sortState, filterState, globalSearch]);

    const handleHeaderClick = (colIdx: number) => {
        setSortState(prev => {
            if (prev?.columnIndex === colIdx) {
                if (prev.direction === 'asc') return { columnIndex: colIdx, direction: 'desc' };
                if (prev.direction === 'desc') return null;
            }
            return { columnIndex: colIdx, direction: 'asc' };
        });
    };

    const toggleFilterMenu = (e: React.MouseEvent, colIdx: number) => {
        e.stopPropagation();
        setActiveFilterCol(prev => prev === colIdx ? null : colIdx);
    };

    const updateFilter = (colIdx: number, operator: string, value: string, value2?: string) => {
        setFilterState(prev => {
            const newState = { ...prev };
            if (!value && operator !== 'empty') {
                delete newState[colIdx];
                return newState;
            }
            newState[colIdx] = [{ operator, value, value2 }];
            return newState;
        });
    };

    const clearFilter = (colIdx: number) => {
        setFilterState(prev => {
            const newState = { ...prev };
            delete newState[colIdx];
            return newState;
        });
        setActiveFilterCol(null);
    };

    // Helper to get alignment class
    const getAlignClass = (idx: number) => {
        const type = columnTypes[idx];
        if (type === 'number') return 'text-right justify-end';
        // if (type === 'boolean') return 'text-center justify-center'; // Center bools? Maybe keep left for now.
        return 'text-left justify-start';
    };

    return (
        <div className="flex flex-col h-full bg-editor-bg font-sans">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b border-subtle bg-surface-secondary/50">
                <div className="flex items-center flex-1 max-w-sm relative group">
                    <Search className="w-4 h-4 absolute left-3 text-secondary group-focus-within:text-blue-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search results..."
                        className="w-full bg-[#1e1e1e] border border-transparent focus:border-blue-500/30 text-sm text-primary pl-9 pr-2 py-1.5 rounded transition-all focus:outline-none placeholder-gray-600"
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center text-xs space-x-3 text-secondary ml-4">
                    <div className="flex items-baseline space-x-1">
                        <span className="font-medium text-primary">{visibleRows.length}</span>
                        <span className="opacity-70">rows</span>
                    </div>
                    {(visibleRows.length !== data.rows.length) && (
                        <span className="text-amber-500 flex items-center bg-amber-500/10 px-1.5 py-0.5 rounded">
                            Filtered from {data.rows.length}
                        </span>
                    )}
                    {data.limited && (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded shadow-sm" title="Limited to 1000 rows">
                            Limited Result
                        </span>
                    )}
                    <button
                        onClick={() => { setFilterState({}); setSortState(null); setGlobalSearch(''); }}
                        className="px-2 py-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        disabled={!sortState && Object.keys(filterState).length === 0 && !globalSearch}
                    >
                        Reset View
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {visibleRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-24 text-secondary opacity-60">
                        <div className="bg-white/5 p-4 rounded-full mb-3">
                            <Filter className="w-8 h-8" />
                        </div>
                        <p className="font-medium">No rows match the current filters</p>
                        <button
                            onClick={() => { setFilterState({}); setGlobalSearch(''); }}
                            className="mt-3 text-blue-400 hover:text-blue-300 hover:underline text-sm transition-colors"
                        >
                            Clear all filters
                        </button>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#252526] sticky top-0 z-20 shadow-lg after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px] after:bg-[#3e3e3e]">
                            <tr>
                                <th className="sticky left-0 z-30 w-10 min-w-[40px] border-b border-r border-[#3e3e3e] bg-[#2d2d2d] text-center text-[10px] text-gray-500 font-mono select-none">
                                    #
                                </th>
                                {data.columns.map((col, idx) => {
                                    const isSorted = sortState?.columnIndex === idx;
                                    const isFiltered = !!filterState[idx];
                                    const type = columnTypes[idx];
                                    const alignClass = getAlignClass(idx);

                                    return (
                                        <th key={idx} className="group relative border-b border-r border-[#3e3e3e] min-w-[150px] max-w-[400px]">
                                            <div
                                                className={twMerge(
                                                    "flex items-center px-3 py-2 text-xs font-semibold text-secondary cursor-pointer hover:bg-[#2a2d2e] select-none h-full transition-colors",
                                                    isSorted && "bg-[#2a2d2e] text-primary",
                                                    alignClass // Align header content same as body? Usually headers logic left, numbers right
                                                )}
                                                onClick={() => handleHeaderClick(idx)}
                                            >
                                                {/* Column Name & Type Badge */}
                                                <div className="flex flex-col min-w-0 mr-2">
                                                    <div className="flex items-center space-x-1.5">
                                                        {/* Type Icon/Badge */}
                                                        <span className={clsx(
                                                            "text-[9px] uppercase tracking-tighter font-bold px-1 rounded",
                                                            type === 'number' ? "text-emerald-400 bg-emerald-400/10" :
                                                                type === 'string' ? "text-blue-400 bg-blue-400/10" :
                                                                    type === 'date' ? "text-purple-400 bg-purple-400/10" :
                                                                        type === 'boolean' ? "text-orange-400 bg-orange-400/10" :
                                                                            "text-gray-400 bg-gray-400/10"
                                                        )}>
                                                            {type.substr(0, 3)}
                                                        </span>
                                                        <span className="truncate" title={`${col.name} (${col.type_name})`}>{col.name}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-1 shrink-0 ml-auto">
                                                    {isSorted && (
                                                        sortState.direction === 'asc'
                                                            ? <ArrowUp className="w-3 h-3 text-blue-400 animate-in slide-in-from-bottom-1" />
                                                            : <ArrowDown className="w-3 h-3 text-blue-400 animate-in slide-in-from-top-1" />
                                                    )}

                                                    <div
                                                        className={twMerge(
                                                            "p-1 rounded hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100",
                                                            (isFiltered || activeFilterCol === idx) && "opacity-100",
                                                            activeFilterCol === idx && "bg-white/10 text-white"
                                                        )}
                                                        onClick={(e) => toggleFilterMenu(e, idx)}
                                                    >
                                                        <Filter className={clsx("w-3 h-3", isFiltered && "fill-blue-400 text-blue-400")} />
                                                    </div>
                                                </div>
                                            </div>

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
                        <tbody className="text-sm text-primary font-mono bg-[#1e1e1e]">
                            {visibleRows.map((row, rowIdx) => (
                                <tr key={rowIdx} className="hover:bg-[#2a2d2e] transition-colors group even:bg-[#1e1e1e] odd:bg-[#212121]">
                                    <td className="px-2 py-1.5 border-b border-r border-[#363636] text-[10px] text-gray-600 text-center select-none bg-[#252526]/50">
                                        {rowIdx + 1}
                                    </td>
                                    {row.map((cell, cellIdx) => {
                                        const type = columnTypes[cellIdx];
                                        const alignClass = type === 'number' ? 'text-right' : 'text-left';

                                        // Formatting for NULL
                                        const isNull = cell === 'NULL';

                                        return (
                                            <td
                                                key={cellIdx}
                                                className={twMerge(
                                                    "px-4 py-1.5 border-b border-r border-[#363636] whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]",
                                                    alignClass,
                                                    isNull && "text-gray-500 italic text-[11px]"
                                                )}
                                                title={String(cell)}
                                            >
                                                {isNull ? 'NULL' : cell}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            {/* Empty space filler if needed, or simply let it be */}
                        </tbody>
                    </table>
                )}
            </div>
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
