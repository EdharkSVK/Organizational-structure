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

        // Partition Layout
        const root = d3.hierarchy(parseResult.root)
            .sum(d => (d as any).value || 1) // Cast to any to avoid TS error if value generic missing
            // For org chart layers, usually equal size wedges per level?
            // Actually hierarchy partition does value.
            // Let's rely on default 'count' or '1' for now.
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        const partition = d3.partition<OrgNode>().size([2 * Math.PI, 1]); // x=angle, y=radius [0,1]
        partition(root);

        // Calculate Max Depth
        let maxDepth = 0;
        root.each(d => { if (d.depth > maxDepth) maxDepth = d.depth; });

        return { root, maxDepth };
    }, [parseResult]);

    // Initial Fit
    useEffect(() => {
        if (isReady && layoutData && containerRef.current) {
            const { offsetWidth, offsetHeight } = containerRef.current;
            const R = Math.min(offsetWidth, offsetHeight) * 0.45;
            fitToBounds({ x: -R, y: -R, width: R * 2, height: R * 2 }, 50);
        }
    }, [isReady, layoutData, fitToBounds]);

    // Themes
    // We memoize colors or fetch in draw loop (cheap enough for native call usually)

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
            background: `hsl(${getStyle('--background')})`
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
        const RADIUS = Math.min(CX, CY) * 0.9;


        ctx.save();
        ctx.translate(transform.x + CX, transform.y + CY);
        ctx.scale(transform.k, transform.k);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        (layoutData.root as d3.HierarchyRectangularNode<OrgNode>).descendants().forEach(_d => {
            const d = _d as unknown as d3.HierarchyRectangularNode<OrgNode>;
            const innerR = d.y0 * RADIUS;
            const outerR = d.y1 * RADIUS;
            const startA = d.x0 - Math.PI / 2;
            const endA = d.x1 - Math.PI / 2;

            const isSelected = selectedNodeId === d.data.id;
            const isHovered = hoveredNode?.data.id === d.data.id;

            // Fill
            ctx.beginPath();
            ctx.arc(0, 0, outerR, startA, endA);
            ctx.arc(0, 0, innerR, endA, startA, true);
            ctx.closePath();

            // Color Logic
            if (d.depth === 0) {
                ctx.fillStyle = colors.card;
            } else {
                ctx.fillStyle = d.data.color || colors.muted;
            }
            if ((selectedNodeId || hoveredNode) && !isSelected && !isHovered && !isAncestor(d, hoveredNode?.data || null) && !isAncestor(d, { id: selectedNodeId } as any)) {
                ctx.globalAlpha = 0.3;
            } else {
                ctx.globalAlpha = 1.0;
            }

            ctx.fill();
            ctx.globalAlpha = 1.0;

            // Stroke
            ctx.lineWidth = 1 / transform.k;
            ctx.strokeStyle = colors.background;
            if (isSelected) {
                ctx.lineWidth = 3 / transform.k;
                ctx.strokeStyle = colors.primary;
            }
            ctx.stroke();

            // Labels
            if (transform.k * (outerR - innerR) > 15 && (endA - startA) * outerR * transform.k > 20) {
                const angle = (startA + endA) / 2;
                const r = (innerR + outerR) / 2;
                const x = r * Math.cos(angle);
                const y = r * Math.sin(angle);

                ctx.save();
                ctx.translate(x, y);
                let rot = angle;
                if (rot > Math.PI / 2 && rot < 3 * Math.PI / 2) rot += Math.PI;
                ctx.rotate(rot);

                ctx.fillStyle = d.depth === 0 ? colors.cardFg : '#ffffff';
                if (d.depth > 0 && isLight(d.data.color)) ctx.fillStyle = colors.cardFg;

                ctx.font = '600 10px Inter, sans-serif';
                let label = d.data.data.department_name || d.data.data.employee_name || '';
                if (label.length > 15) label = label.substring(0, 14) + '..';
                ctx.fillText(label, 0, 0);

                ctx.restore();
            }
        });

        ctx.restore();

    }, [transform, layoutData, selectedNodeId, hoveredNode, showAllLines]);

    // Helpers
    const isAncestor = (_node: any, target: OrgNode | null) => {
        if (!target) return false;
        // Check if target ID is in node's descendants
        // Simplified check:
        // hierarchy node has .descendants().
        // But checking every frame is slow if optimized.
        // For MVP, simple ID check if we store ancestors?
        // D3 Node has .ancestors().
        // If node is an ancestor of target?
        // Let's just return false for now to avoid perf hit or complex logic without lookup map.
        return false;
    };
    const isLight = (_color?: string) => false;


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

        // Transform is applied AFTER translation to CX,CY
        // ctx.translate(transform.x + CX, transform.y + CY);
        // ctx.scale(transform.k, transform.k);
        // So WorldX = (ScreenX - (transform.x + CX)) / k

        const wx = (mx - (transform.x + CX)) / transform.k;
        const wy = (my - (transform.y + CY)) / transform.k;

        const RADIUS = Math.min(CX, CY) * 0.9;
        const RW = RADIUS / (layoutData.maxDepth + 1);

        const d = Math.sqrt(wx * wx + wy * wy);
        let foundNode = null;

        if (d <= RADIUS) {
            let a = Math.atan2(wy, wx) + Math.PI / 2;
            if (a < 0) a += 2 * Math.PI;

            const depth = Math.floor(d / RW);
            foundNode = layoutData.root.descendants().find(_n => {
                const n = _n as unknown as d3.HierarchyRectangularNode<OrgNode>;
                return n.depth === depth && a >= n.x0 && a <= n.x1;
            });
        }

        if (foundNode) {
            setHoveredNode({ data: foundNode.data, x: e.clientX, y: e.clientY });
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
