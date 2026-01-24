import React, { useState, useEffect } from 'react';
import { useDatabaseStore } from '../../store/databaseStore';
import Editor, { useMonaco } from '@monaco-editor/react';

const SqlEditor: React.FC = () => {
    const { runQuery, isConnected, activeDatabase, previewState } = useDatabaseStore();
    const [sql, setSql] = useState('');
    const monaco = useMonaco();

    // Define theme on load
    useEffect(() => {
        if (monaco) {
            monaco.editor.defineTheme('truncate-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'keyword', foreground: 'FF7B72' },      // Red/Coral
                    { token: 'operator.sql', foreground: 'FF7B72' }, // Operators often same as keywords
                    { token: 'string', foreground: 'A5D6FF' },       // Light Blue
                    { token: 'string.quote', foreground: 'A5D6FF' },
                    { token: 'number', foreground: 'FFA657' },       // Orange
                    { token: 'comment', foreground: '8B949E' },      // Muted Gray
                    { token: 'predefined', foreground: 'D2A8FF' },   // Functions (Purple)
                    { token: 'identifier', foreground: 'C9D1D9' },   // Default text
                    { token: '', foreground: 'C9D1D9' }              // Fallback
                ],
                colors: {
                    'editor.background': '#0D1117',
                    'editor.foreground': '#C9D1D9',
                    'editorCursor.foreground': '#C9D1D9',
                    'editor.lineHighlightBackground': '#161b22',
                    'editorLineNumber.foreground': '#484f58',
                    'editorLineNumber.activeForeground': '#c9d1d9',
                    'editor.selectionBackground': '#1f6feb40',
                }
            });
            monaco.editor.setTheme('truncate-dark');
        }
    }, [monaco]);

    const handleRun = () => {
        if (!sql.trim()) return;
        runQuery(sql);
    };

    // Handle CMD+Enter
    // Monaco has its own keybindings, but for app-wide consistency/simplicity 
    // we can use the onMount event to add a command, or just use a wrapper handler?
    // A wrapper handler on the container might miss focus events.
    // Better to use onMount to add the keybinding to the editor instance.
    const handleEditorDidMount = (editor: any, monacoInstance: any) => {
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
            handleRun();
        });

        // Also ensure we focus properly or handle layout
    };

    return (
        <div className="flex flex-col h-full bg-[#0d1117]">
            <div className="h-9 border-b border-subtle flex items-center px-4 justify-between bg-panel select-none">
                <span className="text-secondary text-xs uppercase tracking-wider font-semibold">SQL Editor</span>
                <button
                    onClick={handleRun}
                    disabled={!isConnected || previewState === 'loading' || !sql.trim()}
                    className="px-3 py-1 bg-accent/90 text-white text-xs rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center"
                >
                    <span className="mr-1">▶</span> Run
                </button>
            </div>
            <div className="flex-1 p-0 relative overflow-hidden">
                <Editor
                    height="100%"
                    defaultLanguage="sql"
                    value={sql}
                    onChange={(value) => setSql(value || '')}
                    theme="truncate-dark"
                    onMount={handleEditorDidMount}
                    options={{
                        minimap: { enabled: false }, // Cleaner look for smaller panels
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
                        lineHeight: 20,
                        padding: { top: 16, bottom: 16 },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        wordWrap: 'on',
                        renderLineHighlight: 'all',
                        contextmenu: true,
                    }}
                />
                {!sql && !activeDatabase && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-secondary opacity-20 pointer-events-none text-center">
                        <p>Select a database to start</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SqlEditor;
