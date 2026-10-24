'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertCircle,
  FileText,
  Bug,
  Brain,
  AlertTriangle,
  Info,
  CheckCircle2,
  Trash2
} from 'lucide-react';

interface PanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  analysisContent?: string;
  isAnalyzing?: boolean;
}

type BottomTab = 'problems' | 'output' | 'debug' | 'terminal' | 'analysis';

export default function Panel({ onClose, analysisContent, isAnalyzing }: PanelProps) {
  const [activeTab, setActiveTab] = useState<BottomTab>('problems');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [height, setHeight] = useState(180);
  const isDraggingRef = useRef(false);

  const tabs: Array<{ id: BottomTab; label: string; icon: React.ReactNode; badge?: string | number }> = [
    { id: 'problems', label: 'PROBLEMS', icon: <AlertCircle size={12} />, badge: 0 },
    { id: 'output', label: 'OUTPUT', icon: <FileText size={12} /> },
    { id: 'debug', label: 'DEBUG CONSOLE', icon: <Bug size={12} /> },
    { id: 'terminal', label: 'TERMINAL', icon: <Terminal size={12} /> },
  ];

  // Mouse drag resizer for bottom panel height
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startY = e.clientY;
    const startH = height;

    const onMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = startY - moveEvent.clientY;
      const newH = Math.max(100, Math.min(window.innerHeight * 0.6, startH + deltaY));
      setHeight(newH);
    };

    const onUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [height]);

  return (
    <div
      className={`shrink-0 bg-[#252526] border-t border-[#2b2b2b] flex flex-col transition-all duration-150 select-none overflow-hidden relative ${
        isCollapsed ? 'h-[30px]' : ''
      }`}
      style={!isCollapsed ? { height: `${height}px` } : undefined}
    >
      {/* ── Top Drag Handle for Resizing ── */}
      {!isCollapsed && (
        <div
          onMouseDown={startResize}
          className="absolute top-0 left-0 right-0 h-[4px] cursor-row-resize bg-transparent hover:bg-[#007acc] z-30 transition-colors"
          title="Drag to resize bottom panel"
          role="separator"
          aria-label="Resize bottom panel"
        />
      )}

      {/* ── Panel Header Bar ── */}
      <div className="h-[30px] flex items-center justify-between px-3 bg-[#252526] border-b border-[#2b2b2b] shrink-0">
        <div className="flex items-center h-full gap-0.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (isCollapsed) setIsCollapsed(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 h-full text-[11px] font-sans font-medium tracking-wide transition-colors border-b cursor-pointer ${
                  isActive && !isCollapsed
                    ? 'text-white border-[#007acc] bg-[#1e1e1e]/60 font-semibold'
                    : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#2a2d2e]/50 border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-[#3c3c3c] text-[#cccccc]">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Actions on right ── */}
        <div className="flex items-center gap-1 text-[#858585]">
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
            title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
            className="p-1 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              title="Close panel"
              className="p-1 hover:text-[#f14c4c] hover:bg-[#3c3c3c] rounded transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Panel Body ── */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-3 text-xs font-mono bg-[#1e1e1e] text-[#cccccc] min-h-0 ide-scrollbar">
          {activeTab === 'problems' && (
            <div className="space-y-2 select-text font-mono text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[#4ec9b0] shrink-0" />
                <span className="text-[#4ec9b0] font-bold">SUCCESS:</span>
                <span className="text-[#cccccc]">Linter ready. No problems detected in workspace.</span>
              </div>
              <div className="flex items-center gap-2 text-[#858585] pl-5 text-[11px]">
                <Info size={11} className="shrink-0" />
                <span>Watching for file changes... (TypeScript diagnostics active)</span>
              </div>
            </div>
          )}

          {activeTab === 'output' && (
            <div className="space-y-1.5 text-xs leading-relaxed font-mono select-text">
              <div className="flex items-center gap-2">
                <span className="text-[#75beff] font-bold">[INFO]</span>
                <span className="text-[#cccccc]">CodeMind Language Server v2.4 initialized.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#4ec9b0] font-bold">[READY]</span>
                <span className="text-[#cccccc]">AST indexer and control flow graph generator active.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#858585]">[WATCH]</span>
                <span className="text-[#858585]">Monitoring file updates across client and server.</span>
              </div>
            </div>
          )}

          {activeTab === 'debug' && (
            <div className="text-xs text-[#858585] py-1 font-mono select-text space-y-1">
              <div className="flex items-center gap-2 text-[#75beff]">
                <Bug size={12} />
                <span className="font-semibold">CodeMind Debugger session initialized</span>
              </div>
              <p className="text-[#858585]">Type any JavaScript / TypeScript expression or variable name to evaluate in context.</p>
            </div>
          )}

          {activeTab === 'terminal' && (
            <div className="space-y-1 text-xs font-mono leading-relaxed select-text">
              <p className="text-[#858585]">CodeMind Integrated Terminal (zsh)</p>
              <div className="pt-1 text-[#75beff]">
                <span>$ npm run dev</span>
              </div>
              <p className="text-[#858585]">ready - started server on 0.0.0.0:3000, url: http://localhost:3000</p>
              <p className="text-[#4ec9b0]">event - compiled client and server successfully in 842 ms</p>
              <div className="flex items-center gap-2 pt-2 text-white">
                <span className="text-[#007acc]">codemind-app</span>
                <span className="text-[#858585]">git:(</span>
                <span className="text-[#75beff]">main</span>
                <span className="text-[#858585]">)</span>
                <span className="text-[#4ec9b0]">$</span>
                <span className="w-2 h-4 bg-white animate-pulse inline-block align-middle" />
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="text-xs text-[#cccccc] leading-relaxed">
              {isAnalyzing ? (
                <div className="flex items-center gap-2 text-[#007acc]">
                  <Brain size={14} className="animate-pulse" />
                  <span>AI analyzing repository AST & control flow...</span>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-xs text-[#cccccc]">
                  {analysisContent || "Click 'Run Repository Deep Analysis' in the AI Assistant to generate an architectural report."}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
