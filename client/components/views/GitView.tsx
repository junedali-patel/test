'use client';

import React, { useState } from 'react';
import {
  GitBranch,
  GitCommit,
  Check,
  Plus,
  Minus,
  RotateCcw,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  FileCode,
  RefreshCw,
  ArrowDown,
  ArrowUp
} from 'lucide-react';

interface ChangedFile {
  name: string;
  path: string;
  status: 'modified' | 'untracked';
  staged: boolean;
}

const DEFAULT_CHANGED_FILES: ChangedFile[] = [
  { name: 'App.tsx', path: 'src/App.tsx', status: 'modified', staged: false },
  { name: 'NodeDetailPanel.tsx', path: 'components/flowchart/NodeDetailPanel.tsx', status: 'modified', staged: false },
  { name: 'requirements.md', path: '.kiro/specs/requirements.md', status: 'untracked', staged: false },
];

export default function GitView() {
  const [commitMessage, setCommitMessage] = useState('');
  const [files, setFiles] = useState<ChangedFile[]>(DEFAULT_CHANGED_FILES);
  const [stagedExpanded, setStagedExpanded] = useState(true);
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(false);

  const stagedFiles = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);

  const toggleStage = (path: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, staged: !f.staged } : f))
    );
  };

  const stageAll = () => {
    setFiles((prev) => prev.map((f) => ({ ...f, staged: true })));
  };

  const unstageAll = () => {
    setFiles((prev) => prev.map((f) => ({ ...f, staged: false })));
  };

  const handleCommit = () => {
    if (!commitMessage.trim()) return;
    setIsCommitting(true);
    setTimeout(() => {
      setIsCommitting(false);
      setCommitSuccess(true);
      setCommitMessage('');
      // remove staged files
      setFiles((prev) => prev.filter((f) => !f.staged));
      setTimeout(() => setCommitSuccess(false), 3000);
    }, 600);
  };

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[#cccccc] select-none text-xs">
      {/* ── Source Control Header ── */}
      <div className="h-[35px] px-3 border-b border-[#2b2b2b] flex items-center justify-between shrink-0">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-[#858585]">
          SOURCE CONTROL
        </span>

        <div className="flex items-center gap-1 text-[#858585]">
          <button
            onClick={() => stageAll()}
            className="p-1 hover:text-white hover:bg-[#2a2d2e] rounded transition-colors cursor-pointer"
            title="Stage All Changes"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={() => setFiles(DEFAULT_CHANGED_FILES)}
            className="p-1 hover:text-white hover:bg-[#2a2d2e] rounded transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
          <button
            className="p-1 hover:text-white hover:bg-[#2a2d2e] rounded transition-colors cursor-pointer"
            title="More Actions..."
          >
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* ── Branch & Sync Bar ── */}
      <div className="px-3 py-1.5 bg-[#1e1e1e] border-b border-[#2b2b2b] flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 text-white font-mono">
          <GitBranch size={13} className="text-[#007acc]" />
          <span>main*</span>
        </div>
        <div className="flex items-center gap-2 text-[#858585] text-[10px] font-mono">
          <span className="flex items-center gap-0.5"><ArrowDown size={10} /> 0</span>
          <span className="flex items-center gap-0.5"><ArrowUp size={10} /> 0</span>
        </div>
      </div>

      {/* ── Commit Box ── */}
      <div className="p-3 border-b border-[#2b2b2b] shrink-0 space-y-2">
        <textarea
          rows={2}
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Message (Ctrl+Enter to commit on 'main')"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              handleCommit();
            }
          }}
          className="w-full bg-[#1e1e1e] border border-[#3c3c3c] focus:border-[#007acc] rounded p-2 text-xs text-[#cccccc] placeholder-[#6e7681] focus:outline-none resize-none leading-relaxed font-mono"
        />

        <button
          onClick={handleCommit}
          disabled={!commitMessage.trim() || isCommitting}
          className="w-full py-1.5 bg-[#0e639c] hover:bg-[#1177bb] active:bg-[#0d598a] disabled:opacity-40 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed shadow-sm"
        >
          {commitSuccess ? (
            <>
              <Check size={13} className="text-[#4ec9b0]" />
              <span>Committed!</span>
            </>
          ) : (
            <>
              <Check size={13} />
              <span>{isCommitting ? 'Committing...' : 'Commit'}</span>
            </>
          )}
        </button>
      </div>

      {/* ── Changes Lists ── */}
      <div className="flex-1 overflow-y-auto ide-scrollbar p-1">
        {/* Staged Changes Section */}
        {stagedFiles.length > 0 && (
          <div className="mb-2">
            <div
              onClick={() => setStagedExpanded((p) => !p)}
              className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#858585] hover:text-[#cccccc] cursor-pointer hover:bg-[#2a2d2e] rounded group"
            >
              <div className="flex items-center gap-1">
                {stagedExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>STAGED CHANGES</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unstageAll();
                  }}
                  className="p-0.5 hover:text-white rounded opacity-0 group-hover:opacity-100"
                  title="Unstage All"
                >
                  <Minus size={11} />
                </button>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#3c3c3c] text-white rounded-full">
                  {stagedFiles.length}
                </span>
              </div>
            </div>

            {stagedExpanded && (
              <div className="space-y-0.5 mt-0.5">
                {stagedFiles.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-3 py-1 hover:bg-[#2a2d2e] rounded cursor-pointer group text-xs font-mono"
                  >
                    <FileCode size={13} className="text-[#519aba] shrink-0" />
                    <span className="text-white truncate flex-1">{file.name}</span>
                    <span className="text-[10px] text-[#858585] truncate max-w-[80px]">
                      {file.path.split('/').slice(0, -1).join('/')}
                    </span>
                    <button
                      onClick={() => toggleStage(file.path)}
                      className="p-1 text-[#858585] hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Unstage Changes"
                    >
                      <Minus size={11} />
                    </button>
                    <span
                      className={`text-[10px] font-bold font-mono ${
                        file.status === 'modified' ? 'text-[#e2c08d]' : 'text-[#4ec9b0]'
                      }`}
                    >
                      {file.status === 'modified' ? 'M' : 'U'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Changes Section */}
        <div>
          <div
            onClick={() => setChangesExpanded((p) => !p)}
            className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#858585] hover:text-[#cccccc] cursor-pointer hover:bg-[#2a2d2e] rounded group"
          >
            <div className="flex items-center gap-1">
              {changesExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>CHANGES</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stageAll();
                }}
                className="p-0.5 hover:text-white rounded opacity-0 group-hover:opacity-100"
                title="Stage All"
              >
                <Plus size={11} />
              </button>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#3c3c3c] text-white rounded-full">
                {unstagedFiles.length}
              </span>
            </div>
          </div>

          {changesExpanded && (
            <div className="space-y-0.5 mt-0.5">
              {unstagedFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-2 px-3 py-1 hover:bg-[#2a2d2e] rounded cursor-pointer group text-xs font-mono"
                >
                  <FileCode size={13} className="text-[#519aba] shrink-0" />
                  <span className="text-[#cccccc] group-hover:text-white truncate flex-1">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-[#858585] truncate max-w-[80px]">
                    {file.path.split('/').slice(0, -1).join('/')}
                  </span>
                  <button
                    onClick={() => toggleStage(file.path)}
                    className="p-1 text-[#858585] hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Stage Changes"
                  >
                    <Plus size={11} />
                  </button>
                  <span
                    className={`text-[10px] font-bold font-mono ${
                      file.status === 'modified' ? 'text-[#e2c08d]' : 'text-[#4ec9b0]'
                    }`}
                  >
                    {file.status === 'modified' ? 'M' : 'U'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
