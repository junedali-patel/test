// server/analyzer/languageDetector.js
// Reliable language detector based on file extension and source syntax heuristics

const EXTENSION_MAP = {
  py: 'python',
  pyw: 'python',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  java: 'java'
};

const SUPPORTED_LANGUAGES = new Set(['python', 'javascript', 'typescript', 'java']);

/**
 * Detect language from filename or code snippet
 * @param {string} fileName
 * @param {string} code
 * @returns {string} Detected language or 'unsupported'
 */
function detectLanguage(fileName = '', code = '') {
  // 1. Try file extension
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext];
    }
  }

  // 2. Fallback to code content heuristics
  if (code && typeof code === 'string') {
    // Java heuristics
    if (/public\s+class\s+\w+|System\.out\.println|package\s+[a-zA-Z0-9_\.]+\s*;/.test(code)) {
      return 'java';
    }

    // Python heuristics
    if (/def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import|elif\s+|if\s+__name__\s*==/.test(code)) {
      return 'python';
    }

    // TypeScript heuristics
    if (/interface\s+\w+|type\s+\w+\s*=|:\s*(?:string|number|boolean|any|void)\b|<[A-Z]\w*>\s*\(/.test(code)) {
      return 'typescript';
    }

    // JavaScript heuristics
    if (/function\s+\w*\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|console\.(?:log|error|warn)/.test(code)) {
      return 'javascript';
    }
  }

  return 'unsupported';
}

/**
 * Check if a language is currently supported
 */
function isLanguageSupported(language) {
  return SUPPORTED_LANGUAGES.has((language || '').toLowerCase());
}

module.exports = {
  detectLanguage,
  isLanguageSupported,
  SUPPORTED_LANGUAGES,
  EXTENSION_MAP
};
