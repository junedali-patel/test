// server/test-tutor.js
// Comprehensive test suite for the Agentic Tutor Module in CodeMind AI.

const assert = require('assert');
const { defaultToolRegistry, ToolRegistry } = require('./tutor/toolRegistry');
const { getNodeToolDefinition } = require('./tutor/tools/getNode');
const { getCallGraphToolDefinition } = require('./tutor/tools/getCallGraph');
const { runTraceToolDefinition } = require('./tutor/tools/runTrace');
const { ExecutionService } = require('./tutor/executionService');
const { SessionManager, sessionManager } = require('./tutor/sessionManager');
const { AgentOrchestrator } = require('./tutor/agentOrchestrator');
const { analyzeCodeFlowchart } = require('./analyzer/analyzerService');
const { analyzeRepository } = require('./projectAnalyzer');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🤖 CodeMind AI — Agentic Tutor Test Suite');
  console.log('═══════════════════════════════════════════════════════\n');

  // Sample real Python code for testing
  const samplePythonCode = `def check_status(score):
    if score >= 50:
        print("Pass")
        return True
    else:
        print("Fail")
        return False
`;

  // Parse sample code using existing real CodeMind analyzer
  const flowchartResult = analyzeCodeFlowchart({
    code: samplePythonCode,
    language: 'python',
    fileName: 'status.py'
  });

  const testSessionId = sessionManager.saveSession(null, {
    code: samplePythonCode,
    fileName: 'status.py',
    language: 'python',
    nodes: flowchartResult.nodes,
    edges: flowchartResult.edges,
    functions: flowchartResult.metadata.functions
  });

  const decisionNode = flowchartResult.nodes.find(n => n.type.toUpperCase() === 'DECISION');
  assert(decisionNode, 'Flowchart must contain at least one decision node');

  // ── 1. Valid selected node returns real graph information ───────────────────
  await runTest('1. Valid selected node returns real graph information', async () => {
    const res = await getNodeToolDefinition.execute({
      node_id: decisionNode.id,
      session_id: testSessionId
    });

    assert.strictEqual(res.found, true, 'Node should be found');
    assert.strictEqual(res.nodeId, decisionNode.id, 'Node ID must match');
    assert.strictEqual(res.nodeType, 'DECISION', 'Node type should be DECISION');
    assert(res.label.includes('50'), 'Label should contain the actual condition');
    assert(res.lineStart !== null, 'Line numbers must be present');
    assert(Array.isArray(res.outgoingEdges), 'Outgoing edges must be an array');
    assert(res.branches, 'Branches should be extracted for decision node');
    assert(res.branches.trueBranch || res.branches.falseBranch, 'True/False branch should be identified');
  });

  // ── 2. Invalid node ID produces a controlled error ──────────────────────────
  await runTest('2. Invalid node ID produces a controlled error without throwing', async () => {
    const res = await getNodeToolDefinition.execute({
      node_id: 'non_existent_node_9999',
      session_id: testSessionId
    });

    assert.strictEqual(res.found, false, 'Node must not be found');
    assert(res.error.includes('was not found'), 'Error message must clearly state missing node');
    assert(Array.isArray(res.availableNodes), 'Should list available nodes for guidance');
  });

  // ── 3. Call-graph tool returns actual known relationships ───────────────────
  await runTest('3. Call-graph tool returns actual known relationships', async () => {
    const multiFileProject = [
      {
        path: 'auth.py',
        content: `from db import query_user
def login(user):
    query_user(user)
`
      },
      {
        path: 'db.py',
        content: `def query_user(user):
    print("User query")
`
      }
    ];

    const projectAnalysis = analyzeRepository({
      repositoryName: 'test-auth-app',
      files: multiFileProject,
      level: 'combined'
    });

    const projectSessionId = sessionManager.saveSession(null, {
      files: multiFileProject,
      callGraph: {
        functionNodes: projectAnalysis.nodes.filter(n => n.type === 'function'),
        callEdges: projectAnalysis.edges.filter(e => e.type === 'function_call')
      }
    });

    const res = await getCallGraphToolDefinition.execute({
      function_name: 'login',
      session_id: projectSessionId
    });

    assert.strictEqual(res.found, true, 'Function "login" should be found in call graph');
    assert.strictEqual(res.functionName, 'login', 'Function name should match');
    assert(Array.isArray(res.callees), 'Callees must be an array');
    assert(res.callees.length > 0, 'login should have query_user as callee');
    assert.strictEqual(res.callees[0].functionName, 'query_user', 'Callee name must be query_user');
  });

  // ── 4. Recursive and cyclic call graphs do not cause infinite traversal ─────
  await runTest('4. Recursive and cyclic call graphs do not cause infinite traversal', async () => {
    // Cyclic mutual recursion: func_a calls func_b, func_b calls func_a
    const cyclicFiles = [
      {
        path: 'cycle.py',
        content: `def func_a(n):
    if n > 0:
        func_b(n - 1)

def func_b(n):
    if n > 0:
        func_a(n - 1)
`
      }
    ];

    const res = await getCallGraphToolDefinition.execute(
      { function_name: 'func_a', depth: 4 },
      { code: cyclicFiles[0].content, fileName: 'cycle.py' }
    );

    assert.strictEqual(res.found, true, 'func_a should be found');
    assert(Array.isArray(res.callees), 'Callees should be array');
    // Traversal terminates without stack overflow
    assert(res.maxDepthTraversed <= 4, 'Must respect max traversal depth');
  });

  // ── 5. Run-trace without sandbox reports unavailable safely ─────────────────
  await runTest('5. Run-trace without secure sandbox reports unavailable safely', async () => {
    const unconfiguredExec = new ExecutionService({ sandboxUrl: null, dockerEnabled: false });
    const res = await runTraceToolDefinition.execute(
      { code: 'print("hello")', language: 'python' },
      { executionService: unconfiguredExec }
    );

    assert.strictEqual(res.status, 'unavailable', 'Status must be unavailable');
    assert.strictEqual(res.executed, false, 'Must not claim code was executed');
    assert(res.missingDependency.includes('sandbox'), 'Must document missing container/sandbox dependency');
  });

  // ── 6. Run-trace with secure runner executes within limits ──────────────────
  await runTest('6. Run-trace with secure runner executes and returns real outputs', async () => {
    // Inject mock isolated runner
    const secureMockRunner = async ({ code, language }) => ({
      status: 'success',
      stdout: 'Result: 42\n',
      stderr: '',
      exitCode: 0,
      timedOut: false,
      executionTimeMs: 45
    });

    const mockExec = new ExecutionService({ customRunner: secureMockRunner });
    const res = await runTraceToolDefinition.execute(
      { code: 'print("Result: 42")', language: 'python' },
      { executionService: mockExec }
    );

    assert.strictEqual(res.executed, true, 'Code should report executed');
    assert.strictEqual(res.status, 'success', 'Status should be success');
    assert.strictEqual(res.stdout, 'Result: 42\n', 'Actual stdout returned');
    assert.strictEqual(res.exitCode, 0, 'Exit code should be 0');
  });

  // ── 7. ToolRegistry parameter validation and argument checks ────────────────
  await runTest('7. ToolRegistry parameter validation rejects invalid types and missing required args', async () => {
    const testRegistry = new ToolRegistry();
    testRegistry.register(getNodeToolDefinition);

    // Missing required node_id
    const val1 = testRegistry.validateArgs('get_node', {});
    assert.strictEqual(val1.valid, false, 'Should fail without node_id');
    assert(val1.errors[0].includes('Missing required parameter "node_id"'));

    // Wrong type for node_id (number instead of string)
    const val2 = testRegistry.validateArgs('get_node', { node_id: 12345 });
    assert.strictEqual(val2.valid, false, 'Should fail with non-string node_id');
    assert(val2.errors[0].includes('must be a string'));

    // Valid parameters
    const val3 = testRegistry.validateArgs('get_node', { node_id: 'node_1' });
    assert.strictEqual(val3.valid, true, 'Should pass with valid string node_id');
  });

  // ── 8. Agent handles offline Ollama gracefully with graph evidence ──────────
  await runTest('8. Agent handles offline Ollama gracefully and returns verified graph evidence', async () => {
    // Point orchestrator to unreachable dummy port
    const offlineOrchestrator = new AgentOrchestrator({
      baseUrl: 'http://127.0.0.1:54321', // definitely offline
      groqApiKey: null
    });

    const result = await offlineOrchestrator.ask({
      question: 'Explain this decision node and where its branches lead.',
      node_id: decisionNode.id,
      session_id: testSessionId,
      code: samplePythonCode,
      language: 'python'
    });

    assert.strictEqual(result.status, 'success', 'Status should report success with verified graph evidence');
    assert(result.tools_used.includes('get_node'), 'Tutor must have invoked get_node');
    assert(result.evidence.length > 0, 'Evidence must be recorded');
    assert(result.answer.includes(decisionNode.id), 'Answer must ground itself in the requested node ID');
    assert(result.answer.includes(decisionNode.label), 'Answer must cite the actual node label');
  });

  // ── 9. Agent ReAct loop invokes tool and passes results to model ────────────
  await runTest('9. Agent ReAct loop invokes tool, captures evidence, and returns final answer', async () => {
    const mockOrchestrator = new AgentOrchestrator();

    // Mock Ollama chat turns: turn 1 requests tool "get_node", turn 2 returns final answer
    let turn = 0;
    mockOrchestrator.callOllamaChat = async (messages, tools) => {
      turn++;
      if (turn === 1) {
        return {
          role: 'assistant',
          tool_calls: [
            {
              function: {
                name: 'get_node',
                arguments: JSON.stringify({ node_id: decisionNode.id })
              }
            }
          ]
        };
      }
      // Turn 2: observe tool output and return final explanation
      const lastToolMsg = messages.find(m => m.role === 'tool');
      assert(lastToolMsg, 'Model must have received tool observation in message history');
      return {
        role: 'assistant',
        content: `Based on verified node evidence, node ${decisionNode.id} evaluates condition ${decisionNode.label} on [Line ${decisionNode.lineStart}]. It branches to YES when score >= 50 and NO otherwise.`
      };
    };

    mockOrchestrator.checkOllamaHealth = async () => ({ reachable: true, models: ['qwen2.5-coder:7b'] });

    const res = await mockOrchestrator.ask({
      question: 'Why does this condition have two branches?',
      node_id: decisionNode.id,
      session_id: testSessionId,
      code: samplePythonCode,
      language: 'python'
    });

    assert.strictEqual(res.status, 'success', 'Status must be success');
    assert(res.tools_used.includes('get_node'), 'get_node must have been called');
    assert(res.evidence.length > 0, 'Evidence must be captured');
    assert(res.answer.includes(decisionNode.id), 'Answer must reference the node ID');
    assert(res.answer.includes('YES'), 'Answer must explain branches');
  });

  // ── 10. Bounded loop stops excessive tool calls at limit ────────────────────
  await runTest('10. Bounded loop stops excessive tool calls at maxIterations limit', async () => {
    const loopingOrchestrator = new AgentOrchestrator({ maxIterations: 3 });

    // Mock a model that keeps requesting tools in an infinite loop
    let callCount = 0;
    loopingOrchestrator.callOllamaChat = async (messages, tools) => {
      callCount++;
      if (tools && tools.length > 0) {
        return {
          role: 'assistant',
          tool_calls: [{ function: { name: 'get_node', arguments: { node_id: decisionNode.id } } }]
        };
      }
      return { role: 'assistant', content: 'Final capped answer.' };
    };

    loopingOrchestrator.checkOllamaHealth = async () => ({ reachable: true, models: ['test-model'] });

    const res = await loopingOrchestrator.ask({
      question: 'Keep calling tools forever',
      node_id: decisionNode.id,
      session_id: testSessionId
    });

    assert.strictEqual(res.status, 'success');
    assert(res.iterationsUsed <= 3, 'Iterations must be capped by maxIterations');
  });

  // ── 11. Session manager saves, retrieves, and handles expiration ────────────
  await runTest('11. Session manager saves, retrieves, and maintains graph data correctly', async () => {
    const sm = new SessionManager(5, 500); // 500ms TTL
    const sid = sm.saveSession(null, {
      code: 'x = 1',
      nodes: [{ id: 'n1', label: 'x = 1' }],
      edges: []
    });

    const retrieved = sm.getSession(sid);
    assert(retrieved, 'Session must be retrievable');
    assert.strictEqual(retrieved.nodes[0].id, 'n1', 'Node data must be preserved');

    // Test expiration
    await new Promise(r => setTimeout(r, 600));
    assert.strictEqual(sm.getSession(sid), null, 'Expired session must return null');
  });

  // ── 12. Tutor does not invent results when evidence is missing ──────────────
  await runTest('12. Tutor does not invent results when evidence is missing', async () => {
    const res = await getCallGraphToolDefinition.execute({
      function_name: 'completely_made_up_function_xyz',
      session_id: testSessionId
    });

    assert.strictEqual(res.found, false, 'Must report found = false');
    assert(res.error.includes('was not found'), 'Must explain function was not found');
  });

  // ── 13. Existing parser and analyzer continue to work without regression ────
  await runTest('13. Existing parser, AST flow generator, and project analyzer work without regression', async () => {
    const fc = analyzeCodeFlowchart({
      code: 'for i in range(5):\n    print(i)',
      language: 'python'
    });
    assert.strictEqual(fc.success, true, 'Flowchart must succeed');
    assert(fc.nodes.some(n => n.type.toUpperCase() === 'LOOP'), 'Loop node must be parsed');

    const pr = analyzeRepository({
      repositoryName: 'reg-test',
      files: [{ path: 'a.js', content: 'console.log("hello")' }]
    });
    assert.strictEqual(pr.success, true, 'Project analysis must succeed');
    assert.strictEqual(pr.statistics.totalFiles, 1, 'File count must be 1');
  });

  // ── 14. Tutor Express API endpoint POST /api/tutor/ask returns valid response ──
  await runTest('14. Tutor Express API endpoint returns valid response shape for normal question', async () => {
    const express = require('express');
    const tutorRoutes = require('./routes/tutor');
    const app = express();
    app.use(express.json());
    app.use('/api/tutor', tutorRoutes);

    // Start a temporary test server
    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    try {
      const axios = require('axios');

      // Valid ask request
      const res = await axios.post(`http://127.0.0.1:${port}/api/tutor/ask`, {
        question: 'Explain why this decision node branches.',
        node_id: decisionNode.id,
        session_id: testSessionId,
        code: samplePythonCode,
        language: 'python'
      });

      assert.strictEqual(res.status, 200, 'HTTP status must be 200');
      assert.strictEqual(res.data.status, 'success', 'Response status must be success');
      assert.strictEqual(res.data.selected_node_id, decisionNode.id, 'selected_node_id must match');
      assert(typeof res.data.answer === 'string' && res.data.answer.length > 0, 'Answer must not be empty');
      assert(Array.isArray(res.data.evidence), 'Evidence must be an array');
      assert(Array.isArray(res.data.tools_used), 'tools_used must be an array');

      // Invalid request without question returns 400
      try {
        await axios.post(`http://127.0.0.1:${port}/api/tutor/ask`, { question: '' });
        assert.fail('Should return 400 for empty question');
      } catch (postErr) {
        assert.strictEqual(postErr.response.status, 400, 'Empty question must return 400');
      }

      // Health endpoint check
      const healthRes = await axios.get(`http://127.0.0.1:${port}/api/tutor/health`);
      assert.strictEqual(healthRes.status, 200, 'Health endpoint should return 200');
      assert.strictEqual(healthRes.data.status, 'ok', 'Health status should be ok');
      assert(Array.isArray(healthRes.data.tools), 'Health check must list registered tools');
    } finally {
      server.close();
    }
  });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`📋 Tutor Test Results: ${passedTests} passed, ${failedTests} failed out of ${totalTests} tests`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests();
