import React from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import DatabaseExplorer from '../Panels/DatabaseExplorer.tsx';
import DataResultsView from '../Panels/DataResultsView.tsx';
import SqlEditor from '../Panels/SqlEditor.tsx';
import AiAssistant from '../Panels/AiAssistant.tsx';
import StatusBar from '../StatusBar.tsx';

const ResizableLayout: React.FC = () => {
    // Custom Handle Component for consistent look and feel
    // Hit area increased to 8px for easier grabbing
    const HandleV = () => (
        <PanelResizeHandle className="w-[8px] -ml-[4px] -mr-[4px] relative flex justify-center items-center z-50 cursor-col-resize user-select-none group outline-none">
            <div className="w-[1px] h-full bg-subtle group-hover:bg-accent group-active:bg-accent transition-colors duration-200" />
        </PanelResizeHandle>
    );

    const HandleH = () => (
        <PanelResizeHandle className="h-[8px] -mt-[4px] -mb-[4px] relative flex flex-col justify-center items-center z-50 cursor-row-resize user-select-none group outline-none">
            <div className="h-[1px] w-full bg-subtle group-hover:bg-accent group-active:bg-accent transition-colors duration-200" />
        </PanelResizeHandle>
    );

    return (
        <div className="h-screen w-screen bg-app text-sm font-sans flex flex-col overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
                <PanelGroup orientation="horizontal" id="ide-layout-persistence">
                    {/* Left Panel: Database Explorer 
                    Constraints: Min 180px, Max 320px
                */}
                    <Panel
                        defaultSize={20}
                        minSize="180px"
                        maxSize="320px"
                        className="bg-panel flex flex-col"
                        id="left-panel"
                    >
                        <DatabaseExplorer />
                    </Panel>

                    <HandleV />

                    {/* Center Panel Container */}
                    <Panel minSize={30}>
                        <PanelGroup orientation="vertical">
                            {/* Center Top: Results View */}
                            <Panel defaultSize={70} minSize={30} className="bg-app flex flex-col">
                                <DataResultsView />
                            </Panel>

                            <HandleH />

                            {/* Center Bottom: SQL Editor 
                            Constraints: Min 180px (approx 20% of 900px height, passing percentage minSize allows resize)
                        */}
                            <Panel defaultSize={30} minSize="180px" className="bg-panel flex flex-col">
                                <SqlEditor />
                            </Panel>
                        </PanelGroup>
                    </Panel>

                    <HandleV />

                    {/* Right Panel: AI Assistant 
                    Constraints: Min 280px, Max 420px
                */}
                    <Panel
                        defaultSize={25}
                        minSize="280px"
                        maxSize="420px"
                        className="bg-panel flex flex-col"
                        id="right-panel"
                    >
                        <AiAssistant />
                    </Panel>
                </PanelGroup>
            </div>
            <StatusBar />
        </div >
    );
};

export default ResizableLayout;
