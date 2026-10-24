// client/components/views/AIChatView.tsx
// Exact messenger-style AI Chat Bot Panel matching dark messenger UI
// Royal purple user bubbles, charcoal assistant bubbles, auto-resizing input with interactive action icons,
// and fully responsive quick inquiry suggestions placed directly below the text input area.

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Copy,
  Check,
  CheckCheck,
  Terminal,
  MapPin,
  Sparkles,
  X,
  BookOpen,
  Bug,
  Code2,
  Trash2,
  Paperclip,
  Loader2,
  Mic,
  Smile,
  PlusCircle,
  Send,
  Zap,
  ArrowDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// @ts-expect-error - react-syntax-highlighter does not provide types in this project
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// @ts-expect-error - style file does not provide types in this project
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

import axios from 'axios';
import { FlowNode } from '@/types/flowchart';
import { askTutor, TutorEvidence } from '@/services/tutorApi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  evidence?: TutorEvidence[];
  timestamp: Date;
}

interface AIChatViewProps {
  selectedNode?: FlowNode | null;
  code?: string | null;
  fileName?: string | null;
  language?: string | null;
  sessionId?: string | null;
  onClearSelectedNode?: () => void;
  onNavigateToCode?: (file: string, lineStart: number, lineEnd?: number) => void;
  onResetChat?: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

function formatMessageTime(date: Date): string {
  try {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  } catch {
    return '4:56 pm';
  }
}

export default function AIChatView({
  selectedNode = null,
  code = '',
  fileName = 'CodeEditor.tsx',
  language = 'typescript',
  sessionId = null,
  onClearSelectedNode,
  onNavigateToCode
}: AIChatViewProps) {
  // Initial message matching screenshot aesthetic
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init_asst_1',
      role: 'assistant',
      content: "Hello! I'm CodeMind AI. What would you like to inspect or generate today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom smoothly
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Track scroll position to conditionally show "scroll to bottom" button
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    setShowScrollBottom(!isNearBottom);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading, scrollToBottom]);

  // Adjust textarea height responsively as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  // Voice speech-to-text dictation via SpeechRecognition API
  const handleToggleVoice = () => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice dictation is not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInput(prev => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }
      };

      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setShowEmojiPicker(false);
    setShowContextPicker(false);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    setIsLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // If a flowchart node is selected, route to Agentic Tutor
      if (selectedNode) {
        const tutorResponse = await askTutor({
          question: textToSend,
          node_id: selectedNode.id,
          session_id: sessionId,
          code: code || '',
          fileName: selectedNode.file || fileName || 'CodeEditor.tsx',
          language: language || 'typescript',
          conversationHistory,
        });

        const assistantMessage: Message = {
          id: `asst_${Date.now()}`,
          role: 'assistant',
          content: tutorResponse.answer || "I couldn't generate an explanation.",
          toolsUsed: tutorResponse.tools_used || [],
          evidence: tutorResponse.evidence || [],
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // General CodeMind AI chat
        const response = await axios.post(`${API_BASE_URL}/api/ai/chat`, {
          message: textToSend,
          code: code || '',
          fileName: fileName || '',
          language: language || '',
          conversationHistory,
        });

        const assistantText = response.data?.response || response.data?.reply || "I couldn't generate a response.";

        const assistantMessage: Message = {
          id: `asst_${Date.now()}`,
          role: 'assistant',
          content: assistantText,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err: unknown) {
      console.error('Chat error:', err);
      let errorMsg = 'Unable to reach CodeMind AI service. Please verify the backend is running.';
      if (err && typeof err === 'object' && 'response' in err) {
        const axErr = err as { response?: { data?: { error?: string } } };
        if (axErr.response?.data?.error) {
          errorMsg = axErr.response.data.error;
        }
      }
      const errorMessage: Message = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Service Notice:** ${errorMsg}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
  };

  // File upload simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInput(prev => (prev ? `${prev} [Attached: ${file.name}]` : `[Attached: ${file.name}]`));
    }
  };

  // Quick suggestion chips placed directly below the text input area
  const suggestions = [
    {
      id: 'explain',
      icon: BookOpen,
      label: 'Explain Code',
      prompt: 'Please provide a clear step-by-step logic breakdown of this code.'
    },
    {
      id: 'bugs',
      icon: Bug,
      label: 'Find Bugs',
      prompt: 'Analyze this code for potential runtime exceptions, edge cases, and bugs.'
    },
    {
      id: 'tests',
      icon: Code2,
      label: 'Unit Tests',
      prompt: 'Generate comprehensive unit tests using Vitest/Jest for this component.'
    },
    {
      id: 'refactor',
      icon: Zap,
      label: 'Refactor',
      prompt: 'Suggest clean, idiomatic performance optimizations and refactoring.'
    }
  ];

  const quickEmojis = ['👍', '🔥', '🚀', '💡', '🐛', '✨', '👏'];

  return (
    <div className="flex flex-col h-full bg-[#121217] text-[#f2f2f7] text-xs relative overflow-hidden select-none font-sans">
      {/* ── Active Node Context Banner ── */}
      {selectedNode && (
        <div className="px-3.5 py-1.5 bg-[#181820] border-b border-[#23232c] flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#5e5ce6] shrink-0 animate-pulse" />
            <span className="font-semibold text-[#a5b4fc] shrink-0 text-[11px]">Context:</span>
            <span className="font-mono text-white truncate text-[11px] bg-[#121217] px-2 py-0.5 rounded border border-[#2a2a34]">
              {selectedNode.id} ({selectedNode.type})
            </span>
          </div>
          {onClearSelectedNode && (
            <button
              onClick={onClearSelectedNode}
              className="p-1 hover:text-white text-[#8e8e9a] hover:bg-[#23232c] rounded-full transition-colors cursor-pointer"
              title="Clear Node Selection"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* ── Messages Scroll Area ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-4 space-y-6 min-h-0 ide-scrollbar relative"
      >
        {/* Top "Today" Date Badge matching screenshot */}
        <div className="flex items-center justify-center my-1 select-none">
          <span className="px-3 py-0.5 rounded-full bg-[#1c1c24] border border-[#282834] text-[10.5px] font-medium text-[#8e8e9a] tracking-wide shadow-xs">
            Today
          </span>
        </div>

        {/* Message Bubbles */}
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const timeStr = formatMessageTime(m.timestamp);
          const isWarning = !isUser && (m.content.includes('Unable to complete reasoning') || m.content.startsWith('⚠️'));

          return (
            <div
              key={m.id}
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex flex-col transition-all max-w-[88%] sm:max-w-[82%] min-w-[90px] ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
                {/* ── Sender Badge & Label ── */}
                {isUser ? (
                  <div className="flex items-center justify-end gap-1.5 mb-1.5 px-1 select-none">
                    <span className="text-[11px] font-medium text-[#9ca3af]">You</span>
                    <div className="w-4 h-4 rounded-full bg-[#5e5ce6] border border-[#7a78f2] flex items-center justify-center text-white text-[9px] font-bold shadow-xs">
                      U
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mb-1.5 px-1 select-none">
                    <div className="w-4 h-4 rounded-full bg-[#5e5ce6]/25 border border-[#5e5ce6]/45 flex items-center justify-center text-[#93c5fd] shadow-xs">
                      <Sparkles size={10} className="text-[#a5b4fc]" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#e2e8f0] tracking-tight">CodeMind AI</span>
                    <span className="text-[10px] text-[#6b7280] font-normal">Assistant</span>
                  </div>
                )}

                {/* ── Chat Bubble ── */}
                <div
                  className={`px-4 py-3 sm:px-4.5 sm:py-3.5 rounded-2xl text-[13px] leading-relaxed shadow-md break-words select-text max-w-full ${
                    isUser
                      ? 'bg-[#5e5ce6] text-white rounded-br-xs border border-[#7270ea]/40'
                      : isWarning
                      ? 'bg-[#252227] text-[#f2f2f7] rounded-bl-xs border border-amber-600/40 shadow-amber-950/20'
                      : 'bg-[#24242e] text-[#f2f2f7] rounded-bl-xs border border-[#383848]'
                  }`}
                >
                  <div className="prose prose-invert prose-xs max-w-none text-inherit break-words leading-relaxed overflow-hidden">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-[13px]">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        code({ inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');
                          const snippetId = `${m.id}-${codeString.slice(0, 10)}`;

                          return !inline && match ? (
                            <div className="relative my-2.5 rounded-xl overflow-hidden border border-[#3c3c4a] bg-[#16161e] max-w-full">
                              <div className="h-6 px-2.5 bg-[#121218] border-b border-[#3c3c4a] flex items-center justify-between text-[10px] text-[#8e8e9a] font-mono">
                                <span className="uppercase">{match[1]}</span>
                                <button
                                  onClick={() => copyToClipboard(codeString, snippetId)}
                                  className="flex items-center gap-1 text-[#8e8e9a] hover:text-white transition-colors cursor-pointer"
                                  title="Copy code"
                                >
                                  {copiedId === snippetId ? (
                                    <>
                                      <Check size={10} className="text-[#34d399]" />
                                      <span className="text-[#34d399]">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={10} />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="overflow-x-auto max-w-full ide-scrollbar">
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={match[1]}
                                  PreTag="div"
                                  customStyle={{
                                    margin: 0,
                                    background: '#16161e',
                                    fontSize: '11px',
                                    padding: '8px 12px',
                                    fontFamily: "'Consolas', monospace"
                                  }}
                                  {...props}
                                >
                                  {codeString}
                                </SyntaxHighlighter>
                              </div>
                            </div>
                          ) : (
                            <code
                              className={`px-1.5 py-0.5 rounded font-mono text-[11px] break-all ${
                                isUser ? 'bg-white/20 text-white' : 'bg-[#181820] text-[#a5b4fc] border border-[#3a3a46]'
                              }`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>

                  {/* Tools used inside AI bubble */}
                  {m.toolsUsed && m.toolsUsed.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#3c3c4a]/50 flex items-center gap-1 flex-wrap">
                      <span className="text-[9px] uppercase font-bold text-[#8e8e9a]">Tools:</span>
                      {m.toolsUsed.map((tool) => (
                        <span
                          key={tool}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#181820] text-[#a5b4fc] border border-[#3a3a46] flex items-center gap-1"
                        >
                          <Terminal size={9} />
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Evidence citations */}
                  {m.evidence && m.evidence.length > 0 && (
                    <div className="mt-2 pt-1.5 flex gap-1 flex-wrap border-t border-[#3c3c4a]/30">
                      {m.evidence.map((ev, i) =>
                        ev.lineStart ? (
                          <button
                            key={i}
                            onClick={() => onNavigateToCode && onNavigateToCode(fileName || 'CodeEditor.tsx', ev.lineStart!, ev.lineEnd || ev.lineStart!)}
                            className="text-[10px] text-[#38bdf8] hover:underline flex items-center gap-1 bg-[#181820] px-1.5 py-0.5 rounded border border-[#3a3a46] transition-colors cursor-pointer"
                          >
                            <MapPin size={9} />
                            <span>Line {ev.lineStart}{ev.lineEnd && ev.lineEnd !== ev.lineStart ? `–${ev.lineEnd}` : ''}</span>
                          </button>
                        ) : null
                      )}
                    </div>
                  )}

                  {/* Timestamp & Read Receipt inside bottom-right corner of bubble */}
                  <div
                    className={`flex items-center gap-1 text-[10px] mt-2 pt-1 border-t select-none ${
                      isUser
                        ? 'justify-end text-white/75 border-white/10'
                        : 'justify-end text-[#8e8e9a] border-[#383848]/40'
                    }`}
                  >
                    <span>{timeStr}</span>
                    {isUser && (
                      <CheckCheck size={13} className="text-[#38bdf8] stroke-[2.2] ml-0.5" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading / Thinking Indicator Bubble */}
        {isLoading && (
          <div className="flex w-full justify-start">
            <div className="flex flex-col items-start max-w-[88%] sm:max-w-[82%]">
              <div className="flex items-center gap-1.5 mb-1.5 px-1 select-none">
                <div className="w-4 h-4 rounded-full bg-[#5e5ce6]/25 border border-[#5e5ce6]/45 flex items-center justify-center text-[#93c5fd]">
                  <Sparkles size={10} className="text-[#a5b4fc]" />
                </div>
                <span className="text-[11px] font-semibold text-[#e2e8f0]">CodeMind AI</span>
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-bl-xs bg-[#24242e] border border-[#383848] text-xs text-[#a5b4fc] flex items-center gap-2.5 shadow-md">
                <Loader2 size={13} className="animate-spin text-[#5e5ce6]" />
                <span className="text-[12px] text-[#cccccc]">CodeMind is thinking…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* Floating Scroll to Bottom button */}
        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom()}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[#1c1c24] hover:bg-[#282834] border border-[#2a2a34] text-white shadow-lg text-[11px] flex items-center gap-1.5 transition-all cursor-pointer z-10 opacity-90 hover:opacity-100"
          >
            <ArrowDown size={11} />
            <span>Latest</span>
          </button>
        )}
      </div>

      {/* ── Clear Chat button (if messages present) ── */}
      {messages.length > 1 && (
        <div className="px-3.5 pb-1 flex justify-end">
          <button
            onClick={handleClearMessages}
            className="text-[10px] text-[#8e8e9a] hover:text-[#f87171] transition-colors flex items-center gap-1 cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 size={10} />
            <span>Clear conversation</span>
          </button>
        </div>
      )}

      {/* ── Hidden File Input ── */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        className="hidden"
        aria-label="Upload file attachment"
      />

      {/* ── Bottom Section: Input Box + Suggestions Below ── */}
      <div className="p-2.5 sm:p-3 bg-[#121217] border-t border-[#1e1e26] shrink-0 flex flex-col gap-2">
        {/* Quick Emojis Popover Bar */}
        {showEmojiPicker && (
          <div className="flex items-center gap-1.5 p-1.5 bg-[#1c1c24] border border-[#2a2a34] rounded-xl overflow-x-auto scrollbar-none animate-fadeIn">
            {quickEmojis.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setInput(prev => prev + emoji);
                  setShowEmojiPicker(false);
                  inputRef.current?.focus();
                }}
                className="w-7 h-7 flex items-center justify-center hover:bg-[#282834] rounded-lg text-sm transition-colors cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Quick Context Injection Popover Bar */}
        {showContextPicker && (
          <div className="flex items-center gap-1.5 p-1.5 bg-[#1c1c24] border border-[#2a2a34] rounded-xl overflow-x-auto scrollbar-none text-[11px] font-mono animate-fadeIn">
            <button
              type="button"
              onClick={() => {
                setInput(p => `${p} @code `);
                setShowContextPicker(false);
                inputRef.current?.focus();
              }}
              className="px-2 py-0.5 rounded bg-[#121217] hover:bg-[#252532] text-[#a5b4fc] border border-[#2a2a34]"
            >
              @code
            </button>
            <button
              type="button"
              onClick={() => {
                setInput(p => `${p} @file:${fileName || 'CodeEditor.tsx'} `);
                setShowContextPicker(false);
                inputRef.current?.focus();
              }}
              className="px-2 py-0.5 rounded bg-[#121217] hover:bg-[#252532] text-[#a5b4fc] border border-[#2a2a34]"
            >
              @file
            </button>
            <button
              type="button"
              onClick={() => {
                setInput(p => `${p} @graph `);
                setShowContextPicker(false);
                inputRef.current?.focus();
              }}
              className="px-2 py-0.5 rounded bg-[#121217] hover:bg-[#252532] text-[#a5b4fc] border border-[#2a2a34]"
            >
              @graph
            </button>
          </div>
        )}

        {/* Messenger-Style Text Input Card (Matching Screenshot) */}
        <div className="w-full bg-[#1c1c24] border border-[#2a2a34] focus-within:border-[#5e5ce6] rounded-2xl p-2 sm:p-2.5 flex flex-col gap-1.5 shadow-md transition-all">
          {/* Text input area with responsive auto-grow */}
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              selectedNode
                ? `Ask about node #${selectedNode.id}...`
                : "Type your message..."
            }
            disabled={isLoading}
            className="w-full bg-transparent px-1.5 py-0.5 text-[13px] text-white placeholder-[#5e5e6e] focus:outline-none resize-none max-h-28 min-h-[30px] ide-scrollbar leading-relaxed"
          />

          {/* Action Icons Row (Matching Screenshot: Plus, Mic, Smile, Sticker, Sparkles, and Send) */}
          <div className="flex items-center justify-between pt-0.5 gap-1">
            {/* Left action icons — scales responsively with gap-1 sm:gap-2 */}
            <div className="flex items-center gap-1 sm:gap-2 text-[#8e8e9a] pl-0.5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setShowContextPicker(p => !p)}
                className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                  showContextPicker ? 'text-[#5e5ce6] bg-[#282834]' : 'hover:text-white'
                }`}
                title="Insert context (@code, @file, @graph)"
                aria-label="Add context"
              >
                <PlusCircle size={17} />
              </button>

              <button
                type="button"
                onClick={handleToggleVoice}
                className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                  isListening ? 'text-[#f87171] animate-pulse bg-red-950/40' : 'hover:text-white'
                }`}
                title={isListening ? 'Listening… click to stop' : 'Voice input dictation'}
                aria-label="Voice input"
              >
                <Mic size={17} />
              </button>

              <button
                type="button"
                onClick={() => setShowEmojiPicker(p => !p)}
                className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                  showEmojiPicker ? 'text-[#5e5ce6] bg-[#282834]' : 'hover:text-white'
                }`}
                title="Add emoji"
                aria-label="Add emoji"
              >
                <Smile size={17} />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded-md hover:text-white transition-colors cursor-pointer shrink-0"
                title="Attach file context"
                aria-label="Attach file"
              >
                <Paperclip size={16} />
              </button>

              <button
                type="button"
                onClick={() => setInput(p => (p.includes('@graph') ? p : `${p} @graph `))}
                className="p-1 rounded-md hover:text-white transition-colors cursor-pointer shrink-0"
                title="Inject flowchart AST graph context"
                aria-label="Inject graph"
              >
                <Sparkles size={16} className="text-[#a5b4fc]" />
              </button>
            </div>

            {/* Right: Circular Send Button with Paper Airplane */}
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#2a2a34] hover:bg-[#5e5ce6] text-white transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
              title="Send message (Enter)"
              aria-label="Send message"
            >
              <Send size={12} className="ml-0.5" />
            </button>
          </div>
        </div>

        {/* ── Suggestions Below at the Text Input Area (Requested by User) ── */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto py-0.5 w-full flex-nowrap ide-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <span className="text-[10px] text-[#8e8e9a] font-medium shrink-0 flex items-center gap-1 pl-1">
            <Sparkles size={11} className="text-[#5e5ce6]" />
            <span className="hidden sm:inline">Suggestions:</span>
          </span>
          {suggestions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isLoading}
                onClick={() => handleSend(item.prompt)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1c1c24] hover:bg-[#282834] border border-[#2a2a34] hover:border-[#5e5ce6] text-[11px] text-[#cccccc] hover:text-white transition-all shrink-0 cursor-pointer disabled:opacity-40 group shadow-xs"
              >
                <Icon size={11} className="text-[#5e5ce6] group-hover:scale-110 transition-transform" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
