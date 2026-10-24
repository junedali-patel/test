'use client';

// client/components/ai/AIAssistantPanel.tsx
// Visual Studio style AI Assistant panel (Chat | Suggest | Explain | Voice).
// Styled to official VS Code Dark+ guidelines with no AI color gradients.

import { useState } from 'react';
import { MessageSquare, Sparkles, BookOpen, Volume2, ChevronRight, MoreHorizontal } from 'lucide-react';
import AIChatView from '../views/AIChatView';
import VoiceExplanation from '../voice/VoiceExplanation';
import AISuggestionsPanel from './AISuggestionsPanel';
import CodeExplanationPanel from './CodeExplanationPanel';
import { FlowNode } from '@/types/flowchart';
import { EditorSelection } from '@/types/voice';

export interface AIAssistantPanelProps {
  editorSelection?: EditorSelection | null;
  currentFile?: string | null;
  code?: string | null;
  language?: string | null;
  selectedNode?: FlowNode | null;
  sessionId?: string | null;
  onClearSelectedNode?: () => void;
  onNavigateToCode?: (file: string, lineStart: number, lineEnd?: number) => void;
  onApplySuggestion?: (suggestion: string) => void;
  onAnalyzeRepo?: () => void;
  isAnalyzing?: boolean;
  analysisResult?: string;
  repoAvailable?: boolean;
  onClose?: () => void;
}

type Tab = 'chat' | 'suggest' | 'explain' | 'voice';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'suggest', label: 'Suggest', icon: Sparkles },
  { id: 'explain', label: 'Explain', icon: BookOpen },
  { id: 'voice', label: 'Voice', icon: Volume2 },
];

export default function AIAssistantPanel({
  editorSelection = null,
  currentFile = null,
  code = null,
  language = null,
  selectedNode = null,
  sessionId = null,
  onClearSelectedNode = () => {},
  onNavigateToCode,
  onApplySuggestion = () => {},
  onAnalyzeRepo = () => {},
  isAnalyzing = false,
  analysisResult = '',
  repoAvailable = false,
  onClose,
}: AIAssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc] overflow-hidden select-none">
      {/* ── VS Code Style Panel Header: ✦ CHAT ── */}
      <div className="h-[35px] px-3.5 border-b border-[#2b2b2b] bg-[#1e1e1e] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#388bfd]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#e0e0e0]">
            CHAT
          </span>
        </div>

        <div className="flex items-center gap-1 text-[#858585]">
          <button
            className="p-1 rounded hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer"
            title="More Options..."
          >
            <MoreHorizontal size={14} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#2a2d2e] transition-colors cursor-pointer"
              title="Collapse Assistant"
              aria-label="Collapse Assistant"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── VS Code Style Tab Bar (Flat with Active Border-Bottom) ── */}
      <div className="h-[32px] px-2 border-b border-[#2b2b2b] bg-[#252526] flex items-center shrink-0">
        <div className="flex items-center gap-1 w-full" role="tablist">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                onClick={() => setActiveTab(tab.id)}
                aria-selected={isActive}
                className={`flex-1 h-[32px] flex items-center justify-center gap-1.5 px-2 text-xs font-medium transition-colors cursor-pointer relative ${
                  isActive
                    ? 'text-white border-b-2 border-[#007acc] font-semibold bg-[#1e1e1e]/40'
                    : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#2a2d2e]/50'
                }`}
              >
                <Icon size={13} className={isActive ? 'text-[#007acc]' : 'text-[#858585]'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Context hint banner when in Voice tab ── */}
      {activeTab === 'voice' && (currentFile || selectedNode) && (
        <div className="text-[11px] text-[#858585] px-3 py-1.5 shrink-0 border-b border-[#2b2b2b] bg-[#1e1e1e] flex items-center justify-between">
          <span className="truncate">
            {selectedNode
              ? `Node: ${selectedNode.label}`
              : `File: ${currentFile?.split('/').pop()?.split('\\').pop() ?? currentFile}`}
          </span>
          <span className="text-[#75beff] text-[10px] font-mono">
            TTS Engine
          </span>
        </div>
      )}

      {/* ── Active Tab Content Body ── */}
      <div className="flex-1 overflow-hidden min-h-0 bg-[#1e1e1e]">
        {activeTab === 'chat' && (
          <AIChatView
            selectedNode={selectedNode}
            code={code}
            fileName={currentFile}
            language={language}
            sessionId={sessionId}
            onClearSelectedNode={onClearSelectedNode}
            onNavigateToCode={onNavigateToCode}
          />
        )}

        {activeTab === 'suggest' && (
          <div className="h-full overflow-y-auto ide-scrollbar bg-[#1e1e1e]">
            <AISuggestionsPanel
              code={code}
              language={language}
              fileName={currentFile}
              onApplySuggestion={onApplySuggestion}
              onAnalyzeRepo={onAnalyzeRepo}
              isAnalyzing={isAnalyzing}
              analysisResult={analysisResult}
              repoAvailable={repoAvailable}
            />
          </div>
        )}

        {activeTab === 'explain' && (
          <div className="h-full overflow-y-auto ide-scrollbar bg-[#1e1e1e]">
            <CodeExplanationPanel
              editorSelection={editorSelection}
              currentFile={currentFile}
              code={code}
              language={language}
              selectedNode={selectedNode}
            />
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="h-full overflow-y-auto ide-scrollbar bg-[#1e1e1e]">
            <VoiceExplanation
              editorSelection={editorSelection}
              currentFile={currentFile}
              code={code}
              language={language}
              selectedNode={selectedNode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
