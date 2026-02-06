import React, { useEffect, useRef } from 'react';
import AiPromptBox from './AiPromptBox.tsx';
import { useAiStore } from '../../store/aiStore.ts';
import { useDatabaseStore } from '../../store/databaseStore.ts';

const AiAssistant: React.FC = () => {
    const { messages, status, checkStatus, isThinking, modelStatus } = useAiStore();
    const { runQuery } = useDatabaseStore();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        checkStatus();

        // Poll for status if offline (waiting for sidecar to start)
        const interval = setInterval(() => {
            if (status !== 'online') {
                checkStatus();
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [status, checkStatus]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isThinking]);

    const handleRunQuery = (sql: string) => {
        runQuery(sql);
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        // Optional: Show toast
    };

    return (
        <div className="flex flex-col h-full bg-panel text-primary font-sans">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-subtle bg-panel shadow-sm z-10">
                <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 rounded bg-accent/20 flex items-center justify-center text-accent text-[10px] font-bold ring-1 ring-accent/30">AI</div>
                    <span className="text-sm font-semibold tracking-wide">Assistant</span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500 animate-pulse'}`}></div>
                    <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">
                        {status === 'online' ? 'Local • Online' : 'Initializing...'}
                    </span>
                </div>
            </div>

            {/* Initialization Overlay */}
            {status !== 'online' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-panel">
                    <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>
                    <div>
                        <h3 className="text-primary font-medium">Starting Local AI...</h3>
                        <p className="text-secondary text-xs mt-1">Launching Ollama sidecar. This may take a moment.</p>
                        {modelStatus?.message && <p className="text-red-400 text-[10px] mt-2 bg-red-500/10 px-2 py-1 rounded">{modelStatus.message}</p>}
                    </div>
                </div>
            )}

            {/* Content Area */}
            {status === 'online' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth" ref={scrollRef}>
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-secondary opacity-40 space-y-3">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-10 h-10">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.636-1.637L13.29 18.15l1.18-.396a2.25 2.25 0 001.639-1.637l.39-1.183.394 1.183a2.25 2.25 0 001.636 1.637l1.18.396-1.18.396a2.25 2.25 0 00-1.636 1.637z" />
                            </svg>
                            <p className="text-xs font-medium">Ready to assist with your database ({modelStatus?.model_loaded ? 'Our Model' : 'No Model'})</p>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'user' ? (
                                <div className="bg-accent/10 text-primary px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] text-sm leading-relaxed border border-accent/20 shadow-sm">
                                    {msg.content}
                                </div>
                            ) : (
                                <div className="space-y-2 max-w-[95%] w-full">
                                    {msg.type !== 'error' && (
                                        <div className="flex items-center space-x-2 mb-1 pl-1">
                                            <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold shadow-sm">AI</div>
                                            <span className="text-xs text-secondary font-medium">Truncate AI</span>
                                        </div>
                                    )}

                                    {msg.content && <div className="text-secondary text-sm leading-relaxed whitespace-pre-wrap pl-1">{msg.explanation || msg.content}</div>}

                                    {msg.sql && (
                                        <div className={`mt-2 rounded-lg border overflow-hidden ${msg.isSafe === false ? 'border-red-500/50 bg-red-500/5' : 'border-subtle bg-app'}`}>
                                            {msg.isSafe === false && (
                                                <div className="bg-red-500/10 text-red-400 text-xs px-3 py-1.5 flex items-center border-b border-red-500/20">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 mr-1.5">
                                                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                    </svg>
                                                    Destructive Query Detected
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between px-3 py-1.5 bg-subtle/30 border-b border-subtle/50">
                                                <span className="text-[10px] text-secondary font-mono uppercase tracking-wider">SQL</span>
                                                <div className="flex space-x-1">
                                                    <button
                                                        onClick={() => handleCopy(msg.sql!)}
                                                        className="p-1 hover:bg-subtle/50 rounded text-secondary hover:text-primary transition-colors"
                                                        title="Copy SQL"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                            <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                                                            <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleRunQuery(msg.sql!)}
                                                        className="flex items-center space-x-1 px-2 py-0.5 bg-accent text-white rounded text-[10px] font-medium hover:bg-accent/90 transition-colors shadow-sm"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                            <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z" clipRule="evenodd" />
                                                        </svg>
                                                        <span>Run</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-3 overflow-x-auto bg-app">
                                                <pre className="font-mono text-xs text-primary leading-relaxed">{msg.sql}</pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {isThinking && (
                        <div className="flex justify-start opacity-80 pl-1">
                            <div className="space-y-2 max-w-[90%]">
                                <div className="flex items-center space-x-2">
                                    <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>
                                    <span className="text-xs text-secondary animate-pulse font-medium">Analyzing database schema...</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-subtle bg-panel/50 backdrop-blur-sm">
                {status === 'online' ? (
                    <AiPromptBox />
                ) : (
                    <div className="h-10 bg-subtle/20 rounded cursor-not-allowed border border-subtle/30 flex items-center px-3">
                        <span className="text-xs text-secondary/50">AI is starting...</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiAssistant;
