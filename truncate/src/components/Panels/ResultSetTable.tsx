import React, { useState, useMemo, useEffect } from 'react';
import { TablePreview } from '../../store/databaseStore';
import { ArrowUp, ArrowDown, Filter, X, Search } from 'lucide-react';
import { processRows, SortState, FilterState, ColumnType } from '../../utils/dataProcessing';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Grid } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

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
        { value: 'eq', label: 'Is' }
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

    const getAlignClass = (idx: number) => {
        const type = columnTypes[idx];
        if (type === 'number') return 'text-right justify-end';
        return 'text-left justify-start';
    };

    // Virtualized Cell Renderer
    const Cell = ({ columnIndex, rowIndex, style }: any) => {
        // First column is the row index (#)
        if (columnIndex === 0) {
            return (
                <div 
                    style={style}
                    className="flex items-center justify-center px-2 border-b border-r border-[#363636] text-[10px] text-gray-600 select-none bg-[#252526]/50 font-mono"
                >
                    {rowIndex + 1}
                </div>
            );
        }

        const dataColumnIndex = columnIndex - 1;
        const cellValue = visibleRows[rowIndex][dataColumnIndex];
        const type = columnTypes[dataColumnIndex];
        const alignClass = type === 'number' ? 'text-right' : 'text-left';
        const isNull = cellValue === 'NULL';

        return (
            <div
                style={style}
                className={twMerge(
                    "flex items-center px-4 border-b border-r border-[#363636] whitespace-nowrap overflow-hidden text-ellipsis text-sm text-primary font-mono bg-[#1e1e1e]",
                    alignClass,
                    isNull && "text-gray-500 italic text-[11px]"
                )}
                title={String(cellValue)}
            >
                {isNull ? 'NULL' : cellValue}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-editor-bg font-sans overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b border-subtle bg-surface-secondary/50 shrink-0">
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

            {/* Header Area (Sticky) */}
            <div className="overflow-x-auto scrollbar-none flex-1 flex flex-col" id="grid-container">
                <div className="flex bg-[#252526] sticky top-0 z-20 shadow-md border-b border-[#3e3e3e] shrink-0" style={{ width: (data.columns.length + 1) * 150 }}>
                    <div className="w-10 min-w-[40px] border-r border-[#3e3e3e] bg-[#2d2d2d] flex items-center justify-center text-[10px] text-gray-500 font-mono select-none">
                        #
                    </div>
                    {data.columns.map((col, idx) => {
                        const isSorted = sortState?.columnIndex === idx;
                        const isFiltered = !!filterState[idx];
                        const type = columnTypes[idx];
                        const alignClass = getAlignClass(idx);

                        return (
                            <div key={idx} className="group relative border-r border-[#3e3e3e] w-[150px] shrink-0 h-10">
                                <div
                                    className={twMerge(
                                        "flex items-center px-3 py-2 h-full text-xs font-semibold text-secondary cursor-pointer hover:bg-[#2a2d2e] select-none transition-colors",
                                        isSorted && "bg-[#2a2d2e] text-primary",
                                        alignClass
                                    )}
                                    onClick={() => handleHeaderClick(idx)}
                                >
                                    <div className="flex flex-col min-w-0 mr-2">
                                        <div className="flex items-center space-x-1.5">
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
                            </div>
                        );
                    })}
                </div>

                {/* Grid Area */}
                <div className="flex-1 min-h-0 bg-[#1e1e1e]">
                    <AutoSizer
                        renderProp={({ height, width }) => {
                            if (height === undefined || width === undefined) return null;
                            return (
                                <Grid
                                    columnCount={data.columns.length + 1}
                                    columnWidth={150}
                                    rowCount={visibleRows.length}
                                    rowHeight={32}
                                    style={{ height, width }}
                                    className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
                                    cellComponent={Cell}
                                    cellProps={{ visibleRows, columnTypes }}
                                />
                            );
                        }}
                    />
                </div>
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
    const [operator, setOperator] = useState(currentFilter?.operator || OPERATORS[type][0].value);
    const [value, setValue] = useState(currentFilter?.value || '');
    const [value2, setValue2] = useState(currentFilter?.value2 || '');

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

    return (
        <div
            className={twMerge(
                "absolute top-full mt-1 w-72 bg-[#1e1e1e] border border-[#454545] shadow-2xl rounded-lg z-50 flex flex-col font-sans overflow-hidden ring-1 ring-black/20",
                alignment === 'right' ? "right-0" : "left-0"
            )}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-[#3e3e3e]">
                <span className="text-xs font-semibold text-gray-300">Filter by condition</span>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-[#3e3e3e] rounded text-gray-400 hover:text-gray-200 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-3 flex flex-col gap-3">
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
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                            <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>

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
