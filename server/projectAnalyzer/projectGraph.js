// server/projectAnalyzer/projectGraph.js
// Generates normalized graph nodes and edges for File, Function, and Combined levels

/**
 * Traces execution flow paths from entry points through function calls
 */
function traceExecutionFlows(entryPoints, functionNodes, callEdges) {
  const flows = [];
  const funcMap = new Map(functionNodes.map(f => [f.id, f]));
  const callAdjacency = new Map();

  callEdges.forEach(edge => {
    if (!callAdjacency.has(edge.source)) {
      callAdjacency.set(edge.source, []);
    }
    callAdjacency.get(edge.source).push(edge.target);
  });

  // Find candidate start functions
  const entryFuncIds = [];

  for (const ep of entryPoints) {
    // Functions belonging to the entry point file
    const fileFuncs = functionNodes.filter(f => f.file === ep.file);
    const mainFunc = fileFuncs.find(f => f.name === 'main' || f.name === '<main>' || f.isTopLevel);
    if (mainFunc) {
      entryFuncIds.push(mainFunc.id);
    } else if (fileFuncs.length > 0) {
      entryFuncIds.push(fileFuncs[0].id);
    }
  }

  // Trace up to 5 execution paths, max depth 12 to avoid cycles
  const seenPaths = new Set();

  function dfs(currentId, currentPath, visited) {
    if (currentPath.length >= 10 || visited.has(currentId)) {
      return;
    }

    const nextTargets = callAdjacency.get(currentId) || [];
    if (nextTargets.length === 0 && currentPath.length > 1) {
      const pathSignature = currentPath.join(' -> ');
      if (!seenPaths.has(pathSignature)) {
        seenPaths.add(pathSignature);
        flows.push(currentPath.map(id => {
          const fn = funcMap.get(id);
          return {
            id,
            label: fn ? `${fn.file}:${fn.name}()` : id,
            file: fn?.file,
            function: fn?.name
          };
        }));
      }
      return;
    }

    visited.add(currentId);
    for (const targetId of nextTargets) {
      dfs(targetId, currentPath.concat(targetId), new Set(visited));
    }
    visited.delete(currentId);
  }

  entryFuncIds.forEach(startId => {
    dfs(startId, [startId], new Set());
  });

  return flows.slice(0, 5);
}

/**
 * Builds project graph according to requested level ('file', 'function', or 'combined')
 */
function buildProjectGraph({
  fileNodes = [],
  dependencyEdges = [],
  functionNodes = [],
  callEdges = [],
  entryPoints = [],
  classes = [],
  level = 'combined'
}) {
  const entryPointFiles = new Set(entryPoints.map(e => e.file));

  // Annotate file nodes with entry point flag
  const annotatedFileNodes = fileNodes.map(f => ({
    ...f,
    isEntryPoint: entryPointFiles.has(f.path)
  }));

  // Annotate function nodes
  const annotatedFunctionNodes = functionNodes.map(fn => ({
    ...fn,
    isEntryPoint: entryPointFiles.has(fn.file) && (fn.name === 'main' || fn.name === '<main>' || fn.isTopLevel)
  }));

  let finalNodes = [];
  let finalEdges = [];

  switch (level) {
    case 'file':
      finalNodes = annotatedFileNodes;
      finalEdges = dependencyEdges;
      break;

    case 'function':
      finalNodes = annotatedFunctionNodes;
      finalEdges = callEdges;
      break;

    case 'combined':
    default:
      finalNodes = [...annotatedFileNodes, ...annotatedFunctionNodes];

      // Add "defines" containment edges from file to its functions
      const containmentEdges = [];
      annotatedFunctionNodes.forEach(fn => {
        const parentFileNode = annotatedFileNodes.find(f => f.path === fn.file);
        if (parentFileNode) {
          containmentEdges.push({
            id: `contains_${parentFileNode.id}_${fn.id}`,
            source: parentFileNode.id,
            target: fn.id,
            type: 'contains',
            label: 'defines'
          });
        }
      });

      finalEdges = [
        ...dependencyEdges,
        ...containmentEdges,
        ...callEdges
      ];
      break;
  }

  const executionFlows = traceExecutionFlows(entryPoints, annotatedFunctionNodes, callEdges);

  return {
    level,
    nodes: finalNodes,
    edges: finalEdges,
    executionFlows
  };
}

module.exports = {
  buildProjectGraph,
  traceExecutionFlows
};
