// server/tutor/sessionManager.js
// In-memory session manager for storing and retrieving AST, flowchart graphs,
// source code, and call graph data across tutor queries.

const crypto = require('crypto');

class SessionManager {
  constructor(maxSessions = 100, ttlMs = 1000 * 60 * 60) { // 1 hour TTL
    this.sessions = new Map();
    this.maxSessions = maxSessions;
    this.ttlMs = ttlMs;
  }

  /**
   * Generates a unique session ID
   */
  generateSessionId() {
    return 'sess_' + crypto.randomBytes(8).toString('hex');
  }

  /**
   * Creates or updates a session
   * @param {string} [sessionId] - Optional existing session ID
   * @param {Object} data - Session payload
   * @returns {string} sessionId
   */
  saveSession(sessionId, data) {
    const id = sessionId || this.generateSessionId();
    const existing = this.sessions.get(id) || {};

    const sessionData = {
      id,
      code: data.code !== undefined ? data.code : (existing.code || ''),
      fileName: data.fileName || existing.fileName || 'main.py',
      language: data.language || existing.language || 'python',
      nodes: Array.isArray(data.nodes) ? data.nodes : (existing.nodes || []),
      edges: Array.isArray(data.edges) ? data.edges : (existing.edges || []),
      functions: Array.isArray(data.functions) ? data.functions : (existing.functions || []),
      callGraph: data.callGraph || existing.callGraph || null,
      metadata: data.metadata || existing.metadata || {},
      files: Array.isArray(data.files) ? data.files : (existing.files || []),
      updatedAt: Date.now()
    };

    // Maintain max session bound
    if (this.sessions.size >= this.maxSessions && !this.sessions.has(id)) {
      const oldestKey = this.sessions.keys().next().value;
      this.sessions.delete(oldestKey);
    }

    this.sessions.set(id, sessionData);
    return id;
  }

  /**
   * Retrieves a session by ID
   * @param {string} sessionId
   * @returns {Object|null}
   */
  getSession(sessionId) {
    if (!sessionId) return null;
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check expiration
    if (Date.now() - session.updatedAt > this.ttlMs) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Clears all sessions (useful for tests)
   */
  clear() {
    this.sessions.clear();
  }
}

// Singleton instance
const sessionManager = new SessionManager();

module.exports = {
  SessionManager,
  sessionManager
};
