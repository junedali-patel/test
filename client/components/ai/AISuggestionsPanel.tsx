'use client';

// client/components/ai/AISuggestionsPanel.tsx
// Visual Studio style AI code suggestion + repo analysis panel.
// Flat dark aesthetics, standard buttons, diff preview modal.

import { useState } from 'react';
import axios from 'axios';
import { Loader2, AlertCircle, Sparkles, CheckCircle, X, Eye } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface AISuggestionsPanelProps {
  code?: string | null;
  language?: string | null;
  fileName?: string | null;
  onApplySuggestion?: (suggestion: string) => void;
  onAnalyzeRepo?: () => void;
  isAnalyzing?: boolean;
  analysisResult?: string;
  repoAvailable?: boolean;
}

// ── Diff Preview Modal ──────────────────────────────────────────────────────
interface DiffPreviewModalProps {
  currentCode: string;
  suggestion: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DiffPreviewModal({ currentCode, suggestion, onConfirm, onCancel }: DiffPreviewModalProps) {
  const currentLines = currentCode.split('\n');
  const previewLines = suggestion.split('\n');
  const contextLines = currentLines.slice(Math.max(0, currentLines.length - 8));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
      <div
        className="w-[520px] max-w-[95vw] max-h-[80vh] flex flex-col rounded bg-[#252526] border border-[#3c3c3c] shadow-2xl overflow-hidden font-sans"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diff-preview-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#323233] border-b border-[#2b2b2b] shrink-0">
          <div className="flex items-center gap-2">
            <Eye size={13} className="text-[#007acc]" />
            <span id="diff-preview-title" className="text-xs font-semibold text-[#ffffff]">
              Review Code Changes
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-[#ffffff] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0 text-xs">
          <p className="text-[11px] text-[#858585] mb-2">
            Review the code diff below before applying the changes to the active file.
          </p>

          {/* Context from existing file */}
          {contextLines.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wider text-[#858585] font-semibold mb-1">
                Context (last {contextLines.length} lines)
              </p>
              <pre className="bg-[#1e1e1e] border border-[#3c3c3c] rounded text-[11px] font-mono text-[#858585] p-2.5 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                {contextLines.map((line, i) => (
                  <span key={i} className="block">
                    {'  '}{line || ' '}
                  </span>
                ))}
              </pre>
            </div>
          )}

          {/* New lines (green) */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#73c991] font-semibold mb-1">
              Appended Changes (+{previewLines.length} lines)
            </p>
            <pre className="bg-[#1e1e1e] border border-[#73c991]/40 rounded text-[11px] font-mono p-2.5 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
              {previewLines.map((line, i) => (
                <span key={i} className="block text-[#73c991]">
                  + {line}
                </span>
              ))}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-3 py-2 bg-[#252526] border-t border-[#3c3c3c] shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 rounded text-xs font-medium transition-colors bg-[#2d2d2d] hover:bg-[#383838] border border-[#3c3c3c] text-[#cccccc] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1 rounded text-xs font-medium transition-colors bg-[#0e639c] hover:bg-[#1177bb] text-white cursor-pointer"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function AISuggestionsPanel({
  code = null,
  language = null,
  fileName = null,
  onApplySuggestion,
  onAnalyzeRepo,
  isAnalyzing = false,
  analysisResult = '',
  repoAvailable = false,
}: AISuggestionsPanelProps) {
  const [suggestion, setSuggestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showDiffPreview, setShowDiffPreview] = useState(false);

  const hasCode = Boolean(code?.trim());

  const handleSuggest = async () => {
    if (!hasCode) {
      setError('No code loaded. Open a file first.');
      return;
    }
    setIsLoading(true);
    setError('');
    setSuggestion('');
    setShowSuggestion(false);
    setApplied(false);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/ai/complete`,
        { code, language },
        { timeout: 45000 }
      );
      const result: string =
        response.data?.suggestion ||
        response.data?.completion ||
        '';
      if (!result.trim()) {
        setError('AI returned an empty suggestion. Try again.');
        return;
      }
      setSuggestion(result);
      setShowSuggestion(true);
    } catch (err: unknown) {
      const e = err as {
        code?: string;
        message?: string;
        response?: { data?: { error?: string } };
      };
      if (e.code === 'ECONNABORTED') {
        setError('Request timed out. Please try again.');
      } else if (e.response?.data?.error) {
        setError(e.response.data.error);
      } else {
        setError(e.message || 'Failed to get suggestion.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyClick = () => {
    if (!suggestion) return;
    setShowDiffPreview(true);
  };

  const handleConfirmApply = () => {
    if (suggestion && onApplySuggestion) {
      onApplySuggestion(suggestion);
      setApplied(true);
    }
    setShowDiffPreview(false);
  };

  const handleCancelDiff = () => {
    setShowDiffPreview(false);
  };

  const handleDismiss = () => {
    setSuggestion('');
    setShowSuggestion(false);
    setError('');
    setApplied(false);
    setShowDiffPreview(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc] text-xs overflow-hidden">
      {/* Diff preview modal */}
      {showDiffPreview && (
        <DiffPreviewModal
          currentCode={code ?? ''}
          suggestion={suggestion}
          onConfirm={handleConfirmApply}
          onCancel={handleCancelDiff}
        />
      )}

      {/* ── Get Suggestion Section ── */}
      <div className="p-3 shrink-0 border-b border-[#2b2b2b] bg-[#252526]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-[#858585] font-semibold">
            Code Completion & Suggestion
          </p>
          {fileName && (
            <span className="font-mono text-[10px] bg-[#1e1e1e] border border-[#3c3c3c] text-[#9cdcfe] px-1.5 py-0.5 rounded truncate max-w-[180px]">
              {fileName}
            </span>
          )}
        </div>

        {!hasCode && !isLoading && (
          <p className="text-[#858585] text-xs mb-2">
            Open a file in the Monaco editor to generate context-aware suggestions.
          </p>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-2 flex items-start gap-2 p-2 rounded bg-[#5a1d1d]/40 border border-[#f14c4c]/40 text-[#f14c4c] text-xs">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span className="flex-1 break-words">{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Dismiss error"
              className="shrink-0 p-0.5 hover:text-white transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Get Suggestion button */}
        <button
          type="button"
          onClick={handleSuggest}
          disabled={!hasCode || isLoading}
          className="w-full h-[32px] flex items-center justify-center gap-2 px-3 rounded text-xs font-medium transition-colors bg-[#0e639c] hover:bg-[#1177bb] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 size={13} className="animate-spin text-white" />
              <span>Generating Suggestion...</span>
            </>
          ) : (
            <>
              <Sparkles size={13} />
              <span>Generate AI Suggestion</span>
            </>
          )}
        </button>
      </div>

      {/* ── Suggestion Card ── */}
      {showSuggestion && suggestion && (
        <div className="m-3 p-3 bg-[#252526] border border-[#3c3c3c] rounded shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-[#858585] font-semibold">
              Suggested Code
            </p>
            {applied && (
              <span className="flex items-center gap-1 text-[#73c991] text-[11px] font-semibold">
                <CheckCircle size={12} />
                Applied to Editor
              </span>
            )}
          </div>
          <pre className="bg-[#1e1e1e] border border-[#3c3c3c] text-[#9cdcfe] font-mono text-[11px] p-2.5 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto ide-scrollbar leading-relaxed">
            {suggestion}
          </pre>
          <div className="flex gap-2 mt-2.5">
            <button
              type="button"
              onClick={handleApplyClick}
              disabled={applied || !onApplySuggestion}
              className="flex-1 h-[28px] flex items-center justify-center gap-1.5 px-3 rounded text-xs font-medium transition-colors bg-[#0e639c] hover:bg-[#1177bb] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Eye size={12} />
              <span>{applied ? 'Applied' : 'Review & Apply Diff'}</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="h-[28px] px-3 rounded text-xs font-medium transition-colors bg-[#2d2d2d] hover:bg-[#383838] border border-[#3c3c3c] text-[#cccccc] hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Repo Analysis Section ── */}
      <div className="p-3 shrink-0 border-t border-[#2b2b2b] bg-[#252526]">
        <p className="text-[10px] uppercase tracking-wider text-[#858585] font-semibold mb-1.5">
          Workspace Repository Analysis
        </p>

        {!repoAvailable && (
          <p className="text-[#858585] text-xs mb-2">
            Open a workspace repository to analyze architecture, dependencies, and imports.
          </p>
        )}

        <button
          type="button"
          onClick={onAnalyzeRepo}
          disabled={isAnalyzing || !repoAvailable || !onAnalyzeRepo}
          className="w-full h-[32px] flex items-center justify-center gap-2 px-3 rounded text-xs font-medium transition-colors bg-[#2d2d2d] hover:bg-[#383838] border border-[#3c3c3c] text-[#cccccc] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={13} className="animate-spin text-[#007acc]" />
              <span>Analyzing Architecture...</span>
            </>
          ) : (
            <>
              <Sparkles size={13} className="text-[#007acc]" />
              <span>Run Repository Deep Analysis</span>
            </>
          )}
        </button>
      </div>

      {/* ── Analysis result (scrollable) ── */}
      {(analysisResult || isAnalyzing) && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 ide-scrollbar">
          <p className="text-[10px] uppercase tracking-wider text-[#858585] font-semibold mb-1.5">
            Architecture Report
          </p>
          {isAnalyzing && !analysisResult ? (
            <div className="flex items-center gap-2 text-[#007acc] text-xs">
              <Loader2 size={13} className="animate-spin" />
              <span>Scanning project structure and building graph...</span>
            </div>
          ) : (
            <pre className="text-xs whitespace-pre-wrap text-[#cccccc] leading-relaxed bg-[#252526] border border-[#3c3c3c] rounded p-3 font-mono">
              {analysisResult || 'No analysis result available.'}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
