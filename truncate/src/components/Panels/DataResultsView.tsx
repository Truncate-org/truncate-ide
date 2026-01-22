import React, { useState } from 'react';

const DataResultsView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'preview' | 'visualize'>('preview');

    return (
        <div className="flex flex-col h-full bg-app">
            <div className="h-10 border-b border-subtle flex items-center px-4 justify-between bg-panel">
                <div className="font-semibold text-primary">users</div>
                <div className="flex space-x-1 bg-black/20 p-0.5 rounded">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`px-3 py-0.5 text-xs rounded ${activeTab === 'preview' ? 'bg-subtle text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
                    >
                        Preview
                    </button>
                    <button
                        onClick={() => setActiveTab('visualize')}
                        className={`px-3 py-0.5 text-xs rounded ${activeTab === 'visualize' ? 'bg-subtle text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
                    >
                        Visualize
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                {activeTab === 'preview' ? (
                    <div className="border border-subtle rounded-md overflow-hidden bg-panel/50">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-subtle/50 text-secondary font-medium border-b border-subtle">
                                <tr>
                                    <th className="px-4 py-2">id</th>
                                    <th className="px-4 py-2">name</th>
                                    <th className="px-4 py-2">email</th>
                                    <th className="px-4 py-2">role</th>
                                    <th className="px-4 py-2">created_at</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle/30 text-primary">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-2 opacity-70">{i}</td>
                                        <td className="px-4 py-2">User {i}</td>
                                        <td className="px-4 py-2">user{i}@example.com</td>
                                        <td className="px-4 py-2">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${i === 1 ? 'bg-accent/20 text-accent' : 'bg-subtle text-secondary'}`}>
                                                {i === 1 ? 'ADMIN' : 'MEMBER'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 font-mono opacity-70">2023-10-{10 + i}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-secondary bg-panel/30 border border-subtle border-dashed rounded-lg m-4">
                        <div className="w-12 h-12 rounded-full bg-subtle/50 flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                        </div>
                        <p>Visualization coming soon</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataResultsView;
