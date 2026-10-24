// server/tutor/index.js
// Exports tutor subsystem and registers built-in tools.

const { ToolRegistry, defaultToolRegistry } = require('./toolRegistry');
const { SessionManager, sessionManager } = require('./sessionManager');
const { ExecutionService, defaultExecutionService } = require('./executionService');
const { getNodeToolDefinition } = require('./tools/getNode');
const { getCallGraphToolDefinition } = require('./tools/getCallGraph');
const { runTraceToolDefinition } = require('./tools/runTrace');

// Register tools into default registry
defaultToolRegistry.register(getNodeToolDefinition);
defaultToolRegistry.register(getCallGraphToolDefinition);
defaultToolRegistry.register(runTraceToolDefinition);

module.exports = {
  ToolRegistry,
  defaultToolRegistry,
  SessionManager,
  sessionManager,
  ExecutionService,
  defaultExecutionService,
  getNodeToolDefinition,
  getCallGraphToolDefinition,
  runTraceToolDefinition
};
