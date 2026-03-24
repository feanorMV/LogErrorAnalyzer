
import { ParsedLogError, ReportData } from '../types';

export interface ReportOutput {
    reportString: string;
    reportData: ReportData;
    warnings: string[];
}

// This regex has been updated to be less strict:
// 1. The end-of-string anchor `$` has been removed to handle truncated lines.
// 2. The closing parenthesis `\)` is now optional `\)?` to match incomplete patterns.
const DESCRIPTION_REGEX = /(?<error_msg>.*?)(?:,)?\s*(?:[Ff]ile:?)?\s*(?<filename>\S+\.csv)\s*\([Ll]ine(?:s)?:?\s*(?<lines>[\d,\s-]+)\)?/;

const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
};

const parseLineNumbers = (linesStr: string): number[] => {
    const numbers: Set<number> = new Set();
    // Split by comma only, to correctly handle ranges with spaces like "5 - 10".
    const parts = linesStr.split(','); 
    for (const part of parts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;

        if (trimmedPart.includes('-')) {
            const [start, end] = trimmedPart.split('-').map(n => parseInt(n.trim(), 10));
            if (!isNaN(start) && !isNaN(end) && end >= start) {
                for (let i = start; i <= end; i++) {
                    numbers.add(i);
                }
            }
        } else {
            const num = parseInt(trimmedPart, 10);
            if (!isNaN(num)) {
                numbers.add(num);
            }
        }
    }
    return Array.from(numbers).sort((a, b) => a - b);
};

const parseLogCsv = (logContent: string): { errors: ParsedLogError[], warnings: string[] } => {
    const lines = logContent.trim().split(/\r?\n/);
    if (lines.length < 2) return { errors: [], warnings: [] };

    // A robust CSV row parser that handles quoted fields containing the delimiter.
    const parseCsvRow = (row: string): string[] => {
        // This regex splits by semicolon, but ignores semicolons inside double-quoted strings.
        return row.split(/;(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => {
            let value = v.trim();
            // Remove surrounding quotes if they exist
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            // Replace escaped double quotes "" with a single quote "
            return value.replace(/""/g, '"');
        });
    };

    const header = parseCsvRow(lines[0]);
    const stateIndex = header.indexOf('State');
    const descriptionIndex = header.indexOf('Description');

    if (stateIndex === -1 || descriptionIndex === -1) {
        throw new Error('Log CSV is missing required "State" or "Description" columns.');
    }

    const errors: ParsedLogError[] = [];
    const warnings: string[] = [];

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        if (!row.trim()) continue; // Skip empty or whitespace-only lines

        const values = parseCsvRow(row);
        
        if (values.length > Math.max(stateIndex, descriptionIndex) && values[stateIndex] === 'Error') {
            const description = values[descriptionIndex] || '';
            const match = description.match(DESCRIPTION_REGEX);

            if (match && match.groups) {
                const { error_msg, filename, lines } = match.groups;
                const parsedLines = parseLineNumbers(lines);

                if (parsedLines.length > 0) {
                    errors.push({
                        errorMessage: error_msg.trim(),
                        filename: filename.trim(),
                        lines: parsedLines,
                    });
                } else if (error_msg.trim()){ // Still log if we got a message but no lines
                     errors.push({
                        errorMessage: error_msg.trim(),
                        filename: 'General Error',
                        lines: [],
                    });
                }
            } else {
                const errorMessage = description.trim();
                if (errorMessage) {
                    errors.push({
                        errorMessage: errorMessage,
                        filename: 'General Error',
                        lines: [],
                    });
                    warnings.push(`A general error was found with no specific file/line data: "${errorMessage}"`);
                }
            }
        }
    }
    return { errors, warnings };
};

