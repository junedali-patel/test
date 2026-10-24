// client/components/flowchart/NodeDetailPanel.tsx
// Integrated IDE Bottom Terminal Panel for Flowchart Nodes.
// Resizable, non-overlapping bottom dock with Node Inspector, Code Preview,
// Flow & Branches analysis, and Agentic Tutor AI reasoning.

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  FileCode,
  MapPin,
  ArrowRight,
  ArrowLeft,
  GitBranch,
  RotateCw,
  Code2,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Cpu,
  CornerDownLeft,
  Play,
  Square,
  Sparkles,
  Loader2,
  Bot,
  Terminal,
  AlertCircle,
  Maximize2,
  Minimize2,
  ArrowUp,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FlowNode, FlowEdge } from '@/types/flowchart';
import { askTutor, TutorEvidence } from '@/services/tutorApi';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  evidence?: TutorEvidence[];
  timestamp: Date;
}

interface NodeDetailPanelProps {
  node: FlowNode | null;
  allEdges: FlowEdge[];
  allNodes: FlowNode[];
  code?: string | null;
  fileName?: string | null;
  language?: string | null;
  sessionId?: string | null;
  onClose: () => void;
  onNavigateToCode?: (file: string, lineStart: number, lineEnd?: number) => void;
  onSelectNode?: (node: FlowNode) => void;
}

type TerminalTab = 'details' | 'code' | 'flow' | 'tutor';

// ─── Type Metadata & Styles ──────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; bg: string; explanation: string }> = {
  START:    { icon: <Play size={12} />,              color: '#34d399', bg: '#064e3b', explanation: 'Program or function execution begins here.' },
  END:      { icon: <Square size={11} />,            color: '#f87171', bg: '#450a0a', explanation: 'Execution reaches completion and terminates.' },
  PROCESS:  { icon: <Cpu size={12} />,               color: '#58a6ff', bg: '#0c1a2e', explanation: 'Sequential statement — assignment, calculation, or expression.' },
  DECISION: { icon: <GitBranch size={12} />,         color: '#f59e0b', bg: '#1c1207', explanation: 'Conditional branch evaluating condition into TRUE or FALSE paths.' },
  LOOP:     { icon: <RotateCw size={12} />,          color: '#818cf8', bg: '#1e1b4b', explanation: 'Iteration loop that repeats while continuation condition is met.' },
  FUNCTION: { icon: <Code2 size={12} />,             color: '#c084fc', bg: '#2e1065', explanation: 'Function or method entry declaration.' },
  INPUT:    { icon: <ArrowDownToLine size={12} />,   color: '#2dd4bf', bg: '#042f2e', explanation: 'Reads data from user or external data source.' },
  OUTPUT:   { icon: <ArrowUpFromLine size={12} />,   color: '#38bdf8', bg: '#082f49', explanation: 'Emits output or prints results to console/view.' },
  RETURN:   { icon: <CornerDownLeft size={12} />,    color: '#4ade80', bg: '#052e16', explanation: 'Returns a value and exits the current scope.' },
  ERROR:    { icon: <AlertTriangle size={12} />,     color: '#f87171', bg: '#450a0a', explanation: 'Exception handling — catches or raises an error.' },
  FILE:     { icon: <FileCode size={12} />,          color: '#22d3ee', bg: '#164e63', explanation: 'Source file module in the repository architecture.' },
};

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? TYPE_META['PROCESS'];
}

function cleanLabel(label: string): string {
  return label.replace(/^def\s+/, '').replace(/\?$/, '').trim();
}

function truncate(s: string, max: number) {
  if (!s) return '';
  return s.length > max ? s.substring(0, max - 1) + '…' : s;
}

