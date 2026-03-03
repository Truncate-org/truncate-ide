import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiStore {
    // Panel Visibility
    showExplorer: boolean;
    showPreview: boolean;
    showTerminal: boolean;
    showAssistant: boolean;
    showDataAudit: boolean; // New Panel
    // Theme
    theme: 'default' | 'void-minimal';

    // Right Sidebar Tab Management
    activeRightTab: 'ai' | 'audit';

    // Panel Sizes (in pixels)
    explorerLastSize: number;
    terminalLastSize: number;
    assistantLastSize: number;

    // Actions
    toggleExplorer: () => void;
    togglePreview: () => void;
    toggleTerminal: () => void;
    toggleAssistant: () => void;
    toggleDataAudit: () => void; // New Action
    setActiveRightTab: (tab: 'ai' | 'audit') => void;
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
            showDataAudit: false, // Default hidden
            activeRightTab: 'ai',
            theme: 'default',

            // Default panel sizes in pixels
            explorerLastSize: 280,
            terminalLastSize: 200,
            assistantLastSize: 320,

            toggleExplorer: () => set((state) => ({ showExplorer: !state.showExplorer })),
            togglePreview: () => set((state) => ({ showPreview: !state.showPreview })),
            toggleTerminal: () => set((state) => ({ showTerminal: !state.showTerminal })),

            toggleAssistant: () => set((state) => {
                const willShow = !state.showAssistant;
                return {
                    showAssistant: willShow,
                    showDataAudit: willShow ? false : state.showDataAudit, // Close the other
                    activeRightTab: 'ai'
                };
            }),

            toggleDataAudit: () => set((state) => {
                const willShow = !state.showDataAudit;
                return {
                    showDataAudit: willShow,
                    showAssistant: willShow ? false : state.showAssistant, // Close the other
                    activeRightTab: 'audit'
                };
            }),

            setActiveRightTab: (tab: 'ai' | 'audit') => set({ activeRightTab: tab }),

            toggleTheme: () => set((state) => ({ theme: state.theme === 'default' ? 'void-minimal' : 'default' })),

            setExplorerSize: (size: number) => set({ explorerLastSize: size }),
            setTerminalSize: (size: number) => set({ terminalLastSize: size }),
            setAssistantSize: (size: number) => set({ assistantLastSize: size }),

            resetLayout: () => set({
                showExplorer: true,
                showPreview: true,
                showTerminal: true,
                showAssistant: true,
                showDataAudit: false,
                activeRightTab: 'ai',
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
                showDataAudit: state.showDataAudit,
                activeRightTab: state.activeRightTab,
                explorerLastSize: state.explorerLastSize,
                terminalLastSize: state.terminalLastSize,
                assistantLastSize: state.assistantLastSize,
            }),
        }
    )
);
