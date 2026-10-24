// server/tutor/tools/getNode.js
// Tool A: get_node
// Retrieves verified node details from the actual generated code graph.

const { sessionManager } = require('../sessionManager');

const getNodeToolDefinition = {
  name: 'get_node',
  description: 'Retrieve details about a specific node in the generated code flowchart/mind-map graph, including type, code snippet, source lines, incoming/outgoing edges, and conditional branches.',
  parameters: {
    type: 'object',
    properties: {
      node_id: {
        type: 'string',
        description: 'The unique ID of the node to inspect (e.g., "node_1", "node_decision_2")'
      },
      session_id: {
        type: 'string',
        description: 'Optional session ID for the active code analysis'
      }
    },
    required: ['node_id']
  },

  /**
   * Executes the get_node lookup
   * @param {Object} args
   * @param {string} args.node_id
   * @param {string} [args.session_id]
   * @param {Object} context - Execution context (session, graph, code)
   */
  async execute(args, context = {}) {
    const { node_id, session_id } = args;

    if (!node_id || typeof node_id !== 'string') {
      return {
        found: false,
        error: 'A valid string node_id is required.'
      };
    }

    // Resolve graph source: from context or sessionManager
    const session = context.session ||
      (session_id ? sessionManager.getSession(session_id) : null) ||
      (context.sessionId ? sessionManager.getSession(context.sessionId) : null);

    const nodes = (context.nodes && context.nodes.length > 0)
      ? context.nodes
      : (context.graph?.nodes || session?.nodes || []);

    const edges = (context.edges && context.edges.length > 0)
      ? context.edges
      : (context.graph?.edges || session?.edges || []);

    const sourceCode = context.code || session?.code || '';
    const fileName = context.fileName || session?.fileName || 'unknown';

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return {
        found: false,
        error: 'No graph data available in the current session. Please ensure code has been analyzed.',
        node_id
      };
    }

    // Look up node by exact ID, or fallback to case-insensitive match
    let targetNode = nodes.find(n => n.id === node_id);
    if (!targetNode) {
      targetNode = nodes.find(n => n.id.toLowerCase() === node_id.toLowerCase());
    }

    if (!targetNode) {
      return {
        found: false,
        error: `Node with ID "${node_id}" was not found in the graph.`,
        node_id,
        availableNodes: nodes.slice(0, 10).map(n => ({ id: n.id, label: n.label, type: n.type }))
      };
    }

    // Helper to get label for a given node ID
    const getNodeSummary = (id) => {
      const match = nodes.find(n => n.id === id);
      return match ? { id: match.id, label: match.label, type: match.type } : { id };
    };

    // Calculate incoming and outgoing edges
    const incomingEdges = edges
      .filter(e => e.target === targetNode.id)
      .map(e => ({
        edgeId: e.id,
        fromNodeId: e.source,
        label: e.label || null,
        type: e.type || 'DEFAULT',
        fromNode: getNodeSummary(e.source)
      }));

    const outgoingEdges = edges
      .filter(e => e.source === targetNode.id)
      .map(e => ({
        edgeId: e.id,
        toNodeId: e.target,
        label: e.label || null,
        type: e.type || 'DEFAULT',
        toNode: getNodeSummary(e.target)
      }));

    // Identify branches (e.g. YES / NO / TRUE / FALSE)
    const branches = {};
    for (const outEdge of outgoingEdges) {
      const normLabel = (outEdge.label || '').toUpperCase();
      if (normLabel === 'YES' || normLabel === 'TRUE') {
        branches.trueBranch = {
          targetId: outEdge.toNodeId,
          targetLabel: outEdge.toNode.label,
          targetType: outEdge.toNode.type
        };
      } else if (normLabel === 'NO' || normLabel === 'FALSE') {
        branches.falseBranch = {
          targetId: outEdge.toNodeId,
          targetLabel: outEdge.toNode.label,
          targetType: outEdge.toNode.type
        };
      }
    }

    // Extract exact source lines if code is available
    let sourceSnippet = targetNode.code || '';
    if (!sourceSnippet && sourceCode && targetNode.lineStart) {
      const lines = sourceCode.split(/\r?\n/);
      const start = Math.max(0, targetNode.lineStart - 1);
      const end = targetNode.lineEnd ? Math.min(lines.length, targetNode.lineEnd) : start + 1;
      sourceSnippet = lines.slice(start, end).join('\n');
    }

    return {
      found: true,
      nodeId: targetNode.id,
      nodeType: (targetNode.type || 'PROCESS').toUpperCase(),
      label: targetNode.label || '',
      codeSnippet: sourceSnippet,
      fileName: targetNode.file || fileName,
      lineStart: targetNode.lineStart || null,
      lineEnd: targetNode.lineEnd || targetNode.lineStart || null,
      conditionOrOperation: targetNode.label || '',
      incomingEdges,
      outgoingEdges,
      branches: Object.keys(branches).length > 0 ? branches : null,
      metadata: targetNode.data || {}
    };
  }
};

module.exports = {
  getNodeToolDefinition
};
