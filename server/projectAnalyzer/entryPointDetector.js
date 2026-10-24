// server/projectAnalyzer/entryPointDetector.js
// Detects application entry points across Python, Node.js, Java, and Next.js repositories

/**
 * Detects entry points using file contents, conventions, and configuration files
 * @param {Array<Object>} analyzedFiles
 * @param {Array<Object>} configFiles
 * @returns {Array<Object>} entryPoints
 */
function detectEntryPoints(analyzedFiles = [], configFiles = []) {
  const entryPoints = [];
  const detectedFiles = new Set();

  // 1. Check package.json for Node.js main/bin entry points
  const pkgConfig = configFiles.find(c => c.filename.toLowerCase() === 'package.json');
  if (pkgConfig && pkgConfig.content) {
    try {
      const pkg = JSON.parse(pkgConfig.content);
      if (pkg.main) {
        const cleanMain = pkg.main.replace(/^\.\//, '');
        const matched = analyzedFiles.find(f => f.path === cleanMain || f.path.endsWith(cleanMain));
        if (matched && !detectedFiles.has(matched.path)) {
          detectedFiles.add(matched.path);
          entryPoints.push({
            file: matched.path,
            type: 'package_main',
            confidence: 'high',
            description: `Declared as "main" in package.json (${pkg.main})`
          });
        }
      }

      if (pkg.bin) {
        const binFiles = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin);
        binFiles.forEach(b => {
          const cleanBin = b.replace(/^\.\//, '');
          const matched = analyzedFiles.find(f => f.path === cleanBin || f.path.endsWith(cleanBin));
          if (matched && !detectedFiles.has(matched.path)) {
            detectedFiles.add(matched.path);
            entryPoints.push({
              file: matched.path,
              type: 'package_bin',
              confidence: 'high',
              description: `Declared as CLI executable in package.json`
            });
          }
        });
      }
    } catch (e) {
      // Ignore JSON parse errors in invalid package.json
    }
  }

  // 2. Scan source file contents
  for (const file of analyzedFiles) {
    const content = file.content || '';
    const filename = file.filename.toLowerCase();

    // Python entry point: if __name__ == '__main__':
    if (file.language === 'python') {
      if (/if\s+__name__\s*==\s*['"]__main__['"]\s*:/.test(content)) {
        if (!detectedFiles.has(file.path)) {
          detectedFiles.add(file.path);
          entryPoints.push({
            file: file.path,
            type: 'python_main',
            confidence: 'high',
            description: 'Contains standard `if __name__ == "__main__":` block'
          });
        }
      } else if (['main.py', 'app.py', 'manage.py', 'run.py', 'wsgi.py'].includes(filename)) {
        if (!detectedFiles.has(file.path)) {
          detectedFiles.add(file.path);
          entryPoints.push({
            file: file.path,
            type: 'convention',
            confidence: 'medium',
            description: `Conventional entry point filename (${file.filename})`
          });
        }
      }
    }

    // Java entry point: public static void main(String[] args)
    if (file.language === 'java') {
      if (/public\s+static\s+void\s+main\s*\(\s*String\s*(?:\[\]|\.\.\.)\s*\w+\s*\)/.test(content) ||
          /@SpringBootApplication/.test(content)) {
        if (!detectedFiles.has(file.path)) {
          detectedFiles.add(file.path);
          entryPoints.push({
            file: file.path,
            type: 'java_main',
            confidence: 'high',
            description: 'Contains Java `public static void main(String[] args)`'
          });
        }
      }
    }

    // JavaScript / TypeScript entry point
    if (file.language === 'javascript' || file.language === 'typescript') {
      // Server initialization
      if (/(?:app|server|http)\.listen\s*\(/.test(content) || /createServer\s*\(/.test(content)) {
        if (!detectedFiles.has(file.path)) {
          detectedFiles.add(file.path);
          entryPoints.push({
            file: file.path,
            type: 'server_listen',
            confidence: 'high',
            description: 'HTTP server listener (app.listen / createServer)'
          });
        }
      }
      // Common conventions
      else if (['server.js', 'server.ts', 'index.js', 'index.ts', 'app.js', 'app.ts', 'main.js', 'main.ts'].includes(filename)) {
        if (!detectedFiles.has(file.path)) {
          detectedFiles.add(file.path);
          entryPoints.push({
            file: file.path,
            type: 'convention',
            confidence: 'medium',
            description: `Conventional root entry point filename (${file.filename})`
          });
        }
      }
      // Next.js App Router / Pages Router root
      else if (file.path === 'app/page.tsx' || file.path === 'src/app/page.tsx' || file.path === 'pages/index.tsx') {
        if (!detectedFiles.has(file.path)) {
          detectedFiles.add(file.path);
          entryPoints.push({
            file: file.path,
            type: 'nextjs_page',
            confidence: 'high',
            description: 'Next.js application root route page'
          });
        }
      }
    }
  }

  // Fallback: If no entry point detected, choose file with 0 in-degree or first file
  if (entryPoints.length === 0 && analyzedFiles.length > 0) {
    const first = analyzedFiles[0];
    entryPoints.push({
      file: first.path,
      type: 'default',
      confidence: 'low',
      description: 'Default entry candidate (first source file)'
    });
  }

  return entryPoints;
}

module.exports = {
  detectEntryPoints
};
