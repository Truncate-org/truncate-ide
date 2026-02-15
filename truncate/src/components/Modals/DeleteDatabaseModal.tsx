import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { X, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useDatabaseStore } from '../../store/databaseStore';

interface DeleteDatabaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    databaseName: string | null;
}

export const DeleteDatabaseModal: React.FC<DeleteDatabaseModalProps> = ({ isOpen, onClose, databaseName }) => {
    const { refreshDatabases } = useDatabaseStore();
    const [confirmName, setConfirmName] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen || !databaseName) return null;

    const handleDelete = async () => {
        if (confirmName !== databaseName) return;

        setIsDeleting(true);
        setError(null);

        try {
            await invoke('drop_database', { databaseName });
            await refreshDatabases();
            onClose();
            setConfirmName('');
            // If we deleted the active database, the backend handles the switch, 
            // but we might want to ensure frontend state is consistent if needed.
            // The store listens for 'db-switched' generally, but let's see. 
            // The backend emits 'db-switched' if it switches.
        } catch (e: any) {
            setError(e?.toString() || 'Failed to delete database');
        } finally {
            setIsDeleting(false);
        }
    };

    const isMatch = confirmName === databaseName;

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
                    width: 480, display: 'flex', flexDirection: 'column',
                    background: '#1e1e2e', border: '1px solid #383850',
                    borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', borderBottom: '1px solid #2a2a3e',
                    background: 'linear-gradient(135deg, #450a0a 0%, #1a1a2e 100%)', // Red gradient
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: '#ef4444',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Trash2 size={16} color="#ffffff" />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Delete Database</span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                        onMouseOver={(e) => (e.currentTarget.style.color = '#f1f5f9')}
                        onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
                    ><X size={18} /></button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px 24px 20px', color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
                    <div style={{
                        display: 'flex', gap: 12, marginBottom: 20,
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                        padding: 12, borderRadius: 6
                    }}>
                        <AlertTriangle size={20} className="text-red-500 shrink-0" />
                        <div>
                            <span style={{ color: '#f87171', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                Warning: Destructive Action
                            </span>
                            This action will permanently delete the database <span style={{ color: '#e2e8f0', fontWeight: 600 }}>"{databaseName}"</span> and all of its data. This cannot be undone.
                        </div>
                    </div>

                    <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 500 }}>
                        Type <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{databaseName}</span> to confirm:
                    </label>
                    <input
                        type="text"
                        value={confirmName}
                        onChange={(e) => { setConfirmName(e.target.value); setError(null); }}
                        placeholder={databaseName}
                        style={{
                            width: '100%', padding: '10px 12px',
                            background: '#12121e', border: '1px solid #383850', borderRadius: 6,
                            color: '#e2e8f0', outline: 'none', fontFamily: 'monospace', fontSize: 13,
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#ef4444'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#383850'}
                    />

                    {error && (
                        <div style={{ marginTop: 12, color: '#f87171', fontSize: 12 }}>
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', gap: 10,
                    padding: '16px 20px', borderTop: '1px solid #2a2a3e',
                    background: '#16162a',
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px', fontSize: 12, fontWeight: 500,
                            background: 'transparent', border: '1px solid #383850',
                            borderRadius: 6, color: '#94a3b8', cursor: 'pointer',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = '#64748b'; e.currentTarget.style.color = '#e2e8f0'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = '#383850'; e.currentTarget.style.color = '#94a3b8'; }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={!isMatch || isDeleting}
                        style={{
                            padding: '8px 20px', fontSize: 12, fontWeight: 600,
                            background: (!isMatch || isDeleting) ? '#2a1a1a' : '#ef4444',
                            border: '1px solid',
                            borderColor: (!isMatch || isDeleting) ? '#383850' : '#ef4444',
                            borderRadius: 6,
                            color: (!isMatch || isDeleting) ? '#555' : '#fff',
                            cursor: (!isMatch || isDeleting) ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6
                        }}
                    >
                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Delete Database
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
