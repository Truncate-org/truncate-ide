import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { useDatabaseStore } from '../../store/databaseStore';
import { Table, X, Check, Key, Hash, AlertTriangle, AlertCircle, Loader2, Sparkles, Trash2 } from 'lucide-react';

// Engine-specific data types
const MYSQL_TYPES = [
    'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
    'VARCHAR(255)', 'TEXT', 'LONGTEXT',
    'DATE', 'DATETIME', 'TIMESTAMP',
    'BOOLEAN',
    'FLOAT', 'DOUBLE', 'DECIMAL(10,2)',
    'BLOB', 'JSON',
];

const POSTGRES_TYPES = [
    'INTEGER', 'BIGINT', 'SMALLINT',
    'VARCHAR', 'TEXT',
    'DATE', 'TIMESTAMP', 'TIMESTAMPTZ',
    'BOOLEAN',
    'REAL', 'DOUBLE PRECISION', 'NUMERIC',
    'BYTEA', 'JSON', 'JSONB', 'UUID',
    'SERIAL', 'BIGSERIAL',
];

interface ColumnDef {
    id: number;
    name: string;
    dataType: string;
    nullable: boolean;
    primaryKey: boolean;
    autoIncrement: boolean;
    defaultValue: string;
}

let _colId = 0;
function makeCol(types: string[]): ColumnDef {
    return { id: ++_colId, name: '', dataType: types[0] || 'TEXT', nullable: true, primaryKey: false, autoIncrement: false, defaultValue: '' };
}

function validateName(name: string): string | null {
    if (!name.trim()) return 'required';
    if (/^\d/.test(name)) return 'cannot start with number';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return 'invalid characters';
    return null;
}

