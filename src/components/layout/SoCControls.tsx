import React, { useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { RotateCcw, Check } from 'lucide-react';

interface SoCControlsProps {
    currentLow: number;
    currentHigh: number;
    onApply: (low: number, high: number) => void;
}

export const SoCControls: React.FC<SoCControlsProps> = ({ currentLow, currentHigh, onApply }) => {
    const [low, setLow] = useState(currentLow);
    const [high, setHigh] = useState(currentHigh);

    // Sync local state if external state changes (e.g. initial load)
    // Actually, if we want manual control, we might NOT want this, but for "Revert" to work via parent prop update if needed...
    // Let's rely on internal state mostly, but sync on mount.
    // Revert logic: Set to 3, 8.

    const handleApply = () => {
        onApply(low, high);
    };

    const handleRevert = () => {
        setLow(3);
        setHigh(8);
        onApply(3, 8);
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <div className="space-y-1 flex-1">
                    <div className="text-[10px] text-muted-foreground">Min (Red &lt;)</div>
                    <Input
                        type="number"
                        min={1}
                        max={50}
                        value={low}
                        onChange={(e) => setLow(parseInt(e.target.value) || 0)}
                        className="h-8 text-xs bg-background"
                    />
                </div>
                <div className="space-y-1 flex-1">
                    <div className="text-[10px] text-muted-foreground">Max (Red &gt;)</div>
                    <Input
                        type="number"
                        min={1}
                        max={100}
                        value={high}
                        onChange={(e) => setHigh(parseInt(e.target.value) || 0)}
                        className="h-8 text-xs bg-background"
                    />
                </div>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={handleRevert}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Reset
                </Button>
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleApply}>
                    <Check className="w-3 h-3 mr-1" /> Apply
                </Button>
            </div>
        </div>
    );
};
