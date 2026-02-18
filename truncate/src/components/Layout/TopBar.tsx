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
                "p-1.5 rounded-md transition-all duration-200 group relative flex items-center justify-center",
                active
                    ? "bg-[#2d2d2d] text-blue-400 shadow-sm ring-1 ring-white/5"
                    : "text-secondary hover:bg-[#2d2d2d] hover:text-gray-200"
            )}
            title={`${label} ${shortcut ? `(${shortcut})` : ''}`}
        >
            <Icon className="w-4 h-4" strokeWidth={1.5} />
        </button>
    );

    return (
        <div className="h-10 bg-[#1e1e1e] border-b border-[#2b2b2b] flex items-center justify-between px-3 shrink-0 select-none z-50 shadow-sm">

            {/* LEFT: Empty spacer */}
            <div className="flex-1" />

            {/* CENTER: Context */}
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 text-xs text-gray-400 bg-[#252526] px-3 py-1 rounded-full border border-[#303030]">
                <span className="opacity-70">truncate-ide</span>
                <span className="opacity-40">/</span>
                <span className="text-gray-200 font-medium">
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

                <div className="h-4 w-[1px] bg-[#3e3e3e] mx-1" />

                <button
                    onClick={useUiStore(s => s.toggleTheme)}
                    className="text-secondary hover:text-white p-1.5 rounded hover:bg-[#2d2d2d] transition-colors"
                    title="Toggle Theme (Void Minimal)"
                >
                    {/* Dynamic Icon based on theme? Or just a static icon for the toggle? */}
                    {/* Let's use a Zap icon to represent 'Power Mode' / 'Void' */}
                    <Settings className="w-4 h-4 hidden" /> {/* Keeping structure, but using Zap below */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                </button>

                <button
                    onClick={resetLayout}
                    className="text-secondary hover:text-white p-1.5 rounded hover:bg-[#2d2d2d] transition-colors"
                    title="Reset Layout"
                >
                    <Layout className="w-4 h-4" />
                </button>
                <button className="text-secondary hover:text-white p-1.5 rounded hover:bg-[#2d2d2d] transition-colors" title="Settings">
                    <Settings className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default TopBar;
