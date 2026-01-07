import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { OrgNode, ParseResult, DatasetStats } from './schema';
import { getDepartmentColor, getSoCStatus } from '../lib/colors';

// Standardized column names
const REQUIRED_COLS = ['employee_id', 'employee_name', 'department_name'];
// reports_to_id can be empty for root, so check existence of column, not value.

export async function parseData(file: File): Promise<ParseResult> {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    let data: any[] = [];

    if (isExcel) {
        data = await parseExcel(file);
    } else {
        data = await parseCSV(file);
    }

    return processData(data);
}

function parseCSV(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (err) => reject(err),
        });
    });
}

async function parseExcel(file: File): Promise<any[]> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
}

function processData(rawData: any[]): ParseResult {
    const errors: string[] = [];
    const flatNodes = new Map<string, OrgNode>();

    if (rawData.length === 0) {
        return { root: null, flatNodes, stats: emptyStats(), errors: ['File is empty'] };
    }

    // 1. Column Validation
    const firstRow = rawData[0];
    const keys = Object.keys(firstRow);
    const missing = REQUIRED_COLS.filter(col => !keys.includes(col));
    if (missing.length > 0 && !keys.includes('reports_to_id') && !keys.includes('Reports To')) {
        // reports_to_id is critical but might be named differently in user data? 
        // MVP: strict schema.
        errors.push(`Missing required columns: ${missing.join(', ')}`);
        // We also strictly need reports_to_id
        if (!keys.includes('reports_to_id')) errors.push("Missing 'reports_to_id' column");
    }

    if (errors.length > 0) {
        return { root: null, flatNodes, stats: emptyStats(), errors };
    }

    // 2. Pre-process rows (Dedupe / Matrix)
    // MVP: First row wins for ID.
    const rowMap = new Map<string, any>();

    rawData.forEach((row, _) => {
        const id = row.employee_id?.toString().trim();
        if (!id) return; // Skip empty IDs

        if (!rowMap.has(id)) {
            rowMap.set(id, row);
        } else {
            // Duplicate ID logic (Matrix or just Data Error)
            // MVP Rule: Use matrix_primary_manager_id if present, else first one.
            // Since we are iterating, we already have the first one.
            // Implementation: If we want to support matrix lines, we would store edges separately.
            // For now, strict tree construction uses the entry in rowMap.
        }
    });

    // 3. Create Nodes
    rowMap.forEach((row, id) => {
        const node: OrgNode = {
            id,
            data: {
                employee_id: id,
                employee_name: row.employee_name,
                reports_to_id: row.reports_to_id?.toString().trim() || null,
                department_name: row.department_name,
                subsidiary_name: row.subsidiary_name,
                job_title: row.job_title,
                location: row.location,
                employment_type: row.employment_type,
                fte: parseFloat(row.fte || '1'),
                matrix_primary_manager_id: row.matrix_primary_manager_id,
            },
            children: [],
            parentId: row.reports_to_id?.toString().trim() || null,
            depth: 0,
            total_reports_cnt: 0,
            soc_headcount: 0,
            soc_fte: 0,
            soc_status: 'ok',
            color: getDepartmentColor(row.department_name),
        };
        flatNodes.set(id, node);
    });

    // 4. Build Tree
    let roots: OrgNode[] = [];
    const orphanIds = new Set<string>();

    flatNodes.forEach(node => {
        if (!node.parentId || node.parentId === '') {
            roots.push(node);
            return;
        }

        const parent = flatNodes.get(node.parentId);
        if (parent) {
            parent.children.push(node);
        } else {
            orphanIds.add(node.id);
            // Treat as root or error? MVP: Treat as root but flag it? 
            // Requirement: "Detect missing employees...". 
            // If reports to unknown ID, it's an orphan.
            // We will treat them as roots for visualization but mark stats.
            roots.push(node);
        }
    });

    // 5. Handle Multiple Roots
    let root: OrgNode | null = null;
    if (roots.length === 1) {
        root = roots[0];
    } else if (roots.length > 1) {
        // Synthetic Root
        root = {
            id: 'ROOT',
            data: {
                employee_id: 'ROOT',
                employee_name: 'Organization Root',
                reports_to_id: null,
                department_name: 'Root',
                fte: 0,
            },
            children: roots,
            parentId: null,
            depth: 0,
            total_reports_cnt: 0,
            soc_headcount: 0,
            soc_fte: 0,
            soc_status: 'ok',
            color: '#000000',
        };
        flatNodes.set('ROOT', root);
    }

    // 6. Metrics & Depth (DFS)
    // Also Cycle Detection
    const visited = new Set<string>();
    let cycleDetected = false;

    function traverse(node: OrgNode, d: number) {
        if (visited.has(node.id)) {
            cycleDetected = true;
            errors.push(`Cycle detected involving user ${node.data.employee_name}`);
            return;
        }
        visited.add(node.id);
        node.depth = d;

        // SoC: Direct reports only
        node.soc_headcount = node.children.length;
        node.soc_fte = node.children.reduce((sum, child) => sum + (child.data.fte || 0), 0);
        // Default SoC Status (Global defaults 3-8, can be overridden in store, but here we set initial)
        node.soc_status = getSoCStatus(node.soc_headcount, 3, 8); // hardcoded defaults for parse time

        node.children.forEach(child => traverse(child, d + 1));

        visited.delete(node.id); // Backtrack for other paths if graph (but it's tree)
    }

    if (root) {
        traverse(root, 0);
    }

    const stats: DatasetStats = {
        totalRows: rawData.length,
        validRows: flatNodes.size,
        orphanCount: orphanIds.size,
        cycleCount: cycleDetected ? 1 : 0,
        roots: roots.map(r => r.id),
    };

    return { root, flatNodes, stats, errors };
}

function emptyStats(): DatasetStats {
    return { totalRows: 0, validRows: 0, orphanCount: 0, cycleCount: 0, roots: [] };
}
