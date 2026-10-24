'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  CaseSensitive,
  WholeWord,
  Regex,
  Replace,
  FileCode,
  X,
  RefreshCw,
  ListFilter
} from 'lucide-react';

interface SearchResultMatch {
  line: number;
  content: string;
  matchIndex: number;
  matchLength: number;
}

interface FileSearchResult {
  filePath: string;
  fileName: string;
  matches: SearchResultMatch[];
}

interface SearchViewProps {
  onNavigateToCode?: (file: string, line: number) => void;
  filesContent?: Record<string, string>;
}

// Sample workspace files for responsive searching when no external content is injected
const SAMPLE_WORKSPACE_FILES: Record<string, string> = {
  'App.tsx': `import React, { useState } from 'react';
import { CodeEditor } from './components';
import { FlowchartPanel } from './components/flowchart';

export default function App() {
  const [activeTab, setActiveTab] = useState('App.tsx');
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="workspace">
      <CodeEditor file={activeTab} />
    </div>
  );
}`,
  'package.json': `{
  "name": "codemind-app",
  "version": "2.4.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "react": "^19.0.0",
    "next": "^15.0.0",
    "lucide-react": "^0.475.0"
  }
}`,
  'README.md': `# CodeMind.AI IDE

A faithful Visual Studio Code-style intelligent developer workspace.
Includes AST control-flow visualization, AI pair programming, and full file system support.

## Getting Started
Run npm run dev to launch the development server.`,
  'server.ts': `import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(4000, () => {
  console.log('Server running on port 4000');
});`
};

