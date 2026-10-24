'use client';

import React from 'react';
import {
  Palette,
  Type,
  Eye,
  Bot,
  Bell,
  Github,
  Info,
  Check,
  ChevronDown
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeName } from '@/lib/theme';

const THEMES: Array<{ id: ThemeName; name: string; previewBg: string; previewAccent: string }> = [
  { id: 'darkPlus', name: 'Dark+ (default)', previewBg: '#1e1e1e', previewAccent: '#007acc' },
  { id: 'monokai', name: 'Monokai', previewBg: '#272822', previewAccent: '#fd971f' },
  { id: 'githubDark', name: 'GitHub Dark', previewBg: '#0d1117', previewAccent: '#58a6ff' },
  { id: 'oneDark', name: 'One Dark Pro', previewBg: '#282c34', previewAccent: '#61afef' },
  { id: 'dracula', name: 'Dracula', previewBg: '#282a36', previewAccent: '#bd93f9' },
];

export default function SettingsView() {
  const {
    themeName,
    setThemeName,
    fontSize,
    setFontSize,
    lineNumbers,
    setLineNumbers,
    minimap,
    setMinimap,
    aiModel,
    setAiModel,
    notifications,
    setNotifications,
  } = useTheme();

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[#cccccc] select-none text-xs">
      {/* ── Header ── */}
      <div className="h-[35px] px-3 border-b border-[#2b2b2b] flex items-center justify-between shrink-0">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-[#858585]">
          SETTINGS
        </span>
      </div>

      {/* ── Settings Content Body ── */}
      <div className="flex-1 overflow-y-auto ide-scrollbar p-3 space-y-4">
        {/* 1. THEME SELECTOR */}
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Palette size={14} className="text-[#007acc]" />
            <span>Color Theme</span>
          </div>
          <p className="text-[11px] text-[#858585]">
            Select one of the five documented VS Code themes:
          </p>
          <div className="space-y-1">
            {THEMES.map((t) => {
              const isSelected = themeName === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setThemeName(t.id)}
                  className={`w-full p-2 rounded flex items-center justify-between border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#1e1e1e] border-[#007acc] text-white shadow-sm'
                      : 'bg-[#1e1e1e]/60 border-[#3c3c3c] text-[#cccccc] hover:bg-[#2a2d2e]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20"
                      style={{ backgroundColor: t.previewBg }}
                    />
                    <span className="font-medium text-xs">{t.name}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-[#007acc]" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. FONT SIZE & EDITOR DISPLAY */}
        <section className="space-y-2 pt-2 border-t border-[#2b2b2b]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Type size={14} className="text-[#007acc]" />
            <span>Editor Typography</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-[#1e1e1e] border border-[#3c3c3c]">
            <div>
              <div className="font-medium">Font Size</div>
              <div className="text-[11px] text-[#858585]">Controls editor font in pixels</div>
            </div>
            <div className="flex items-center gap-1">
              {[12, 13, 14, 16].map((size) => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                    fontSize === size
                      ? 'bg-[#007acc] text-white font-bold'
                      : 'bg-[#252526] text-[#858585] hover:text-white'
                  }`}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-[#1e1e1e] border border-[#3c3c3c]">
            <div>
              <div className="font-medium">Line Numbers</div>
              <div className="text-[11px] text-[#858585]">Display line numbers in editor gutter</div>
            </div>
            <div className="flex items-center gap-1">
              {(['on', 'off', 'relative'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLineNumbers(mode)}
                  className={`px-2 py-0.5 rounded text-xs font-mono capitalize transition-colors cursor-pointer ${
                    lineNumbers === mode
                      ? 'bg-[#007acc] text-white font-bold'
                      : 'bg-[#252526] text-[#858585] hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-[#1e1e1e] border border-[#3c3c3c]">
            <div>
              <div className="font-medium">Minimap</div>
              <div className="text-[11px] text-[#858585]">Shows miniature code overview</div>
            </div>
            <button
              onClick={() => setMinimap(!minimap)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                minimap ? 'bg-[#007acc]' : 'bg-[#3c3c3c]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  minimap ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        {/* 3. AI CONFIGURATION */}
        <section className="space-y-2 pt-2 border-t border-[#2b2b2b]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Bot size={14} className="text-[#007acc]" />
            <span>AI Assistant Engine</span>
          </div>

          <div className="p-2 rounded bg-[#1e1e1e] border border-[#3c3c3c] space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#858585]">Model:</span>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="bg-[#252526] border border-[#3c3c3c] text-white rounded px-2 py-0.5 focus:outline-none font-mono text-[11px]"
              >
                <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (Hybrid)</option>
                <option value="gpt-4o">OpenAI GPT-4o</option>
                <option value="deepseek-r1">Ollama DeepSeek-R1 (Local)</option>
                <option value="codemind-v2">CodeMind Neural Core v2</option>
              </select>
            </div>
            <div className="flex justify-between items-center text-[11px] text-[#858585]">
              <span>API Gateway:</span>
              <span className="text-[#73c991] font-mono">http://localhost:4000</span>
            </div>
          </div>
        </section>

        {/* 4. NOTIFICATIONS */}
        <section className="space-y-2 pt-2 border-t border-[#2b2b2b]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Bell size={14} className="text-[#007acc]" />
            <span>Notifications</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-[#1e1e1e] border border-[#3c3c3c]">
            <div>
              <div className="font-medium">System Toast Alerts</div>
              <div className="text-[11px] text-[#858585]">Notify on git sync & linter diagnostics</div>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                notifications ? 'bg-[#007acc]' : 'bg-[#3c3c3c]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  notifications ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        {/* 5. GITHUB CONNECTION STATUS */}
        <section className="space-y-2 pt-2 border-t border-[#2b2b2b]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Github size={14} className="text-[#007acc]" />
            <span>GitHub Connection</span>
          </div>

          <div className="p-2.5 rounded bg-[#1e1e1e] border border-[#3c3c3c] space-y-1 font-mono text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-[#858585]">Status:</span>
              <span className="text-[#73c991] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#73c991]" />
                Connected
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#858585]">OAuth Scope:</span>
              <span className="text-[#cccccc]">repo, read:user</span>
            </div>
          </div>
        </section>

        {/* 6. SYSTEM INFORMATION */}
        <section className="space-y-2 pt-2 border-t border-[#2b2b2b]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Info size={14} className="text-[#007acc]" />
            <span>System Information</span>
          </div>

          <div className="p-2.5 rounded bg-[#1e1e1e] border border-[#3c3c3c] font-mono text-[11px] space-y-1 text-[#858585]">
            <div className="flex justify-between">
              <span>CodeMind IDE:</span>
              <span className="text-white">v2.4.0</span>
            </div>
            <div className="flex justify-between">
              <span>Framework:</span>
              <span className="text-white">Next.js 15 (App Router)</span>
            </div>
            <div className="flex justify-between">
              <span>Monaco Editor:</span>
              <span className="text-white">v0.44.0</span>
            </div>
            <div className="flex justify-between">
              <span>Platform:</span>
              <span className="text-white">macOS / Darwin</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
