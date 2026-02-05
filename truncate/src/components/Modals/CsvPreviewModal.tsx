import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { CsvInspection } from '../../store/databaseStore';
import { Loader2, X, Check, AlertTriangle, AlertCircle } from 'lucide-react';

interface CsvPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (config: any) => void;
    inspection: CsvInspection | null;
    filePath: string;
    isConnecting: boolean;
}

// Extended types as per requirements
type ExtendedColumnType = 'INTEGER' | 'REAL' | 'TEXT' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'JSON';

const AVAILABLE_TYPES: { value: ExtendedColumnType; label: string }[] = [
    { value: 'TEXT', label: 'Text' },
    { value: 'INTEGER', label: 'Integer' },
    { value: 'REAL', label: 'Real (Float)' },
    { value: 'BOOLEAN', label: 'Boolean' },
    { value: 'DATE', label: 'Date' },
    { value: 'DATETIME', label: 'Datetime' },
    { value: 'JSON', label: 'JSON' },
];

const validateValue = (value: string | null, type: ExtendedColumnType): boolean => {
    if (value === null || value === undefined) return true;
    const strVal = String(value).trim();
    if (strVal === '' || strVal.toUpperCase() === 'NULL') return true;

    switch (type) {
        case 'INTEGER':
            return /^-?\d+$/.test(strVal);
        case 'REAL':
            return /^-?\d*(\.\d+)?$/.test(strVal);
        case 'BOOLEAN':
            const lower = strVal.toLowerCase();
            return ['true', 'false', '0', '1', 't', 'f', 'yes', 'no'].includes(lower);
        case 'DATE':
            return !isNaN(Date.parse(strVal));
        case 'DATETIME':
            return !isNaN(Date.parse(strVal));
        case 'JSON':
            try {
                JSON.parse(strVal);
                return true;
            } catch {
                return false;
            }
        case 'TEXT':
        default:
            return true;
    }
};

