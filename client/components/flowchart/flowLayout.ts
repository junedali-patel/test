// client/components/flowchart/flowLayout.ts
// Hierarchical top-down layout engine for control-flow graphs
// Uses a proper BFS-based longest-path layer assignment so branches spread horizontally

import { FlowNode, FlowEdge, GraphLevel } from '@/types/flowchart';

export interface LayoutResult {
  nodes: FlowNode[];
  edges: FlowEdge[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

// ─── Node sizing ──────────────────────────────────────────────────────────────

export function getNodeDimensions(node: FlowNode): { width: number; height: number } {
  const labelLen = (node.label || '').length;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  switch (node.type) {
    case 'START':
    case 'END':
      return { width: clamp(labelLen * 10 + 80, 160, 240), height: 56 };
    case 'DECISION':
      // hexagon needs extra padding on left/right for the clip-path
      return { width: clamp(labelLen * 11 + 100, 240, 360), height: 110 };
    case 'LOOP':
      return { width: clamp(labelLen * 9 + 80, 220, 320), height: 92 };
    case 'FUNCTION':
      return { width: clamp(labelLen * 9 + 90, 240, 360), height: 90 };
    case 'INPUT':
    case 'OUTPUT':
      return { width: clamp(labelLen * 9 + 80, 230, 340), height: 84 };
    case 'RETURN':
      return { width: clamp(labelLen * 9 + 70, 200, 300), height: 66 };
    case 'ERROR':
      return { width: clamp(labelLen * 9 + 80, 220, 320), height: 80 };
    case 'FILE':
      return { width: 260, height: 92 };
    default:
      // PROCESS
      return { width: clamp(labelLen * 9 + 80, 240, 360), height: 84 };
  }
}

// ─── Control-flow graph layout ────────────────────────────────────────────────

export function layoutControlFlowGraph(
  rawNodes: FlowNode[],
  rawEdges: FlowEdge[]
): LayoutResult {
  if (!rawNodes || rawNodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 }
    };
  }

  // Attach dimensions
  const nodeMap = new Map<string, FlowNode & { width: number; height: number; level: number; x: number; y: number }>();
  rawNodes.forEach(node => {
    const { width, height } = getNodeDimensions(node);
    nodeMap.set(node.id, { ...node, width, height, level: 0, x: 0, y: 0 });
  });

  // Build forward adjacency (skip LOOP back-edges to avoid cycles, but keep LOOP *forward* edges)
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  rawNodes.forEach(n => { outgoing.set(n.id, []); incoming.set(n.id, []); });

  // Separate: back-edges (target is an ancestor = loop-back) vs forward edges
  rawEdges.forEach(e => {
    if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) return;
    if (e.source === e.target) return; // skip self-edges
    // Only skip edges where the label/type is LOOP AND the target is START-side (back-edge)
    // We identify a back-edge as one where source appears AFTER target in raw order
    const srcIdx = rawNodes.findIndex(n => n.id === e.source);
    const tgtIdx = rawNodes.findIndex(n => n.id === e.target);
    const isLoopBackEdge = (e.type === 'LOOP' || e.label === 'LOOP') && tgtIdx < srcIdx;
    if (isLoopBackEdge) return; // skip loop-back edges only
    outgoing.get(e.source)!.push(e.target);
    incoming.get(e.target)!.push(e.source);
  });

  // ── Longest-path layer assignment (BFS from roots) ──────────────────────────
  // This gives a correct level to every node even in branching graphs.
  const level = new Map<string, number>();

  // Find roots (in-degree 0 in the DAG, or the explicit START node)
  const roots = rawNodes
    .filter(n => incoming.get(n.id)!.length === 0 || n.type === 'START')
    .map(n => n.id);
  if (roots.length === 0) roots.push(rawNodes[0].id);

  // BFS: propagate longest path
  roots.forEach(r => level.set(r, 0));
  const queue = [...roots];
  const seen = new Set<string>(roots);

  while (queue.length) {
    const cur = queue.shift()!;
    const curLevel = level.get(cur)!;
    for (const next of outgoing.get(cur) || []) {
      const prev = level.get(next) ?? -1;
      if (curLevel + 1 > prev) {
        level.set(next, curLevel + 1);
      }
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  // Assign fallback level for any unreachable nodes
  rawNodes.forEach((n, idx) => {
    if (!level.has(n.id)) level.set(n.id, idx);
  });

  // Apply levels to nodeMap
  nodeMap.forEach((node, id) => { node.level = level.get(id) ?? 0; });

  // ── Group nodes by level ────────────────────────────────────────────────────
  const levelGroups = new Map<number, Array<FlowNode & { width: number; height: number; level: number; x: number; y: number }>>();
  nodeMap.forEach(node => {
    const lvl = node.level;
    if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
    levelGroups.get(lvl)!.push(node);
  });

  const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);

  // ── Vertical / horizontal spacing constants ─────────────────────────────────
  const H_GAP = 100;   // horizontal gap between sibling nodes
  const V_GAP = 160;   // vertical gap between rows — larger for readability
  const START_Y = 80;
  const CENTER_X = 600; // reference centre X for the canvas

  // ── Position nodes ──────────────────────────────────────────────────────────
  sortedLevels.forEach(lvl => {
    const group = levelGroups.get(lvl)!;

    // Sort: YES-branch nodes to the left, NO-branch to the right, rest in order
    group.sort((a, b) => {
      const edgeToA = rawEdges.find(e => e.target === a.id && (incoming.get(a.id) || []).includes(e.source));
      const edgeToB = rawEdges.find(e => e.target === b.id && (incoming.get(b.id) || []).includes(e.source));
      const scoreA = edgeToA?.label === 'YES' ? -1 : edgeToA?.label === 'NO' ? 1 : 0;
      const scoreB = edgeToB?.label === 'YES' ? -1 : edgeToB?.label === 'NO' ? 1 : 0;
      return scoreA - scoreB;
    });

    // Total row width
    const totalWidth = group.reduce((s, n) => s + n.width, 0) + H_GAP * (group.length - 1);
    let x = CENTER_X - totalWidth / 2;
    const y = START_Y + lvl * V_GAP;

    group.forEach(node => {
      node.x = x;
      node.y = y;
      x += node.width + H_GAP;
    });
  });

  const layoutedNodes = Array.from(nodeMap.values()) as FlowNode[];

  // ── Bounding box ────────────────────────────────────────────────────────────
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  layoutedNodes.forEach(n => {
    minX = Math.min(minX, n.x ?? 0);
    minY = Math.min(minY, n.y ?? 0);
    maxX = Math.max(maxX, (n.x ?? 0) + (n.width ?? 200));
    maxY = Math.max(maxY, (n.y ?? 0) + (n.height ?? 74));
  });

  const PAD = 120;
  return {
    nodes: layoutedNodes,
    edges: rawEdges,
    bounds: {
      minX: minX - PAD,
      minY: minY - PAD,
      maxX: maxX + PAD,
      maxY: maxY + PAD,
      width: Math.max(900, maxX - minX + PAD * 2),
      height: Math.max(600, maxY - minY + PAD * 2)
    }
  };
}

