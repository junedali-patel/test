'use client';

import React from 'react';
import {
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  FileCode2,
  FileJson,
  FileText,
  FileSpreadsheet,
  GitBranch,
  File,
  Code,
  FileCog
} from 'lucide-react';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  icon?: string;
  status?: 'modified' | 'untracked' | 'normal';
}

interface ExplorerViewProps {
  files: FileNode[];
  expandedDirs: Record<string, boolean>;
  onFileClick: (file: FileNode) => void;
  onDirToggle: (path: string) => void;
  selectedFile: FileNode | null;
}

// Returns appropriate icon and color for a file based on its extension
function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const iconClass = 'shrink-0 transition-colors';

  if (name === '.gitignore' || ext === 'gitignore') {
    return <GitBranch size={14} className={`text-[#f34f29] ${iconClass}`} />;
  }
  if (['tsx', 'jsx'].includes(ext)) {
    return <Code size={14} className={`text-[#519aba] ${iconClass}`} />;
  }
  if (['ts', 'js'].includes(ext)) {
    return <FileCode2 size={14} className={`text-[#519aba] ${iconClass}`} />;
  }
  if (ext === 'py') {
    return <FileCode2 size={14} className={`text-[#3572A5] ${iconClass}`} />;
  }
  if (ext === 'json') {
    return <FileJson size={14} className={`text-[#cbcb41] ${iconClass}`} />;
  }
  if (['md', 'txt', 'rst'].includes(ext)) {
    return <FileText size={14} className={`text-[#969696] ${iconClass}`} />;
  }
  if (['css', 'scss', 'less'].includes(ext)) {
    return <FileSpreadsheet size={14} className={`text-[#519aba] ${iconClass}`} />;
  }
  if (['config.js', 'config.ts', 'config.json'].some(s => name.endsWith(s))) {
    return <FileCog size={14} className={`text-[#dcb67a] ${iconClass}`} />;
  }
  return <File size={14} className={`text-[#519aba] ${iconClass}`} />;
}

function getFileStatusIndicator(name: string, status?: string) {
  if (status === 'modified' || name === 'App.tsx') {
    return <span className="text-[10px] font-mono font-bold text-[#e2c08d] ml-auto shrink-0 pr-1">M</span>;
  }
  if (status === 'untracked' || name.startsWith('.') || name.includes('spec')) {
    return <span className="text-[10px] font-mono font-bold text-[#73c991] ml-auto shrink-0 pr-1">U</span>;
  }
  return null;
}

function FileTreeItem({
  file,
  depth,
  expandedDirs,
  selectedId,
  onFileClick,
  onDirToggle,
}: {
  file: FileNode;
  depth: number;
  expandedDirs: Record<string, boolean>;
  selectedId: string | null;
  onFileClick: (file: FileNode) => void;
  onDirToggle: (path: string) => void;
}) {
  const isDirectory = file.type === 'directory';
  const isExpanded = isDirectory && !!expandedDirs[file.id];
  const isSelected = selectedId === file.id;
  const indent = depth * 14;

  return (
    <div className="w-full">
      <div
        className={`group relative flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer select-none transition-colors text-xs ${
          isSelected
            ? 'bg-[#094771] text-white font-medium'
            : 'text-[#cccccc] hover:text-white hover:bg-[#2a2d2e]'
        }`}
        style={{ paddingLeft: `${8 + indent}px` }}
        onClick={() => {
          if (isDirectory) {
            onDirToggle(file.id);
          } else {
            onFileClick(file);
          }
        }}
      >
        {/* Directory chevron & folder icon */}
        {isDirectory ? (
          <>
            <span className="shrink-0 text-[#858585] group-hover:text-white transition-colors">
              {isExpanded ? (
                <ChevronDown size={13} className="transition-transform" />
              ) : (
                <ChevronRight size={13} className="transition-transform" />
              )}
            </span>
            {isExpanded ? (
              <FolderOpen size={14} className="shrink-0 text-[#dcb67a]" />
            ) : (
              <Folder size={14} className="shrink-0 text-[#dcb67a]" />
            )}
          </>
        ) : (
          <>
            <span className="w-[13px] shrink-0" />
            {getFileIcon(file.name)}
          </>
        )}

        {/* Filename */}
        <span
          className={`text-[12px] font-mono tracking-tight truncate leading-tight ${
            isSelected
              ? 'text-white font-medium'
              : 'text-[#cccccc] group-hover:text-white'
          }`}
        >
          {file.name}
        </span>

        {/* Status indicator (M / U) */}
        {!isDirectory && getFileStatusIndicator(file.name, file.status)}
      </div>

      {/* Nested children */}
      {isDirectory && isExpanded && file.children && file.children.length > 0 && (
        <div className="relative">
          {/* VS Code classic indent guide */}
          <div
            className="absolute top-0 bottom-0 border-l border-[#3c3c3c]/50 pointer-events-none"
            style={{ left: `${14 + indent}px` }}
          />
          {file.children.map((child) => (
            <FileTreeItem
              key={child.id}
              file={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              selectedId={selectedId}
              onFileClick={onFileClick}
              onDirToggle={onDirToggle}
            />
          ))}
        </div>
      )}

      {/* Empty directory indicator */}
      {isDirectory && isExpanded && (!file.children || file.children.length === 0) && (
        <div
          className="text-[#858585] text-[11px] font-mono py-1"
          style={{ paddingLeft: `${8 + indent + 28}px` }}
        >
          (empty)
        </div>
      )}
    </div>
  );
}

export default function ExplorerView({
  files,
  expandedDirs,
  onFileClick,
  onDirToggle,
  selectedFile,
}: ExplorerViewProps) {
  if (files.length === 0) {
    return (
      <div className="px-4 py-8 text-[#858585] text-xs font-mono text-center flex flex-col items-center justify-center gap-2">
        <File size={22} className="opacity-40 text-[#519aba]" />
        <p>No files loaded</p>
      </div>
    );
  }

  return (
    <div className="w-full py-1 ide-panel overflow-y-auto ide-scrollbar select-none">
      {files.map((file) => (
        <FileTreeItem
          key={file.id}
          file={file}
          depth={0}
          expandedDirs={expandedDirs}
          selectedId={selectedFile?.id ?? null}
          onFileClick={onFileClick}
          onDirToggle={onDirToggle}
        />
      ))}
    </div>
  );
}
