
import React, { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { ReportDisplay } from './components/ReportDisplay';
import { generateReport, ReportOutput } from './services/logProcessor';
import { AppIcon, ProcessingIcon } from './components/Icons';

const App: React.FC = () => {
    const [logFile, setLogFile] = useState<File | null>(null);
    const [sourceFiles, setSourceFiles] = useState<FileList | null>(null);
    const [report, setReport] = useState<ReportOutput | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleLogFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            setLogFile(files[0]);
            setError('');
            setReport(null);
        }
    };

    const handleSourceFilesSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            setSourceFiles(files);
            setError('');
            setReport(null);
        }
    };

    const handleGenerateReport = useCallback(async () => {
        if (!logFile || !sourceFiles) {
            setError('Please upload both the log file and the source data files.');
            return;
        }

        setIsLoading(true);
        setError('');
        setReport(null);

        try {
            const generatedReport = await generateReport(logFile, sourceFiles);
            setReport(generatedReport);
        } catch (e) {
            if (e instanceof Error) {
                setError(`An error occurred: ${e.message}`);
            } else {
                setError('An unknown error occurred during processing.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [logFile, sourceFiles]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
            <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                <header className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center space-x-4">
                        <AppIcon />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Log Error Reconciler</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Upload logs and source files to generate a consolidated error report.</p>
                        </div>
                    </div>
                </header>

                <main className="p-6 md:p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">1. Upload Log File</h2>
                            <FileUpload 
                                onFileSelect={handleLogFileSelect} 
                                label="Select log.csv" 
                                accept=".csv" 
                                multiple={false}
                                selectedFile={logFile?.name} />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">2. Upload Source Data</h2>
                            <FileUpload 
                                onFileSelect={handleSourceFilesSelect} 
                                label="Select source CSVs" 
                                accept=".csv" 
                                multiple={true} 
                                selectedFile={sourceFiles ? `${sourceFiles.length} file(s) selected` : undefined}/>
                        </div>
                    </div>
                    
                    <div>
                        <button
                            onClick={handleGenerateReport}
                            disabled={!logFile || !sourceFiles || isLoading}
                            className="w-full flex items-center justify-center bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-sky-300 dark:focus:ring-sky-800 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <ProcessingIcon />
                                    Processing...
                                </>
                            ) : (
                                'Generate Report'
                            )}
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md" role="alert">
                            <p className="font-bold">Error</p>
                            <p>{error}</p>
                        </div>
                    )}
                    
                    {report && (
                        <div>
                            <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">Generated Report</h2>
                            <ReportDisplay reportOutput={report} />
                        </div>
                    )}
                </main>
            </div>
             <footer className="text-center mt-8 text-sm text-slate-500 dark:text-slate-400">
                <p>Built with React, Tailwind CSS, and TypeScript.</p>
            </footer>
        </div>
    );
};

export default App;