interface CreateTableModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/* ── Shared inline styles ─────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 12,
    background: '#12121e', border: '1px solid #2a2a3e', borderRadius: 5,
    color: '#e2e8f0', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', transition: 'border-color 0.15s',
};

const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer', appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
    paddingRight: 24,
};

const checkboxOuter: React.CSSProperties = {
    width: 16, height: 16, borderRadius: 4, border: '1.5px solid #383850',
    background: '#12121e', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
    flexShrink: 0,
};

export const CreateTableModal: React.FC<CreateTableModalProps> = ({ isOpen, onClose }) => {
    const { connectionType, tables, refreshTables, activeDatabase } = useDatabaseStore();
    const types = connectionType === 'postgres' ? POSTGRES_TYPES : MYSQL_TYPES;

    const [tableName, setTableName] = useState('');
    const [columns, setColumns] = useState<ColumnDef[]>([makeCol(types), makeCol(types)]);
    const [error, setError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const addColumn = useCallback(() => setColumns(prev => [...prev, makeCol(types)]), [types]);
    const removeColumn = useCallback((id: number) => {
        setColumns(prev => prev.length > 1 ? prev.filter(c => c.id !== id) : prev);
    }, []);
    const updateCol = useCallback((id: number, field: keyof ColumnDef, value: any) => {
        setColumns(prev => prev.map(c => {
            if (c.id !== id) return c;
            const updated = { ...c, [field]: value };
            // PK implies NOT NULL
            if (field === 'primaryKey' && value) updated.nullable = false;
            // Auto-increment implies PK + NOT NULL
            if (field === 'autoIncrement' && value) {
                updated.primaryKey = true;
                updated.nullable = false;
                updated.defaultValue = '';
            }
            return updated;
        }));
        setError(null);
    }, []);

    // SQL generation — must be before early return to satisfy Rules of Hooks
    const generatedSql = useMemo(() => {
        const validCols = columns.filter(c => c.name.trim());
        if (!tableName.trim() || validCols.length === 0) return null;

        // MySQL uses backticks, PostgreSQL uses double quotes
        const q = connectionType === 'postgres' ? '"' : '`';

        const pkCols = validCols.filter(c => c.primaryKey);
        const composite = pkCols.length > 1;

        const isMySQL = connectionType !== 'postgres';

        const defs = validCols.map(col => {
            // For PostgreSQL auto-increment, swap type to SERIAL/BIGSERIAL
            let colType = col.dataType;
            if (col.autoIncrement && !isMySQL) {
                if (col.dataType === 'BIGINT') colType = 'BIGSERIAL';
                else colType = 'SERIAL';
            }

            let d = `${q}${col.name}${q} ${colType}`;
            if (!col.nullable && !col.primaryKey) d += ' NOT NULL';
            if (col.primaryKey && !composite) d += ' PRIMARY KEY';
            if (col.autoIncrement && isMySQL) d += ' AUTO_INCREMENT';
            if (col.defaultValue.trim() && !col.autoIncrement) d += ` DEFAULT ${col.defaultValue.trim()}`;
            return d;
        });

        if (composite) defs.push(`PRIMARY KEY (${pkCols.map(c => `${q}${c.name}${q}`).join(', ')})`);

        // Single-line SQL so sqlparser's GenericDialect can parse it
        return `CREATE TABLE ${q}${tableName}${q} (${defs.join(', ')});`;
    }, [tableName, columns, connectionType]);

    const noPk = columns.some(c => c.name.trim()) && !columns.some(c => c.primaryKey);

    if (!isOpen) return null;

    // Validate all
    const validate = (): string | null => {
        const tn = validateName(tableName);
        if (tn) return `Table name ${tn}`;
        if (tables.includes(tableName)) return `Table "${tableName}" already exists`;
        const validCols = columns.filter(c => c.name.trim());
        if (validCols.length === 0) return 'At least one column is required';
        const seen = new Set<string>();
        for (const c of validCols) {
            const e = validateName(c.name);
            if (e) return `Column "${c.name}": ${e}`;
            const lower = c.name.toLowerCase();
            if (seen.has(lower)) return `Duplicate column: "${c.name}"`;
            seen.add(lower);
        }
        return null;
    };

    const handleCreate = async () => {
        const err = validate();
        if (err) { setError(err); return; }
        if (!generatedSql) { setError('Cannot generate SQL'); return; }

        setError(null);
        setIsCreating(true);
        try {
            await invoke('sql_run_query', { sql: generatedSql });
            await refreshTables();
            setTableName(''); setColumns([makeCol(types), makeCol(types)]); setError(null);
            onClose();
        } catch (e: any) {
            setError(e?.toString() || 'Failed to create table');
        } finally {
            setIsCreating(false);
        }
    };

    return createPortal(
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                    background: '#1e1e2e', border: '1px solid #383850',
                    borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
            >
                {/* ── Header ──────────────────────────────────────── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', borderBottom: '1px solid #2a2a3e',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                        }}><Table size={16} color="#ffffff" /></div>
                        <div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Create Table</span>
                            {activeDatabase && (
                                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>in {activeDatabase}</span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, padding: '2px 6px', borderRadius: 4 }}
                        onMouseOver={(e) => (e.currentTarget.style.color = '#f1f5f9')}
                        onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
                    ><X size={18} /></button>
                </div>

                {/* ── Body (scrollable) ───────────────────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 16px' }}>

                    {/* Table Name */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Table Name <span style={{ color: '#f87171' }}>*</span>
                        </label>
                        <input
                            type="text" value={tableName} autoFocus placeholder="users"
                            onChange={(e) => { setTableName(e.target.value); setError(null); }}
                            style={{ ...inputStyle, padding: '10px 14px', fontSize: 13 }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a3e')}
                        />
                    </div>

                    {/* Columns Section */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Columns <span style={{ color: '#f87171' }}>*</span>
                            </label>
                            <button
                                onClick={addColumn}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '5px 10px', fontSize: 11, fontWeight: 600,
                                    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                                    borderRadius: 5, color: '#60a5fa', cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
                            >
                                + Add Column
                            </button>
                        </div>

                        {/* Column Header Labels */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 130px 36px 36px 36px 90px 28px',
                            gap: 6, padding: '0 2px', marginBottom: 6,
                            fontSize: 10, fontWeight: 600, color: '#64748b',
                            textTransform: 'uppercase', letterSpacing: '0.6px',
                        }}>
                            <span>Name</span>
                            <span>Type</span>
                            <span style={{ textAlign: 'center' }}>Null</span>
                            <span style={{ textAlign: 'center' }}>PK</span>
                            <span style={{ textAlign: 'center' }}>AI</span>
                            <span>Default</span>
                            <span></span>
                        </div>

                        {/* Column Rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {columns.map((col) => (
                                <div
                                    key={col.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 130px 36px 36px 36px 90px 28px',
                                        gap: 6, alignItems: 'center',
                                        padding: '4px 2px', borderRadius: 4,
                                        transition: 'background 0.1s',
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    {/* Name */}
                                    <input
                                        type="text" value={col.name} placeholder="column_name"
                                        onChange={(e) => updateCol(col.id, 'name', e.target.value)}
                                        style={inputStyle}
                                        onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                                        onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a3e')}
                                    />

                                    {/* Type */}
                                    <select
                                        value={col.dataType}
                                        onChange={(e) => updateCol(col.id, 'dataType', e.target.value)}
                                        style={selectStyle}
                                    >
                                        {types.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>

                                    {/* Nullable */}
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <div
                                            onClick={() => updateCol(col.id, 'nullable', !col.nullable)}
                                            style={{
                                                ...checkboxOuter,
                                                background: col.nullable ? '#3b82f6' : '#12121e',
                                                borderColor: col.nullable ? '#3b82f6' : '#383850',
                                            }}
                                        >
                                            {col.nullable && <Check size={12} strokeWidth={3} color="#fff" />}
                                        </div>
                                    </div>

                                    {/* PK */}
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <div
                                            onClick={() => updateCol(col.id, 'primaryKey', !col.primaryKey)}
                                            style={{
                                                ...checkboxOuter,
                                                background: col.primaryKey ? '#f59e0b' : '#12121e',
                                                borderColor: col.primaryKey ? '#f59e0b' : '#383850',
                                            }}
                                        >
                                            {col.primaryKey && <Key size={10} color="#fff" />}
                                        </div>
                                    </div>

                                    {/* Auto Increment */}
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <div
                                            onClick={() => updateCol(col.id, 'autoIncrement', !col.autoIncrement)}
                                            style={{
                                                ...checkboxOuter,
                                                background: col.autoIncrement ? '#10b981' : '#12121e',
                                                borderColor: col.autoIncrement ? '#10b981' : '#383850',
                                            }}
                                        >
                                            {col.autoIncrement && <Hash size={10} color="#fff" strokeWidth={3} />}
                                        </div>
                                    </div>

                                    {/* Default */}
                                    <input
                                        type="text" value={col.defaultValue} placeholder="NULL"
                                        onChange={(e) => updateCol(col.id, 'defaultValue', e.target.value)}
                                        style={{ ...inputStyle, fontSize: 11 }}
                                        onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                                        onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a3e')}
                                    />

                                    {/* Remove */}
                                    <button
                                        onClick={() => removeColumn(col.id)}
                                        disabled={columns.length <= 1}
                                        style={{
                                            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'none', border: 'none', borderRadius: 4,
                                            color: columns.length <= 1 ? '#2a2a3e' : '#64748b',
                                            cursor: columns.length <= 1 ? 'not-allowed' : 'pointer',
                                            fontSize: 14, transition: 'color 0.15s',
                                        }}
                                        onMouseOver={(e) => { if (columns.length > 1) e.currentTarget.style.color = '#ef4444'; }}
                                        onMouseOut={(e) => { if (columns.length > 1) e.currentTarget.style.color = '#64748b'; }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* No PK Warning */}
                    {noPk && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', marginBottom: 12,
                            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                            borderRadius: 6, fontSize: 11, color: '#fbbf24',
                        }}>
                            <AlertTriangle size={14} />
                            <span>No primary key selected — tables without a primary key are not recommended.</span>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '10px 14px', marginBottom: 12,
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: 6, fontSize: 12, color: '#fca5a5', lineHeight: 1.4,
                        }}>
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* SQL Preview */}
                    {generatedSql && (
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                SQL Preview
                            </label>
                            <pre style={{
                                padding: '12px 14px', background: '#0a0a14', borderRadius: 6,
                                fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: 11.5,
                                color: '#4ade80', border: '1px solid #1a1a2e', lineHeight: 1.6,
                                overflowX: 'auto', margin: 0, whiteSpace: 'pre',
                            }}>
                                {generatedSql}
                            </pre>
                        </div>
                    )}
                </div>

                {/* ── Footer ──────────────────────────────────────── */}
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', gap: 10,
                    padding: '14px 20px', borderTop: '1px solid #2a2a3e',
                    background: '#16162a', flexShrink: 0,
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 18px', fontSize: 12, fontWeight: 500,
                            background: 'transparent', border: '1px solid #383850',
                            borderRadius: 6, color: '#94a3b8', cursor: 'pointer',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = '#64748b'; e.currentTarget.style.color = '#e2e8f0'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = '#383850'; e.currentTarget.style.color = '#94a3b8'; }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={isCreating || !tableName.trim() || columns.every(c => !c.name.trim())}
                        style={{
                            padding: '8px 22px', fontSize: 12, fontWeight: 600,
                            background: (isCreating || !tableName.trim()) ? '#1e3a5f' : 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none', borderRadius: 6,
                            color: (isCreating || !tableName.trim()) ? '#64748b' : '#fff',
                            cursor: (isCreating || !tableName.trim()) ? 'not-allowed' : 'pointer',
                            boxShadow: (isCreating || !tableName.trim()) ? 'none' : '0 4px 14px rgba(16,185,129,0.25)',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        {isCreating ? <><Loader2 className="animate-spin" size={14} /> Creating...</> : <><Sparkles size={14} /> Create Table</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
