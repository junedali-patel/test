
 // client/services/flowchartApi.ts
 // Service layer for CodeMind.AI flowchart and project graph analysis APIs

import axios from 'axios';
import type {
  FlowchartResponse,
  ProjectGraphResponse,
  SelectionAnalysisParams,
} from '@/types/flowchart';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export interface AnalyzeFileParams {
  code: string;
  language: string;
  fileName: string;
  functionName?: string | null;
}

export interface AnalyzeProjectParams {
  files: Array<{
    path: string;
    content?: string;
    name?: string;
    language?: string;
    size?: number;
  }>;
  owner?: string;
  repo?: string;
}

/**
 * Normalize common language names and file extensions.
 * The backend must support the resulting language identifier.
 */
function normalizeLanguage(language: string, fileName?: string): string {
  const rawLanguage = (language || '').trim().toLowerCase();
  const extension = (fileName || '').split('.').pop()?.toLowerCase() || '';

  const aliases: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    javascript: 'javascript',
    'node.js': 'javascript',

    ts: 'typescript',
    tsx: 'typescript',
    typescript: 'typescript',

    py: 'python',
    python: 'python',

    java: 'java',
    c: 'c',
    cpp: 'cpp',
    'c++': 'cpp',
    cs: 'csharp',
    csharp: 'csharp',

    go: 'go',
    rust: 'rust',
    php: 'php',
    ruby: 'ruby',

    html: 'html',
    css: 'css',
    json: 'json',
  };

  // Prefer a recognized language value supplied by the caller.
  if (aliases[rawLanguage]) {
    return aliases[rawLanguage];
  }

  // If the language is unknown, try to identify it from the filename.
  if (aliases[extension]) {
    return aliases[extension];
  }

  // Preserve unknown values so the backend can report its supported languages.
  return rawLanguage || 'unknown';
}

/**
 * Request flowchart analysis for a single file or function.
 * POST /api/flowchart/analyze
 */
export async function analyzeFile(
  params: AnalyzeFileParams
): Promise<FlowchartResponse> {
  const { code, language, fileName, functionName } = params;
  const normalizedLanguage = normalizeLanguage(language, fileName);

  try {
    const response = await axios.post<FlowchartResponse>(
      `${API_BASE_URL}/api/flowchart/analyze`,
      {
        code,
        language: normalizedLanguage,
        fileName,
        functionName: functionName || null,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000,
      }
    );

    if (response.data?.success) {
      return response.data;
    }

    throw new Error(
      response.data?.error || 'Invalid response from flowchart backend'
    );
  } catch (err: unknown) {
    console.error('[flowchartApi.analyzeFile] Error:', err);

    const error = err as {
      response?: {
        status?: number;
        data?: {
          error?: string;
          details?: string;
          supportedLanguages?: string[];
        };
      };
      code?: string;
      message?: string;
    };

    const serverMessage =
      error.response?.data?.error ||
      error.response?.data?.details;

    const message =
      serverMessage ||
      (error.response?.status === 422
        ? `The backend rejected language "${normalizedLanguage}" for file "${fileName}". Check the backend's supported-language list.`
        : error.code === 'ERR_NETWORK'
          ? `Cannot reach backend server at ${API_BASE_URL}. Check that the server is running on port 4000.`
          : error.message || 'Unable to generate flowchart. Please check the source code.');

    throw new Error(message);
  }
}

/**
 * Request project-level graph analysis for repository files.
 * POST /api/project/analyze
 */
export async function analyzeProject(
  params: AnalyzeProjectParams
): Promise<ProjectGraphResponse> {
  const { files, owner, repo } = params;

  try {
    const normalizedFiles = files.map((file) => ({
      ...file,
      language: file.language
        ? normalizeLanguage(file.language, file.path || file.name)
        : normalizeLanguage('', file.path || file.name),
    }));

    const response = await axios.post<ProjectGraphResponse>(
      `${API_BASE_URL}/api/project/analyze`,
      {
        files: normalizedFiles,
        owner,
        repo,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45000,
      }
    );

    if (response.data?.success) {
      return response.data;
    }

    throw new Error(
      response.data?.error || 'Invalid response from project analysis backend'
    );
  } catch (err: unknown) {
    console.error('[flowchartApi.analyzeProject] Error:', err);

    const error = err as {
      response?: {
        status?: number;
        data?: { error?: string; details?: string };
      };
      code?: string;
      message?: string;
    };

    const message =
      error.response?.data?.error ||
      error.response?.data?.details ||
      (error.response?.status === 422
        ? 'The backend rejected one or more project file languages. Check the backend supported-language list.'
        : error.code === 'ERR_NETWORK'
          ? `Cannot reach backend server at ${API_BASE_URL}. Check that the server is running on port 4000.`
          : error.message || 'Unable to analyze project graph. Please verify repository files.');

    throw new Error(message);
  }
}

/**
 * Request selection-aware flowchart from the backend.
 * POST /api/flowchart/analyze/selection
 */
export async function analyzeSelection(
  params: SelectionAnalysisParams
): Promise<FlowchartResponse> {
  const {
    code,
    language,
    startLine,
    endLine,
    detail = 'standard',
    filePath,
  } = params;

  const normalizedLanguage = normalizeLanguage(language, filePath || '');

  try {
    const response = await axios.post<FlowchartResponse>(
      `${API_BASE_URL}/api/flowchart/analyze/selection`,
      {
        code,
        language: normalizedLanguage,
        startLine,
        endLine,
        detail,
        filePath: filePath || null,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    if (response.data?.success) {
      return response.data;
    }

    throw new Error(
      response.data?.error ||
        'Invalid response from selection analysis backend'
    );
  } catch (err: unknown) {
    console.error('[flowchartApi.analyzeSelection] Error:', err);

    const error = err as {
      response?: {
        status?: number;
        data?: { error?: string; details?: string };
      };
      code?: string;
      message?: string;
    };

    const message =
      error.response?.data?.error ||
      error.response?.data?.details ||
      (error.response?.status === 422
        ? `The backend rejected language "${normalizedLanguage}" for selection analysis. Check the backend's supported-language list.`
        : error.code === 'ERR_NETWORK'
          ? `Cannot reach backend server at ${API_BASE_URL}. Check that the server is running on port 4000.`
          : error.message || 'Unable to analyze selection.');

    throw new Error(message);
  }
}
