'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { AlertCircle } from 'lucide-react';
import VisualizationHeader from '@/components/visualization/VisualizationHeader';
import CodeEditor from '@/components/CodeEditor';
import IDELayout from '@/components/layout/IDELayout';
import MindMapView from '@/components/views/MindMapView'; // <--- IMPORTED VISUALIZER
import FlowchartPanel from '@/components/flowchart/FlowchartPanel';
import { FileNode } from '@/components/views/ExplorerView';
import { EditorTab } from '@/components/layout/EditorTabs';
import { FlowNode } from '@/types/flowchart';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

// Directories that are never useful to browse or analyze
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  'venv', '.venv', 'vendor', 'target', 'out', 'coverage', '.gradle', 'Pods'
]);

// ── sessionStorage cache for GitHub directory listings ──────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedDir(key: string): GitHubFile[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw) as { data: GitHubFile[]; timestamp: number };
    if (Date.now() - timestamp > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function setCachedDir(key: string, data: GitHubFile[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* storage full — ignore */ }
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

// Use shared `FileNode` and `EditorTab` types from components

export default function RepoPage() {
  const params = useParams();
  const router = useRouter();
  const { owner, repo } = params as { owner: string; repo: string };

  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  // allFiles accumulates every fetched GitHubFile across all directory expansions
  const [allFiles, setAllFiles] = useState<GitHubFile[]>([]);
  // repoContent holds only the CURRENT directory level shown in the explorer
  const [repoContent, setRepoContent] = useState<GitHubFile[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [dirContents, setDirContents] = useState<Record<string, GitHubFile[]>>({});
  const [selectedFile, setSelectedFile] = useState<GitHubFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoadingFile, setIsLoadingFile] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [streamingAnalysis, setStreamingAnalysis] = useState('');
  const [visualizationTrigger, setVisualizationTrigger] = useState<{ type: 'flowchart' | 'mindmap' | null; timestamp?: number }>({ type: null }); // eslint-disable-line @typescript-eslint/no-unused-vars

  // Flowchart & Code Navigation States
  const [highlightRange, setHighlightRange] = useState<{ lineStart: number; lineEnd: number; source?: string } | null>(null);
  const [cursorLine, setCursorLine] = useState<number | null>(null);
  const [cursorEndLine, setCursorEndLine] = useState<number | null>(null);
  const [selectedCode, setSelectedCode] = useState('');
  const [activeRightTab, setActiveRightTab] = useState<'flowchart' | 'mindmap'>('flowchart');
  const [selectedFlowNode, setSelectedFlowNode] = useState<FlowNode | null>(null);
  const [isDiagramFullscreen, setIsDiagramFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDiagramFullscreen) {
        setIsDiagramFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDiagramFullscreen]);

  // Session ID for AI Chat (starts null; AIChatView uses its own session internally)
  const [sessionId] = useState<string | null>(null);

  const handleApplySuggestion = useCallback((suggestionText: string) => {
    setFileContent(prev => prev + '\n' + suggestionText);
  }, []);

  const handleCursorChange = useCallback((line: number) => {
    setCursorLine(line);
  }, []);

  const handleSelectionChange = useCallback((start: number, end: number, text?: string) => {
    setCursorLine(start);
    setCursorEndLine(end);
    setSelectedCode(text ?? '');
  }, []);

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const getLanguage = (filename: string): string => {
    const ext = getFileExtension(filename);
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'md': 'markdown',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
    };
    return languageMap[ext] || 'plaintext';
  };

  const analyzeRepository = async () => {
    if (!repoContent.length) {
      setError('No repository content available to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setStreamingAnalysis('');

    try {
      const githubToken = localStorage.getItem('github_token');
      if (!githubToken) {
        throw new Error('GitHub authentication required. Please sign in with GitHub.');
      }

      // Recursively walk the repository tree (limited) to collect files
      const fetchAllRepoFiles = async () => {
        const collected: GitHubFile[] = [];
        const queue: GitHubFile[] = [...repoContent];
        const headers = {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        };

        while (queue.length && collected.length < 1000) {
          const item = queue.shift();
          if (!item) break;

          if (item.type === 'file') {
            collected.push(item);
            continue;
          }

          // item.type === 'dir' -> fetch its contents (skip heavy directories)
          if (SKIP_DIRS.has(item.name)) continue;
          try {
            const res = await axios.get(
              `https://api.github.com/repos/${owner}/${repo}/contents/${item.path}`,
              { headers, timeout: 30000 }
            );

            if (Array.isArray(res.data)) {
              for (const child of res.data) {
                // normalize minimal shape to GitHubFile
                queue.push(child as GitHubFile);
              }
            }
          } catch (err) {
            console.warn(`[Analysis] Failed to fetch directory ${item.path}:`, err);
          }
        }

        return collected;
      };

      const allFiles = await fetchAllRepoFiles();

      const importantFiles = allFiles
        .filter(file => file.type === 'file' && (
          file.name.endsWith('.js') ||
          file.name.endsWith('.ts') ||
          file.name.endsWith('.py') ||
          file.name.endsWith('.java') ||
          file.name === 'package.json' ||
          file.name === 'requirements.txt' ||
          file.name.toLowerCase() === 'readme.md'
        ))
        .slice(0, 10);

      if (importantFiles.length === 0) {
        setError('No supported files found for analysis');
        setIsAnalyzing(false);
        return;
      }

      console.log(`[Analysis] Analyzing ${importantFiles.length} important files...`);

      const BATCH_SIZE = 2;
      const filesWithContent = [];

      for (let i = 0; i < importantFiles.length; i += BATCH_SIZE) {
        const batch = importantFiles.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            try {
              const response = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
                {
                  headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3.raw'
                  },
                  responseType: 'text',
                  timeout: 10000
                }
              );

              return {
                path: file.path,
                name: file.name,
                content: response.data || '',
                language: getFileExtension(file.name) || 'text',
                size: file.size || 0
              };
            } catch (error) {
              console.error(`[Analysis] Error fetching ${file.path}:`, error);
              return null;
            }
          })
        );

        filesWithContent.push(...batchResults.filter(Boolean));

        if (i + BATCH_SIZE < importantFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (filesWithContent.length === 0) {
        throw new Error('Failed to fetch any file contents for analysis');
      }

      const response = await fetch(`${API_BASE_URL}/api/ai/analyze-repo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${githubToken}`
        },
        body: JSON.stringify({
          files: filesWithContent,
          owner,
          repo
        })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }
      
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      setStreamingAnalysis(
  typeof data.analysis === 'string'
    ? data.analysis.trim()
    : JSON.stringify(data.analysis, null, 2)
);

    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string }; status?: number }; message?: string };
      const errorMessage = e.response?.data?.message ||
        e.response?.data?.error ||
        e.message ||
        'Failed to analyze repository';
      console.error('[Analysis Error]', errorMessage);
      setError(`Analysis failed: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchRepoContent = useCallback(async (path: string = '') => {
    if (!owner || !repo) return;
    try {
      if (!path) setIsLoading(true);
      setError('');
      const githubToken = localStorage.getItem('github_token');

      // ── Demo / Local fallback workspace when no token or for demo repo ──
      if (!githubToken || owner === 'demo' || owner === 'codemind') {
        const rootDemoItems: GitHubFile[] = [
          { name: 'client', path: 'client', sha: 'dir_client', size: 0, url: '', html_url: '', git_url: '', download_url: null, type: 'dir', _links: { self: '', git: '', html: '' } },
          { name: '.gitignore', path: '.gitignore', sha: 'file_gitignore', size: 48, url: '', html_url: '', git_url: '', download_url: null, type: 'file', content: btoa('node_modules\n.next\n.env\ndist\nbuild\n'), encoding: 'base64', _links: { self: '', git: '', html: '' } },
          { name: 'README.md', path: 'README.md', sha: 'file_readme', size: 120, url: '', html_url: '', git_url: '', download_url: null, type: 'file', content: btoa('# CodeMind.AI\n\nNext-Generation AI-powered developer IDE.\n'), encoding: 'base64', _links: { self: '', git: '', html: '' } },
        ];

        const clientDemoItems: GitHubFile[] = [
          { name: 'app', path: 'client/app', sha: 'dir_app', size: 0, url: '', html_url: '', git_url: '', download_url: null, type: 'dir', _links: { self: '', git: '', html: '' } },
          { name: 'components', path: 'client/components', sha: 'dir_components', size: 0, url: '', html_url: '', git_url: '', download_url: null, type: 'dir', _links: { self: '', git: '', html: '' } },
        ];

        const componentsDemoItems: GitHubFile[] = [
          { name: 'AgentPanel.tsx', path: 'client/components/AgentPanel.tsx', sha: 'file_agentpanel', size: 2048, url: '', html_url: '', git_url: '', download_url: null, type: 'file', _links: { self: '', git: '', html: '' } },
          { name: 'CodeEditor.tsx', path: 'client/components/CodeEditor.tsx', sha: 'file_codeeditor', size: 3048, url: '', html_url: '', git_url: '', download_url: null, type: 'file', _links: { self: '', git: '', html: '' } },
          { name: 'MermaidChart.tsx', path: 'client/components/MermaidChart.tsx', sha: 'file_mermaidchart', size: 2100, url: '', html_url: '', git_url: '', download_url: null, type: 'file', _links: { self: '', git: '', html: '' } },
        ];

        const appDemoItems: GitHubFile[] = [
          { name: 'page.tsx', path: 'client/app/page.tsx', sha: 'file_page', size: 1200, url: '', html_url: '', git_url: '', download_url: null, type: 'file', _links: { self: '', git: '', html: '' } }
        ];

        const allDemoFiles = [...rootDemoItems, ...clientDemoItems, ...componentsDemoItems, ...appDemoItems];
        setRepoContent(rootDemoItems);
        setAllFiles(allDemoFiles);
        setDirContents({
          'client': clientDemoItems,
          'client/components': componentsDemoItems,
          'client/app': appDemoItems,
        });
        setExpandedDirs({
          'client': true,
          'client/components': true,
        });

        // Pre-select CodeEditor.tsx
        const defaultFile = componentsDemoItems.find(f => f.name === 'CodeEditor.tsx') || componentsDemoItems[0];
        if (defaultFile) {
          setSelectedFile(defaultFile);
          setFileContent(`import React, { useState, useEffect } from 'react';
import { Sparkles, Code2, Bot, Play } from 'lucide-react';

export default function CodeEditor() {
  const [activeFile, setActiveFile] = useState('CodeEditor.tsx');
  const [cursorLine, setCursorLine] = useState(1);
  const [isRunning, setIsRunning] = useState(false);

  // Analyze AST and trigger AI recommendations
  const analyzeCodeTokens = (code: string) => {
    if (!code) return [];
    const tokens = code.split(/\\s+/);
    return tokens.filter(t => t.length > 3);
  };

  const handleExecute = () => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 800);
  };

  return (
    <div className="h-full flex flex-col bg-[#080D16]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1B253D]">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-[#27C8F5]" />
          <span className="font-mono text-xs text-[#F1F5FF]">{activeFile}</span>
        </div>
        <button
          onClick={handleExecute}
          className="px-3 py-1 bg-gradient-to-r from-[#7957FF] to-[#3478FF] text-white rounded-lg text-xs"
        >
          {isRunning ? 'Running...' : 'Execute'}
        </button>
      </div>
    </div>
  );
}`);
        }
        setIsLoading(false);
        return;
      }

      // ── Check sessionStorage cache first ──────────────────────────────────
      const cacheKey = `gh_tree_${owner}/${repo}/${path}`;
      const cached = getCachedDir(cacheKey);
      if (cached) {
        console.log(`[Repo] Cache hit for path: "${path}"`);
        if (!path) {
          setRepoContent(cached);
          setAllFiles(cached);
        } else {
          setDirContents(prev => ({ ...prev, [path]: cached }));
          setAllFiles(prev => {
            const existingPaths = new Set(prev.map(f => f.path));
            const newItems = cached.filter(f => !existingPaths.has(f.path));
            return newItems.length ? [...prev, ...newItems] : prev;
          });
        }
        return;
      }

      console.log(`[Repo] Fetching repository content for path: "${path}"`);

      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
          timeout: 10000
        }
      );

      if (!response.data) {
        throw new Error('No data received from GitHub API');
      }

      const raw: GitHubFile[] = Array.isArray(response.data) ? response.data : [response.data];

      // ── Filter out heavy/irrelevant directories client-side ────────────────
      const items = raw.filter(item => !(item.type === 'dir' && SKIP_DIRS.has(item.name)));

      // Store in sessionStorage cache
      setCachedDir(cacheKey, items);

      if (!path) {
        setRepoContent(items);
        setAllFiles(items);
      } else {
        setDirContents(prev => ({ ...prev, [path]: items }));
        setAllFiles(prev => {
          const existingPaths = new Set(prev.map(f => f.path));
          const newItems = items.filter(f => !existingPaths.has(f.path));
          return newItems.length ? [...prev, ...newItems] : prev;
        });
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string }; status?: number }; message?: string };
      const errorMessage = e.response?.data?.message || e.message || 'Failed to load repository content';
      console.error('[Repo Error]', errorMessage);
      setError(`Error: ${errorMessage}`);

      if (e.response?.status === 401) {
        localStorage.removeItem('github_token');
        router.push('/');
      }
    } finally {
      setIsLoading(false);
    }
  }, [owner, repo, router]);

  useEffect(() => {
    fetchRepoContent('');
  }, [fetchRepoContent]);

  const fetchFileContent = useCallback(async (file: GitHubFile) => {
    setSelectedFile(file);
    setCursorLine(null);
    setCursorEndLine(null);
    setSelectedCode('');

    // Check embedded mock content if demo file
    if (file.path === 'client/components/CodeEditor.tsx') {
      setFileContent(`import React, { useState, useEffect } from 'react';
