import React, { useState, useEffect } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import DatabaseExplorer from '../Panels/DatabaseExplorer.tsx';
import DataResultsView from '../Panels/DataResultsView.tsx';
import TerminalPanel from '../Panels/TerminalPanel.tsx';
import AiAssistant from '../Panels/AiAssistant.tsx';
import StatusBar from '../StatusBar.tsx';
import { Layout, X, ShieldAlert, Unlock } from 'lucide-react';

import TopBar from './TopBar';
import { useUiStore } from '../../store/uiStore';

const ResizableLayout: React.FC = () => {
    // UI Store State
    const {
        showExplorer,
        showPreview,
        showTerminal,
        showAssistant,
        explorerLastSize,
        terminalLastSize,
        assistantLastSize,
        toggleExplorer,
        toggleTerminal,
        toggleAssistant,
        setExplorerSize,
        setTerminalSize,
        setAssistantSize,
        resetLayout,
    } = useUiStore();

    // Terminal safe mode state
    const [terminalReadOnly, setTerminalReadOnly] = useState(true);

    // Calculate max sizes based on viewport
    const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
    const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

    useEffect(() => {
        const handleResize = () => {
            setViewportWidth(window.innerWidth);
            setViewportHeight(window.innerHeight);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Max sizes: 35% for sidebars, 45% for terminal
    const maxSidebarWidth = Math.floor(viewportWidth * 0.35);
    const maxTerminalHeight = Math.floor(viewportHeight * 0.45);

    // Panel close handlers
    const handleCloseExplorer = () => {
        toggleExplorer();
    };

    const handleCloseAssistant = () => {
        toggleAssistant();
    };

    const handleCloseTerminal = () => {
        toggleTerminal();
    };

    return (
        <div className="h-screen w-screen bg-app text-sm font-sans flex flex-col overflow-hidden">
            {/* Top Bar */}
            <TopBar />

            <div className="flex-1 flex overflow-hidden relative">
                <Group orientation="horizontal" id="ide-layout-persistence">
                    {/* Left Panel: Database Explorer */}
                    {showExplorer && (
                        <>
                            <Panel
                                defaultSize={explorerLastSize}
                                minSize={220}
                                maxSize={maxSidebarWidth}
                                collapsible={false}
                                onResize={(size) => {
                                    setExplorerSize(size.inPixels);
                                }}
                                className="bg-panel flex flex-col border-r border-subtle"
                                id="explorer-panel"
                            >
                                {/* Panel Header with Close Button */}
                                <div className="flex items-center justify-between px-3 py-2 border-b border-subtle">
                                    <span className="text-xs uppercase tracking-wide text-secondary font-semibold">
                                        Explorer
                                    </span>
                                    <button
                                        onClick={handleCloseExplorer}
                                        className="p-1 hover:bg-subtle rounded transition-colors"
                                        title="Close Explorer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                {/* Scrollable Content */}
                                <div className="flex-1 overflow-auto">
                                    <DatabaseExplorer />
                                </div>
                            </Panel>
                            <Separator className="w-[6px] hover:w-[6px] bg-transparent hover:bg-accent/20 transition-colors cursor-col-resize" />
                        </>
                    )}

                    {/* Center Panel Container */}
                    <Panel minSize={400}>
                        <Group orientation="vertical">
                            {/* Center Top: Results View */}
                            {showPreview && (
                                <>
                                    <Panel defaultSize={60} minSize={100} className="bg-app flex flex-col">
                                        <div className="flex-1 overflow-auto">
                                            <DataResultsView />
                                        </div>
                                    </Panel>
                                    {showTerminal && (
                                        <Separator className="h-[6px] hover:h-[6px] bg-transparent hover:bg-accent/20 transition-colors cursor-row-resize" />
                                    )}
                                </>
                            )}

                            {/* Center Bottom: Terminal */}
                            {showTerminal && (
                                <Panel
                                    defaultSize={terminalLastSize}
                                    minSize={120}
                                    maxSize={maxTerminalHeight}
                                    collapsible={false}
                                    onResize={(size) => {
                                        setTerminalSize(size.inPixels);
                                    }}
                                    className="bg-panel flex flex-col border-t border-subtle"
                                >
                                    {/* Panel Header with Safe Mode and Close Button */}
                                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-subtle">
                                        <span className="text-xs uppercase tracking-wide text-secondary font-semibold">
                                            Terminal
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {/* Safe Mode Toggle */}
                                            <button
                                                onClick={() => setTerminalReadOnly(!terminalReadOnly)}
                                                className={`
                                                    flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-all
                                                    ${terminalReadOnly
                                                        ? 'bg-amber-900/20 text-amber-500 border border-amber-900/50 hover:bg-amber-900/30'
                                                        : 'bg-[#252526] text-gray-500 border border-[#3e3e3e] hover:text-gray-300'}
                                                `}
                                                title={terminalReadOnly ? "Safe Mode Active: Dangerous commands require confirmation" : "Unrestricted Mode"}
                                            >
                                                {terminalReadOnly ? <ShieldAlert className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                                <span>{terminalReadOnly ? 'Safe' : 'Unrestricted'}</span>
                                            </button>
                                            <button
                                                onClick={handleCloseTerminal}
                                                className="p-1 hover:bg-subtle rounded transition-colors"
                                                title="Close Terminal"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    {/* Scrollable Content */}
                                    <div className="flex-1 overflow-auto">
                                        <TerminalPanel readOnly={terminalReadOnly} setReadOnly={setTerminalReadOnly} />
                                    </div>
                                </Panel>
                            )}

                            {/* Fallback: If both preview and terminal are hidden */}
                            {!showPreview && !showTerminal && (
                                <Panel
                                    defaultSize={100}
                                    className="bg-app flex flex-col items-center justify-center text-gray-500 select-none"
                                >
                                    <div className="text-center opacity-50">
                                        <div className="w-16 h-16 bg-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Layout className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-300 mb-2">No Open Views</h3>
                                        <p className="text-sm max-w-[200px] leading-relaxed mb-4">
                                            The editor and terminal are currently hidden.
                                        </p>
                                        <button
                                            onClick={resetLayout}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
                                        >
                                            Reset Layout
                                        </button>
                                    </div>
                                </Panel>
                            )}
                        </Group>
                    </Panel>

                    {/* Right Panel: AI Assistant */}
                    {showAssistant && (
                        <>
                            <Separator className="w-[6px] hover:w-[6px] bg-transparent hover:bg-accent/20 transition-colors cursor-col-resize" />
                            <Panel
                                defaultSize={assistantLastSize}
                                minSize={220}
                                maxSize={maxSidebarWidth}
                                collapsible={false}
                                onResize={(size) => {
                                    setAssistantSize(size.inPixels);
                                }}
                                className="bg-panel flex flex-col border-l border-subtle"
                                id="assistant-panel"
                            >
                                {/* Panel Header with Close Button */}
                                <div className="flex items-center justify-between px-3 py-2 border-b border-subtle">
                                    <span className="text-xs uppercase tracking-wide text-secondary font-semibold">
                                        AI Assistant
                                    </span>
                                    <button
                                        onClick={handleCloseAssistant}
                                        className="p-1 hover:bg-subtle rounded transition-colors"
                                        title="Close AI Assistant"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                {/* Scrollable Content */}
                                <div className="flex-1 overflow-auto">
                                    <AiAssistant />
                                </div>
                            </Panel>
                        </>
                    )}
                </Group>
            </div>
            <StatusBar />
        </div>
    );
};

export default ResizableLayout;
