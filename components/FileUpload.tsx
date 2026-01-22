
import React, { useState, useRef, useCallback } from 'react';
import { UploadIcon } from './Icons';

interface FileUploadProps {
    onFileSelect: (files: FileList | null) => void;
    label: string;
    accept: string;
    multiple: boolean;
    selectedFile?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, label, accept, multiple, selectedFile }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            onFileSelect(files);
            if(fileInputRef.current) {
                fileInputRef.current.files = files;
            }
        }
    }, [onFileSelect]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onFileSelect(e.target.files);
    };

    const dragClass = isDragging ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/50' : 'border-slate-300 dark:border-slate-600 hover:border-sky-400 dark:hover:border-sky-500';

    return (
        <label
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center w-full h-32 px-4 transition bg-white dark:bg-slate-700/50 border-2 ${dragClass} border-dashed rounded-md cursor-pointer`}
        >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                <UploadIcon className="w-8 h-8 mb-3 text-slate-400 dark:text-slate-500" />
                <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-sky-600 dark:text-sky-400">{label}</span> or drag and drop
                </p>
                {selectedFile ? (
                     <p className="text-xs text-green-600 dark:text-green-400 font-semibold truncate max-w-full px-4">{selectedFile}</p>
                ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{accept}</p>
                )}
            </div>
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={accept}
                multiple={multiple}
                onChange={handleFileChange}
            />
        </label>
    );
};
