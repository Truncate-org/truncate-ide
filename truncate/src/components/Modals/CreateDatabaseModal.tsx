import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { useDatabaseStore } from '../../store/databaseStore';
import { Database, X, AlertCircle, Loader2, Sparkles } from 'lucide-react';

interface CreateDatabaseModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function validateDbName(name: string): string | null {
    if (!name.trim()) return 'Database name is required';
    if (/^\d/.test(name)) return 'Name cannot start with a number';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return 'Only letters, numbers, and underscores allowed';
    if (name.length > 64) return 'Name too long (max 64 characters)';
    return null;
}

const CHARSETS = ['', 'utf8mb4', 'utf8', 'latin1', 'ascii', 'binary'];
const COLLATIONS: Record<string, string[]> = {
    '': [''],
    'utf8mb4': ['', 'utf8mb4_unicode_ci', 'utf8mb4_general_ci', 'utf8mb4_bin'],
    'utf8': ['', 'utf8_general_ci', 'utf8_unicode_ci', 'utf8_bin'],
    'latin1': ['', 'latin1_swedish_ci', 'latin1_general_ci', 'latin1_bin'],
    'ascii': ['', 'ascii_general_ci', 'ascii_bin'],
    'binary': ['', 'binary'],
};

export const CreateDatabaseModal: React.FC<CreateDatabaseModalProps> = ({ isOpen, onClose }) => {
    const { connectionType, databases, refreshDatabases } = useDatabaseStore();

    const [dbName, setDbName] = useState('');
    const [charset, setCharset] = useState('');
    const [collation, setCollation] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    if (!isOpen) return null;

    const availableCollations = COLLATIONS[charset] || [''];

    const handleCreate = async () => {
        const nameError = validateDbName(dbName);
        if (nameError) { setError(nameError); return; }
        if (databases.includes(dbName)) { setError(`Database "${dbName}" already exists`); return; }

        setError(null);
        setIsCreating(true);

        try {
            let sql = `CREATE DATABASE \`${dbName}\``;
            if (connectionType === 'mysql') {
                if (charset) sql += ` CHARACTER SET ${charset}`;
                if (collation) sql += ` COLLATE ${collation}`;
            }
            sql += ';';

            await invoke('sql_run_query', { sql });
            await refreshDatabases();
            setDbName(''); setCharset(''); setCollation(''); setError(null);
            onClose();
        } catch (e: any) {
            setError(e?.toString() || 'Failed to create database');
        } finally {
            setIsCreating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isCreating) handleCreate();
        if (e.key === 'Escape') onClose();
    };

    const sqlPreview = dbName.trim() && !validateDbName(dbName)
        ? `CREATE DATABASE \`${dbName}\`${charset ? ` CHARACTER SET ${charset}` : ''}${collation ? ` COLLATE ${collation}` : ''};`
        : null;

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
                onKeyDown={handleKeyDown}
                style={{
                    width: 460, background: '#1e1e2e', border: '1px solid #383850',
                    borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', borderBottom: '1px solid #2a2a3e',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14,
                        }}><Database size={16} color="#ffffff" /></div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Create Database</span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                            fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4,
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.color = '#f1f5f9')}
                        onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 20px 16px' }}>
                    {/* Database Name */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Database Name <span style={{ color: '#f87171' }}>*</span>
                        </label>
                        <input
                            type="text"
                            value={dbName}
                            onChange={(e) => { setDbName(e.target.value); setError(null); }}
                            placeholder="my_database"
                            autoFocus
                            style={{
                                width: '100%', padding: '10px 14px', fontSize: 13,
                                background: '#12121e', border: '1px solid #2a2a3e', borderRadius: 6,
                                color: '#e2e8f0', outline: 'none', boxSizing: 'border-box',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a3e')}
                        />
                    </div>

                    {/* MySQL-only: Charset & Collation */}
                    {connectionType === 'mysql' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Charset
                                </label>
                                <select
                                    value={charset}
                                    onChange={(e) => { setCharset(e.target.value); setCollation(''); }}
                                    style={{
                                        width: '100%', padding: '10px 14px', fontSize: 13,
                                        background: '#12121e', border: '1px solid #2a2a3e', borderRadius: 6,
                                        color: '#e2e8f0', outline: 'none', boxSizing: 'border-box',
                                        cursor: 'pointer', appearance: 'none',
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
                                    }}
                                >
                                    {CHARSETS.map(c => <option key={c} value={c}>{c || 'Default'}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Collation
                                </label>
                                <select
                                    value={collation}
                                    onChange={(e) => setCollation(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 14px', fontSize: 13,
                                        background: '#12121e', border: '1px solid #2a2a3e', borderRadius: 6,
                                        color: '#e2e8f0', outline: 'none', boxSizing: 'border-box',
                                        cursor: 'pointer', appearance: 'none',
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
                                    }}
                                >
                                    {availableCollations.map(c => <option key={c} value={c}>{c || 'Default'}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '10px 14px', marginBottom: 16,
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: 6, fontSize: 12, color: '#fca5a5', lineHeight: 1.4,
                        }}>
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* SQL Preview */}
                    {sqlPreview && (
                        <div style={{ marginBottom: 4 }}>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                SQL Preview
                            </label>
                            <div style={{
                                padding: '10px 14px', background: '#0a0a14', borderRadius: 6,
                                fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: 12,
                                color: '#4ade80', border: '1px solid #1a1a2e', lineHeight: 1.5,
                                overflowX: 'auto',
                            }}>
                                {sqlPreview}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', gap: 10,
                    padding: '14px 20px', borderTop: '1px solid #2a2a3e',
                    background: '#16162a',
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 18px', fontSize: 12, fontWeight: 500,
                            background: 'transparent', border: '1px solid #383850',
                            borderRadius: 6, color: '#94a3b8', cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = '#64748b'; e.currentTarget.style.color = '#e2e8f0'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = '#383850'; e.currentTarget.style.color = '#94a3b8'; }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={isCreating || !dbName.trim()}
                        style={{
                            padding: '8px 22px', fontSize: 12, fontWeight: 600,
                            background: isCreating || !dbName.trim() ? '#1e3a5f' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                            border: 'none', borderRadius: 6,
                            color: isCreating || !dbName.trim() ? '#64748b' : '#fff',
                            cursor: isCreating || !dbName.trim() ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s',
                            boxShadow: isCreating || !dbName.trim() ? 'none' : '0 4px 14px rgba(59,130,246,0.25)',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        {isCreating ? <><Loader2 className="animate-spin" size={14} /> Creating...</> : <><Sparkles size={14} /> Create Database</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