const formatReport = (reportData: ReportData, warnings: string[]): string => {
    let reportString = '';
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    reportString += `==================================================\n`;
    reportString += `ERROR REPORT GENERATED ON [${timestamp}]\n`;
    reportString += `==================================================\n\n`;

    if (warnings.length > 0) {
        reportString += `WARNINGS:\n`;
        warnings.forEach(w => {
            reportString += `- ${w}\n`;
        });
        reportString += `--------------------------------------------------\n\n`;
    }

    if (Object.keys(reportData).length === 0) {
        reportString += 'No reconcilable errors found in the provided files.\n';
        return reportString;
    }

    for (const errorMessage in reportData) {
        reportString += `[ERROR TYPE]: "${errorMessage}"\n`;
        reportString += `--------------------------------------------------\n`;
        const files = reportData[errorMessage];
        for (const filename in files) {
            reportString += `File: ${filename}\n`;
            const reconciledErrors = files[filename];
            if (reconciledErrors.length > 0) {
                reconciledErrors.forEach(({ lineNumber, rowData }) => {
                    reportString += `  Line ${lineNumber}:  ${rowData}\n`;
                });
            } else if (filename === 'General Error') {
                reportString += `  (This is a general error with no specific file or line number.)\n`;
            }
            reportString += `\n`;
        }
    }
    return reportString;
};

export const generateReport = async (logFile: File, sourceFiles: FileList): Promise<ReportOutput> => {
    const logContent = await readFileAsText(logFile);
    const { errors: parsedErrors, warnings: parsingWarnings } = parseLogCsv(logContent);
    
    const errorsByFile = parsedErrors.reduce((acc, error) => {
        if (!acc[error.filename]) {
            acc[error.filename] = [];
        }
        acc[error.filename].push(error);
        return acc;
    }, {} as { [filename: string]: ParsedLogError[] });

    const sourceFileMap = new Map<string, File>();
    for (let i = 0; i < sourceFiles.length; i++) {
        sourceFileMap.set(sourceFiles[i].name, sourceFiles[i]);
    }

    const reportData: ReportData = {};
    const warnings: string[] = [...parsingWarnings];

    for (const filename in errorsByFile) {
        if (filename === 'General Error') {
            const generalFileErrors = errorsByFile[filename];
            generalFileErrors.forEach(error => {
                if (!reportData[error.errorMessage]) {
                    reportData[error.errorMessage] = {};
                }
                reportData[error.errorMessage][filename] = []; 
            });
            continue;
        }

        const sourceFile = sourceFileMap.get(filename);
        if (!sourceFile) {
            warnings.push(`Source file "${filename}" mentioned in the log was not found.`);
            continue;
        }

        try {
            const sourceContent = await readFileAsText(sourceFile);
            const sourceLines = sourceContent.trim().split(/\r?\n/);
            const fileErrors = errorsByFile[filename];

            fileErrors.forEach(error => {
                if (!reportData[error.errorMessage]) {
                    reportData[error.errorMessage] = {};
                }
                if (!reportData[error.errorMessage][filename]) {
                    reportData[error.errorMessage][filename] = [];
                }

                error.lines.forEach(logLineNumber => {
                    // ASSUMPTION: The line number from the log file is a 1-based index
                    // that corresponds to the absolute line number in the source file
                    // (e.g., as seen in a text editor). This means if a source file has a
                    // header, the log's line numbers must account for it (e.g., the first
                    // data row would be line 2).

                    // To convert the 1-based log line number to a 0-based array index
                    // for `sourceLines`, we subtract 1.
                    const sourceLineIndex = logLineNumber - 1;
                    
                    if (sourceLineIndex >= 0 && sourceLineIndex < sourceLines.length) {
                        reportData[error.errorMessage][filename].push({
                            lineNumber: logLineNumber, // Report the original line number from the log
                            rowData: sourceLines[sourceLineIndex].trim(),
                        });
                    } else {
                        warnings.push(`Line number ${logLineNumber} for file "${filename}" is out of range.`);
                    }
                });
            });

        } catch (e) {
            if (e instanceof Error) {
                warnings.push(`Could not read or process source file "${filename}": ${e.message}`);
            }
        }
    }

    const reportString = formatReport(reportData, warnings);
    
    return { reportString, reportData, warnings };
};