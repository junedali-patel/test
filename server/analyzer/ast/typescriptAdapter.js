// server/analyzer/ast/typescriptAdapter.js
// TypeScript AST parser translating TypeScript source code into Common Intermediate Representation (IR)

const { parseJavaScriptToIR } = require('./javascriptAdapter');

/**
 * Normalizes TypeScript code by handling type annotations while preserving runtime logic and line numbers
 */
function sanitizeTypeScript(code) {
  const lines = code.split(/\r?\n/);
  const cleanLines = lines.map(line => {
    let text = line;
    const trimmed = text.trim();

    // Skip interfaces, type declarations, and decorators from execution flow
    if (/^(?:export\s+)?(?:interface|type)\s+\w+/.test(trimmed)) {
      return '// [Type Definition]';
    }
    // Skip decorator lines
    if (/^@\w+/.test(trimmed)) {
      return '// [Decorator]';
    }

    // Strip generic type brackets like <T>, <T, U> on function calls or definitions
    text = text.replace(/<[A-Za-z0-9_,\s\<\>\[\]|&?]+>(?=\s*[(\{])/g, '');

    // Strip return type annotations: ): ReturnType {  or ): ReturnType =>  or ): ReturnType
    text = text.replace(/\)\s*:\s*[A-Za-z0-9_<>[\]|&\s?]+(\s*(?:=>|\{))/g, ') $1');
    text = text.replace(/\)\s*:\s*[A-Za-z0-9_<>[\]|&\s?]+\s*$/g, ')');

    // Strip parameter type annotations: param: type, param: type = default
    text = text.replace(/(\w+)\s*\?\s*:\s*[A-Za-z0-9_<>[\]|&\s?]+(?=[,)])/g, '$1');
    text = text.replace(/(\w+)\s*:\s*[A-Za-z0-9_<>[\]|&\s?]+(?=[,)=;])/g, '$1');

    // Strip variable type declarations: const x: Type = or let x: Type
    text = text.replace(/((?:const|let|var)\s+\w+)\s*:\s*[A-Za-z0-9_<>[\]|&\s?]+\s*(?==)/g, '$1 ');

    return text;
  });

  return cleanLines.join('\n');
}

/**
 * Parses TypeScript source code into Common IR nodes
 * @param {string} code - TypeScript source code
 * @returns {{ irNodes: Array, functions: Array, classes: Array }}
 */
function parseTypeScriptToIR(code = '') {
  const sanitizedCode = sanitizeTypeScript(code);
  return parseJavaScriptToIR(sanitizedCode);
}

module.exports = {
  parseTypeScriptToIR,
  sanitizeTypeScript
};
