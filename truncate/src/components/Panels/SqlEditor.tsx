import React from 'react';

const SqlEditor: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-[#0d1117]">
            <div className="h-9 border-b border-subtle flex items-center px-4 justify-between bg-panel select-none">
                <span className="text-secondary text-xs uppercase tracking-wider font-semibold">SQL Editor</span>
                <button disabled className="px-3 py-1 bg-accent/90 text-white text-xs rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center">
                    <span className="mr-1">▶</span> Run
                </button>
            </div>
            <div className="flex-1 p-0 relative">
                <textarea
                    className="w-full h-full bg-transparent text-primary font-mono text-[13px] leading-6 p-4 resize-none focus:outline-none"
                    placeholder="Write SQL queries here..."
                    spellCheck={false}
                />
                <div className="absolute bottom-2 right-4 text-xs text-secondary opacity-50 pointer-events-none">
                    CMD + Enter to run
                </div>
            </div>
        </div>
    );
};

export default SqlEditor;
