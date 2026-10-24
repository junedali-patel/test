// server/projectAnalyzer/index.js
// Export all analyzer modules

const { scanRepository } = require('./repositoryScanner');
const { analyzeFile } = require('./fileAnalyzer');
const { resolveRepositoryImports } = require('./importResolver');
const { buildDependencyGraph } = require('./dependencyAnalyzer');
const { buildCallGraph } = require('./callGraph');
const { detectEntryPoints } = require('./entryPointDetector');
const { buildProjectGraph } = require('./projectGraph');
const { analyzeRepository } = require('./projectAnalyzerService');

module.exports = {
  scanRepository,
  analyzeFile,
  resolveRepositoryImports,
  buildDependencyGraph,
  buildCallGraph,
  detectEntryPoints,
  buildProjectGraph,
  analyzeRepository
};
