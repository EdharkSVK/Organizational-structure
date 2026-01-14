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
            const name = node.data.employee_name || "";
            if (name.toLowerCase().includes(searchQuery.toLowerCase())) {
                results.push(node);
                if (results.length >= 10) break;
            }
        }
        return results;
    }, [searchQuery, parseResult]);

    const selectedNode = selectedNodeId && parseResult ? parseResult.flatNodes.get(selectedNodeId) : null;

    return (

        <aside className="w-72 max-h-[calc(100vh-160px)] flex flex-col rounded-xl border border-[var(--border-color)] bg-white/95 backdrop-blur-md shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-3 flex-1">
                <h2 className="label text-xs font-bold mb-2 uppercase tracking-wider text-muted-foreground">Details & Search</h2>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-2 top-2 text-[var(--text-secondary)]" size={14} />
                    <input
                        type="text"
                        placeholder="Find employee..."
                        className="input pl-8 h-8 text-xs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />

                    {/* Search Dropdown - Relative now to expand panel */}
                    {searchQuery.length >= 2 && searchResults.length > 0 && (
                        <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded shadow-sm mt-2 overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                            {searchResults.map(node => (
                                <div
                                    key={node.id}
                                    className="p-2 text-xs hover:bg-[var(--accent-primary)] hover:text-white cursor-pointer border-b last:border-0 border-border/50"
                                    onClick={() => {
                                        setSelectedNodeId(node.id);
                                        setSearchQuery('');
                                    }}
                                >
                                    <div className="font-medium">{node.data.employee_name}</div>
                                    <div className="text-[10px] opacity-70">{node.data.job_title}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected Node Details */}
                {selectedNode ? (
                    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4 duration-200">
                        <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xl">
                                👤
                            </div>
                            <button onClick={() => setSelectedNodeId(null)} className="text-[var(--text-secondary)] hover:text-white">
                                <X size={14} />
                            </button>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight">{selectedNode.data.employee_name}</h3>
                            <p className="text-xs text-[var(--text-secondary)]">{selectedNode.data.job_title}</p>
                        </div>

                        <div className="space-y-2 mt-1">
                            <div>
                                <span className="label text-[10px]">Department</span>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ background: selectedNode.color }}></span>
                                    <span className="text-xs">{selectedNode.data.department_name}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-[var(--bg-primary)] p-1.5 rounded border border-[var(--border-color)]">
                                    <span className="label text-[10px]">Headcount</span>
                                    <div className="text-sm font-mono font-semibold">{selectedNode.soc_headcount}</div>
                                </div>
                                <div className="bg-[var(--bg-primary)] p-1.5 rounded border border-[var(--border-color)]">
                                    <span className="label text-[10px]">FTE</span>
                                    <div className="text-sm font-mono font-semibold">{selectedNode.soc_fte.toFixed(1)}</div>
                                </div>
                            </div>

                            <div>
                                <span className="label text-[10px]">Manager</span>
                                {selectedNode.parentId ? (
                                    <button
                                        className="text-[var(--accent-primary)] hover:underline text-xs flex items-center gap-1 mt-0.5"
                                        onClick={() => setSelectedNodeId(selectedNode.parentId)}
                                    >
                                        <User size={10} /> View Manager
                                    </button>
                                ) : (
                                    <span className="text-xs text-[var(--text-muted)] block mt-0.5">No Manager (Root)</span>
                                )}
                            </div>

                            {selectedNode.data.location && (
                                <div>
                                    <span className="label text-[10px]">Location</span>
                                    <div className="text-xs">{selectedNode.data.location}</div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </aside>
    );
};
