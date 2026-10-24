// server/tutor/tools/getCallGraph.js
// Tool B: get_call_graph
// Retrieves actual function-call relationships from the static analysis call graph.

const { sessionManager } = require('../sessionManager');
const { analyzeFile } = require('../../projectAnalyzer/fileAnalyzer');
const { buildCallGraph } = require('../../projectAnalyzer/callGraph');

const getCallGraphToolDefinition = {
  name: 'get_call_graph',
  description: 'Retrieve actual function-call relationships (callers and callees) for a function in the codebase. Prevents infinite recursion on cyclic calls.',
  parameters: {
    type: 'object',
    properties: {
      function_name: {
        type: 'string',
        description: 'The name of the function to inspect (e.g. "login", "calculate_total")'
      },
      function_id: {
        type: 'string',
        description: 'Optional specific function node ID (e.g. "fn_main_py_login")'
      },
      depth: {
        type: 'number',
        description: 'Call hierarchy traversal depth (1 to 5, default 2)'
      },
      session_id: {
        type: 'string',
        description: 'Optional session ID for the active code analysis'
      }
    },
    required: ['function_name']
  },

  /**
   * Executes call graph retrieval
   * @param {Object} args
   * @param {string} args.function_name
   * @param {string} [args.function_id]
   * @param {number} [args.depth]
   * @param {string} [args.session_id]
   * @param {Object} context
   */
  async execute(args, context = {}) {
    const { function_name, function_id, depth = 2, session_id } = args;

    if (!function_name && !function_id) {
      return {
        available: false,
        error: 'Either "function_name" or "function_id" must be provided.'
      };
    }

    const maxDepth = Math.max(1, Math.min(5, Number(depth) || 2));

    // Resolve session
    const session = context.session ||
      (session_id ? sessionManager.getSession(session_id) : null) ||
      (context.sessionId ? sessionManager.getSession(context.sessionId) : null);

    let functionNodes = [];
    let callEdges = [];

    // 1. Check if call graph already computed in session or context
    if (context.callGraph) {
      functionNodes = context.callGraph.functionNodes || [];
      callEdges = context.callGraph.callEdges || [];
    } else if (session?.callGraph) {
      functionNodes = session.callGraph.functionNodes || [];
      callEdges = session.callGraph.callEdges || [];
    } else {
      const filesToAnalyze = [];
      if (Array.isArray(session?.files) && session.files.length > 0) {
        session.files.forEach(f => {
          if (f.path && f.content) {
            const fName = f.path.split(/[/\\]/).pop() || f.path;
            const ext = fName.split('.').pop()?.toLowerCase();
            const lang = f.language || (ext === 'py' ? 'python' : (ext === 'java' ? 'java' : (ext === 'ts' ? 'typescript' : 'javascript')));
            filesToAnalyze.push({
              path: f.path,
              filename: f.filename || fName,
              language: lang,
              content: f.content
            });
          }
        });
      } else if (context.code || session?.code) {
        const p = context.fileName || session?.fileName || 'main.py';
        const fName = p.split(/[/\\]/).pop() || p;
        const ext = fName.split('.').pop()?.toLowerCase();
        const lang = context.language || session?.language || (ext === 'py' ? 'python' : (ext === 'java' ? 'java' : (ext === 'ts' ? 'typescript' : 'javascript')));
        filesToAnalyze.push({
          path: p,
          filename: fName,
          language: lang,
          content: context.code || session?.code || ''
        });
      }

      if (filesToAnalyze.length > 0) {
        const analyzedFiles = filesToAnalyze.map(f => analyzeFile(f));
        const callGraphResult = buildCallGraph(analyzedFiles);
        functionNodes = callGraphResult.functionNodes || [];
        callEdges = callGraphResult.callEdges || [];

        // Cache in session if available
        if (session) {
          session.callGraph = { functionNodes, callEdges };
        }
      }
    }

    if (functionNodes.length === 0) {
      return {
        available: false,
        functionName: function_name,
        error: 'No call-graph information is available. Ensure repository or source files have been analyzed.',
        callers: [],
        callees: []
      };
    }

    // Locate target function node
    const targetName = (function_name || '').toLowerCase();
    const targetId = (function_id || '').toLowerCase();

    const targetNode = functionNodes.find(fn => {
      if (targetId && fn.id.toLowerCase() === targetId) return true;
      if (targetName && fn.name.toLowerCase() === targetName) return true;
      return false;
    });

    if (!targetNode) {
      const knownFunctions = functionNodes
        .filter(fn => !fn.isTopLevel)
        .map(fn => fn.name);

      return {
        available: true,
        found: false,
        searchedFunction: function_name,
        error: `Function "${function_name}" was not found in the analyzed call graph.`,
        knownFunctions: Array.from(new Set(knownFunctions))
      };
    }

    // Traverse callers and callees up to bounded depth, preventing cycles
    const visitedCallees = new Set([targetNode.id]);
    const visitedCallers = new Set([targetNode.id]);

    const traverseCallees = (currentId, currentDepth) => {
      if (currentDepth > maxDepth) return [];
      const outgoing = callEdges.filter(e => e.source === currentId);
      const results = [];

      for (const edge of outgoing) {
        const calleeNode = functionNodes.find(n => n.id === edge.target);
        const calleeItem = {
          functionName: calleeNode?.name || edge.target,
          functionId: edge.target,
          file: edge.targetFile || calleeNode?.file || 'unknown',
          line: edge.line || null,
          depth: currentDepth,
          resolved: edge.resolved !== false,
          isRecursive: visitedCallees.has(edge.target)
        };

        if (!visitedCallees.has(edge.target)) {
          visitedCallees.add(edge.target);
          calleeItem.calls = traverseCallees(edge.target, currentDepth + 1);
        } else {
          calleeItem.cycleDetected = true;
        }

        results.push(calleeItem);
      }
      return results;
    };

    const traverseCallers = (currentId, currentDepth) => {
      if (currentDepth > maxDepth) return [];
      const incoming = callEdges.filter(e => e.target === currentId);
      const results = [];

      for (const edge of incoming) {
        const callerNode = functionNodes.find(n => n.id === edge.source);
        const callerItem = {
          functionName: callerNode?.name || edge.source,
          functionId: edge.source,
          file: edge.callerFile || callerNode?.file || 'unknown',
          line: edge.line || null,
          depth: currentDepth,
          resolved: edge.resolved !== false,
          isRecursive: visitedCallers.has(edge.source)
        };

        if (!visitedCallers.has(edge.source)) {
          visitedCallers.add(edge.source);
          callerItem.calledBy = traverseCallers(edge.source, currentDepth + 1);
        } else {
          callerItem.cycleDetected = true;
        }

        results.push(callerItem);
      }
      return results;
    };

    const directCallees = traverseCallees(targetNode.id, 1);
    const directCallers = traverseCallers(targetNode.id, 1);

    return {
      available: true,
      found: true,
      functionName: targetNode.name,
      functionId: targetNode.id,
      file: targetNode.file,
      lineStart: targetNode.lineStart,
      lineEnd: targetNode.lineEnd,
      parameters: targetNode.parameters || [],
      isAsync: targetNode.isAsync || false,
      isExported: targetNode.isExported || false,
      callers: directCallers,
      callees: directCallees,
      totalCallers: directCallers.length,
      totalCallees: directCallees.length,
      maxDepthTraversed: maxDepth
    };
  }
};

module.exports = {
  getCallGraphToolDefinition
};
