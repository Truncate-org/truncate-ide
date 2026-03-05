import { useRef, useEffect, useState, memo, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useDatabaseStore } from '../../store/databaseStore';
import { Terminal as TerminalIcon, AlertTriangle, Loader2 } from 'lucide-react';

// VS Code Dark Modern Colors
const THEME = {
    background: '#1e1e1e', // Matched to parent container
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

// Prompt detection patterns per DB type
const PROMPT_PATTERNS: Record<string, RegExp> = {
    mysql: /mysql.*>\s*$/,
    postgres: /[a-zA-Z_]+=?[#>]\s*$/,
    sqlite: /sqlite>\s*$/,
};

// Dangerous command regex
const DANGEROUS_REGEX = /\b(DROP|TRUNCATE|DELETE(\s+FROM)?(?!\s+WHERE)|UPDATE(\s+\w+)?(?!\s+SET\s+.*\s+WHERE))\b/i;

// Count complete SQL statements (separated by ;)
function countStatements(sql: string): number {
    // Strip string literals and comments to avoid false ; matches
    const cleaned = sql
        .replace(/'[^']*'/g, "''")       // Remove string contents
        .replace(/"[^"]*"/g, '""')       // Remove quoted identifiers
        .replace(/--.*$/gm, '')          // Remove line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .trim();

    if (!cleaned) return 0;

    // Split by ; and count non-empty segments
    const parts = cleaned.split(';').filter(p => p.trim().length > 0);
    // If input ends with ;, the last split will be empty, so we count the parts before
    return parts.length;
}

interface TerminalPanelProps {
    readOnly?: boolean;
    setReadOnly?: (value: boolean) => void;
    isVisible?: boolean;
}

function TerminalPanelInner({ readOnly = true, setReadOnly: _setReadOnly = () => { }, isVisible = true }: TerminalPanelProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    // UI State
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingCommand, setPendingCommand] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    // Internal State (Refs for synchronous access in event listeners)
    const inputBufferRef = useRef('');
    const multilineBufferRef = useRef('');  // Accumulates multiline input
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const inputCursorRef = useRef(0);
    const isExecutingRef = useRef(false);
    const wasFocusedRef = useRef(false);

    // Global Store
    const { isConnected, activeDatabase, refreshDatabases, refreshTables, selectDatabase, connectionType, connectionStatus } = useDatabaseStore();

    // Logic Refs
    const pendingActionRef = useRef<{ type: 'DB_REFRESH' | 'TABLE_REFRESH' | 'DB_SWITCH', payload?: string } | null>(null);
    const lastSyncedDbRef = useRef<string | null>(null);

    // Regex Constants
    const DB_REFRESH_REGEX = /^(CREATE|DROP|ALTER)\s+DATABASE/i;
    const TABLE_REFRESH_REGEX = /^(CREATE|DROP|ALTER|TRUNCATE)\s+TABLE/i;

    const instanceIdRef = useRef(`term-${Math.random().toString(36).substr(2, 9)}`);

    // Helper: Send raw data to PTY
    const sendToPty = useCallback(async (data: string) => {
        try {
            await invoke('write_terminal', { id: instanceIdRef.current, data });
        } catch (e) {
            console.error('[Terminal] Failed to write to PTY:', e);
        }
    }, []);

    // Helper: Confirm Dangerous Action — send the buffered command
    const confirmDanger = useCallback(async () => {
        setShowConfirm(false);
        const cmd = pendingCommand;
        setPendingCommand(null);
        if (cmd) {
            await sendToPty(cmd + '\x0D');
        }
    }, [pendingCommand, sendToPty]);

    // Main Enter handler — pure PTY pass-through with safety checks
    const handleEnter = useCallback(async (term: Terminal) => {
        const currentLine = inputBufferRef.current;

        // Accumulate into multiline buffer
        const fullBuffer = multilineBufferRef.current
            ? multilineBufferRef.current + '\n' + currentLine
            : currentLine;

        const trimmed = fullBuffer.trim();

        // 1. Check for multi-statement (more than 1 semicolon-terminated statement)
        if (trimmed.includes(';') && countStatements(trimmed) > 1) {
            term.write('\r\n\x1b[33m⚠  Run one statement at a time.\x1b[0m\r\n');
            // Re-print the prompt by sending a blank Enter to PTY
            await sendToPty('\x0D');
            inputBufferRef.current = '';
            inputCursorRef.current = 0;
            multilineBufferRef.current = '';
            return;
        }

        // 2. Safety check: dangerous commands in Safe Mode
        if (readOnly && DANGEROUS_REGEX.test(trimmed) && trimmed.endsWith(';')) {
            setPendingCommand(trimmed);
            setShowConfirm(true);
            inputBufferRef.current = '';
            inputCursorRef.current = 0;
            multilineBufferRef.current = '';
            return;
        }

        // 3. Track pending actions for DB/table refresh
        const useMatch = trimmed.match(/^\s*USE\s+([a-zA-Z0-9_]+)/i);
        if (/\b(CREATE|DROP|ALTER)\s+DATABASE\b/i.test(trimmed)) {
            pendingActionRef.current = { type: 'DB_REFRESH' };
        } else if (/\b(CREATE|DROP|ALTER|TRUNCATE)\s+TABLE\b/i.test(trimmed)) {
            pendingActionRef.current = { type: 'TABLE_REFRESH' };
        } else if (useMatch && useMatch[1]) {
            pendingActionRef.current = { type: 'DB_SWITCH', payload: useMatch[1] };
        } else {
            pendingActionRef.current = null;
        }

        // 4. Check if statement is complete (ends with ;) or if it's a non-SQL command
        const isStatementComplete = trimmed.endsWith(';');
        const isMeta = /^\\|^SHOW\s|^DESCRIBE\s|^DESC\s|^EXPLAIN\s|^USE\s|^HELP|^QUIT|^EXIT|^\./i.test(trimmed);

        if (isStatementComplete || isMeta || !trimmed) {
            // Complete statement or meta-command — mark as executing
            if (trimmed) {
                isExecutingRef.current = true;
                setIsExecuting(true);

                // Update history with the full multiline command
                if (historyRef.current[0] !== trimmed) {
                    historyRef.current = [trimmed, ...historyRef.current.slice(0, 100)];
                }
                historyIndexRef.current = -1;

                // SYNC TERMINAL TO GRID: Silently execute reading queries in the background so the Grid updates
                if (/^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|PRAGMA)/i.test(trimmed)) {
                    invoke('sql_run_query', { sql: trimmed }).catch(e => {
                        console.warn("[Terminal Sync] Silently ignored grid update error:", e);
                    });
                }
            }

            // Send Enter to PTY — the CLI handles execution
            await sendToPty(currentLine + '\x0D');

            // Reset buffers
            inputBufferRef.current = '';
            inputCursorRef.current = 0;
            multilineBufferRef.current = '';
        } else {
            // Incomplete statement — multiline: send Enter to PTY (CLI shows continuation prompt)
            multilineBufferRef.current = fullBuffer;

            await sendToPty(currentLine + '\x0D');

            inputBufferRef.current = '';
            inputCursorRef.current = 0;
        }
    }, [readOnly, sendToPty]);

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

        // Helper to redraw line during editing (arrow keys, history)
        const redrawLine = (newBuffer: string, newCursor: number) => {
            const oldCursor = inputCursorRef.current;
            if (oldCursor > 0) {
                term.write('\x1b[D'.repeat(oldCursor));
            }
            term.write('\x1b[K');
            term.write(newBuffer);

            const distanceBack = newBuffer.length - newCursor;
            if (distanceBack > 0) {
                term.write('\x1b[D'.repeat(distanceBack));
            }

            inputBufferRef.current = newBuffer;
            inputCursorRef.current = newCursor;
        };

        // Key Listener — arrows, home, end
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
                    // For multiline history, only show the first line in the buffer
                    const displayItem = item.replace(/\n/g, ' ');
                    redrawLine(displayItem, displayItem.length);
                    historyIndexRef.current = newIndex;
                }
            }
            else if (ev.key === 'ArrowDown') {
                const history = historyRef.current;
                const idx = historyIndexRef.current;
                if (idx === -1) return;

                const newIndex = Math.max(idx - 1, -1);

                if (newIndex === -1) {
                    redrawLine('', 0);
                    historyIndexRef.current = -1;
                } else {
                    const item = history[newIndex];
                    const displayItem = item.replace(/\n/g, ' ');
                    redrawLine(displayItem, displayItem.length);
                    historyIndexRef.current = newIndex;
                }
            }
            else if (ev.key === 'ArrowLeft') {
                if (inputCursorRef.current > 0) {
                    inputCursorRef.current--;
                    term.write('\x1b[D');
                }
            }
            else if (ev.key === 'ArrowRight') {
                if (inputCursorRef.current < inputBufferRef.current.length) {
                    inputCursorRef.current++;
                    term.write('\x1b[C');
                }
            }
            else if (ev.key === 'Home') {
                if (inputCursorRef.current > 0) {
                    term.write('\x1b[D'.repeat(inputCursorRef.current));
                    inputCursorRef.current = 0;
                }
            }
            else if (ev.key === 'End') {
                const len = inputBufferRef.current.length;
                if (inputCursorRef.current < len) {
                    term.write('\x1b[C'.repeat(len - inputCursorRef.current));
                    inputCursorRef.current = len;
                }
            }
        });

        // Data Listener (Input from user keystrokes)
        term.onData(async (data) => {
            if (!useDatabaseStore.getState().isConnected) return;
            // Ignore ANSI sequences we handled in onKey
            if (data.startsWith('\x1b[')) return;

            if (data === '\r') {
                handleEnter(term);
            } else if (data === '\u007F') { // Backspace
                const cur = inputBufferRef.current;
                const pos = inputCursorRef.current;
                if (pos > 0) {
                    term.write('\b\x1b[K');
                    const tail = cur.slice(pos);
                    term.write(tail);
                    if (tail.length > 0) term.write('\x1b[D'.repeat(tail.length));

                    inputBufferRef.current = cur.slice(0, pos - 1) + cur.slice(pos);
                    inputCursorRef.current = pos - 1;
                }
            } else if (data === '\x03') {
                // Ctrl+C — send interrupt to PTY
                sendToPty('\x03');
                inputBufferRef.current = '';
                inputCursorRef.current = 0;
                multilineBufferRef.current = '';
                isExecutingRef.current = false;
                setIsExecuting(false);
            } else if (data.charCodeAt(0) >= 32) {
                // Printable character
                const cur = inputBufferRef.current;
                const pos = inputCursorRef.current;

                const newVal = cur.slice(0, pos) + data + cur.slice(pos);

                term.write(data);

                const tail = cur.slice(pos);
                if (tail.length > 0) {
                    term.write(tail);
                    term.write('\x1b[D'.repeat(tail.length));
                }

                inputBufferRef.current = newVal;
                inputCursorRef.current = pos + data.length;
            }
        });

        // Output Listener (data coming FROM the PTY)
        const unlisten = listen('terminal-output', (event: any) => {
            const [id, data] = event.payload;
            if (id === instanceIdRef.current) {
                term.write(data);

                if (typeof data === 'string') {
                    const cleanData = data.trim();

                    // Detect prompt = execution finished
                    const ct = useDatabaseStore.getState().connectionType;
                    const promptPattern = ct && PROMPT_PATTERNS[ct] ? PROMPT_PATTERNS[ct] : /[>=#]\s*$/;

                    if (promptPattern.test(data)) {
                        if (isExecutingRef.current) {
                            isExecutingRef.current = false;
                            setIsExecuting(false);
                        }
                    }

                    // Detect DB/table changes from PTY output
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
                        if (isExecutingRef.current) {
                            isExecutingRef.current = false;
                            setIsExecuting(false);
                        }
                    }
                }
            }
        });

        // Terminal Exit Listener — PTY process died
        const unlistenExit = listen('terminal-exit', (event: any) => {
            const id = event.payload;
            if (id === instanceIdRef.current) {
                term.write('\r\n\x1b[31m[Terminal] Session ended. Reconnect to restart.\x1b[0m\r\n');
                term.options.disableStdin = true;
                isExecutingRef.current = false;
                setIsExecuting(false);
            }
        });

        // Resize Observer
        const resizeObserver = new ResizeObserver(() => {
            // Track focus state before resize
            wasFocusedRef.current = document.activeElement === term.textarea;

            requestAnimationFrame(() => {
                try {
                    fitAddon.fit();
                    const dims = fitAddon.proposeDimensions();
                    if (dims && useDatabaseStore.getState().isConnected) {
                        invoke('resize_terminal', { id: instanceIdRef.current, rows: dims.rows, cols: dims.cols });
                    }
                    // Restore focus if it was focused before resize
                    if (wasFocusedRef.current) {
                        term.focus();
                    }
                } catch (e) {
                    // Ignore fit errors during rapid resizing
                }
            });
        });
        resizeObserver.observe(terminalRef.current);

        return () => {
            const currentId = instanceIdRef.current;
            invoke('stop_terminal', { id: currentId }).catch(() => { });
            term.dispose();
            resizeObserver.disconnect();
            unlisten.then(f => f());
            unlistenExit.then(f => f());
        };
    }, []);

    // Auto Connect Effect (Boot only)
    useEffect(() => {
        if (isConnected && connectionStatus === 'ACTIVE' && lastSyncedDbRef.current === null) {
            console.log(`[Terminal] Booting terminal for connection`);
            // Mark as booting to prevent Sync Effect from double booting
            lastSyncedDbRef.current = activeDatabase || 'connected';

            xtermRef.current?.clear();
            invoke('start_terminal_auto', { id: instanceIdRef.current }).then(() => {
                setTimeout(() => {
                    fitAddonRef.current?.fit();
                    const dims = fitAddonRef.current?.proposeDimensions();
                    if (dims) invoke('resize_terminal', { id: instanceIdRef.current, rows: dims.rows, cols: dims.cols });
                    xtermRef.current?.focus();
                }, 100);
            }).catch(e => {
                xtermRef.current?.write(`\r\n\x1b[31mFailed to launch terminal: ${e}\x1b[0m\r\n`);
            });
        }
    }, [isConnected, connectionStatus, activeDatabase]);

    // Sync Effect (Switch only)
    useEffect(() => {
        if (isConnected && activeDatabase && connectionStatus === 'ACTIVE') {
            if (lastSyncedDbRef.current !== null &&
                lastSyncedDbRef.current !== 'connected' &&
                activeDatabase !== lastSyncedDbRef.current) {
                console.log(`[Terminal] Switching context to: ${activeDatabase}`);

                if (connectionType === 'postgres') {
                    if (xtermRef.current) {
                        xtermRef.current.options.disableStdin = true;
                        xtermRef.current.clear();
                        xtermRef.current.write(`\r\n\x1b[34m[IDE] Switching database context to "${activeDatabase}"...\x1b[0m\r\n`);
                    }
                    invoke('start_terminal_auto', { id: instanceIdRef.current }).then(() => {
                        if (xtermRef.current) {
                            xtermRef.current.focus();
                            xtermRef.current.options.disableStdin = false;
                        }
                        lastSyncedDbRef.current = activeDatabase;
                    }).catch(e => {
                        xtermRef.current?.write(`\r\n\x1b[31mFailed to switch terminal context: ${e}\x1b[0m\r\n`);
                        if (xtermRef.current) xtermRef.current.options.disableStdin = false;
                    });
                } else if (connectionType === 'mysql') {
                    invoke('write_terminal', { id: instanceIdRef.current, data: `USE ${activeDatabase};\x0D` });
                    lastSyncedDbRef.current = activeDatabase;
                } else {
                    // SQLite / CSV have 1 file per connection, DB "switching" is handled differently or unnecessary
                    lastSyncedDbRef.current = activeDatabase;
                }
            } else if (lastSyncedDbRef.current === 'connected') {
                // Was booted before activeDatabase was known, update it now
                lastSyncedDbRef.current = activeDatabase;
            }
        }
    }, [isConnected, activeDatabase, connectionType, connectionStatus]);

    // Safety Effect (connection status changes)
    useEffect(() => {
        if (xtermRef.current) {
            if (connectionStatus === 'DISCONNECTED') {
                lastSyncedDbRef.current = null;
                multilineBufferRef.current = '';
                inputBufferRef.current = '';
                inputCursorRef.current = 0;
                isExecutingRef.current = false;
                setIsExecuting(false);

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

    // Focus Effect — re-focus terminal when panel becomes visible
    useEffect(() => {
        if (isVisible && xtermRef.current && connectionStatus === 'ACTIVE') {
            // Small delay to allow DOM to settle after panel toggle
            const timer = setTimeout(() => {
                xtermRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isVisible, connectionStatus]);

    // Click-to-focus handler
    const handleContainerClick = useCallback(() => {
        if (xtermRef.current && connectionStatus === 'ACTIVE') {
            xtermRef.current.focus();
        }
    }, [connectionStatus]);

    return (
        <div className="h-full w-full flex flex-col bg-[#1e1e1e] text-white relative" onClick={handleContainerClick}>
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

                {/* Connection Badge + Executing Indicator — Floating Top-Left when connected */}
                {isConnected && (
                    <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-2">
                        {activeDatabase && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#252526]/90 backdrop-blur-sm rounded text-[10px] text-blue-400 border border-[#3e3e3e] shadow-lg">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                <span className="font-medium">{activeDatabase}</span>
                            </div>
                        )}
                        {isExecuting && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#252526]/90 backdrop-blur-sm rounded text-[10px] text-amber-400 border border-amber-900/30 shadow-lg">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span className="font-medium">Executing...</span>
                            </div>
                        )}
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
                                    onClick={() => {
                                        setShowConfirm(false);
                                        setPendingCommand(null);
                                        // Send a blank enter to re-show prompt
                                        sendToPty('\x0D');
                                    }}
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

export default memo(TerminalPanelInner);
