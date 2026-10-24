// client/types/flowchart.ts
// Reusable TypeScript interfaces and types for Flowchart and Project Graph visualization

export type FlowNodeType =
  | 'START'
  | 'END'
  | 'PROCESS'
  | 'DECISION'
  | 'INPUT'
  | 'OUTPUT'
  | 'FUNCTION'
  | 'LOOP'
  | 'RETURN'
  | 'ERROR'
  | 'FILE'
  | string;

export type FlowEdgeType =
  | 'YES'
  | 'NO'
  | 'CALLS'
  | 'IMPORTS'
  | 'LOOP'
  | 'RETURN'
  | 'CONTAINS'
  | 'DEFAULT'
  | string;

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  label: string;
  description?: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  functionName?: string;
  parentFileId?: string;
  data?: Record<string, any>;
  // Coordinates calculated by automatic layout algorithm
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  level?: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: FlowEdgeType;
  style?: Record<string, any>;
}

export interface FlowchartResponse {
  success: boolean;
  sessionId?: string;
  fileName?: string;
  language?: string;
  functions?: string[];
  activeFunction?: string | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
  error?: string;
  details?: string;
  metadata?: {
    nodeCount: number;
    edgeCount: number;
    statementCount?: number;
    functionCount?: number;
    complexity?: number;
  };
}

export interface ProjectGraphResponse {
  success: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  files?: string[];
  dependencies?: string[];
  error?: string;
  details?: string;
  metadata?: {
    fileCount: number;
    functionCount: number;
    nodeCount: number;
    edgeCount: number;
  };
}

export type FlowchartViewMode = 'file' | 'function' | 'project';

export type GraphLevel = 'file' | 'function' | 'combined';

export type FlowFilter = 'ALL' | 'FILES' | 'FUNCTIONS' | 'DEPENDENCIES' | 'CALLS' | 'DECISIONS' | 'LOOPS';

export interface CodeHighlightRange {
  lineStart: number;
  lineEnd: number;
  source?: string;
}

export interface SelectionAnalysisParams {
  code: string;
  language: string;
  startLine: number;
  endLine: number;
  detail?: string;
  filePath?: string;
}
