// server/tutor/executionService.js
// Secure execution service interface enforcing isolation, resource bounds,
// and safety boundaries for student code execution.

class ExecutionService {
  constructor(options = {}) {
    this.sandboxUrl = options.sandboxUrl || process.env.SANDBOX_URL || null;
    this.dockerEnabled = options.dockerEnabled || (process.env.DOCKER_SANDBOX_ENABLED === 'true');
    this.timeoutMs = options.timeoutMs || 2000; // 2 seconds hard limit
    this.maxMemoryMb = options.maxMemoryMb || 128; // 128 MB max memory
    this.supportedLanguages = ['python', 'javascript'];
    this.customRunner = options.customRunner || null; // for testing or custom secure runner injection
  }

  /**
   * Checks if an isolated secure sandbox environment is configured and available
   * @returns {{ available: boolean, mode: string, message: string }}
   */
  getAvailability() {
    if (this.customRunner) {
      return {
        available: true,
        mode: 'custom-isolated-runner',
        message: 'Secure sandbox runner is active.'
      };
    }

    if (this.sandboxUrl) {
      return {
        available: true,
        mode: 'remote-sandbox-service',
        message: `Connected to secure sandbox at ${this.sandboxUrl}`
      };
    }

    if (this.dockerEnabled) {
      return {
        available: true,
        mode: 'docker-isolated-container',
        message: 'Local Docker sandbox container is configured.'
      };
    }

    return {
      available: false,
      mode: 'none',
      message: 'Secure sandbox execution environment is not configured. Host-level unsandboxed execution is strictly disallowed to prevent remote code execution and credential exposure.'
    };
  }

  /**
   * Executes code safely within the isolated sandbox environment
   * @param {Object} params
   * @param {string} params.code
   * @param {string} params.language
   * @param {Array<string>} [params.inputs]
   * @param {number} [params.timeoutMs]
   * @returns {Promise<Object>} Execution result
   */
  async executeCode({ code, language = 'python', inputs = [], timeoutMs = null }) {
    // 1. Language validation
    const normLang = (language || '').toLowerCase();
    if (!this.supportedLanguages.includes(normLang)) {
      return {
        status: 'error',
        error: `Language "${language}" is not supported for execution. Permitted: ${this.supportedLanguages.join(', ')}.`,
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false
      };
    }

    // 2. Input size and code validation
    if (!code || typeof code !== 'string') {
      return {
        status: 'error',
        error: 'Invalid request: "code" must be a non-empty string.',
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false
      };
    }

    if (code.length > 64 * 1024) { // 64 KB code size limit
      return {
        status: 'error',
        error: 'Code payload exceeds permitted safety limit of 64KB.',
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false
      };
    }

    // 3. Check sandbox availability
    const availability = this.getAvailability();
    if (!availability.available) {
      return {
        status: 'unavailable',
        error: availability.message,
        missingDependency: 'Isolated sandbox container / microservice (e.g. gVisor, Docker container, or nsjail runner)',
        recommendation: 'Configure SANDBOX_URL or DOCKER_SANDBOX_ENABLED in server environment to enable secure execution.',
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false
      };
    }

    // 4. Delegate to configured secure runner
    if (this.customRunner) {
      try {
        const result = await this.customRunner({
          code,
          language: normLang,
          inputs,
          timeoutMs: timeoutMs || this.timeoutMs
        });
        return {
          status: result.status || 'success',
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exitCode !== undefined ? result.exitCode : 0,
          timedOut: result.timedOut || false,
          executionTimeMs: result.executionTimeMs || 0
        };
      } catch (err) {
        return {
          status: 'error',
          error: `Sandbox execution failed: ${err.message}`,
          stdout: '',
          stderr: err.message,
          exitCode: 1,
          timedOut: false
        };
      }
    }

    // Fallback: If external sandboxUrl is configured
    if (this.sandboxUrl) {
      try {
        const axios = require('axios');
        const response = await axios.post(`${this.sandboxUrl}/execute`, {
          code,
          language: normLang,
          inputs,
          timeout: timeoutMs || this.timeoutMs
        }, { timeout: (timeoutMs || this.timeoutMs) + 1000 });

        return {
          status: response.data.status || 'success',
          stdout: response.data.stdout || '',
          stderr: response.data.stderr || '',
          exitCode: response.data.exitCode || 0,
          timedOut: response.data.timedOut || false
        };
      } catch (err) {
        return {
          status: 'error',
          error: `Remote sandbox service error: ${err.message}`,
          stdout: '',
          stderr: err.message,
          exitCode: null,
          timedOut: false
        };
      }
    }

    return {
      status: 'unavailable',
      error: 'No active sandbox handler available.',
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false
    };
  }
}

// Global execution service singleton
const defaultExecutionService = new ExecutionService();

module.exports = {
  ExecutionService,
  defaultExecutionService
};
