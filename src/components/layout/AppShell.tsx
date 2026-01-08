import React, { useMemo } from 'react';
import { useStore } from '../../data/store';
import { DetailsPanel } from './DetailsPanel';
import { SoCControls } from './SoCControls';
import { Layout, Search, Users, Circle, FolderOpen, Maximize, Minus, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        datasetName,
        currentView, setView,
        selectedLocation, selectedDepartment, setFilter,
        searchQuery, setSearchQuery,
        parseResult,
        setIsReadyToVisualize, // To go back
        socThresholdLow, socThresholdHigh, setSoCThresholds,
        showGrid, toggleShowGrid,
        showTooltips, toggleShowTooltips
    } = useStore();


    // Derived Lists for Dropdowns
    const { locations, departments, deptColors, currentCount } = useMemo(() => {
        if (!parseResult) return { locations: [], departments: [], deptColors: new Map(), currentCount: 0 };
        const locs = new Set<string>();
        const depts = new Set<string>();
        const colors = new Map<string, string>();

        // Calculate count based on current filters
        let count = 0;

        parseResult.flatNodes.forEach(node => {
            if (node.data.location) locs.add(node.data.location);
            // Fallback if user used subsidiary column? Let's check both if strictly needed, but user asked for location.
            // If location is empty, maybe check subsidiary? But let's stick to location as requested.

            if (node.data.department_name) {
                depts.add(node.data.department_name);
                colors.set(node.data.department_name, node.color || '#ccc');
            }

            // Counting logic (AND)
            const matchesLocation = !selectedLocation || node.data.location === selectedLocation;
            const matchesDepartment = !selectedDepartment || node.data.department_name === selectedDepartment;

            if (matchesLocation && matchesDepartment) {
                count++;
            }
        });

        return {
            locations: Array.from(locs).sort(),
            departments: Array.from(depts).sort(),
            deptColors: colors,
            currentCount: count
        };
    }, [parseResult, selectedLocation, selectedDepartment]);

    const handleReset = () => {
        // Simple "Back to Home"
        setIsReadyToVisualize(false);
    };

    return (
        <TooltipProvider>
            <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">

                {/* SIDEBAR */}
                <aside className="w-[280px] flex-none border-r bg-card flex flex-col z-20 shadow-xl shadow-black/5">

                    {/* Header */}
                    <div className="h-14 flex items-center px-4 border-b gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                            <Layout size={18} />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <h1 className="font-bold text-sm tracking-tight leading-none">OrgViz</h1>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={datasetName || ''}>{datasetName || 'Untitled'}</span>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">

                        {/* Search */}
                        <div className="space-y-2">
                            <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Find employee..."
                                    className="pl-9 h-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* View Switcher */}
                        <div className="space-y-2">
                            <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Visualization</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant={currentView === 'chart' ? 'default' : 'outline'}
                                    size="sm"
                                    className="justify-start px-2"
                                    onClick={() => setView('chart')}
                                >
                                    <Users className="mr-2 h-4 w-4" /> Tree
                                </Button>
                                <Button
                                    variant={currentView === 'circle' ? 'default' : 'outline'}
                                    size="sm"
                                    className="justify-start px-2"
                                    onClick={() => setView('circle')}
                                >
                                    <Circle className="mr-2 h-4 w-4" /> Circle
                                </Button>
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        {/* Filters / Scope */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Filters</Label>
                                <Badge variant="secondary" className="text-[10px] h-5">{currentCount.toLocaleString()} Nodes</Badge>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Location</Label>
                                <select
                                    className="w-full text-xs bg-background border rounded-md p-2"
                                    value={selectedLocation || ''}
                                    onChange={(e) => setFilter('location', e.target.value || null)}
                                >
                                    <option value="">All Locations</option>
                                    {locations.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Department</Label>
                                <select
                                    className="w-full text-xs bg-background border rounded-md p-2"
                                    value={selectedDepartment || ''}
                                    onChange={(e) => setFilter('department', e.target.value || null)}
                                >
                                    <option value="">All Departments</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        {/* SoC Settings */}
                        <div className="space-y-3">
                            <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Span of Control (SoC)</Label>
                            <SoCControls
                                currentLow={socThresholdLow}
                                currentHigh={socThresholdHigh}
                                onApply={setSoCThresholds}
                            />
                        </div>

                        {/* Toggles */}
                        <div className="space-y-3">
                            <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Display</Label>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="show-lines" className="text-xs font-normal">Grid Lines</Label>
                                <Switch id="show-lines" checked={showGrid} onCheckedChange={toggleShowGrid} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="show-labels" className="text-xs font-normal">Details on Hover</Label>
                                <Switch id="show-labels" checked={showTooltips} onCheckedChange={toggleShowTooltips} />
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        {/* Legend */}
                        <div className="space-y-3">
                            <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Legend</Label>
                            {/* SoC */}
                            <div className="space-y-2">
                                <div className="text-[10px] font-semibold text-muted-foreground">Span of Control</div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <div className="w-2 h-2 rounded-full border border-red-500 bg-red-500/20" /> Low (&lt;3)
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <div className="w-2 h-2 rounded-full border border-emerald-500 bg-emerald-500/20" /> Healthy (3-8)
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <div className="w-2 h-2 rounded-full border border-amber-500 bg-amber-500/20" /> High (&gt;8)
                                    </div>
                                </div>
                            </div>

                            {/* Departments */}
                            <div className="space-y-2 pt-2">
                                <div className="text-[10px] font-semibold text-muted-foreground">Departments top 5</div>
                                <div className="space-y-1">
                                    {departments.slice(0, 5).map(d => (
                                        <div key={d} className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: deptColors.get(d) }} />
                                            <span className="truncate">{d}</span>
                                        </div>
                                    ))}
                                    {departments.length > 5 && <div className="text-[10px] text-muted-foreground pl-4">...and {departments.length - 5} more</div>}
                                </div>
                            </div>
                        </div>


                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t bg-muted/20">
                        <Button variant="outline" size="sm" className="w-full" onClick={handleReset}>
                            <FolderOpen className="mr-2 h-3.5 w-3.5" /> Open / New
                        </Button>
                    </div>
                </aside>

                {/* MAIN VIEWPORT */}
                <main className="flex-1 relative bg-slate-50/50 dark:bg-slate-950/50">
                    {children}

                    {/* Floating Controls Overlay */}
                    <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
                        <Card className="p-1 flex flex-col gap-1 shadow-md bg-background/80 backdrop-blur-sm border-input">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Zoom In</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm">
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Zoom Out</TooltipContent>
                            </Tooltip>
                            <Separator />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm">
                                        <Maximize className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Fit to Screen</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm">
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Reset</TooltipContent>
                            </Tooltip>
                        </Card>
                    </div>

                    {/* Details Panel Floating */}
                    <div className="absolute top-4 right-16 bottom-4 z-30 pointer-events-none flex flex-col justify-end">
                        <div className="pointer-events-auto">
                            <DetailsPanel />
                        </div>
                    </div>

                </main>
            </div>
        </TooltipProvider>
    );
};
