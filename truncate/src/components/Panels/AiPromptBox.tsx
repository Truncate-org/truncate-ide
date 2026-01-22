import React from 'react';

const AiPromptBox: React.FC = () => {
    return (
        <div className="relative">
            <textarea
                className="w-full bg-app border border-subtle rounded-md px-3 py-2 pr-10 text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-accent transition-colors resize-none min-h-[80px]"
                placeholder="Ask the AI about your data..."
            ></textarea>
            <button
                disabled
                className="absolute bottom-2 right-2 p-1.5 bg-subtle text-secondary rounded hover:bg-accent hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                </svg>
            </button>
        </div>
    );
};

export default AiPromptBox;
