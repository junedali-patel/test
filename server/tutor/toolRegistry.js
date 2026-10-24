// server/tutor/toolRegistry.js
// Tool Registry for registering, validating, and invoking agentic tutor tools.

class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  /**
   * Registers a tool
   * @param {Object} tool
   * @param {string} tool.name - Unique name of the tool
   * @param {string} tool.description - Purpose and behavior of the tool
   * @param {Object} tool.parameters - JSON schema for parameters
   * @param {Function} tool.execute - Execution handler (args, context) => Promise<any>
   */
  register(tool) {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid string name');
    }
    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error(`Tool "${tool.name}" must have a description`);
    }
    if (!tool.parameters || typeof tool.parameters !== 'object') {
      throw new Error(`Tool "${tool.name}" must provide JSON Schema parameters`);
    }
    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool "${tool.name}" must provide an execute function`);
    }

    this.tools.set(tool.name, tool);
  }

  /**
   * Returns a tool by name
   * @param {string} name
   * @returns {Object|undefined}
   */
  get(name) {
    return this.tools.get(name);
  }

  /**
   * Returns all registered tools
   * @returns {Array<Object>}
   */
  getAll() {
    return Array.from(this.tools.values());
  }

  /**
   * Exports tool definitions in Ollama / OpenAI function format
   * @returns {Array<Object>}
   */
  getOllamaTools() {
    return this.getAll().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * Validates arguments against parameter schema
   * @param {string} toolName
   * @param {Object} args
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateArgs(toolName, args = {}) {
    const tool = this.get(toolName);
    if (!tool) {
      return { valid: false, errors: [`Tool "${toolName}" is not registered.`] };
    }

    const errors = [];
    const schema = tool.parameters || {};
    const required = schema.required || [];
    const properties = schema.properties || {};

    // Check required fields
    for (const reqField of required) {
      if (args[reqField] === undefined || args[reqField] === null || args[reqField] === '') {
        errors.push(`Missing required parameter "${reqField}" for tool "${toolName}".`);
      }
    }

    // Check types for provided fields
    for (const [key, value] of Object.entries(args)) {
      if (properties[key] && value !== undefined && value !== null) {
        const expectedType = properties[key].type;
        const actualType = typeof value;

        if (expectedType === 'string' && actualType !== 'string') {
          errors.push(`Parameter "${key}" must be a string, got ${actualType}.`);
        } else if (expectedType === 'number' && actualType !== 'number') {
          errors.push(`Parameter "${key}" must be a number, got ${actualType}.`);
        } else if (expectedType === 'boolean' && actualType !== 'boolean') {
          errors.push(`Parameter "${key}" must be a boolean, got ${actualType}.`);
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Parameter "${key}" must be an array, got ${actualType}.`);
        } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
          errors.push(`Parameter "${key}" must be an object, got ${actualType}.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Executes a tool with argument validation and error handling
   * @param {string} toolName
   * @param {Object} args
   * @param {Object} context
   * @returns {Promise<Object>}
   */
  async invoke(toolName, args = {}, context = {}) {
    const tool = this.get(toolName);
    if (!tool) {
      return {
        success: false,
        tool: toolName,
        error: `Tool "${toolName}" is not registered in the tool registry.`,
        availableTools: Array.from(this.tools.keys())
      };
    }

    // Parse stringified JSON args if model returned string
    let parsedArgs = args;
    if (typeof args === 'string') {
      try {
        parsedArgs = JSON.parse(args);
      } catch (err) {
        return {
          success: false,
          tool: toolName,
          error: `Failed to parse arguments JSON for tool "${toolName}": ${err.message}`
        };
      }
    }

    const validation = this.validateArgs(toolName, parsedArgs);
    if (!validation.valid) {
      return {
        success: false,
        tool: toolName,
        error: `Validation failed: ${validation.errors.join(' ')}`
      };
    }

    try {
      const result = await tool.execute(parsedArgs, context);
      return {
        success: true,
        tool: toolName,
        data: result
      };
    } catch (err) {
      console.error(`[ToolRegistry] Error executing "${toolName}":`, err);
      return {
        success: false,
        tool: toolName,
        error: `Execution error in "${toolName}": ${err.message}`
      };
    }
  }
}

// Global registry instance
const defaultToolRegistry = new ToolRegistry();

module.exports = {
  ToolRegistry,
  defaultToolRegistry
};
