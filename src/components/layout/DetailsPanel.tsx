import React, { useMemo } from 'react';
import { useStore } from '../../data/store';
import { Search, X, User } from 'lucide-react';

export const DetailsPanel: React.FC = () => {
    const {
        parseResult,
        selectedNodeId, setSelectedNodeId,
        searchQuery, setSearchQuery
    } = useStore();

    // Derived Search Results
    const searchResults = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2 || !parseResult) return [];
        const results: any[] = [];
        // Limit to 10
        for (const node of parseResult.flatNodes.values()) {
            if (node.data.employee_name.toLowerCase().includes(searchQuery.toLowerCase())) {
                results.push(node);
                if (results.length >= 10) break;
            }
        }
        return results;
    }, [searchQuery, parseResult]);

    const selectedNode = selectedNodeId && parseResult ? parseResult.flatNodes.get(selectedNodeId) : null;

    return (

        <aside className="w-80 max-h-[calc(100vh-160px)] flex flex-col rounded-xl border border-[var(--border-color)] bg-white/95 backdrop-blur-md shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-4 flex-1">
                <h2 className="label text-sm font-bold mb-4">Details & Search</h2>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-2 top-2.5 text-[var(--text-secondary)]" size={16} />
                    <input
                        type="text"
                        placeholder="Find employee..."
                        className="input pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />

                    {/* Search Dropdown */}
                    {searchQuery.length >= 2 && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded shadow-xl mt-1 z-20 overflow-hidden">
                            {searchResults.map(node => (
                                <div
                                    key={node.id}
                                    className="p-2 text-sm hover:bg-[var(--accent-primary)] hover:text-white cursor-pointer"
                                    onClick={() => {
                                        setSelectedNodeId(node.id);
                                        setSearchQuery('');
                                    }}
                                >
                                    <div className="font-medium">{node.data.employee_name}</div>
                                    <div className="text-xs opacity-70">{node.data.job_title}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected Node Details */}
                {selectedNode ? (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-200">
                        <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-2xl">
                                👤
                            </div>
                            <button onClick={() => setSelectedNodeId(null)} className="text-[var(--text-secondary)] hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">{selectedNode.data.employee_name}</h3>
                            <p className="text-[var(--text-secondary)]">{selectedNode.data.job_title}</p>
                        </div>

                        <div className="space-y-3 mt-2">
                            <div>
                                <span className="label">Department</span>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{ background: selectedNode.color }}></span>
                                    <span>{selectedNode.data.department_name}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-[var(--bg-primary)] p-2 rounded border border-[var(--border-color)]">
                                    <span className="label">Headcount</span>
                                    <div className="text-lg font-mono">{selectedNode.soc_headcount}</div>
                                </div>
                                <div className="bg-[var(--bg-primary)] p-2 rounded border border-[var(--border-color)]">
                                    <span className="label">FTE</span>
                                    <div className="text-lg font-mono">{selectedNode.soc_fte.toFixed(1)}</div>
                                </div>
                            </div>

                            <div>
                                <span className="label">Manager</span>
                                {selectedNode.parentId ? (
                                    <button
                                        className="text-[var(--accent-primary)] hover:underline text-sm flex items-center gap-1"
                                        onClick={() => setSelectedNodeId(selectedNode.parentId)}
                                    >
                                        <User size={12} /> View Manager
                                    </button>
                                ) : (
                                    <span className="text-sm text-[var(--text-muted)]">No Manager (Root)</span>
                                )}
                            </div>

                            {selectedNode.data.location && (
                                <div>
                                    <span className="label">Location</span>
                                    <div>{selectedNode.data.location}</div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-[var(--text-muted)] mt-10">
                        <User size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Select a person to view details</p>
                    </div>
                )}
            </div>
        </aside>
    );
};
