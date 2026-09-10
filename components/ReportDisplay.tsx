
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { CopyIcon, CheckIcon, SaveIcon, ChevronDownIcon, SearchIcon } from './Icons';
import { ReportOutput } from '../services/logProcessor';
import { ReportData } from '../types';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import * as XLSX from 'xlsx';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightMatch = (text: string, term: string): React.ReactNode => {
    if (!term.trim()) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(term)})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase()
            ? <mark key={i} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">{part}</mark>
            : part
    );
};

interface ReportDisplayProps {
    reportOutput: ReportOutput;
}

const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


const Collapsible: React.FC<{ title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean, level?: number, count?: number, openOverride?: boolean }> = ({ title, children, defaultOpen = false, level = 0, count, openOverride }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    useEffect(() => {
        if (openOverride !== undefined) setIsOpen(openOverride);
    }, [openOverride]);

    const paddingLeft = {
        paddingLeft: `${level * 1.25 + 1}rem`
    };

    return (
        <div className="border-b border-slate-200 last:border-b-0">
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center text-left py-3 hover:bg-slate-100 focus:outline-none focus:bg-slate-100 transition-colors"
                style={paddingLeft}
                aria-expanded={isOpen}
            >
                <ChevronDownIcon className={`w-5 h-5 mr-3 transform transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
                <span className="flex-1 font-medium text-slate-700">{title}</span>
                {count !== undefined && <span className="text-xs font-mono bg-slate-200 text-slate-600 rounded-full px-2 py-0.5 mr-4">{count}</span>}
            </button>
            {isOpen && (
                <div className="pb-2 bg-white">
                    {children}
                </div>
            )}
        </div>
    );
};


export const ReportDisplay: React.FC<ReportDisplayProps> = ({ reportOutput }) => {
    const { reportString, reportData, warnings, fileHeaders } = reportOutput;
    const [copied, setCopied] = useState(false);
    const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    let totalErrors = 0;
    const filesWithErrorsSet = new Set<string>();
    for (const errorMessage in reportData) {
        for (const filename in reportData[errorMessage]) {
            totalErrors += reportData[errorMessage][filename].length;
            if (filename !== 'General Error') {
                filesWithErrorsSet.add(filename);
            }
        }
    }
    const totalFilesWithErrors = filesWithErrorsSet.size;
    const saveMenuRef = useRef<HTMLDivElement>(null);

    const filteredReportData = useMemo<ReportData>(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return reportData;

        const result: ReportData = {};
        for (const [errorMessage, files] of Object.entries(reportData)) {
            const errorMatches = errorMessage.toLowerCase().includes(term);
            const matchedFiles: ReportData[string] = {};
            for (const [filename, errors] of Object.entries(files)) {
                if (filename === 'General Error') {
                    if (errorMatches) matchedFiles[filename] = errors;
                    continue;
                }
                const filenameMatches = filename.toLowerCase().includes(term);
                const matchedErrors = errorMatches || filenameMatches
                    ? errors
                    : errors.filter(({ lineNumber, rowData }) =>
                        String(lineNumber).includes(term) || rowData.toLowerCase().includes(term)
                    );
                if (matchedErrors.length > 0) matchedFiles[filename] = matchedErrors;
            }
            if (Object.keys(matchedFiles).length > 0) result[errorMessage] = matchedFiles;
        }
        return result;
    }, [reportData, searchTerm]);

    const filteredMatchCount = useMemo(() => {
        let count = 0;
        for (const errorMessage in filteredReportData) {
            for (const filename in filteredReportData[errorMessage]) {
                count += filteredReportData[errorMessage][filename].length;
            }
        }
        return count;
    }, [filteredReportData]);

    const isSearching = searchTerm.trim().length > 0;

    const getTimestamp = () => {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    };

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(reportString).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [reportString]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (saveMenuRef.current && !saveMenuRef.current.contains(event.target as Node)) {
                setIsSaveMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const createSaveHandler = (format: 'txt' | 'pdf' | 'csv' | 'docx' | 'xlsx') => async () => {
        setIsSaveMenuOpen(false);
        const filename = `error-report-${getTimestamp()}.${format}`;

        if (format === 'txt') {
            const blob = new Blob([reportString], { type: 'text/plain' });
            downloadBlob(blob, filename);
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.setFont('courier', 'normal');
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(reportString, 180);
            doc.text(lines, 10, 10);
            doc.save(filename);
        } else if (format === 'csv' || format === 'xlsx') {
            const workbook = XLSX.utils.book_new();
            const summaryData: any[][] = [];
            
            if (warnings.length > 0) {
                summaryData.push(['--- WARNINGS ---']);
                warnings.forEach(w => summaryData.push(['Warning', w]));
                summaryData.push([]);
            }
            
            const generalErrors: any[][] = [];
            for (const errorMessage in reportData) {
                if (reportData[errorMessage]['General Error']) {
                    generalErrors.push(['Error', errorMessage]);
                }
            }
            if (generalErrors.length > 0) {
                summaryData.push(['--- GENERAL ERRORS ---']);
                generalErrors.forEach(e => summaryData.push(e));
                summaryData.push([]);
            }

            const fileDataMap: Record<string, any[][]> = {};
            let hasFileErrors = false;
            
            for (const errorMessage in reportData) {
                for (const filename in reportData[errorMessage]) {
                    if (filename === 'General Error') continue;
                    
                    if (!fileDataMap[filename]) {
                        const headers = fileHeaders?.[filename] || ['Row Data'];
                        fileDataMap[filename] = [['Error Message', 'Filename', 'Line Number', ...headers]];
                    }
                    
                    const reconciledErrors = reportData[errorMessage][filename];
                    for (const error of reconciledErrors) {
                        hasFileErrors = true;
                        const rowValues = error.parsedRowData || [error.rowData];
                        fileDataMap[filename].push([errorMessage, filename, error.lineNumber, ...rowValues]);
                    }
                }
            }

            if (hasFileErrors) {
                summaryData.push(['--- ERRORS BY FILE ---']);
                summaryData.push([]);
                for (const filename in fileDataMap) {
                    summaryData.push([`--- FILE: ${filename} ---`]);
                    summaryData.push(...fileDataMap[filename]);
                    summaryData.push([]);
                    summaryData.push([]);
                }
            }

            const byErrorData: any[][] = [];
            if (hasFileErrors) {
                byErrorData.push(['--- ERRORS BY MESSAGE ---']);
                byErrorData.push([]);
                for (const errorMessage in reportData) {
                    let hasErrorsForMessage = false;
                    const errorSection: any[][] = [[`--- ERROR: ${errorMessage} ---`], []];
                    
                    for (const filename in reportData[errorMessage]) {
                        if (filename === 'General Error') continue;
                        hasErrorsForMessage = true;
                        const headers = fileHeaders?.[filename] || ['Row Data'];
                        errorSection.push([`--- FILE: ${filename} ---`]);
                        errorSection.push(['Filename', 'Line Number', ...headers]);
                        
                        const reconciledErrors = reportData[errorMessage][filename];
                        for (const error of reconciledErrors) {
                            const rowValues = error.parsedRowData || [error.rowData];
                            errorSection.push([filename, error.lineNumber, ...rowValues]);
                        }
                        errorSection.push([]);
                    }
                    
                    if (hasErrorsForMessage) {
                        byErrorData.push(...errorSection);
                        byErrorData.push([]);
                    }
                }
            }

            if (format === 'xlsx') {
                if (summaryData.length === 0 && byErrorData.length === 0) {
                    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['No errors found']]), 'Summary');
                } else {
                    if (summaryData.length > 0) {
                        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
                        XLSX.utils.book_append_sheet(workbook, summarySheet, 'By File');
                    }
                    if (byErrorData.length > 0) {
                        const byErrorSheet = XLSX.utils.aoa_to_sheet(byErrorData);
                        XLSX.utils.book_append_sheet(workbook, byErrorSheet, 'By Error');
                    }
                }
                XLSX.writeFile(workbook, filename);
            } else {
                const combinedData: any[][] = [...summaryData];
                if (byErrorData.length > 0) {
                    combinedData.push([]);
                    combinedData.push([]);
                    combinedData.push(...byErrorData);
                }
                if (combinedData.length === 0) {
                    combinedData.push(['No errors found']);
                }
                const combinedSheet = XLSX.utils.aoa_to_sheet(combinedData);
                const csvOutput = XLSX.utils.sheet_to_csv(combinedSheet);
                const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
                downloadBlob(blob, filename);
            }
        } else if (format === 'docx') {
            const children: (Paragraph)[] = [];
            
            if (warnings.length > 0) {
                children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Warnings", spacing: { after: 200 } }));
                warnings.forEach(w => children.push(new Paragraph({ text: `- ${w}`, style: "ListParagraph" })));
                children.push(new Paragraph("")); // Spacer
            }
             
            if (Object.keys(reportData).length > 0) {
                for (const errorMessage in reportData) {
                    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: `Error: ${errorMessage}`, spacing: { after: 200 } }));
                    for (const filename in reportData[errorMessage]) {
                        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: `File: ${filename}`, spacing: { after: 100 } }));
                        const reconciledErrors = reportData[errorMessage][filename];
                        if (reconciledErrors.length > 0) {
                            for (const error of reconciledErrors) {
                                children.push(new Paragraph({
                                    children: [
                                        new TextRun({ text: `  Line ${error.lineNumber}: `, bold: true }),
                                        new TextRun(error.rowData),
                                    ],
                                    spacing: { after: 80 }
                                }));
                            }
                        } else if (filename === 'General Error') {
                            children.push(new Paragraph({
                                children: [ new TextRun({ text: `  (This is a general error with no specific file or line number.)`, italics: true }) ],
                                spacing: { after: 80 }
                            }));
                        }
                    }
                }
            }
            
            if (children.length === 0) {
                children.push(new Paragraph({ text: "No reconcilable errors found in the provided files." }));
            }

            const doc = new Document({ 
                sections: [{ children }],
                styles: {
                    paragraphStyles: [{
                        id: "ListParagraph",
                        name: "List Paragraph",
                        basedOn: "Normal",
                        quickFormat: true,
                        paragraph: {
                            indent: { left: 720 }, // 0.5 inch indent
                        },
                    }],
                },
            });
            const blob = await Packer.toBlob(doc);
            downloadBlob(blob, filename);
        }
    };


    return (
        <div className="flex flex-col bg-slate-50 rounded-lg shadow-inner overflow-hidden">
            <div className="flex flex-col gap-2 p-3 bg-slate-100 border-b border-slate-200 z-20 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-600 px-2 flex items-center flex-wrap">
                    <span className="font-semibold text-slate-800 mr-1">{totalErrors}</span> errors in
                    <span className="font-semibold text-slate-800 ml-1 mr-1">{totalFilesWithErrors}</span> files
                    {warnings && warnings.length > 0 && (
                        <span className="ml-2 text-amber-600">
                            ({warnings.length} warning{warnings.length !== 1 ? 's' : ''})
                        </span>
                    )}
                    {isSearching && (
                        <span className="ml-2 text-slate-500">— {filteredMatchCount} match{filteredMatchCount !== 1 ? 'es' : ''}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 md:flex-initial md:w-64">
                        <SearchIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search errors..."
                            className="w-full pl-8 pr-8 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-leafio-500 focus:border-transparent"
                            aria-label="Search report"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                aria-label="Clear search"
                            >
                                &times;
                            </button>
                        )}
                    </div>
                    <div className="relative" ref={saveMenuRef}>
                        <button
                        onClick={() => setIsSaveMenuOpen(prev => !prev)}
                        className="flex items-center px-3 py-1 bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300 transition text-sm"
                        aria-label="Open save options"
                    >
                        <SaveIcon className="w-4 h-4 mr-2" />
                        <span>Save as...</span>
                        <ChevronDownIcon className="w-4 h-4 ml-1" />
                    </button>
                    {isSaveMenuOpen && (
                        <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg z-10 border border-slate-200">
                            <ul className="py-1 text-sm text-slate-700">
                                <li><button onClick={createSaveHandler('txt')} className="w-full text-left px-4 py-2 hover:bg-slate-100">TXT</button></li>
                                <li><button onClick={createSaveHandler('pdf')} className="w-full text-left px-4 py-2 hover:bg-slate-100">PDF</button></li>
                                <li><button onClick={createSaveHandler('csv')} className="w-full text-left px-4 py-2 hover:bg-slate-100">CSV</button></li>
                                <li><button onClick={createSaveHandler('xlsx')} className="w-full text-left px-4 py-2 hover:bg-slate-100">XLSX</button></li>
                                <li><button onClick={createSaveHandler('docx')} className="w-full text-left px-4 py-2 hover:bg-slate-100">DOCX</button></li>
                            </ul>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleCopy}
                    className="flex items-center px-3 py-1 bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300 transition text-sm"
                    aria-label="Copy report to clipboard"
                >
                    {copied ? (
                        <>
                            <CheckIcon className="w-4 h-4 mr-2 text-green-500" /> Copied!
                        </>
                    ) : (
                        <>
                            <CopyIcon className="w-4 h-4 mr-2" /> Copy
                        </>
                    )}
                </button>
                </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
                 {warnings && warnings.length > 0 && (
                    <Collapsible 
                        title={<span className="text-amber-600">Warnings</span>} 
                        defaultOpen={true}
                        count={warnings.length}
                    >
                        <div className="py-2 pr-4 text-xs md:text-sm space-y-2" style={{ paddingLeft: '2.25rem' }}>
                            {warnings.map((warning, index) => (
                                <p key={index} className="text-slate-600">{warning}</p>
                            ))}
                        </div>
                    </Collapsible>
                 )}
                 {Object.keys(reportData).length === 0 && warnings.length === 0 && (
                    <div className="p-4 text-center text-slate-500">No reconcilable errors found in the provided files.</div>
                 )}
                 {Object.keys(reportData).length > 0 && isSearching && Object.keys(filteredReportData).length === 0 && (
                    <div className="p-4 text-center text-slate-500">No errors match "{searchTerm}".</div>
                 )}
                 {Object.entries(filteredReportData).map(([errorMessage, files], errorIndex) => {
                     const totalErrors = Object.values(files).reduce((acc, fileErrors) => acc + (fileErrors.length || 1), 0);
                     return (
                        <Collapsible
                            key={errorIndex}
                            title={<span><span className="font-light text-slate-500 mr-2">ERROR:</span> {highlightMatch(errorMessage, searchTerm)}</span>}
                            count={totalErrors}
                            openOverride={isSearching ? true : undefined}
                        >
                            {Object.entries(files).map(([filename, reconciledErrors], fileIndex) => {
                                const headers = fileHeaders?.[filename] || ['Row Data'];
                                return (
                                <Collapsible
                                    key={`${errorIndex}-${fileIndex}`}
                                    level={1}
                                    title={
                                        filename === 'General Error'
                                        ? <span className="italic text-amber-600">General Error</span>
                                        : <span><span className="font-light text-slate-500 mr-2">File:</span> {highlightMatch(filename, searchTerm)}</span>
                                    }
                                    count={reconciledErrors.length > 0 ? reconciledErrors.length : undefined}
                                    openOverride={isSearching ? true : undefined}
                                >
                                    {filename === 'General Error' ? (
                                        <div className="text-slate-500 italic px-4 py-2 text-xs md:text-sm" style={{ paddingLeft: '3.5rem' }}>This is a general error with no specific file or line number.</div>
                                    ) : (
                                        <div className="overflow-x-auto py-2 pr-4" style={{ paddingLeft: '2.25rem' }}>
                                            <table className="min-w-full text-xs md:text-sm border-collapse">
                                                <thead>
                                                    <tr className="text-left text-slate-500 border-b border-slate-200">
                                                        <th className="py-1 pr-4 font-medium whitespace-nowrap sticky left-0 bg-white">Line</th>
                                                        {headers.map((header, i) => (
                                                            <th key={i} className="py-1 pr-4 font-medium whitespace-nowrap">{header || `Col ${i + 1}`}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reconciledErrors.map(({ lineNumber, rowData, parsedRowData }, index) => {
                                                        const cells = parsedRowData && parsedRowData.length > 0 ? parsedRowData : [rowData];
                                                        return (
                                                            <tr key={index} className="hover:bg-slate-100 border-b border-slate-100 last:border-b-0">
                                                                <td className="py-1 pr-4 text-right text-slate-400 select-none whitespace-nowrap align-top sticky left-0 bg-white">{lineNumber}</td>
                                                                {cells.map((cell, i) => (
                                                                    <td key={i} className="py-1 pr-4 text-slate-700 align-top whitespace-pre-wrap break-all">{highlightMatch(cell ?? '', searchTerm)}</td>
                                                                ))}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Collapsible>
                            )})}
                        </Collapsible>
                     )
                 })}
            </div>
        </div>
    );
};
