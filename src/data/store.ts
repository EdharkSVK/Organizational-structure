import { create } from 'zustand';
import type { ParseResult } from './schema';

export type ViewType = 'chart' | 'circle';
export type ScopeType = 'group' | 'subsidiary' | 'department';

interface AppState {
    // Data State
    rawFile: File | null;
    fileName: string | null;
    parseResult: ParseResult | null;
    isLoading: boolean;
    error: string | null;

    // State
    datasetName: string | null;
    isReadyToVisualize: boolean;

    // View State
    currentView: ViewType;

    // Scope / Filters
    selectedLocation: string | null;
    selectedDepartment: string | null;
    searchQuery: string;
    selectedNodeId: string | null;

    // Settings
    socThresholdLow: number;
    socThresholdHigh: number;
    showAllLines: boolean;
    showContractors: boolean;

    // Actions
    setFile: (file: File) => void;
    setDatasetName: (name: string) => void;
    setIsReadyToVisualize: (ready: boolean) => void;

    setParseResult: (result: ParseResult) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    setView: (view: ViewType) => void;

    // Unified Filter Action
    setFilter: (type: 'location' | 'department', value: string | null) => void;

    setSearchQuery: (query: string) => void;
    setSelectedNodeId: (id: string | null) => void;

    setSoCThresholds: (low: number, high: number) => void;
    toggleShowAllLines: () => void;
    toggleShowContractors: () => void;

    // New Toggles
    showGrid: boolean;
    showTooltips: boolean;
    toggleShowGrid: () => void;
    toggleShowTooltips: () => void;

    // Depth Filter
    maxVisibleDepth: number;
    setMaxVisibleDepth: (depth: number) => void;
}

export const useStore = create<AppState>((set) => ({
    rawFile: null,
    fileName: null,
    parseResult: null,
    isLoading: false,
    error: null,

    datasetName: null,
    isReadyToVisualize: false,

    currentView: 'chart',

    // Filters
    selectedLocation: null,
    selectedDepartment: null,

    searchQuery: '',
    selectedNodeId: null,

    socThresholdLow: 3,
    socThresholdHigh: 8,
    showAllLines: true,
    showContractors: true,

    setFile: (file) => set({ rawFile: file, fileName: file.name }),
    setDatasetName: (name) => set({ datasetName: name }),
    setIsReadyToVisualize: (ready) => set({ isReadyToVisualize: ready }),

    setParseResult: (result) => set({ parseResult: result, isLoading: false, error: null }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error: error, isLoading: false }),

    setView: (view) => set({ currentView: view }),

    setFilter: (type, value) => {
        if (type === 'location') return set({ selectedLocation: value });
        if (type === 'department') return set({ selectedDepartment: value });
    },

    setSearchQuery: (query) => set({ searchQuery: query }),
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

    setSoCThresholds: (low, high) => set({ socThresholdLow: low, socThresholdHigh: high }),
    toggleShowAllLines: () => set((state) => ({ showAllLines: !state.showAllLines })),
    toggleShowContractors: () => set((state) => ({ showContractors: !state.showContractors })),

    // New Toggles
    showGrid: true,
    showTooltips: true,
    toggleShowGrid: () => set((state) => ({ showGrid: !state.showGrid })),
    toggleShowTooltips: () => set((state) => ({ showTooltips: !state.showTooltips })),

    // Depth Filter
    maxVisibleDepth: 20, // Default generous, will clamp in UI
    setMaxVisibleDepth: (depth) => set({ maxVisibleDepth: depth }),
}));
