// server/projectAnalyzer/dependencyAnalyzer.js
// Builds file-to-file dependency graph and detects circular dependencies

/**
 * Generates unique node ID for a file path
 */
function fileIdFromPath(filePath) {
  return `file_${filePath.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
}

/**
 * Detects circular dependencies using DFS cycle detection
 * Returns array of cycles: [ [pathA, pathB, pathA], ... ]
 */
function findCircularDependencies(adjacencyMap) {
  const cycles = [];
  const visited = new Set();
  const recursionStack = new Set();
  const currentPath = [];

  function dfs(node) {
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);

    const neighbors = adjacencyMap.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // Cycle found
        const cycleStartIndex = currentPath.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          const cycle = currentPath.slice(cycleStartIndex).concat(neighbor);
          cycles.push(cycle);
        }
      }
    }

    recursionStack.delete(node);
    currentPath.pop();
  }

  for (const node of adjacencyMap.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  // Deduplicate cycles
  const uniqueCycles = [];
  const seenSignatures = new Set();

  for (const cycle of cycles) {
    const sortedWithoutLast = cycle.slice(0, -1).slice().sort().join('->');
    if (!seenSignatures.has(sortedWithoutLast)) {
      seenSignatures.add(sortedWithoutLast);
      uniqueCycles.push(cycle);
    }
  }

  return uniqueCycles;
}

/**
 * Builds file-level dependency graph from analyzed files and resolved imports
 * @param {Array<Object>} analyzedFiles
 * @param {Array<Object>} resolvedImports
 * @returns {{ fileNodes: Array, dependencyEdges: Array, circularDependencies: Array, fileStats: Map }}
 */
function buildDependencyGraph(analyzedFiles, resolvedImports) {
  const fileNodes = [];
  const dependencyEdges = [];
  const fileStats = new Map(); // path -> { dependencies: Set, dependents: Set }
  const adjacencyMap = new Map(); // path -> Set of imported paths

  // Initialize nodes and stats
  analyzedFiles.forEach(file => {
    const fId = fileIdFromPath(file.path);
    fileNodes.push({
      id: fId,
      type: 'file',
      label: file.filename,
      path: file.path,
      language: file.language,
      lineCount: file.lineCount,
      functionCount: file.functions.length,
      classCount: file.classes.length
    });

    fileStats.set(file.path, {
      id: fId,
      path: file.path,
      filename: file.filename,
      language: file.language,
      dependencies: new Set(),
      dependents: new Set()
    });

    adjacencyMap.set(file.path, new Set());
  });

  // Track added edge pairs to avoid duplicate edges
  const seenEdges = new Set();

  for (const imp of resolvedImports) {
    if (!imp.isInternal || !imp.targetFile || imp.sourceFile === imp.targetFile) {
      continue;
    }

    const sourcePath = imp.sourceFile;
    const targetPath = imp.targetFile;

    adjacencyMap.get(sourcePath)?.add(targetPath);
    fileStats.get(sourcePath)?.dependencies.add(targetPath);
    fileStats.get(targetPath)?.dependents.add(sourcePath);

    const edgeKey = `${sourcePath}->${targetPath}`;
    if (!seenEdges.has(edgeKey)) {
      seenEdges.add(edgeKey);
      dependencyEdges.push({
        id: `dep_${dependencyEdges.length + 1}`,
        source: fileIdFromPath(sourcePath),
        target: fileIdFromPath(targetPath),
        sourcePath,
        targetPath,
        type: 'import',
        label: 'imports',
        names: imp.names || [],
        isCircular: false
      });
    }
  }

  // Detect circular dependencies
  const cycles = findCircularDependencies(adjacencyMap);

  // Mark edges involved in circular dependencies
  for (const cycle of cycles) {
    for (let i = 0; i < cycle.length - 1; i++) {
      const from = cycle[i];
      const to = cycle[i + 1];
      const edge = dependencyEdges.find(e => e.sourcePath === from && e.targetPath === to);
      if (edge) {
        edge.isCircular = true;
      }
    }
  }

  return {
    fileNodes,
    dependencyEdges,
    circularDependencies: cycles,
    fileStats
  };
}

module.exports = {
  buildDependencyGraph,
  findCircularDependencies,
  fileIdFromPath
};
