const axios = require('axios');
const { defaultToolRegistry } = require('./toolRegistry');
const { sessionManager } = require('./sessionManager');
const { getNodeToolDefinition } = require('./tools/getNode');
const { getCallGraphToolDefinition } = require('./tools/getCallGraph');
const { runTraceToolDefinition } = require('./tools/runTrace');

// Ensure core tools are registered on default registry
if (!defaultToolRegistry.get('get_node')) {
  defaultToolRegistry.register(getNodeToolDefinition);
}
if (!defaultToolRegistry.get('get_call_graph')) {
  defaultToolRegistry.register(getCallGraphToolDefinition);
}
if (!defaultToolRegistry.get('run_trace')) {
  defaultToolRegistry.register(runTraceToolDefinition);
}

class AgentOrchestrator {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = options.model || process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
    this.maxIterations = options.maxIterations || 5;
    this.timeoutMs = options.timeoutMs || 30000; // 30s per model call
    this.toolRegistry = options.toolRegistry || defaultToolRegistry;
    this.groqApiKey = options.groqApiKey || process.env.GROQ_API_KEY || null;
  }

  /**
   * Checks if Ollama server is reachable and lists installed models
   * @returns {Promise<{ reachable: boolean, models: string[], error?: string }>}
   */
  async checkOllamaHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 3000 });
      const models = (response.data?.models || []).map(m => m.name || m.model);
      return {
        reachable: true,
        models
      };
    } catch (err) {
      return {
        reachable: false,
        models: [],
        error: err.message
      };
    }
  }

  /**
   * Cleans thinking tags or internal monologue from reasoning models
   * @param {string} text
   * @returns {string}
   */
  stripInternalReasoning(text) {
    if (!text) return '';
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^Thought:[\s\S]*?(?=Action:|Final Answer:|$)/gim, '')
      .trim();
  }

  /**
   * Builds the system prompt grounding the agent in the real CodeMind graph
   */
  buildSystemPrompt({ selectedNodeId, fileName, language }) {
    return `You are the CodeMind AI Agentic Tutor, an expert, encouraging programming tutor.
Your job is to explain source code, program logic, control flow, and architecture to a student using verified facts from the CodeMind AST and flowchart mind map.

Available tools:
1. "get_node": Retrieve verified node details (type, code snippet, source line numbers, incoming/outgoing edges, branch labels like YES/NO).
2. "get_call_graph": Retrieve function callers and callees with cycle prevention.
3. "run_trace": Execute code through an isolated sandbox to observe real output or status.

Guidelines:
- ALWAYS inspect the selected node first using "get_node" if a selected_node_id is provided.
- Formulate your explanation strictly grounded in observed tool evidence and real code. Never fabricate node properties, branch conditions, or outputs.
- If you cite code or nodes, reference specific line numbers (e.g. "[Line 5]" or "[Lines 10-14]") and node IDs (e.g. "[Node node_1]").
- When explaining conditions or decisions, clearly explain both the TRUE/YES and FALSE/NO paths based on actual edges.
- If an execution trace or call graph is unavailable, acknowledge the limitation honestly.
- Keep explanations clear, educational, and concise. Do NOT expose internal reasoning or thoughts.`;
  }

  /**
   * Executes one chat completion turn with Ollama
   * @param {Array<Object>} messages
   * @param {Array<Object>} tools
   * @returns {Promise<Object>}
   */
  async callOllamaChat(messages, tools) {
    const payload = {
      model: this.model,
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
      stream: false,
      options: {
        temperature: 0.1 // deterministic for tutoring
      }
    };

    const response = await axios.post(`${this.baseUrl}/api/chat`, payload, {
      timeout: this.timeoutMs,
      headers: { 'Content-Type': 'application/json' }
    });

    return response.data?.message;
  }

  /**
   * Optional fallback to Groq if local Ollama is offline and key is configured
   */
  async callGroqChat(messages, tools) {
    if (!this.groqApiKey) {
      throw new Error('Groq API key not configured for fallback.');
    }

    const payload = {
      model: 'llama-3.1-8b-instant',
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
      tool_choice: 'auto',
      temperature: 0.1
    };

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
      timeout: this.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.groqApiKey}`
      }
    });

    const choice = response.data?.choices?.[0]?.message;
    return choice;
  }

  /**
   * Main Agent Orchestration entry point
   * @param {Object} params
   * @param {string} params.question - Student question
   * @param {string} [params.node_id] - Selected node ID
   * @param {string} [params.session_id] - Session ID
   * @param {string} [params.code] - Source code
   * @param {string} [params.language] - Source language
   * @param {string} [params.fileName] - Source file name
   * @param {Object} [params.graph] - Flowchart graph { nodes, edges }
   * @param {Array<Object>} [params.conversationHistory] - Previous chat messages
   * @returns {Promise<Object>}
   */
  async ask({
    question,
    node_id = null,
    session_id = null,
    code = '',
    language = 'python',
    fileName = 'main.py',
    graph = null,
    conversationHistory = []
  }) {
    if (!question || typeof question !== 'string') {
      return {
        status: 'error',
        error: 'Question is required and must be a string.',
        answer: '',
        selected_node_id: node_id,
        evidence: [],
        tools_used: []
      };
    }

    // Resolve or create session
    let session = null;
    let effectiveSessionId = session_id;

    if (session_id) {
      session = sessionManager.getSession(session_id);
    }

    if (!session && (code || graph)) {
      effectiveSessionId = sessionManager.saveSession(session_id, {
        code,
        language,
        fileName,
        nodes: graph?.nodes || [],
        edges: graph?.edges || []
      });
      session = sessionManager.getSession(effectiveSessionId);
    }

    const context = {
      sessionId: effectiveSessionId,
      session,
      code: code || session?.code || '',
      language: language || session?.language || 'python',
      fileName: fileName || session?.fileName || 'main.py',
      nodes: graph?.nodes || session?.nodes || [],
      edges: graph?.edges || session?.edges || []
    };

    const toolsUsed = [];
    const evidence = [];

    // Check Ollama health
    const health = await this.checkOllamaHealth();
    const isLocalAvailable = health.reachable;

    // Helper: Build deterministic graph evidence if local model is offline
    const buildDirectEvidenceAnswer = async () => {
      let nodeEvidence = null;
      if (node_id) {
        const nodeTool = this.toolRegistry.get('get_node');
        if (nodeTool) {
          const res = await nodeTool.execute({ node_id, session_id: effectiveSessionId }, context);
          if (res.found) {
            nodeEvidence = res;
            toolsUsed.push('get_node');
            evidence.push({
              tool: 'get_node',
              nodeId: res.nodeId,
              nodeType: res.nodeType,
              label: res.label,
              lineStart: res.lineStart,
              lineEnd: res.lineEnd,
              branches: res.branches
            });
          }
        }
      }

      if (!isLocalAvailable && !this.groqApiKey) {
        if (nodeEvidence) {
          let branchDesc = '';
          if (nodeEvidence.branches) {
            const b = nodeEvidence.branches;
            if (b.trueBranch) branchDesc += `\n- **YES / True branch**: goes to Node \`${b.trueBranch.targetId}\` ("${b.trueBranch.targetLabel}")`;
            if (b.falseBranch) branchDesc += `\n- **NO / False branch**: goes to Node \`${b.falseBranch.targetId}\` ("${b.falseBranch.targetLabel}")`;
          }

          const answer = `### Node Explanation for \`${nodeEvidence.nodeId}\`\n\n` +
            `**Type:** ${nodeEvidence.nodeType}\n` +
            `**Statement / Condition:** \`${nodeEvidence.label}\`\n` +
            (nodeEvidence.lineStart ? `**Source Location:** Lines ${nodeEvidence.lineStart}${nodeEvidence.lineEnd && nodeEvidence.lineEnd !== nodeEvidence.lineStart ? `–${nodeEvidence.lineEnd}` : ''} in \`${nodeEvidence.fileName}\`\n` : '') +
            (nodeEvidence.codeSnippet ? `\n\`\`\`${language}\n${nodeEvidence.codeSnippet}\n\`\`\`\n` : '') +
            (branchDesc ? `\n**Control Flow Paths:**${branchDesc}\n` : '') +
            `\n> *Note: Local Ollama model is currently offline. Explanation synthesized directly from verified CodeMind AST graph data.*`;

          return {
            status: 'success',
            mode: 'verified-graph-extraction',
            answer,
            selected_node_id: node_id,
            evidence,
            tools_used: toolsUsed
          };
        } else {
          return {
            status: 'warning',
            mode: 'offline',
            answer: `The local Ollama service is not running on ${this.baseUrl}, and no graph details were found for node "${node_id || 'unspecified'}". Please ensure Ollama is running (\`ollama serve\`) with model \`${this.model}\`.`,
            selected_node_id: node_id,
            evidence: [],
            tools_used: []
          };
        }
      }
      return null;
    };

    // If local Ollama is offline and no fallback API key exists, return direct graph evidence
    if (!isLocalAvailable && !this.groqApiKey) {
      return await buildDirectEvidenceAnswer();
    }

    // Prepare bounded conversation messages
    const tools = this.toolRegistry.getOllamaTools();
    const systemPrompt = this.buildSystemPrompt({ selectedNodeId: node_id, fileName: context.fileName, language: context.language });

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Include prior relevant history (up to last 4 messages)
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      const recent = conversationHistory.slice(-4);
      for (const msg of recent) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }
    }

    // Add current user prompt
    let userPromptContent = `Question: ${question}\nFile: ${context.fileName} (${context.language})`;
    if (node_id) {
      userPromptContent += `\nSelected Node ID: ${node_id}`;
    }
    if (context.code && context.code.length < 1500) {
      userPromptContent += `\nCode Context:\n\`\`\`${context.language}\n${context.code}\n\`\`\``;
    }

    messages.push({ role: 'user', content: userPromptContent });

    // Bounded ReAct Orchestration Loop
    let iterations = 0;
    let finalAnswer = '';
    let usedProvider = isLocalAvailable ? 'ollama' : 'groq';

    while (iterations < this.maxIterations) {
      iterations++;

      let responseMessage = null;
      try {
        if (usedProvider === 'ollama') {
          responseMessage = await this.callOllamaChat(messages, tools);
        } else {
          responseMessage = await this.callGroqChat(messages, tools);
        }
      } catch (callErr) {
        console.warn(`[AgentOrchestrator] Error calling ${usedProvider}: ${callErr.message}`);
        // Try fallback to Groq if local Ollama failed mid-turn
        if (usedProvider === 'ollama' && this.groqApiKey) {
          try {
            usedProvider = 'groq';
            responseMessage = await this.callGroqChat(messages, tools);
          } catch (groqErr) {
            console.warn(`[AgentOrchestrator] Groq fallback also failed: ${groqErr.message}`);
          }
        }

        if (!responseMessage) {
          // If all model calls fail, fall back to direct AST evidence synthesis
          const directResult = await buildDirectEvidenceAnswer();
          if (directResult) return directResult;

          return {
            status: 'error',
            error: `Model request failed: ${callErr.message}`,
            answer: `Unable to complete reasoning with model. Please check that Ollama is running with model ${this.model}.`,
            selected_node_id: node_id,
            evidence,
            tools_used: toolsUsed
          };
        }
      }

      // Check if model decided to call tools
      const toolCalls = responseMessage.tool_calls || [];

      if (toolCalls.length === 0) {
        // No tool calls: model reached its final answer!
        finalAnswer = this.stripInternalReasoning(responseMessage.content || '');
        break;
      }

      // Append assistant's tool-call message to history
      messages.push(responseMessage);

      // Execute each tool call requested by the model
      for (const toolCall of toolCalls) {
        const funcName = toolCall.function?.name;
        let funcArgs = toolCall.function?.arguments || {};

        if (typeof funcArgs === 'string') {
          try {
            funcArgs = JSON.parse(funcArgs);
          } catch {
            funcArgs = {};
          }
        }

        // If tool is get_node and model omitted node_id, inject selected node
        if (funcName === 'get_node' && !funcArgs.node_id && node_id) {
          funcArgs.node_id = node_id;
        }

        if (!toolsUsed.includes(funcName)) {
          toolsUsed.push(funcName);
        }

        // Execute tool safely
        const toolResult = await this.toolRegistry.invoke(funcName, funcArgs, context);

        // Record evidence
        if (toolResult.success && toolResult.data) {
          const d = toolResult.data;
          evidence.push({
            tool: funcName,
            nodeId: d.nodeId || funcArgs.node_id || null,
            lineStart: d.lineStart || null,
            lineEnd: d.lineEnd || null,
            summary: d.label || d.conditionOrOperation || d.functionName || (d.found ? 'Node details retrieved' : 'Not found'),
            data: d
          });
        }

        // Feed tool result back to the model
        messages.push({
          role: 'tool',
          name: funcName,
          content: JSON.stringify(toolResult)
        });
      }
    }

    // If max iterations reached without final content, ask for final synthesis
    if (!finalAnswer) {
      messages.push({
        role: 'user',
        content: 'Please summarize your final, concise explanation based on the tool results gathered.'
      });

      try {
        const finalMsg = usedProvider === 'ollama'
          ? await this.callOllamaChat(messages, [])
          : await this.callGroqChat(messages, []);

        finalAnswer = this.stripInternalReasoning(finalMsg?.content || '');
      } catch {
        finalAnswer = 'Explanation synthesized based on retrieved graph evidence.';
      }
    }

    return {
      status: 'success',
      answer: finalAnswer,
      selected_node_id: node_id,
      evidence,
      tools_used: toolsUsed,
      iterationsUsed: iterations,
      provider: usedProvider
    };
  }
}

// Global orchestrator instance
const defaultOrchestrator = new AgentOrchestrator();

module.exports = {
  AgentOrchestrator,
  defaultOrchestrator
};
