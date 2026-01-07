import React, { useRef, useState } from 'react';
import { useStore } from '../../data/store';
import { parseData } from '../../data/parser';
import { FileDown, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface FileUploadProps {
    variant?: 'dropzone' | 'button' | 'mini';
}

export const FileUpload: React.FC<FileUploadProps> = ({ variant = 'dropzone' }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { setFile, setParseResult, setError, setLoading, isLoading, error, fileName } = useStore(); // Assuming fileName stored? Or derive from file
    const [isDragOver, setIsDragOver] = useState(false);

    // ... processFile logic ...
    const processFile = async (file: File) => {
        setFile(file);
        setLoading(true);
        try {
            const result = await parseData(file);
            if (result.errors.length > 0) {
                setError(result.errors.join('\n'));
            } else {
                setParseResult(result);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to parse file');
        }
    };

    // ... handlers ...
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    if (variant === 'mini') {
        return (
            <div>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[var(--border-color)] rounded text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
                >
                    {isLoading ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
                    <span className="truncate max-w-[150px]">{fileName || "Choose file"}</span>
                </button>
                {error && <div className="absolute top-12 right-4 bg-red-900 text-red-100 text-xs p-2 rounded z-50">{error}</div>}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div
                className={clsx(
                    "relative group border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer overflow-hidden",
                    isDragOver
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                        : "border-[var(--border-color)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]",
                    isLoading && "opacity-50 pointer-events-none"
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
            >
                {/* Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                />

                <div className="flex flex-col items-center gap-3 text-center">
                    <div className={clsx(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110",
                        isDragOver ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-tertiary)] text-[var(--accent-primary)]"
                    )}>
                        {isLoading ? <Loader2 className="animate-spin" size={24} /> : <FileSpreadsheet size={24} />}
                    </div>

                    <div className="space-y-1">
                        <p className="font-semibold text-sm text-[var(--text-primary)]">
                            {isLoading ? "Processing..." : "Select Data File"}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">Drag & Drop CSV / Excel</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                    <div className="flex-1 space-y-2">
                        <div className="whitespace-pre-wrap font-medium">{error}</div>
                        {error.includes('Missing') && (
                            <a
                                href="/sample_data.csv"
                                download
                                className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <FileDown size={12} /> Download Template
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
