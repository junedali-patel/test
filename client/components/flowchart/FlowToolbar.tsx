// client/components/flowchart/FlowToolbar.tsx
// Sleek, structured flowchart toolbar with unified control groups, clear tooltips,
// no visual clutter, and accessible keyboard navigation

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FileCode,
  Code2,
  FolderGit2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  X,
  Map,
  RefreshCw,
  ChevronDown,
  Check,
  Filter,
  SlidersHorizontal,
  Loader2,
  HelpCircle,
  Scan
} from 'lucide-react';
import { FlowchartViewMode, GraphLevel, FlowFilter } from '@/types/flowchart';

interface FlowToolbarProps {
  viewMode: FlowchartViewMode;
  onViewModeChange: (mode: FlowchartViewMode) => void;
  functions?: string[];
  selectedFunction?: string | null;
  onSelectFunction?: (funcName: string) => void;
  graphLevel?: GraphLevel;
  onGraphLevelChange?: (level: GraphLevel) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onResetZoom: () => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
  onRefresh: () => void;
  isAnalyzing?: boolean;
  fileName?: string | null;
  detailLevel?: 'overview' | 'standard' | 'detailed';
  onDetailLevelChange?: (level: 'overview' | 'standard' | 'detailed') => void;
  activeFilter?: FlowFilter;
  onFilterChange?: (filter: FlowFilter) => void;
  counts?: {
    all: number;
    decisions?: number;
    loops?: number;
    functions?: number;
    calls?: number;
    files?: number;
    dependencies?: number;
  };
  onResetLayout?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onToggleLegend?: () => void;
  isLegendOpen?: boolean;
}

