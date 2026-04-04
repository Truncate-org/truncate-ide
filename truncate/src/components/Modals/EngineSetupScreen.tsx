import React, { useEffect, useState } from 'react';
import { useAiStore } from '../../store/aiStore';
import { Terminal, Shield, Cpu, Activity, Zap, Loader2 } from 'lucide-react';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const EngineSetupScreen: React.FC = () => {
    const { isInstalled, checkIfInstalled, showSetup } = useAiStore();
    const [logs, setLogs] = useState<string[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState<{message: string, percent: number} | null>(null);

    useEffect(() => {
        checkIfInstalled();
    }, []);

    useEffect(() => {
        if (progress) {
            setLogs(prev => {
                const next = [...prev, `[${new Date().toLocaleTimeString()}] ${progress.message}...`];
                return next.slice(-8); // Keep last 8 logs
            });
            if (progress.percent >= 100) {
                setTimeout(() => {
                    useAiStore.setState({ isInstalled: true });
                    setIsSyncing(false);
                }, 1000);
            }
        }
    }, [progress]);

    useEffect(() => {
        if (showSetup && !isSyncing && !isInstalled) {
            handleInitialize();
        }
    }, [showSetup, isSyncing, isInstalled]);

    const handleInitialize = () => {
        setLogs(["[SYSTEM] Initializing core synchronization..."]);
        setIsSyncing(true);
        listen<{message: string, percent: number}>('setup-progress', (event) => {
            setProgress(event.payload);
        });
        invoke('initialize_ai').catch(err => {
            setLogs(prev => [...prev, `[ERROR] ${err}`]);
            setIsSyncing(false);
        });
    };

    if (!showSetup && !isSyncing) return null;
    if (isInstalled && !isSyncing) return null;

    if (!showSetup && !isSyncing) return null;
    if (isInstalled && !isSyncing) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center font-mono selection:bg-blue-500/30">
            {/* Background Effects */}
            <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%]" />
                <div className="absolute inset-x-0 top-0 h-1 bg-white/10 animate-[scan_8s_linear_infinite]" />
            </div>

            {/* Content Container */}
            <div className="relative w-full max-w-2xl px-8 py-12 border border-white/10 bg-black/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-blue-500/5 overflow-hidden">
                {/* Glitch Overlay Effect */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-[pulse_2s_infinite]" />

                {/* Header */}
                <div className="flex items-center gap-4 mb-12">
                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Cpu className="w-8 h-8 text-blue-400 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tighter text-white uppercase italic">
                            Core Engine Initialization
                        </h1>
                        <p className="text-blue-400/60 text-xs uppercase tracking-[0.2em] font-black">
                            Secure Data Intelligence Subsystem
                        </p>
                    </div>
                </div>

                {/* Setup / Sync View */}
                {!isSyncing ? (
                    <div className="space-y-8">
                        <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-4">
                            <div className="flex items-center gap-3 text-blue-300">
                                <Shield className="w-5 h-5" />
                                <span className="text-sm font-bold uppercase">Integrity Check Failed</span>
                            </div>
                            <p className="text-white/60 text-sm leading-relaxed">
                                The local intelligence core was not detected in this environment. To enable advanced data management features, we must synchronize internal processing assets.
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-blue-500/60 font-bold uppercase italic border-l-2 border-blue-500/30 pl-3">
                                <Zap className="w-3 h-3" />
                                Low-Latency • Local-Only • Zero-Cloud
                            </div>
                        </div>

                        <button
                            onClick={handleInitialize}
                            className="group relative w-full py-4 text-black font-black uppercase tracking-widest bg-blue-500 hover:bg-blue-400 transition-all active:scale-[0.98] overflow-hidden rounded-lg shadow-lg shadow-blue-500/20"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-[-20deg]" />
                            <span className="relative flex items-center justify-center gap-3">
                                Initialize Subsystem
                                <Activity className="w-5 h-5" />
                            </span>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Progress Ring / Area */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                    <div className="text-[10px] text-blue-500/60 font-black uppercase tracking-widest">
                                        Data Stream Integrity
                                    </div>
                                    <div className="text-lg font-black text-white italic tabular-nums">
                                        {progress?.message || 'SYNC_PHASE: Active...'}
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-blue-400 italic tabular-nums">
                                    {Math.round(progress?.percent || 0)}%
                                </div>
                            </div>

                            {/* Main Progress Bar */}
                            <div className="h-3 bg-white/5 border border-white/10 rounded-full overflow-hidden relative">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-700 via-blue-400 to-blue-200 transition-all duration-500 relative"
                                    style={{ width: `${progress?.percent || 2}%` }}
                                >
                                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-[shimmer_1.5s_infinite] w-[200px]" />
                                </div>
                            </div>
                        </div>

                        {/* Terminal Data Feed */}
                        <div className="border border-white/5 bg-black/40 rounded-xl p-4 overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-2 opacity-20">
                                <Terminal className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="space-y-2">
                                {logs.map((log, i) => (
                                    <div key={i} className={`text-[10px] whitespace-pre transition-opacity duration-300 ${i === logs.length - 1 ? 'text-blue-400' : 'text-white/20'}`}>
                                        <span className="opacity-40 mr-2">{'>'}</span>{log}
                                    </div>
                                ))}
                                {isSyncing && (
                                    <div className="flex items-center gap-2 text-[10px] text-blue-400 font-bold italic animate-pulse">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        COMM_UPLINK_ESTABLISHED...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Security Badge */}
                <div className="mt-12 pt-6 border-t border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-[8px] text-white/30 tracking-[0.3em] font-bold uppercase italic">
                        <Shield className="w-3 h-3" />
                        TRUNCATE_SHIELD v1.2 // SECURE_RUNTIME
                    </div>
                    <div className="text-[8px] text-blue-500/40 uppercase font-black tabular-nums">
                        SYS::{Date.now().toString().slice(-8)}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scan {
                    0% { transform: translateY(-100vh); }
                    100% { transform: translateY(100vh); }
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

export default EngineSetupScreen;
