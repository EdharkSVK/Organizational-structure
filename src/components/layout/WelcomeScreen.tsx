import React from 'react';
import { BarChart3, Users, Download } from 'lucide-react';
import { FileUpload } from '../ui/FileUpload';
import { Button } from '../ui/button';
import * as XLSX from 'xlsx';

export const WelcomeScreen: React.FC = () => {

    const handleDownloadTemplate = () => {
        const headers = ['employee_id', 'employee_name', 'reports_to_id', 'department_name', 'job_title', 'location', 'employment_type', 'fte'];
        const exampleRow = ['1', 'John Doe', '', 'Executive', 'CEO', 'New York', 'Full-time', '1.0'];

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, "Template");

        // Generate Excel file and trigger download
        XLSX.writeFile(wb, "org_chart_template.xlsx");
    };

    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-[var(--bg-primary)] text-center relative overflow-hidden">
            {/* Background Accents (CSS based or simple divs) */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[100px] rounded-full" />
            </div>

            <div className="z-10 max-w-2xl flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 shadow-2xl border border-white/5">
                    <BarChart3 size={48} className="text-[var(--accent-primary)] drop-shadow-glow" />
                </div>

                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400">
                    Visualize Your Organization
                </h1>

                <p className="text-lg text-[var(--text-secondary)] mb-10 max-w-lg leading-relaxed">
                    Transform complex HR data into interactive visuals.
                    Explore hierarchies, analyze span of control, and optimize your structure instantly.
                </p>

                <div className="w-full max-w-md bg-[var(--bg-secondary)]/50 p-6 rounded-xl border border-[var(--border-color)] backdrop-blur-sm shadow-xl flex flex-col gap-4">
                    <FileUpload />

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-[var(--border-color)]"></div>
                        <span className="flex-shrink-0 mx-4 text-xs text-[var(--text-muted)] uppercase tracking-wider">or</span>
                        <div className="flex-grow border-t border-[var(--border-color)]"></div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadTemplate}
                        className="w-full border-dashed border-[var(--border-color)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-all"
                    >
                        <Download size={16} className="mr-2" />
                        Download Excel Template
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-8 mt-12 text-left opacity-80">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 p-1 bg-[var(--bg-tertiary)] rounded">
                            <Users size={16} className="text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-[var(--text-primary)]">High Performance</h3>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">Render 10k+ nodes with smooth canvas visualizations.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="mt-1 p-1 bg-[var(--bg-tertiary)] rounded">
                            <BarChart3 size={16} className="text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-[var(--text-primary)]">Instant Analytics</h3>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">Automatic Span of Control and depth calculation.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
