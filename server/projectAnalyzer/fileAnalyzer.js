// server/projectAnalyzer/fileAnalyzer.js
// Multi-language static source code analyzer for Python, JavaScript, TypeScript, and Java
// Extracts imports, exports, classes, methods, functions, parameters, line numbers, and calls

/**
 * Remove multi-line and single-line comments while preserving line count
 */
function stripComments(code, language) {
  const lines = code.split(/\r?\n/);
  const result = [];
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (language === 'python') {
      // Python docstrings/block comments
      if (!inBlockComment && (line.includes('"""') || line.includes("'''"))) {
        const quote = line.includes('"""') ? '"""' : "'''";
        const count = (line.match(new RegExp(quote, 'g')) || []).length;
        if (count === 1) {
          inBlockComment = true;
          line = line.substring(0, line.indexOf(quote));
        } else if (count >= 2) {
          // Both start and end on same line
          const first = line.indexOf(quote);
          const second = line.indexOf(quote, first + 3);
          line = line.substring(0, first) + line.substring(second + 3);
        }
      } else if (inBlockComment) {
        if (line.includes('"""') || line.includes("'''")) {
          const quote = line.includes('"""') ? '"""' : "'''";
          inBlockComment = false;
          line = line.substring(line.indexOf(quote) + 3);
        } else {
          line = '';
        }
      }

      // Strip single line comment
      if (!inBlockComment && line.includes('#')) {
        line = line.substring(0, line.indexOf('#'));
      }
    } else {
      // JS, TS, Java
      if (!inBlockComment && line.includes('/*')) {
        const start = line.indexOf('/*');
        const end = line.indexOf('*/', start + 2);
        if (end !== -1) {
          line = line.substring(0, start) + line.substring(end + 2);
        } else {
          inBlockComment = true;
          line = line.substring(0, start);
        }
      } else if (inBlockComment) {
        if (line.includes('*/')) {
          inBlockComment = false;
          line = line.substring(line.indexOf('*/') + 2);
        } else {
          line = '';
        }
      }

      // Single line comments
      if (!inBlockComment && line.includes('//')) {
        line = line.substring(0, line.indexOf('//'));
      }
    }

    result.push(line);
  }

  return result;
}

/**
 * Extract function calls from a line of code
 */
function extractCallsFromLine(line, lineNum) {
  const calls = [];
  const trimmed = line.trim();

  // Skip control keywords that look like function calls
  const controlKeywords = new Set([
    'if', 'else', 'for', 'while', 'switch', 'catch', 'finally',
    'function', 'class', 'import', 'from', 'export', 'return',
    'case', 'throw', 'new', 'sizeof', 'typeof', 'instanceof', 'def'
  ]);

  // Regex to match call patterns: `foo(...)` or `obj.bar(...)`
  const callRegex = /(?:([a-zA-Z_$][a-zA-Z0-9_$]*)\.)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  let match;

  while ((match = callRegex.exec(trimmed)) !== null) {
    const objectOrModule = match[1] || null;
    const callName = match[2];

    if (!controlKeywords.has(callName)) {
      calls.push({
        name: callName,
        objectOrModule,
        line: lineNum,
        raw: match[0]
      });
    }
  }

  return calls;
}

/**
 * Extract Python imports, classes, functions, and calls
 */
