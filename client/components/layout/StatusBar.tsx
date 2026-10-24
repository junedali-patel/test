'use client';

import React from 'react';
import { GitBranch, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface StatusBarProps {
  line?: number;
  column?: number;
  language?: string;
  branch?: string;
  aiStatus?: 'idle' | 'processing' | 'ready';
  errorCount?: number;
  warningCount?: number;
  encoding?: string;
  indentation?: string;
}

export default function StatusBar({
  line = 1,
  column = 1,
  language = 'TypeScript',
  branch = 'main',
  aiStatus = 'ready',
  errorCount = 0,
  warningCount = 0,
  encoding = 'UTF-8',
}: StatusBarProps) {
  const displayLang = language.charAt(0).toUpperCase() + language.slice(1);

  return (
    <footer
      className="h-[22px] shrink-0 bg-[#007acc] text-[#ffffff] flex items-center justify-between px-2 text-[12px] select-none z-20 font-sans"
      aria-label="Status Bar"
    >
      {/* ── Left Status Items ── */}
      <div className="flex items-center h-full gap-0.5">
        {/* Remote / Git Branch */}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2 h-full hover:bg-[#1f8ad2] transition-colors cursor-pointer"
          title={`Git: ${branch}`}
        >
          <GitBranch size={13} />
          <span className="font-medium text-[11.5px]">{branch}*</span>
        </button>

        {/* Synchronize indicator */}
        <button
          type="button"
          className="inline-flex items-center px-1.5 h-full hover:bg-[#1f8ad2] transition-colors cursor-pointer"
          title="Synchronize Changes"
        >
          <RefreshCw size={11} />
        </button>

        {/* Errors & Warnings count */}
        <button
          type="button"
          className="inline-flex items-center gap-2 px-2 h-full hover:bg-[#1f8ad2] transition-colors cursor-pointer text-[11.5px]"
          title={`${errorCount} errors, ${warningCount} warnings`}
        >
          <span className="inline-flex items-center gap-1">
            <XCircle size={12} />
            <span>{errorCount}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <AlertTriangle size={12} />
            <span>{warningCount}</span>
          </span>
        </button>

        {/* AI Copilot Status */}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2 h-full hover:bg-[#1f8ad2] transition-colors cursor-pointer text-[11.5px]"
          title="CodeMind AI: Ready"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff]" />
          <span>CodeMind {aiStatus === 'processing' ? 'Working...' : 'AI'}</span>
        </button>
      </div>

      {/* ── Right Status Items ── */}
      <div className="flex items-center h-full text-[11.5px] gap-0.5">
        <button
          type="button"
          className="inline-flex items-center px-2 h-full hover:bg-[#1f8ad2] transition-colors cursor-pointer"
          title="Go to Line/Column"
        >
          Ln {line || 14}, Col {column || 21}
        </button>

        <button
          type="button"
          className="inline-flex items-center px-2 h-full hover:bg-[#1f8ad2] transition-colors cursor-pointer"
          title="Select Encoding"
        >
          {encoding || 'UTF-8'}
        </button>

        <button
          type="button"
          className="inline-flex items-center px-2 h-full hover:bg-[#1f8ad2] transition-colors cursor-pointer"
          title="Select Language Mode"
        >
          {displayLang.toLowerCase().includes('type') ? 'TypeScript JSX' : displayLang}
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 h-full hover:bg-[#1f8ad2] transition-colors cursor-pointer font-medium uppercase tracking-wider text-[11px]"
          title="AI Assistant Status"
        >
          <span className="text-[12px]">✦</span>
          <span>{aiStatus === 'processing' ? 'AI THINKING...' : 'AI READY'}</span>
        </button>
      </div>
    </footer>
  );
}
