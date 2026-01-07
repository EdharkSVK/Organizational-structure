
// Premium palette (Tailored HSL colors)
const PALETTE = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#84cc16', // Lime
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#d946ef', // Fuchsia
];

export function getDepartmentColor(deptName: string): string {
    if (!deptName) return '#94a3b8'; // Slate 400 for generic

    let hash = 0;
    for (let i = 0; i < deptName.length; i++) {
        hash = deptName.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % PALETTE.length;
    return PALETTE[index];
}

export function getSoCStatus(headcount: number, low: number, high: number): 'low' | 'ok' | 'high' {
    if (headcount < low) return 'low';
    if (headcount > high) return 'high';
    return 'ok';
}