function analyzePythonFile(lines, originalLines, filePath) {
  const imports = [];
  const exports = [];
  const classes = [];
  const functions = [];
  const topLevelCalls = [];

  let currentClass = null;
  let currentFunction = null;
  const indentStack = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNum = i + 1;
    if (!trimmed) continue;

    const indent = rawLine.search(/\S/);

    // Track block scope by indentation
    while (indentStack.length > 0 && indent <= indentStack[indentStack.length - 1].indent) {
      const closed = indentStack.pop();
      if (closed.type === 'class' && currentClass === closed.name) {
        currentClass = null;
      }
      if (closed.type === 'function' && currentFunction === closed.name) {
        currentFunction = null;
      }
    }

    // 1. Imports
    // `from foo.bar import baz, qux as q`
    const fromImport = trimmed.match(/^from\s+([a-zA-Z0-9_\.]+)\s+import\s+(.+)$/);
    if (fromImport) {
      const modulePath = fromImport[1];
      const namesPart = fromImport[2];
      const names = namesPart
        .replace(/[()]/g, '')
        .split(',')
        .map(n => n.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean);

      imports.push({
        specifier: modulePath,
        names,
        isRelative: modulePath.startsWith('.'),
        line: lineNum,
        language: 'python'
      });
      continue;
    }

    // `import foo, bar as b`
    const standardImport = trimmed.match(/^import\s+(.+)$/);
    if (standardImport) {
      const modules = standardImport[1].split(',').map(m => m.trim().split(/\s+as\s+/)[0].trim());
      modules.forEach(mod => {
        imports.push({
          specifier: mod,
          names: [mod],
          isRelative: mod.startsWith('.'),
          line: lineNum,
          language: 'python'
        });
      });
      continue;
    }

    // 2. Class declaration
    const classMatch = trimmed.match(/^class\s+([a-zA-Z_]\w*)(?:\((.*?)\))?\s*:/);
    if (classMatch) {
      const className = classMatch[1];
      const superClass = classMatch[2] ? classMatch[2].trim() : null;

      currentClass = className;
      indentStack.push({ type: 'class', name: className, indent });

      classes.push({
        name: className,
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        superClass,
        methods: []
      });
      continue;
    }

    // 3. Function declaration
    const funcMatch = trimmed.match(/^(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\((.*?)\)\s*:/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const rawParams = funcMatch[2];
      const params = rawParams
        ? rawParams.split(',').map(p => p.trim().split(/[=:]/)[0].trim()).filter(Boolean)
        : [];

      currentFunction = funcName;
      indentStack.push({ type: 'function', name: funcName, indent });

      const funcInfo = {
        name: funcName,
        file: filePath,
        parameters: params,
        lineStart: lineNum,
        lineEnd: lineNum,
        isAsync: trimmed.startsWith('async'),
        isExported: !funcName.startsWith('_'),
        parentClass: currentClass,
        calls: []
      };

      functions.push(funcInfo);

      if (currentClass) {
        const cls = classes.find(c => c.name === currentClass);
        if (cls) cls.methods.push(funcName);
      }
      continue;
    }

    // 4. Function calls
    const callsInLine = extractCallsFromLine(trimmed, lineNum);
    if (callsInLine.length > 0) {
      if (currentFunction) {
        const fn = functions.find(f => f.name === currentFunction && f.parentClass === currentClass);
        if (fn) {
          callsInLine.forEach(c => fn.calls.push(c));
        }
      } else {
        callsInLine.forEach(c => topLevelCalls.push(c));
      }
    }
  }

  // Refine lineEnd for classes and functions
  for (let i = 0; i < functions.length; i++) {
    const nextFunc = functions[i + 1];
    functions[i].lineEnd = nextFunc ? nextFunc.lineStart - 1 : lines.length;
  }
  for (let i = 0; i < classes.length; i++) {
    const nextClass = classes[i + 1];
    classes[i].lineEnd = nextClass ? nextClass.lineStart - 1 : lines.length;
  }

  return { imports, exports, classes, functions, topLevelCalls };
}

/**
 * Extract JavaScript / TypeScript imports, exports, classes, functions, and calls
 */
