// server/routes/flowchart.js
// Backend route for individual source code flowchart analysis
// Delegates to the AST → IR → FlowGenerator pipeline in server/analyzer/

const express = require('express');
const router = express.Router();
const { analyzeCodeFlowchart } = require('../analyzer/analyzerService');
const { detectLanguage, isLanguageSupported } = require('../analyzer/languageDetector');
const { parseToIR } = require('../analyzer/parserManager');
const { generateFlowchartFromIR } = require('../analyzer/flow/flowGenerator');
const { sessionManager } = require('../tutor/sessionManager');

// ---------------------------------------------------------------------------
// djb2 hash — used to key the parse cache by content fingerprint
// ---------------------------------------------------------------------------
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // keep 32-bit
  }
  return hash >>> 0; // unsigned
}

// ---------------------------------------------------------------------------
// Response cache for /analyze — key = djb2(code)+language+functionName
// Saves re-parsing the same file content on repeated requests (e.g. cursor moves)
// TTL: 5 minutes, max 100 entries
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const analyzeCache = new Map(); // key -> { result, ts }

function cacheKey(code, language, functionName) {
  return `${djb2(code)}:${language}:${functionName || ''}`;
}

function getCached(key) {
  const entry = analyzeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    analyzeCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key, result) {
  if (analyzeCache.size >= MAX_CACHE_SIZE) {
    // evict oldest
    analyzeCache.delete(analyzeCache.keys().next().value);
  }
  analyzeCache.set(key, { result, ts: Date.now() });
}

// Separate parse cache used by /selection route
const parseCache = new Map();

/**
 * Normalise node types from lowercase (IR) to UPPERCASE (client expects)
 */
function normalizeNodes(nodes) {
  return nodes.map(n => ({
    ...n,
    type: (n.type || 'process').toUpperCase()
  }));
}

/**
 * Normalise edge types similarly
 */
function normalizeEdges(edges) {
  return edges.map(e => ({
    ...e,
    type: e.type ? e.type.toUpperCase() : 'DEFAULT',
    label: e.label ? e.label.toUpperCase() : undefined
  }));
}

/**
 * Walk the IR tree to find the smallest IR container that encloses [startLine, endLine].
 * Returns the relevant sub-array of IR nodes.
 *
 * @param {Array} irNodes
 * @param {number} startLine - 0-based line number
 * @param {number} endLine   - 0-based line number
 * @returns {Array}
 */
function findSelectionContext(irNodes, startLine, endLine) {
  for (const item of irNodes) {
    // If cursor is inside a function body
    if (
      item.type === 'function_def' &&
      item.lineStart <= startLine &&
      item.lineEnd >= endLine
    ) {
      // Try to find something more specific inside
      const inner = findSelectionContext(item.body || [], startLine, endLine);
      return inner || item.body || [item];
    }

    // If cursor is on a decision or loop
    if (
      (item.type === 'decision' || item.type === 'loop') &&
      item.lineStart <= startLine &&
      item.lineEnd >= endLine
    ) {
      return [item];
    }
  }

  // Fallback: find irNodes within ±5 lines of startLine
  const nearby = irNodes.filter(
    n => n.lineStart !== undefined && Math.abs(n.lineStart - startLine) <= 5
  );
  return nearby.length > 0 ? nearby : irNodes;
}

// ---------------------------------------------------------------------------
// POST /api/flowchart/analyze
// ---------------------------------------------------------------------------
router.post('/analyze', async (req, res) => {
  const {
    code,
    language: langHint,
    fileName = 'file',
    functionName = null,
    detail = 'standard'
  } = req.body;

  if (typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: "code" must be a string.'
    });
  }

  try {
    const detectedLang = langHint
      ? langHint.toLowerCase()
      : detectLanguage(fileName, code);

    if (!isLanguageSupported(detectedLang)) {
      return res.status(422).json({
        success: false,
        error: 'Unsupported language',
        details: `Language "${detectedLang}" is not supported. Supported: python, javascript, typescript, java.`
      });
    }

    // Check response cache first
    const ck = cacheKey(code, detectedLang, functionName);
    const cached = getCached(ck);
    if (cached) {
      return res.json(cached);
    }

    const result = analyzeCodeFlowchart({
      code,
      language: detectedLang,
      fileName,
      functionName,
      detail
    });

    if (!result.success) {
      return res.status(422).json(result);
    }

    const normalizedNodes = normalizeNodes(result.nodes);
    const normalizedEdges = normalizeEdges(result.edges);

    const sessionId = sessionManager.saveSession(null, {
      code,
      fileName,
      language: result.language || detectedLang,
      nodes: normalizedNodes,
      edges: normalizedEdges,
      functions: result.metadata?.functions || [],
      metadata: result.metadata || {}
    });

    const response = {
      success: true,
      sessionId,
      fileName,
      language: result.language || detectedLang,
      functions: result.metadata?.functions || [],
      activeFunction: functionName || null,
      nodes: normalizedNodes,
      edges: normalizedEdges,
      metadata: {
        nodeCount: normalizedNodes.length,
        edgeCount: normalizedEdges.length,
        functionCount: (result.metadata?.functions || []).length,
        conditions: result.metadata?.conditions || 0,
        loops: result.metadata?.loops || 0,
        classes: result.metadata?.classes || [],
        parserEngine: result.metadata?.parserEngine || 'ast-adapter'
      }
    };

    setCache(ck, response);
    return res.json(response);
  } catch (error) {
    console.error('[Flowchart API Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Unable to parse source code',
      details: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/flowchart/analyze/selection
// ---------------------------------------------------------------------------
router.post('/analyze/selection', async (req, res) => {
  const {
    code,
    language: langHint,
    startLine = 1,
    endLine = 1,
    detail = 'standard',
    filePath = 'file'
  } = req.body;

  if (typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: "code" must be a string.'
    });
  }

  try {
    const detectedLang = langHint
      ? langHint.toLowerCase()
      : detectLanguage(filePath, code);

    if (!isLanguageSupported(detectedLang)) {
      return res.status(422).json({
        success: false,
        error: 'Unsupported language',
        nodes: [],
        edges: []
      });
    }

    // Cache lookup
    const cacheKey = `${filePath}:${djb2(code)}`;
    let parsed = parseCache.get(cacheKey);
    if (!parsed) {
      parsed = parseToIR(code, detectedLang);
      parseCache.set(cacheKey, parsed);
      // Evict oldest entry if cache grows too large
      if (parseCache.size > 50) {
        const firstKey = parseCache.keys().next().value;
        parseCache.delete(firstKey);
      }
    }

    const { irNodes, functions } = parsed;
    const subIR = findSelectionContext(irNodes, startLine, endLine);

    const { nodes, edges } = generateFlowchartFromIR({
      irNodes: subIR,
      fileName: filePath,
      functions,
      detail
    });

    const normalizedNodes = normalizeNodes(nodes);
    const normalizedEdges = normalizeEdges(edges);

    return res.json({
      success: true,
      fileName: filePath,
      language: detectedLang,
      nodes: normalizedNodes,
      edges: normalizedEdges,
      metadata: {
        nodeCount: normalizedNodes.length,
        edgeCount: normalizedEdges.length,
        parserEngine: parsed.parserEngine || 'ast-adapter'
      }
    });
  } catch (error) {
    console.error('[Selection API Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Unable to parse selection',
      details: error.message,
      nodes: [],
      edges: []
    });
  }
});

module.exports = router;
