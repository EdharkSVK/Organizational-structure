import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3-hierarchy';
import { useStore } from '../../data/store';
import type { OrgNode } from '../../data/schema';
import { ViewportShell } from '../layout/ViewportShell';
import { useViewportCamera } from '../../hooks/useViewportCamera';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { getSoCStatus } from '../../lib/colors';

// High-distinctness palette (Kelly's Max Contrast + others)
const DISTINCT_PALETTE = [
    '#E6194B', // Red
    '#3CB44B', // Green
    '#FFE119', // Yellow
    '#4363D8', // Blue
    '#F58231', // Orange
    '#911EB4', // Purple
    '#42D4F4', // Cyan
    '#F032E6', // Magenta
    '#BFEF45', // Lime
    '#FABED4', // Pink
    '#469990', // Teal
    '#DCBEFF', // Lavender
    '#9A6324', // Brown
    '#FFFAC8', // Beige
    '#800000', // Maroon
    '#AAFFC3', // Mint
    '#808000', // Olive
    '#FFD8B1', // Apricot
    '#000075', // Navy
    '#A9A9A9', // Grey
];

export const LayeredCircleView: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const {
        parseResult, showAllLines, selectedNodeId, setSelectedNodeId,
        selectedLocation, selectedDepartment,
        socThresholdLow, socThresholdHigh,
        maxVisibleDepth,
        showGrid, showTooltips
    } = useStore();

    // Shared Camera Hook
    const { containerRef, transform, zoomIn, zoomOut, reset, fitToBounds, isReady } = useViewportCamera({
        minZoom: 0.01,
        maxZoom: 5,
        initialTransform: { x: 0, y: 0, k: 0.8 }
    });

    const [hoveredNode, setHoveredNode] = useState<{ x: number, y: number, data: OrgNode } | null>(null);

    // Layout Data
    const layoutData = useMemo(() => {
        if (!parseResult?.root) return null;

        // Determine Effective Root
        let effectiveRootData = parseResult.root;

        if (selectedDepartment) {
            // Find the Department Head
            // Defined as: Node in target department whose parent is NOT in target department
            const fullRoot = d3.hierarchy(parseResult.root);
            const heads: d3.HierarchyNode<OrgNode>[] = [];

            fullRoot.each(node => {
                const nodeDept = node.data.data.department_name;
                const parentDept = node.parent?.data.data.department_name;

                if (nodeDept === selectedDepartment && parentDept !== selectedDepartment) {
                    heads.push(node);
                }
            });

            if (heads.length > 0) {
                effectiveRootData = heads[0].data;
            }
        }

        const root = d3.hierarchy(effectiveRootData)
            .sort((a, b) => {
                const deptA = a.data.data.department_name || "";
                const deptB = b.data.data.department_name || "";
                const cmp = deptA.localeCompare(deptB);
                if (cmp !== 0) return cmp;
                return (b.value || 0) - (a.value || 0);
            });

        let globalMaxDepth = 0;
        const depthCounts: Record<number, number> = {};

        // 1. Assign Departments to Distinct Colors
        const deptColorMap = new Map<string, string>();
        const uniqueDepartments = new Set<string>();

        if (root.children) {
            root.children.forEach(child => {
                uniqueDepartments.add(child.data.data.department_name);
            });

            let colorIdx = 0;
            uniqueDepartments.forEach(deptName => {
                deptColorMap.set(deptName, DISTINCT_PALETTE[colorIdx % DISTINCT_PALETTE.length]);
                colorIdx++;
            });
        }

        root.each(d => {
            if (d.depth > globalMaxDepth) globalMaxDepth = d.depth;
            depthCounts[d.depth] = (depthCounts[d.depth] || 0) + 1;

            let ancestor = d;
            while (ancestor.depth > 1) {
                if (ancestor.parent) ancestor = ancestor.parent;
                else break;
            }
            if (ancestor.depth === 1) {
                // @ts-ignore
                d.data._displayColor = deptColorMap.get(ancestor.data.data.department_name);
            }
        });

        const tree = d3.tree<OrgNode>()
            .size([2 * Math.PI, 1])
            .separation((a, b) => (a.parent === b.parent ? 1 : 2) / (a.depth || 1));

        tree(root);

        // Secondary Layout (Radial)
        let secondaryRootD3 = null;

        if (parseResult.secondaryRoots && parseResult.secondaryRoots.length > 0) {
            const secondaryDummy = {
                id: 'SEC_ROOT',
                data: { ...parseResult.secondaryRoots[0].data },
                children: parseResult.secondaryRoots,
                depth: 0,
                soc_status: 'ok'
            } as any;

            const secRoot = d3.hierarchy(secondaryDummy);

            // Apply SAME tree layout settings
            tree(secRoot);
            secondaryRootD3 = secRoot;
        }

        // Dept Clusters logic (for Main only? or both? Main is plenty for background context).
        const deptClusters = new Map<string, { minX: number, maxX: number, color: string, maxDepth: number }>();

        if (root.children) {
            (root.children as d3.HierarchyPointNode<OrgNode>[]).forEach(child => {
                const deptName = child.data.data.department_name;
                const color = deptColorMap.get(deptName) || '#ccc';

                let localMin = child.x;
                let localMax = child.x;
                let localMaxDepth = child.depth;

                (child.descendants() as d3.HierarchyPointNode<OrgNode>[]).forEach(d => {
                    if (d.x < localMin) localMin = d.x;
                    if (d.x > localMax) localMax = d.x;
                    if (d.depth > localMaxDepth) localMaxDepth = d.depth;
                });

                const existing = deptClusters.get(deptName);
                if (existing) {
                    deptClusters.set(deptName, {
                        minX: Math.min(existing.minX, localMin),
                        maxX: Math.max(existing.maxX, localMax),
                        color,
                        maxDepth: Math.max(existing.maxDepth, localMaxDepth)
                    });
                } else {
                    deptClusters.set(deptName, {
                        minX: localMin,
                        maxX: localMax,
                        color,
                        maxDepth: localMaxDepth
                    });
                }
            });
        }

        // DYNAMIC RING SCALING
        let maxNodesInLayer = 0;
        Object.values(depthCounts).forEach(c => maxNodesInLayer = Math.max(maxNodesInLayer, c));

        const FIXED_NODE_R = 5;
        const GAP_BETWEEN_NODES = FIXED_NODE_R * 1.5;
        const neededCircumference = maxNodesInLayer * (FIXED_NODE_R * 2 + GAP_BETWEEN_NODES);
        const neededRadius = neededCircumference / (2 * Math.PI);

        // Pre-calculate Lookups for Highlight
        const nodeMap = new Map<string, d3.HierarchyPointNode<OrgNode>>();
        root.descendants().forEach(d => {
            if (d.data && d.data.id) nodeMap.set(d.data.id, d as d3.HierarchyPointNode<OrgNode>);
        });

        return {
            root, // Main Root (HierarchyPointNode)
            secondaryRootD3, // Secondary Root
            maxDepth: globalMaxDepth,
            depthCounts,
            deptClusters,
            minSafeRadius: neededRadius,
            nodeRadius: FIXED_NODE_R,
            nodeMap
        };
    }, [parseResult, selectedDepartment]);

    // Helper: Compute Effective Radius
    const getEffectiveRadius = () => {
        if (!containerRef.current || !layoutData) return 500;
        const { offsetWidth, offsetHeight } = containerRef.current;
        const screenR = Math.min(offsetWidth, offsetHeight) * 0.45;
        // Expand radius if needed to fit nodes
        return Math.max(screenR, layoutData.minSafeRadius);
    };

    // Initial Fit
    useEffect(() => {
        if (isReady && layoutData && containerRef.current) {
            const R = getEffectiveRadius();
            // Fit the computed logical radius into view
            fitToBounds({ x: -R, y: -R, width: R * 2, height: R * 2 }, 50);
        }
    }, [isReady, layoutData, fitToBounds]);

    // Helper: Polar to Cartesian
    const project = (theta: number, r: number) => {
        return {
            x: r * Math.cos(theta - Math.PI / 2),
            y: r * Math.sin(theta - Math.PI / 2)
        };
    };

    // Draw Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !layoutData) return;

        const getStyle = (varName: string) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        const colors = {
            card: `hsl(${getStyle('--card')})`,
            cardFg: `hsl(${getStyle('--card-foreground')})`,
            muted: `hsl(${getStyle('--muted')})`,
            mutedFg: `hsl(${getStyle('--muted-foreground')})`,
            border: `hsl(${getStyle('--border')})`,
            primary: `hsl(${getStyle('--primary')})`,
            background: `hsl(${getStyle('--background')})`,
            grid: `hsl(${getStyle('--border')})`
        };

        const { offsetWidth, offsetHeight } = containerRef.current || { offsetWidth: 800, offsetHeight: 600 };
        const dpr = window.devicePixelRatio || 1;
        canvas.width = offsetWidth * dpr;
        canvas.height = offsetHeight * dpr;
        canvas.style.width = `${offsetWidth}px`;
        canvas.style.height = `${offsetHeight}px`;

        ctx.resetTransform();
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, offsetWidth, offsetHeight);

        const CX = offsetWidth / 2;
        const CY = offsetHeight / 2;

        // USE EFFECTIVE RADIUS
        const RADIUS = getEffectiveRadius();
        const levels = Math.max(1, layoutData.maxDepth);

        ctx.save();
        ctx.translate(transform.x + CX, transform.y + CY);
        ctx.scale(transform.k, transform.k);

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const nodeR = layoutData.nodeRadius;


        // --- Highlight Logic Calculation ---
        const highlightedIds = new Set<string>();
        if (hoveredNode) {
            const target = layoutData.nodeMap?.get(hoveredNode.data.id);
            if (target) {
                // Ancestors (Command Chain)
                let curr = target;
                while (curr) {
                    highlightedIds.add(curr.data.id);
                    curr = curr.parent as d3.HierarchyPointNode<OrgNode>;
                }
                // Descendants (Span of Control)
                target.descendants().forEach(d => highlightedIds.add(d.data.id));
            }
        }

        // If nothing hovered, interaction state is neutral
        const isInteracting = highlightedIds.size > 0;


        // 0. Draw Department Background Wedges & Peripheral Labels
        if (layoutData.deptClusters) {
            layoutData.deptClusters.forEach((cluster, deptName) => {
                let { minX, maxX, color, maxDepth } = cluster;

                if (maxX - minX < 0.01) {
                    minX -= 0.05;
                    maxX += 0.05;
                }

                const wedgeR = (maxDepth / levels) * RADIUS;

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, wedgeR + (10 / transform.k), minX - Math.PI / 2, maxX - Math.PI / 2);
                ctx.closePath();

                ctx.fillStyle = color;
                // Dim wedges if interacting and this wedge is not relevant? 
                // Actually wedges are background context, keeping them subtle is fine.
                ctx.globalAlpha = isInteracting ? 0.05 : 0.15;
                ctx.fill();

                // Peripheral Label
                const arcLen = (maxX - minX) * RADIUS * transform.k;

                if (arcLen > 20) {
                    ctx.save();
                    const midAngle = (minX + maxX) / 2;
                    const labelR = RADIUS * 1.15;
                    const lx = labelR * Math.cos(midAngle - Math.PI / 2);
                    const ly = labelR * Math.sin(midAngle - Math.PI / 2);

                    ctx.translate(lx, ly);

                    if (midAngle > Math.PI) {
                        ctx.rotate(midAngle - Math.PI / 2 + Math.PI);
                    } else {
                        ctx.rotate(midAngle - Math.PI / 2);
                    }

                    ctx.globalAlpha = isInteracting ? 0.2 : 1.0;
                    ctx.fillStyle = colors.cardFg;
                    ctx.font = `600 ${14 / transform.k}px Inter, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(deptName, 0, 0);
                    ctx.restore();
                }
            });
        }
        ctx.globalAlpha = 1.0;

        // 1. Draw Concentric Rings
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        if (showGrid) { // GRID TOGGLE
            for (let i = 1; i <= levels; i++) {
                ctx.globalAlpha = isInteracting ? 0.1 : 0.6;
                ctx.strokeStyle = colors.cardFg;
                ctx.lineWidth = 1.5 / transform.k;
                ctx.beginPath();
                const r = (i / levels) * RADIUS;
                ctx.arc(0, 0, r, 0, 2 * Math.PI);
                ctx.stroke();

                const count = layoutData.depthCounts[i] || 0;
                if (transform.k * r > 50) {
                    ctx.globalAlpha = isInteracting ? 0.2 : 1.0;
                    ctx.fillStyle = colors.cardFg;
                    ctx.font = `700 ${11 / transform.k}px Inter, sans-serif`;
                    ctx.fillText(`L${i}: ${count}`, 0, -r - (4 / transform.k));
                }
            }
        }
        ctx.strokeStyle = colors.mutedFg;
        ctx.globalAlpha = 1.0;

        // Initialize trees list
        const trees = [{ root: layoutData.root as d3.HierarchyPointNode<OrgNode>, isSec: false }];
        if (layoutData.secondaryRootD3) {
            trees.push({ root: layoutData.secondaryRootD3 as d3.HierarchyPointNode<OrgNode>, isSec: true });
        }

        trees.forEach(({ root, isSec }) => {
            const shiftX = isSec ? (RADIUS * 2.5) : 0; // Shift secondary tree to the right

            ctx.save();
            ctx.translate(shiftX, 0);

            // 2. Links
            // Pass 1: Dimmed Links / Normal Links
            ctx.lineWidth = 1.5 / transform.k;

            root.links().forEach(link => {
                // Depth Check
                if (link.source.depth > maxVisibleDepth || link.target.depth > maxVisibleDepth) return;
                if (link.source.data.id === 'SEC_ROOT') return;

                const isHighlightedLink = isInteracting && highlightedIds.has(link.source.data.id) && highlightedIds.has(link.target.data.id);
                if (isHighlightedLink) return;

                let strokeColor = colors.border;
                const headcount = link.source.data.soc_headcount || 0;
                const status = getSoCStatus(headcount, socThresholdLow, socThresholdHigh);

                if (status === 'high' || status === 'low') strokeColor = '#ef4444';
                if (status === 'ok') strokeColor = '#22c55e';

                if (isInteracting) {
                    strokeColor = colors.border;
                    ctx.globalAlpha = 0.05;
                } else {
                    ctx.globalAlpha = 0.6;
                }

                ctx.beginPath();
                ctx.strokeStyle = strokeColor;
                const s = project(link.source.x, link.source.y * RADIUS);
                const t = project(link.target.x, link.target.y * RADIUS);
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(t.x, t.y);
                ctx.stroke();
            });

            // Pass 2: Highlighted Links (Top Layer)
            if (isInteracting) {
                ctx.lineWidth = 2.5 / transform.k;
                ctx.globalAlpha = 0.9;

                root.links().forEach(link => {
                    if (link.source.depth > maxVisibleDepth || link.target.depth > maxVisibleDepth) return;
                    if (link.source.data.id === 'SEC_ROOT') return;

                    const isHighlightedLink = highlightedIds.has(link.source.data.id) && highlightedIds.has(link.target.data.id);

                    if (isHighlightedLink) {
                        const headcount = link.source.data.soc_headcount || 0;
                        const status = getSoCStatus(headcount, socThresholdLow, socThresholdHigh);

                        let strokeColor = colors.primary;
                        if (status === 'high' || status === 'low') strokeColor = '#ef4444';
                        if (status === 'ok') strokeColor = '#22c55e';

                        ctx.strokeStyle = strokeColor;
                        ctx.beginPath();
                        const s = project(link.source.x, link.source.y * RADIUS);
                        const t = project(link.target.x, link.target.y * RADIUS);
                        ctx.moveTo(s.x, s.y);
                        ctx.lineTo(t.x, t.y);
                        ctx.stroke();
                    }
                });
            }

            ctx.globalAlpha = 1.0;

            // 3. Nodes
            root.descendants().forEach(d => {
                if (d.depth > maxVisibleDepth) return;
                if (d.data.id === 'SEC_ROOT') return; // Hide dummy root

                const { x, y } = project(d.x, d.y * RADIUS);

                const isSelected = selectedNodeId === d.data.id;
                const isHovered = hoveredNode?.data.id === d.data.id;
                const isHighlighted = isInteracting && highlightedIds.has(d.data.id);
                const matchesFilter = !selectedLocation || d.data.data.location === selectedLocation;

                const isRelevant = isSelected || isHovered || isHighlighted;
                let alpha = 1.0;
                if (isInteracting) {
                    alpha = isRelevant ? 1.0 : 0.1;
                } else {
                    alpha = matchesFilter ? 1.0 : 0.05;
                }

                ctx.globalAlpha = alpha;
                ctx.beginPath();
                const r = d.depth === 0 ? nodeR * 1.5 : nodeR;
                ctx.arc(x, y, r, 0, 2 * Math.PI);

                // Ensure data.color is applied for nodes
                let fillColor = d.data.color || colors.muted;
                // Fallback to _displayColor if color is missing? parseData sets d.color from dept name.
                // _displayColor in original code was setting wedge ancestor color.
                // User asked for "coloring rules from one layer to another". 
                // This implies using the node's OWN department color is preferred over inherited wedge color.
                // d.data.color is populated by parser.

                if (d.depth === 0) fillColor = colors.card;

                ctx.fillStyle = fillColor;
                ctx.fill();

                // Border
                ctx.lineWidth = 1.5 / transform.k;
                ctx.strokeStyle = colors.background;

                if (isHighlighted) {
                    ctx.strokeStyle = colors.primary;
                }

                if (isSelected || isHovered) {
                    ctx.strokeStyle = colors.primary;
                    ctx.lineWidth = 3 / transform.k;
                }
                ctx.stroke();

                // SoC Ring (Status)
                if (!isInteracting && !isSelected && !isHovered && d.depth > 0) {
                    const status = d.data.soc_status;
                    if (status !== 'ok') {
                        let show = false;
                        if (status === 'high') show = true;
                        if (status === 'low') show = true;
                        if (show) {
                            ctx.lineWidth = 2 / transform.k;
                            ctx.strokeStyle = '#ef4444';
                            ctx.stroke();
                        }
                    }
                }
            });

            ctx.restore();
        });
        ctx.restore();
    }, [transform, layoutData, selectedNodeId, hoveredNode, showAllLines, socThresholdLow, socThresholdHigh, showGrid]);

    // Input Handling
    const handleMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas || !layoutData) return;

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const width = rect.width;
        const height = rect.height;

        const CX = width / 2;
        const CY = height / 2;

        const wx = (mx - (transform.x + CX)) / transform.k;
        const wy = (my - (transform.y + CY)) / transform.k;

        // USE SAME EFFECTIVE RADIUS
        const RADIUS = getEffectiveRadius();

        // HIT TEST
        const hitThreshold = 20 / transform.k;
        const hitThresholdSq = hitThreshold * hitThreshold;

        let minDistSq = Infinity;
        let closest: d3.HierarchyPointNode<OrgNode> | null = null;

        const rootD3 = layoutData.root as d3.HierarchyPointNode<OrgNode>;

        rootD3.descendants().forEach(d => {
            const { x, y } = project(d.x, d.y * RADIUS);
            const distSq = (wx - x) ** 2 + (wy - y) ** 2;
            if (distSq < hitThresholdSq && distSq < minDistSq) {
                minDistSq = distSq;
                closest = d;
            }
        });

        if (closest) {
            const hitNode = closest as d3.HierarchyPointNode<OrgNode>;
            // FLICKER FIX: Only set state if specific node ID Changed or wasn't hovered before
            if (!hoveredNode || hoveredNode.data.id !== hitNode.data.id) {
                setHoveredNode({ data: hitNode.data, x: e.clientX, y: e.clientY });
            } else {
                // Update position even if same node, so tooltip follows mouse? 
                // Or keep tooltip static? Flickering implies aggressive updates.
                // Let's update X/Y but debounce or check limit?
                // Actually if Card position is distinct from cursor, update is fine.
                // The issue is likely re-rendering clearing canvas. 
                // Let's just update X/Y only if diff > some px?
                // For now, minimal update:
                const dx = Math.abs(hoveredNode.x - e.clientX);
                const dy = Math.abs(hoveredNode.y - e.clientY);
                if (dx > 5 || dy > 5) { // Only update if moved > 5px for tooltip to avoid jitter
                    setHoveredNode({ data: (closest as any).data, x: e.clientX, y: e.clientY });
                }
            }
        } else {
            if (hoveredNode) setHoveredNode(null);
        }
    };

    const handleMouseDown = () => {
        if (hoveredNode) {
            setSelectedNodeId(hoveredNode.data.id);
        }
    };

    return (
        <ViewportShell
            containerRef={containerRef}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={reset}
            onFit={() => {
                if (containerRef.current) {
                    const R = getEffectiveRadius();
                    fitToBounds({ x: -R, y: -R, width: R * 2, height: R * 2 });
                }
            }}
            uiOverlay={
                showTooltips && hoveredNode && (
                    <Card
                        className="fixed z-50 p-3 shadow-xl pointer-events-none flex flex-col gap-1 backdrop-blur-md bg-popover/95 text-popover-foreground w-64 animate-in fade-in zoom-in-95 duration-200"
                        style={{
                            // SMART POSITIONING
                            // If mouse is on right half of screen, show tooltip on LEFT.
                            // If mouse is on bottom half, show tooltip on TOP.
                            // This ensures it stays on screen and generally moves away from center if centered.
                            // Also add offset to avoid covering the node.
                            left: hoveredNode.x > window.innerWidth / 2 ? 'auto' : hoveredNode.x + 20,
                            right: hoveredNode.x > window.innerWidth / 2 ? (window.innerWidth - hoveredNode.x) + 20 : 'auto',
                            top: hoveredNode.y > window.innerHeight / 2 ? 'auto' : hoveredNode.y + 20,
                            bottom: hoveredNode.y > window.innerHeight / 2 ? (window.innerHeight - hoveredNode.y) + 20 : 'auto',
                        }}
                    >
                        <div className="font-bold text-sm truncate">{hoveredNode.data.data.employee_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{hoveredNode.data.data.job_title}</div>
                        <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px] h-5">
                                SoC: {hoveredNode.data.soc_headcount}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] h-5">
                                {hoveredNode.data.data.department_name}
                            </Badge>
                        </div>
                    </Card>
                )
            }
        >
            <canvas
                ref={canvasRef}
                className="block w-full h-full outline-none"
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseLeave={() => { if (hoveredNode) setHoveredNode(null); }}
            />
        </ViewportShell>
    );
};
