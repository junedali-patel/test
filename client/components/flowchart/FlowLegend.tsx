// client/components/flowchart/FlowLegend.tsx
// Floating Legend popover explaining node shapes, edge types, and decision branches
// Clean VS Code dark theme styling

'use client';

import React, { useEffect, useRef } from 'react';
import { X, HelpCircle, GitBranch, ArrowRight, CornerDownLeft, AlertTriangle } from 'lucide-react';

interface FlowLegendProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FlowLegend({ isOpen, onClose }: FlowLegendProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px] animate-fadeIn">
      <div
        ref={panelRef}
        className="w-full max-w-xl bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-2xl overflow-hidden text-xs text-[#cccccc] select-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#1e1e1e] border-b border-[#2b2b2b]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#094771] text-[#75beff] flex items-center justify-center">
              <HelpCircle size={13} />
            </div>
            <span className="font-semibold text-white tracking-wide text-xs">
              Flowchart Symbols & Grammar
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer"
            aria-label="Close Legend"
            title="Close (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        {/* Legend Grid */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#1e1e1e]/60">
          {/* Column 1: Control Nodes */}
          <div className="space-y-2 bg-[#252526] p-2.5 rounded border border-[#333333]">
            <div className="font-semibold text-[#858585] uppercase tracking-wider text-[10px] pb-1 border-b border-[#333333]">
              Control Nodes
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-2 rounded-full bg-[#73c991] inline-block shrink-0" />
                <span className="text-[11px] text-white">START / Entry</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-2 rounded-full bg-[#f87171] inline-block shrink-0" />
                <span className="text-[11px] text-white">END / Exit</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rotate-45 border border-[#cca700] bg-[#cca700]/20 inline-block shrink-0" />
                <span className="text-[11px] text-white">DECISION (if)</span>
              </div>
            </div>
          </div>

          {/* Column 2: Execution Nodes */}
          <div className="space-y-2 bg-[#252526] p-2.5 rounded border border-[#333333]">
            <div className="font-semibold text-[#858585] uppercase tracking-wider text-[10px] pb-1 border-b border-[#333333]">
              Execution
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3 rounded bg-[#1e1e1e] border-l-2 border-l-[#58a6ff] border border-[#3c3c3c] inline-block shrink-0" />
                <span className="text-[11px] text-white">Statement</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3 rounded bg-[#1e1e1e] border-l-2 border-l-[#c084fc] border border-[#3c3c3c] inline-block shrink-0" />
                <span className="text-[11px] text-white">Function</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3 rounded bg-[#1e1e1e] border-l-2 border-l-[#818cf8] border border-[#3c3c3c] inline-block shrink-0" />
                <span className="text-[11px] text-white">Loop (for/while)</span>
              </div>
            </div>
          </div>

          {/* Column 3: I/O & Return */}
          <div className="space-y-2 bg-[#252526] p-2.5 rounded border border-[#333333]">
            <div className="font-semibold text-[#858585] uppercase tracking-wider text-[10px] pb-1 border-b border-[#333333]">
              I/O & Error
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3 rounded bg-[#1e1e1e] border-l-2 border-l-[#2dd4bf] border border-[#3c3c3c] inline-block shrink-0" />
                <span className="text-[11px] text-white">Input / Output</span>
              </div>
              <div className="flex items-center gap-2">
                <CornerDownLeft size={12} className="text-[#4ade80] shrink-0" />
                <span className="text-[11px] text-white">Return</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} className="text-[#f87171] shrink-0" />
                <span className="text-[11px] text-white">Error / Catch</span>
              </div>
            </div>
          </div>

          {/* Column 4: Branches */}
          <div className="space-y-2 bg-[#252526] p-2.5 rounded border border-[#333333]">
            <div className="font-semibold text-[#858585] uppercase tracking-wider text-[10px] pb-1 border-b border-[#333333]">
              Edge Paths
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 text-[#34d399] font-mono text-[10px] font-bold">
                <span>YES / TRUE</span>
                <ArrowRight size={10} />
              </div>
              <div className="flex items-center gap-1.5 text-[#f87171] font-mono text-[10px] font-bold">
                <span>NO / FALSE</span>
                <ArrowRight size={10} />
              </div>
              <div className="flex items-center gap-1.5 text-[#c084fc] font-mono text-[10px] font-bold">
                <span>CALLS</span>
                <ArrowRight size={10} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer info tip */}
        <div className="px-3.5 py-2 bg-[#252526] border-t border-[#2b2b2b] text-[11px] text-[#858585] flex items-center justify-between">
          <span>Click any node in graph to inspect details, flow connections, or ask Agentic Tutor.</span>
          <span className="font-mono text-[10px] text-[#cccccc]">Esc to close</span>
        </div>
      </div>
    </div>
  );
}
