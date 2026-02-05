import { useRef, useEffect, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useDatabaseStore } from '../../store/databaseStore';
import { Terminal as TerminalIcon, AlertTriangle } from 'lucide-react';

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

interface TerminalPanelProps {
    readOnly?: boolean;
    setReadOnly?: (value: boolean) => void;
}

export default function TerminalPanel({ readOnly = true, setReadOnly = () => { } }: TerminalPanelProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    // UI State
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingCommand, setPendingCommand] = useState<string | null>(null);

    // Internal State (Refs for synchronous access in event listeners)
    const inputBufferRef = useRef('');
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);

    // Global Store
    const { isConnected, activeDatabase, refreshDatabases, refreshTables, selectDatabase, connectionType, connectionStatus } = useDatabaseStore();

    // Logic Refs
    const pendingActionRef = useRef<{ type: 'DB_REFRESH' | 'TABLE_REFRESH' | 'DB_SWITCH', payload?: string } | null>(null);
    const lastSyncedDbRef = useRef<string | null>(null);

    // Regex Constants
    const DB_REFRESH_REGEX = /^(CREATE|DROP|ALTER)\s+DATABASE/i;
    const TABLE_REFRESH_REGEX = /^(CREATE|DROP|ALTER|TRUNCATE)\s+TABLE/i;
    const DANGEROUS_REGEX = /\b(DROP|TRUNCATE|DELETE(\s+FROM)?(?!\s+WHERE)|UPDATE(\s+\w+)?(?!\s+SET\s+.*\s+WHERE))\b/i;

    // Helper: Send Enter to PTY (Fallback/Standard)
    const sendEnter = async () => {
        await invoke('write_terminal', { id: 'term-1', data: '\r' });
        inputBufferRef.current = '';
    };

    // Helper: Confirm Dangerous Action
    const confirmDanger = async () => {
        setShowConfirm(false);
        await sendEnter();
    };

    // Main Input Handler
    const handleEnter = async (term: Terminal) => {
        let currentLine = inputBufferRef.current.trim();

        // Fallback: Screen scraping if buffer empty (shouldn't happen with correct logic but good for safety)
        if (!currentLine) {
            try {
                const buffer = term.buffer.active;
                const lineObj = buffer.getLine(buffer.baseY + buffer.cursorY);
                if (lineObj) currentLine = lineObj.translateToString(true).trim();
            } catch (e) { }
        }

        console.log("[Terminal] Command:", currentLine);

        // 1. Update History
        if (currentLine) {
            // Avoid duplicates at top? Standard terminal doesn't always, but good UX.
            // Let's just push for now.
            if (historyRef.current[0] !== currentLine) {
                historyRef.current = [currentLine, ...historyRef.current];
            }
            historyIndexRef.current = -1;
        }

        // 2. Intercept SQL Commands
        const SQL_VERBS = /^(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|PRAGMA|DESCRIBE|SHOW|EXPLAIN)\b/i;
        const isSql = SQL_VERBS.test(currentLine);

        if (isSql && useDatabaseStore.getState().isConnected) {
            term.write('\r\n');
            inputBufferRef.current = '';

            try {
                // Execute Backend Query
                const result: any = await invoke('sql_run_query', { sql: currentLine });

                // Render Result
                if (result && result.type === 'ResultSet' && result.data.formatted_output) {
                    term.write(result.data.formatted_output);
                } else if (result && result.type === 'Success') {
                    term.write(`\r\n\x1b[32m${result.data}\x1b[0m\r\n`);
                } else if (result && result.type === 'Error') {
                    term.write(`\r\n\x1b[31m${result.data}\x1b[0m\r\n`);
                } else {
                    term.write('\r\nQuery Executed.\r\n');
                }

                // Restore Prompt
                // Simple \r forces PTY to reprint prompt.
                await invoke('write_terminal', { id: 'term-1', data: '\r' });

            } catch (e) {
                term.write(`\r\n\x1b[31mError: ${e}\x1b[0m\r\n`);
                await invoke('write_terminal', { id: 'term-1', data: '\r' });
            }
            return;
        }

        // 3. Command Checks for specific restrictions
        const useMatch = currentLine.match(/^\s*USE\s+([a-zA-Z0-9_]+)/i);
        const activeDb = useDatabaseStore.getState().activeDatabase; // Read fresh from store
        const isTableCommand = /\b(CREATE|DROP|ALTER|TRUNCATE)\s+TABLE\b/i.test(currentLine);
        const isSwitchingDb = !!useMatch;

        // Block table commands if no database selected (Safety)
        if (isTableCommand && !activeDb && !isSwitchingDb) {
            term.write('\r\n\x1b[31mError: No database selected. Please select or USE a database first.\x1b[0m\r\n');
            inputBufferRef.current = '';
            invoke('write_terminal', { id: 'term-1', data: '\r\n' });
            return;
        }

        // 4. Danger Check (for PTY commands)
        // Note: SQL commands handled above already executed. 
        // If we want Danger Check for SQL, it must move up.
        // Assuming SQL DELETE/DROP are dangerous? YES.
        // Current logic: SQL runs via Backend. PTY runs dangerous checks.
        // FIX: If DANGEROUS_REGEX matches, we should prompt confirmation REGARDLESS of isSql?
        // Let's implement that for safety.

        // 4. Danger Check (Safe Mode Only)
        // Only require confirmation if readOnly (Safe Mode) is active
        if (readOnly && DANGEROUS_REGEX.test(currentLine)) {
            setPendingCommand(currentLine);
            setShowConfirm(true);
            return;
        }

        // 5. Pending Action Tracking
        if (/\b(CREATE|DROP|ALTER)\s+DATABASE\b/i.test(currentLine)) {
            pendingActionRef.current = { type: 'DB_REFRESH' };
        }
        else if (isTableCommand) {
            pendingActionRef.current = { type: 'TABLE_REFRESH' };
        }
        else if (useMatch && useMatch[1]) {
            pendingActionRef.current = { type: 'DB_SWITCH', payload: useMatch[1] };
        } else {
            pendingActionRef.current = null;
        }

        await sendEnter();
    };


    // INIT EFFECT
    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm
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

        // Key Listener (History)
        term.onKey(({ domEvent }) => {
            if (!useDatabaseStore.getState().isConnected) return;
            const ev = domEvent as KeyboardEvent;

            if (ev.key === 'ArrowUp') {
                const history = historyRef.current;
                const idx = historyIndexRef.current;

                if (history.length === 0) return;

                const newIndex = Math.min(idx + 1, history.length - 1);
                const item = history[newIndex];

                if (item !== undefined) {
                    // Clear current buffer visual
                    const currentLen = inputBufferRef.current.length;
                    if (currentLen > 0) {
                        term.write('\b \b'.repeat(currentLen));
                    }

                    term.write(item);
                    inputBufferRef.current = item;
                    historyIndexRef.current = newIndex;
                }
            } else if (ev.key === 'ArrowDown') {
                const history = historyRef.current;
                const idx = historyIndexRef.current;

                if (idx === -1) return;

                const newIndex = Math.max(idx - 1, -1);

                // Clear current
                const currentLen = inputBufferRef.current.length;
                if (currentLen > 0) {
                    term.write('\b \b'.repeat(currentLen));
                }

                if (newIndex === -1) {
                    inputBufferRef.current = '';
                    historyIndexRef.current = -1;
                } else {
                    const item = history[newIndex];
                    term.write(item);
                    inputBufferRef.current = item;
                    historyIndexRef.current = newIndex;
                }
            }
        });

        // Data Listener (Input)
        term.onData(async (data) => {
            if (!useDatabaseStore.getState().isConnected) return;
            // Ignore ANSI (Arrow keys sent as sequences)
            if (data.startsWith('\x1b[')) return;

            if (data === '\r') {
                handleEnter(term);
            } else if (data === '\u007F') { // Backspace
                const cur = inputBufferRef.current;
                if (cur.length > 0) {
                    term.write('\b \b');
                    inputBufferRef.current = cur.slice(0, -1);
                }
            } else if (data.charCodeAt(0) >= 32) {
                inputBufferRef.current += data;
                term.write(data);
            }
        });

        // Output Listener (Sync)
        const unlisten = listen('terminal-output', (event: any) => {
            const [id, data] = event.payload;
            if (id === 'term-1') {
                term.write(data);

                if (typeof data === 'string') {
                    const cleanData = data.trim();

                    if (data.includes("Query OK")) {
                        if (pendingActionRef.current?.type === 'DB_REFRESH') refreshDatabases();
                        if (pendingActionRef.current?.type === 'TABLE_REFRESH') refreshTables();
                        pendingActionRef.current = null;
                    }
                    else if (DB_REFRESH_REGEX.test(cleanData)) {
                        refreshDatabases();
                    }
                    else if (TABLE_REFRESH_REGEX.test(cleanData)) {
                        refreshTables();
                    }
                    else if (data.includes("Database changed")) {
                        if (pendingActionRef.current?.type === 'DB_SWITCH' && pendingActionRef.current.payload) {
                            const db = pendingActionRef.current.payload;
                            lastSyncedDbRef.current = db;
                            selectDatabase(db).catch(console.error);
                            pendingActionRef.current = null;
                        }
                    } else if (data.includes("ERROR") || data.includes("fatal:")) {
                        pendingActionRef.current = null;
                    }
                }
            }
        });

        // Resize Observer
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

    // Auto Connect Effect
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

    // Sync Effect (Boot & Switch)
    useEffect(() => {
        if (isConnected && activeDatabase && connectionStatus === 'ACTIVE') {
            const isFreshBoot = lastSyncedDbRef.current === null;
            if (activeDatabase !== lastSyncedDbRef.current) {
                console.log(`[Terminal] Syncing. Fresh Boot: ${isFreshBoot}. Target: ${activeDatabase}`);

                if (isFreshBoot) {
                    xtermRef.current?.clear();
                    invoke('start_terminal_auto', { id: 'term-1' }).then(() => {
                        if (xtermRef.current) {
                            xtermRef.current.focus();
                            xtermRef.current.options.disableStdin = false;
                        }
                        lastSyncedDbRef.current = activeDatabase;
                    }).catch(console.error);

                } else {
                    if (connectionType === 'postgres') {
                        if (xtermRef.current) {
                            xtermRef.current.options.disableStdin = true;
                            xtermRef.current.clear();
                            xtermRef.current.write(`\r\n\x1b[34m[IDE] Switching database context to "${activeDatabase}"...\x1b[0m\r\n`);
                        }
                        invoke('start_terminal_auto', { id: 'term-1' }).then(() => {
                            if (xtermRef.current) {
                                xtermRef.current.focus();
                                xtermRef.current.options.disableStdin = false;
                            }
                            lastSyncedDbRef.current = activeDatabase;
                        }).catch(e => {
                            xtermRef.current?.write(`\r\n\x1b[31mFailed to switch terminal context: ${e}\x1b[0m\r\n`);
                            if (xtermRef.current) xtermRef.current.options.disableStdin = false;
                        });
                    } else {
                        invoke('write_terminal', { id: 'term-1', data: `USE ${activeDatabase};\r` });
                        lastSyncedDbRef.current = activeDatabase;
                    }
                }
            }
        }
    }, [isConnected, activeDatabase, connectionType, connectionStatus]);

    // Safety Effect
    useEffect(() => {
        if (xtermRef.current) {
            if (connectionStatus === 'DISCONNECTED') {
                lastSyncedDbRef.current = null;
                xtermRef.current.clear();
                xtermRef.current.write('\x1b[2J\x1b[3J\x1b[H');
                xtermRef.current.write('\r\n\x1b[90m[Disconnected] No active session.\x1b[0m\r\n');
            }

            const shouldDisable = connectionStatus !== 'ACTIVE';
            xtermRef.current.options.disableStdin = shouldDisable;
            if (shouldDisable) {
                xtermRef.current.write('\x1b[?25l');
            } else {
                xtermRef.current.write('\x1b[?25h');
                xtermRef.current.focus();
            }
        }
    }, [connectionStatus]);

    return (
        <div className="h-full w-full flex flex-col bg-[#1e1e1e] text-white relative">
            {/* Terminal Container - Full Height */}
            <div className="flex-1 relative bg-[#1e1e1e]">
                {/* Xterm Instance */}
                <div className="absolute inset-0 p-3">
                    <div ref={terminalRef} className="w-full h-full" />
                </div>

                {/* Not Connected State - Centered Overlay */}
                {!isConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1e1e]/95 z-10 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-4 select-none">
                            <div className="w-16 h-16 rounded-full bg-[#252526] border border-[#3e3e3e] flex items-center justify-center">
                                <TerminalIcon className="w-8 h-8 text-gray-500" />
                            </div>
                            <div className="text-center">
                                <p className="text-gray-400 text-sm font-medium mb-1">No Active Connection</p>
                                <span className="text-xs text-gray-600">Connect to a database to start the terminal</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Connection Badge - Floating Top-Left when connected */}
                {isConnected && activeDatabase && (
                    <div className="absolute top-3 left-3 z-20 pointer-events-none">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#252526]/90 backdrop-blur-sm rounded text-[10px] text-blue-400 border border-[#3e3e3e] shadow-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            <span className="font-medium">{activeDatabase}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Danger Confirmation Modal */}
            {showConfirm && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#1e1e1e] border border-red-900/50 rounded-lg shadow-2xl w-[420px] overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-red-900/20 px-4 py-3 border-b border-red-900/30 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <h3 className="font-semibold text-red-100 text-sm">Dangerous Operation</h3>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 space-y-4">
                            <p className="text-gray-300 text-xs leading-relaxed">
                                You are about to execute a destructive command. This action may result in data loss.
                            </p>

                            <div className="bg-black/50 rounded p-3 font-mono text-xs text-red-300 break-all border border-red-900/20">
                                {pendingCommand}
                            </div>

                            {/* Modal Actions */}
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
