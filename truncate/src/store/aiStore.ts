import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface AiMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string; // Text content or JSON string if structured
    type: 'text' | 'sql_response' | 'error';
    sql?: string;
    explanation?: string;
    isSafe?: boolean;
    timestamp: number;
}

export interface AiStatus {
    online: boolean;
    model_loaded: boolean;
    message: string;
}

interface AiStore {
    // State
    messages: AiMessage[];
    status: 'unknown' | 'offline' | 'online' | 'error';
    modelStatus: AiStatus | null;
    isThinking: boolean;
    error: string | null;

    // Actions
    checkStatus: () => Promise<void>;
    sendMessage: (text: string) => Promise<void>;
    clearHistory: () => void;
    addMessage: (msg: AiMessage) => void;
}

export const useAiStore = create<AiStore>((set, get) => ({
    messages: [],
    status: 'unknown',
    modelStatus: null,
    isThinking: false,
    error: null,

    checkStatus: async () => {
        try {
            const status = await invoke<AiStatus>('check_ai_status');
            set({
                modelStatus: status,
                status: status.online ? 'online' : 'offline',
                error: status.message
            });
        } catch (e: any) {
            set({
                status: 'error',
                modelStatus: { online: false, model_loaded: false, message: e.toString() },
                error: e.toString()
            });
        }
    },

    sendMessage: async (text: string) => {
        const { status, modelStatus } = get();

        // Prevent sending if offline
        if (status !== 'online' || !modelStatus?.model_loaded) {
            // Optional: Try check again just in case?
            await get().checkStatus();
            if (get().status !== 'online') {
                set({ error: "AI Service is offline. Please check Ollama." });
                return;
            }
        }

        const userMsg: AiMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
            type: 'text',
            timestamp: Date.now()
        };

        set(state => ({
            messages: [...state.messages, userMsg],
            isThinking: true,
            error: null
        }));

        try {
            type AiResponse = {
                intent: string;
                sql: string;
                explanation: string;
                confidence: string;
                is_safe: boolean;
            };

            const response = await invoke<AiResponse>('ask_copilot', { userPrompt: text });

            const aiMsg: AiMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: response.explanation || "Here is the generated SQL.",
                type: response.intent === 'error' ? 'error' : 'sql_response',
                sql: response.sql,
                explanation: response.explanation, // Redundant but useful for UI
                isSafe: response.is_safe,
                timestamp: Date.now()
            };

            set(state => ({
                messages: [...state.messages, aiMsg],
                isThinking: false
            }));

        } catch (e: any) {
            console.error("AI Error:", e);
            const errorMsg: AiMessage = {
                id: crypto.randomUUID(),
                role: 'system',
                content: `Error: ${e.toString()}`,
                type: 'error',
                timestamp: Date.now()
            };
            set(state => ({
                messages: [...state.messages, errorMsg],
                isThinking: false
            }));
        }
    },

    clearHistory: () => set({ messages: [] }),

    addMessage: (msg) => set(state => ({ messages: [...state.messages, msg] }))
}));
