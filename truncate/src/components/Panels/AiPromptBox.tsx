import React, { useState, KeyboardEvent } from 'react';
import { useAiStore } from '../../store/aiStore.ts';

const AiPromptBox: React.FC = () => {
    const [input, setInput] = useState('');
    const { sendMessage, isThinking, status } = useAiStore();

    const handleSend = async () => {
        if (!input.trim() || isThinking || status !== 'online') return;

        const message = input;
        setInput('');
        await sendMessage(message);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="relative group">
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isThinking || status !== 'online'}
                className="w-full bg-app border border-subtle rounded-xl px-4 py-3 pr-12 text-sm text-primary placeholder-secondary/40 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-all resize-none min-h-[50px] max-h-[120px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={status === 'online' ? "Ask about your data schema..." : "AI Service Offline"}
                rows={1}
            />
            <button
                onClick={handleSend}
                disabled={!input.trim() || isThinking || status !== 'online'}
                className="absolute bottom-2.5 right-2 p-1.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition-all disabled:opacity-0 disabled:scale-95 shadow-sm active:scale-95"
            >
                {isThinking ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                    </svg>
                )}
            </button>
        </div>
    );
};

export default AiPromptBox;
