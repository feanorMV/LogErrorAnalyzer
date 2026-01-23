
import React, { useState } from 'react';
import { ChevronDownIcon, InfoIcon, LogFileIcon, SourceFilesIcon, GenerateIcon, ReportIcon } from './Icons';
import { translations } from '../localization/translations';

type Language = keyof typeof translations;

const languages: { code: Language; name: string }[] = [
    { code: 'uk', name: 'UK' },
    { code: 'en', name: 'EN' },
    { code: 'es', name: 'ES' },
    { code: 'pt', name: 'PT' },
];

const InstructionStep: React.FC<{
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}> = ({ icon, title, children }) => (
    <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400">
            {icon}
        </div>
        <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100">{title}</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{children}</p>
        </div>
    </div>
);


export const Instructions: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [language, setLanguage] = useState<Language>('uk');

    const t = translations[language];

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 mb-8">
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center justify-between p-4 text-left focus:outline-none"
                aria-expanded={isOpen}
                aria-controls="instructions-content"
            >
                <div className="flex items-center">
                    <InfoIcon className="w-6 h-6 mr-3 text-sky-600 dark:text-sky-400" />
                    <span className="font-semibold text-lg text-slate-700 dark:text-slate-200">{t.howItWorks}</span>
                </div>
                <ChevronDownIcon className={`w-6 h-6 text-slate-500 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>
            {isOpen && (
                <div id="instructions-content" className="border-t border-slate-200 dark:border-slate-700/50">
                    <div className="px-6 pt-4 flex justify-end items-center space-x-1">
                        {languages.map(({ code, name }) => (
                            <button
                                key={code}
                                onClick={(e) => {
                                    e.stopPropagation(); // Prevent collapsing the accordion
                                    setLanguage(code);
                                }}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                                    language === code 
                                    ? 'bg-sky-600 text-white' 
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                }`}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <InstructionStep icon={<LogFileIcon />} title={t.step1Title}>
                                {t.step1Description}
                            </InstructionStep>
                            <InstructionStep icon={<SourceFilesIcon />} title={t.step2Title}>
                               {t.step2Description}
                            </InstructionStep>
                            <InstructionStep icon={<GenerateIcon />} title={t.step3Title}>
                                {t.step3Description}
                            </InstructionStep>
                            <InstructionStep icon={<ReportIcon />} title={t.step4Title}>
                                {t.step4Description}
                            </InstructionStep>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
