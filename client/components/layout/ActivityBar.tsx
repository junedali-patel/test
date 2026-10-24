'use client';

import React from 'react';
import {
  Files,
  Search,
  GitBranch,
  Network,
  Play,
  Puzzle,
  Sparkles,
  Settings,
  User,
  Code2
} from 'lucide-react';
import Link from 'next/link';

export interface ActivityBarProps {
  activeView: string;
  isAIOpen?: boolean;
  onViewChange: (view: string) => void;
  onOpenSettings?: () => void;
  userLogin?: string;
}

interface ActivityItem {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  badge?: string | number;
}

const mainActivities: ActivityItem[] = [
  { id: 'explorer', icon: Files, label: 'Explorer (Ctrl+Shift+E)' },
  { id: 'search', icon: Search, label: 'Search (Ctrl+Shift+F)' },
  { id: 'git', icon: GitBranch, label: 'Source Control (Ctrl+Shift+G)', badge: 1 },
  { id: 'visualization', icon: Network, label: 'Flowchart & Architecture (Ctrl+Shift+M)' },
  { id: 'ai', icon: Sparkles, label: 'AI Assistant (Ctrl+Shift+I)' },
  { id: 'debug', icon: Play, label: 'Run and Debug (Ctrl+Shift+D)' },
  { id: 'extensions', icon: Puzzle, label: 'Extensions (Ctrl+Shift+X)' },
];

export default function ActivityBar({
  activeView,
  isAIOpen = false,
  onViewChange,
  onOpenSettings,
  userLogin,
}: ActivityBarProps) {
  return (
    <aside
      className="w-[48px] shrink-0 bg-[#181818] border-r border-[#2b2b2b] flex flex-col items-center py-1 select-none z-30 justify-between h-full"
      aria-label="Activity Bar"
    >
      {/* ── Top Section: Logo & Main Navigation ── */}
      <div className="w-full flex flex-col items-center">
        {/* Visual Studio / Code Icon */}
        <Link
          href="/"
          title="CodeMind.AI IDE"
          className="w-[48px] h-[40px] flex items-center justify-center text-[#007acc] hover:text-[#1177bb] transition-colors"
        >
          <Code2 size={22} className="stroke-[2.2]" />
        </Link>

        {/* Navigation Items */}
        <nav className="flex flex-col items-center w-full" aria-label="Views">
          {mainActivities.map(({ id, icon: Icon, label, badge }) => {
            const isActive = id === 'ai' ? (isAIOpen || activeView === 'ai') : activeView === id;
            return (
              <div key={id} className="relative group w-full flex justify-center">
                <button
                  type="button"
                  onClick={() => onViewChange(id)}
                  className={`relative w-[48px] h-[46px] flex items-center justify-center transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#ffffff] bg-transparent'
                      : 'text-[#858585] hover:text-[#ffffff]'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Narrow active-view indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#007acc]" />
                  )}
                  <Icon size={20} className="stroke-[1.7]" />

                  {/* Badge */}
                  {badge !== undefined && (
                    <span className="absolute top-2 right-2 min-w-[14px] h-[14px] px-1 bg-[#007acc] text-white rounded-full text-[9px] font-mono font-bold flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>

                {/* VS Code Native Style Tooltip */}
                <div
                  role="tooltip"
                  className="absolute left-[52px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center px-2 py-1 rounded-[2px] bg-[#252526] border border-[#454545] text-[11px] text-[#cccccc] shadow-md whitespace-nowrap pointer-events-none z-50 font-normal"
                >
                  {label}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* ── Bottom Section: Profile & Settings ── */}
      <div className="flex flex-col items-center w-full pb-1 border-t border-[#2b2b2b]">
        {/* User Account / Profile */}
        <div className="relative group w-full flex justify-center">
          <button
            type="button"
            className="w-[48px] h-[44px] flex items-center justify-center text-[#858585] hover:text-[#ffffff] transition-colors cursor-pointer"
            aria-label="Accounts"
          >
            <User size={19} className="stroke-[1.7]" />
          </button>
          <div
            role="tooltip"
            className="absolute left-[52px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center px-2 py-1 rounded-[2px] bg-[#252526] border border-[#454545] text-[11px] text-[#cccccc] shadow-md whitespace-nowrap pointer-events-none z-50 font-normal"
          >
            Accounts ({userLogin || 'GitHub User'})
          </div>
        </div>

        {/* Settings Gear Button */}
        <div className="relative group w-full flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (onOpenSettings) onOpenSettings();
              else onViewChange('settings');
            }}
            className={`w-[48px] h-[44px] flex items-center justify-center transition-colors cursor-pointer ${
              activeView === 'settings'
                ? 'text-[#ffffff]'
                : 'text-[#858585] hover:text-[#ffffff]'
            }`}
            aria-label="Settings"
          >
            {activeView === 'settings' && (
              <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#007acc]" />
            )}
            <Settings size={19} className="stroke-[1.7]" />
          </button>
          <div
            role="tooltip"
            className="absolute left-[52px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center px-2 py-1 rounded-[2px] bg-[#252526] border border-[#454545] text-[11px] text-[#cccccc] shadow-md whitespace-nowrap pointer-events-none z-50 font-normal"
          >
            Settings (Ctrl+,)
          </div>
        </div>
      </div>
    </aside>
  );
}