export default function NodeDetailPanel({
  node,
  allEdges,
  allNodes,
  code = '',
  fileName = 'main.py',
  language = 'python',
  sessionId = null,
  onClose,
  onNavigateToCode,
  onSelectNode
}: NodeDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TerminalTab>('details');
  const [height, setHeight] = useState(240);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isDraggingRef = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll tutor chat
  useEffect(() => {
    if (activeTab === 'tutor') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, activeTab]);

  // Reset or initialize tutor greeting when selected node changes
  useEffect(() => {
    if (!node) return;
    setMessages([
      {
        id: `init_${node.id}`,
        role: 'assistant',
        content: `👋 I'm your **Agentic Tutor**. Inspecting node \`${node.id}\` (\`${cleanLabel(node.label || '')}\`).\nAsk me about execution logic, branch decisions, side effects, or edge cases.`,
        timestamp: new Date()
      }
    ]);
    setError(null);
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse drag resizer for top edge of bottom terminal panel
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startY = e.clientY;
    const startH = height;

    const onMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = startY - moveEvent.clientY;
      const maxH = Math.min(500, Math.floor(window.innerHeight * 0.6));
      const newH = Math.max(130, Math.min(maxH, startH + deltaY));
      setHeight(newH);
      if (isCollapsed) setIsCollapsed(false);
    };

    const onUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [height, isCollapsed]);

  if (!node) return null;

  const meta = getTypeMeta(node.type);
  const label = cleanLabel(node.label || '');
  const lineLabel = node.lineStart
    ? (node.lineEnd && node.lineEnd !== node.lineStart
        ? `${node.lineStart}–${node.lineEnd}`
        : `${node.lineStart}`)
    : null;

  // Predecessor and successor edges
  const incoming = allEdges.filter(e => e.target === node.id);
  const outgoing = allEdges.filter(e => e.source === node.id);

  const getNodeObj = (id: string) => allNodes.find(n => n.id === id);
  const getNodeLabel = (id: string) =>
    allNodes.find(n => n.id === id)?.label?.replace(/^def\s+/, '') ?? id;

  const isDecision = node.type === 'DECISION';
  const isLoop = node.type === 'LOOP';
  const yesBranch = outgoing.find(e => (e.label || '').toUpperCase() === 'YES' || (e.label || '').toUpperCase() === 'TRUE');
  const noBranch  = outgoing.find(e => (e.label || '').toUpperCase() === 'NO' || (e.label || '').toUpperCase() === 'FALSE');

  // Extract source code snippet around node's lineStart..lineEnd
  const codeSnippetLines = useMemo(() => {
    if (!code || !node.lineStart) return null;
    const lines = code.split('\n');
    const start = Math.max(1, node.lineStart - 1);
    const end = Math.min(lines.length, (node.lineEnd || node.lineStart) + 1);
    return lines.slice(start - 1, end).map((text, i) => {
      const lineNum = start + i;
      const isTarget = lineNum >= node.lineStart! && lineNum <= (node.lineEnd || node.lineStart!);
      return { lineNum, text, isTarget };
    });
  }, [code, node.lineStart, node.lineEnd]);

  // Quick inquiry prompts tailored to node type
  const suggestedPrompts = useMemo(() => {
    if (isDecision) {
      return [
        'Why does this condition have two branches?',
        'What conditions trigger the TRUE branch?',
        'What leads to this decision in the flow?'
      ];
    }
    if (isLoop) {
      return [
        'When does this loop terminate?',
        'Explain the loop continuation check',
        'Are there any potential infinite loop risks?'
      ];
    }
    if (node.type === 'FUNCTION') {
      return [
        'What callers invoke this function?',
        'Explain the function signature & logic',
        'Show function dependencies'
      ];
    }
    return [
      'Explain what this statement does',
      'Trace control flow reaching here',
      'Are there variable side-effects?'
    ];
  }, [isDecision, isLoop, node.type]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAsk = async (textToAsk?: string) => {
    const q = (textToAsk || question).trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setQuestion('');
    setIsLoading(true);
    setError(null);

    try {
      const historyPayload = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await askTutor({
        question: q,
        node_id: node.id,
        session_id: sessionId,
        code: code || '',
        fileName: node.file || fileName || 'main.py',
        language: language || 'python',
        graph: {
          nodes: allNodes,
          edges: allEdges
        },
        conversationHistory: historyPayload
      });

      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: response.answer || 'No explanation returned.',
        toolsUsed: response.tools_used || [],
        evidence: response.evidence || [],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: unknown) {
      console.error('[NodeDetailPanel] Tutor error:', err);
      const errText = err instanceof Error ? err.message : 'Unable to connect to tutor service.';
      setError(errText);
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Tutor Service Notice**: ${errText}\n\nMake sure backend service is active.`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`w-full bg-[#1e1e1e] border-t border-[#2b2b2b] flex flex-col shrink-0 select-none z-20 relative transition-all duration-150 ${
        isCollapsed ? 'h-[34px]' : ''
      }`}
      style={!isCollapsed ? { height: `${height}px` } : undefined}
    >
      {/* ── Top Drag Handle (Resize bottom panel like IDE terminal) ── */}
      {!isCollapsed && (
        <div
          onMouseDown={startResize}
          className="absolute top-0 left-0 right-0 h-[4px] cursor-row-resize bg-transparent hover:bg-[#007acc] z-30 transition-colors"
          title="Drag up or down to resize bottom panel"
          role="separator"
          aria-label="Resize bottom terminal panel"
        />
      )}

      {/* ── Terminal Header Bar ── */}
      <div className="h-[34px] px-3 bg-[#252526] border-b border-[#2b2b2b] flex items-center justify-between shrink-0 text-xs">
        {/* Left: Terminal prompt icon + Node Type Badge + Tabs */}
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          {/* Terminal Icon & Type Badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Terminal size={13} className="text-[#007acc]" />
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}
            >
              {meta.icon}
              <span>{node.type}</span>
            </div>
            <span className="text-[10px] font-mono text-[#858585] hidden md:inline truncate max-w-[120px]">
              #{node.id}
            </span>
          </div>

          <div className="w-px h-3.5 bg-[#3c3c3c] mx-1 shrink-0" />

          {/* VS Code Style Terminal Tabs */}
          <div className="flex items-center h-[34px]" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'details'}
              onClick={() => {
                setActiveTab('details');
                if (isCollapsed) setIsCollapsed(false);
              }}
              className={`h-[34px] px-2.5 flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer border-b-2 ${
                activeTab === 'details' && !isCollapsed
                  ? 'border-[#007acc] text-white bg-[#1e1e1e]'
                  : 'border-transparent text-[#858585] hover:text-[#cccccc]'
              }`}
            >
              <Cpu size={12} className={activeTab === 'details' ? 'text-[#007acc]' : 'text-[#858585]'} />
              <span>Inspector</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'code'}
              onClick={() => {
                setActiveTab('code');
                if (isCollapsed) setIsCollapsed(false);
              }}
              className={`h-[34px] px-2.5 flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer border-b-2 ${
                activeTab === 'code' && !isCollapsed
                  ? 'border-[#007acc] text-white bg-[#1e1e1e]'
                  : 'border-transparent text-[#858585] hover:text-[#cccccc]'
              }`}
            >
              <Code2 size={12} className={activeTab === 'code' ? 'text-[#007acc]' : 'text-[#858585]'} />
              <span>Code</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'flow'}
              onClick={() => {
                setActiveTab('flow');
                if (isCollapsed) setIsCollapsed(false);
              }}
              className={`h-[34px] px-2.5 flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer border-b-2 ${
                activeTab === 'flow' && !isCollapsed
                  ? 'border-[#007acc] text-white bg-[#1e1e1e]'
                  : 'border-transparent text-[#858585] hover:text-[#cccccc]'
              }`}
            >
              <GitBranch size={12} className={activeTab === 'flow' ? 'text-[#007acc]' : 'text-[#858585]'} />
              <span>Flow</span>
              {(incoming.length + outgoing.length) > 0 && (
                <span className="px-1 py-0.2 rounded-full text-[9px] font-mono bg-[#1e1e1e] text-[#858585] border border-[#3c3c3c]">
                  {incoming.length + outgoing.length}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tutor'}
              onClick={() => {
                setActiveTab('tutor');
                if (isCollapsed) setIsCollapsed(false);
              }}
              className={`h-[34px] px-2.5 flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer border-b-2 ${
                activeTab === 'tutor' && !isCollapsed
                  ? 'border-[#007acc] text-white bg-[#1e1e1e]'
                  : 'border-transparent text-[#858585] hover:text-[#cccccc]'
              }`}
            >
              <Bot size={12} className={activeTab === 'tutor' ? 'text-[#007acc]' : 'text-[#858585]'} />
              <span>AI Tutor</span>
            </button>
          </div>
        </div>

        {/* Right: Line Jump Badge, Collapse/Expand & Close Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {lineLabel && onNavigateToCode && (
            <button
              onClick={() => onNavigateToCode(node.file || fileName || 'main.py', node.lineStart!, node.lineEnd || node.lineStart!)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1e1e1e] hover:bg-[#2a2d2e] border border-[#3c3c3c] text-[11px] font-mono text-[#007acc] hover:text-[#75beff] transition-colors cursor-pointer mr-1"
              title="Jump to code in editor"
            >
              <MapPin size={10} />
              <span>Ln {lineLabel}</span>
              <ExternalLink size={10} className="ml-0.5 opacity-70" />
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(p => !p)}
            className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
            aria-label="Toggle panel height"
          >
            {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <button
            onClick={() => setHeight(h => (h > 280 ? 220 : 380))}
            className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer"
            title={height > 280 ? 'Standard Height' : 'Maximize Height'}
            aria-label="Toggle maximum height"
          >
            {height > 280 ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer"
            title="Close Panel"
            aria-label="Close Panel"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── Terminal Body Content ── */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 overflow-hidden bg-[#1e1e1e] flex flex-col">
          {/* ══════════ TAB 1: NODE INSPECTOR ══════════ */}
          {activeTab === 'details' && (
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[#2b2b2b]">
              {/* Left/Main Column: Statement Code & Description */}
              <div className="flex-1 p-3 overflow-y-auto ide-scrollbar space-y-2.5">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#858585] mb-1 flex items-center justify-between">
                    <span>Node Statement / Expression</span>
                    <button
                      onClick={() => copyToClipboard(label, 'stmt')}
                      className="flex items-center gap-1 text-[10px] text-[#858585] hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedId === 'stmt' ? <Check size={11} className="text-[#3fb950]" /> : <Copy size={11} />}
                      <span>{copiedId === 'stmt' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="bg-[#181818] border border-[#333333] rounded p-2 text-xs font-mono text-[#e0e0e0] overflow-x-auto whitespace-pre-wrap break-words leading-relaxed max-h-[85px] ide-scrollbar">
                    {label}
                  </pre>
                </div>

                <div className="bg-[#252526] p-2.5 rounded border border-[#333333]">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#858585] mb-1">
                    Control Flow Role
                  </div>
                  <p className="text-xs text-[#cccccc] leading-relaxed">
                    {meta.explanation}
                  </p>
                </div>
              </div>

              {/* Right Column: Metadata & Quick Actions */}
              <div className="w-full sm:w-[260px] p-3 overflow-y-auto ide-scrollbar bg-[#212122] flex flex-col justify-between shrink-0 space-y-3">
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#858585] mb-2 font-sans">
                    Properties
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-[#2b2b2b]">
                    <span className="text-[#858585]">Node ID:</span>
                    <span className="text-white truncate max-w-[140px]">{node.id}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-[#2b2b2b]">
                    <span className="text-[#858585]">Type:</span>
                    <span style={{ color: meta.color }} className="font-bold">{node.type}</span>
                  </div>
                  {lineLabel && (
                    <div className="flex justify-between py-0.5 border-b border-[#2b2b2b]">
                      <span className="text-[#858585]">Lines:</span>
                      <span className="text-[#007acc]">Ln {lineLabel}</span>
                    </div>
                  )}
                  {node.file && (
                    <div className="flex justify-between py-0.5 border-b border-[#2b2b2b]">
                      <span className="text-[#858585]">File:</span>
                      <span className="text-white truncate max-w-[130px]" title={node.file}>
                        {node.file.split('/').pop()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-0.5 border-b border-[#2b2b2b]">
                    <span className="text-[#858585]">Connections:</span>
                    <span className="text-white">{incoming.length} in · {outgoing.length} out</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#2b2b2b] space-y-1.5">
                  {lineLabel && onNavigateToCode && (
                    <button
                      onClick={() => onNavigateToCode(node.file || fileName || 'main.py', node.lineStart!, node.lineEnd || node.lineStart!)}
                      className="w-full py-1.5 px-2 bg-[#252526] hover:bg-[#2e2e30] border border-[#3c3c3c] text-white rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileCode size={12} className="text-[#007acc]" />
                      <span>Jump to Editor</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('tutor')}
                    className="w-full py-1.5 px-2 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Bot size={12} />
                    <span>Ask Agentic Tutor</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ TAB 2: CODE PREVIEW ══════════ */}
          {activeTab === 'code' && (
            <div className="flex-1 flex flex-col p-3 overflow-hidden">
              <div className="flex items-center justify-between pb-2 border-b border-[#2b2b2b] shrink-0 text-xs">
                <div className="flex items-center gap-2">
                  <FileCode size={13} className="text-[#007acc]" />
                  <span className="font-mono text-[#cccccc]">{node.file || fileName || 'Source File'}</span>
                  {lineLabel && <span className="font-mono text-[#007acc]">· Lines {lineLabel}</span>}
                </div>
                {lineLabel && onNavigateToCode && (
                  <button
                    onClick={() => onNavigateToCode(node.file || fileName || 'main.py', node.lineStart!, node.lineEnd || node.lineStart!)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-[#252526] hover:bg-[#2e2e30] border border-[#3c3c3c] text-white rounded text-xs transition-colors cursor-pointer"
                  >
                    <ExternalLink size={11} />
                    <span>Open in Monaco Editor</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto mt-2 bg-[#181818] border border-[#333333] rounded font-mono text-xs ide-scrollbar">
                {codeSnippetLines ? (
                  <div className="p-2 space-y-0.5">
                    {codeSnippetLines.map(({ lineNum, text, isTarget }) => (
                      <div
                        key={lineNum}
                        className={`flex items-start px-2 py-0.5 rounded ${
                          isTarget ? 'bg-[#094771]/35 border-l-2 border-[#007acc] text-white font-semibold' : 'text-[#858585]'
                        }`}
                      >
                        <span className="w-8 shrink-0 select-none text-right pr-3 text-[#555555] text-[11px]">
                          {lineNum}
                        </span>
                        <span className="whitespace-pre overflow-x-auto text-[#d4d4d4]">
                          {text || ' '}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-[#858585] text-center">
                    <p>Source file content is not loaded in editor.</p>
                    <pre className="mt-2 text-left bg-[#1e1e1e] p-2 rounded text-[#cccccc] inline-block">
                      {label}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════ TAB 3: FLOW & BRANCHES ══════════ */}
          {activeTab === 'flow' && (
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[#2b2b2b] p-3 gap-3">
              {/* Decision / Loop Condition Branch Panel */}
              {(isDecision || isLoop) && (
                <div className="w-full sm:w-[280px] bg-[#252526] p-2.5 rounded border border-[#333333] shrink-0 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#858585] mb-2 flex items-center gap-1.5">
                      <GitBranch size={12} className="text-[#cca700]" />
                      <span>{isDecision ? 'Condition Branch Paths' : 'Loop Iteration'}</span>
                    </div>

                    {isDecision && (
                      <div className="space-y-2 text-xs">
                        {yesBranch ? (
                          <div
                            onClick={() => {
                              const targetNode = getNodeObj(yesBranch.target);
                              if (targetNode && onSelectNode) onSelectNode(targetNode);
                            }}
                            className="p-2 rounded bg-[#064e3b]/30 border border-[#059669]/50 hover:border-[#34d399] cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold text-[#34d399] uppercase mb-1">
                              <span>TRUE / YES PATH</span>
                              <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                            <div className="font-mono text-white text-[11px] truncate">
                              {truncate(getNodeLabel(yesBranch.target), 32)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#858585] italic">No TRUE branch target</div>
                        )}

                        {noBranch ? (
                          <div
                            onClick={() => {
                              const targetNode = getNodeObj(noBranch.target);
                              if (targetNode && onSelectNode) onSelectNode(targetNode);
                            }}
                            className="p-2 rounded bg-[#450a0a]/30 border border-[#dc2626]/50 hover:border-[#f87171] cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold text-[#f87171] uppercase mb-1">
                              <span>FALSE / NO PATH</span>
                              <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                            <div className="font-mono text-white text-[11px] truncate">
                              {truncate(getNodeLabel(noBranch.target), 32)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#858585] italic">No FALSE branch target</div>
                        )}
                      </div>
                    )}

                    {isLoop && (
                      <div className="text-xs text-[#cccccc] space-y-2">
                        <div className="p-2 rounded bg-[#1e1b4b]/40 border border-[#818cf8]/40">
                          <span className="text-[10px] font-bold text-[#818cf8] uppercase block mb-1">LOOP CONTINUATION</span>
                          <span className="font-mono text-[11px] text-white">{label}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-[#858585] pt-2 border-t border-[#333333]">
                    Click any branch card above to navigate to that node.
                  </div>
                </div>
              )}

              {/* Predecessors & Successors Lists */}
              <div className="flex-1 flex flex-col sm:flex-row gap-3 overflow-hidden">
                {/* Incoming Predecessors */}
                <div className="flex-1 bg-[#212122] p-2.5 rounded border border-[#2b2b2b] flex flex-col min-h-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#858585] mb-1.5 flex items-center gap-1 shrink-0">
                    <ArrowLeft size={11} />
                    <span>Incoming Predecessors ({incoming.length})</span>
                  </div>
                  <div className="flex-1 overflow-y-auto ide-scrollbar space-y-1">
                    {incoming.length === 0 ? (
                      <span className="text-xs text-[#6e7681] italic">Root / Entry node (No predecessors)</span>
                    ) : (
                      incoming.map(e => {
                        const srcNode = getNodeObj(e.source);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => srcNode && onSelectNode?.(srcNode)}
                            className="w-full text-left p-1.5 rounded bg-[#181818] hover:bg-[#282828] border border-[#333333] hover:border-[#007acc] text-xs font-mono text-[#cccccc] flex items-center justify-between group transition-colors cursor-pointer"
                          >
                            <div className="truncate flex-1">
                              <span className="text-[#858585] mr-1.5 text-[10px]">from</span>
                              <span className="text-[#75beff] font-semibold">{truncate(getNodeLabel(e.source), 26)}</span>
                            </div>
                            <ArrowRight size={10} className="text-[#858585] group-hover:text-white shrink-0 ml-1" />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Outgoing Successors */}
                <div className="flex-1 bg-[#212122] p-2.5 rounded border border-[#2b2b2b] flex flex-col min-h-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#858585] mb-1.5 flex items-center gap-1 shrink-0">
                    <ArrowRight size={11} />
                    <span>Outgoing Successors ({outgoing.length})</span>
                  </div>
                  <div className="flex-1 overflow-y-auto ide-scrollbar space-y-1">
                    {outgoing.length === 0 ? (
                      <span className="text-xs text-[#6e7681] italic">Leaf / Terminal node (No successors)</span>
                    ) : (
                      outgoing.map(e => {
                        const targetNode = getNodeObj(e.target);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => targetNode && onSelectNode?.(targetNode)}
                            className="w-full text-left p-1.5 rounded bg-[#181818] hover:bg-[#282828] border border-[#333333] hover:border-[#007acc] text-xs font-mono text-[#cccccc] flex items-center justify-between group transition-colors cursor-pointer"
                          >
                            <div className="truncate flex-1 flex items-center gap-1">
                              {e.label && (
                                <span className={`text-[9px] font-bold px-1 rounded ${
                                  e.label === 'YES' ? 'text-[#34d399] bg-[#064e3b]' :
                                  e.label === 'NO' ? 'text-[#f87171] bg-[#450a0a]' : 'text-[#75beff]'
                                }`}>
                                  {e.label}
                                </span>
                              )}
                              <span className="text-[#858585] text-[10px]">to</span>
                              <span className="text-[#75beff] font-semibold">{truncate(getNodeLabel(e.target), 24)}</span>
                            </div>
                            <ArrowRight size={10} className="text-[#858585] group-hover:text-white shrink-0 ml-1" />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ TAB 4: AGENTIC TUTOR ══════════ */}
          {activeTab === 'tutor' && (
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[#2b2b2b]">
              {/* Left Column: Suggested Prompt Chips */}
              <div className="w-full sm:w-[240px] p-2.5 bg-[#212122] flex flex-col justify-between shrink-0 overflow-y-auto ide-scrollbar">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#858585] flex items-center gap-1 mb-2">
                    <Sparkles size={11} className="text-[#007acc]" />
                    <span>Suggested Inquiries</span>
                  </div>
                  <div className="space-y-1.5">
                    {suggestedPrompts.map((p, i) => (
                      <button
                        key={i}
                        disabled={isLoading}
                        onClick={() => handleAsk(p)}
                        className="w-full text-left p-1.5 rounded bg-[#181818] hover:bg-[#282828] border border-[#333333] hover:border-[#007acc] text-[11px] text-[#cccccc] hover:text-white transition-colors cursor-pointer flex items-center justify-between group disabled:opacity-50"
                      >
                        <span className="truncate flex-1">{p}</span>
                        <ArrowRight size={10} className="text-[#858585] group-hover:text-white shrink-0 ml-1" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#2b2b2b] text-[10px] text-[#858585]">
                  AI Tutor reasons over active AST and CFG traces.
                </div>
              </div>

              {/* Right Column: Chat History & Input */}
              <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] overflow-hidden">
                <div className="flex-1 overflow-y-auto p-3 space-y-2 ide-scrollbar min-h-0">
                  {messages.map(msg => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2 w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isUser && (
                          <div className="w-5 h-5 rounded bg-[#0e639c] text-white flex items-center justify-center shrink-0 mt-0.5">
                            <Bot size={12} />
                          </div>
                        )}
                        <div className={`flex flex-col ${isUser ? 'items-end max-w-[85%]' : 'flex-1 max-w-[92%]'}`}>
                          <div
                            className={`p-2 rounded text-xs leading-relaxed ${
                              isUser
                                ? 'bg-[#0e639c] text-white'
                                : 'bg-[#252526] border border-[#333333] text-[#cccccc]'
                            }`}
                          >
                            <div className="prose prose-invert prose-xs max-w-none break-words select-text">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>

                            {/* Tools Used badge */}
                            {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                              <div className="mt-1.5 pt-1 border-t border-[#333333] flex items-center gap-1 flex-wrap">
                                <span className="text-[9px] uppercase font-bold text-[#858585]">Tools:</span>
                                {msg.toolsUsed.map(t => (
                                  <span key={t} className="text-[9px] font-mono px-1 py-0.2 bg-[#1e1e1e] text-[#75beff] rounded border border-[#3c3c3c]">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Evidence Citations */}
                            {msg.evidence && msg.evidence.length > 0 && (
                              <div className="mt-1 flex gap-1 flex-wrap">
                                {msg.evidence.map((ev, idx) =>
                                  ev.lineStart ? (
                                    <button
                                      key={idx}
                                      onClick={() => onNavigateToCode?.(node.file || fileName || 'main.py', ev.lineStart!, ev.lineEnd || ev.lineStart!)}
                                      className="text-[10px] text-[#007acc] hover:underline flex items-center gap-0.5 bg-[#1e1e1e] px-1.5 py-0.2 rounded border border-[#3c3c3c] cursor-pointer"
                                    >
                                      <MapPin size={9} />
                                      <span>Line {ev.lineStart}</span>
                                    </button>
                                  ) : null
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isLoading && (
                    <div className="flex items-center gap-2 p-2 bg-[#252526] border border-[#333333] rounded text-xs text-[#007acc]">
                      <Loader2 size={12} className="animate-spin text-[#007acc]" />
                      <span>Reasoning over control flow graph…</span>
                    </div>
                  )}

                  {error && (
                    <div className="p-2 bg-red-950/30 border border-red-800/40 rounded text-red-300 text-xs flex items-center gap-1.5">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* Input Bar */}
                <div className="p-2 bg-[#252526] border-t border-[#2b2b2b] shrink-0">
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      handleAsk();
                    }}
                    className="flex items-center gap-1.5 bg-[#1e1e1e] border border-[#3c3c3c] focus-within:border-[#007acc] rounded px-2 py-1 transition-colors"
                  >
                    <input
                      type="text"
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      placeholder="Ask tutor about this node (control flow, variables, edge cases)..."
                      disabled={isLoading}
                      className="flex-1 bg-transparent text-xs text-[#cccccc] placeholder-[#6e7681] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !question.trim()}
                      className="w-6 h-6 rounded bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-40 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      aria-label="Send question"
                    >
                      <ArrowUp size={13} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