export default function FlowToolbar({
  viewMode,
  onViewModeChange,
  functions = [],
  selectedFunction = null,
  onSelectFunction,
  graphLevel = 'combined',
  onGraphLevelChange,
  searchQuery,
  onSearchChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetZoom,
  showMinimap,
  onToggleMinimap,
  onRefresh,
  isAnalyzing = false,
  fileName, // eslint-disable-line @typescript-eslint/no-unused-vars
  detailLevel = 'standard',
  onDetailLevelChange,
  activeFilter = 'ALL',
  onFilterChange,
  counts = { all: 0 },
  onResetLayout,
  isFullscreen = false,
  onToggleFullscreen,
  onToggleLegend,
  isLegendOpen = false
}: FlowToolbarProps) {
  // Dropdown states
  const [detailDropdownOpen, setDetailDropdownOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [functionDropdownOpen, setFunctionDropdownOpen] = useState(false);

  // Click outside ref handling
  const detailRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const fnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (detailRef.current && !detailRef.current.contains(event.target as Node)) {
        setDetailDropdownOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterDropdownOpen(false);
      }
      if (fnRef.current && !fnRef.current.contains(event.target as Node)) {
        setFunctionDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const detailOptions: Array<{
    id: 'overview' | 'standard' | 'detailed';
    label: string;
    description: string;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      description: 'Major control structures only (Entry, Decisions, Loops)'
    },
    {
      id: 'standard',
      label: 'Standard',
      description: 'Balanced control flow graph (default)'
    },
    {
      id: 'detailed',
      label: 'Detailed',
      description: 'All nodes including minor assignments & expressions'
    }
  ];

  const isProjectMode = viewMode === 'project';
  const filterOptions: Array<{ id: FlowFilter; label: string; count?: number }> = isProjectMode
    ? [
        { id: 'ALL', label: 'All Elements', count: counts.all },
        { id: 'FILES', label: 'Files', count: counts.files },
        { id: 'FUNCTIONS', label: 'Functions', count: counts.functions },
        { id: 'CALLS', label: 'Cross-Calls', count: counts.calls },
        { id: 'DEPENDENCIES', label: 'Dependencies', count: counts.dependencies }
      ]
    : [
        { id: 'ALL', label: 'All Nodes', count: counts.all },
        { id: 'DECISIONS', label: 'Decisions', count: counts.decisions },
        { id: 'LOOPS', label: 'Loops', count: counts.loops },
        { id: 'FUNCTIONS', label: 'Functions', count: counts.functions },
        { id: 'CALLS', label: 'Invocations', count: counts.calls }
      ];

  const currentDetailLabel =
    detailOptions.find(o => o.id === detailLevel)?.label || 'Standard';
  const currentFilterLabel =
    filterOptions.find(o => o.id === activeFilter)?.label || 'All';

  return (
    <div className="flex flex-col bg-[#252526] border-b border-[#2b2b2b] select-none text-xs">
      {/* ── ROW 1: Scope, Detail, Filters, Legend, Status ── */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[#2b2b2b]/80 flex-wrap">
        {/* Left: Scope Selection & Contextual Selectors */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Segmented View Mode Buttons */}
          <div className="flex items-center p-0.5 bg-[#1e1e1e] rounded border border-[#3c3c3c]">
            <button
              type="button"
              onClick={() => onViewModeChange('file')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'file'
                  ? 'bg-[#0e639c] text-white shadow-sm'
                  : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#2a2d2e]'
              }`}
              title="File Control Flow: Inspect control flow of active file"
            >
              <FileCode size={12} className={viewMode === 'file' ? 'text-white' : 'text-[#58a6ff]'} />
              <span>File</span>
            </button>

            <button
              type="button"
              onClick={() => onViewModeChange('function')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'function'
                  ? 'bg-[#0e639c] text-white shadow-sm'
                  : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#2a2d2e]'
              }`}
              title="Function Scope: Isolate specific function execution"
            >
              <Code2 size={12} className={viewMode === 'function' ? 'text-white' : 'text-[#73c991]'} />
              <span>Function</span>
            </button>

            <button
              type="button"
              onClick={() => onViewModeChange('project')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'project'
                  ? 'bg-[#0e639c] text-white shadow-sm'
                  : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#2a2d2e]'
              }`}
              title="Project Architecture: Global repository architecture & dependencies"
            >
              <FolderGit2 size={12} className={viewMode === 'project' ? 'text-white' : 'text-[#cca700]'} />
              <span>Project</span>
            </button>
          </div>

          {/* Function Selector (when viewMode is 'function') */}
          {viewMode === 'function' && (
            <div className="relative shrink-0" ref={fnRef}>
              <button
                type="button"
                onClick={() => setFunctionDropdownOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2d2e] border border-[#3c3c3c] text-[#cccccc] font-medium text-xs transition-colors cursor-pointer"
                title="Select target function"
              >
                <span className="text-[10px] text-[#73c991] font-mono font-bold">fn:</span>
                <span className="text-white font-mono truncate max-w-[120px]">
                  {selectedFunction || 'All Functions'}
                </span>
                <ChevronDown size={11} className={`text-[#858585] transition-transform ${functionDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {functionDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-[#252526] border border-[#3c3c3c] rounded shadow-xl py-1 z-50 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectFunction?.('all');
                      setFunctionDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left hover:bg-[#2a2d2e] flex items-center justify-between cursor-pointer ${
                      !selectedFunction || selectedFunction === 'all' ? 'text-[#75beff] font-semibold' : 'text-[#cccccc]'
                    }`}
                  >
                    <span>All Functions</span>
                    {(!selectedFunction || selectedFunction === 'all') && <Check size={12} />}
                  </button>
                  {functions.map(fn => (
                    <button
                      key={fn}
                      type="button"
                      onClick={() => {
                        onSelectFunction?.(fn);
                        setFunctionDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left font-mono hover:bg-[#2a2d2e] flex items-center justify-between cursor-pointer truncate ${
                        selectedFunction === fn ? 'text-[#75beff] font-semibold' : 'text-[#cccccc]'
                      }`}
                    >
                      <span className="truncate">{fn}()</span>
                      {selectedFunction === fn && <Check size={12} className="shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Project Level Selector (when viewMode is 'project') */}
          {viewMode === 'project' && onGraphLevelChange && (
            <div className="flex items-center gap-0.5 p-0.5 bg-[#1e1e1e] rounded border border-[#3c3c3c] shrink-0">
              {(['file', 'function', 'combined'] as const).map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onGraphLevelChange(lvl)}
                  className={`px-2 py-0.5 text-xs rounded capitalize transition-colors font-medium cursor-pointer ${
                    graphLevel === lvl
                      ? 'bg-[#0e639c] text-white'
                      : 'text-[#858585] hover:text-white'
                  }`}
                  title={`Project graph level: ${lvl}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          )}

          {/* Detail Level Dropdown (File & Function modes) */}
          {viewMode !== 'project' && onDetailLevelChange && (
            <div className="relative shrink-0" ref={detailRef}>
              <button
                type="button"
                onClick={() => {
                  setDetailDropdownOpen(prev => !prev);
                  setFilterDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2d2e] border border-[#3c3c3c] text-[#cccccc] font-medium text-xs transition-colors cursor-pointer"
                title="Graph detail level"
                aria-expanded={detailDropdownOpen}
              >
                <SlidersHorizontal size={11} className="text-[#007acc]" />
                <span className="text-[#858585]">
                  Detail: <strong className="font-semibold text-white ml-0.5">{currentDetailLabel}</strong>
                </span>
                <ChevronDown size={11} className={`text-[#858585] transition-transform ${detailDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {detailDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-[#252526] border border-[#3c3c3c] rounded shadow-xl py-1 z-50 text-xs">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#858585] border-b border-[#2b2b2b] mb-1">
                    Detail Granularity
                  </div>
                  {detailOptions.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onDetailLevelChange(option.id);
                        setDetailDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[#2a2d2e] transition-colors cursor-pointer ${
                        detailLevel === option.id ? 'text-[#75beff] bg-[#094771]/30 font-semibold' : 'text-[#cccccc]'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-white">{option.label}</div>
                        <div className="text-[10px] text-[#858585]">{option.description}</div>
                      </div>
                      {detailLevel === option.id && <Check size={12} className="text-[#75beff] shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filter Dropdown */}
          {onFilterChange && (
            <div className="relative shrink-0" ref={filterRef}>
              <button
                type="button"
                onClick={() => {
                  setFilterDropdownOpen(prev => !prev);
                  setDetailDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium transition-colors cursor-pointer ${
                  activeFilter !== 'ALL'
                    ? 'bg-[#094771] border-[#007acc] text-white'
                    : 'bg-[#1e1e1e] hover:bg-[#2a2d2e] border-[#3c3c3c] text-[#cccccc]'
                }`}
                title="Filter flowchart nodes by type"
                aria-expanded={filterDropdownOpen}
              >
                <Filter size={11} className={activeFilter !== 'ALL' ? 'text-[#75beff]' : 'text-[#858585]'} />
                <span className="text-[#858585]">
                  {activeFilter !== 'ALL' ? (
                    <>Filter: <strong className="font-semibold text-white ml-0.5">{currentFilterLabel}</strong></>
                  ) : (
                    'Filter'
                  )}
                </span>
                <ChevronDown size={11} className={`text-[#858585] transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {filterDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-[#252526] border border-[#3c3c3c] rounded shadow-xl py-1 z-50 text-xs">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#858585] border-b border-[#2b2b2b] mb-1 flex items-center justify-between">
                    <span>Filter Nodes</span>
                    {activeFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => {
                          onFilterChange('ALL');
                          setFilterDropdownOpen(false);
                        }}
                        className="text-[10px] text-[#007acc] hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  {filterOptions.map(option => {
                    const isActive = activeFilter === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          onFilterChange(option.id);
                          setFilterDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[#2a2d2e] transition-colors cursor-pointer ${
                          isActive ? 'text-[#75beff] bg-[#094771]/30 font-semibold' : 'text-[#cccccc]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{option.label}</span>
                          {option.count !== undefined && option.count > 0 && (
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                                isActive ? 'bg-[#007acc] text-white' : 'bg-[#1e1e1e] text-[#858585] border border-[#3c3c3c]'
                              }`}
                            >
                              {option.count}
                            </span>
                          )}
                        </div>
                        {isActive && <Check size={12} className="text-[#75beff] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Legend button, Status & Fullscreen */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* AST Analyzer status */}
          {isAnalyzing && (
            <div className="flex items-center gap-1.5 text-xs text-[#007acc] px-2 py-0.5 rounded bg-[#1e1e1e] border border-[#3c3c3c]">
              <Loader2 size={12} className="animate-spin text-[#007acc]" />
              <span className="text-[10px] font-medium hidden sm:inline">Analyzing AST…</span>
            </div>
          )}

          {/* Legend toggle button */}
          {onToggleLegend && (
            <button
              type="button"
              onClick={onToggleLegend}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer border ${
                isLegendOpen
                  ? 'bg-[#0e639c] text-white border-[#007acc]'
                  : 'bg-[#1e1e1e] hover:bg-[#2a2d2e] border-[#3c3c3c] text-[#858585] hover:text-white'
              }`}
              title="Symbols & Legend (shapes, colors, grammar)"
              aria-label="Flowchart Symbols Legend"
            >
              <HelpCircle size={12} />
              <span className="hidden sm:inline text-[11px]">Legend</span>
            </button>
          )}

          {/* Refresh Flowchart Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isAnalyzing}
            title="Refresh flowchart analysis"
            aria-label="Refresh flowchart analysis"
            className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded transition-colors disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw size={13} className={isAnalyzing ? 'animate-spin text-[#007acc]' : ''} />
          </button>

          {/* Fullscreen Toggle Button */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen View'}
              aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isFullscreen
                  ? 'text-[#007acc] bg-[#1e1e1e] border border-[#007acc]'
                  : 'text-[#858585] hover:text-white hover:bg-[#3c3c3c]'
              }`}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* ── ROW 2: Search input & Canvas Zoom / Navigation Controls ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e1e]">
        {/* Compact Search Field */}
        <div className="relative flex-1 min-w-[140px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#858585]" />
          <input
            type="text"
            placeholder="Search nodes in graph…"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full h-[26px] bg-[#252526] border border-[#3c3c3c] rounded pl-7 pr-7 text-xs text-[#cccccc] placeholder-[#858585] focus:border-[#007acc] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#858585] hover:text-white cursor-pointer"
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Zoom and Screen Controls Group */}
        <div className="flex items-center gap-0.5 bg-[#252526] p-0.5 rounded border border-[#3c3c3c] shrink-0">
          <button
            type="button"
            onClick={onZoomOut}
            title="Zoom out (-)"
            aria-label="Zoom out"
            className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded transition-colors cursor-pointer"
          >
            <ZoomOut size={13} />
          </button>

          <button
            type="button"
            onClick={onResetZoom}
            title="Reset zoom to 100%"
            aria-label="Reset zoom to 100%"
            className="min-w-[36px] px-1 text-center py-0.5 text-[10px] font-mono text-[#cccccc] hover:text-white hover:bg-[#3c3c3c] rounded transition-colors cursor-pointer font-medium"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={onZoomIn}
            title="Zoom in (+)"
            aria-label="Zoom in"
            className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded transition-colors cursor-pointer"
          >
            <ZoomIn size={13} />
          </button>

          <div className="w-px h-3 bg-[#3c3c3c] mx-0.5" />

          <button
            type="button"
            onClick={onFitToScreen}
            title="Fit graph to viewport"
            aria-label="Fit graph to viewport"
            className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded transition-colors cursor-pointer"
          >
            <Scan size={13} />
          </button>

          {onResetLayout && (
            <button
              type="button"
              onClick={onResetLayout}
              title="Reset node positions (Auto-layout)"
              aria-label="Reset layout"
              className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMinimap}
            title={showMinimap ? 'Hide minimap' : 'Show minimap'}
            aria-label="Toggle minimap"
            className={`p-1 rounded transition-colors cursor-pointer ${
              showMinimap ? 'text-white bg-[#0e639c]' : 'text-[#858585] hover:text-white hover:bg-[#3c3c3c]'
            }`}
          >
            <Map size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
