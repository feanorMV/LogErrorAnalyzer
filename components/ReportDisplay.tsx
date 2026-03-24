
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CopyIcon, CheckIcon, SaveIcon, ChevronDownIcon } from './Icons';
import { ReportOutput } from '../services/logProcessor';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import * as XLSX from 'xlsx';

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


const Collapsible: React.FC<{ title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean, level?: number, count?: number }> = ({ title, children, defaultOpen = false, level = 0, count }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const paddingLeft = {
        paddingLeft: `${level * 1.25 + 1}rem`
    };

    return (
        <div className="border-b border-slate-200 dark:border-slate-800 last:border-b-0">
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center text-left py-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800/50 transition-colors"
                style={paddingLeft}
                aria-expanded={isOpen}
            >
                <ChevronDownIcon className={`w-5 h-5 mr-3 transform transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
                <span className="flex-1 font-medium text-slate-700 dark:text-slate-300">{title}</span>
                {count !== undefined && <span className="text-xs font-mono bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full px-2 py-0.5 mr-4">{count}</span>}
            </button>
            {isOpen && (
                <div className="pb-2 bg-white dark:bg-slate-900/70">
                    {children}
                </div>
            )}
        </div>
    );
};


export const ReportDisplay: React.FC<ReportDisplayProps> = ({ reportOutput }) => {
    const { reportString, reportData, warnings } = reportOutput;
    const [copied, setCopied] = useState(false);
    const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
    const saveMenuRef = useRef<HTMLDivElement>(null);

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
            const data = [];
            if(warnings.length > 0) {
                 warnings.forEach(w => data.push({ 'Type': 'Warning', 'Details': w }));
            }
            for (const errorMessage in reportData) {
                for (const file in reportData[errorMessage]) {
                    const reconciledErrors = reportData[errorMessage][file];
                    if (reconciledErrors.length > 0) {
                        for (const error of reconciledErrors) {
                            data.push({
                                'Type': 'Error',
                                'Details': errorMessage,
                                'Filename': file,
                                'Line Number': error.lineNumber,
                                'Row Data': error.rowData,
                            });
                        }
                    } else { // Handle General Errors
                         data.push({
                            'Type': 'Error',
                            'Details': errorMessage,
                            'Filename': file,
                            'Line Number': '',
                            'Row Data': '',
                         });
                    }
                }
            }
            const worksheet = XLSX.utils.json_to_sheet(data);
            if (format === 'csv') {
                const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
                const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
                downloadBlob(blob, filename);
            } else {
                 const workbook = XLSX.utils.book_new();
                 XLSX.utils.book_append_sheet(workbook, worksheet, 'Errors');
                 XLSX.writeFile(workbook, filename);
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
        <div className="relative bg-slate-50 dark:bg-slate-900/70 rounded-lg shadow-inner overflow-hidden">
            <div className="absolute top-3 right-3 flex items-center space-x-2 z-20">
                <div className="relative" ref={saveMenuRef}>
                    <button
                        onClick={() => setIsSaveMenuOpen(prev => !prev)}
                        className="flex items-center px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition text-sm"
                        aria-label="Open save options"
                    >
                        <SaveIcon className="w-4 h-4 mr-2" />
                        <span>Save as...</span>
                        <ChevronDownIcon className="w-4 h-4 ml-1" />
                    </button>
                    {isSaveMenuOpen && (
                        <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-slate-800 rounded-md shadow-lg z-10 border border-slate-200 dark:border-slate-700">
                            <ul className="py-1 text-sm text-slate-700 dark:text-slate-200">
                                <li><button onClick={createSaveHandler('txt')} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">TXT</button></li>
                                <li><button onClick={createSaveHandler('pdf')} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">PDF</button></li>
                                <li><button onClick={createSaveHandler('csv')} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">CSV</button></li>
                                <li><button onClick={createSaveHandler('xlsx')} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">XLSX</button></li>
                                <li><button onClick={createSaveHandler('docx')} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">DOCX</button></li>
                            </ul>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleCopy}
                    className="flex items-center px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition text-sm"
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
            <div className="pt-12 max-h-[60vh] overflow-y-auto">
                 {warnings && warnings.length > 0 && (
                    <Collapsible 
                        title={<span className="text-amber-600 dark:text-amber-400">Warnings</span>} 
                        defaultOpen={true}
                        count={warnings.length}
                    >
                        <div className="py-2 pr-4 text-xs md:text-sm space-y-2" style={{ paddingLeft: '2.25rem' }}>
                            {warnings.map((warning, index) => (
                                <p key={index} className="text-slate-600 dark:text-slate-400">{warning}</p>
                            ))}
                        </div>
                    </Collapsible>
                 )}
                 {Object.keys(reportData).length === 0 && warnings.length === 0 && (
                    <div className="p-4 text-center text-slate-500">No reconcilable errors found in the provided files.</div>
                 )}
                 {Object.entries(reportData).map(([errorMessage, files], errorIndex) => {
                     const totalErrors = Object.values(files).reduce((acc, fileErrors) => acc + (fileErrors.length || 1), 0);
                     return (
                        <Collapsible 
                            key={errorIndex} 
                            title={<span><span className="font-light text-slate-500 mr-2">ERROR:</span> {errorMessage}</span>}
                            count={totalErrors}
                        >
                            {Object.entries(files).map(([filename, reconciledErrors], fileIndex) => (
                                <Collapsible 
                                    key={`${errorIndex}-${fileIndex}`} 
                                    level={1} 
                                    title={
                                        filename === 'General Error'
                                        ? <span className="italic text-amber-600 dark:text-amber-400">General Error</span>
                                        : <span><span className="font-light text-slate-500 mr-2">File:</span> {filename}</span>
                                    }
                                    count={reconciledErrors.length > 0 ? reconciledErrors.length : undefined}
                                >
                                    {filename === 'General Error' ? (
                                        <div className="text-slate-500 dark:text-slate-400 italic px-4 py-2 text-xs md:text-sm" style={{ paddingLeft: '3.5rem' }}>This is a general error with no specific file or line number.</div>
                                    ) : (
                                        <div className="font-mono text-xs md:text-sm space-y-1 py-2 pr-4" style={{ paddingLeft: '2.25rem' }}>
                                            {reconciledErrors.map(({ lineNumber, rowData }, index) => (
                                                <div key={index} className="flex hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded p-1">
                                                    <span className="w-16 text-right pr-4 text-slate-400 dark:text-slate-500 select-none">{lineNumber}:</span>
                                                    <code className="flex-1 whitespace-pre-wrap break-all text-slate-700 dark:text-slate-300">{rowData}</code>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Collapsible>
                            ))}
                        </Collapsible>
                     )
                 })}
            </div>
        </div>
    );
};
