import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3-hierarchy';
import { useStore } from '../../data/store';
import type { OrgNode } from '../../data/schema';
import { Minus, Plus, Maximize } from 'lucide-react';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const LEVEL_GAP = 120;

export const OrgChartView: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const {
        parseResult, selectedSubsidiary, selectedDepartment, scopeType,
        selectedNodeId, setSelectedNodeId
    } = useStore();

    // Viewport State
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);

    // Memoize Tree Layout
    const treeData = useMemo(() => {
        if (!parseResult?.root) return null;
        let rootNode = parseResult.root;

        // --- SCOPING LOGIC ---
        // Basic filtering strategy: Find the virtual root for the scope
        if (scopeType === 'department' && selectedDepartment) {
            // Find ALL nodes in this dept? No, find the top-most managers in this dept?
            // Or just filter visual visibility? 
            // For MVP: Find the first node that matches dept to serve as root (or synthetic root if multiple)
            // Better: Filter the dataset then re-build tree? Costly.
            // Simple: Just find the highest node in that Department.
            // We search BFS for first node in Dept.
            const q = [rootNode];
            let foundRoot = null;
            while (q.length) {
                const n = q.shift()!;
                if (n.data.department_name === selectedDepartment) {
                    foundRoot = n;
                    break;
                }
                if (n.children) q.push(...n.children);
            }
            if (foundRoot) rootNode = foundRoot;
        }
        else if (scopeType === 'subsidiary' && selectedSubsidiary) {
            const q = [rootNode];
            let foundRoot = null;
            while (q.length) {
                const n = q.shift()!;
                if (n.data.subsidiary_name === selectedSubsidiary) {
                    foundRoot = n;
                    break;
                }
                if (n.children) q.push(...n.children);
            }
            if (foundRoot) rootNode = foundRoot;
        }

        const hierarchy = d3.hierarchy(rootNode);
        const treeLayout = d3.tree<OrgNode>().nodeSize([NODE_WIDTH + 40, LEVEL_GAP]);
        const root = treeLayout(hierarchy);
        // Calculate Bounds
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        root.each(d => {
            if (d.x < minX) minX = d.x;
            if (d.x > maxX) maxX = d.x;
            if (d.y < minY) minY = d.y;
            if (d.y > maxY) maxY = d.y;
        });
        // Add padding
        const padding = 100;
        return { root, bounds: { minX: minX - padding, maxX: maxX + padding, minY: minY - padding, maxY: maxY + padding } };
    }, [parseResult, selectedSubsidiary, selectedDepartment, scopeType]);

    // Helper to constrain transform
    const constrainTransform = (t: { x: number, y: number, k: number }, bounds: { minX: number, maxX: number, minY: number, maxY: number } | undefined, vw: number, vh: number) => {
        if (!bounds) return t;
        const { minX, maxX, minY, maxY } = bounds;

        // World bounds transformed to screen:
        // screenX = worldX * k + tx
        // constraint: screenMaxX >= 0 (Right edge inside left of screen) => maxX * k + tx >= 0 => tx >= -maxX * k
        // constraint: screenMinX <= vw (Left edge inside right of screen) => minX * k + tx <= vw => tx <= vw - minX * k

        // Add safety margin (allow panning slightly past to center empty space if needed, but not infinite)
        // Let's hold edges at center screen as limit. 
        // center screen x = vw/2.
        // minX * k + tx <= vw/2 + (maxX-minX)*k ... no, simplest is just screen edges.

        // Safety margin: effectively the minimum amount of content (in pixels) that must remain visible on screen.
        const MARGIN = 200;

        const minTx = -maxX * t.k + MARGIN; // Keep at least MARGIN of right edge visible
        const maxTx = vw - minX * t.k - MARGIN; // Keep at least MARGIN of left edge visible

        const minTy = -maxY * t.k + MARGIN;
        const maxTy = vh - minY * t.k - MARGIN;

        // If content is smaller than viewport, center it? logic below handles clamping, centering is separate auto-behavior.
        // But we must ensure minTx <= maxTx. If content is small, maxTx could be large and minTx small.
        // If content < viewport, we allow floating in middle.

        return {
            x: Math.max(minTx, Math.min(maxTx, t.x)),
            y: Math.max(minTy, Math.min(maxTy, t.y)),
            k: t.k
        };
    };

    // Handle Focus (Auto-Center) on Selection
    useEffect(() => {
        if (!selectedNodeId || !treeData) return;
        const node = treeData.root.descendants().find(d => d.data.id === selectedNodeId);
        if (node && containerRef.current) {
            const { offsetWidth, offsetHeight } = containerRef.current;
            // Smooth transition could go here, but instant is fine for MVP
            setTransform({
                x: -node.x + offsetWidth / 2, // Centered X (nodeSize tree is centered at 0, so -node.x centers it)
                y: -node.y + offsetHeight / 2 - 100, // Top-ish Y
                k: 1
            });
        }
    }, [selectedNodeId, treeData]);

    // Draw Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !treeData) return;

        const { offsetWidth, offsetHeight } = containerRef.current || { offsetWidth: 800, offsetHeight: 600 };
        // Handle HiDPI
        const dpr = window.devicePixelRatio || 1;
        canvas.width = offsetWidth * dpr;
        canvas.height = offsetHeight * dpr;
        canvas.style.width = `${offsetWidth}px`;
        canvas.style.height = `${offsetHeight}px`;

        ctx.scale(dpr, dpr);

        // Clear
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, offsetWidth, offsetHeight); // Use CSS dims for rect

        // --- Grid Background ---
        const GRID_SIZE = 40;
        const dotGap = GRID_SIZE * transform.k;
        // Don't draw if too small to see effectively (perf)
        if (dotGap > 8) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // Dark dots for light bg
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
        // Global Transform
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);

        // Draw Links
        ctx.strokeStyle = '#cbd5e1'; // Light gray links
        ctx.lineWidth = 2;
        ctx.beginPath();
        treeData.root.links().forEach(link => {
            // Bezier curve for smoother look
            // ctx.moveTo(link.source.x, link.source.y);
            // ctx.bezierCurveTo(
            //    link.source.x, (link.source.y + link.target.y)/2,
            //    link.target.x, (link.source.y + link.target.y)/2, 
            //    link.target.x, link.target.y
            // );
            // Straight Elbow
            ctx.moveTo(link.source.x, link.source.y + NODE_HEIGHT / 2);
            ctx.lineTo(link.source.x, link.source.y + LEVEL_GAP / 2);
            ctx.lineTo(link.target.x, link.source.y + LEVEL_GAP / 2);
            ctx.lineTo(link.target.x, link.target.y - NODE_HEIGHT / 2);
        });
        ctx.stroke();

        // Draw Nodes
        // Optimization: Only draw visible nodes?
        // Viewport bounds in world space:
        // left = -transform.x / k
        // right = (width - transform.x) / k
        // For 10k nodes, simply drawing all might be hitting limits if complex.
        // But 10k rects in Canvas is typically 60fps.

        treeData.root.descendants().forEach((d: any) => {
            const { x, y } = d;
            const w = NODE_WIDTH;
            const h = NODE_HEIGHT;
            const r = 6;

            const isSelected = selectedNodeId === d.data.id;

            // Shadow
            if (isSelected) {
                ctx.shadowColor = '#3b82f6';
                ctx.shadowBlur = 20;
            } else {
                ctx.shadowBlur = 0;
            }

            // Card Background
            ctx.fillStyle = '#ffffff'; // White cards
            ctx.beginPath();
            ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
            ctx.fill();
            ctx.shadowBlur = 0; // Reset

            // Border (Stroke rect to visually separate on white bg)
            ctx.lineWidth = 1;
            ctx.strokeStyle = isSelected ? '#3b82f6' : '#e2e8f0';
            ctx.stroke();

            // Border (extra emphasis if selected)
            if (isSelected) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#3b82f6';
                ctx.stroke();
            }

            // Department Stripe
            const deptColor = d.data.color || '#94a3b8';
            ctx.fillStyle = deptColor;
            ctx.beginPath();
            // Left stripe rounded corner logic
            ctx.roundRect(x - w / 2, y - h / 2, 4, h, [6, 0, 0, 6]); // Left radii only
            ctx.fill();

            // Text
            ctx.textAlign = 'left';
            ctx.fillStyle = '#0f172a'; // Dark text
            ctx.font = 'bold 13px Inter, sans-serif';
            let name = d.data.data.employee_name;
            if (name.length > 20) name = name.substring(0, 19) + '...';
            ctx.fillText(name, x - w / 2 + 14, y - h / 2 + 24);

            ctx.fillStyle = '#64748b'; // Muted text
            let title = d.data.data.job_title || 'Employee';
            if (title.length > 24) title = title.substring(0, 23) + '...';
            ctx.fillText(title, x - w / 2 + 14, y - h / 2 + 42);

            // SoC Badge
            if ((d.data.children?.length ?? 0) > 0) {
                const status = d.data.soc_status;
                let badgeColor = '#10b981';
                if (status === 'low') badgeColor = '#ef4444';
                if (status === 'high') badgeColor = '#f59e0b';

                // Pill shape
                const bx = x - w / 2 + 14;
                const by = y + h / 2 - 20;

                ctx.fillStyle = '#334155'; // Badge bg
                ctx.beginPath();
                ctx.roundRect(bx, by, 60, 14, 4);
                ctx.fill();

                // Status dot
                ctx.fillStyle = badgeColor;
                ctx.beginPath();
                ctx.arc(bx + 8, by + 7, 3, 0, Math.PI * 2);
                ctx.fill();

                // Text
                ctx.fillStyle = '#cbd5e1';
                ctx.font = '9px monospace';
                ctx.fillText(`${d.data.soc_headcount} / ${d.data.soc_fte}`, bx + 16, by + 10);
            }
        });

        ctx.restore();
    }, [transform, treeData, parseResult, selectedNodeId]);


    // --- Interaction Handlers ---

    // Zoom Controls
    const updateTransform = (updater: (t: typeof transform) => typeof transform) => {
        setTransform(prev => {
            const next = updater(prev);
            return constrainTransform(next, treeData?.bounds, containerRef.current?.offsetWidth || 800, containerRef.current?.offsetHeight || 600);
        });
    };

    const zoomIn = () => updateTransform(t => ({ ...t, k: Math.min(t.k * 1.2, 5) }));
    const zoomOut = () => updateTransform(t => ({ ...t, k: Math.max(t.k / 1.2, 0.2) })); // Limit min zoom
    // resetView uses direct setTransform

    const resetView = () => {
        if (containerRef.current) {
            setTransform({ x: containerRef.current.offsetWidth / 2, y: 100, k: 1 });
        }
    };





    const handleMouseDown = (e: React.MouseEvent) => {
        // Check for node hit first (click) vs drag
        const canvas = canvasRef.current;
        if (!canvas || !treeData) return;

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // World Space
        const wx = (mx - transform.x) / transform.k;
        const wy = (my - transform.y) / transform.k;

        // Hit Test
        let hit = false;
        const nodes = treeData.root.descendants();
        for (let i = nodes.length - 1; i >= 0; i--) {
            const d = nodes[i];
            const w = NODE_WIDTH;
            const h = NODE_HEIGHT;
            // Check rect
            if (wx >= d.x - w / 2 && wx <= d.x + w / 2 &&
                wy >= d.y - h / 2 && wy <= d.y + h / 2) {
                hit = true;
                setSelectedNodeId(d.data.id);
                break;
            }
        }

        if (!hit) {
            // Start Drag
            setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragStart && containerRef.current && treeData) {
            const nextT = {
                ...transform,
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            };
            setTransform(constrainTransform(nextT, treeData.bounds, containerRef.current.offsetWidth, containerRef.current.offsetHeight));
        }
    };

    const handleMouseUp = () => setDragStart(null);

    // Initial Center
    useEffect(() => {
        if (containerRef.current && parseResult?.root && transform.x === 0) {
            setTransform({ x: containerRef.current.offsetWidth / 2, y: 100, k: 0.8 });
        }
    }, [parseResult]);

    return (
        <div ref={containerRef} className="w-full h-full cursor-move relative bg-[var(--bg-primary)] overflow-hidden">
            <canvas
                ref={canvasRef}
                className="block outline-none"
                // onWheel={handleWheel} // Disabled per user request
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />

            {/* Viewport Controls */}
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

            {/* Legend Overlay (Top Left) */}
            <div className="absolute top-4 left-4 pointer-events-none opacity-50 text-[10px] text-[var(--text-muted)]">
                {selectedDepartment && <span>Filtering by Dept: {selectedDepartment}</span>}
            </div>
        </div>
    );
};
