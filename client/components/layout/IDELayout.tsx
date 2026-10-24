'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
  useMemo,
} from 'react';
import StatusBar from './StatusBar';
import Panel from './Panel';
import EditorTabs, { type EditorTab } from './EditorTabs';
import ActivityBar from './ActivityBar';
import AIAssistantPanel from '../ai/AIAssistantPanel';
import ExplorerView, { type FileNode } from '../views/ExplorerView';
import SearchView from '../views/SearchView';
import GitView from '../views/GitView';
import SettingsView from '../views/SettingsView';
import type { FlowNode } from '@/types/flowchart';
import type { EditorSelection } from '@/types/voice';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Search,
  FilePlus,
  X,
  Network,
  MoreHorizontal,
  Minus,
  Square
} from 'lucide-react';

interface IDELayoutProps {
  children?: ReactNode;
  tabs?: EditorTab[];
  activeTabId?: string;
  onTabClick?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onNewTab?: () => void;

  analysisPanel?: {
    content: string;
    isAnalyzing?: boolean;
    onClose: () => void;
  };

  files?: FileNode[];
  expandedDirs?: Record<string, boolean>;
  onFileClick?: (file: FileNode) => void;
  onDirToggle?: (path: string) => void;
  selectedFile?: FileNode | null;
  /** When true, shows a skeleton loader in the file explorer */
  isTreeLoading?: boolean;

  visualizationContent?: ReactNode;

  selectedFlowNode?: FlowNode | null;
  editorSelection?: EditorSelection | null;
  code?: string | null;
  fileName?: string | null;
  language?: string | null;
  sessionId?: string | null;
  onClearSelectedNode?: () => void;
  onNavigateToCode?: (
    file: string,
    lineStart: number,
    lineEnd?: number
  ) => void;
  onApplySuggestion?: (suggestion: string) => void;
  onAnalyzeRepo?: () => void;
  isAnalyzing?: boolean;
  analysisResult?: string;
  repoAvailable?: boolean;

  statusBarProps?: {
    line?: number;
    column?: number;
    language?: string;
    branch?: string;
    aiStatus?: 'idle' | 'processing' | 'ready';
  };

  repoOwner?: string;
  repoName?: string;
}

