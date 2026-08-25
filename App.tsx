
import React, { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { ReportDisplay } from './components/ReportDisplay';
import { generateReport, ReportOutput } from './services/logProcessor';
import { AppIcon, ProcessingIcon } from './components/Icons';
import { Instructions } from './components/Instructions';

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
        <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
            <div className="w-full max-w-4xl">
                <header className="mb-7">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-leafio-600 flex items-center justify-center">
                            <AppIcon className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-leafio-600">Log Error Reconciler</h1>
                    </div>
                    <p className="mt-2 text-slate-500">Upload logs and source files to generate a consolidated error report.</p>
                </header>

                <main className="space-y-5">
                    <Instructions />

                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-4">1 &middot; Upload files</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-slate-700">Log file</h3>
                                <FileUpload
                                    onFileSelect={handleLogFileSelect}
                                    label="Select log.csv"
                                    accept=".csv"
                                    multiple={false}
                                    selectedFile={logFile?.name} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-slate-700">Source data</h3>
                                <FileUpload
                                    onFileSelect={handleSourceFilesSelect}
                                    label="Select source CSVs"
                                    accept=".csv"
                                    multiple={true}
                                    selectedFile={sourceFiles ? `${sourceFiles.length} file(s) selected` : undefined}/>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-4">2 &middot; Generate report</h2>
                        <button
                            onClick={handleGenerateReport}
                            disabled={!logFile || !sourceFiles || isLoading}
                            className="w-full flex items-center justify-center bg-leafio-600 hover:bg-leafio-700 disabled:bg-slate-400 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-leafio-100 disabled:cursor-not-allowed"
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

                        {error && (
                            <div className="mt-4 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                                <p className="font-bold">Error</p>
                                <p>{error}</p>
                            </div>
                        )}
                    </section>

                    {report && (
                        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-4">3 &middot; Generated report</h2>
                            <ReportDisplay reportOutput={report} />
                        </section>
                    )}
                </main>

                <footer className="text-center mt-8 text-sm text-slate-500">
                    <p>Built with React, Tailwind CSS, and TypeScript.</p>
                </footer>
            </div>
        </div>
    );
};

export default App;
