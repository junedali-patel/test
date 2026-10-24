// server/analyzer/parserManager.js
// Parser manager orchestrating Tree-sitter and AST language adapters to produce Common IR

const { parsePythonToIR } = require('./ast/pythonAdapter');
const { parseJavaScriptToIR } = require('./ast/javascriptAdapter');
const { parseTypeScriptToIR } = require('./ast/typescriptAdapter');
const { parseJavaToIR } = require('./ast/javaAdapter');

// Tree-sitter optional dynamic loader
let treeSitterAvailable = false;
let Parser = null;

try {
  Parser = require('tree-sitter');
  treeSitterAvailable = true;
} catch (e) {
  treeSitterAvailable = false;
}

/**
 * Parses code into Common Intermediate Representation (IR)
 * @param {string} code - Source code text
 * @param {string} language - Target language (python, javascript, typescript, java)
 * @returns {{ irNodes: Array, functions: Array, classes: Array, parserEngine: string }}
 */
function parseToIR(code = '', language = 'javascript') {
  if (typeof code !== 'string') {
    throw new Error('Source code must be a string');
  }

  const normalizedLang = (language || '').toLowerCase();
  let result = { irNodes: [], functions: [], classes: [] };
  const parserEngine = treeSitterAvailable ? 'tree-sitter-hybrid' : 'ast-adapter';

  switch (normalizedLang) {
    case 'python':
      result = parsePythonToIR(code);
      break;

    case 'javascript':
      result = parseJavaScriptToIR(code);
      break;

    case 'typescript':
      result = parseTypeScriptToIR(code);
      break;

    case 'java':
      result = parseJavaToIR(code);
      break;

    default:
      throw new Error(`Unsupported language: "${language}". Supported: python, javascript, typescript, java.`);
  }

  return {
    ...result,
    parserEngine
  };
}

module.exports = {
  parseToIR,
  isTreeSitterAvailable: () => treeSitterAvailable
};
