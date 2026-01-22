import React from 'react';

const DatabaseExplorer: React.FC = () => {
    return (
        <div className="flex flex-col h-full">
            <div className="h-10 border-b border-subtle flex items-center px-4 font-semibold text-primary select-none">
                Databases
            </div>
            <div className="p-2 space-y-2">
                <button disabled className="w-full py-1.5 px-3 bg-subtle/50 text-secondary text-xs rounded border border-subtle hover:bg-subtle/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center">
                    Connect Database
                </button>
                <div className="mt-4 pl-2">
                    {/* Static Tree Placeholder */}
                    <div className="flex items-center text-primary font-medium mb-1">
                        <span className="mr-2">▼</span> database_name
                    </div>
                    <div className="pl-5 space-y-1 text-secondary">
                        <div className="hover:text-primary hover:bg-white/5 cursor-pointer py-0.5 px-1 rounded flex items-center">
                            <span className="mr-2 w-3 text-center opacity-50">#</span> users
                        </div>
                        <div className="hover:text-primary hover:bg-white/5 cursor-pointer py-0.5 px-1 rounded flex items-center">
                            <span className="mr-2 w-3 text-center opacity-50">#</span> orders
                        </div>
                        <div className="hover:text-primary hover:bg-white/5 cursor-pointer py-0.5 px-1 rounded flex items-center">
                            <span className="mr-2 w-3 text-center opacity-50">#</span> events
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseExplorer;
