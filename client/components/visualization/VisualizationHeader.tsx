// client/components/visualization/VisualizationHeader.tsx
// Sleek, compact single-row header for switching between Flowchart & Mind Map

'use client';

import React from 'react';
import { GitBranch, Activity, FileCode, Maximize2, Minimize2, RefreshCw } from 'lucide-react';

interface VisualizationHeaderProps {
  activeTab: 'flowchart' | 'mindmap';
  onTabChange: (tab: 'flowchart' | 'mindmap') => void;
  fileName?: string | null;
  onRefresh?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export default function VisualizationHeader({
  activeTab,
  onTabChange,
  fileName,
  onRefresh,
  isFullscreen = false,
  onToggleFullscreen,
}: VisualizationHeaderProps) {
  return (
    <div className="h-[36px] px-3 bg-[#252526] border-b border-[#2b2b2b] flex items-center justify-between shrink-0 select-none text-xs">
      {/* Left: Visualization Mode Tabs */}
      <div className="flex items-center gap-1">
        <div
          role="tablist"
          aria-label="Code visualization modes"
          className="flex items-center p-0.5 bg-[#1e1e1e] rounded border border-[#3c3c3c]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'flowchart'}
            onClick={() => onTabChange('flowchart')}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'flowchart'
                ? 'bg-[#0e639c] text-white shadow-sm'
                : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#2a2d2e]'
            }`}
            title="Interactive Control Flow Graph"
          >
            <GitBranch size={12} className={activeTab === 'flowchart' ? 'text-white' : 'text-[#858585]'} />
            <span>Flowchart</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mindmap'}
            onClick={() => onTabChange('mindmap')}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'mindmap'
                ? 'bg-[#0e639c] text-white shadow-sm'
                : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#2a2d2e]'
            }`}
            title="Repository Mind Map & Architecture"
          >
            <Activity size={12} className={activeTab === 'mindmap' ? 'text-white' : 'text-[#858585]'} />
            <span>Mind Map</span>
          </button>
        </div>
      </div>

      {/* Center: File badge */}
      {fileName && (
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[#858585] bg-[#1e1e1e] border border-[#3c3c3c] px-2 py-0.5 rounded max-w-[220px] truncate">
          <FileCode size={11} className="text-[#007acc] shrink-0" />
          <span className="truncate">{fileName}</span>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
            title="Refresh Visualization"
            aria-label="Refresh Visualization"
          >
            <RefreshCw size={13} />
          </button>
        )}

        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isFullscreen
                ? 'text-[#007acc] bg-[#1e1e1e] border border-[#007acc]'
                : 'text-[#858585] hover:text-white hover:bg-[#333333]'
            }`}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen View'}
            aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
