import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3-hierarchy';
import { useStore } from '../../data/store';
import type { OrgNode } from '../../data/schema';
import { Plus, Minus, Maximize } from 'lucide-react';

const toCartesian = (angle: number, radius: number) => {
    return {
        x: radius * Math.cos(angle - Math.PI / 2),
        y: radius * Math.sin(angle - Math.PI / 2)
    };
};

export const LayeredCircleView: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const {
        parseResult, showAllLines, selectedNodeId, setSelectedNodeId
    } = useStore();

    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);

    // Hover State
    const [hoveredNode, setHoveredNode] = useState<{ x: number, y: number, data: OrgNode } | null>(null);

    const layoutData = useMemo(() => {
        if (!parseResult?.root) return null;
        const hierarchy = d3.hierarchy(parseResult.root)
            .sum(_ => 1)
            .sort((a, b) => (a.data.data.department_name || '').localeCompare(b.data.data.department_name || ''));

        const partition = d3.partition<OrgNode>()
            .size([2 * Math.PI, 1]);

        const root = partition(hierarchy);
        let maxDepth = 0;
        root.each(d => { if (d.depth > maxDepth) maxDepth = d.depth; });

        return { root, maxDepth };

    }, [parseResult]);



    // Draw Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !layoutData) return;

        const { offsetWidth, offsetHeight } = containerRef.current || { offsetWidth: 800, offsetHeight: 600 };
        const dpr = window.devicePixelRatio || 1;
        canvas.width = offsetWidth * dpr;
        canvas.height = offsetHeight * dpr;
        canvas.style.width = `${offsetWidth}px`;
        canvas.style.height = `${offsetHeight}px`;

        ctx.scale(dpr, dpr);

        const CX = offsetWidth / 2;
        const CY = offsetHeight / 2;
        const RADIUS = Math.min(CX, CY) * 0.9;
        const RING_WIDTH = RADIUS / (layoutData.maxDepth + 1);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, offsetWidth, offsetHeight);

        // --- Grid Background ---
        const GRID_SIZE = 40;
        const dotGap = GRID_SIZE * transform.k;
        if (dotGap > 8) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // Dark dots
            const startX = transform.x % dotGap;
            const startY = transform.y % dotGap;

            for (let x = startX; x < offsetWidth; x += dotGap) {
                for (let y = startY; y < offsetHeight; y += dotGap) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }

        ctx.save();
        ctx.translate(CX + transform.x, CY + transform.y);
        ctx.scale(transform.k, transform.k);

        // 1. Draw Visible Background Rings (Levels)
        for (let i = 0; i <= layoutData.maxDepth; i++) {
            const r = i * RING_WIDTH;

            // Fill the ring with subtle alternating colors (Mermaid-style: blueish tints)
            ctx.beginPath();
            ctx.arc(0, 0, r + RING_WIDTH, 0, 2 * Math.PI); // Outer
            ctx.arc(0, 0, r, 0, 2 * Math.PI, true); // Inner (reverse)
            ctx.fillStyle = i % 2 === 0 ? '#e0e7ff' : '#eff6ff'; // Indigo-50 : Blue-50
            ctx.fill();

            // Border Line between levels
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, 2 * Math.PI);
            ctx.strokeStyle = '#94a3b8'; // Slate-400 (Visible grey)
            ctx.lineWidth = 1 / transform.k;
            ctx.stroke();
        }

        // 2. Draw Links
        if (showAllLines) {
            ctx.strokeStyle = '#cbd5e1'; // Slate-300 (Visible connection lines)
            ctx.lineWidth = 1.5 / transform.k;
            ctx.beginPath();
            layoutData.root.descendants().forEach(node => {
                if (!node.parent) return;
                const angle = (node.x0 + node.x1) / 2;
                const pAngle = (node.parent!.x0 + node.parent!.x1) / 2;
                const pR = node.parent!.depth * RING_WIDTH + RING_WIDTH / 2;
                const pPos = toCartesian(pAngle, pR);
                const cR = node.depth * RING_WIDTH + RING_WIDTH / 2;
                const cPos = toCartesian(angle, cR);
                ctx.moveTo(pPos.x, pPos.y);
                ctx.lineTo(cPos.x, cPos.y);
            });
            ctx.stroke();
        }

        // 3. Draw Nodes
        layoutData.root.descendants().forEach(node => {
            const angle = (node.x0 + node.x1) / 2;
            const r = node.depth * RING_WIDTH + RING_WIDTH / 2; // Center of band
            const pos = toCartesian(angle, r);

            // Size based on Arc length available?
            // Arc length = (x1-x0) * r.
            const arcLen = (node.x1 - node.x0) * r;
            const size = node.depth === 0 ? 8 : Math.max(1.5, Math.min(6, arcLen * 0.4));

            const isSelected = selectedNodeId === node.data.id;
            const isHovered = hoveredNode?.data.id === node.data.id;

            if (isSelected || isHovered) {
                ctx.shadowColor = '#3b82f6';
                ctx.shadowBlur = isSelected ? 15 : 10;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillStyle = node.data.color || '#94a3b8';
            ctx.beginPath();
            const drawSize = size * (isSelected ? 1.5 : (isHovered ? 1.3 : 1)) / transform.k * (transform.k > 1 ? transform.k : 1);
            ctx.arc(pos.x, pos.y, drawSize, 0, 2 * Math.PI);
            ctx.fill();

            if (isSelected || isHovered) {
                ctx.strokeStyle = '#3b82f6'; // Bright blue selection
                ctx.lineWidth = 3 / transform.k;
                ctx.stroke();
            } else {
                ctx.strokeStyle = '#475569'; // Slate-600 (Dark border for contrast)
                ctx.lineWidth = 1.5 / transform.k;
                ctx.stroke();
            }
        });

        ctx.restore();

    }, [transform, layoutData, showAllLines, selectedNodeId, hoveredNode]);

    // Helper to constrain transform
    const constrainTransform = (t: { x: number, y: number, k: number }, width: number, height: number) => {
        // Content is roughly a circle of radius R centered at (0,0) in world space
        // We want to ensure this circle is not panned completely off screen.

        const CX = width / 2;
        const CY = height / 2;
        // The max radius of the content in world units
        const RADIUS = Math.min(CX, CY) * 0.9;
        // Actual filled radius based on depth?
        // In the draw loop: const RING_WIDTH = RADIUS / (layoutData.maxDepth + 1);
        // max content radius = (layoutData.maxDepth + 1) * RING_WIDTH = RADIUS.

        // So content content bounding box is [-RADIUS, -RADIUS, RADIUS, RADIUS]
        const contentR = RADIUS;

        // Transform: screenX = worldX * k + tx + CX (since we translate to center first)
        // Wait, current transform logic: 
        // ctx.translate(CX + transform.x, CY + transform.y);
        // ctx.scale(transform.k, transform.k);
        // Screen = (World * k) + (CX + tx)

        // We want Center of layout (0,0 world) to not be too far away.
        // Center screen pos = CX + tx.
        // We want to keep Center screen pos within somewhat reasonable bounds relative to screen.
        // Let's say we want the Content Center to be within [ -RADIUS*k, Width + RADIUS*k ]?
        // Or simpler: Keep the distinct bounding box [-R, -R, R, R] at least partially visible.

        // Left Edge of content on screen: ( -contentR * k ) + CX + t.x
        // Right Edge of content on screen: ( contentR * k ) + CX + t.x

        // Constraint 1: Right Edge must be > 50 (don't pan too far left)
        // (contentR * k) + CX + t.x > 50  => t.x > 50 - CX - contentR * k

        // Constraint 2: Left Edge must be < Width - 50 (don't pan too far right)
        // (-contentR * k) + CX + t.x < width - 50 => t.x < width - 50 - CX + contentR * k

        const minTx = 50 - CX - contentR * t.k;
        const maxTx = width - 50 - CX + contentR * t.k;

        const minTy = 50 - CY - contentR * t.k;
        const maxTy = height - 50 - CY + contentR * t.k;

        return {
            x: Math.max(minTx, Math.min(maxTx, t.x)),
            y: Math.max(minTy, Math.min(maxTy, t.y)),
            k: t.k
        };
    };

    // Input Handlers
    const updateTransform = (updater: (t: typeof transform) => typeof transform) => {
        setTransform(prev => {
            const next = updater(prev);
            const { offsetWidth, offsetHeight } = containerRef.current || { offsetWidth: 800, offsetHeight: 600 };
            return constrainTransform(next, offsetWidth, offsetHeight);
        });
    };

    const zoomIn = () => updateTransform(t => ({ ...t, k: Math.min(t.k * 1.2, 5) }));
    const zoomOut = () => updateTransform(t => ({ ...t, k: Math.max(t.k / 1.2, 0.4) })); // Limit min zoom
    const resetView = () => setTransform({ x: 0, y: 0, k: 1 });



    const handleMouseDown = (e: React.MouseEvent) => {
        // ... Hit Test for Select ...
        // We can reuse hit testing logic for both hover and click if we extract it.
        // For now, implementing click logic using the same math:
        const hit = performHitTest(e.clientX, e.clientY);
        if (hit) {
            setSelectedNodeId(hit.data.id);
        } else {
            setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragStart) {
            setTransform(prev => {
                const next = { ...prev, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
                const { offsetWidth, offsetHeight } = containerRef.current || { offsetWidth: 800, offsetHeight: 600 };
                // Reuse the constrain function logic (locally defined above, or we can just inline it if scope is issue)
                // Since I defined it inside component scope, it is available.
                const CX = offsetWidth / 2;
                const CY = offsetHeight / 2;
                const RADIUS = Math.min(CX, CY) * 0.9;
                const contentR = RADIUS;

                const minTx = 50 - CX - contentR * next.k;
                const maxTx = offsetWidth - 50 - CX + contentR * next.k;
                const minTy = 50 - CY - contentR * next.k;
                const maxTy = offsetHeight - 50 - CY + contentR * next.k;

                return {
                    x: Math.max(minTx, Math.min(maxTx, next.x)),
                    y: Math.max(minTy, Math.min(maxTy, next.y)),
                    k: next.k
                };
            });
        } else {
            // Hover check
            const hit = performHitTest(e.clientX, e.clientY);
            if (hit) {
                // Determine screen position for tooltip
                // hit.pos is world space? No, create a fresh screen coord.
                // Or just use mouse client coords.
                setHoveredNode({ ...hit, x: e.clientX, y: e.clientY });
            } else {
                setHoveredNode(null);
            }
        }
    };

    const handleMouseUp = () => setDragStart(null);

    // Hit Test Utility
    const performHitTest = (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas || !layoutData) return null;

        const { offsetWidth, offsetHeight } = containerRef.current || { offsetWidth: 800, offsetHeight: 600 };
        const CX = offsetWidth / 2;
        const CY = offsetHeight / 2;
        const RADIUS = Math.min(CX, CY) * 0.9;
        const RING_WIDTH = RADIUS / (layoutData.maxDepth + 1);

        const rect = canvas.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;

        const wx = (mx - (CX + transform.x)) / transform.k;
        const wy = (my - (CY + transform.y)) / transform.k;

        for (const node of layoutData.root.descendants()) {
            const r = node.depth * RING_WIDTH + RING_WIDTH / 2;
            const angle = (node.x0 + node.x1) / 2;
            const pos = toCartesian(angle, r);
            // Hit radius
            const arcLen = (node.x1 - node.x0) * r;
            const size = node.depth === 0 ? 8 : Math.max(1.5, Math.min(6, arcLen * 0.4));

            // Scaled hit radius? No, world space logic.
            // visual size is size.
            // simple distance check in world space
            const distSq = (wx - pos.x) ** 2 + (wy - pos.y) ** 2;

            // Adjust hit tolerance based on zoom?
            // If zoomed out (k small), nodes are close.
            // Tolerance should be decent.
            if (distSq <= Math.max(size * 2, 6 / transform.k) ** 2) {
                return { data: node.data, ...pos };
            }
        }
        return null;
    };

    return (
        <div ref={containerRef} className="w-full h-full cursor-move relative bg-[var(--bg-primary)] overflow-hidden">
            <canvas
                ref={canvasRef}
                className="block outline-none"
                // onWheel={handleWheel} // Disabled per user request
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { setDragStart(null); setHoveredNode(null); }}
            />

            {/* Tooltip */}
            {hoveredNode && (
                <div
                    className="fixed z-50 bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-xl rounded px-3 py-2 text-xs pointer-events-none flex flex-col gap-1 backdrop-blur-md bg-opacity-95"
                    style={{
                        left: hoveredNode.x + 15,
                        top: hoveredNode.y + 15
                    }}
                >
                    <div className="font-bold text-[var(--text-primary)]">{hoveredNode.data.data.employee_name}</div>
                    <div className="text-[var(--text-secondary)]">{hoveredNode.data.data.job_title}</div>
                    <div className="flex gap-2 mt-1">
                        <span className="bg-[var(--bg-tertiary)] px-1 rounded text-[var(--accent-primary)] font-mono">
                            SoC: {hoveredNode.data.soc_headcount}
                        </span>
                        <span className="text-[var(--text-muted)]">
                            Depth: {hoveredNode.data.depth}
                        </span>
                    </div>
                </div>
            )}

            <div className="absolute bottom-6 right-6 flex flex-col gap-2 bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border-color)] shadow-xl">
                <button onClick={zoomIn} className="p-2 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)] hover:text-white" title="Zoom In">
                    <Plus size={20} />
                </button>
                <button onClick={zoomOut} className="p-2 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)] hover:text-white" title="Zoom Out">
                    <Minus size={20} />
                </button>
                <div className="h-px bg-[var(--border-color)] my-1" />
                <button onClick={resetView} className="p-2 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)] hover:text-white" title="Reset View">
                    <Maximize size={20} />
                </button>
            </div>
        </div>
    );
};
