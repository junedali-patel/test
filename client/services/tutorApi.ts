// client/services/tutorApi.ts
// Client service for interacting with the CodeMind Agentic Tutor API.

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export interface TutorEvidence {
  tool: string;
  nodeId?: string | null;
  lineStart?: number | null;
  lineEnd?: number | null;
  summary?: string;
  data?: any;
}

export interface TutorAskParams {
  question: string;
  node_id?: string | null;
  session_id?: string | null;
  code?: string;
  language?: string;
  fileName?: string;
  graph?: {
    nodes: any[];
    edges: any[];
  } | null;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface TutorAskResponse {
  answer: string;
  selected_node_id?: string | null;
  evidence: TutorEvidence[];
  tools_used: string[];
  status: 'success' | 'warning' | 'error';
  provider?: string;
  iterationsUsed?: number;
  error?: string;
}

export interface TutorHealthResponse {
  status: string;
  service: string;
  ollama: {
    reachable: boolean;
    configuredModel: string;
    availableModels: string[];
  };
  sandbox: {
    available: boolean;
    mode: string;
  };
  tools: Array<{
    name: string;
    description: string;
  }>;
}

/**
 * Sends a student question with selected node context to the Agentic Tutor.
 */
export async function askTutor(params: TutorAskParams): Promise<TutorAskResponse> {
  const response = await axios.post<TutorAskResponse>(
    `${API_BASE_URL}/api/tutor/ask`,
    params,
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000 // 60s timeout for agent orchestration
    }
  );
  return response.data;
}

/**
 * Checks the health and configuration of the Agentic Tutor.
 */
export async function getTutorHealth(): Promise<TutorHealthResponse> {
  const response = await axios.get<TutorHealthResponse>(
    `${API_BASE_URL}/api/tutor/health`,
    { timeout: 5000 }
  );
  return response.data;
}
