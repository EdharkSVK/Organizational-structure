import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3-zoom';
import { select } from 'd3-selection';
import 'd3-transition';

export interface ViewportTransform {
    x: number;
    y: number;
    k: number;
}

interface UseViewportCameraProps {
    minZoom?: number;
    maxZoom?: number;
    initialTransform?: ViewportTransform;
}

export const useViewportCamera = ({
    minZoom = 0.1,
    maxZoom = 8,
    initialTransform = { x: 0, y: 0, k: 1 }
}: UseViewportCameraProps = {}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState<ViewportTransform>(initialTransform);
    const zoomBehavior = useRef<d3.ZoomBehavior<Element, unknown> | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Initialize Zoom
    useEffect(() => {
        if (!containerRef.current) return;

        const selection = select(containerRef.current as any);

        zoomBehavior.current = d3.zoom()
            .scaleExtent([minZoom, maxZoom])
            .on('zoom', (event) => {
                setTransform({
                    x: event.transform.x,
                    y: event.transform.y,
                    k: event.transform.k
                });
            });

        if (initialTransform.x !== 0 || initialTransform.y !== 0 || initialTransform.k !== 1) {
            selection.call(zoomBehavior.current.transform,
                d3.zoomIdentity.translate(initialTransform.x, initialTransform.y).scale(initialTransform.k)
            );
        }

        selection.call(zoomBehavior.current);
        setIsReady(true);

        return () => {
            selection.on('.zoom', null);
            setIsReady(false);
        };
    }, [minZoom, maxZoom]);

    // Helpers
    const reset = useCallback(() => {
        if (!containerRef.current || !zoomBehavior.current) return;
        const selection = select(containerRef.current as any);
        selection.transition().duration(750)
            .call(zoomBehavior.current.transform, d3.zoomIdentity);
    }, []);

    const zoomIn = useCallback(() => {
        if (!containerRef.current || !zoomBehavior.current) return;
        const selection = select(containerRef.current as any);
        selection.transition().duration(300).call(zoomBehavior.current.scaleBy, 1.2);
    }, []);

    const zoomOut = useCallback(() => {
        if (!containerRef.current || !zoomBehavior.current) return;
        const selection = select(containerRef.current as any);
        selection.transition().duration(300).call(zoomBehavior.current.scaleBy, 0.8);
    }, []);

    const setCamera = useCallback((t: ViewportTransform) => {
        if (!containerRef.current || !zoomBehavior.current) return;
        const selection = select(containerRef.current as any);
        selection.call(zoomBehavior.current.transform,
            d3.zoomIdentity.translate(t.x, t.y).scale(t.k)
        );
    }, []);

    const fitToBounds = useCallback((bounds: { x: number, y: number, width: number, height: number }, padding = 20) => {
        if (!containerRef.current || !zoomBehavior.current) return;
        const { offsetWidth, offsetHeight } = containerRef.current;
        const fullWidth = offsetWidth;
        const fullHeight = offsetHeight;

        const scale = Math.min(
            (fullWidth - padding * 2) / bounds.width,
            (fullHeight - padding * 2) / bounds.height
        );
        // Clamp scale
        const clampedScale = Math.max(minZoom, Math.min(maxZoom, scale));

        const x = (fullWidth - bounds.width * clampedScale) / 2 - bounds.x * clampedScale;
        const y = (fullHeight - bounds.height * clampedScale) / 2 - bounds.y * clampedScale;

        const selection = select(containerRef.current as any);
        selection.transition().duration(750).call(
            zoomBehavior.current.transform,
            d3.zoomIdentity.translate(x, y).scale(clampedScale)
        );
    }, [minZoom, maxZoom]);

    return {
        containerRef,
        transform,
        reset,
        zoomIn,
        zoomOut,
        setCamera,
        fitToBounds,
        isReady
    };
};