export default function IDELayout({
  children,
  files = [],
  expandedDirs = {},
  onFileClick = () => {},
  onDirToggle = () => {},
  selectedFile = null,
  isTreeLoading = false,
  tabs = [],
  activeTabId = '',
  onTabClick = () => {},
  onTabClose = () => {},
  onNewTab,
  analysisPanel,
  statusBarProps = {},
  visualizationContent,
  selectedFlowNode = null,
  editorSelection = null,
  code = '',
  fileName = 'CodeEditor.tsx',
  language = 'typescript',
  sessionId = null,
  onClearSelectedNode = () => {},
  onNavigateToCode,
  onApplySuggestion = () => {},
  onAnalyzeRepo = () => {},
  isAnalyzing = false,
  analysisResult = '',
  repoAvailable = false,
  repoOwner = 'codemind',
  repoName = 'core',
}: IDELayoutProps) {
  // Proportions matching ~1670x900 viewport: left ~335px, right ~440px
  const [leftWidth, setLeftWidth] = useState(335);
  const [rightWidth, setRightWidth] = useState(440);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [activeActivityView, setActiveActivityView] = useState('explorer');

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w >= 1440) {
        setLeftWidth(Math.min(360, Math.max(320, Math.round(w * 0.22))));
        setRightWidth(Math.min(460, Math.max(400, Math.round(w * 0.27))));
      } else if (w >= 1100) {
        setLeftWidth(320);
        setRightWidth(380);
      } else if (w < 960) {
        setRightCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut listener for ⌘K search and ⌘⇧I / Ctrl+Shift+I AI Assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setRightCollapsed((prev) => {
          if (prev) {
            setRightWidth((w) => Math.max(380, w));
          }
          return !prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Drag resizers
  const isDraggingRef = useRef<'left' | 'right' | null>(null);

  const startResize = useCallback((side: 'left' | 'right') => {
    isDraggingRef.current = side;

    const onMove = (e: MouseEvent) => {
      const maxW = Math.max(450, Math.floor(window.innerWidth * 0.36));
      if (side === 'left') {
        setLeftWidth((w) => Math.min(maxW, Math.max(280, w + e.movementX)));
      } else {
        setRightWidth((w) => Math.min(maxW, Math.max(340, w - e.movementX)));
      }
    };

    const onUp = () => {
      isDraggingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Flattened file list for quick search filtering
  const allFlattenedFiles = useMemo(() => {
    const list: FileNode[] = [];
    const traverse = (nodes: FileNode[]) => {
      for (const node of nodes) {
        list.push(node);
        if (node.children) traverse(node.children);
      }
    };
    traverse(files);
    return list;
  }, [files]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allFlattenedFiles
      .filter((f) => f.type === 'file' && f.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allFlattenedFiles, searchQuery]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-[#cccccc] overflow-hidden select-none relative font-sans">
      {/* ── VISUAL STUDIO TOP TITLE BAR ── */}
      <header className="h-[32px] shrink-0 bg-[#1e1e1e] border-b border-[#2b2b2b] flex items-center justify-between px-3 z-30 select-none">
        {/* Left: Classic Menu items */}
        <div className="flex items-center gap-0.5 text-xs text-[#969696]">
          <button type="button" className="px-2 py-0.5 rounded text-xs hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer">File</button>
          <button type="button" className="px-2 py-0.5 rounded text-xs hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer">Edit</button>
          <button type="button" className="px-2 py-0.5 rounded text-xs hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer">Selection</button>
          <button type="button" className="px-2 py-0.5 rounded text-xs hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer">View</button>
          <button type="button" className="px-2 py-0.5 rounded text-xs hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer">Go</button>
        </div>

        {/* Center: Command Palette / Active Window Title */}
        <div className="relative flex items-center justify-center min-w-[240px] max-w-[420px]">
          <div
            onClick={() => {
              setIsSearchFocused(true);
              searchInputRef.current?.focus();
            }}
            className="w-full h-[22px] flex items-center justify-center gap-1.5 px-3 rounded bg-[#252526] border border-[#3c3c3c] hover:border-[#4a4a4a] text-xs text-[#cccccc] cursor-pointer transition-colors"
          >
            <Search size={11} className="text-[#858585]" />
            <span className="font-mono text-[11px] text-[#cccccc] truncate">
              {repoName || 'codemind1'} — {activeTabId ? activeTabId.split('/').pop() : fileName || 'App.tsx'}
            </span>
          </div>

          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            className="sr-only"
            aria-label="Search files"
          />

          {/* Quick Search Dropdown Results */}
          {isSearchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#252526] border border-[#3c3c3c] rounded shadow-2xl z-50 overflow-hidden divide-y divide-[#2b2b2b]">
              {searchResults.map((f) => (
                <div
                  key={f.id}
                  onClick={() => {
                    onFileClick(f);
                    setSearchQuery('');
                  }}
                  className="px-3 py-1.5 hover:bg-[#094771] hover:text-white flex items-center justify-between text-xs cursor-pointer transition-colors"
                >
                  <span className="font-mono text-[#cccccc]">{f.name}</span>
                  <span className="text-[10px] text-[#858585] font-mono">Open</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center gap-3 text-[#969696]">
          <button className="hover:text-white transition-colors cursor-pointer" title="Minimize">
            <Minus size={13} />
          </button>
          <button className="hover:text-white transition-colors cursor-pointer" title="Maximize">
            <Square size={11} />
          </button>
          <button className="hover:text-[#f14c4c] transition-colors cursor-pointer" title="Close">
            <X size={13} />
          </button>
        </div>
      </header>

      {/* ── MAIN THREE-COLUMN FLUSH WORKSPACE ── */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative bg-[#1e1e1e]">
        {/* ── 1. NARROW ACTIVITY BAR ── */}
        <ActivityBar
          activeView={activeActivityView}
          isAIOpen={!rightCollapsed}
          onViewChange={(view) => {
            if (view === 'ai') {
              setRightCollapsed((prev) => {
                const willOpen = prev;
                if (willOpen) {
                  setRightWidth((w) => Math.max(380, w));
                }
                return !prev;
              });
              return;
            }
            setActiveActivityView(view);
            if (leftCollapsed) setLeftCollapsed(false);
          }}
          onOpenSettings={() => setActiveActivityView('settings')}
          userLogin={repoOwner}
        />

        {/* ── 2. LEFT PANEL: EXPLORER & PROJECT VISUALIZATION ── */}
        <div
          className="ide-panel flex flex-col shrink-0 overflow-hidden transition-all duration-150 bg-[#252526] border-r border-[#2b2b2b]"
          style={{ width: leftCollapsed ? 32 : leftWidth }}
        >
          {leftCollapsed ? (
            /* Left Collapsed Strip */
            <div className="flex flex-col items-center py-3 gap-4 h-full bg-[#252526]">
              <button
                onClick={() => setLeftCollapsed(false)}
                aria-label="Expand Left Panel"
                className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#2a2d2e] transition-colors"
              >
                <ChevronRight size={15} />
              </button>
              <div
                onClick={() => setLeftCollapsed(false)}
                className="text-[10px] uppercase tracking-widest text-[#858585] hover:text-white font-semibold cursor-pointer select-none py-2"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                Explorer
              </div>
            </div>
          ) : (
            <>
              {activeActivityView === 'search' ? (
                <div className="h-full bg-[#252526] overflow-hidden">
                  <SearchView />
                </div>
              ) : activeActivityView === 'git' ? (
                <div className="h-full bg-[#252526] overflow-hidden">
                  <GitView />
                </div>
              ) : activeActivityView === 'visualization' ? (
                /* INDEPENDENT FULL-HEIGHT FLOWCHART & ARCHITECTURE PANEL */
                <div className="h-full flex flex-col overflow-hidden bg-[#1e1e1e]">
                  {visualizationContent ?? (
                    <div className="flex items-center justify-center h-full text-center flex-col opacity-60 p-4">
                      <Network size={24} className="text-[#007acc] mb-2" />
                      <p className="text-[#858585] text-xs">
                        Select a file to inspect graph architecture
                      </p>
                    </div>
                  )}
                </div>
              ) : activeActivityView === 'extensions' ? (
                <div className="h-full bg-[#252526] overflow-hidden p-3 flex flex-col">
                  <div className="h-[35px] flex items-center justify-between border-b border-[#2b2b2b] shrink-0 mb-2">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-[#bbbbbb]">EXTENSIONS</span>
                  </div>
                  <div className="text-xs text-[#858585] py-2">
                    Installed Extensions & Tools
                  </div>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded bg-[#1e1e1e] border border-[#3c3c3c]">
                      <div className="text-xs font-semibold text-white">CodeMind AI Assistant</div>
                      <div className="text-[10px] text-[#858585]">Next-gen AI code synthesis & reasoning</div>
                    </div>
                    <div className="p-2.5 rounded bg-[#1e1e1e] border border-[#3c3c3c]">
                      <div className="text-xs font-semibold text-white">Interactive Flowchart Engine</div>
                      <div className="text-[10px] text-[#858585]">Interactive AST control-flow visualizer</div>
                    </div>
                  </div>
                </div>
              ) : activeActivityView === 'settings' ? (
                <div className="h-full bg-[#252526] overflow-hidden">
                  <SettingsView />
                </div>
              ) : (
                /* DEFAULT: FULL-HEIGHT EXPLORER MATCHING VS CODE SCREENSHOT */
                <div className="flex flex-col h-full overflow-hidden bg-[#252526]">
                  {/* Explorer Header */}
                  <div className="h-[35px] flex items-center justify-between px-3 bg-[#252526] border-b border-[#2b2b2b] shrink-0">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-[#bbbbbb]">
                      EXPLORER
                    </span>

                    <div className="flex items-center gap-1 text-[#858585]">
                      <button
                        onClick={onNewTab}
                        className="p-1 hover:text-white hover:bg-[#2a2d2e] rounded transition-colors cursor-pointer"
                        title="New File"
                      >
                        <FilePlus size={13} />
                      </button>
                      <button
                        onClick={() => setLeftCollapsed(true)}
                        className="p-1 hover:text-white hover:bg-[#2a2d2e] rounded transition-colors cursor-pointer"
                        title="Collapse Explorer"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        className="p-1 hover:text-white hover:bg-[#2a2d2e] rounded transition-colors cursor-pointer"
                        title="More Actions..."
                      >
                        <MoreHorizontal size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Root project collapsible section header: e.g. CODEMIND1 */}
                  <div className="px-2 py-1 bg-[#252526] border-b border-[#2b2b2b]/40 flex items-center gap-1 text-xs font-semibold text-[#cccccc] cursor-pointer hover:bg-[#2a2d2e] select-none shrink-0">
                    <ChevronDown size={14} className="text-[#858585]" />
                    <span className="uppercase tracking-wider font-bold text-[11px]">
                      {repoName?.toUpperCase() || 'CODEMIND1'}
                    </span>
                  </div>

                  {/* Explorer Tree Content - Full Height */}
                  <div className="flex-1 overflow-y-auto ide-scrollbar p-1 bg-[#252526]">
                    {isTreeLoading ? (
                      <div className="flex items-center gap-2 px-3 py-4 text-[#858585]">
                        <Loader2 size={13} className="animate-spin text-[#007acc]" />
                        <span className="text-xs font-mono">Loading files…</span>
                      </div>
                    ) : (
                      <ExplorerView
                        files={files}
                        expandedDirs={expandedDirs}
                        onFileClick={onFileClick}
                        onDirToggle={onDirToggle}
                        selectedFile={selectedFile}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── LEFT RESIZE HANDLE ── */}
        {!leftCollapsed && (
          <div
            className="w-[3px] hover:w-[4px] bg-[#2b2b2b] hover:bg-[#007acc] cursor-col-resize transition-all shrink-0 select-none z-20"
            onMouseDown={() => startResize('left')}
            role="separator"
            aria-label="Resize left panel"
          />
        )}

        {/* ── 3. CENTRAL CODE EDITOR & INTEGRATED BOTTOM TERMINAL ── */}
        <div className="ide-panel flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden min-w-[380px]">
          {/* Editor Tabs & File Breadcrumb Header */}
          {tabs.length > 0 && (
            <EditorTabs
              tabs={tabs}
              activeTabId={activeTabId}
              onTabClick={onTabClick}
              onTabClose={onTabClose}
              onNewTab={onNewTab}
              onRunAIAnalysis={onAnalyzeRepo}
              onTriggerAISuggestion={() => {
                if (onApplySuggestion) onApplySuggestion('');
              }}
              isAILoading={isAnalyzing}
            />
          )}

          {/* Monaco Editor Canvas */}
          <div className="flex-1 overflow-hidden min-h-0 bg-[#1e1e1e]">
            {children}
          </div>

          {/* Floating / Embedded AI Analysis Drawer */}
          {analysisPanel && (
            <div className="border-t border-[#2b2b2b] bg-[#252526] flex flex-col shrink-0 max-h-[35vh]">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2b2b2b] bg-[#323233]">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#007acc]">
                  AI Deep Analysis
                </span>
                <button
                  onClick={analysisPanel.onClose}
                  className="p-0.5 rounded text-[#858585] hover:text-[#f14c4c]"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 text-xs font-mono text-[#cccccc] whitespace-pre-wrap ide-scrollbar">
                {analysisPanel.content || 'Analysis complete.'}
              </div>
            </div>
          )}

          {/* Integrated Bottom Terminal */}
          <Panel
            analysisContent={analysisResult}
            isAnalyzing={isAnalyzing}
          />
        </div>

        {/* ── RIGHT RESIZE HANDLE ── */}
        {!rightCollapsed && (
          <div
            className="w-[3px] hover:w-[4px] bg-[#2b2b2b] hover:bg-[#007acc] cursor-col-resize transition-all shrink-0 select-none z-20"
            onMouseDown={() => startResize('right')}
            role="separator"
            aria-label="Resize right panel"
          />
        )}

        {/* ── 4. RIGHT PANEL: CODEMIND AI ASSISTANT ── */}
        <div
          className="ide-panel flex flex-col bg-[#252526] border-l border-[#2b2b2b] shrink-0 overflow-hidden transition-all duration-150"
          style={{ width: rightCollapsed ? 32 : rightWidth }}
        >
          {rightCollapsed ? (
            /* Right Collapsed Strip */
            <div className="flex flex-col items-center py-3 gap-4 h-full bg-[#252526]">
              <button
                onClick={() => setRightCollapsed(false)}
                aria-label="Expand AI panel"
                title="Expand AI Assistant"
                className="p-1.5 rounded hover:bg-[#2a2d2e] text-[#858585] hover:text-white transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <div
                onClick={() => setRightCollapsed(false)}
                className="text-[10px] uppercase tracking-widest text-[#858585] hover:text-white font-semibold cursor-pointer select-none py-2"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                Copilot Chat
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0 bg-[#252526]">
              <AIAssistantPanel
                selectedNode={selectedFlowNode}
                currentFile={fileName}
                code={code}
                language={language}
                editorSelection={editorSelection}
                sessionId={sessionId}
                onClearSelectedNode={onClearSelectedNode}
                onNavigateToCode={onNavigateToCode}
                onApplySuggestion={onApplySuggestion}
                onAnalyzeRepo={onAnalyzeRepo}
                isAnalyzing={isAnalyzing}
                analysisResult={analysisResult}
                repoAvailable={repoAvailable}
                onClose={() => setRightCollapsed(true)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── 5. BOTTOM STATUS BAR ── */}
      <StatusBar
        line={statusBarProps.line ?? (editorSelection?.lineStart ?? 14)}
        column={statusBarProps.column ?? 21}
        language={language || 'TypeScript JSX'}
        branch={statusBarProps.branch || 'main'}
        aiStatus={statusBarProps.aiStatus || (isAnalyzing ? 'processing' : 'ready')}
      />
    </div>
  );
}
