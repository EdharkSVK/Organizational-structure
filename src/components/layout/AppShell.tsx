import React, { useMemo } from 'react';
import { useStore } from '../../data/store';
import { FileUpload } from '../ui/FileUpload';
import { DetailsPanel } from './DetailsPanel';
import { WelcomeScreen } from './WelcomeScreen';
import { Layout, Users, Circle, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        currentView, setView,
        scopeType, setScope,
        selectedSubsidiary, selectedDepartment,
        parseResult
    } = useStore();

    const hasData = !!parseResult?.root;
    const stats = parseResult?.stats;

    // Derived Lists for Dropdowns
    const { subsidiaries, departments } = useMemo(() => {
        if (!parseResult) return { subsidiaries: [], departments: [] };
        const subs = new Set<string>();
        const depts = new Set<string>();

        parseResult.flatNodes.forEach(node => {
            if (node.data.subsidiary_name) subs.add(node.data.subsidiary_name);
            if (node.data.department_name) depts.add(node.data.department_name);
        });

        return {
            subsidiaries: Array.from(subs).sort(),
            departments: Array.from(depts).sort()
        };
    }, [parseResult]);



    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
            {/* Top Bar: Header & Primary Actions */}
            <header className="flex-none h-14 border-b border-[var(--border-color)] bg-slate-50 flex items-center px-4 justify-between z-30 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                            <Layout size={18} />
                        </div>
                        <h1 className="font-bold text-lg tracking-tight text-[var(--text-primary)]">OrgViz</h1>
                    </div>

                    <div className="h-6 w-px bg-[var(--border-color)] mx-2" />

                    {/* View Switcher */}
                    {hasData && (
                        <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                            <button
                                onClick={() => setView('chart')}
                                className={clsx(
                                    "px-3 py-1 flex items-center gap-2 text-xs font-semibold rounded-md transition-all",
                                    currentView === 'chart'
                                        ? "bg-white text-[var(--accent-primary)] shadow-sm ring-1 ring-black/5"
                                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                )}
                            >
                                <Users size={14} /> Chart
                            </button>
                            <button
                                onClick={() => setView('circle')}
                                className={clsx(
                                    "px-3 py-1 flex items-center gap-2 text-xs font-semibold rounded-md transition-all",
                                    currentView === 'circle'
                                        ? "bg-white text-[var(--accent-primary)] shadow-sm ring-1 ring-black/5"
                                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                )}
                            >
                                <Circle size={14} /> Layers
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">Source:</span>
                        <FileUpload />
                    </div>
                </div>
            </header>

            {/* Main Canvas Area */}
            <main className="flex-1 relative overflow-hidden bg-[var(--bg-primary)]">
                {hasData ? children : <WelcomeScreen />}

                {/* Floating Details Panel (Absolute positioned over canvas) */}
                {hasData && (
                    <div className="absolute top-4 right-4 bottom-20 z-40 flex flex-col pointer-events-none">
                        {/* We wrap DetailsPanel in a pointer-events-auto div so clicks pass through elsewhere */}
                        <div className="pointer-events-auto">
                            <DetailsPanel />
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Bar: Filters & Legend */}
            {hasData && (
                <footer className="flex-none h-16 border-t border-[var(--border-color)] bg-slate-50 flex items-center px-6 justify-between z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">

                    {/* Filters */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Scope</span>
                            <div className="flex items-center gap-2 bg-white rounded-md p-1 border border-slate-200 shadow-sm">
                                <label className={clsx("cursor-pointer px-2 py-1 rounded text-xs transition-colors", scopeType === 'group' ? "bg-white shadow-sm font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-white/50")}>
                                    <input type="radio" name="scope" className="hidden" checked={scopeType === 'group'} onChange={() => setScope('group', null)} />
                                    Group
                                </label>
                                <label className={clsx("cursor-pointer px-2 py-1 rounded text-xs transition-colors", scopeType === 'subsidiary' ? "bg-white shadow-sm font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-white/50")}>
                                    <input type="radio" name="scope" className="hidden" checked={scopeType === 'subsidiary'} onChange={() => setScope('subsidiary', subsidiaries[0] || null)} />
                                    Subsidiary
                                </label>
                                <label className={clsx("cursor-pointer px-2 py-1 rounded text-xs transition-colors", scopeType === 'department' ? "bg-white shadow-sm font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-white/50")}>
                                    <input type="radio" name="scope" className="hidden" checked={scopeType === 'department'} onChange={() => setScope('department', departments[0] || null)} />
                                    Department
                                </label>
                            </div>

                            {/* Contextual Dropdowns */}
                            {scopeType === 'subsidiary' && (
                                <div className="relative">
                                    <select
                                        className="appearance-none bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] font-medium text-[var(--text-primary)] mw-[150px]"
                                        value={selectedSubsidiary || ''}
                                        onChange={(e) => setScope('subsidiary', e.target.value)}
                                    >
                                        {subsidiaries.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-2 top-2.5 pointer-events-none text-[var(--text-muted)]" />
                                </div>
                            )}
                            {scopeType === 'department' && (
                                <div className="relative">
                                    <select
                                        className="appearance-none bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] font-medium text-[var(--text-primary)] mw-[150px]"
                                        value={selectedDepartment || ''}
                                        onChange={(e) => setScope('department', e.target.value)}
                                    >
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-2 top-2.5 pointer-events-none text-[var(--text-muted)]" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats & Legend */}
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">SoC Health</span>
                            <div className="flex gap-3 text-xs">
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> &lt;3</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> 3-8</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> &gt;8</span>
                            </div>
                        </div>

                        <div className="h-8 w-px bg-[var(--border-color)]" />

                        <div className="text-xs text-right">
                            <div className="font-bold text-[var(--text-primary)]">{stats?.validRows.toLocaleString()}</div>
                            <div className="text-[var(--text-muted)] text-[10px] uppercase">People</div>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
};
