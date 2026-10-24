// server/projectAnalyzer/importResolver.js
// Resolves cross-file import specifiers to real repository file paths and symbols

const path = require('path');

/**
 * Normalize path separators to forward slash
 */
function toForwardSlash(p) {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

/**
 * Resolves a JavaScript/TypeScript relative or alias specifier against repository files
 */
function resolveJsTsImport(sourceFilePath, specifier, availableFilePaths) {
  const sourceDir = sourceFilePath.includes('/')
    ? sourceFilePath.substring(0, sourceFilePath.lastIndexOf('/'))
    : '';

  const candidates = [];

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    // Relative import
    const rawResolved = toForwardSlash(path.posix.normalize(path.posix.join(sourceDir, specifier)));

    // Try exact with extensions
    candidates.push(rawResolved);
    candidates.push(`${rawResolved}.ts`);
    candidates.push(`${rawResolved}.tsx`);
    candidates.push(`${rawResolved}.js`);
    candidates.push(`${rawResolved}.jsx`);
    candidates.push(`${rawResolved}.mjs`);
    candidates.push(`${rawResolved}.cjs`);

    // Try index files inside directory
    candidates.push(`${rawResolved}/index.ts`);
    candidates.push(`${rawResolved}/index.tsx`);
    candidates.push(`${rawResolved}/index.js`);
    candidates.push(`${rawResolved}/index.jsx`);
  } else if (specifier.startsWith('@/')) {
    // Alias import (e.g. Next.js / tsconfig @/)
    const subPath = specifier.replace(/^@\//, '');
    candidates.push(subPath);
    candidates.push(`src/${subPath}`);
    candidates.push(`${subPath}.ts`);
    candidates.push(`${subPath}.tsx`);
    candidates.push(`${subPath}.js`);
    candidates.push(`${subPath}.jsx`);
    candidates.push(`src/${subPath}.ts`);
    candidates.push(`src/${subPath}.tsx`);
    candidates.push(`src/${subPath}.js`);
    candidates.push(`src/${subPath}.jsx`);
    candidates.push(`${subPath}/index.ts`);
    candidates.push(`${subPath}/index.js`);
    candidates.push(`src/${subPath}/index.ts`);
    candidates.push(`src/${subPath}/index.js`);
  } else {
    // Module name that might match a top-level file in repository (e.g. require('database'))
    candidates.push(`${specifier}.js`);
    candidates.push(`${specifier}.ts`);
    candidates.push(`src/${specifier}.js`);
    candidates.push(`src/${specifier}.ts`);
    candidates.push(`${specifier}/index.js`);
    candidates.push(`${specifier}/index.ts`);
  }

  // Find first matching candidate in repository
  for (const cand of candidates) {
    if (availableFilePaths.has(cand)) {
      return cand;
    }
  }

  return null;
}

/**
 * Resolves a Python import specifier against repository files
 */
function resolvePythonImport(sourceFilePath, specifier, availableFilePaths) {
  const sourceDir = sourceFilePath.includes('/')
    ? sourceFilePath.substring(0, sourceFilePath.lastIndexOf('/'))
    : '';

  // Handle relative dots: `from . import auth` or `from ..models import user`
  let cleanSpecifier = specifier;
  let baseDir = sourceDir;

  if (specifier.startsWith('.')) {
    let dotCount = 0;
    while (cleanSpecifier.startsWith('.')) {
      dotCount++;
      cleanSpecifier = cleanSpecifier.substring(1);
    }

    const dirSegments = sourceDir ? sourceDir.split('/') : [];
    for (let i = 1; i < dotCount && dirSegments.length > 0; i++) {
      dirSegments.pop();
    }
    baseDir = dirSegments.join('/');
  }

  // Convert dotted python module to file path: `services.database` -> `services/database`
  const relativeModulePath = cleanSpecifier.replace(/\./g, '/').replace(/^\/+/, '');
  const candidates = [];

  if (baseDir) {
    candidates.push(`${baseDir}/${relativeModulePath}.py`);
    candidates.push(`${baseDir}/${relativeModulePath}/__init__.py`);
  }

  // Also check from repository root
  candidates.push(`${relativeModulePath}.py`);
  candidates.push(`${relativeModulePath}/__init__.py`);
  candidates.push(`src/${relativeModulePath}.py`);
  candidates.push(`src/${relativeModulePath}/__init__.py`);

  // Direct filename match
  candidates.push(`${cleanSpecifier}.py`);

  for (const cand of candidates) {
    const normalized = toForwardSlash(cand);
    if (availableFilePaths.has(normalized)) {
      return normalized;
    }
  }

  return null;
}

/**
 * Resolves a Java import specifier against repository files
 */
function resolveJavaImport(sourceFilePath, specifier, availableFilePaths) {
  // Convert dotted package to path: `com.example.auth.Login` -> `com/example/auth/Login.java`
  const pathCandidate = `${specifier.replace(/\./g, '/')}.java`;
  const className = specifier.split('.').pop();
  const classFileCandidate = `${className}.java`;

  if (availableFilePaths.has(pathCandidate)) {
    return pathCandidate;
  }

  // Search for matching class name across repository files
  for (const filePath of availableFilePaths) {
    if (filePath.endsWith(`/${classFileCandidate}`) || filePath === classFileCandidate) {
      return filePath;
    }
  }

  return null;
}

/**
 * Main import resolver for all analyzed repository files
 * @param {Array<Object>} analyzedFiles
 * @returns {{ resolvedImports: Array, symbolMap: Map, externalDependencies: Set }}
 */
function resolveRepositoryImports(analyzedFiles) {
  const availableFilePaths = new Set(analyzedFiles.map(f => f.path));
  const resolvedImports = [];
  // symbolMap: "sourceFilePath:symbolName" -> { targetFile, originalName }
  const symbolMap = new Map();
  // moduleMap: "sourceFilePath:moduleName" -> targetFile
  const moduleMap = new Map();
  const externalDependencies = new Set();

  for (const file of analyzedFiles) {
    for (const imp of file.imports) {
      let targetFile = null;

      if (file.language === 'python') {
        targetFile = resolvePythonImport(file.path, imp.specifier, availableFilePaths);
      } else if (file.language === 'javascript' || file.language === 'typescript') {
        targetFile = resolveJsTsImport(file.path, imp.specifier, availableFilePaths);
      } else if (file.language === 'java') {
        targetFile = resolveJavaImport(file.path, imp.specifier, availableFilePaths);
      }

      if (targetFile) {
        resolvedImports.push({
          sourceFile: file.path,
          specifier: imp.specifier,
          targetFile,
          names: imp.names || [],
          line: imp.line,
          isInternal: true
        });

        // Register each imported name in the symbol map
        if (Array.isArray(imp.names)) {
          imp.names.forEach(name => {
            symbolMap.set(`${file.path}:${name}`, {
              targetFile,
              originalName: name
            });
          });
        }

        // Register the module namespace itself
        const baseName = imp.specifier.split('/').pop()?.replace(/\.[^.]+$/, '') || imp.specifier;
        moduleMap.set(`${file.path}:${baseName}`, targetFile);
      } else {
        // External third-party package or standard library
        const pkgName = imp.specifier.startsWith('@')
          ? imp.specifier.split('/').slice(0, 2).join('/')
          : imp.specifier.split('/')[0].split('.')[0];

        if (pkgName && !pkgName.startsWith('.')) {
          externalDependencies.add(pkgName);
        }

        resolvedImports.push({
          sourceFile: file.path,
          specifier: imp.specifier,
          targetFile: null,
          names: imp.names || [],
          line: imp.line,
          isInternal: false,
          isExternal: true
        });
      }
    }
  }

  return {
    resolvedImports,
    symbolMap,
    moduleMap,
    externalDependencies: Array.from(externalDependencies)
  };
}

module.exports = {
  resolveRepositoryImports,
  resolveJsTsImport,
  resolvePythonImport,
  resolveJavaImport
};
