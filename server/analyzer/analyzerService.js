// server/analyzer/analyzerService.js
// Main service coordinating Language Detection, AST Parsing, Common IR, and Flowchart Generation

const { detectLanguage, isLanguageSupported } = require('./languageDetector');
const { parseToIR } = require('./parserManager');
const { generateFlowchartFromIR } = require('./flow/flowGenerator');

/**
 * Analyzes code and produces deterministic flowchart nodes and edges
 * @param {Object} options
 * @param {string} options.code - Source code content
 * @param {string} [options.language] - Optional language hint
 * @param {string} [options.fileName='main.py'] - Source file name
 * @param {string} [options.functionName=null] - Optional function to focus on
 * @param {string} [options.detail='standard'] - 'overview' | 'standard' | 'detailed'
 * @returns {Object} Flowchart response
 */
function analyzeCodeFlowchart({
  code = '',
  language: langHint = '',
  fileName = 'main.py',
  functionName = null,
  detail = 'standard'
}) {
  if (typeof code !== 'string') {
    throw new Error('Invalid request: "code" must be a string.');
  }

  // 1. Language Detection
  let language = langHint ? langHint.toLowerCase() : '';
  if (!language || !isLanguageSupported(language)) {
    language = detectLanguage(fileName, code);
  }

  if (!isLanguageSupported(language)) {
    return {
      success: false,
      error: 'Unsupported language',
      details: `Language "${language || 'unknown'}" is not supported. Supported: python, javascript, typescript, java.`
    };
  }

  // 2. Parse Code into Common Intermediate Representation (IR)
  const { irNodes, functions, classes, parserEngine } = parseToIR(code, language);

  // 3. Generate Flowchart Graph from Common IR
  const { nodes, edges } = generateFlowchartFromIR({
    irNodes,
    fileName,
    functionName,
    functions,
    detail
  });

  // 4. Compute Metadata
  const conditionCount = nodes.filter(n => n.type === 'decision').length;
  const loopCount = nodes.filter(n => n.type === 'loop').length;

  return {
    success: true,
    file: fileName,
    language,
    nodes,
    edges,
    metadata: {
      functions: functions.map(f => f.name),
      classes: classes.map(c => c.name),
      conditions: conditionCount,
      loops: loopCount,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      parserEngine
    }
  };
}

module.exports = {
  analyzeCodeFlowchart
};