export default function SearchView({ onNavigateToCode, filesContent = SAMPLE_WORKSPACE_FILES }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [matchWord, setMatchWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});

  // Perform search across files
  const searchResults: FileSearchResult[] = useMemo(() => {
    if (!query.trim()) return [];

    const results: FileSearchResult[] = [];
    const sourceFiles = { ...SAMPLE_WORKSPACE_FILES, ...filesContent };

    for (const [filePath, content] of Object.entries(sourceFiles)) {
      const lines = content.split('\n');
      const fileMatches: SearchResultMatch[] = [];

      lines.forEach((lineText, lineIdx) => {
        let pattern: RegExp;
        try {
          if (useRegex) {
            pattern = new RegExp(query, matchCase ? 'g' : 'gi');
          } else if (matchWord) {
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            pattern = new RegExp(`\\b${escaped}\\b`, matchCase ? 'g' : 'gi');
          } else {
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            pattern = new RegExp(escaped, matchCase ? 'g' : 'gi');
          }

          let match: RegExpExecArray | null;
          while ((match = pattern.exec(lineText)) !== null) {
            fileMatches.push({
              line: lineIdx + 1,
              content: lineText,
              matchIndex: match.index,
              matchLength: match[0].length,
            });
            if (!pattern.global) break;
          }
        } catch {
          // Invalid regex fallback
        }
      });

      if (fileMatches.length > 0) {
        results.push({
          filePath,
          fileName: filePath.split('/').pop() || filePath,
          matches: fileMatches,
        });
      }
    }

    return results;
  }, [query, matchCase, matchWord, useRegex, filesContent]);

  const totalMatches = searchResults.reduce((acc, f) => acc + f.matches.length, 0);

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => ({
      ...prev,
      [path]: prev[path] === undefined ? false : !prev[path],
    }));
  };

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[#cccccc] select-none text-xs">
      {/* ── Search Header & Inputs ── */}
      <div className="p-3 border-b border-[#2b2b2b] flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-[#858585]">
          <span>SEARCH</span>
          <div className="flex items-center gap-1 text-[#858585]">
            <button
              onClick={() => setShowReplace((p) => !p)}
              className={`p-1 rounded hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer ${
                showReplace ? 'text-[#007acc]' : ''
              }`}
              title="Toggle Replace"
            >
              <Replace size={13} />
            </button>
            <button
              onClick={() => {
                setQuery('');
                setReplaceQuery('');
              }}
              className="p-1 rounded hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer"
              title="Clear Search"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Search Query Input */}
        <div className="relative flex items-center bg-[#1e1e1e] border border-[#3c3c3c] focus-within:border-[#007acc] rounded px-2 py-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent text-xs text-white placeholder-[#858585] focus:outline-none font-mono"
          />

          <div className="flex items-center gap-0.5 text-[#858585]">
            <button
              type="button"
              onClick={() => setMatchCase((p) => !p)}
              className={`p-1 rounded hover:text-white transition-colors cursor-pointer ${
                matchCase ? 'bg-[#007acc]/30 text-[#007acc]' : ''
              }`}
              title="Match Case (Alt+C)"
            >
              <CaseSensitive size={14} />
            </button>
            <button
              type="button"
              onClick={() => setMatchWord((p) => !p)}
              className={`p-1 rounded hover:text-white transition-colors cursor-pointer ${
                matchWord ? 'bg-[#007acc]/30 text-[#007acc]' : ''
              }`}
              title="Match Whole Word (Alt+W)"
            >
              <WholeWord size={14} />
            </button>
            <button
              type="button"
              onClick={() => setUseRegex((p) => !p)}
              className={`p-1 rounded hover:text-white transition-colors cursor-pointer ${
                useRegex ? 'bg-[#007acc]/30 text-[#007acc]' : ''
              }`}
              title="Use Regular Expression (Alt+R)"
            >
              <Regex size={14} />
            </button>
          </div>
        </div>

        {/* Replace Input (Collapsible) */}
        {showReplace && (
          <div className="relative flex items-center bg-[#1e1e1e] border border-[#3c3c3c] focus-within:border-[#007acc] rounded px-2 py-1">
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace"
              className="flex-1 bg-transparent text-xs text-white placeholder-[#858585] focus:outline-none font-mono"
            />
          </div>
        )}
      </div>

      {/* ── Search Summary / Count ── */}
      {query.trim() && (
        <div className="px-3 py-1 bg-[#252526] border-b border-[#2b2b2b] text-[11px] text-[#858585] flex items-center justify-between shrink-0">
          <span>
            {totalMatches} result{totalMatches === 1 ? '' : 's'} in {searchResults.length} file{searchResults.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => setQuery('')}
            className="text-[10px] text-[#858585] hover:text-white hover:underline cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Search Results List ── */}
      <div className="flex-1 overflow-y-auto ide-scrollbar p-1">
        {!query.trim() ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#858585] gap-2">
            <Search size={28} className="opacity-30 text-[#007acc]" />
            <p className="text-xs">Type a search query to inspect occurrences across your codebase.</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#858585]">
            No results found for &ldquo;<span className="text-[#cccccc]">{query}</span>&rdquo;
          </div>
        ) : (
          <div className="space-y-1">
            {searchResults.map((file) => {
              const isCollapsed = expandedFiles[file.filePath] === false;
              return (
                <div key={file.filePath} className="border-b border-[#2b2b2b]/40 pb-1">
                  {/* File Header */}
                  <div
                    onClick={() => toggleFile(file.filePath)}
                    className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#2a2d2e] rounded cursor-pointer text-xs"
                  >
                    {isCollapsed ? (
                      <ChevronRight size={13} className="text-[#858585]" />
                    ) : (
                      <ChevronDown size={13} className="text-[#858585]" />
                    )}
                    <FileCode size={13} className="text-[#519aba] shrink-0" />
                    <span className="font-mono text-white font-medium truncate">{file.fileName}</span>
                    <span className="ml-auto text-[10px] font-mono px-1.5 py-0.2 bg-[#3c3c3c] text-[#cccccc] rounded-full">
                      {file.matches.length}
                    </span>
                  </div>

                  {/* Matches List */}
                  {!isCollapsed && (
                    <div className="pl-6 pr-1 space-y-0.5 mt-0.5 font-mono text-[11px]">
                      {file.matches.map((m, idx) => (
                        <div
                          key={idx}
                          onClick={() => onNavigateToCode && onNavigateToCode(file.filePath, m.line)}
                          className="flex items-baseline gap-2 px-1.5 py-0.5 hover:bg-[#094771]/60 hover:text-white rounded cursor-pointer transition-colors group"
                        >
                          <span className="text-[#858585] group-hover:text-[#75beff] shrink-0 text-[10px]">
                            {m.line}:
                          </span>
                          <span className="truncate text-[#cccccc] group-hover:text-white">
                            {m.content.slice(0, m.matchIndex)}
                            <span className="bg-[#613214] text-[#e2c08d] font-bold px-0.5 rounded">
                              {m.content.slice(m.matchIndex, m.matchIndex + m.matchLength)}
                            </span>
                            {m.content.slice(m.matchIndex + m.matchLength)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
