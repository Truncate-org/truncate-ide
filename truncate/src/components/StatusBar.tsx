import React from 'react';
import { useDatabaseStore } from '../store/databaseStore';
import { Database, Server, Shield } from 'lucide-react';

const StatusBar: React.FC = () => {
    const { isConnected, activeDatabase, connectionUser } = useDatabaseStore();

    return (
        <div className="h-6 bg-[#007acc] text-white flex items-center px-3 text-xs justify-between select-none">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 hover:bg-white/10 px-2 py-0.5 rounded transition-colors cursor-pointer">
                    <Server className="w-3 h-3" />
                    <span>{isConnected ? `MySQL (${connectionUser || 'localhost'})` : 'No Server'}</span>
                </div>

                <div className="flex items-center gap-1.5 hover:bg-white/10 px-2 py-0.5 rounded transition-colors cursor-pointer">
                    <Database className="w-3 h-3" />
                    <span>{activeDatabase || 'No Database'}</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <Shield className="w-3 h-3 opacity-70" />
                    <span>Mode: Read-only (MVP)</span>
                </div>
                <div className="px-2">
                    UTF-8
                </div>
            </div>
        </div>
    );
};

export default StatusBar;
