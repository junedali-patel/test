'use client';

// client/components/ai/CodeExplanationPanel.tsx
// Visual Studio style code explanation panel.
// Flat dark aesthetics, language & depth toggles, copy button.

import { useState, useMemo, useEffect } from 'react';
import { Loader2, AlertCircle, Copy, Check, Languages } from 'lucide-react';
import { explainCode } from '@/services/explainApi';
import { EditorSelection, ExplainLanguage } from '@/types/voice';
import { FlowNode } from '@/types/flowchart';

interface CodeExplanationPanelProps {
  editorSelection?: EditorSelection | null;
  currentFile?: string | null;
  code?: string | null;
  language?: string | null;
  selectedNode?: FlowNode | null;
}

type Detail = 'concise' | 'detailed';

function sliceCodeFromLines(
  code: string | null | undefined,
  lineStart?: number,
  lineEnd?: number
): string {
  if (!code || !lineStart) return '';
  const lines = code.split('\n');
  const startIdx = Math.max(0, lineStart - 1);
  const end = lineEnd || lineStart;
  const endIdx = Math.min(lines.length, end);
  if (startIdx >= endIdx) return '';
  return lines.slice(startIdx, endIdx).join('\n');
}

export default function CodeExplanationPanel({
  editorSelection = null,
  currentFile = null,
  code = null,
  language = null,
  selectedNode = null,
}: CodeExplanationPanelProps) {
  const [explainLanguage, setExplainLanguage] = useState<ExplainLanguage>('en');
  const [detail, setDetail] = useState<Detail>('concise');
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resolved = useMemo(() => {
    if (editorSelection?.text?.trim()) {
      return {
        resolvedCode: editorSelection.text,
        startLine: editorSelection.lineStart,
        endLine: editorSelection.lineEnd,
      };
    }
    if (editorSelection?.lineStart && code) {
      const sliced = sliceCodeFromLines(code, editorSelection.lineStart, editorSelection.lineEnd);
      if (sliced.trim()) {
        return {
          resolvedCode: sliced,
          startLine: editorSelection.lineStart,
          endLine: editorSelection.lineEnd,
        };
      }
    }
    if (selectedNode) {
      if (selectedNode.lineStart && code) {
        const sliced = sliceCodeFromLines(code, selectedNode.lineStart, selectedNode.lineEnd);
        if (sliced.trim()) {
          return {
            resolvedCode: sliced,
            startLine: selectedNode.lineStart,
            endLine: selectedNode.lineEnd,
          };
        }
      }
      return {
        resolvedCode: selectedNode.label,
        startLine: selectedNode.lineStart,
        endLine: selectedNode.lineEnd,
      };
    }
    if (code?.trim()) {
      return {
        resolvedCode: code,
        startLine: undefined,
        endLine: undefined,
      };
    }
    return null;
  }, [editorSelection, selectedNode, code]);

  const hasContext = Boolean(resolved?.resolvedCode?.trim());

  useEffect(() => {
    setExplanation('');
    setError(null);
  }, [resolved?.resolvedCode, explainLanguage, detail]);

  const handleExplain = async () => {
    if (!resolved?.resolvedCode?.trim()) return;

    setIsLoading(true);
    setError(null);
    setExplanation('');

    try {
      const result = await explainCode({
        code: resolved.resolvedCode,
        language: language || 'plaintext',
        filePath: currentFile || 'code',
        explainLanguage,
        nodeLabel: selectedNode?.label,
        nodeType: selectedNode?.type,
        startLine: resolved.startLine,
        endLine: resolved.endLine,
      });

      if (!result.explanation || !result.explanation.trim()) {
        setError('No explanation was returned by the service.');
        return;
      }
      setExplanation(result.explanation);
    } catch (err: unknown) {
      const e = err as {
        status?: number;
        code?: string;
        message?: string;
      };
      if (e.status === 408 || e.code === 'ECONNABORTED') {
        setError('Request timed out. Please try a smaller snippet or concise mode.');
      } else if (e.status === 400) {
        setError('Bad request. Please verify the selected code snippet.');
      } else {
        setError(e.message || 'Failed to generate explanation.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!explanation) return;
    try {
      await navigator.clipboard.writeText(explanation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc] text-xs overflow-hidden">
      {/* ── Controls Section ── */}
      <div className="p-3 shrink-0 border-b border-[#2b2b2b] bg-[#252526] space-y-3">
        {/* Language Selection */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#858585] font-semibold mb-1.5">
            Explanation Language
          </p>
          <div className="flex items-center gap-2">
            <Languages size={13} className="text-[#007acc] shrink-0" />
            <div className="flex bg-[#1e1e1e] border border-[#3c3c3c] rounded p-0.5 gap-1">
              <button
                type="button"
                onClick={() => setExplainLanguage('en')}
                aria-pressed={explainLanguage === 'en'}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  explainLanguage === 'en'
                    ? 'bg-[#0e639c] text-white'
                    : 'text-[#858585] hover:text-white hover:bg-[#2a2d2e]'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setExplainLanguage('hi')}
                aria-pressed={explainLanguage === 'hi'}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  explainLanguage === 'hi'
                    ? 'bg-[#0e639c] text-white'
                    : 'text-[#858585] hover:text-white hover:bg-[#2a2d2e]'
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>
        </div>

        {/* Detail Level */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#858585] font-semibold mb-1.5">
            Depth & Detail
          </p>
          <div className="flex bg-[#1e1e1e] border border-[#3c3c3c] rounded p-0.5 gap-1 w-fit">
            <button
              type="button"
              onClick={() => setDetail('concise')}
              aria-pressed={detail === 'concise'}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                detail === 'concise'
                  ? 'bg-[#0e639c] text-white'
                  : 'text-[#858585] hover:text-white hover:bg-[#2a2d2e]'
              }`}
            >
              Concise
            </button>
            <button
              type="button"
              onClick={() => setDetail('detailed')}
              aria-pressed={detail === 'detailed'}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                detail === 'detailed'
                  ? 'bg-[#0e639c] text-white'
                  : 'text-[#858585] hover:text-white hover:bg-[#2a2d2e]'
              }`}
            >
              Detailed Breakdown
            </button>
          </div>
        </div>

        {/* Context Summary */}
        {resolved && (
          <div className="flex flex-wrap gap-1.5 items-center pt-1">
            {currentFile && (
              <span className="font-mono text-[10px] bg-[#1e1e1e] border border-[#3c3c3c] rounded px-1.5 py-0.5 text-[#9cdcfe] truncate max-w-[12rem]">
                {currentFile}
              </span>
            )}
            {resolved.startLine != null && (
              <span className="text-[10px] bg-[#1e1e1e] border border-[#3c3c3c] rounded px-1.5 py-0.5 text-[#858585]">
                L{resolved.startLine}
                {resolved.endLine && resolved.endLine !== resolved.startLine
                  ? `–${resolved.endLine}`
                  : ''}
              </span>
            )}
            {language && (
              <span className="text-[10px] bg-[#1e1e1e] border border-[#3c3c3c] rounded px-1.5 py-0.5 text-[#75beff]">
                {language}
              </span>
            )}
          </div>
        )}

        {/* Explain Button */}
        <button
          type="button"
          onClick={handleExplain}
          disabled={!hasContext || isLoading}
          className="w-full h-[32px] flex items-center justify-center gap-2 px-3 rounded text-xs font-medium transition-colors bg-[#0e639c] hover:bg-[#1177bb] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 size={13} className="animate-spin text-white" />
              <span>Generating Explanation...</span>
            </>
          ) : (
            <>
              <Languages size={13} />
              <span>Explain Selected Code</span>
            </>
          )}
        </button>
      </div>

      {/* ── Explanation Area ── */}
      <div className="flex-1 min-h-0 overflow-y-auto ide-scrollbar bg-[#1e1e1e]">
        {!hasContext && !isLoading && !explanation && !error && (
          <p className="p-4 text-[#858585] text-center">
            Select code in the editor or click a flowchart node to generate an explanation.
          </p>
        )}

        {isLoading && (
          <div className="p-4 flex items-center gap-2.5 text-[#007acc]">
            <Loader2 size={14} className="animate-spin" />
            <span>Analyzing syntax and generating walkthrough...</span>
          </div>
        )}

        {error && (
          <div className="m-3 flex items-start gap-2 p-2.5 rounded bg-[#5a1d1d]/40 border border-[#f14c4c]/40 text-[#f14c4c]">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {explanation && !isLoading && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-[#858585] font-semibold">
                Explanation Result
              </p>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy explanation"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-[#252526] hover:bg-[#2a2d2e] border border-[#3c3c3c] text-[#cccccc] hover:text-white transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={11} className="text-[#73c991]" />
                    <span className="text-[#73c991]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-words text-[#cccccc] leading-relaxed p-3 rounded bg-[#252526] border border-[#3c3c3c] text-xs font-mono">
              {explanation}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
