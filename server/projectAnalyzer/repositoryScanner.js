// server/projectAnalyzer/repositoryScanner.js
// Scans, normalizes, and filters repository files, ignoring non-source/generated files

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.github',
  'dist',
  'build',
  '.next',
  'coverage',
  '__pycache__',
  'venv',
  '.venv',
  'env',
  '.env',
  '.vscode',
  '.idea',
  'target', // Java maven build target
  'bin',
  'obj',
  '.turbo',
  '.cache'
]);

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'bmp', 'tiff',
  'pdf', 'zip', 'tar', 'gz', 'rar', '7z', 'jar', 'war', 'ear',
  'exe', 'dll', 'so', 'dylib', 'bin', 'wasm',
  'mp4', 'mp3', 'wav', 'ogg', 'webm',
  'ttf', 'woff', 'woff2', 'eot', 'otf',
  'class', 'pyc', 'pyo', 'pyd', 'o', 'a'
]);

const SUPPORTED_EXTENSIONS = {
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

const CONFIG_FILES = new Set([
  'package.json',
  'requirements.txt',
  'pom.xml',
  'build.gradle'
]);

/**
 * Normalizes file path to forward slashes without leading slashes
 */
function normalizePath(rawPath = '') {
  return rawPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();
}

/**
 * Checks whether a path contains any ignored directory segments
 */
function isIgnoredPath(filePath) {
  const normalized = normalizePath(filePath);
  const segments = normalized.split('/');

  for (const segment of segments) {
    if (IGNORED_DIRECTORIES.has(segment.toLowerCase())) {
      return true;
    }
  }

  // Check hidden files or dot directories (except root)
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startsWith('.') && seg !== '.' && seg !== '..') {
      if (['.env', '.git', '.next', '.cache', '.turbo', '.vscode', '.idea'].includes(seg.toLowerCase())) {
        return true;
      }
    }
  }

  // Ignore minified files and source maps
  if (normalized.endsWith('.min.js') || normalized.endsWith('.min.css') || normalized.endsWith('.map')) {
    return true;
  }

  // Ignore lockfiles
  if (['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].some(l => normalized.endsWith(l))) {
    return true;
  }

  // Ignore binary extensions
  const ext = normalized.split('.').pop()?.toLowerCase();
  if (ext && BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}

/**
 * Detect language from file path and extension
 */
function detectFileLanguage(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_EXTENSIONS[ext] || 'unknown';
}

/**
 * Scans an array of files, filtering out ignored and non-source files
 * @param {Array<{path: string, content?: string, name?: string, size?: number}>} files
 * @param {string} repositoryName
 * @returns {{ sourceFiles: Array, configFiles: Array, ignoredCount: number }}
 */
function scanRepository(files = [], repositoryName = 'repository') {
  const sourceFiles = [];
  const configFiles = [];
  let ignoredCount = 0;

  for (const file of files) {
    if (!file || typeof file.path !== 'string') {
      ignoredCount++;
      continue;
    }

    const cleanPath = normalizePath(file.path);
    if (isIgnoredPath(cleanPath)) {
      ignoredCount++;
      continue;
    }

    const filename = cleanPath.split('/').pop() || cleanPath;
    const language = detectFileLanguage(cleanPath);
    const content = typeof file.content === 'string' ? file.content : '';

    // Check if configuration file
    if (CONFIG_FILES.has(filename.toLowerCase())) {
      configFiles.push({
        path: cleanPath,
        filename,
        content,
        type: 'config'
      });
      continue;
    }

    // Only include recognized supported programming languages
    if (language === 'unknown') {
      ignoredCount++;
      continue;
    }

    sourceFiles.push({
      path: cleanPath,
      filename,
      language,
      content,
      size: file.size || content.length,
      directory: cleanPath.includes('/') ? cleanPath.substring(0, cleanPath.lastIndexOf('/')) : ''
    });
  }

  return {
    repositoryName,
    sourceFiles,
    configFiles,
    ignoredCount,
    totalScanned: files.length
  };
}

module.exports = {
  scanRepository,
  normalizePath,
  isIgnoredPath,
  detectFileLanguage,
  SUPPORTED_EXTENSIONS
};
