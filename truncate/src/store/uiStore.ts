import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiStore {
    // Panel Visibility
    showExplorer: boolean;
    showPreview: boolean;
    showTerminal: boolean;
    showAssistant: boolean;

    // Theme
    theme: 'default' | 'void-minimal';

    // Panel Sizes (in pixels)
    explorerLastSize: number;
    terminalLastSize: number;
    assistantLastSize: number;

    // Actions
    toggleExplorer: () => void;
    togglePreview: () => void;
    toggleTerminal: () => void;
    toggleAssistant: () => void;
    toggleTheme: () => void;
    setExplorerSize: (size: number) => void;
    setTerminalSize: (size: number) => void;
    setAssistantSize: (size: number) => void;
    resetLayout: () => void;
}

export const useUiStore = create<UiStore>()(
    persist(
        (set) => ({
            showExplorer: true,
            showPreview: true,
            showTerminal: true,
            showAssistant: true,
            theme: 'default',

            // Default panel sizes in pixels
            explorerLastSize: 280,
            terminalLastSize: 200,
            assistantLastSize: 320,

            toggleExplorer: () => set((state) => ({ showExplorer: !state.showExplorer })),
            togglePreview: () => set((state) => ({ showPreview: !state.showPreview })),
            toggleTerminal: () => set((state) => ({ showTerminal: !state.showTerminal })),
            toggleAssistant: () => set((state) => ({ showAssistant: !state.showAssistant })),
            toggleTheme: () => set((state) => ({ theme: state.theme === 'default' ? 'void-minimal' : 'default' })),

            setExplorerSize: (size: number) => set({ explorerLastSize: size }),
            setTerminalSize: (size: number) => set({ terminalLastSize: size }),
            setAssistantSize: (size: number) => set({ assistantLastSize: size }),

            resetLayout: () => set({
                showExplorer: true,
                showPreview: true,
                showTerminal: true,
                showAssistant: true,
                explorerLastSize: 280,
                terminalLastSize: 200,
                assistantLastSize: 320,
            }),
        }),
        {
            name: 'ui-storage',
            partialize: (state) => ({
                showExplorer: state.showExplorer,
                showPreview: state.showPreview,
                showTerminal: state.showTerminal,
                showAssistant: state.showAssistant,
                explorerLastSize: state.explorerLastSize,
                terminalLastSize: state.terminalLastSize,
                assistantLastSize: state.assistantLastSize,
            }),
        }
    )
);
