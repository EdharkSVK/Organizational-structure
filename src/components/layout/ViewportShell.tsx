import React, { type ReactNode } from 'react';
import { Plus, Minus, Maximize, RefreshCcw } from 'lucide-react';

interface ViewportShellProps {
    children: ReactNode; // The Scene Content (Canvas/SVG)
    uiOverlay?: ReactNode; // Additional UI controls (Search, etc) specific to the view
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onReset?: () => void;
    onFit?: () => void;
    containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const ViewportShell: React.FC<ViewportShellProps> = ({
    children,
    uiOverlay,
    onZoomIn,
    onZoomOut,
    onReset,
    onFit,
    containerRef
}) => {
    return (
        <div
            ref={containerRef}
            className="w-full h-full relative overflow-hidden bg-[var(--bg-primary)] cursor-move select-none"
        >
            {/* 1. Scene Layer - The actual content */}
            <div className="absolute inset-0 w-full h-full">
                {children}
            </div>

            {/* 2. UI Overlay Layer - Passive container for fixed controls */}
            <div className="absolute inset-0 w-full h-full pointer-events-none z-10">

                {/* View-Specific UI passed from parent */}
                {uiOverlay && (
                    <div className="pointer-events-none absolute inset-0">
                        {uiOverlay}
                    </div>
                )}

                {/* Standard Viewport Controls (Bottom Right) */}
                <div className="absolute bottom-6 right-6 flex flex-col gap-2 bg-white/95 backdrop-blur-sm p-2 rounded-lg border border-slate-200 shadow-xl pointer-events-auto">
                    {onZoomIn && (
                        <button onClick={onZoomIn} className="p-2 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors" title="Zoom In">
                            <Plus size={20} />
                        </button>
                    )}
                    {onZoomOut && (
                        <button onClick={onZoomOut} className="p-2 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors" title="Zoom Out">
                            <Minus size={20} />
                        </button>
                    )}
                    {(onZoomIn || onZoomOut) && (onReset || onFit) && (
                        <div className="h-px bg-slate-200 my-1" />
                    )}
                    {onFit && (
                        <button onClick={onFit} className="p-2 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors" title="Fit to Screen">
                            <Maximize size={20} />
                        </button>
                    )}
                    {onReset && (
                        <button onClick={onReset} className="p-2 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors" title="Reset 100%">
                            <RefreshCcw size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
