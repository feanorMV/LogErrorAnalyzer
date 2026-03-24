
export interface ParsedLogError {
  errorMessage: string;
  filename: string;
  lines: number[];
}

export interface ReconciledError {
  lineNumber: number;
  rowData: string;
  parsedRowData?: string[];
}

export interface ReportData {
  [errorMessage: string]: {
    [filename: string]: ReconciledError[];
  };
}
