// server/routes/aiRouter.js
// Local Ollama model (configurable via OLLAMA_MODEL env var) with Groq fallback.
// Requires: npm install ollama node-fetch dotenv

const express = require('express');
const router = express.Router();
const { Ollama } = require('ollama');
const fetch = require('node-fetch'); // for Groq fallback
require('dotenv').config(); // ensure .env is loaded

// ---------------------------------------------------------------------------
// Ollama client
// Reads OLLAMA_BASE_URL (preferred) or OLLAMA_HOST for backwards-compat.
// OLLAMA_MODEL from .env sets the preferred local model; falls back to a safe
// chain of well-known small models if the preferred one isn't installed.
// ---------------------------------------------------------------------------
const OLLAMA_HOST_URL =
  process.env.OLLAMA_BASE_URL ||
  process.env.OLLAMA_HOST ||
  'http://127.0.0.1:11434';

const ollama = new Ollama({
  host: OLLAMA_HOST_URL,
  requestTimeout: 60000 // 60 s default request timeout for Ollama SDK
});

// The user-configured preferred local model (from .env), or a sensible default.
const ENV_OLLAMA_MODEL = (process.env.OLLAMA_MODEL || '').trim();

// Ordered candidate list for local model selection.
// The env-configured model is tried first when set.
const LOCAL_MODEL_CANDIDATES = [
  ...(ENV_OLLAMA_MODEL ? [ENV_OLLAMA_MODEL] : []),
  'codemindai-gemma:latest',
  'codegemma:2b',
  'qwen2.5-coder:7b',
  'qwen2.5:3b',
  'llama3.2:3b',
  'mistral:7b'
];

// Keep these for backwards compatibility / display purposes
const DEFAULT_LOCAL_PRIMARY = LOCAL_MODEL_CANDIDATES[0];
const DEFAULT_LOCAL_FALLBACK = LOCAL_MODEL_CANDIDATES[1] || 'codegemma:2b';

// ---------------------------------------------------------------------------
// Groq configuration (cloud fallback)
// Primary:   qwen/qwen3.8-27b  — confirmed working October 2026
// Secondary: allam-2-7b        — confirmed working October 2026
// Deprecated models removed:
//   llama-3.1-8b-instant  → 404 on this account
//   llama-3.1-70b-versatile → officially decommissioned
// ---------------------------------------------------------------------------
const GROQ_API_KEY = process.env.GROQ_API_KEY || null;
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_PRIMARY = 'qwen/qwen3.8-27b';
const GROQ_SECONDARY = 'allam-2-7b';

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds for higher-level requests

// ---------------------------------------------------------------------------
// Ollama availability cache
//
// Problem: when Ollama is offline every AI request wastes several seconds
// waiting for the SDK's connection attempt to fail before falling through to
// Groq. This cache probes Ollama with a tight 2-second timeout, remembers
// the result for OLLAMA_CACHE_TTL_MS, and lets all requests skip Ollama
// entirely until the TTL expires (at which point one probe fires again).
//
// When Ollama comes back online the next probe succeeds, the cache flips to
// "reachable", and local inference resumes automatically.
// ---------------------------------------------------------------------------
const OLLAMA_PROBE_TIMEOUT_MS = 2000;   // how long to wait for the probe
const OLLAMA_CACHE_TTL_MS     = 30000;  // re-probe every 30 s

let _ollamaCache = {
  reachable: null,   // null = unknown, true/false = last result
  checkedAt: 0       // Date.now() of last probe
};

/**
 * Returns true if Ollama is reachable right now.
 * Uses the cache; only fires a real network probe when the TTL has expired.
 */
async function isOllamaReachable() {
  const now = Date.now();
  if (_ollamaCache.reachable !== null && (now - _ollamaCache.checkedAt) < OLLAMA_CACHE_TTL_MS) {
    return _ollamaCache.reachable; // serve from cache
  }

  // TTL expired — run a fresh probe with a tight timeout
  try {
    await withTimeout(
      ollama.list(),
      OLLAMA_PROBE_TIMEOUT_MS,
      'Ollama probe timed out'
    );
    _ollamaCache = { reachable: true, checkedAt: now };
    console.log('[Ollama] Reachability probe: ONLINE');
    return true;
  } catch {
    _ollamaCache = { reachable: false, checkedAt: now };
    console.log(`[Ollama] Reachability probe: OFFLINE (next check in ${OLLAMA_CACHE_TTL_MS / 1000}s)`);
    return false;
  }
}

// Basic fallback suggestions if everything fails
const FALLBACK_RESPONSES = [
  "// Suggestion: break function into smaller functions for clarity.",
  "// Suggestion: add basic input validation for this function.",
  "// Suggestion: consider early returns to reduce nesting.",
  "// Suggestion: add try/catch to improve error handling.",
  "// Suggestion: improve naming for readability."
];

