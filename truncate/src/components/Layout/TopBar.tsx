import {
    Settings,
    Database,
    Terminal,
    Bot,
    Table,
    Layout,
    ShieldCheck,
} from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import clsx from 'clsx';
import { useDatabaseStore } from '../../store/databaseStore';

const TopBar: React.FC = () => {
    const {
        showExplorer, toggleExplorer,
        showPreview, togglePreview,
        showTerminal, toggleTerminal,
        showAssistant, toggleAssistant,
        showDataAudit, toggleDataAudit,
        resetLayout
    } = useUiStore();

    const { activeDatabase } = useDatabaseStore();

    // Reusable Toggle Button
    const ToggleBtn = ({
        active,
        onClick,
        icon: Icon,
        label,
        shortcut
    }: {
        active: boolean;
        onClick: () => void;
        icon: React.ElementType;
        label: string;
        shortcut?: string;
    }) => (
        <button
            onClick={onClick}
            className={clsx(
                "p-1.5 rounded transition-all duration-150 group relative flex items-center justify-center",
                active
                    ? "text-[#007acc] bg-[#2d2d2d]/50" // VS Code Accent Color for active state
                    : "text-[#858585] hover:text-[#cccccc] hover:bg-[#2d2d2d]"
            )}
            title={`${label} ${shortcut ? `(${shortcut})` : ''}`}
        >
            <Icon className="w-4 h-4" strokeWidth={1.5} />
        </button>
    );

    return (
        <div className="h-10 bg-[#333333] border-b border-[#252526] flex items-center justify-between px-3 shrink-0 select-none z-50">

            {/* LEFT: Empty spacer */}
            <div className="flex-1" />

            {/* CENTER: Context */}
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 text-[11px] text-[#cccccc] bg-[#252526] px-3 py-1 rounded border border-[#3c3c3c]">
                <span className="opacity-70">truncate-ide</span>
                <span className="opacity-40">/</span>
                <span className="font-medium text-white">
                    {activeDatabase ? activeDatabase : 'No Active Database'}
                </span>
            </div>

            {/* RIGHT: Panel Toggles & Controls */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                    <ToggleBtn
                        active={showExplorer}
                        onClick={toggleExplorer}
                        icon={Database}
                        label="Explorer"
                        shortcut="Ctrl+B"
                    />
                    <ToggleBtn
                        active={showPreview}
                        onClick={togglePreview}
                        icon={Table}
                        label="Data Preview"
                    />
                    <ToggleBtn
                        active={showAssistant}
                        onClick={toggleAssistant}
                        icon={Bot}
                        label="AI Assistant"
                    />
                    <ToggleBtn
                        active={showDataAudit}
                        onClick={toggleDataAudit}
                        icon={ShieldCheck}
                        label="Data Audit"
                    />
                    <ToggleBtn
                        active={showTerminal}
                        onClick={toggleTerminal}
                        icon={Terminal}
                        label="Terminal"
                        shortcut="Ctrl+J"
                    />
                </div>

                <div className="h-4 w-[1px] bg-[#444444] mx-1" />

                <button
                    onClick={useUiStore(s => s.toggleTheme)}
                    className="text-[#858585] hover:text-[#cccccc] p-1.5 rounded hover:bg-[#2d2d2d] transition-colors"
                    title="Toggle Theme (Void Minimal)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                </button>

                <button
                    onClick={resetLayout}
                    className="text-[#858585] hover:text-[#cccccc] p-1.5 rounded hover:bg-[#2d2d2d] transition-colors"
                    title="Reset Layout"
                >
                    <Layout className="w-4 h-4" />
                </button>
                <button className="text-[#858585] hover:text-[#cccccc] p-1.5 rounded hover:bg-[#2d2d2d] transition-colors" title="Settings">
                    <Settings className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default TopBar;
