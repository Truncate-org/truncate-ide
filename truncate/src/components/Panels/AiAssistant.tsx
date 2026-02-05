import React from 'react';
import AiPromptBox from './AiPromptBox.tsx';

const AiAssistant: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-panel">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* User Message */}
                <div className="flex justify-end">
                    <div className="bg-subtle text-primary px-3 py-2 rounded-lg rounded-tr-none max-w-[85%] text-sm leading-relaxed">
                        Show me the top 5 users by recent activity.
                    </div>
                </div>

                {/* AI Message */}
                <div className="flex justify-start">
                    <div className="space-y-2 max-w-[90%]">
                        <div className="flex items-center space-x-2 mb-1">
                            <div className="w-5 h-5 rounded bg-accent/20 flex items-center justify-center text-accent text-[10px] font-bold">AI</div>
                            <span className="text-xs text-secondary">Truncate AI</span>
                        </div>
                        <div className="text-secondary text-sm leading-relaxed">
                            Here is the query for the top 5 users based on the <span className="text-accent font-mono px-1 bg-accent/10 rounded text-xs">events</span> table.
                        </div>
                        <div className="bg-app border border-subtle rounded-md p-3 overflow-x-auto">
                            <pre className="font-mono text-xs text-primary">
                                {`SELECT * FROM users 
JOIN events ON users.id = events.user_id 
ORDER BY events.created_at DESC 
LIMIT 5;`}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Thinking State */}
                <div className="flex justify-start opacity-70">
                    <div className="space-y-2 max-w-[90%]">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                            <span className="text-xs text-secondary animate-pulse">AI is analyzing your schema...</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-subtle bg-panel/50">
                <AiPromptBox />
            </div>
        </div>
    );
};

export default AiAssistant;
