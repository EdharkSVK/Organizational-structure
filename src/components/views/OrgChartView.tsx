import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3-hierarchy';
import { useStore } from '../../data/store';
import type { OrgNode } from '../../data/schema';
import { ViewportShell } from '../layout/ViewportShell';
import { useViewportCamera } from '../../hooks/useViewportCamera';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const LEVEL_GAP = 120;

export const OrgChartView: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const {
        parseResult, selectedLocation, selectedDepartment,
        selectedNodeId, setSelectedNodeId
    } = useStore();

    // Shared Camera Hook
    const { containerRef, transform, zoomIn, zoomOut, reset, fitToBounds, isReady } = useViewportCamera({
        minZoom: 0.1,
        maxZoom: 2,
        initialTransform: { x: 0, y: 0, k: 1 }
    });

    const [hoveredNode, setHoveredNode] = useState<{ x: number, y: number, data: OrgNode } | null>(null);

    // 1. Process Data & Layout
    const treeData = useMemo(() => {
        if (!parseResult?.root) return null;

        // Determine Effective Root
        let effectiveRootData = parseResult.root;

        if (selectedDepartment) {
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

        const hierarchy = d3.hierarchy(effectiveRootData);
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
        const padding = 100;
        return { root, bounds: { minX: minX - padding, maxX: maxX + padding, minY: minY - padding, maxY: maxY + padding } };
    }, [parseResult, selectedDepartment]);

    // Initial Fit
    useEffect(() => {
        if (isReady && treeData && containerRef.current) {
            const { minX, maxX, minY, maxY } = treeData.bounds;
            const width = maxX - minX;
            const height = maxY - minY;

            if (!Number.isFinite(width) || !Number.isFinite(height)) {
                return;
            }

            // Fit the tree
            // If checking a department, maybe zoom closer? 
            // Standard fit is fine.
            fitToBounds({ x: minX, y: minY, width, height }, 50);
        }
    }, [isReady, treeData, fitToBounds]);


    // Draw Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !treeData) return;

        // Color Helper
        const getStyle = (varName: string) => {
            return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        };

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

        // Dot Grid
        const GRID_SIZE = 40;
        const dotGap = GRID_SIZE * transform.k;
        if (dotGap > 8) {
            ctx.fillStyle = colors.mutedFg;
            ctx.globalAlpha = 0.1;
            const startX = transform.x % dotGap;
            const startY = transform.y % dotGap;
            for (let x = startX; x < offsetWidth; x += dotGap) {
                for (let y = startY; y < offsetHeight; y += dotGap) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1.0;
        }

        ctx.save();
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);

        // Draw Links
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1.5;
        if (transform.k < 0.5) ctx.lineWidth = 2.5; // Thicker when zoomed out
        ctx.beginPath();
        treeData.root.links().forEach(link => {
            const sx = link.source.x;
            const sy = link.source.y;
            const tx = link.target.x;
            const ty = link.target.y;

            // Smooth simple curve or elbow
            ctx.moveTo(sx, sy + NODE_HEIGHT / 2);
            ctx.lineTo(sx, sy + LEVEL_GAP / 2);
            ctx.lineTo(tx, sy + LEVEL_GAP / 2);
            ctx.lineTo(tx, ty - NODE_HEIGHT / 2);
        });
        ctx.stroke();

        // Robust Manual Round Rect Helper
        const roundedRect = (x: number, y: number, w: number, h: number, r: number | number[]) => {
            let tl = 0, tr = 0, br = 0, bl = 0;
            if (typeof r === 'number') {
                tl = tr = br = bl = r;
            } else if (Array.isArray(r) && r.length === 4) {
                [tl, tr, br, bl] = r;
            }

            ctx.beginPath();
            ctx.moveTo(x + tl, y);
            ctx.lineTo(x + w - tr, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
            ctx.lineTo(x + w, y + h - br);
            ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
            ctx.lineTo(x + bl, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
            ctx.lineTo(x, y + tl);
            ctx.quadraticCurveTo(x, y, x + tl, y);
            ctx.closePath();
        };

        // Draw Nodes (Cards)
        treeData.root.descendants().forEach(d => {
            // Optimization: Skip rendering if off-screen (Viewport Culling)
            const screenX = d.x * transform.k + transform.x;
            const screenY = d.y * transform.k + transform.y;
            // conservative padding
            if (screenX < -200 || screenX > offsetWidth + 200 || screenY < -200 || screenY > offsetHeight + 200) return;

            const { x, y } = d;
            const w = NODE_WIDTH;
            const h = NODE_HEIGHT;
            const r = 8; // rounded-md

            const isSelected = selectedNodeId === d.data.id;
            const isHovered = hoveredNode?.data.id === d.data.id;
            const matchesFilter = !selectedLocation || d.data.data.location === selectedLocation;

            // Visibility (Dimming)
            ctx.globalAlpha = matchesFilter ? 1.0 : 0.1;

            // Shadow
            if (isSelected) {
                ctx.shadowColor = colors.primary;
                ctx.shadowBlur = 20;
            } else if (isHovered) {
                ctx.shadowColor = 'rgba(0,0,0,0.1)';
                ctx.shadowBlur = 10;
            } else {
                ctx.shadowColor = 'rgba(0,0,0,0.05)';
                ctx.shadowBlur = 4;
            }
            if (transform.k < 0.4) ctx.shadowBlur = 0; // Performance for zoom out

            // Card Background
            ctx.fillStyle = colors.card;
            roundedRect(x - w / 2, y - h / 2, w, h, r);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Border
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeStyle = isSelected ? colors.primary : colors.border;
            if (isHovered && !isSelected) ctx.strokeStyle = colors.mutedFg;
            ctx.stroke();

            // Dept Stripe
            const deptColor = d.data.color || colors.muted;
            ctx.fillStyle = deptColor;
            roundedRect(x - w / 2 + 1, y - h / 2 + 1, 4, h - 2, [6, 0, 0, 6]);
            ctx.fill();

            // Text
            // Detail Level Management
            if (transform.k > 0.3) {
                ctx.textAlign = 'left';
                ctx.fillStyle = colors.cardFg;
                ctx.font = '600 13px Inter, sans-serif';
                let name = d.data.data.employee_name;
                if (name.length > 20) name = name.substring(0, 19) + '...';
                ctx.fillText(name, x - w / 2 + 16, y - h / 2 + 28);

                ctx.fillStyle = colors.mutedFg;
                ctx.font = '400 11px Inter, sans-serif';
                let title = d.data.data.job_title || 'Employee';
                if (title.length > 24) title = title.substring(0, 23) + '...';
                ctx.fillText(title, x - w / 2 + 16, y - h / 2 + 46);
            }

            // SoC Badge
            if ((d.children?.length ?? 0) > 0 && transform.k > 0.4) {
                const status = d.data.soc_status;
                let badgeColor = colors.primary;
                if (status === 'low') badgeColor = '#ef4444'; // Red
                if (status === 'high') badgeColor = '#f59e0b'; // Amber
                if (status === 'ok') badgeColor = '#10b981'; // Green

                const bx = x - w / 2 + 16;
                const by = y + h / 2 - 20;

                ctx.fillStyle = colors.muted; // Light bg for badge
                roundedRect(bx, by, 70, 16, 4);
                ctx.fill();

                ctx.fillStyle = badgeColor;
                ctx.beginPath();
                ctx.arc(bx + 8, by + 8, 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = colors.mutedFg;
                ctx.font = '500 9px monospace';
                ctx.fillText(`${d.data.soc_headcount} / ${d.data.soc_fte}`, bx + 16, by + 11);
            }
        });

        ctx.restore();
    }, [transform, treeData, selectedNodeId, hoveredNode]);

    // Input Handling
    const handleMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas || !treeData) return;

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Invert Transform
        const wx = (mx - transform.x) / transform.k;
        const wy = (my - transform.y) / transform.k;

        // Hit Test
        let hit = null;
        for (const d of treeData.root.descendants()) {
            const w = NODE_WIDTH;
            const h = NODE_HEIGHT;
            if (wx >= d.x - w / 2 && wx <= d.x + w / 2 &&
                wy >= d.y - h / 2 && wy <= d.y + h / 2) {
                hit = d;
                break; // First hit is fine (z-order top?)
            }
        }

        if (hit) {
            setHoveredNode({ x: e.clientX, y: e.clientY, data: hit.data });
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
                if (treeData) {
                    const { minX, maxX, minY, maxY } = treeData.bounds;
                    fitToBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, 50);
                }
            }}
            uiOverlay={
                <div className="absolute top-4 left-4 pointer-events-none opacity-50 text-[10px] text-[var(--text-muted)]">
                    {selectedDepartment && <span>Filtering by Dept: {selectedDepartment}</span>}
                </div>
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
