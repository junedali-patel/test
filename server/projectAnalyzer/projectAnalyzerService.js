// server/projectAnalyzer/projectAnalyzerService.js
// Main orchestrator service executing the full repository static analysis pipeline

const { scanRepository } = require('./repositoryScanner');
const { analyzeFile } = require('./fileAnalyzer');
const { resolveRepositoryImports } = require('./importResolver');
const { buildDependencyGraph } = require('./dependencyAnalyzer');
const { buildCallGraph } = require('./callGraph');
const { detectEntryPoints } = require('./entryPointDetector');
const { buildProjectGraph } = require('./projectGraph');

/**
 * Analyzes repository files and produces multi-file dependency and call graphs
 * @param {Object} options
 * @param {string} options.repositoryName
 * @param {Array<Object>} options.files - [{ path, content }]
 * @param {string} [options.level='combined'] - 'file' | 'function' | 'combined'
 * @returns {Object} Complete project analysis response
 */
function analyzeRepository({ repositoryName = 'repository', files = [], level = 'combined' }) {
  const startTime = Date.now();

  // 1. Scan repository files and filter out ignored/binary directories
  const { sourceFiles, configFiles, ignoredCount, totalScanned } = scanRepository(files, repositoryName);

  if (sourceFiles.length === 0) {
    return {
      success: true,
      project: repositoryName,
      level,
      files: [],
      nodes: [],
      edges: [],
      entryPoints: [],
      executionFlows: [],
      dependencies: {
        internal: [],
        external: []
      },
      circularDependencies: [],
      statistics: {
        totalFiles: 0,
        totalFunctions: 0,
        totalClasses: 0,
        totalDependencies: 0,
        totalCalls: 0,
        unresolvedCalls: 0,
        circularDependencies: 0,
        scannedFiles: totalScanned,
        ignoredFiles: ignoredCount,
        analysisTimeMs: Date.now() - startTime
      }
    };
  }

  // 2. Statically analyze each source file (AST tokens, imports, classes, functions, calls)
  const analyzedFiles = sourceFiles.map(file => analyzeFile(file));

  // 3. Resolve imports and build symbol/module cross-file mapping
  const {
    resolvedImports,
    symbolMap,
    moduleMap,
    externalDependencies
  } = resolveRepositoryImports(analyzedFiles);

  // 4. Build file-to-file dependency graph and detect cycles
  const {
    fileNodes,
    dependencyEdges,
    circularDependencies,
    fileStats
  } = buildDependencyGraph(analyzedFiles, resolvedImports);

  // 5. Build function call graph and resolve cross-file calls
  const {
    functionNodes,
    callEdges,
    unresolvedCalls
  } = buildCallGraph(analyzedFiles, symbolMap, moduleMap);

  // 6. Detect entry points
  const entryPoints = detectEntryPoints(analyzedFiles, configFiles);

  // 7. Extract all classes across files
  const allClasses = analyzedFiles.flatMap(f => f.classes);

  // 8. Generate normalized project graph for requested level
  const graphResult = buildProjectGraph({
    fileNodes,
    dependencyEdges,
    functionNodes,
    callEdges,
    entryPoints,
    classes: allClasses,
    level
  });

  // 9. Prepare detailed file summaries
  const fileSummaries = analyzedFiles.map(f => {
    const stats = fileStats.get(f.path);
    return {
      path: f.path,
      filename: f.filename,
      language: f.language,
      lineCount: f.lineCount,
      imports: f.imports.map(i => i.specifier),
      exports: f.exports.map(e => e.name),
      classes: f.classes.map(c => ({
        name: c.name,
        lineStart: c.lineStart,
        lineEnd: c.lineEnd,
        methods: c.methods
      })),
      functions: f.functions.map(fn => ({
        name: fn.name,
        parameters: fn.parameters,
        lineStart: fn.lineStart,
        lineEnd: fn.lineEnd,
        isAsync: fn.isAsync,
        calls: fn.calls,
        calledBy: fn.calledBy
      })),
      dependencies: Array.from(stats?.dependencies || []),
      dependents: Array.from(stats?.dependents || []),
      isEntryPoint: entryPoints.some(e => e.file === f.path)
    };
  });

  // 10. Language distribution statistics
  const languageStats = {};
  analyzedFiles.forEach(f => {
    languageStats[f.language] = (languageStats[f.language] || 0) + 1;
  });

  const totalDependenciesCount = dependencyEdges.length + externalDependencies.length;

  return {
    success: true,
    project: repositoryName,
    level: graphResult.level,
    files: fileSummaries,
    nodes: graphResult.nodes,
    edges: graphResult.edges,
    entryPoints,
    executionFlows: graphResult.executionFlows,
    dependencies: {
      internal: dependencyEdges.map(e => ({
        source: e.sourcePath,
        target: e.targetPath,
        names: e.names
      })),
      external: externalDependencies
    },
    circularDependencies,
    statistics: {
      totalFiles: analyzedFiles.length,
      totalFunctions: functionNodes.filter(fn => !fn.isTopLevel).length,
      totalClasses: allClasses.length,
      totalDependencies: totalDependenciesCount,
      totalCalls: callEdges.length,
      unresolvedCalls: unresolvedCalls.length,
      circularDependencies: circularDependencies.length,
      scannedFiles: totalScanned,
      ignoredFiles: ignoredCount,
      languages: languageStats,
      analysisTimeMs: Date.now() - startTime
    }
  };
}

module.exports = {
  analyzeRepository
};
