// client/components/flowchart/ProjectGraph.tsx
// Component for rendering repository-wide project graph architectures with File, Function, and Combined levels

'use client';

import React, { useMemo } from 'react';
import { FlowNode, FlowEdge, GraphLevel, FlowFilter } from '@/types/flowchart';
import { layoutProjectGraph } from './flowLayout';
import FlowchartCanvas from './FlowchartCanvas';

interface ProjectGraphProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  graphLevel: GraphLevel;
  filter: FlowFilter;
  searchQuery: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  selectedNodeId?: string | null;
  onNodeClick?: (node: FlowNode) => void;
  showMinimap?: boolean;
}

export default function ProjectGraph({
  nodes,
  edges,
  graphLevel,
  filter,
  searchQuery,
  zoom,
  onZoomChange,
  selectedNodeId,
  onNodeClick,
  showMinimap = true
}: ProjectGraphProps) {
  // Apply filtering based on active filter pill
  const filteredData = useMemo(() => {
    let filteredNodes = nodes;
    let filteredEdges = edges;

    if (filter === 'FILES') {
      filteredNodes = nodes.filter(n => n.type === 'FILE');
      const fileIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = edges.filter(e => fileIds.has(e.source) && fileIds.has(e.target));
    } else if (filter === 'FUNCTIONS') {
      filteredNodes = nodes.filter(n => n.type === 'FUNCTION');
      const funcIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = edges.filter(e => funcIds.has(e.source) && funcIds.has(e.target));
    } else if (filter === 'CALLS') {
      const callEdges = edges.filter(e => e.type === 'CALLS');
      const callNodeIds = new Set<string>();
      callEdges.forEach(e => {
        callNodeIds.add(e.source);
        callNodeIds.add(e.target);
      });
      filteredNodes = nodes.filter(n => callNodeIds.has(n.id));
      filteredEdges = callEdges;
    }

    return { filteredNodes, filteredEdges };
  }, [nodes, edges, filter]);

  // Compute layout for the project graph
  const layoutResult = useMemo(() => {
    return layoutProjectGraph(filteredData.filteredNodes, filteredData.filteredEdges, graphLevel);
  }, [filteredData.filteredNodes, filteredData.filteredEdges, graphLevel]);

  return (
    <div className="w-full h-full relative">
      <FlowchartCanvas
        nodes={layoutResult.nodes}
        edges={layoutResult.edges}
        bounds={layoutResult.bounds}
        zoom={zoom}
        onZoomChange={onZoomChange}
        selectedNodeId={selectedNodeId}
        searchQuery={searchQuery}
        showMinimap={showMinimap}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}
