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
    abortController: AbortController | null;

    // Actions
    checkStatus: () => Promise<void>;
    sendMessage: (text: string) => Promise<void>;
    cancelRequest: () => void;
    clearHistory: () => void;
    addMessage: (msg: AiMessage) => void;
}

export const useAiStore = create<AiStore>((set, get) => ({
    messages: [],
    status: 'unknown',
    modelStatus: null,
    isThinking: false,
    error: null,
    abortController: null,

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

        const controller = new AbortController();

        // 1. Append User Message Only
        set(state => ({
            messages: [...state.messages, userMsg],
            isThinking: true,
            error: null,
            abortController: controller
        }));

        try {
            // 2. Await Blocking Response
            // The backend now returns Result<String, String> which is the raw JSON string
            const responseText = await invoke<string>('ask_copilot', { userPrompt: text });

            // 3. Check Cancellation
            if (controller.signal.aborted) {
                return;
            }

            // 4. Create Assistant Message
            const aiMsg: AiMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: responseText,
                type: 'text',
                timestamp: Date.now(),
                isSafe: true
            };

            // 5. Append Assistant Message
            set(state => ({
                messages: [...state.messages, aiMsg],
                isThinking: false,
                abortController: null
            }));

        } catch (e: any) {
            if (controller.signal.aborted) return;

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
                isThinking: false,
                abortController: null
            }));
        }
    },

    cancelRequest: () => {
        const { abortController } = get();
        if (abortController) {
            abortController.abort();
        }
        set({ isThinking: false, abortController: null });
    },

    clearHistory: () => set({ messages: [] }),

    addMessage: (msg) => set(state => ({ messages: [...state.messages, msg] }))
}));