function analyzeJsTsFile(lines, originalLines, filePath, isTypeScript = false) {
  const imports = [];
  const exports = [];
  const classes = [];
  const functions = [];
  const topLevelCalls = [];

  let currentClass = null;
  let currentFunction = null;
  let braceCount = 0;
  const functionBraces = new Map();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lineNum = i + 1;
    if (!trimmed) continue;

    // Track braces for function scope
    if (trimmed.includes('{')) braceCount += (trimmed.match(/\{/g) || []).length;
    if (trimmed.includes('}')) {
      braceCount -= (trimmed.match(/\}/g) || []).length;
      if (currentFunction && braceCount <= (functionBraces.get(currentFunction) || 0)) {
        currentFunction = null;
      }
    }

    // 1. ES6 Imports
    // import { a, b as c } from './module'
    const es6Import = trimmed.match(/^import\s+(?:(.+?)\s+from\s+)?['"]([^'"]+)['"]/);
    if (es6Import) {
      const clause = es6Import[1] ? es6Import[1].trim() : '';
      const specifier = es6Import[2];
      const names = [];

      if (clause) {
        if (clause.startsWith('{')) {
          // Destructured
          clause.replace(/[{}]/g, '').split(',').forEach(n => {
            const clean = n.trim().split(/\s+as\s+/)[0].trim();
            if (clean) names.push(clean);
          });
        } else if (clause.startsWith('* as ')) {
          names.push(clause.replace('* as ', '').trim());
        } else {
          // Default import
          names.push(clause.split(',')[0].trim());
        }
      }

      imports.push({
        specifier,
        names,
        isRelative: specifier.startsWith('.') || specifier.startsWith('/'),
        line: lineNum,
        language: isTypeScript ? 'typescript' : 'javascript'
      });
      continue;
    }

    // CommonJS require
    // const { a, b } = require('./module') or const x = require('./module')
    const requireMatch = trimmed.match(/(?:const|let|var)\s+(?:\{([^}]+)\}|([a-zA-Z0-9_$]+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (requireMatch) {
      const destr = requireMatch[1];
      const single = requireMatch[2];
      const specifier = requireMatch[3];
      const names = destr
        ? destr.split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean)
        : [single];

      imports.push({
        specifier,
        names,
        isRelative: specifier.startsWith('.') || specifier.startsWith('/'),
        line: lineNum,
        language: isTypeScript ? 'typescript' : 'javascript'
      });
      continue;
    }

    // 2. Exports
    if (trimmed.startsWith('export ')) {
      const exportFunc = trimmed.match(/^export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/);
      const exportConst = trimmed.match(/^export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)/);
      const exportClass = trimmed.match(/^export\s+class\s+([a-zA-Z0-9_$]+)/);
      const exportDefault = trimmed.match(/^export\s+default\s+([a-zA-Z0-9_$]+)/);
      const exportGroup = trimmed.match(/^export\s+\{([^}]+)\}/);

      if (exportFunc) exports.push({ name: exportFunc[1], type: 'function', line: lineNum });
      else if (exportConst) exports.push({ name: exportConst[1], type: 'variable', line: lineNum });
      else if (exportClass) exports.push({ name: exportClass[1], type: 'class', line: lineNum });
      else if (exportDefault) exports.push({ name: exportDefault[1], type: 'default', line: lineNum });
      else if (exportGroup) {
        exportGroup[1].split(',').forEach(n => {
          const clean = n.trim().split(/\s+as\s+/)[0].trim();
          if (clean) exports.push({ name: clean, type: 'named', line: lineNum });
        });
      }
    } else if (trimmed.startsWith('module.exports') || trimmed.startsWith('exports.')) {
      const modExport = trimmed.match(/(?:module\.)?exports(?:\.([a-zA-Z0-9_$]+))?\s*=/);
      if (modExport) {
        exports.push({ name: modExport[1] || 'default', type: 'commonjs', line: lineNum });
      }
    }

    // 3. Class declaration
    const classMatch = trimmed.match(/^(?:export\s+)?class\s+([a-zA-Z0-9_$]+)(?:\s+extends\s+([a-zA-Z0-9_$]+))?/);
    if (classMatch) {
      const className = classMatch[1];
      const superClass = classMatch[2] || null;
      currentClass = className;

      classes.push({
        name: className,
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        superClass,
        methods: []
      });
      continue;
    }

    // 4. Function declaration
    const funcMatch =
      trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\((.*?)\)/) ||
      trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\((.*?)\)\s*(?::\s*[^=>]+)?\s*=>/) ||
      trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*function(?:\s+[a-zA-Z0-9_$]+)?\s*\((.*?)\)/) ||
      (currentClass && trimmed.match(/^(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?([a-zA-Z0-9_$]+)\s*\((.*?)\)\s*(?::\s*[^\{]+)?\s*\{/));

    if (funcMatch && !['if', 'for', 'while', 'switch', 'catch', 'function'].includes(funcMatch[1])) {
      const funcName = funcMatch[1];
      const rawParams = funcMatch[2] || '';
      const params = rawParams
        ? rawParams.split(',').map(p => p.trim().split(/[=:]/)[0].trim()).filter(Boolean)
        : [];

      currentFunction = funcName;
      functionBraces.set(funcName, braceCount);

      const funcInfo = {
        name: funcName,
        file: filePath,
        parameters: params,
        lineStart: lineNum,
        lineEnd: lineNum,
        isAsync: trimmed.includes('async'),
        isExported: trimmed.startsWith('export'),
        parentClass: currentClass,
        calls: []
      };

      functions.push(funcInfo);

      if (currentClass) {
        const cls = classes.find(c => c.name === currentClass);
        if (cls) cls.methods.push(funcName);
      }
      continue;
    }

    // 5. Calls inside function or top-level
    const callsInLine = extractCallsFromLine(trimmed, lineNum);
    if (callsInLine.length > 0) {
      if (currentFunction) {
        const fn = functions.find(f => f.name === currentFunction && f.parentClass === currentClass);
        if (fn) {
          callsInLine.forEach(c => fn.calls.push(c));
        }
      } else {
        callsInLine.forEach(c => topLevelCalls.push(c));
      }
    }
  }

  // Refine lineEnd
  for (let i = 0; i < functions.length; i++) {
    const nextFunc = functions[i + 1];
    functions[i].lineEnd = nextFunc ? nextFunc.lineStart - 1 : lines.length;
  }
  for (let i = 0; i < classes.length; i++) {
    const nextClass = classes[i + 1];
    classes[i].lineEnd = nextClass ? nextClass.lineStart - 1 : lines.length;
  }

  return { imports, exports, classes, functions, topLevelCalls };
}

/**
 * Extract Java package, imports, classes, methods, and calls
 */
function analyzeJavaFile(lines, originalLines, filePath) {
  const imports = [];
  const exports = [];
  const classes = [];
  const functions = [];
  const topLevelCalls = [];

  let packageName = '';
  let currentClass = null;
  let currentMethod = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lineNum = i + 1;
    if (!trimmed) continue;

    // Package declaration
    const pkgMatch = trimmed.match(/^package\s+([a-zA-Z0-9_\.]+)\s*;/);
    if (pkgMatch) {
      packageName = pkgMatch[1];
      continue;
    }

    // Imports
    const importMatch = trimmed.match(/^import\s+(?:static\s+)?([a-zA-Z0-9_\.]+)(?:\.\*)?\s*;/);
    if (importMatch) {
      const fullImport = importMatch[1];
      const simpleName = fullImport.split('.').pop();
      imports.push({
        specifier: fullImport,
        names: [simpleName],
        isRelative: false,
        line: lineNum,
        language: 'java'
      });
      continue;
    }

    // Class declaration
    const classMatch = trimmed.match(/^(?:public|protected|private)?\s*(?:static\s+)?(?:abstract\s+|final\s+)?(?:class|interface|enum)\s+([a-zA-Z0-9_$]+)(?:\s+extends\s+([a-zA-Z0-9_$]+))?/);
    if (classMatch) {
      const className = classMatch[1];
      const superClass = classMatch[2] || null;
      currentClass = className;

      classes.push({
        name: className,
        file: filePath,
        lineStart: lineNum,
        lineEnd: lineNum,
        superClass,
        methods: [],
        package: packageName
      });
      continue;
    }

    // Method declaration
    const methodMatch = trimmed.match(/^(?:public|protected|private)\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:<[^>]+>\s+)?([a-zA-Z0-9_$<>,\[\]\s]+)\s+([a-zA-Z0-9_$]+)\s*\((.*?)\)\s*(?:throws\s+[^{]+)?\s*\{/);
    if (methodMatch && !['if', 'for', 'while', 'switch', 'catch'].includes(methodMatch[2])) {
      const methodName = methodMatch[2];
      const rawParams = methodMatch[3];
      const params = rawParams
        ? rawParams.split(',').map(p => p.trim().split(/\s+/).pop()).filter(Boolean)
        : [];

      currentMethod = methodName;

      const funcInfo = {
        name: methodName,
        file: filePath,
        parameters: params,
        lineStart: lineNum,
        lineEnd: lineNum,
        isAsync: false,
        isExported: trimmed.startsWith('public'),
        parentClass: currentClass,
        calls: []
      };

      functions.push(funcInfo);

      if (currentClass) {
        const cls = classes.find(c => c.name === currentClass);
        if (cls) cls.methods.push(methodName);
      }
      continue;
    }

    // Method calls
    const callsInLine = extractCallsFromLine(trimmed, lineNum);
    if (callsInLine.length > 0) {
      if (currentMethod) {
        const fn = functions.find(f => f.name === currentMethod && f.parentClass === currentClass);
        if (fn) {
          callsInLine.forEach(c => fn.calls.push(c));
        }
      } else {
        callsInLine.forEach(c => topLevelCalls.push(c));
      }
    }
  }

  // Refine lineEnd
  for (let i = 0; i < functions.length; i++) {
    const nextFunc = functions[i + 1];
    functions[i].lineEnd = nextFunc ? nextFunc.lineStart - 1 : lines.length;
  }
  for (let i = 0; i < classes.length; i++) {
    const nextClass = classes[i + 1];
    classes[i].lineEnd = nextClass ? nextClass.lineStart - 1 : lines.length;
  }

  return { imports, exports, classes, functions, topLevelCalls, packageName };
}

/**
 * Main file analyzer: parses source code and returns structured analysis
 */
function analyzeFile(sourceFile) {
  const { path, filename, language, content } = sourceFile;
  const originalLines = content.split(/\r?\n/);
  const strippedLines = stripComments(content, language);

  let analysis = {
    imports: [],
    exports: [],
    classes: [],
    functions: [],
    topLevelCalls: []
  };

  switch (language) {
    case 'python':
      analysis = analyzePythonFile(strippedLines, originalLines, path);
      break;
    case 'typescript':
      analysis = analyzeJsTsFile(strippedLines, originalLines, path, true);
      break;
    case 'javascript':
      analysis = analyzeJsTsFile(strippedLines, originalLines, path, false);
      break;
    case 'java':
      analysis = analyzeJavaFile(strippedLines, originalLines, path);
      break;
    default:
      // Fallback: generic JS/TS style
      analysis = analyzeJsTsFile(strippedLines, originalLines, path, false);
      break;
  }

  return {
    path,
    filename,
    language,
    content: content || '',
    lineCount: originalLines.length,
    imports: analysis.imports,
    exports: analysis.exports,
    classes: analysis.classes,
    functions: analysis.functions,
    topLevelCalls: analysis.topLevelCalls,
    packageName: analysis.packageName || null
  };
}

module.exports = {
  analyzeFile,
  stripComments,
  extractCallsFromLine
};
