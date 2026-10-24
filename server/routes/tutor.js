// server/routes/tutor.js
// Express API endpoints for the Agentic Tutor Module in CodeMind AI.

const express = require('express');
const router = express.Router();
const { defaultOrchestrator } = require('../tutor/agentOrchestrator');
const { defaultToolRegistry } = require('../tutor/toolRegistry');
const { defaultExecutionService } = require('../tutor/executionService');
const { sessionManager } = require('../tutor/sessionManager');

/**
 * POST /api/tutor/ask
 * Main endpoint for student questions about code, graphs, and selected nodes.
 *
 * Request Body:
 * {
 *   "question": "Explain why this condition has two branches.",
 *   "node_id": "node_1",
 *   "session_id": "sess_12345",
 *   "code": "def check(x):\n  if x > 0:\n    return True\n  return False",
 *   "language": "python",
 *   "fileName": "main.py",
 *   "graph": { "nodes": [...], "edges": [...] },
 *   "conversationHistory": [...]
 * }
 */
router.post('/ask', async (req, res) => {
  const {
    question,
    node_id = null,
    session_id = null,
    code = '',
    language = 'python',
    fileName = 'main.py',
    graph = null,
    conversationHistory = []
  } = req.body;

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({
      status: 'error',
      error: 'Invalid request: "question" string is required.',
      answer: '',
      selected_node_id: node_id,
      evidence: [],
      tools_used: []
    });
  }

  try {
    const result = await defaultOrchestrator.ask({
      question: question.trim(),
      node_id,
      session_id,
      code,
      language,
      fileName,
      graph,
      conversationHistory
    });

    return res.json({
      answer: result.answer || '',
      selected_node_id: result.selected_node_id || node_id,
      evidence: result.evidence || [],
      tools_used: result.tools_used || [],
      status: result.status || 'success',
      provider: result.provider || 'unknown',
      iterationsUsed: result.iterationsUsed || 0
    });
  } catch (error) {
    console.error('[Tutor API Error]:', error);
    return res.status(500).json({
      status: 'error',
      error: 'An internal error occurred while processing the tutor request.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      answer: 'Sorry, the tutor encountered an unexpected error. Please try again.',
      selected_node_id: node_id,
      evidence: [],
      tools_used: []
    });
  }
});

/**
 * GET /api/tutor/health
 * Lightweight health check for the tutor service without exposing secrets.
 */
router.get('/health', async (req, res) => {
  try {
    const ollamaStatus = await defaultOrchestrator.checkOllamaHealth();
    const sandboxStatus = defaultExecutionService.getAvailability();
    const registeredTools = defaultToolRegistry.getAll().map(t => ({
      name: t.name,
      description: t.description
    }));

    return res.json({
      status: 'ok',
      service: 'CodeMind Agentic Tutor',
      ollama: {
        reachable: ollamaStatus.reachable,
        configuredModel: defaultOrchestrator.model,
        availableModels: ollamaStatus.models
      },
      sandbox: {
        available: sandboxStatus.available,
        mode: sandboxStatus.mode
      },
      tools: registeredTools,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      error: 'Health check failed: ' + err.message
    });
  }
});

/**
 * POST /api/tutor/session
 * Optional helper to initialize or register an analysis graph session.
 */
router.post('/session', (req, res) => {
  const { code = '', fileName = 'main.py', language = 'python', nodes = [], edges = [] } = req.body;
  const sessionId = sessionManager.saveSession(null, {
    code,
    fileName,
    language,
    nodes,
    edges
  });

  return res.json({
    success: true,
    sessionId
  });
});

module.exports = router;
