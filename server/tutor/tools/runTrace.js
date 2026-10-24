// server/tutor/tools/runTrace.js
// Tool C: run_trace
// Runs permitted code through the isolated sandbox execution service.

const { defaultExecutionService } = require('../executionService');
const { sessionManager } = require('../sessionManager');

const runTraceToolDefinition = {
  name: 'run_trace',
  description: 'Run permitted code through an isolated secure sandbox to observe actual standard output, standard error, exit status, and runtime behavior.',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The source code snippet or function to execute'
      },
      language: {
        type: 'string',
        description: 'Language of the code ("python" or "javascript")'
      },
      inputs: {
        type: 'array',
        description: 'Optional list of standard input strings to feed into the program'
      },
      session_id: {
        type: 'string',
        description: 'Optional session ID containing the source code'
      }
    }
  },

  /**
   * Executes the code trace
   * @param {Object} args
   * @param {string} [args.code]
   * @param {string} [args.language]
   * @param {Array<string>} [args.inputs]
   * @param {string} [args.session_id]
   * @param {Object} context
   */
  async execute(args, context = {}) {
    const session = context.session ||
      (args.session_id ? sessionManager.getSession(args.session_id) : null) ||
      (context.sessionId ? sessionManager.getSession(context.sessionId) : null);

    const codeToRun = args.code || context.code || session?.code || '';
    const language = (args.language || context.language || session?.language || 'python').toLowerCase();
    const inputs = Array.isArray(args.inputs) ? args.inputs : [];

    if (!codeToRun || !codeToRun.trim()) {
      return {
        executed: false,
        status: 'error',
        error: 'No executable code provided or found in the current session.'
      };
    }

    const execService = context.executionService || defaultExecutionService;

    const result = await execService.executeCode({
      code: codeToRun,
      language,
      inputs
    });

    return {
      executed: result.status === 'success',
      status: result.status,
      language,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode,
      timedOut: Boolean(result.timedOut),
      error: result.error || null,
      missingDependency: result.missingDependency || null
    };
  }
};

module.exports = {
  runTraceToolDefinition
};