import { Sparkles, Code2, Bot, Play } from 'lucide-react';

export default function CodeEditor() {
  const [activeFile, setActiveFile] = useState('CodeEditor.tsx');
  const [cursorLine, setCursorLine] = useState(1);
  const [isRunning, setIsRunning] = useState(false);

  // Analyze AST and trigger AI recommendations
  const analyzeCodeTokens = (code: string) => {
    if (!code) return [];
    const tokens = code.split(/\\s+/);
    return tokens.filter(t => t.length > 3);
  };

  const handleExecute = () => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 800);
  };

  return (
    <div className="h-full flex flex-col bg-[#080D16]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1B253D]">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-[#27C8F5]" />
          <span className="font-mono text-xs text-[#F1F5FF]">{activeFile}</span>
        </div>
        <button
          onClick={handleExecute}
          className="px-3 py-1 bg-gradient-to-r from-[#7957FF] to-[#3478FF] text-white rounded-lg text-xs"
        >
          {isRunning ? 'Running...' : 'Execute'}
        </button>
      </div>
    </div>
  );
}`);
      return;
    }

    if (file.path === 'client/components/AgentPanel.tsx') {
      setFileContent(`import React, { useState } from 'react';
import { Bot, Sparkles, Send } from 'lucide-react';

export default function AgentPanel() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating'>('idle');

  const handleRunAgent = async (task: string) => {
    setStatus('generating');
    console.log('[Agent] Executing task:', task);
  };

  return (
    <div className="agent-container p-4 bg-[#0D1424] text-[#F1F5FF]">
      <div className="header flex items-center gap-2 mb-3">
        <Bot className="text-[#7957FF]" />
        <h3 className="font-bold">CodeMind Assistant</h3>
      </div>
    </div>
  );
}`);
      return;
    }

    if (file.path === 'client/components/MermaidChart.tsx') {
      setFileContent(`import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';