function getFallbackResponse() {
  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

/**
 * Advanced code structure analyzer
 * Extracts functions, classes, imports, control structures, and dependencies
 */
function analyzeCodeStructure(codeContent, languageHint = '') {
  const structure = {
    language: languageHint || detectLanguage(codeContent),
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    variables: [],
    controlStructures: {
      ifStatements: 0,
      loops: 0,
      switches: 0,
      tryCatch: 0
    },
    dependencies: [],
    entryPoints: []
  };

  const lines = codeContent.split('\n');
  let inFunction = false;
  let inClass = false;
  let braceCount = 0;
  let currentFunction = null;
  let currentClass = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const originalLine = lines[i];

    // Detect imports
    if (line.match(/^(import|from|require|#include|using)\s/)) {
      structure.imports.push({ line: i + 1, content: line.substring(0, 100) });
      
      // Extract package names
      const packageMatch = line.match(/(?:from|import|require\(|using\s+)(['"`])([^'"`]+)\1/);
      if (packageMatch) {
        structure.dependencies.push(packageMatch[2]);
      }
    }

    // Detect exports
    if (line.match(/^(export|module\.exports)/)) {
      structure.exports.push({ line: i + 1, content: line.substring(0, 100) });
    }

    // Detect classes (multi-language support)
    const classMatch = line.match(/^\s*(export\s+)?(class|interface|type)\s+(\w+)/);
    if (classMatch) {
      structure.classes.push({
        name: classMatch[3],
        line: i + 1,
        type: classMatch[2]
      });
      inClass = true;
      currentClass = classMatch[3];
    }

    // Detect functions/methods
    const functionPatterns = [
      /^\s*(export\s+)?(async\s+)?(function|const|let|var)\s+(\w+)\s*[=(]/,
      /^\s*(export\s+)?(async\s+)?(\w+)\s*[:=]\s*(async\s+)?\(/,
      /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?(\w+)\s*\(/,
      /^\s*def\s+(\w+)\s*\(/
    ];

    for (const pattern of functionPatterns) {
      const match = line.match(pattern);
      if (match) {
        const funcName = match[4] || match[5] || match[1];
        if (funcName && !['if', 'for', 'while', 'switch', 'catch', 'then'].includes(funcName)) {
          structure.functions.push({
            name: funcName,
            line: i + 1,
            async: line.includes('async'),
            class: currentClass || null
          });
          inFunction = true;
          currentFunction = funcName;
          break;
        }
      }
    }

    // Detect control structures
    if (line.match(/^\s*if\s*\(|^\s*if\s+/)) structure.controlStructures.ifStatements++;
    if (line.match(/^\s*(for|while|forEach|map)\s*\(|^\s*for\s+/)) structure.controlStructures.loops++;
    if (line.match(/^\s*switch\s*\(/)) structure.controlStructures.switches++;
    if (line.match(/^\s*try\s*\{|^\s*try:/)) structure.controlStructures.tryCatch++;

    // Detect entry points (main, index, app, etc.)
    if (line.match(/\b(main|index|app|entry|entryPoint|start|init)\s*\(/i)) {
      structure.entryPoints.push({ line: i + 1, name: line.substring(0, 80) });
    }

    // Track brace/indentation to detect function/class boundaries
    if (line.includes('{')) braceCount++;
    if (line.includes('}')) {
      braceCount--;
      if (braceCount === 0) {
        if (inFunction) {
          inFunction = false;
          currentFunction = null;
        }
        if (inClass && originalLine.includes('}')) {
          inClass = false;
          currentClass = null;
        }
      }
    }
  }

  return structure;
}

/**
 * Detect programming language from filename
 */
function detectLanguageFromFileName(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const langMap = {
    'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript',
    'ts': 'typescript', 'tsx': 'typescript',
    'py': 'python', 'pyw': 'python',
    'java': 'java',
    'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp', 'h': 'cpp', 'hpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'rb': 'ruby',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala'
  };
  return langMap[ext] || '';
}

/**
 * Detect programming language from code content
 */
function detectLanguage(codeContent) {
  const patterns = {
    javascript: [/\b(function|const|let|var|=>|require\(|import\s)/, /\.js$/],
    typescript: [/:\s*\w+[<>]?[,;\)]/, /interface\s+\w+/, /type\s+\w+/, /\.tsx?$/],
    python: [/def\s+\w+\s*\(/, /import\s+\w+/, /from\s+\w+\s+import/, /\.py$/],
    java: [/public\s+class/, /private\s+\w+\s+\w+;/, /\.java$/],
    cpp: [/#include\s*</, /using\s+namespace/, /\.cpp$|\.h$/],
    csharp: [/using\s+System/, /namespace\s+\w+/, /\.cs$/],
    go: [/func\s+\w+\s*\(/, /package\s+\w+/, /\.go$/],
    rust: [/fn\s+\w+\s*\(/, /use\s+\w+/, /\.rs$/],
    php: [/<\?php/, /function\s+\w+\s*\(/, /\.php$/],
    ruby: [/def\s+\w+/, /class\s+\w+/, /\.rb$/]
  };

  const scores = {};
  for (const [lang, patterns] of Object.entries(patterns)) {
    scores[lang] = patterns.reduce((score, pattern) => {
      return score + (pattern.test(codeContent) ? 1 : 0);
    }, 0);
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'unknown';
  
  return Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'unknown';
}

/**
 * Utility: sleep for ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Utility: run a Promise with a timeout
 */
function withTimeout(promise, ms, timeoutMessage = 'Request timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms))
  ]);
}

/**
 * Utility: extract code-only content from AI message.
 * Preferred behavior:
 * 1. If there are triple-backtick code blocks, return their contents concatenated.
 * 2. Otherwise, remove lines starting with //, #, /*, or ``` and return what's left.
 * 3. If the result is empty, return the original content as fallback.
 */
function extractCodeOnly(aiText) {
  if (!aiText || typeof aiText !== 'string') return '';

  // Find all ``` blocks (support ```lang and ``` with no lang)
  const codeBlockRegex = /```(?:[\w-]+)?\n?([\s\S]*?)```/g;
  const codeBlocks = [];
  let match;
  while ((match = codeBlockRegex.exec(aiText)) !== null) {
    codeBlocks.push(match[1].trim());
  }
  if (codeBlocks.length > 0) {
    return codeBlocks.join('\n\n');
  }

  // If no fences, remove explanation lines and keep likely code lines
  const lines = aiText.split('\n');
  const filtered = lines.filter(line => {
    const t = line.trim();
    if (!t) return false;
    if (t.startsWith('//') || t.startsWith('#') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('```')) return false;
    // we keep typical code lines, including lines ending with ; or { or }
    // keep lines with parentheses (function calls), "const" "let" "var" "function", "class", import/export, return
    const likelyCodeKeywords = ['const ', 'let ', 'var ', 'function ', 'class ', 'import ', 'export ', 'return ', '=>', ';', '{', '}', 'console.', 'if(', 'if (', 'for(', 'for (', 'while(', 'try{', 'try {'];
    return likelyCodeKeywords.some(k => t.includes(k)) || /[;{}()=<>]/.test(t);
  });

  const joined = filtered.join('\n').trim();
  if (joined.length > 0) return joined;

  // As last resort return original cleaned (but not comments)
  return lines.filter(l => l.trim() !== '' && !l.trim().startsWith('```')).join('\n').trim() || aiText.trim();
}

/**
 * Helper: Run a chat completion on local Ollama using provided model and messages.
 * Returns parsed response object or throws.
 */
async function callLocalOllama(model, messages = [], options = {}) {

  // ---- CodeGemma requires instruction-style prompt ----
  if (model.startsWith('codemindai-gemma') || model.startsWith('codegemma')) {
    const prompt = messages.map(m => m.content).join('\n\n');

    console.log('[CODEGEMMA PROMPT]');
    console.log(prompt.slice(0, 500));

    const response = await ollama.generate({
      model,
      prompt,
      options
    });

    // CodeGemma (ollama.generate) response format: response.response contains the generated text
    const content = response.response || response.message?.content || response.text || '';
    
    console.log('[CODEGEMMA RESPONSE] Length:', content.length, 'chars');
    
    return {
      message: {
        content: content
      },
      response: content // Also include in response field for analyze-repo compatibility
    };
  }

  // ---- Other models (Qwen / Groq) use chat ----
  return await ollama.chat({
    model,
    messages,
    stream: false,
    options
  });
}



/**
 * Helper: Call Groq Chat Completion API as fallback.
 * Note: We assume the Groq endpoint accepts similar chat schema. Adjust if Groq changes API.
 */
async function callGroq(model, messages = [], options = {}) {
  if (!GROQ_API_KEY) {
    throw new Error('No Groq API key configured (GROQ_API_KEY not set).');
  }

  // Create a Groq-style chat payload (approximate)
  const payload = {
    model,
    messages: messages.map(m => {
      // Groq expects roles too; keep same schema
      return { role: m.role, content: m.content };
    }),
    max_tokens: options.max_tokens || 512,
    temperature: options.temperature !== undefined ? options.temperature : 0.2,
    top_p: options.top_p !== undefined ? options.top_p : 0.95
  };

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    timeout: options.requestTimeout || 30000
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error: ${res.status} ${res.statusText} - ${text}`);
  }

  const json = await res.json();
  // Normalize: many chat APIs return choices[0].message.content
  const content = json.choices && json.choices[0] && (json.choices[0].message?.content || json.choices[0].text) ?
    (json.choices[0].message?.content || json.choices[0].text) :
    (json.output?.[0]?.content?.[0]?.text || JSON.stringify(json));
  return { message: { content } , raw: json };
}

/**
 * Decide which local model to use based on actually installed Ollama models.
 *
 * Strategy:
 *  1. Ask Ollama for the installed model list.
 *  2. Walk LOCAL_MODEL_CANDIDATES in order; return the first one found.
 *  3. If Ollama is not reachable, throw a descriptive error immediately so the
 *     caller can skip straight to the Groq fallback without wasting a round-trip.
 *  4. If Ollama is reachable but none of our candidates are installed, throw a
 *     descriptive error that names the missing model so the user knows exactly
 *     what to `ollama pull`.
 */
async function selectLocalModel() {
  let installedNames;
  try {
    const listed = (await ollama.list()).models || [];
    installedNames = listed.map(m => (m.name || m).toString().trim());
  } catch (err) {
    throw new Error(
      `Ollama is not reachable at ${OLLAMA_HOST_URL}. ` +
      `Start Ollama with "ollama serve" and ensure it is running. ` +
      `(original error: ${err.message})`
    );
  }

  if (installedNames.length === 0) {
    throw new Error(
      `Ollama is running but no models are installed. ` +
      `Run "ollama pull ${LOCAL_MODEL_CANDIDATES[0]}" to install one.`
    );
  }

  // Exact-match first, then prefix-match (e.g. "qwen2.5-coder" matches "qwen2.5-coder:latest")
  for (const candidate of LOCAL_MODEL_CANDIDATES) {
    if (installedNames.includes(candidate)) return candidate;
    // prefix match: "qwen2.5-coder:7b" starts with "qwen2.5-coder"
    const prefix = candidate.split(':')[0];
    const found = installedNames.find(n => n === candidate || n.startsWith(prefix + ':'));
    if (found) return found;
  }

  throw new Error(
    `None of the expected local models are installed in Ollama. ` +
    `Installed: [${installedNames.join(', ')}]. ` +
    `Run "ollama pull ${LOCAL_MODEL_CANDIDATES[0]}" to install a compatible model, ` +
    `or set OLLAMA_MODEL=<model> in your .env file to point at an installed model.`
  );
}

/**
 * High-level inference: Try local Ollama -> Groq primary -> Groq secondary.
 *
 * Each provider's failure is captured independently so a Groq error never
 * hides an Ollama error and vice-versa.  The final thrown error includes all
 * individual failure messages.
 *
 * messages: array of {role, content}
 * options: { timeoutMs, num_predict, temperature, top_p, max_tokens }
 */
async function generateWithFallback(messages = [], options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const errors = {}; // keyed by provider label for clear reporting

  // ------------------------------------------------------------------
  // 1. Local Ollama
  // ------------------------------------------------------------------
  let localModel = null;
  try {
    localModel = await selectLocalModel();
  } catch (selectErr) {
    errors.ollama_select = selectErr.message;
    // Cannot try Ollama at all — fall through to Groq
  }

  if (localModel) {
    try {
      const response = await withTimeout(
        callLocalOllama(localModel, messages, {
          num_predict: options.num_predict || 200,
          temperature: options.temperature !== undefined ? options.temperature : 0.2,
          top_p: options.top_p !== undefined ? options.top_p : 0.95,
          top_k: options.top_k !== undefined ? options.top_k : 40
        }),
        timeoutMs,
        `Local Ollama model "${localModel}" timed out after ${timeoutMs}ms`
      );
      return { source: 'local', model: localModel, response };
    } catch (localErr) {
      errors[`ollama_${localModel}`] = localErr.message;
      console.warn(`[generateWithFallback] Local Ollama failed (${localModel}): ${localErr.message}`);
    }
  }

  // ------------------------------------------------------------------
  // 2. Groq cloud fallback
  // ------------------------------------------------------------------
  if (!GROQ_API_KEY) {
    const ollamaDetail = Object.entries(errors)
      .map(([k, v]) => `[${k}] ${v}`)
      .join('; ');
    throw new Error(
      `All local AI providers failed and no Groq API key is configured. ` +
      `Local errors: ${ollamaDetail || 'none'}. ` +
      `Set GROQ_API_KEY in your server/.env file to enable cloud fallback.`
    );
  }

  // Try Groq primary model
  try {
    const groqResp = await withTimeout(
      callGroq(GROQ_PRIMARY, messages, options),
      timeoutMs,
      `Groq "${GROQ_PRIMARY}" timed out after ${timeoutMs}ms`
    );
    return { source: 'groq', model: GROQ_PRIMARY, response: groqResp };
  } catch (g1Err) {
    errors[`groq_${GROQ_PRIMARY}`] = g1Err.message;
    console.warn(`[generateWithFallback] Groq primary failed (${GROQ_PRIMARY}): ${g1Err.message}`);
  }

  // Try Groq secondary model
  try {
    const groqResp2 = await withTimeout(
      callGroq(GROQ_SECONDARY, messages, options),
      timeoutMs * 2,
      `Groq "${GROQ_SECONDARY}" timed out after ${timeoutMs * 2}ms`
    );
    return { source: 'groq', model: GROQ_SECONDARY, response: groqResp2 };
  } catch (g2Err) {
    errors[`groq_${GROQ_SECONDARY}`] = g2Err.message;
    console.warn(`[generateWithFallback] Groq secondary failed (${GROQ_SECONDARY}): ${g2Err.message}`);
  }

  // All providers exhausted — build a clear, structured error message
  const summary = Object.entries(errors)
    .map(([k, v]) => `  • [${k}]: ${v}`)
    .join('\n');
  throw new Error(`All AI providers failed:\n${summary}`);
}

/* ---------------------------
   ROUTES
   ---------------------------*/

/**
 * POST /api/ai/complete
 * Expects: { code: string }
 * Returns: { suggestion: string }
 *
 * This endpoint will:
 * - create a short chat prompt telling the model to respond only with code
 * - call local Qwen model with fallback to Groq
 * - clean the response to return code-only text
 */
router.post('/complete', async (req, res) => {
  const { code } = req.body;
  console.log('[/complete] Request received. Code size:', code ? code.length : 0);

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'No code provided in request body.' });
  }

  const systemPrompt = 'You are a helpful coding assistant. Respond only with the completed or improved code, no explanations.';
  const userPrompt = `Complete or improve the following code. Respond with code only (use code blocks if possible):\n\n${code}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  try {
    const result = await generateWithFallback(messages, { timeoutMs: 120000, num_predict: 200, temperature: 0.2 });
    // Extract content text (different shapes for local/groq)
    let rawContent = '';
    if (result.source === 'local') {
      rawContent = result.response.message?.content || result.response.output?.[0]?.content?.[0]?.text || JSON.stringify(result.response);
    } else if (result.source === 'groq') {
      rawContent = result.response.message?.content || result.response.raw?.choices?.[0]?.text || JSON.stringify(result.response.raw);
    } else {
      rawContent = JSON.stringify(result.response);
    }

    const codeOnly = extractCodeOnly(rawContent);

    // If after extraction nothing useful, use fallback suggestion
    const suggestion = codeOnly && codeOnly.length > 5 ? codeOnly : getFallbackResponse();

    return res.json({ suggestion });
  } catch (err) {
    console.error('[complete] Error:', err);
    return res.status(500).json({
      error: 'Failed to get AI completion. Check Ollama and Groq configuration.',
      details: err.message,
      suggestion: getFallbackResponse()
    });
  }
});

/**
 * POST /api/ai/analyze-repo
 * Expects: { files: [{ path, content, language, size, updated_at, created_at }], owner: string, repo: string }
 * Returns: { success, analysis, metadata }
 *
 * This endpoint builds a long analysis prompt and requests a repository analysis.
 * It attempts local model first, then Groq fallback. Because repo analysis can be large,
 * we use longer timeouts and max tokens.
 */
router.post('/analyze-repo', async (req, res) => {
  const { files = [], owner = 'unknown', repo = 'unknown' } = req.body;

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files provided for analysis' });
  }

  try {
    console.log(`[analyze-repo] Analyzing ${owner}/${repo}. Files: ${files.length}`);

    // Build fileStructure summary
    const fileStructure = files.map(f => ({ path: f.path, language: f.language || 'unknown', size: f.size || 0 }));
    const packageFiles = {
      'package.json': files.find(f => f.path.endsWith('package.json')),
      'requirements.txt': files.find(f => f.path.endsWith('requirements.txt')),
      'pom.xml': files.find(f => f.path.endsWith('pom.xml')),
      'build.gradle': files.find(f => f.path.endsWith('build.gradle')),
      'composer.json': files.find(f => f.path.endsWith('composer.json')),
      'Gemfile': files.find(f => f.path.endsWith('Gemfile')),
      'Cargo.toml': files.find(f => f.path.endsWith('Cargo.toml'))
    };

    const getDependencies = (file) => {
      if (!file || !file.content) return [];
      try {
        if (file.path.endsWith('package.json')) {
          const pkg = JSON.parse(file.content);
          return Object.entries({
            ...(pkg.dependencies || {}),
            ...(pkg.devDependencies || {})
          }).map(([name, version]) => ({ name, version }));
        }
      } catch (e) {
        console.warn(`[analyze-repo] Error parsing ${file.path}:`, e.message);
      }
      return [];
    };

    const allDependencies = [];
    Object.values(packageFiles).forEach(file => {
      if (file) allDependencies.push(...getDependencies(file));
    });

    const fileTypes = files.reduce((acc, file) => {
      const extParts = (file.path || '').split('.');
      const ext = extParts.length > 1 ? extParts.pop() : 'other';
      if (!acc[ext]) acc[ext] = [];
      acc[ext].push(file);
      return acc;
    }, {});

    // directory structure (shallow)
    const dirStructure = {};
    files.forEach(file => {
      const parts = (file.path || '').split('/');
      let current = dirStructure;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        if (!current[part]) {
          current[part] = isFile ? { _type: 'file', path: file.path, language: file.language, size: file.size } : { _type: 'dir' };
        }
        if (!isFile) {
          current = current[part];
        }
      }
    });

    // Entry points heuristic
    const entryPoints = files.filter(file => /(src\/index|app\/main|src\/main|src\/app)/.test(file.path) || ['main.js','app.js','index.js','server.js'].some(n => file.path.endsWith(n))).slice(0, 6);
    const testFiles = files.filter(file => file.path.includes('test/') || file.path.includes('__tests__') || file.path.endsWith('.test.js') || file.path.endsWith('.spec.js')).slice(0, 8);
    const configFiles = files.filter(file => file.path.match(/\.(json|yaml|yml|toml|env|config|conf|rc)$/) || file.path.match(/(package\.json|webpack\.config|babel\.config|tsconfig\.json|jest\.config)/)).slice(0, 8);
    const docFiles = files.filter(file => file.path.match(/(README|CONTRIBUTING|LICENSE|CHANGELOG|CODE_OF_CONDUCT)/i)).slice(0, 6);

    // Prepare a summary prompt (trim large fields)
    const totalSizeKb = (files.reduce((sum, f) => sum + (f.size || 0), 0) / 1024).toFixed(2);
    const typesSummary = Object.entries(fileTypes).sort((a,b) => b[1].length - a[1].length).map(([ext, arr]) => `${ext} (${arr.length})`).join(', ');

    const truncatedDir = JSON.stringify(dirStructure, null, 2).slice(0, 2000); // keep within prompt size

    // Build file content summaries (include key files for CodeGemma analysis)
    const keyFilesContent = files
      .filter(f => f.content && (
        f.path.endsWith('package.json') ||
        f.path.endsWith('README.md') ||
        f.path.endsWith('index.js') ||
        f.path.endsWith('app.js') ||
        f.path.endsWith('server.js') ||
        entryPoints.some(ep => ep.path === f.path)
      ))
      .slice(0, 5)
      .map(f => `File: ${f.path}\n${f.content.substring(0, 500)}...`)
      .join('\n\n---\n\n');

    // Create optimized prompt for CodeGemma (instruction-style) and other models (chat-style)
    const analysisPromptForCodeGemma = `Analyze the repository "${owner}/${repo}" and provide a comprehensive overview.

REPOSITORY OVERVIEW:
- Repository: ${owner}/${repo}
- Total files: ${files.length}
- Total size: ${totalSizeKb} KB
- File types: ${typesSummary}
- Top-level directories: ${[...new Set(files.map(f => f.path.split('/')[0]))].slice(0,10).join(', ')}

DIRECTORY STRUCTURE:
${truncatedDir}

DEPENDENCIES (${allDependencies.length}):
${allDependencies.length > 0 ? allDependencies.slice(0, 20).map(d => `- ${d.name} ${d.version}`).join('\n') : 'No dependencies found.'}

ENTRY POINTS:
${entryPoints.length > 0 ? entryPoints.map(e => `- ${e.path}`).join('\n') : 'None found'}

CODE STATISTICS:
- Test files: ${testFiles.length}
- Config files: ${configFiles.length}
- Documentation files: ${docFiles.length}

KEY FILES CONTENT:
${keyFilesContent || 'No key files available.'}

TASK: Provide a detailed repository analysis with the following sections:

1. PROJECT OVERVIEW
   - What is this project? Describe its main purpose and functionality.
   - What technologies and frameworks are used?
   - What is the project structure?

2. ARCHITECTURE & COMPONENTS
   - Main components and modules
   - How is the codebase organized?
   - Key files and their purposes
   - Entry points and how the application starts

3. DEPENDENCIES & TECHNOLOGIES
   - Main dependencies and their purposes
   - Technology stack overview
   - Notable libraries or frameworks

4. CODE QUALITY & STRUCTURE
   - Overall code organization
   - Testing coverage (${testFiles.length} test files)
   - Configuration and setup requirements

5. GETTING STARTED
   - How to set up and run this project
   - Key configuration needed
   - Entry points for new developers

6. IMPROVEMENTS & RECOMMENDATIONS
   - Security considerations
   - Testing improvements
   - Code organization suggestions
   - Production readiness

Provide clear, structured output with numbered lists. Be thorough but concise.`;

    // Build messages - callLocalOllama will handle CodeGemma's instruction format conversion
    const systemPrompt = 'You are an expert software architect analyzing code repositories. Provide clear, structured analysis with actionable insights. Focus on giving a comprehensive overview of the repository structure, purpose, architecture, and key components.';
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: analysisPromptForCodeGemma }
    ];

    console.log(`[analyze-repo] Prepared prompt with ${keyFilesContent ? 'key files' : 'structure only'}`);

    // This can be heavy -> allow longer timeout and more tokens
    const result = await generateWithFallback(messages, { timeoutMs: 220000, num_predict: 900, temperature: 0.3, max_tokens: 900 });

    // Get text - properly handle CodeGemma response format
    let rawContent = '';
    if (result.source === 'local') {
      // CodeGemma uses ollama.generate() which we now return as response.response
      // Qwen uses ollama.chat() which returns response.message.content
      // Priority: response.response (CodeGemma) > message.content (Qwen) > other formats
      rawContent = result.response.response ||               // CodeGemma output (set by callLocalOllama)
                   result.response.message?.content ||       // Qwen output
                   result.response.output?.[0]?.content?.[0]?.text ||
                   (result.response.text || '');
      
      // If still empty, try to extract from the full response
      if (!rawContent && typeof result.response === 'string') {
        rawContent = result.response;
      }
    } else if (result.source === 'groq') {
      rawContent = result.response.message?.content || 
                   result.response.raw?.choices?.[0]?.message?.content || 
                   result.response.raw?.choices?.[0]?.text || 
                   '';
    } else {
      rawContent = JSON.stringify(result.response);
    }

    console.log(`[analyze-repo] Raw content length: ${rawContent.length}, source: ${result.source}, model: ${result.model}`);


    // We want the AI to respond normally (analysis, not code-only)
    const analysis = typeof rawContent === 'string'
  ? rawContent.trim()
  : JSON.stringify(rawContent, null, 2);


    console.log('[analyze-repo] Analysis complete. Source:', result.source, 'Model:', result.model);

    return res.json({
      success: true,
      analysis,
      metadata: {
        totalFiles: files.length,
        fileTypes: Object.keys(fileTypes).length,
        dependencies: allDependencies.length,
        usedModel: result.model,
        source: result.source,
        analyzedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[analyze-repo] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze repository',
      details: error.message
    });
  }
});

/**
 * POST /api/ai/explain
 * Expects: {
 *   code: string,
 *   language?: string,            // source language of the code (informational)
 *   filePath?: string,
 *   startLine?: number,
 *   endLine?: number,
 *   explainLanguage?: 'en' | 'hi',// response language; default 'en'
 *   nodeType?: string,            // flowchart node type, when explaining a node
 *   nodeLabel?: string,
 *   context?: string              // optional surrounding-context hint
 * }
 * Returns: { explanation: string, language: 'en'|'hi', source: 'ai'|'fallback', usedModel?: string }
 *
 * Uses local model (Ollama) -> Groq fallback via generateWithFallback.
 * On any AI failure (or empty content), returns HTTP 200 with a deterministic
 * metadata-based fallback explanation (source:'fallback') so the client always
 * gets something usable — never a 500.
 */
router.post('/explain', async (req, res) => {
  const {
    code = '',
    language = '',
    filePath = '',
    startLine = null,
    endLine = null,
    explainLanguage = 'en',
    nodeType = '',
    nodeLabel = '',
    context = ''
  } = req.body;

  // Normalize response language: only 'hi' is supported, everything else -> 'en'
  const lang = explainLanguage === 'hi' ? 'hi' : 'en';

  // Need at least some code or node metadata to explain
  if (!code && !nodeType && !nodeLabel) {
    return res.status(400).json({ error: 'No code or node metadata provided' });
  }

  // ---- Language-aware system prompt ---------------------------------
  const systemPrompt = lang === 'hi'
    ? 'आप शुरुआती लोगों के लिए एक धैर्यवान प्रोग्रामिंग शिक्षक हैं। प्रदान की गई कोड को हिंदी में सरल और स्पष्ट भाषा में समझाएं। कोड पहचानने वाले नाम, फ़ंक्शन नाम, फ़ाइल पथ, API नाम और कीवर्ड को यथावत रखें। बताएं कि कोड क्या करता है और क्यों: महत्वपूर्ण चर, शर्तें, लूप, फ़ंक्शन कॉल और वापसी मान। कोड को चलाएं नहीं और परिणाम गढ़कर न बताएं। कोड को अक्षर-दर-अक्षर न पढ़ें; इसका अर्थ समझाएं। संक्षिप्त रहें: एकल कथन के लिए 3-5 वाक्य, फ़ंक्शन के लिए अधिक।'
    : 'You are a patient programming teacher for beginners. Explain the provided code in simple, clear English. Preserve code identifiers, function names, file paths, API names, and programming keywords exactly as written. Explain what the code does and why: important variables, conditions, loops, function calls, and return values. Do NOT execute the code or invent runtime results. Do not read source code character by character; explain its meaning. Be concise: 3-5 sentences for a single statement, more for a function.';

  // ---- User prompt: location + node context + code + hint ----------
  const parts = [];

  const locationBits = [];
  if (filePath) locationBits.push(filePath);
  if (startLine != null && endLine != null) {
    locationBits.push(`lines ${startLine}-${endLine}`);
  } else if (startLine != null) {
    locationBits.push(`line ${startLine}`);
  }
  if (locationBits.length) {
    parts.push(`Location: ${locationBits.join(', ')}.`);
  }

  if (nodeType || nodeLabel) {
    const nodeLine = lang === 'hi'
      ? `यह एक फ़्लोचार्ट नोड है (प्रकार: ${nodeType || 'unknown'}, लेबल: "${nodeLabel || ''}"). अपनी व्याख्या को इस नोड की नियंत्रण प्रवाह में भूमिका से जोड़ें।`
      : `This is a flowchart node of type ${nodeType || 'unknown'} labeled "${nodeLabel || ''}". Relate your explanation to this node's role in the control flow.`;
    parts.push(nodeLine);
  }

  if (code) {
    parts.push(`Code:\n\n${code}`);
  }

  if (context) {
    parts.push(`Surrounding context:\n\n${context}`);
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: parts.join('\n\n') }
  ];

  try {
    const result = await generateWithFallback(messages, { timeoutMs: 45000, num_predict: 600, temperature: 0.3 });

    // Extract content text (same local/groq shape handling as /chat and /complete)
    let rawContent = '';
    if (result.source === 'local') {
      rawContent = result.response.message?.content || result.response.output?.[0]?.content?.[0]?.text || JSON.stringify(result.response);
    } else if (result.source === 'groq') {
      rawContent = result.response.message?.content || result.response.raw?.choices?.[0]?.text || JSON.stringify(result.response.raw);
    } else {
      rawContent = JSON.stringify(result.response);
    }

    if (rawContent && rawContent.trim()) {
      return res.json({ explanation: rawContent.trim(), language: lang, source: 'ai', usedModel: result.model });
    }

    // Empty AI content -> fall through to the deterministic fallback below
    throw new Error('AI provider returned empty content');

  } catch (error) {
    // ---- Deterministic metadata-based fallback (HTTP 200, not 500) ----
    console.error('[explain] AI failed, returning fallback:', error.message);

    const unavailableNote = lang === 'hi'
      ? 'AI व्याख्या सेवा वर्तमान में अनुपलब्ध है, इसलिए यह मेटाडेटा से एक बुनियादी सारांश है।'
      : 'The AI explanation service is currently unavailable, so this is a basic summary from the node metadata.';

    // Location string (used in both branches)
    let location = '';
    if (filePath && startLine != null && endLine != null) {
      location = lang === 'hi'
        ? `${filePath} की पंक्तियाँ ${startLine}-${endLine}`
        : `Lines ${startLine}-${endLine} of ${filePath}`;
    } else if (filePath && startLine != null) {
      location = lang === 'hi'
        ? `${filePath} की पंक्ति ${startLine}`
        : `Line ${startLine} of ${filePath}`;
    } else if (filePath) {
      location = filePath;
    }

    let fallback;
    if (nodeType || nodeLabel) {
      const nodeLine = lang === 'hi'
        ? `यह ${nodeType || 'एक'} नोड है जिसका लेबल "${nodeLabel || ''}" है।`
        : `This is a ${nodeType || 'unknown'} node labeled "${nodeLabel || ''}".`;
      const sentences = [nodeLine];
      if (location) sentences.push(lang === 'hi' ? `स्थान: ${location}` : `Location: ${location}`);
      sentences.push(unavailableNote);
      fallback = sentences.join(' ');
    } else {
      // Tiny structural hint detected from the code
      const constructs = [];
      if (code) {
        if (/\bif\b/.test(code) || /\belse\b/.test(code)) constructs.push(lang === 'hi' ? 'शर्त (if/else)' : 'a conditional (if/else)');
        if (/\bfor\b/.test(code) || /\bwhile\b/.test(code)) constructs.push(lang === 'hi' ? 'लूप (for/while)' : 'a loop (for/while)');
        if (/\breturn\b/.test(code)) constructs.push(lang === 'hi' ? 'रिटर्न कथन' : 'a return statement');
        if (/\bfunction\b/.test(code)) constructs.push(lang === 'hi' ? 'फ़ंक्शन परिभाषा' : 'a function definition');
      }
      const hint = constructs.length
        ? (lang === 'hi' ? `यह कोड ${constructs.join(', ')} शामिल करता प्रतीत होता है।` : `This snippet appears to contain ${constructs.join(', ')}.`)
        : '';

      const sentences = [];
      if (location) sentences.push(`${location}.`);
      if (hint) sentences.push(hint);
      sentences.push(unavailableNote);
      fallback = sentences.join(' ');
    }

    return res.json({ explanation: fallback, language: lang, source: 'fallback' });
  }
});

/**
 * POST /api/ai/chat
 * Expects: { message: string, conversationHistory: [{role, content}] }
 * Returns: { response: string }
 *
 * Uses local chat model with context, falls back to Groq.
 */
router.post('/chat', async (req, res) => {
  const { message, conversationHistory } = req.body;

  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'No message provided' });

  try {
    console.log('[chat] Message length:', message.length);

    const systemMsg = {
      role: 'system',
      content: 'You are an expert AI coding assistant integrated into an IDE. Help with code analysis, debugging, refactoring, and programming questions. Provide clear, actionable answers; use code blocks when showing code.'
    };

    const messages = [systemMsg];
    if (Array.isArray(conversationHistory)) {
      // Only keep last N messages to avoid huge context
      const trimmed = conversationHistory.slice(-12);
      messages.push(...trimmed);
    }

    messages.push({ role: 'user', content: message });

    const result = await generateWithFallback(messages, { timeoutMs: 30000, num_predict: 600, temperature: 0.6 });

    let rawContent = '';
    if (result.source === 'local') {
      rawContent = result.response.message?.content || result.response.output?.[0]?.content?.[0]?.text || JSON.stringify(result.response);
    } else if (result.source === 'groq') {
      rawContent = result.response.message?.content || result.response.raw?.choices?.[0]?.text || JSON.stringify(result.response.raw);
    } else {
      rawContent = JSON.stringify(result.response);
    }
//     if (result.source === 'local') {
//   rawContent =
//     result.response.response ||               // CodeGemma output
//     result.response.message?.content ||       // Qwen output
//     result.response.output?.[0]?.content?.[0]?.text ||
//     '';
// }


    const aiResponse = rawContent && rawContent.trim() ? rawContent.trim() : 'I could not generate a response. Please try again.';

    return res.json({ response: aiResponse, usedModel: result.model, source: result.source });

  } catch (error) {
    console.error('[chat] Error:', error);

    const fallback = error.message && error.message.includes('timed out')
      ? 'I apologize, the request took too long. Please try again or break your request into smaller parts.'
      : 'I encountered an error while processing your request. Please try again.';

    return res.status(500).json({
      error: 'Failed to generate chat response',
      response: fallback,
      details: error.message
    });
  }
});

/**
 * POST /api/ai/generate-diagram
 * Expects: { codeContent: string, diagramType: 'flowchart' | 'mindmap' }
 * Returns: { success: boolean, mermaidCode: string, error?: string }
 *
 * Generates a Mermaid diagram (flowchart or mindmap) from code content using AI.
 */
router.post('/generate-diagram', async (req, res) => {
  const { codeContent, diagramType, fileName, language } = req.body;

  if (!codeContent || typeof codeContent !== 'string') {
    return res.status(400).json({ 
      success: false,
      error: 'No code content provided' 
    });
  }

  if (!diagramType || !['flowchart', 'mindmap'].includes(diagramType)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid diagramType. Must be "flowchart" or "mindmap"' 
    });
  }

  try {
    console.log(`[generate-diagram] Generating ${diagramType} for code (${codeContent.length} chars)`);
    console.log(`[generate-diagram] Code preview: ${codeContent.substring(0, 100)}...`);

    // Analyze code structure for advanced diagram generation
    // Use provided language hint or detect from code
    const languageHint = language || (fileName ? detectLanguageFromFileName(fileName) : '');
    const codeStructure = analyzeCodeStructure(codeContent, languageHint);
    console.log(`[generate-diagram] Detected language: ${codeStructure.language}`);
    console.log(`[generate-diagram] File: ${fileName || 'unknown'}`);
    console.log(`[generate-diagram] Found ${codeStructure.functions.length} functions, ${codeStructure.classes.length} classes`);

    // Build comprehensive prompt based on diagram type
    let prompt = '';
    if (diagramType === 'flowchart') {
      const structureInfo = `
Code Structure Analysis:
- Language: ${codeStructure.language}
- Functions: ${codeStructure.functions.map(f => `${f.name}${f.async ? ' (async)' : ''}`).join(', ') || 'None'}
- Classes: ${codeStructure.classes.map(c => c.name).join(', ') || 'None'}
- Control Structures: ${codeStructure.controlStructures.ifStatements} if statements, ${codeStructure.controlStructures.loops} loops, ${codeStructure.controlStructures.switches} switches, ${codeStructure.controlStructures.tryCatch} try-catch blocks
- Dependencies: ${codeStructure.dependencies.slice(0, 10).join(', ') || 'None'}
${codeStructure.entryPoints.length > 0 ? `- Entry Points: ${codeStructure.entryPoints.map(e => `Line ${e.line}`).join(', ')}` : ''}

Code:
\`\`\`
${codeContent}
\`\`\``;

      prompt = `You are an expert code analyzer. Analyze the following code and generate a DETAILED Mermaid flowchart diagram that accurately represents the actual execution flow, control structures, function calls, and data flow.

${structureInfo}

CRITICAL REQUIREMENTS:
1. Generate ONLY valid Mermaid flowchart syntax
2. Start with "graph TD" (top-down) for most code, or "graph LR" if horizontal flow is better
3. Use the ACTUAL function names, class names, and control structures from the code
4. Show EVERY significant control flow path including:
   - All if/else branches with descriptive conditions
   - All loops (for, while, forEach, etc.) with loop conditions
   - All function calls and their return paths
   - All try-catch blocks and error handling paths
   - All switch cases
5. Node types:
   - [Rectangle] for process/function calls: e.g., "ProcessData()" or "validateInput()"
   - {Diamond} for decisions/conditions: e.g., "Is Valid?" or "Count > 0?"
   - (Round edges) for start/end: e.g., "Start" or "End"
   - [[Parallelogram]] for input/output: e.g., "Read Input" or "Return Result"
6. Label edges clearly:
   - Use "|Yes|" or "|No|" for decision branches
   - Use "|Error|" or "|Success|" for exception paths
   - Use descriptive labels for function returns
7. Show the ACTUAL FLOW based on the code structure above - don't create generic flows
8. Include line numbers or function names in nodes when helpful
9. Group related operations visually
10. Do NOT include markdown code fences (\`\`\`)
11. Return ONLY the Mermaid code, nothing else

Example of detailed flowchart:
graph TD
    Start([Entry Point]) --> Init[Initialize Variables]
    Init --> Validate{Validate Input?}
    Validate -->|Valid| Process[Process Data]
    Validate -->|Invalid| Error[Return Error]
    Process --> Loop{Items Remaining?}
    Loop -->|Yes| Item[Process Item] --> Update[Update Counter]
    Update --> Loop
    Loop -->|No| Result[Return Result]
    Error --> End([End])
    Result --> End`;
    } else {
      // mindmap
      const structureInfo = `
Code Structure Analysis:
- Language: ${codeStructure.language}
- Functions (${codeStructure.functions.length}): ${codeStructure.functions.slice(0, 15).map(f => `${f.name}${f.class ? ` (${f.class})` : ''}${f.async ? ' [async]' : ''}`).join(', ')}
- Classes/Interfaces (${codeStructure.classes.length}): ${codeStructure.classes.map(c => `${c.name} [${c.type}]`).join(', ')}
- Imports/Dependencies: ${codeStructure.dependencies.slice(0, 15).join(', ')}
- Exports: ${codeStructure.exports.length > 0 ? codeStructure.exports.slice(0, 5).map(e => `Line ${e.line}`).join(', ') : 'None'}

Code:
\`\`\`
${codeContent}
\`\`\``;

      prompt = `You are an expert code analyzer. Analyze the following code and generate a COMPREHENSIVE Mermaid mindmap that shows the complete code architecture, relationships, and structure.

${structureInfo}

CRITICAL REQUIREMENTS:
1. Generate ONLY valid Mermaid mindmap syntax
2. Start with "mindmap" and create a hierarchical structure
3. Organize by ACTUAL code structure:
   - Root should be the main module/class/file name or "Code Structure"
   - First level: Major components (Classes, Functions, Imports, Exports, etc.)
   - Second level: Actual names from the code
   - Third level: Details (parameters, return types, dependencies, etc.)
4. Include ALL major components:
   - Classes and their methods
   - Functions and their signatures (if space allows)
   - Imports and dependencies with their purposes
   - Data structures and types
   - Entry points and main functions
   - Configuration and constants
5. Show relationships:
   - Which functions belong to which class
   - Which imports are used by which functions
   - Dependencies between components
6. Use actual names from the code - don't use generic placeholders
7. Keep labels concise but descriptive (max 40 chars per node)
8. Organize logically (group related items together)
9. Highlight important components (main functions, entry points, core classes)
10. Do NOT include markdown code fences (\`\`\`)
11. Return ONLY the Mermaid code, nothing else

Example of detailed mindmap:
mindmap
  root((Main Module))
    Classes
      UserService
        Methods
          createUser()
          updateUser()
          deleteUser()
        Dependencies
          Database
          Validator
    Functions
      Main Entry
        Parameters
        Returns
      Helper Functions
        formatDate()
        validateEmail()
    Imports
      Express
      MongoDB
      Validator
    Exports
      UserService
      main()`;
    }

    const systemPrompt = `You are an expert software engineer and code visualization specialist. Your task is to analyze code and generate highly detailed, accurate Mermaid diagrams that reflect the actual code structure and logic.

Key guidelines:
- Always use ACTUAL names from the code (function names, class names, variable names)
- Show COMPLETE control flow paths, not simplified versions
- Include ALL significant branches, loops, and exception handlers
- Be precise with Mermaid syntax - use correct node types and edge labels
- Organize diagrams logically to show code relationships and flow
- Never use generic placeholders - use real identifiers from the code
- Return ONLY valid Mermaid syntax - no explanations, no markdown fences, no extra text`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    // Use longer timeout and more tokens for complex diagram generation
    console.log(`[generate-diagram] Calling AI with ${messages.length} messages`);
    console.log(`[generate-diagram] Code structure: ${codeStructure.functions.length} functions, ${codeStructure.classes.length} classes`);
    
    const result = await generateWithFallback(messages, { 
      timeoutMs: 90000, // Longer timeout for complex analysis
      num_predict: 900,  // Kept under Groq free-tier OTPM limit (1000) for qwen3
      temperature: 0.2, // Lower temperature for more consistent output
      max_tokens: 900
    });
    console.log(`[generate-diagram] AI response received. Source: ${result.source}, Model: ${result.model}`);

    // Extract content - use same pattern as other endpoints
    let rawContent = '';
    if (result.source === 'local') {
      rawContent = result.response.response || 
                   result.response.message?.content || 
                   result.response.output?.[0]?.content?.[0]?.text || 
                   '';
    } else if (result.source === 'groq') {
      rawContent = result.response.message?.content || 
                   result.response.raw?.choices?.[0]?.text || 
                   JSON.stringify(result.response.raw);
    } else {
      rawContent = JSON.stringify(result.response);
    }

    console.log(`[generate-diagram] Raw content length: ${rawContent.length}, source: ${result.source}`);

    // Clean the response: remove markdown code fences if present
    let mermaidCode = rawContent.trim();
    
    // Remove markdown code fences
    mermaidCode = mermaidCode.replace(/^```(?:mermaid|mer)?\s*\n?/i, '');
    mermaidCode = mermaidCode.replace(/\n?```\s*$/i, '');
    mermaidCode = mermaidCode.trim();

    // If content is still empty or too short, try to extract from JSON string
    if (!mermaidCode || mermaidCode.length < 10) {
      // Try to extract code blocks from the response if it's wrapped in JSON
      const codeBlockMatch = rawContent.match(/```(?:mermaid|mer)?\s*([\s\S]*?)```/i);
      if (codeBlockMatch && codeBlockMatch[1]) {
        mermaidCode = codeBlockMatch[1].trim();
      }
    }

    // Validate that it looks like Mermaid code (be more lenient - at least 5 chars)
    if (!mermaidCode || mermaidCode.length < 5) {
      console.error(`[generate-diagram] Generated code too short. Length: ${mermaidCode?.length || 0}, Raw content preview: ${rawContent.substring(0, 300)}`);
      throw new Error(`Generated diagram code is too short or empty. AI response preview: ${rawContent.substring(0, 500)}`);
    }

    // Ensure it starts with the correct keyword
    if (diagramType === 'flowchart') {
      if (!mermaidCode.match(/^graph\s+(TD|LR|TB|RL)/i)) {
        // Try to fix: if it doesn't start with graph, prepend it
        if (!mermaidCode.toLowerCase().includes('graph')) {
          // Create a simple flowchart structure from the content
          const firstLine = mermaidCode.split('\n').find(l => l.trim()) || 'Process';
          const cleanFirst = firstLine.trim().replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 20) || 'Process';
          mermaidCode = `graph TD\n    Start[Start] --> ${cleanFirst}[${cleanFirst}]\n    ${cleanFirst} --> End[End]`;
        } else {
          // Has graph but wrong format, try to fix
          const lines = mermaidCode.split('\n');
          const graphLine = lines.find(l => l.toLowerCase().includes('graph'));
          if (graphLine) {
            mermaidCode = mermaidCode.replace(/^.*?graph[^\n]*/i, 'graph TD');
          } else {
            mermaidCode = `graph TD\n${mermaidCode}`;
          }
        }
      }
    } else if (diagramType === 'mindmap') {
      if (!mermaidCode.match(/^mindmap/i)) {
        if (!mermaidCode.toLowerCase().includes('mindmap')) {
          // Create a simple mindmap structure from content
          const lines = mermaidCode.split('\n').filter(l => l.trim() && !l.match(/^(```|graph|flowchart)/i)).slice(0, 8);
          if (lines.length > 0) {
            mermaidCode = `mindmap\n  root((Code Structure))\n${lines.map(l => `    ${l.trim().substring(0, 30)}`).join('\n')}`;
          } else {
            mermaidCode = `mindmap\n  root((Code Structure))\n    Functions\n    Variables\n    Logic`;
          }
        } else {
          mermaidCode = mermaidCode.replace(/^.*?mindmap/i, 'mindmap');
        }
      }
    }

    console.log(`[generate-diagram] Success. Generated ${mermaidCode.length} chars of Mermaid code`);

    return res.json({
      success: true,
      mermaidCode,
      usedModel: result.model,
      source: result.source
    });

  } catch (error) {
    console.error('[generate-diagram] Error:', error);
    console.error('[generate-diagram] Error stack:', error.stack);
    
    // Provide a fallback simple diagram if AI fails
    let fallbackDiagram = '';
    if (diagramType === 'flowchart') {
      fallbackDiagram = `graph TD
    A[Code Start] --> B[Process Code]
    B --> C[Execute Logic]
    C --> D[Return Result]
    D --> E[End]`;
    } else {
      fallbackDiagram = `mindmap
  root((Code Structure))
    Functions
    Variables
    Logic
    Output`;
    }

    // If it's a configuration error (no models available), return error
    // Otherwise, return fallback diagram
    if (error.message && (
      error.message.includes('No Groq API key') || 
      error.message.includes('Ollama') ||
      error.message.includes('timed out') ||
      error.message.includes('connection')
    )) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate diagram',
        details: error.message,
        suggestion: 'Please ensure Ollama is running or configure GROQ_API_KEY in your .env file'
      });
    }

    // For other errors, try to return fallback
    console.log('[generate-diagram] Using fallback diagram due to error');
    return res.json({
      success: true,
      mermaidCode: fallbackDiagram,
      usedModel: 'fallback',
      source: 'fallback',
      warning: 'AI generation failed, using fallback diagram'
    });
  }
});

/* ---------------------------
   Utility endpoints (optional)
   - /models -> lists installed models via Ollama
   - /health  -> simple health check
   ---------------------------*/

/**
 * GET /api/ai/models
 * Returns installed Ollama models plus current Groq model configuration.
 */
router.get('/models', async (req, res) => {
  let installed = [];
  let ollamaReachable = true;
  let ollamaError = null;
  let selectedLocalModel = null;

  try {
    const listed = (await ollama.list()).models || [];
    installed = listed.map(m => m.name || m);
  } catch (err) {
    ollamaReachable = false;
    ollamaError = err.message;
    console.warn('[models] Could not list models:', err.message);
  }

  if (ollamaReachable && installed.length > 0) {
    try {
      selectedLocalModel = await selectLocalModel();
    } catch (e) {
      selectedLocalModel = null;
    }
  }

  return res.json({
    ollama: {
      reachable: ollamaReachable,
      host: OLLAMA_HOST_URL,
      installed,
      selectedModel: selectedLocalModel,
      configuredModel: ENV_OLLAMA_MODEL || '(not set — using auto-detect)',
      candidates: LOCAL_MODEL_CANDIDATES,
      error: ollamaError
    },
    groq: {
      configured: !!GROQ_API_KEY,
      primary: GROQ_PRIMARY,
      secondary: GROQ_SECONDARY
    }
  });
});

/**
 * GET /api/ai/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    ollama: {
      host: OLLAMA_HOST_URL,
      configuredModel: ENV_OLLAMA_MODEL || '(auto-detect)',
      candidates: LOCAL_MODEL_CANDIDATES
    },
    groq: {
      configured: !!GROQ_API_KEY,
      primary: GROQ_PRIMARY,
      secondary: GROQ_SECONDARY
    }
  });
});

/* ---------------------------
   Export router
   ---------------------------*/
module.exports = router;


