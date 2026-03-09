import React, { useEffect, useRef } from 'react';
import AiPromptBox from './AiPromptBox.tsx';
import { useAiStore } from '../../store/aiStore.ts';
import { useDatabaseStore } from '../../store/databaseStore.ts';

const AiAssistant: React.FC = () => {
    const { messages, status, checkStatus, isThinking, modelStatus, cancelRequest, isInstalled, setShowSetup } = useAiStore();
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
            {/* Status Bar */}
            <div className="flex items-center justify-end px-3 py-1 border-b border-subtle bg-panel z-10">
                <div className="flex items-center space-x-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-[#89d185]' : 'bg-[#cca700] animate-pulse'}`}></div>
                    <span className="text-[10px] uppercase font-medium text-secondary">
                        {status === 'online' ? 'Online' : 'Initializing...'}
                    </span>
                </div>
            </div>

            {/* Initialization Overlay */}
            {status !== 'online' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-5 bg-panel">
                    {!isInstalled ? (
                        <div className="w-full max-w-xs space-y-4">
                            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-left">
                                <p className="text-xs text-secondary leading-relaxed mb-4">
                                    The internal intelligence core is not initialized. We need to synchronize the required processing assets.
                                </p>
                                <button
                                    onClick={() => setShowSetup(true)}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                                    </svg>
                                    Initialize Core Engine
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto">
                                <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-secondary text-xs">Connecting to core subsystem...</p>
                        </div>
                    )}

                    {/* Error + Retry Overlay could go here if status reports error */}
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

                    {messages.map((msg) => {
                        let summary = '';
                        let sql = '';
                        let parseSuccess = false;

                        // 1. Strict JSON Parsing (New Format)
                        if (msg.role === 'assistant' && msg.content) {
                            try {
                                // Attempt to find the first '{' and last '}' to extract valid JSON
                                const jsonMatch = msg.content.match(/\{[\s\S]*\}/);
                                if (jsonMatch) {
                                    const cleanParam = jsonMatch[0];
                                    const parsed = JSON.parse(cleanParam);

                                    if (parsed.type === 'error') {
                                        summary = parsed.reason || parsed.summary || 'An error occurred';
                                        parseSuccess = true;
                                    } else {
                                        summary = parsed.summary || '';
                                        sql = parsed.sql || '';
                                        parseSuccess = true;
                                    }
                                } else {
                                    // Fallback: try parsing the whole string if regex fails (unlikely if it's JSON)
                                    const cleanParam = msg.content
                                        .replace(/```json\s*/g, '')
                                        .replace(/```\s*/g, '')
                                        .trim();
                                    const parsed = JSON.parse(cleanParam);
                                    // ... same logic as above repeated or just rely on regex
                                    if (parsed.type === 'error') {
                                        summary = parsed.reason || parsed.summary || 'An error occurred';
                                        parseSuccess = true;
                                    } else {
                                        summary = parsed.summary || '';
                                        sql = parsed.sql || '';
                                        parseSuccess = true;
                                    }
                                }
                            } catch (e) {
                                // Parsing failed
                                parseSuccess = false;
                            }
                        } else if (msg.type === 'text') {
                            // User message or legacy text
                            summary = msg.content;
                            parseSuccess = true;
                        }

                        const renderKey = msg.id;

                        return (
                            <div key={renderKey} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'user' ? (
                                    <div className="bg-[#37373d] text-[#cccccc] px-3 py-2 rounded-md max-w-[85%] text-sm leading-relaxed border border-[#454545]">
                                        {msg.content}
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-w-[95%] w-full">
                                        {/* AI Header */}
                                        {msg.type !== 'error' && (
                                            <div className="flex items-center space-x-2 mb-1 pl-1">
                                                <div className="w-5 h-5 rounded-sm bg-[#007acc] flex items-center justify-center text-white text-[9px] font-bold">AI</div>
                                                <span className="text-xs text-[#cccccc] font-medium">Truncate AI</span>
                                            </div>
                                        )}

                                        {/* Content Card */}
                                        {parseSuccess ? (
                                            <div className="space-y-3">
                                                {/* Summary */}
                                                {summary && (
                                                    <div className="text-primary text-sm leading-relaxed pl-1 whitespace-pre-wrap">
                                                        {summary}
                                                    </div>
                                                )}

                                                {/* SQL Editor Block */}
                                                {sql && (
                                                    <div className="rounded border border-subtle bg-[#1e1e1e] overflow-hidden mt-3">
                                                        <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] border-b border-subtle">
                                                            <span className="text-[10px] text-secondary font-mono uppercase tracking-wider">SQL</span>
                                                            <div className="flex space-x-1">
                                                                <button
                                                                    onClick={() => handleCopy(sql)}
                                                                    className="p-1 hover:bg-subtle/50 rounded text-secondary hover:text-primary transition-colors flex items-center space-x-1"
                                                                    title="Copy SQL"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                                        <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                                                                        <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                                                                    </svg>
                                                                    <span className="text-[10px]">Copy</span>
                                                                </button>
                                                                <div className="w-px h-3 bg-subtle/50 my-auto"></div>
                                                                <button
                                                                    onClick={() => handleRunQuery(sql)}
                                                                    className="flex items-center space-x-1 px-2 py-0.5 bg-accent/10 hover:bg-accent/20 text-accent rounded text-[10px] font-medium transition-colors"
                                                                    title="Run in Terminal"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                                    </svg>
                                                                    <span>Run Query</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="p-3 overflow-x-auto bg-[#1e1e1e]">
                                                            <pre className="font-mono text-xs text-[#d4d4d4] leading-relaxed whitespace-pre-wrap">{sql}</pre>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* Failure State - Hide Raw JSON */
                                            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                                                <div className="flex items-center text-red-400 text-xs font-medium mb-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1.5">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    AI Response Error
                                                </div>
                                                <div className="text-secondary text-xs">
                                                    The AI returned an invalid response format. Please try rephrasing your question.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {isThinking && (
                        <div className="flex justify-start pl-1 w-full mb-2">
                            <div className="flex items-center space-x-3 bg-subtle/10 px-3 py-2 rounded-lg border border-subtle/20">
                                <div className="flex items-center space-x-2">
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>
                                    <span className="text-xs text-secondary animate-pulse font-medium">Generating response...</span>
                                </div>
                                <div className="h-3 w-px bg-subtle/30"></div>
                                <button
                                    onClick={cancelRequest}
                                    className="flex items-center space-x-1 text-[10px] uppercase font-bold text-red-400 hover:text-red-500 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                    </svg>
                                    <span>Stop</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Input Area */}
            <div className="p-3 border-t border-subtle bg-panel">
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
