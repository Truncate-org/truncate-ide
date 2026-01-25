import React from 'react';
import DatabaseExplorer from '../Panels/DatabaseExplorer.tsx';
import DataResultsView from '../Panels/DataResultsView.tsx';
import TerminalPanel from '../Panels/TerminalPanel.tsx';
import AiAssistant from '../Panels/AiAssistant.tsx';

const MainGrid: React.FC = () => {
    return (
        <div className="grid grid-cols-[240px_1fr_320px] h-screen bg-app text-sm font-sans divide-x divide-subtle">
            {/* Left Panel */}
            <div className="h-full bg-panel overflow-hidden">
                <DatabaseExplorer />
            </div>

            {/* Center Panel Container */}
            <div className="flex flex-col h-full overflow-hidden divide-y divide-subtle">
                {/* Center Top */}
                <div className="flex-1 overflow-hidden bg-app">
                    <DataResultsView />
                </div>
                {/* Center Bottom */}
                <div className="h-[200px] bg-panel overflow-hidden shrink-0">
                    <TerminalPanel />
                </div>
            </div>

            {/* Right Panel */}
            <div className="h-full bg-panel overflow-hidden border-l border-subtle">
                <AiAssistant />
            </div>
        </div>
    );
};

export default MainGrid;