// ─── Project graph layout (multi-file) ────────────────────────────────────────

export function layoutProjectGraph(
  rawNodes: FlowNode[],
  rawEdges: FlowEdge[],
  graphLevel: GraphLevel = 'combined'
): LayoutResult {
  let filteredNodes = rawNodes;
  let filteredEdges = rawEdges;

  if (graphLevel === 'file') {
    filteredNodes = rawNodes.filter(n => n.type === 'FILE');
    const fileIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = rawEdges.filter(e => fileIds.has(e.source) && fileIds.has(e.target));
  } else if (graphLevel === 'function') {
    filteredNodes = rawNodes.filter(n => n.type === 'FUNCTION');
    const funcIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = rawEdges.filter(e => funcIds.has(e.source) && funcIds.has(e.target));
  }

  if (filteredNodes.length === 0) {
    return { nodes: [], edges: [], bounds: { minX: 0, minY: 0, maxX: 900, maxY: 600, width: 900, height: 600 } };
  }

  if (graphLevel !== 'combined') {
    return layoutControlFlowGraph(filteredNodes, filteredEdges);
  }

  // Combined: file nodes in columns, their functions stacked below
  const nodeMap = new Map<string, FlowNode>();
  filteredNodes.forEach(n => {
    const { width, height } = getNodeDimensions(n);
    nodeMap.set(n.id, { ...n, width, height, x: 0, y: 0 });
  });

  const fileNodes = filteredNodes.filter(n => n.type === 'FILE');
  const funcNodes = filteredNodes.filter(n => n.type === 'FUNCTION');
  const COL_GAP = 340;
  const ROW_GAP = 110;
  const startX = 80;
  const startY = 80;

  fileNodes.forEach((fileNode, fileIdx) => {
    const colX = startX + fileIdx * COL_GAP;
    let curY = startY;
    const fn = nodeMap.get(fileNode.id)!;
    fn.x = colX; fn.y = curY;
    curY += (fn.height ?? 88) + ROW_GAP;

    funcNodes
      .filter(f => (f as { parentFileId?: string }).parentFileId === fileNode.id || f.file === fileNode.file)
      .forEach(f => {
        const fn2 = nodeMap.get(f.id)!;
        fn2.x = colX + 24; fn2.y = curY;
        curY += (fn2.height ?? 84) + ROW_GAP;
      });
  });

  const layouted = Array.from(nodeMap.values());
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  layouted.forEach(n => {
    minX = Math.min(minX, n.x ?? 0);
    minY = Math.min(minY, n.y ?? 0);
    maxX = Math.max(maxX, (n.x ?? 0) + (n.width ?? 200));
    maxY = Math.max(maxY, (n.y ?? 0) + (n.height ?? 70));
  });

  return {
    nodes: layouted,
    edges: filteredEdges,
    bounds: {
      minX: minX - 100, minY: minY - 60,
      maxX: maxX + 100, maxY: maxY + 80,
      width: Math.max(900, maxX - minX + 200),
      height: Math.max(600, maxY - minY + 160)
    }
  };
}
