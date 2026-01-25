import { useRef, useEffect, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useDatabaseStore } from '../../store/databaseStore';
import { Unlock, Terminal as TerminalIcon, ShieldAlert, AlertTriangle } from 'lucide-react';

const DANGEROUS_REGEX = /\b(DROP|TRUNCATE|DELETE(\s+FROM)?(?!\s+WHERE)|UPDATE(\s+\w+)?(?!\s+SET\s+.*\s+WHERE))\b/i;

// VS Code Dark Modern Colors
const THEME = {
    background: '#181818',
    foreground: '#cccccc',
    cursor: '#ffffff',
    selection: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5',
};

export default function TerminalPanel() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [readOnly, setReadOnly] = useState(true);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingCommand, setPendingCommand] = useState<string | null>(null);
    const [inputBuffer, setInputBuffer] = useState('');

    // Use global store for connection status
    const { isConnected, activeDatabase, refreshDatabases, refreshTables, selectDatabase } = useDatabaseStore();

    // Track pending actions based on executed commands
    const pendingActionRef = useRef<{ type: 'DB_REFRESH' | 'TABLE_REFRESH' | 'DB_SWITCH', payload?: string } | null>(null);

    // Track last DB synced to terminal to avoid feedback loops
    const lastSyncedDbRef = useRef<string | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        // 1. Initialize Terminal
        const term = new Terminal({
            cursorBlink: true,
            fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace",
            fontSize: 13,
            lineHeight: 1.4,
            letterSpacing: 0,
            theme: THEME,
            allowProposedApi: true,
            smoothScrollDuration: 100,
            scrollback: 5000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // 2. Handle Input (Safety Layer + Command Detection)
        term.onData(async (data) => {
            if (!useDatabaseStore.getState().isConnected) return;

            if (data === '\r') { // Enter key
                handleEnter(term);
            } else {
                if (data === '\u007F') { // Backspace
                    setInputBuffer(prev => prev.slice(0, -1));
                } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
                    setInputBuffer(prev => prev + data);
                }
                await invoke('write_terminal', { id: 'term-1', data });
            }
        });

        // 3. Handle Output (Success Detection)
        const unlisten = listen('terminal-output', (event: any) => {
            const [id, data] = event.payload;
            if (id === 'term-1') {
                term.write(data);

                // Analyze output for success confirmation
                // We check specifically for MySQL standard success messages
                if (typeof data === 'string') {
                    if (data.includes("Query OK")) {
                        // DDL Success
                        const action = pendingActionRef.current;
                        if (action) {
                            console.log("[Terminal] Success detected. Triggering action:", action.type);
                            if (action.type === 'DB_REFRESH') refreshDatabases();
                            if (action.type === 'TABLE_REFRESH') refreshTables();
                            // Clear action after triggering
                            pendingActionRef.current = null;
                        }
                    } else if (data.includes("Database changed")) {
                        // USE command success
                        const action = pendingActionRef.current;
                        if (action && action.type === 'DB_SWITCH' && action.payload) {
                            console.log("[Terminal] Switch detected. Syncing UI to:", action.payload);
                            // Update local ref so we don't echo back
                            lastSyncedDbRef.current = action.payload;
                            selectDatabase(action.payload).catch(console.error);
                            pendingActionRef.current = null;
                        }
                    } else if (data.includes("ERROR")) {
                        // If error, clear pending action so we don't trigger on next success randomly
                        if (pendingActionRef.current) {
                            console.log("[Terminal] Command failed. clearing pending action.");
                            pendingActionRef.current = null;
                        }
                    }
                }
            }
        });

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => {
                fitAddon.fit();
                const dims = fitAddon.proposeDimensions();
                if (dims && useDatabaseStore.getState().isConnected) {
                    invoke('resize_terminal', { id: 'term-1', rows: dims.rows, cols: dims.cols });
                }
            });
        });
        resizeObserver.observe(terminalRef.current);

        return () => {
            term.dispose();
            resizeObserver.disconnect();
            unlisten.then(f => f());
        };
    }, []);

    // ... (Auto Connect Effect stays same)
    useEffect(() => {
        if (isConnected) {
            xtermRef.current?.clear();
            invoke('start_terminal_auto', { id: 'term-1' }).then(() => {
                setTimeout(() => {
                    fitAddonRef.current?.fit();
                    const dims = fitAddonRef.current?.proposeDimensions();
                    if (dims) invoke('resize_terminal', { id: 'term-1', rows: dims.rows, cols: dims.cols });
                    xtermRef.current?.focus();
                }, 100);
            }).catch(e => {
                xtermRef.current?.write(`\r\n\x1b[31mFailed to launch terminal: ${e}\x1b[0m\r\n`);
            });
        } else {
            xtermRef.current?.clear();
        }
    }, [isConnected]);

    // UI -> Terminal Sync Effect
    useEffect(() => {
        if (isConnected && activeDatabase) {
            if (activeDatabase !== lastSyncedDbRef.current) {
                console.log(`[Terminal] UI switched to ${activeDatabase}. Syncing terminal...`);
                // Send USE command to terminal silently-ish (it will appear in history/output which is correct)
                invoke('write_terminal', { id: 'term-1', data: `USE ${activeDatabase};\r` });
                lastSyncedDbRef.current = activeDatabase;
            }
        }
    }, [isConnected, activeDatabase]);

    const stateRef = useRef({ readOnly, inputBuffer });
    useEffect(() => {
        stateRef.current = { readOnly, inputBuffer };
    }, [readOnly, inputBuffer]);


    const handleEnter = async (term: Terminal) => {
        // Source of Truth: The current line in the terminal buffer.
        // This captures typed commands AND history (Up Arrow).
        // We look at cursorY.
        let currentLine = "";
        try {
            // Get current line (might be partial if wrapped, but usually enough for keyword detection)
            const buffer = term.buffer.active;
            const lineObj = buffer.getLine(buffer.baseY + buffer.cursorY);
            if (lineObj) {
                currentLine = lineObj.translateToString(true).trim();
            }
        } catch (e) {
            // fallback
            currentLine = stateRef.current.inputBuffer;
        }

        console.log("[Terminal] Parsing Line:", currentLine);

        // check for USE match first to update ref if needed (though output listener handles it)
        const useMatch = currentLine.match(/^\s*USE\s+([a-zA-Z0-9_]+)/i);

        // 0. Block Table commands if no DB selected
        // We check if it's a table command AND we are not switching DB
        // AND we don't have an active database.
        const activeDb = useDatabaseStore.getState().activeDatabase; // Get fresh state
        const isTableCommand = /\b(CREATE|DROP|ALTER|TRUNCATE)\s+TABLE\b/i.test(currentLine);
        const isSwitchingDb = !!useMatch;

        if (isTableCommand && !activeDb && !isSwitchingDb) {
            term.write('\r\n\x1b[31mError: No database selected. Please select or USE a database first.\x1b[0m\r\n');
            // We do NOT sendEnter here, effectively blocking the command
            setInputBuffer(''); // clear local buffer
            invoke('write_terminal', { id: 'term-1', data: '\r\n' }); // Echo newline to clear visual
            return;
        }

        // 1. Safety Check (still verify regex against current line)
        if (DANGEROUS_REGEX.test(currentLine)) {
            setPendingCommand(currentLine);
            setShowConfirm(true);
            return;
        }

        // 2. Action Classification
        // Determine what to do *IF* the command succeeds
        if (/\b(CREATE|DROP|ALTER)\s+DATABASE\b/i.test(currentLine)) {
            pendingActionRef.current = { type: 'DB_REFRESH' };
        }
        else if (isTableCommand) {
            pendingActionRef.current = { type: 'TABLE_REFRESH' };
        }
        else {
            if (useMatch && useMatch[1]) {
                pendingActionRef.current = { type: 'DB_SWITCH', payload: useMatch[1] };
            } else {
                pendingActionRef.current = null;
            }
        }

        await sendEnter();
    };

    const sendEnter = async () => {
        await invoke('write_terminal', { id: 'term-1', data: '\r' });
        setInputBuffer('');
    };

    const confirmDanger = async () => {
        setShowConfirm(false);
        await sendEnter();
    };

    return (
        <div className="h-full w-full flex flex-col bg-[#181818] text-white">
            {/* Minimalist Header */}
            <div className="flex items-center justify-between h-9 px-3 bg-[#181818] border-b border-[#2b2b2b]">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors cursor-default select-none">
                        <TerminalIcon className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium tracking-wide uppercase">Terminal</span>
                    </div>

                    {/* Connection Badge */}
                    {isConnected && activeDatabase && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#252526] rounded text-[10px] text-blue-400 border border-[#3e3e3e]">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            {activeDatabase}
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                    {/* Safe Mode Toggle */}
                    <button
                        onClick={() => setReadOnly(!readOnly)}
                        className={`
                            flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-all
                            ${readOnly
                                ? 'bg-amber-900/20 text-amber-500 border border-amber-900/50 hover:bg-amber-900/30'
                                : 'bg-[#252526] text-gray-500 border border-[#3e3e3e] hover:text-gray-300'}
                        `}
                        title={readOnly ? "Safe Mode Active: Dangerous commands require confirmation" : "Unrestricted Mode"}
                    >
                        {readOnly ? <ShieldAlert className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>{readOnly ? 'Safe Mode' : 'Unrestricted'}</span>
                    </button>
                </div>
            </div>

            {/* Terminal Container */}
            <div className="flex-1 relative bg-[#181818]">
                {/* 
                   Padding added via wrapper div to avoid xterm internal padding issues with fit addon 
                   But VSCode Terminal is edge-to-edge usually. Let's keep a tiny padding for aesthetics.
                */}
                <div className="absolute inset-0 pl-3 pt-2 pb-1 pr-1">
                    <div ref={terminalRef} className="w-full h-full" />
                </div>

                {/* Not Connected State */}
                {!isConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#181818]/90 z-10 pointer-events-none">
                        <div className="flex flex-col items-center gap-3 opacity-60">
                            <TerminalIcon className="w-12 h-12 text-gray-600" />
                            <p className="text-gray-500 text-sm font-medium">No Active Connection</p>
                            <span className="text-xs text-gray-600">Connect to a database to start the terminal</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Danger Modal */}
            {showConfirm && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
                    <div className="bg-[#1e1e1e] border border-red-900/50 rounded-lg shadow-2xl w-[400px] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="bg-red-900/20 px-4 py-3 border-b border-red-900/30 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <h3 className="font-semibold text-red-100 text-sm">Dangerous Operation</h3>
                        </div>

                        <div className="p-4 space-y-4">
                            <p className="text-gray-300 text-xs leading-relaxed">
                                You are about to execute a destructive command. This action may result in data loss.
                            </p>

                            <div className="bg-black/50 rounded p-3 font-mono text-xs text-red-300 break-all border border-red-900/20">
                                {pendingCommand}
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    className="px-3 py-1.5 rounded text-xs font-medium text-gray-400 hover:text-white hover:bg-[#3e3e3e] transition-colors"
                                    onClick={() => setShowConfirm(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="px-3 py-1.5 rounded text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg shadow-red-900/20"
                                    onClick={confirmDanger}
                                >
                                    Confirm Execution
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
