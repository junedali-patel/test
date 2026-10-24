// client/components/flowchart/FlowNode.tsx
// Professional, readable flowchart nodes with smart labels and clear visual hierarchy

'use client';

import React from 'react';
import {
  Play,
  Square,
  Cpu,
  HelpCircle,
  RotateCw,
  Code2,
  ArrowDownToLine,
  ArrowUpFromLine,
  CornerDownLeft,
  AlertTriangle,
  FileCode2
} from 'lucide-react';
import { FlowNode as FlowNodeType } from '@/types/flowchart';

interface FlowNodeProps {
  node: FlowNodeType;
  isSelected?: boolean;
  isSearchMatch?: boolean;
  isHighlighted?: boolean;
  onClick?: (node: FlowNodeType) => void;
  onDoubleClick?: (node: FlowNodeType) => void;
}

// Derives a short human-readable title from a raw code statement
function deriveTitle(type: string, rawLabel: string): { title: string; code: string } {
  const label = rawLabel.replace(/^def\s+/, '').trim();

  switch (type) {
    case 'DECISION': {
      // Strip trailing ?
      const cond = label.replace(/\?$/, '').trim();
      return { title: 'Check Condition', code: cond };
    }
    case 'LOOP': {
      const cond = label.replace(/^Loop:\s*/i, '').trim();
      return { title: 'Loop', code: cond };
    }
    case 'INPUT': {
      // Detect Scanner / input patterns
      if (/new\s+Scanner/i.test(label))   return { title: 'Initialize Scanner',  code: label };
      if (/nextInt\s*\(/i.test(label))     return { title: 'Read Integer Input',  code: label };
      if (/nextLine\s*\(/i.test(label))    return { title: 'Read String Input',   code: label };
      if (/nextDouble\s*\(/i.test(label))  return { title: 'Read Decimal Input',  code: label };
      if (/input\s*\(/i.test(label))       return { title: 'Read User Input',     code: label };
      if (/prompt\s*\(/i.test(label))      return { title: 'Prompt User',         code: label };
      return { title: 'Read Input', code: label };
    }
    case 'OUTPUT': {
      if (/System\.out\.println/i.test(label)) return { title: 'Print Line',    code: label };
      if (/System\.out\.print/i.test(label))   return { title: 'Print',         code: label };
      if (/console\.log/i.test(label))          return { title: 'Log Output',    code: label };
      if (/print\s*\(/i.test(label))            return { title: 'Print',         code: label };
      return { title: 'Output', code: label };
    }
    case 'RETURN':
      return { title: 'Return', code: label.replace(/^return\s*/i, '').trim() || '' };
    case 'FUNCTION': {
      const name = label.split('(')[0].trim();
      return { title: name || 'Function', code: label };
    }
    case 'ERROR':
      return { title: 'Exception Handler', code: label };
    case 'PROCESS': {
      // Try to derive a natural-language title from common patterns
      if (/^\s*(?:int|long|double|float|char|boolean|String|var|let|const)\s+\w+\s*=/.test(label))
        return { title: 'Declare & Initialize', code: label };
      if (/^\s*\w[\w.]*\s*=\s*/.test(label) && !/[<>]/.test(label))
        return { title: 'Assign Value', code: label };
      if (/^\s*(?:int|long|double|float|char|boolean|String)\s+\w+/.test(label))
        return { title: 'Declare Variable', code: label };
      return { title: 'Statement', code: label };
    }
    default:
      return { title: type, code: label };
  }
}

// Truncate a code string for the node body — show first 60 chars, ellipsis if longer
function truncateCode(code: string, max = 60): string {
  if (!code) return '';
  const s = code.replace(/\s+/g, ' ').trim();
  return s.length > max ? s.substring(0, max - 1) + '…' : s;
}

export default function FlowNode({
  node,
  isSelected = false,
  isSearchMatch = false,
  isHighlighted = false,
  onClick,
  onDoubleClick
}: FlowNodeProps) {
  const { type, label, lineStart, lineEnd, file } = node;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(node);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(node);
  };

  const ring = isSelected
    ? 'ring-2 ring-[#007acc] border-[#007acc] z-30 shadow-md scale-[1.01]'
    : isSearchMatch
    ? 'ring-2 ring-[#cca700] z-20'
    : isHighlighted
    ? 'ring-2 ring-[#75beff] z-20'
    : '';

  const lineLabel = lineStart
    ? (lineEnd && lineEnd !== lineStart ? `L${lineStart}–${lineEnd}` : `L${lineStart}`)
    : null;

  // ── START ──────────────────────────────────────────────────────────────────
  if (type === 'START') {
    return (
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={`START  ${file ? '· ' + file : ''}`}
        className={`cursor-pointer flex items-center justify-center gap-3 rounded-full
          bg-[#1e1e1e] border-2 border-[#73c991] text-[#73c991] select-none
          transition-all duration-150 hover:bg-[#252526] ${ring}`}
        style={{ width: node.width ?? 180, height: node.height ?? 56 }}
      >
        <div className="w-6 h-6 rounded-full bg-[#73c991]/20 border border-[#73c991]
                        flex items-center justify-center shrink-0">
          <Play size={11} className="text-[#73c991] fill-current ml-0.5" />
        </div>
        <span className="text-xs font-semibold tracking-wider uppercase">{label || 'START'}</span>
      </div>
    );
  }

  // ── END ────────────────────────────────────────────────────────────────────
  if (type === 'END') {
    return (
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title="END"
        className={`cursor-pointer flex items-center justify-center gap-3 rounded-full
          bg-[#1e1e1e] border-2 border-[#f14c4c] text-[#f14c4c] select-none
          transition-all duration-150 hover:bg-[#252526] ${ring}`}
        style={{ width: node.width ?? 180, height: node.height ?? 56 }}
      >
        <div className="w-6 h-6 rounded-full bg-[#f14c4c]/20 border border-[#f14c4c]
                        flex items-center justify-center shrink-0">
          <Square size={9} className="text-[#f14c4c] fill-current" />
        </div>
        <span className="text-xs font-semibold tracking-wider uppercase">{label || 'END'}</span>
      </div>
    );
  }

  // ── DECISION ───────────────────────────────────────────────────────────────
  if (type === 'DECISION') {
    const cond = label.replace(/\?$/, '').trim();
    return (
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={`Condition: ${cond}`}
        className={`cursor-pointer relative flex flex-col justify-center items-center
          bg-[#252526] border-2 border-[#cca700] text-[#cccccc] select-none
          transition-all duration-150 hover:bg-[#2a2d2e] shadow-md rounded-lg ${ring}`}
        style={{
          width: node.width ?? 260,
          height: node.height ?? 110,
          clipPath: 'polygon(8% 0%, 92% 0%, 100% 50%, 92% 100%, 8% 100%, 0% 50%)',
          padding: '8px 24px'
        }}
      >
        {/* Type badge */}
        <div className="flex items-center gap-1.5 mb-1">
          <HelpCircle size={12} className="text-[#cca700] shrink-0" />
          <span className="text-[10px] font-bold text-[#cca700] uppercase tracking-wider">Condition</span>
          {lineLabel && (
            <span className="ml-1 text-[9px] font-mono text-[#858585] bg-[#1e1e1e]
                             px-1.5 py-0.5 rounded border border-[#3c3c3c]">
              {lineLabel}
            </span>
          )}
        </div>
        {/* Condition text */}
        <div className="text-xs font-mono font-medium text-white text-center leading-snug
                        overflow-hidden" style={{ maxHeight: 38, wordBreak: 'break-word' }}>
          {truncateCode(cond, 52)}
        </div>
        {/* Branch hints */}
        <div className="flex justify-between w-full px-2 mt-1.5 text-[10px] font-bold font-mono">
          <span className="text-[#73c991]">↙ YES</span>
          <span className="text-[#f14c4c]">NO ↘</span>
        </div>
      </div>
    );
  }

  // ── LOOP ───────────────────────────────────────────────────────────────────
  if (type === 'LOOP') {
    const cond = label.replace(/^Loop:\s*/i, '').trim();
    return (
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={`Loop condition: ${cond}`}
        className={`cursor-pointer relative flex flex-col justify-between
          bg-[#252526] border border-[#3c3c3c] border-l-4 border-l-[#4fc1ff] text-[#cccccc] rounded-lg
          p-3 select-none transition-all duration-150 hover:bg-[#2a2d2e] shadow-sm ${ring}`}
        style={{ width: node.width ?? 240, height: node.height ?? 88 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <RotateCw size={12} className="text-[#4fc1ff] shrink-0" />
            <span className="text-[11px] font-bold text-[#4fc1ff] uppercase tracking-wide">Loop</span>
          </div>
          {lineLabel && (
            <span className="text-[10px] font-mono text-[#858585] bg-[#1e1e1e]
                             px-1.5 py-0.5 rounded border border-[#3c3c3c]">
              {lineLabel}
            </span>
          )}
        </div>
        <div className="text-xs font-mono font-semibold text-white leading-snug
                        overflow-hidden" style={{ maxHeight: 36 }}>
          {truncateCode(cond, 48)}
        </div>
        <div className="text-[10px] text-[#858585] flex items-center gap-1">
          <RotateCw size={9} className="shrink-0 text-[#4fc1ff]" />
          <span>Repeats while true</span>
        </div>
      </div>
    );
  }

  // ── FUNCTION ───────────────────────────────────────────────────────────────
  if (type === 'FUNCTION') {
    const { title, code } = deriveTitle('FUNCTION', label);
    return (
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={`Function: ${code}`}
        className={`cursor-pointer relative flex flex-col justify-between
          bg-[#252526] border border-[#3c3c3c] border-l-4 border-l-[#b180d7] text-[#cccccc] rounded-lg
          p-3 select-none transition-all duration-150 hover:bg-[#2a2d2e] shadow-sm ${ring}`}
        style={{ width: node.width ?? 260, height: node.height ?? 88 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Code2 size={13} className="text-[#b180d7] shrink-0" />
            <span className="text-[11px] font-bold text-[#b180d7] uppercase tracking-wide">Function</span>
          </div>
          {lineLabel && (
            <span className="text-[10px] font-mono text-[#858585] bg-[#1e1e1e]
                             px-1.5 py-0.5 rounded border border-[#3c3c3c]">
              {lineLabel}
            </span>
          )}
        </div>
        <div className="text-xs font-mono font-semibold text-[#dcdcaa] leading-snug
                        overflow-hidden"
             style={{ maxHeight: 38, wordBreak: 'break-word' }}>
          {truncateCode(title !== 'Function' ? code : label.replace(/^def\s+/, ''), 44)}
        </div>
        <div className="text-[10px] text-[#858585] truncate font-mono">
          {file ? file.split(/[/\\]/).pop() : ''}
        </div>
      </div>
    );
  }

  // ── INPUT ──────────────────────────────────────────────────────────────────
  if (type === 'INPUT') {
    const { title, code } = deriveTitle('INPUT', label);
    return (
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={`Input: ${code}`}
        className={`cursor-pointer relative flex flex-col justify-between
          bg-[#252526] border border-[#3c3c3c] border-l-4 border-l-[#4ec9b0] text-[#cccccc] rounded-lg
          p-3 select-none transition-all duration-150 hover:bg-[#2a2d2e] shadow-sm ${ring}`}
        style={{
          width: node.width ?? 250,
          height: node.height ?? 84
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ArrowDownToLine size={13} className="text-[#4ec9b0] shrink-0" />
            <span className="text-[11px] font-bold text-[#4ec9b0] uppercase tracking-wide">{title}</span>
          </div>
          {lineLabel && (
            <span className="text-[10px] font-mono text-[#858585] bg-[#1e1e1e]
                             px-1.5 py-0.5 rounded border border-[#3c3c3c]">
              {lineLabel}
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-[#9cdcfe] leading-snug overflow-hidden"
             style={{ maxHeight: 36, wordBreak: 'break-word' }}>
          {truncateCode(code, 50)}
        </div>
      </div>
    );
  }

  // ── OUTPUT ─────────────────────────────────────────────────────────────────
  if (type === 'OUTPUT') {
    const { title, code } = deriveTitle('OUTPUT', label);
    return (
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={`Output: ${code}`}
        className={`cursor-pointer relative flex flex-col justify-between
          bg-[#252526] border border-[#3c3c3c] border-l-4 border-l-[#ce9178] text-[#cccccc] rounded-lg
          p-3 select-none transition-all duration-150 hover:bg-[#2a2d2e] shadow-sm ${ring}`}
        style={{
          width: node.width ?? 250,
          height: node.height ?? 84
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ArrowUpFromLine size={13} className="text-[#ce9178] shrink-0" />
            <span className="text-[11px] font-bold text-[#ce9178] uppercase tracking-wide">{title}</span>
          </div>
          {lineLabel && (
            <span className="text-[10px] font-mono text-[#858585] bg-[#1e1e1e]
                             px-1.5 py-0.5 rounded border border-[#3c3c3c]">
              {lineLabel}
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-[#ce9178] leading-snug overflow-hidden"
             style={{ maxHeight: 36, wordBreak: 'break-word' }}>
          {truncateCode(code, 50)}
        </div>
      </div>
    );
  }

  // ── RETURN ─────────────────────────────────────────────────────────────────
  if (type === 'RETURN') {
    const value = label.replace(/^return\s*/i, '').trim();
    return (
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={`Return: ${value || 'void'}`}
        className={`cursor-pointer relative flex items-center gap-3
          bg-[#252526] border border-[#73c991] text-[#cccccc]
          px-3.5 py-2.5 rounded-lg select-none transition-all duration-150 hover:bg-[#2a2d2e] shadow-sm ${ring}`}
        style={{ width: node.width ?? 220, height: node.height ?? 66 }}
      >
        <CornerDownLeft size={15} className="text-[#73c991] shrink-0" />
        <div className="flex-1 overflow-hidden">
          <div className="text-[10px] font-bold text-[#73c991] uppercase tracking-wide">Return</div>
          <div className="text-xs font-mono text-white truncate font-medium">
            {value || 'void'}
          </div>
        </div>
        {lineLabel && (
          <span className="text-[10px] font-mono text-[#858585] shrink-0">{lineLabel}</span>
        )}
      </div>
    );
  }

  // ── ERROR / EXCEPTION ──────────────────────────────────────────────────────
  if (type === 'ERROR') {
    return (
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={`Exception: ${label}`}
        className={`cursor-pointer relative flex flex-col justify-between
          bg-[#252526] border border-[#f14c4c] text-[#cccccc] rounded-lg
          p-3 select-none transition-all duration-150 hover:bg-[#2a2d2e] shadow-sm ${ring}`}
        style={{ width: node.width ?? 240, height: node.height ?? 80 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-[#f14c4c] shrink-0" />
            <span className="text-[11px] font-bold text-[#f14c4c] uppercase tracking-wide">Exception</span>
          </div>
          {lineLabel && (
            <span className="text-[10px] font-mono text-[#858585] bg-[#1e1e1e] px-1.5 py-0.5 rounded border border-[#3c3c3c]">
              {lineLabel}
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-[#f14c4c] leading-snug overflow-hidden"
             style={{ maxHeight: 36 }}>
          {truncateCode(label, 50)}
        </div>
      </div>
    );
  }

  // ── FILE (project graph) ───────────────────────────────────────────────────
  if (type === 'FILE') {
    return (
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={`File: ${file || label}`}
        className={`cursor-pointer relative flex flex-col justify-between
          bg-[#252526] border border-[#3c3c3c] border-l-4 border-l-[#007acc] text-[#cccccc] rounded-lg
          p-3 select-none transition-all duration-150 hover:bg-[#2a2d2e] shadow-sm ${ring}`}
        style={{ width: node.width ?? 260, height: node.height ?? 92 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileCode2 size={13} className="text-[#007acc] shrink-0" />
            <span className="text-[11px] font-bold text-[#007acc] uppercase tracking-wide">Source File</span>
          </div>
          {node.data?.functionCount !== undefined && (
            <span className="text-[10px] font-mono text-[#858585] bg-[#1e1e1e]
                             px-1.5 py-0.5 rounded border border-[#3c3c3c]">
              {node.data.functionCount} fn
            </span>
          )}
        </div>
        <div className="text-xs font-mono font-semibold text-white truncate">{label}</div>
        <div className="text-[10px] text-[#858585] truncate font-mono">{file || ''}</div>
      </div>
    );
  }

  // ── PROCESS (default) ──────────────────────────────────────────────────────
  const { title, code } = deriveTitle('PROCESS', label);
  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={`${title}: ${code}`}
      className={`cursor-pointer relative flex flex-col justify-between
        bg-[#252526] border border-[#3c3c3c] border-l-4 border-l-[#007acc]
        text-[#cccccc] rounded-lg
        p-3 select-none transition-all duration-150 hover:bg-[#2a2d2e] shadow-sm ${ring}`}
      style={{ width: node.width ?? 260, height: node.height ?? 84 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Cpu size={12} className="text-[#007acc] shrink-0" />
          <span className="text-[10.5px] font-bold text-[#007acc] uppercase tracking-wide">{title}</span>
        </div>
        {lineLabel && (
          <span className="text-[10px] font-mono text-[#858585] bg-[#1e1e1e]
                           px-1.5 py-0.5 rounded border border-[#3c3c3c]">
            {lineLabel}
          </span>
        )}
      </div>
      <div className="text-xs font-mono text-[#9cdcfe] font-medium leading-snug
                      overflow-hidden" style={{ maxHeight: 38, wordBreak: 'break-word' }}>
        {truncateCode(code, 55)}
      </div>
    </div>
  );
}