export default function MermaidChart({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
  }, []);

  return <div className="mermaid-chart p-4">{svg || 'Generating diagram...'}</div>;
}`);
      return;
    }

    if (file.content && file.encoding === 'base64') {
      try {
        setFileContent(atob(file.content.replace(/\n/g, '')));
        return;
      } catch {
        // continue to network fetch
      }
    }

    setFileContent('// Loading...');

    try {
      setIsLoadingFile(true);
      setError('');
      const githubToken = localStorage.getItem('github_token');
      if (!githubToken) {
        setFileContent('// Demo File: ' + file.name + '\n// CodeMind AI workspace preview');
        return;
      }

      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
          timeout: 10000
        }
      );

      if (response.data.size > 1024 * 100) {
        setFileContent(`// File is too large to display (${(response.data.size / 1024).toFixed(1)}KB)`);
        return;
      }

      if (response.data.content && response.data.encoding === 'base64') {
        const decodedContent = atob(response.data.content.replace(/\n/g, ''));
        setFileContent(decodedContent);
      } else {
        setFileContent('// Unable to decode file content');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      console.error('[File Error]', err);
      const errorMessage = e.response?.data?.message || e.message || 'Failed to load file content';
      setError(`Error: ${errorMessage}`);
      setFileContent(`// Error loading file: ${errorMessage}`);
    } finally {
      setIsLoadingFile(false);
    }
  }, [owner, repo]);

  const handleItemClick = useCallback((item: GitHubFile) => {
    if (item.type === 'dir') {
      const isExpanded = expandedDirs[item.path];
      setExpandedDirs(prev => ({
        ...prev,
        [item.path]: !isExpanded
      }));
      // Only fetch if not already loaded
      if (!isExpanded && !dirContents[item.path]) {
        fetchRepoContent(item.path);
      }
    } else {
      fetchFileContent(item);
    }
  }, [expandedDirs, dirContents, fetchRepoContent, fetchFileContent]);

  // Code-to-flowchart navigation: click node -> open file & scroll to line
  const handleNavigateToCode = useCallback(async (targetFilePath: string, lineStart: number, lineEnd?: number) => {
    const cleanTarget = targetFilePath.replace(/\\/g, '/');
    const isCurrent = selectedFile && (
      selectedFile.path === cleanTarget ||
      selectedFile.name === cleanTarget ||
      cleanTarget.endsWith(selectedFile.name) ||
      selectedFile.path.endsWith(cleanTarget)
    );

    if (!isCurrent) {
      // Search in all accumulated files (root + subdirs)
      const matchingFile = allFiles.find(
        f => f.path === cleanTarget ||
             f.name === cleanTarget ||
             f.path.endsWith('/' + cleanTarget) ||
             cleanTarget.endsWith(f.name)
      );

      if (matchingFile) {
        await fetchFileContent(matchingFile);
      }
    }

    setHighlightRange({
      lineStart,
      lineEnd: lineEnd || lineStart,
      source: 'flowchart'
    });
  }, [selectedFile, allFiles, fetchFileContent]);

  const convertToFileNodes = (rootFiles: GitHubFile[]): FileNode[] => {
    // Recursively build a nested FileNode tree
    function buildNodes(items: GitHubFile[]): FileNode[] {
      return items.map(file => {
        const node: FileNode = {
          id: file.path,
          name: file.name,
          type: file.type === 'dir' ? 'directory' : 'file'
        };
        if (file.type === 'dir' && expandedDirs[file.path] && dirContents[file.path]) {
          node.children = buildNodes(dirContents[file.path]);
        }
        return node;
      });
    }
    return buildNodes(rootFiles);
  };

  const convertFileToNode = (file: GitHubFile | null): FileNode | null => {
    if (!file) return null;
    return {
      id: file.path, // Use path instead of sha - paths are unique within a repo tree
      name: file.name,
      type: file.type === 'dir' ? 'directory' : 'file'
    };
  };

  const handleFileNodeClick = (node: FileNode) => {
    // Search all accumulated files (root + any loaded subdirectories)
    const githubFile = allFiles.find(f => f.path === node.id);
    if (githubFile) {
      handleItemClick(githubFile);
    }
  };

  const handleDirToggle = (nodeId: string) => {
    const dir = allFiles.find(f => f.path === nodeId && f.type === 'dir');
    if (dir) {
      const isExpanded = expandedDirs[dir.path];
      setExpandedDirs(prev => ({
        ...prev,
        [dir.path]: !isExpanded
      }));
      if (!isExpanded && !dirContents[dir.path]) {
        fetchRepoContent(dir.path);
      }
    }
  };


  const tabs: EditorTab[] = selectedFile ? [{
    id: selectedFile.path, // Use path instead of sha for consistency
    name: selectedFile.name,
    isDirty: false
  }] : [];

  const firstSelectableFile = repoContent.find(f => f.type === 'file') || allFiles.find(f => f.type === 'file');

  // Render the IDE shell immediately; explorer shows a skeleton while the API loads
  return (
    <IDELayout
      isTreeLoading={isLoading}
      files={convertToFileNodes(repoContent)}
      expandedDirs={expandedDirs}
      onFileClick={handleFileNodeClick}
      onDirToggle={handleDirToggle}
      selectedFile={convertFileToNode(selectedFile)}
      tabs={tabs}
      activeTabId={selectedFile?.path || ''}
      onTabClick={() => { }}
      onTabClose={() => {
        setSelectedFile(null);
        setFileContent('');
      }}
      visualizationContent={
        <div className={`flex flex-col overflow-hidden bg-[#1e1e1e] ${
          isDiagramFullscreen ? 'fixed inset-0 z-50 shadow-2xl' : 'h-full'
        }`}>
          {/* Main Visualization Header */}
          <VisualizationHeader
            activeTab={activeRightTab}
            onTabChange={setActiveRightTab}
            fileName={selectedFile?.name || null}
            isFullscreen={isDiagramFullscreen}
            onToggleFullscreen={() => setIsDiagramFullscreen(prev => !prev)}
          />
          {/* Panel body */}
          <div className="flex-1 overflow-hidden min-h-0">
            {activeRightTab === 'flowchart' ? (
              <FlowchartPanel
                code={selectedFile ? fileContent : null}
                fileName={selectedFile?.name || null}
                language={selectedFile ? getLanguage(selectedFile.name) : null}
                repoFiles={repoContent}
                owner={owner}
                repo={repo}
                cursorLine={cursorLine}
                cursorEndLine={cursorEndLine}
                onNavigateToCode={handleNavigateToCode}
                onNodeSelect={(node) => setSelectedFlowNode(node)}
                isFullscreen={isDiagramFullscreen}
                onToggleFullscreen={() => setIsDiagramFullscreen(prev => !prev)}
              />
            ) : (
              <MindMapView
                selectedFileContent={selectedFile ? fileContent : null}
                triggerGeneration={visualizationTrigger}
                fileName={selectedFile?.name || null}
                language={selectedFile ? getLanguage(selectedFile.name) : null}
              />
            )}
          </div>
        </div>
      }
      statusBarProps={{
        language: selectedFile ? getLanguage(selectedFile.name) : 'plaintext',
        branch: 'main',
        aiStatus: isAnalyzing ? 'processing' : 'ready'
      }}
      analysisPanel={streamingAnalysis || isAnalyzing ? {
        content: streamingAnalysis,
        isAnalyzing: isAnalyzing,
        onClose: () => {
          setStreamingAnalysis('');
          setIsAnalyzing(false);
        }
      } : undefined}
      selectedFlowNode={selectedFlowNode}
      editorSelection={{
        lineStart: cursorLine ?? 1,
        lineEnd: cursorEndLine ?? cursorLine ?? 1,
        text: selectedCode
      }}
      code={selectedFile ? fileContent : ''}
      fileName={selectedFile?.name || 'main.py'}
      language={selectedFile ? getLanguage(selectedFile.name) : 'plaintext'}
      onClearSelectedNode={() => setSelectedFlowNode(null)}
      onNavigateToCode={handleNavigateToCode}
      sessionId={sessionId}
      onApplySuggestion={handleApplySuggestion}
      onAnalyzeRepo={analyzeRepository}
      isAnalyzing={isAnalyzing}
      analysisResult={streamingAnalysis}
      repoAvailable={repoContent.length > 0}
      repoOwner={owner}
      repoName={repo}
    >
      <div className="h-full flex flex-col overflow-hidden">
        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm m-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-hidden min-h-0">
          {selectedFile ? (
            <CodeEditor
              code={fileContent}
              language={getLanguage(selectedFile.name)}
              height="100%"
              onChange={(newContent) => {
                setFileContent(newContent || '');
                if (highlightRange) setHighlightRange(null);
              }}
              readOnly={false}
              highlightRange={highlightRange}
              onCursorChange={handleCursorChange}
              onSelectionChange={handleSelectionChange}
            />
          ) : (
            /* VS Code-style empty editor — clean dark canvas, no feature cards */
            <div className="h-full flex flex-col items-center justify-center bg-[#0d1117] select-none">
              <p className="text-[13px] text-[#484f58]">
                Select a file from the explorer to open it
              </p>
              {firstSelectableFile && (
                <button
                  onClick={() => handleItemClick(firstSelectableFile)}
                  className="mt-3 text-[12px] text-[#2f81f7] hover:text-[#388bfd] hover:underline transition-colors"
                >
                  Open {firstSelectableFile.name}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </IDELayout>
  );
}



