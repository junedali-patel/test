'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { Sparkles, X, Check, AlertCircle, Loader2 } from 'lucide-react';

// Dynamically import the Monaco editor with no SSR
const Editor = dynamic(
  () => import('@monaco-editor/react'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-[#cccccc] gap-3">
        <Loader2 className="w-6 h-6 text-[#007acc] animate-spin" />
        <span className="text-xs font-mono text-[#858585]">Loading Monaco Editor...</span>
      </div>
    )
  }
);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  code: string;
  language: string;
  height?: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
  highlightRange?: { lineStart: number; lineEnd: number; source?: string } | null;
  onCursorChange?: (line: number) => void;
  onSelectionChange?: (startLine: number, endLine: number, selectedText?: string) => void;
};

const CodeEditor = ({
  code,
  language,
  height: _height = "100%", // eslint-disable-line @typescript-eslint/no-unused-vars
  onChange,
  readOnly = false,
  highlightRange = null,
  onCursorChange,
  onSelectionChange
}: Props) => {
  const { fontSize, lineNumbers, minimap } = useTheme();
  const [suggestion, setSuggestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [monacoLoaded] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleSuggest = async () => {
    if (!code.trim()) {
      setError("Please write some code first");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuggestion("");
    setShowSuggestion(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/ai/complete`,
        { 
          code: code,
          language: language || 'javascript'
        },
        { 
          timeout: 120000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.data && response.data.suggestion) {
        setSuggestion(response.data.suggestion);
      } else if (response.data && response.data.completion) {
        setSuggestion(response.data.completion);
      } else if (response.data && response.data.error) {
        throw new Error(response.data.error);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: unknown) {
      console.error("AI Suggestion Error:", err);
      let errorMessage = "Failed to get AI suggestions.";
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ERR_NETWORK') {
        errorMessage = "⚠️ Cannot connect to AI service. Ensure server is running on port 4000.";
      } else if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string; message?: string } } };
        errorMessage = axiosErr.response?.data?.error || axiosErr.response?.data?.message || errorMessage;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const applySuggestion = () => {
    if (suggestion && onChange) {
      const newCode = code + '\n' + suggestion;
      onChange(newCode);
      setShowSuggestion(false);
      setSuggestion("");
    }
  };

  const dismissSuggestion = () => {
    setShowSuggestion(false);
    setSuggestion("");
    setError("");
  };

  // ── Highlight Decorations ────────────────────────────────────────────────
  const applyHighlights = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    if (!highlightRange) {
      if (decorationsRef.current.length) {
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      }
      return;
    }

    const start = Math.max(1, highlightRange.lineStart);
    const end = Math.max(start, highlightRange.lineEnd);

    const newDecos = [
      {
        range: new monaco.Range(start, 1, end, 1),
        options: {
          isWholeLine: true,
          className: 'codemind-flowchart-line-highlight',
          linesDecorationsClassName: 'codemind-flowchart-gutter-marker',
          overviewRuler: {
            color: '#7957FF',
            position: monaco.editor.OverviewRulerLane.Full,
          },
        },
      },
    ];

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecos);

    editor.revealLinesInCenterIfOutsideViewport(start, end);
  }, [highlightRange]);

  useEffect(() => {
    applyHighlights();
  }, [applyHighlights]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Use standard Visual Studio Dark theme
    monaco.editor.setTheme('vs-dark');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.onDidChangeCursorPosition((e: any) => {
      onCursorChange?.(e.position.lineNumber);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.onDidChangeCursorSelection((e: any) => {
      const sel = e.selection;
      if (sel && onSelectionChange) {
        const model = editor.getModel();
        let selectedText = '';
        if (model) {
          try {
            selectedText = model.getValueInRange(
              new monaco.Selection(
                sel.startLineNumber,
                sel.startColumn,
                sel.endLineNumber,
                sel.endColumn
              )
            );
          } catch {
            selectedText = '';
          }
        }
        onSelectionChange(sel.startLineNumber, sel.endLineNumber, selectedText);
      }
    });

    applyHighlights();
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] relative overflow-hidden">
      {/* Floating AI Suggestion Trigger Button — docked in bottom corner to never obstruct code lines */}
      <div className="absolute bottom-3 right-6 z-20 shadow-lg">
        <button
          onClick={handleSuggest}
          disabled={isLoading || readOnly || !code.trim()}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0e639c] hover:bg-[#1177bb] active:bg-[#0d598a] disabled:opacity-40 text-white rounded text-xs font-medium border border-[#007acc]/40 shadow-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
          title="Get AI Code Suggestion"
        >
          {isLoading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles size={12} />
              <span>AI Suggest</span>
            </>
          )}
        </button>
      </div>

      {/* Editor Main Canvas */}
      <div className="flex-1 overflow-hidden relative">
        {monacoLoaded ? (
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={(value) => onChange?.(value)}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: minimap, renderCharacters: false, maxColumn: 80 },
              fontSize: fontSize || 13,
              lineHeight: 20,
              fontFamily: "'Consolas', 'Courier New', 'Fira Code', 'Menlo', monospace",
              lineNumbers: lineNumbers || 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              readOnly: readOnly,
              theme: 'vs-dark',
              formatOnPaste: true,
              formatOnType: true,
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              automaticLayout: true,
              renderLineHighlight: 'all',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              guides: { indentation: true, bracketPairs: true },
              padding: { top: 8, bottom: 8 },
            }}
          />
        ) : (
          /* Fallback Editor */
          <div className="h-full flex flex-col p-4 bg-[#1e1e1e]">
            <div className="text-xs text-[#cca700] bg-[#cca700]/10 border border-[#cca700]/30 px-3 py-2 rounded mb-2">
              Using Lightweight Fallback Editor
            </div>
            <textarea
              value={code}
              onChange={(e) => onChange?.(e.target.value)}
              readOnly={readOnly}
              className="flex-1 w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs p-4 rounded border border-[#3c3c3c] outline-none focus:border-[#007acc]"
              placeholder="Write your code here..."
            />
          </div>
        )}
      </div>

      {/* Error Message Drawer */}
      {error && (
        <div className="px-3 py-2 bg-[#5a1d1d]/40 border-t border-[#f14c4c]/40 text-[#f14c4c] text-xs font-mono shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            className="p-1 rounded hover:bg-[#5a1d1d] text-[#f14c4c] transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* AI Suggestion Floating Card */}
      {showSuggestion && suggestion && (
        <div className="absolute bottom-4 right-4 max-w-lg w-full bg-[#252526] border border-[#3c3c3c] rounded p-3 shadow-2xl z-30">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#3c3c3c]">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[#007acc]" />
              <span className="text-xs font-semibold text-[#ffffff]">AI Code Suggestion</span>
            </div>
            <button
              onClick={dismissSuggestion}
              className="text-[#858585] hover:text-[#ffffff] transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <pre className="text-xs text-[#9cdcfe] font-mono mb-3 bg-[#1e1e1e] p-3 rounded border border-[#3c3c3c] overflow-x-auto max-h-48 whitespace-pre-wrap">
            {suggestion}
          </pre>

          <div className="flex justify-end gap-2">
            <button
              onClick={dismissSuggestion}
              className="px-3 py-1 bg-[#2d2d2d] hover:bg-[#383838] text-[#cccccc] rounded text-xs font-medium border border-[#3c3c3c] transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={applySuggestion}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded text-xs font-medium transition-colors"
            >
              <Check size={13} />
              <span>Apply Suggestion</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
