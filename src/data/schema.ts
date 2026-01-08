
export interface RawRow {
  employee_id: string;
  employee_name: string;
  reports_to_id: string | null; // Empty string or null in CSV
  department_name: string;
  subsidiary_name?: string;
  job_title?: string;
  location?: string;
  employment_type?: string;
  fte?: number;
  matrix_primary_manager_id?: string; // Optional for matrix handling
}

export type SoCStatus = 'low' | 'ok' | 'high';

export interface OrgNode {
  id: string;
  data: RawRow;
  children: OrgNode[];
  parentId: string | null;

  // Computed Metrics
  depth: number;
  total_descendants: number; // Recursive count
  total_reports_cnt: number; // Direct reports only for SoC? Or recursive? SoC is direct.
  soc_headcount: number; // Direct reports count
  soc_fte: number; // Direct reports FTE sum
  soc_status: SoCStatus;

  // Layout/Rendering helpers (populated later or during layout)
  x?: number;
  y?: number;
  r?: number; // for circle view
  color?: string;
}

export interface DatasetStats {
  totalRows: number;
  validRows: number;
  orphanCount: number;
  cycleCount: number;
  roots: string[];
}

export interface ParseResult {
  root: OrgNode | null;
  secondaryRoots: OrgNode[]; // New field for excluded trees
  flatNodes: Map<string, OrgNode>;
  stats: DatasetStats;
  errors: string[];
}