export const CsvPreviewModal: React.FC<CsvPreviewModalProps> = ({ isOpen, onClose, onConfirm, inspection, filePath, isConnecting }) => {
    const [types, setTypes] = useState<ExtendedColumnType[]>([]);

    useEffect(() => {
        if (inspection) {
            const initialTypes = inspection.types.map(t => {
                const upper = t.toUpperCase();
                if (['INTEGER', 'REAL', 'TEXT', 'BOOLEAN', 'DATE', 'DATETIME', 'JSON'].includes(upper)) {
                    return upper as ExtendedColumnType;
                }
                return 'TEXT';
            });
            setTypes(initialTypes);
        }
    }, [inspection]);

    // Real-time Validation Logic
    const { invalidCells, invalidCounts, hasErrors } = useMemo(() => {
        if (!inspection) return { invalidCells: new Set<string>(), invalidCounts: {}, hasErrors: false };

        const invalid = new Set<string>();
        const counts: Record<number, number> = {};
        let errorFound = false;

        inspection.preview.forEach((row, rIndex) => {
            row.forEach((cell, cIndex) => {
                const type = types[cIndex] || 'TEXT';
                if (!validateValue(cell, type)) {
                    invalid.add(`${rIndex},${cIndex}`);
                    counts[cIndex] = (counts[cIndex] || 0) + 1;
                    errorFound = true;
                }
            });
        });

        return { invalidCells: invalid, invalidCounts: counts, hasErrors: errorFound };
    }, [inspection, types]);

    if (!isOpen || !inspection) return null;

    const handleTypeChange = (index: number, newType: ExtendedColumnType) => {
        const newTypes = [...types];
        newTypes[index] = newType;
        setTypes(newTypes);
    };

    const handleConfirm = () => {
        onConfirm({
            columns: inspection.columns,
            types: types,
            separator: inspection.separator
        });
    };

    // Portal Content
    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center isolate">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Container */}
            <div className="relative bg-panel border border-subtle rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/10">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-subtle bg-subtle/30 shrink-0 select-none">
                    <div>
                        <h2 className="text-xl font-semibold text-primary flex items-center gap-3">
                            Import CSV
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs bg-subtle px-1.5 py-0.5 rounded text-secondary font-mono border border-subtle/50">FILE</span>
                            <p className="text-sm text-secondary truncate max-w-xl font-mono opacity-80" title={filePath}>{filePath}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-secondary hover:text-primary p-2 hover:bg-subtle rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden relative bg-app flex flex-col">
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left text-sm border-separate border-spacing-0">
                            <thead className="sticky top-0 z-20 shadow-sm">
                                <tr>
                                    {/* Number Column Header */}
                                    <th className="p-0 sticky left-0 z-30 w-12 bg-panel border-b border-r border-subtle">
                                        <div className="h-full w-full flex items-center justify-center text-secondary font-mono text-xs bg-subtle/20 py-3">
                                            #
                                        </div>
                                    </th>

                                    {inspection.columns.map((col, index) => (
                                        <th key={index} className="p-4 border-b border-subtle min-w-[200px] max-w-[300px] bg-panel align-top">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-primary font-bold tracking-tight truncate select-none text-sm" title={col}>{col}</span>
                                                    {invalidCounts[index] > 0 && (
                                                        <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border border-red-500/20">
                                                            <AlertCircle className="w-3 h-3" /> {invalidCounts[index]}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="relative group/select">
                                                    <select
                                                        value={types[index] || 'TEXT'}
                                                        onChange={(e) => handleTypeChange(index, e.target.value as ExtendedColumnType)}
                                                        className="w-full bg-subtle/30 border border-subtle group-hover/select:border-accent/40 rounded px-2.5 py-1.5 text-xs text-secondary focus:text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all cursor-pointer appearance-none pl-2.5 pr-8 font-medium"
                                                    >
                                                        {AVAILABLE_TYPES.map(type => (
                                                            <option key={type.value} value={type.value}>{type.label}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-secondary group-hover/select:text-primary transition-colors">
                                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle/50">
                                {inspection.preview.map((row, rIndex) => (
                                    <tr key={rIndex} className="hover:bg-subtle/10 transition-colors group">
                                        {/* Row Number */}
                                        <td className="sticky left-0 z-10 p-0 border-r border-subtle bg-panel group-hover:bg-[#20252d]">
                                            <div className="h-full w-full py-3 flex items-center justify-center text-xs font-mono text-secondary/50 select-none bg-subtle/5">
                                                {rIndex + 1}
                                            </div>
                                        </td>

                                        {row.map((cell, cIndex) => {
                                            const isInvalid = invalidCells.has(`${rIndex},${cIndex}`);
                                            return (
                                                <td
                                                    key={cIndex}
                                                    className={`px-4 py-3 max-w-[300px] truncate ${isInvalid
                                                            ? 'bg-red-500/5 text-red-400 font-mono text-xs'
                                                            : 'text-secondary text-sm group-hover:text-primary'
                                                        }`}
                                                    title={isInvalid ? `Invalid ${types[cIndex]} value: ${cell}` : cell}
                                                >
                                                    {cell === null || cell === '' ? <span className="text-secondary/30 italic text-xs select-none">NULL</span> : cell}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Validation Banner */}
                <div className="shrink-0 border-t border-subtle bg-panel/95 backdrop-blur-sm z-30">
                    <div className={`mx-6 my-4 p-3 rounded-lg border flex items-start gap-3 transition-colors ${hasErrors
                            ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-500'
                            : 'bg-blue-500/5 border-blue-500/20 text-blue-400'
                        }`}>
                        <div className="mt-0.5 shrink-0">
                            {hasErrors ? <AlertTriangle className="w-5 h-5" /> : <Loader2 className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">
                                {hasErrors ? 'Validation Issues Detected' : 'Ready to Import'}
                            </p>
                            <p className="text-xs opacity-80 mt-1 leading-relaxed">
                                {hasErrors
                                    ? <span>Rows with type mismatches (highlighted in red) will be kept but likely fail on insert or be moved to a <code className="bg-yellow-500/10 px-1 py-0.5 rounded border border-yellow-500/20 font-mono">_bad_rows</code> table depending on your configuration.</span>
                                    : <span>All preview rows match the selected schema types. The data is structurally valid for import.</span>
                                }
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-subtle bg-subtle/10 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-md text-sm font-medium text-secondary hover:text-primary hover:bg-subtle border border-transparent hover:border-subtle transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isConnecting}
                        className="px-6 py-2 rounded-md text-sm font-semibold bg-accent hover:bg-accent/90 text-white flex items-center gap-2 shadow-lg shadow-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.98]"
                    >
                        {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Import Data
                    </button>
                </div>
            </div>
        </div>
    );

    // Use React Portal to render outside the main DOM hierarchy
    return ReactDOM.createPortal(modalContent, document.body);
};
