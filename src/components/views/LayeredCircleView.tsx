import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3-hierarchy';
import { useStore } from '../../data/store';
import type { OrgNode } from '../../data/schema';
import { ViewportShell } from '../layout/ViewportShell';
import { useViewportCamera } from '../../hooks/useViewportCamera';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

export const LayeredCircleView: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const {
        parseResult, showAllLines, selectedNodeId, setSelectedNodeId
    } = useStore();

    // Shared Camera Hook
    const { containerRef, transform, zoomIn, zoomOut, reset, fitToBounds, isReady } = useViewportCamera({
        minZoom: 0.1,
        maxZoom: 5,
        initialTransform: { x: 0, y: 0, k: 0.8 }
    });

    const [hoveredNode, setHoveredNode] = useState<{ x: number, y: number, data: OrgNode } | null>(null);

    // Layout Data
    const layoutData = useMemo(() => {
        if (!parseResult?.root) return null;

        // Radial Tree Layout
        const root = d3.hierarchy(parseResult.root)
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        // Calculate Max Depth and Counts per Depth
        let maxDepth = 0;
        const depthCounts: Record<number, number> = {};

        root.each(d => {
            if (d.depth > maxDepth) maxDepth = d.depth;
            depthCounts[d.depth] = (depthCounts[d.depth] || 0) + 1;
        });

        // d3.tree size: [angle, radius]
        const tree = d3.tree<OrgNode>()
            .size([2 * Math.PI, 1])
            .separation((a, b) => (a.parent === b.parent ? 1 : 2) / (a.depth || 1));

        tree(root);

        return { root, maxDepth, depthCounts };
    }, [parseResult]);

    // Initial Fit
    useEffect(() => {
        if (isReady && layoutData && containerRef.current) {
            const { offsetWidth, offsetHeight } = containerRef.current;
            const R = Math.min(offsetWidth, offsetHeight) * 0.45;
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

        // Theme Colors
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
        const RADIUS = Math.min(CX, CY) * 0.85; // Slightly smaller to fit labels
        const levels = Math.max(1, layoutData.maxDepth);

        ctx.save();
        ctx.translate(transform.x + CX, transform.y + CY);
        ctx.scale(transform.k, transform.k);

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const rootD3 = layoutData.root as d3.HierarchyPointNode<OrgNode>;

        // 0. Draw Department Background Wedges & Peripheral Labels
        if (rootD3.children) {
            rootD3.children.forEach(dept => {
                let minX = dept.x;
                let maxX = dept.x;
                dept.descendants().forEach(d => {
                    if (d.x < minX) minX = d.x;
                    if (d.x > maxX) maxX = d.x;
                });

                if (maxX - minX < 0.01) {
                    minX -= 0.05;
                    maxX += 0.05;
                }

                // Wedge
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, RADIUS * 1.05, minX - Math.PI / 2, maxX - Math.PI / 2);
                ctx.closePath();
                ctx.fillStyle = dept.data.color || colors.muted;
                ctx.globalAlpha = 0.1;
                ctx.fill();

                // Peripheral Label
                if (transform.k > 0.3) { // Show text if reasonably zoomed
                    ctx.save();
                    const midAngle = (minX + maxX) / 2;
                    // Project a point further out
                    const labelR = RADIUS * 1.15;
                    const lx = labelR * Math.cos(midAngle - Math.PI / 2);
                    const ly = labelR * Math.sin(midAngle - Math.PI / 2);

                    ctx.translate(lx, ly);
                    // Rotate text to be perpendicular to radius? Or upright?
                    // User asked for "outside of circle". Usually radial text is rotated.
                    let rot = midAngle - Math.PI / 2;
                    // Flip if on left side
                    if (midAngle > Math.PI && midAngle < 2 * Math.PI) {
                        rot += Math.PI;
                    }
                    // Actually check geometry: 
                    // 0 is Top. PI is Bottom.
                    // Right side: 0..PI. Left side: PI..2PI.
                    // Correcting for -PI/2 rotation logic:
                    // 0 angle in d3 is UP.
                    // Let's rely on standard:
                    let textRot = midAngle;
                    if (textRot > Math.PI) textRot += Math.PI; // Flip

                    // Simple logic:
                    if (midAngle > Math.PI) {
                        ctx.rotate(midAngle - Math.PI / 2 + Math.PI); // Flip text
                        ctx.textAlign = 'right'; // If flipping, alignment changes? No, rotate around point.
                        // Just center align for now relative to point
                    } else {
                        ctx.rotate(midAngle - Math.PI / 2);
                    }

                    ctx.globalAlpha = 1.0;
                    ctx.fillStyle = colors.cardFg;
                    ctx.font = `600 ${14 / transform.k}px Inter, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(dept.data.data.department_name, 0, 0);
                    ctx.restore();
                }
            });
        }
        ctx.globalAlpha = 1.0;

        // 1. Draw Concentric Rings (Background) & Labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        for (let i = 1; i <= levels; i++) {
            // Ring
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = colors.cardFg; // Darkest (Foreground)
            ctx.lineWidth = 1.5 / transform.k; // Thin
            ctx.beginPath();
            const r = (i / levels) * RADIUS;
            ctx.arc(0, 0, r, 0, 2 * Math.PI);
            ctx.stroke();

            // Label (Level count)
            const count = layoutData.depthCounts[i] || 0;
            if (transform.k > 0.4) {
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = colors.cardFg;
                ctx.font = `700 ${11 / transform.k}px Inter, sans-serif`;
                ctx.fillText(`L${i}: ${count}`, 0, -r - (4 / transform.k));
            }
        }
        ctx.strokeStyle = colors.mutedFg; // Reset for links
        ctx.globalAlpha = 1.0;

        // 2. Draw Links
        ctx.beginPath();
        ctx.lineWidth = 1.5 / transform.k;
        ctx.globalAlpha = 0.5;

        rootD3.links().forEach(link => {
            const s = project(link.source.x, link.source.y * RADIUS);
            const t = project(link.target.x, link.target.y * RADIUS);

            ctx.moveTo(s.x, s.y);
            ctx.lineTo(t.x, t.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // 3. Draw Nodes (Dots)
        rootD3.descendants().forEach(d => {
            const { x, y } = project(d.x, d.y * RADIUS);

            const isSelected = selectedNodeId === d.data.id;
            const isHovered = hoveredNode?.data.id === d.data.id;

            const isRelevant = isSelected || isHovered;
            const globalDim = (selectedNodeId || hoveredNode) && !isRelevant;

            ctx.globalAlpha = globalDim ? 0.2 : 1.0;

            ctx.beginPath();
            const r = d.depth === 0 ? 8 : 4;
            ctx.arc(x, y, r, 0, 2 * Math.PI);

            ctx.fillStyle = d.data.color || colors.muted;
            if (d.depth === 0) ctx.fillStyle = colors.card;

            ctx.fill();

            // Border
            ctx.lineWidth = 1.5 / transform.k;
            ctx.strokeStyle = colors.background;
            if (isSelected) {
                ctx.strokeStyle = colors.primary;
                ctx.lineWidth = 3 / transform.k;
            }
            ctx.stroke();

            // Highlight Ring
            if (isHovered && !isSelected) {
                ctx.beginPath();
                ctx.arc(x, y, r + 4 / transform.k, 0, 2 * Math.PI);
                ctx.strokeStyle = colors.primary;
                ctx.lineWidth = 1 / transform.k;
                ctx.stroke();
            }
        });

        ctx.restore();

    }, [transform, layoutData, selectedNodeId, hoveredNode, showAllLines]);

    // Input Handling
    const handleMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas || !layoutData) return;

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const { offsetWidth, offsetHeight } = containerRef.current || { offsetWidth: 800, offsetHeight: 600 };
        const CX = offsetWidth / 2;
        const CY = offsetHeight / 2;

        // World coordinates
        const wx = (mx - (transform.x + CX)) / transform.k;
        const wy = (my - (transform.y + CY)) / transform.k;

        const RADIUS = Math.min(CX, CY) * 0.85; // Updated Radius
        const hitThreshold = 10 / transform.k;
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
            setHoveredNode({ data: (closest as any).data, x: e.clientX, y: e.clientY });
        } else {
            setHoveredNode(null);
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
                    const { offsetWidth, offsetHeight } = containerRef.current;
                    const R = Math.min(offsetWidth, offsetHeight) * 0.45;
                    fitToBounds({ x: -R, y: -R, width: R * 2, height: R * 2 });
                }
            }}
            uiOverlay={
                hoveredNode && (
                    <Card
                        className="fixed z-50 p-3 shadow-xl pointer-events-none flex flex-col gap-1 backdrop-blur-md bg-popover/95 text-popover-foreground w-64 animate-in fade-in zoom-in-95 duration-200"
                        style={{
                            left: hoveredNode.x + 20,
                            top: hoveredNode.y + 20
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
                onMouseLeave={() => setHoveredNode(null)}
            />
        </ViewportShell>
    );
};
