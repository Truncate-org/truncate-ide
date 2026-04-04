import React, { useState } from 'react';
import { useDatabaseStore } from '../../store/databaseStore';
import { AlertOctagon, Info } from 'lucide-react';

const ConfirmationModal: React.FC = () => {
    const { confirmationData, setConfirmationData, runQuery } = useDatabaseStore();
    const [inputValue, setInputValue] = useState('');

    if (!confirmationData) return null;

    const handleConfirm = () => {
        if (inputValue === 'CONFIRM') {
            runQuery(confirmationData.original_sql, true);
            setConfirmationData(null);
            setInputValue(''); // Reset for next time
        }
    };

    const handleCancel = () => {
        setConfirmationData(null);
        setInputValue('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-[#0d1117] border border-red-500/30 rounded-xl shadow-2xl shadow-red-500/10 overflow-hidden transform transition-all">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 bg-red-500/10 border-b border-red-500/20">
                    <AlertOctagon className="w-6 h-6 text-red-500" />
                    <h2 className="text-xl font-bold text-red-400">Destructive Query Detected</h2>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="p-4 bg-black/40 rounded-lg border border-white/5 space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                                <Info className="w-4 h-4" />
                                <span>Impact Summary:</span>
                            </div>
                            <p className="text-sm font-medium text-white/90">
                                {confirmationData.prompt}
                            </p>
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Original Statement:</span>
                                <code className="block text-xs font-mono text-red-300 break-words whitespace-pre-wrap">
                                    {confirmationData.original_sql}
                                </code>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm text-gray-400 font-medium">
                                Type <span className="text-white font-bold select-none">CONFIRM</span> to proceed:
                            </label>
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="CONFIRM"
                                className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-white/5">
                        <button
                            onClick={handleCancel}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={inputValue !== 'CONFIRM'}
                            className="flex-1 px-4 py-2.5 text-sm font-bold text-white uppercase bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 rounded-lg transition-colors shadow-lg shadow-red-500/20"
                        >
                            Execute Query
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
