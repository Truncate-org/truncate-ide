import React, { useState, useEffect } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import DatabaseExplorer from '../Panels/DatabaseExplorer.tsx';
import DataResultsView from '../Panels/DataResultsView.tsx';
import { DataAuditPanel } from '../Panels/DataAuditPanel.tsx';
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
        showDataAudit,
        activeRightTab,
        explorerLastSize,
        terminalLastSize,
        assistantLastSize,
        toggleExplorer,
        toggleTerminal,
        toggleAssistant,
        toggleDataAudit,
        setActiveRightTab,
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

    const handleCloseTerminal = () => {
        toggleTerminal();
    };

    // Calculate if the right panel should be shown entirely
    const showRightPanel = showAssistant || showDataAudit;

    const handleCloseRightPanel = () => {
        if (showAssistant) toggleAssistant();
        if (showDataAudit) toggleDataAudit();
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
                                className="bg-panel flex flex-col"
                                id="explorer-panel"
                            >
                                {/* Panel Header */}
                                <div className="flex items-center justify-between px-4 py-2">
                                    <span className="text-[11px] uppercase tracking-wider text-secondary font-semibold">
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
                            <Separator className="w-[1px] hover:w-[2px] bg-subtle hover:bg-[#007acc] transition-colors cursor-col-resize z-10" />
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
                                        <Separator className="h-[1px] hover:h-[2px] bg-subtle hover:bg-[#007acc] transition-colors cursor-row-resize z-10" />
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
                                    className="bg-panel flex flex-col"
                                >
                                    {/* Panel Header */}
                                    <div className="flex items-center justify-between px-4 py-1.5">
                                        <span className="text-[11px] uppercase tracking-wider text-secondary font-semibold">
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
                                        <TerminalPanel readOnly={terminalReadOnly} setReadOnly={setTerminalReadOnly} isVisible={showTerminal} />
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

                    {/* Right Panel: Unified Tabs Container */}
                    {showRightPanel && (
                        <>
                            <Separator className="w-[1px] hover:w-[2px] bg-subtle hover:bg-[#007acc] transition-colors cursor-col-resize z-10" />
                            <Panel
                                defaultSize={assistantLastSize}
                                minSize={250}
                                maxSize={maxSidebarWidth}
                                collapsible={false}
                                onResize={(size) => {
                                    setAssistantSize(size.inPixels);
                                }}
                                className="bg-panel flex flex-col"
                                id="right-sidebar-panel"
                            >
                                {/* Monaco Style Tab Bar */}
                                <div className="flex items-center justify-between bg-[#252526] shrink-0 border-b border-subtle relative">
                                    <div className="flex items-end h-full mt-1.5 ml-2 overflow-x-auto no-scrollbar">
                                        <button
                                            onClick={() => setActiveRightTab('ai')}
                                            className={`px-3 py-1.5 min-w-[100px] text-[11px] font-medium transition-colors border-t border-t-transparent ${activeRightTab === 'ai'
                                                ? 'bg-app text-white border-t-[#007acc] border-x border-x-subtle/50'
                                                : 'text-secondary hover:text-[#cccccc] bg-transparent'
                                                }`}
                                        >
                                            AI Assistant
                                        </button>
                                        <button
                                            onClick={() => setActiveRightTab('audit')}
                                            className={`px-3 py-1.5 min-w-[100px] text-[11px] font-medium transition-colors border-t border-t-transparent ${activeRightTab === 'audit'
                                                ? 'bg-app text-white border-t-[#007acc] border-x border-x-subtle/50 -ml-px'
                                                : 'text-secondary hover:text-[#cccccc] bg-transparent -ml-px'
                                                }`}
                                        >
                                            Data Audit
                                        </button>
                                    </div>
                                    <div className="flex items-center px-2">
                                        <button
                                            onClick={handleCloseRightPanel}
                                            className="p-1 text-secondary hover:text-white hover:bg-[#333333] rounded transition-colors"
                                            title="Close Panel"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Active Tab Content */}
                                <div className="flex-1 overflow-hidden flex flex-col bg-app">
                                    <div className={activeRightTab === 'ai' ? 'flex flex-col h-full' : 'hidden'}>
                                        <AiAssistant />
                                    </div>
                                    <div className={activeRightTab === 'audit' ? 'flex flex-col h-full' : 'hidden'}>
                                        <DataAuditPanel />
                                    </div>
                                </div>
                            </Panel>
                        </>
                    )}
                </Group>
            </div>
            <StatusBar />
        </div >
    );
};

export default ResizableLayout;
