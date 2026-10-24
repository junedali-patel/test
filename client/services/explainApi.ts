// client/services/explainApi.ts
// Client service for the AI Voice Explanation feature.
// Calls POST /api/ai/explain and returns { explanation, language, source }.

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export type ExplainLanguage = 'en' | 'hi';

export interface ExplainParams {
  code: string;
  language?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  explainLanguage: ExplainLanguage;
  nodeType?: string;
  nodeLabel?: string;
  context?: string;
}

export interface ExplainResponse {
  explanation: string;
  language: string;
  source: 'ai' | 'fallback';
}

/**
 * Request an AI explanation of the given code / flowchart node from the backend.
 * POST /api/ai/explain
 */
export async function explainCode(params: ExplainParams): Promise<ExplainResponse> {
  try {
    const response = await axios.post<ExplainResponse>(
      `${API_BASE_URL}/api/ai/explain`,
      params,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45000
      }
    );
    return response.data;
  } catch (err: unknown) {
    const e = err as {
      response?: { data?: { error?: string; details?: string } };
      code?: string;
      message?: string;
    };
    const message =
      e.response?.data?.error ||
      e.response?.data?.details ||
      (e.code === 'ERR_NETWORK'
        ? `Cannot reach backend at ${API_BASE_URL}. Is the server running on port 4000?`
        : e.message || 'Unable to generate explanation.');
    throw new Error(message);
  }
}
