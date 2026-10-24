
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

const LANGUAGE_ALIASES: Record<string, string> = {
  python: 'python',
  py: 'python',
  pyw: 'python',

  javascript: 'javascript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',

  typescript: 'typescript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',

  java: 'java',
};

const SUPPORTED_LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'java',
];

/**
 * Normalize a language name or file extension to the backend format.
 * Returns an empty string for unsupported languages.
 */
function normalizeLanguage(
  language?: string,
  fileName?: string
): string {
  const normalized = (language || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');

  // Use a recognized language supplied by the caller first.
  if (LANGUAGE_ALIASES[normalized]) {
    return LANGUAGE_ALIASES[normalized];
  }

  // Otherwise, detect the language from the file extension.
  const fileExtension = (fileName || '')
    .split(/[\\/]/)
    .pop()
    ?.split('.')
    .pop()
    ?.toLowerCase();

  if (fileExtension && LANGUAGE_ALIASES[fileExtension]) {
    return LANGUAGE_ALIASES[fileExtension];
  }

  return '';
}

function requireSupportedLanguage(
  language?: string,
  fileName?: string
): string {
  const result = normalizeLanguage(language, fileName);

  if (!result) {
    throw new Error(
      `Unsupported or unrecognized file language for "${fileName || 'unknown file'}". ` +
      `CodeMind.AI supports: ${SUPPORTED_LANGUAGES.join(', ')}.`
    );
  }

  return result;
}

function getErrorMessage(
  err: unknown,
  fallback: string
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { error?: string; details?: string }
      | undefined;

    if (data?.details) return data.details;
    if (data?.error) return data.error;

    if (err.code === 'ERR_NETWORK') {
      return `Cannot reach backend at ${API_BASE_URL}. Check that the server is running on port 4000.`;
    }

    if (err.response?.status === 422) {
      return 'The backend rejected the language. Supported languages are Python, JavaScript, TypeScript, and Java.';
    }

    return err.message || fallback;
  }

  return err instanceof Error ? err.message : fallback;
}

/**
 * POST /api/flowchart/analyze
 */
export async function analyzeFile(
  params: AnalyzeFileParams
): Promise<FlowchartResponse> {
  const { code, fileName, functionName } = params;
  const language = requireSupportedLanguage(params.language, fileName);

  try {
    const response = await axios.post<FlowchartResponse>(
      `${API_BASE_URL}/api/flowchart/analyze`,
      {
        code,
        language,
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
    throw new Error(
      getErrorMessage(err, 'Unable to generate flowchart.')
    );
  }
}

/**
 * POST /api/project/analyze
 */
export async function analyzeProject(
  params: AnalyzeProjectParams
): Promise<ProjectGraphResponse> {
  const { files, owner, repo } = params;

  try {
    const normalizedFiles = files.map((file) => ({
      ...file,
      language: requireSupportedLanguage(
        file.language,
        file.path || file.name
      ),
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
      response.data?.error ||
        'Invalid response from project analysis backend'
    );
  } catch (err: unknown) {
    console.error('[flowchartApi.analyzeProject] Error:', err);
    throw new Error(
      getErrorMessage(err, 'Unable to analyze project graph.')
    );
  }
}

/**
 * POST /api/flowchart/analyze/selection
 */
export async function analyzeSelection(
  params: SelectionAnalysisParams
): Promise<FlowchartResponse> {
  const {
    code,
    language: inputLanguage,
    startLine,
    endLine,
    detail = 'standard',
    filePath,
  } = params;

  const language = requireSupportedLanguage(
    inputLanguage,
    filePath || undefined
  );

  try {
    const response = await axios.post<FlowchartResponse>(
      `${API_BASE_URL}/api/flowchart/analyze/selection`,
      {
        code,
        language,
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
    throw new Error(
      getErrorMessage(err, 'Unable to analyze selection.')
    );
  }
}
