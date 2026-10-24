#!/usr/bin/env node
// server/test-flowchart.js
// Comprehensive test suite for the CodeMind.AI Flowchart Generation Pipeline
// Tests all 18 required cases across all supported languages

const { analyzeCodeFlowchart } = require('./analyzer/analyzerService');

// ─── Test Helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS  ${name}`);
    passed++;
    results.push({ name, status: 'PASS' });
  } catch (err) {
    console.log(`  ❌ FAIL  ${name}`);
    console.log(`         → ${err.message}`);
    failed++;
    results.push({ name, status: 'FAIL', reason: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertNodes(result, expectedTypes) {
  assert(result.success, `Expected success but got: ${result.error}`);
  const types = result.nodes.map(n => n.type);
  expectedTypes.forEach(t => {
    assert(types.includes(t), `Expected node type "${t}" in [${types.join(', ')}]`);
  });
}

function assertEdgeLabel(result, label) {
  const labels = result.edges.map(e => e.label).filter(Boolean);
  assert(labels.includes(label), `Expected edge label "${label}" in [${labels.join(', ')}]`);
}

// ─── PYTHON TESTS ──────────────────────────────────────────────────────────────

console.log('\n🐍  PYTHON TESTS\n');

test('1. Simple sequential code (Python)', () => {
  const code = 'x = 10\ny = 20\nz = x + y';
  const r = analyzeCodeFlowchart({ code, fileName: 'seq.py' });
  assert(r.success, r.error);
  assert(r.nodes.length >= 3, `Expected ≥3 nodes, got ${r.nodes.length}`);
  assert(r.nodes[0].type === 'start', 'First node must be start');
  assert(r.nodes[r.nodes.length - 1].type === 'end', 'Last node must be end');
  assert(r.language === 'python', `Expected python, got ${r.language}`);
});

test('2. if/else (Python)', () => {
  const code = 'x = 10\nif x > 5:\n    print(x)\nelse:\n    print(0)';
  const r = analyzeCodeFlowchart({ code, fileName: 'ifelse.py' });
  assertNodes(r, ['start', 'decision', 'output', 'end']);
  assertEdgeLabel(r, 'YES');
  assertEdgeLabel(r, 'NO');
  assert(r.metadata.conditions === 1, `Expected 1 condition, got ${r.metadata.conditions}`);
});

test('3. Nested if (Python)', () => {
  const code = 'if a > 0:\n    if b > 0:\n        print(both)\n    else:\n        print(a)\nelse:\n    print(none)';
  const r = analyzeCodeFlowchart({ code, fileName: 'nested.py' });
  const decisions = r.nodes.filter(n => n.type === 'decision');
  assert(decisions.length >= 2, `Expected ≥2 decision nodes, got ${decisions.length}`);
});

test('4. for loop (Python)', () => {
  const code = 'for i in range(5):\n    print(i)';
  const r = analyzeCodeFlowchart({ code, fileName: 'for.py' });
  assertNodes(r, ['loop']);
  assert(r.metadata.loops === 1, `Expected 1 loop, got ${r.metadata.loops}`);
  // Loop-back edge should exist
  const loopEdges = r.edges.filter(e => e.label === 'LOOP');
  assert(loopEdges.length >= 1, 'Expected at least one LOOP edge');
});

test('5. while loop (Python)', () => {
  const code = 'i = 0\nwhile i < 10:\n    i = i + 1';
  const r = analyzeCodeFlowchart({ code, fileName: 'while.py' });
  assertNodes(r, ['loop']);
});

test('6. Nested loops (Python)', () => {
  const code = 'for i in range(3):\n    for j in range(3):\n        print(i)';
  const r = analyzeCodeFlowchart({ code, fileName: 'nested_loop.py' });
  const loopNodes = r.nodes.filter(n => n.type === 'loop');
  assert(loopNodes.length >= 2, `Expected ≥2 loop nodes, got ${loopNodes.length}`);
});

test('7. Function declaration (Python)', () => {
  const code = 'def add(a, b):\n    return a + b';
  const r = analyzeCodeFlowchart({ code, fileName: 'func.py' });
  assertNodes(r, ['function']);
  assert(r.metadata.functions.includes('add'), 'Expected "add" in functions list');
});

test('8. Function call (Python)', () => {
  const code = 'def add(a, b):\n    return a + b\nresult = add(10, 20)';
  const r = analyzeCodeFlowchart({ code, fileName: 'call.py' });
  assert(r.success, r.error);
  assert(r.nodes.length >= 3, `Expected ≥3 nodes, got ${r.nodes.length}`);
});

test('8b. Function-focused flowchart (Python)', () => {
  const code = 'def add(a, b):\n    return a + b\ndef sub(a, b):\n    return a - b';
  const r = analyzeCodeFlowchart({ code, fileName: 'multi.py', functionName: 'add' });
  assert(r.success, r.error);
  const returnNodes = r.nodes.filter(n => n.type === 'return');
  assert(returnNodes.length >= 1, 'Expected return node when zoomed into function');
});

test('9. return statement (Python)', () => {
  const code = 'def square(n):\n    return n * n';
  const r = analyzeCodeFlowchart({ code, fileName: 'ret.py', functionName: 'square' });
  const returnNodes = r.nodes.filter(n => n.type === 'return');
  assert(returnNodes.length >= 1, `Expected return node, got none`);
  const returnEdges = r.edges.filter(e => e.label === 'RETURN');
  assert(returnEdges.length >= 1, 'Expected RETURN edge to END');
});

test('10. break statement (Python)', () => {
  const code = 'for i in range(10):\n    if i == 5:\n        break';
  const r = analyzeCodeFlowchart({ code, fileName: 'break.py' });
  const breakNode = r.nodes.find(n => n.label === 'break');
  assert(breakNode, 'Expected a break node');
});

test('11. continue statement (Python)', () => {
  const code = 'for i in range(10):\n    if i % 2 == 0:\n        continue\n    print(i)';
  const r = analyzeCodeFlowchart({ code, fileName: 'continue.py' });
  const continueNode = r.nodes.find(n => n.label === 'continue');
  assert(continueNode, 'Expected a continue node');
});

test('12. try/except (Python)', () => {
  const code = 'try:\n    x = int(y)\nexcept ValueError:\n    print(bad)\nfinally:\n    print(done)';
  const r = analyzeCodeFlowchart({ code, fileName: 'try.py' });
  assert(r.success, r.error);
  const errorNodes = r.nodes.filter(n => n.type === 'error');
  assert(errorNodes.length >= 1, 'Expected at least one error/catch node');
});

// ─── JAVASCRIPT TESTS ──────────────────────────────────────────────────────────

console.log('\n🟡  JAVASCRIPT TESTS\n');

test('13. JavaScript if/else + console.log', () => {
  const code = 'const x = 10;\nif (x > 5) {\n  console.log(big);\n} else {\n  console.log(small);\n}';
  const r = analyzeCodeFlowchart({ code, fileName: 'test.js' });
  assert(r.language === 'javascript', `Expected javascript, got ${r.language}`);
  assertNodes(r, ['decision', 'output']);
  assertEdgeLabel(r, 'YES');
});

test('13b. JavaScript for loop + function', () => {
  const code = 'function greet(name) {\n  console.log(name);\n}\nfor (let i = 0; i < 5; i++) {\n  greet(i);\n}';
  const r = analyzeCodeFlowchart({ code, fileName: 'loop.js' });
  assertNodes(r, ['function', 'loop']);
});

test('13c. JavaScript switch/case', () => {
  const code = 'switch(day) {\n  case 1:\n    console.log(Mon);\n    break;\n  case 2:\n    console.log(Tue);\n    break;\n  default:\n    console.log(Other);\n}';
  const r = analyzeCodeFlowchart({ code, fileName: 'switch.js' });
  const switchNode = r.nodes.find(n => n.type === 'decision' && n.label.includes('switch'));
  assert(switchNode, `Expected switch decision node. Nodes: ${r.nodes.map(n=>n.label).join(', ')}`);
});

test('13d. JavaScript try/catch', () => {
  const code = 'try {\n  JSON.parse(x);\n} catch (err) {\n  console.error(err);\n}';
  const r = analyzeCodeFlowchart({ code, fileName: 'trycatch.js' });
  assert(r.success, r.error);
  const errorNodes = r.nodes.filter(n => n.type === 'error');
  assert(errorNodes.length >= 1, 'Expected error/catch node');
});

// ─── TYPESCRIPT TESTS ──────────────────────────────────────────────────────────

console.log('\n🔵  TYPESCRIPT TESTS\n');

test('14. TypeScript interface + function + return', () => {
  const code = 'interface User {\n  name: string;\n  age: number;\n}\n\nfunction greet(user: User): string {\n  if (user.age >= 18) {\n    return "Adult";\n  }\n  return "Minor";\n}';
  // When focused on a function, START is labeled START: greet() and body nodes shown directly
  const r = analyzeCodeFlowchart({ code, fileName: 'user.ts', functionName: 'greet' });
  assert(r.language === 'typescript', `Expected typescript, got ${r.language}`);
  assert(r.success, r.error);
  assertNodes(r, ['decision', 'return']);
  // Also verify top-level (no function focus) has a function node
  const r2 = analyzeCodeFlowchart({ code, fileName: 'user.ts' });
  assertNodes(r2, ['function']);
  assert(r2.metadata.functions.includes('greet'), 'Expected "greet" in functions list');
});

test('14b. TypeScript arrow function', () => {
  const code = 'const add = (a: number, b: number): number => {\n  return a + b;\n};';
  const r = analyzeCodeFlowchart({ code, fileName: 'arrow.ts' });
  assert(r.success, r.error);
  // Arrow function appears as function node at top level
  assertNodes(r, ['function']);
  assert(r.metadata.functions.includes('add'), 'Expected "add" in function metadata');
});

// ─── JAVA TESTS ────────────────────────────────────────────────────────────────

console.log('\n☕  JAVA TESTS\n');

test('15. Java if/else + System.out.println', () => {
  const code = 'public class Main {\n  public static void main(String[] args) {\n    int x = 10;\n    if (x > 5) {\n      System.out.println(big);\n    } else {\n      System.out.println(small);\n    }\n  }\n}';
  const r = analyzeCodeFlowchart({ code, fileName: 'Main.java', functionName: 'main' });
  assert(r.language === 'java', `Expected java, got ${r.language}`);
  assertNodes(r, ['decision', 'output']);
});

test('15b. Java for loop', () => {
  const code = 'public class Loop {\n  public static void main(String[] args) {\n    for (int i = 0; i < 5; i++) {\n      System.out.println(i);\n    }\n  }\n}';
  const r = analyzeCodeFlowchart({ code, fileName: 'Loop.java', functionName: 'main' });
  assertNodes(r, ['loop', 'output']);
});

test('15c. Java try/catch', () => {
  const code = 'public class TryCatch {\n  void run() {\n    try {\n      int x = 1 / 0;\n    } catch (ArithmeticException e) {\n      System.out.println(error);\n    }\n  }\n}';
  const r = analyzeCodeFlowchart({ code, fileName: 'TryCatch.java' });
  assert(r.success, r.error);
});

test('15d. Java switch/case', () => {
  const code = 'switch(day) {\n  case 1:\n    System.out.println(Mon);\n    break;\n  case 2:\n    System.out.println(Tue);\n    break;\n  default:\n    System.out.println(Other);\n}';
  const r = analyzeCodeFlowchart({ code, fileName: 'Switch.java' });
  const switchNode = r.nodes.find(n => n.type === 'decision' && n.label.includes('switch'));
  assert(switchNode, `Expected switch decision node. Nodes: ${r.nodes.map(n=>n.label).join(', ')}`);
});

// ─── EDGE CASES ────────────────────────────────────────────────────────────────

console.log('\n⚠️   EDGE CASES\n');

test('16. Empty file', () => {
  const r = analyzeCodeFlowchart({ code: '', fileName: 'empty.py' });
  assert(r.success, r.error);
  assert(r.nodes.some(n => n.type === 'start'), 'Expected START node');
  assert(r.nodes.some(n => n.type === 'end'), 'Expected END node');
});

test('17. Invalid / unparseable code falls back gracefully', () => {
  const r = analyzeCodeFlowchart({ code: '!@#$%^&*()', fileName: 'bad.py' });
  // Should not throw, should return either success with process nodes or a graceful failure
  assert(typeof r === 'object', 'Expected object response');
  assert(typeof r.success === 'boolean', 'Expected success boolean');
});

test('18. Unsupported language', () => {
  const r = analyzeCodeFlowchart({ code: 'SELECT * FROM users;', fileName: 'query.sql' });
  assert(!r.success, 'Expected success=false for unsupported language');
  assert(r.error, 'Expected error message');
});

test('18b. Language detection from extension (no hint provided)', () => {
  const code = 'def greet():\n    print(hello)';
  const r = analyzeCodeFlowchart({ code, fileName: 'greet.py' }); // no language hint
  assert(r.language === 'python', `Expected python detected from .py, got ${r.language}`);
});

test('18c. Language hint overrides extension', () => {
  const code = 'const x = 10;';
  const r = analyzeCodeFlowchart({ code, language: 'javascript', fileName: 'file.txt' });
  assert(r.language === 'javascript', `Expected javascript from hint, got ${r.language}`);
});

// ─── LINE MAPPING VERIFICATION ────────────────────────────────────────────────

console.log('\n📍  LINE MAPPING TESTS\n');

test('Line numbers are present on all non-start-end nodes', () => {
  const code = 'x = 1\ny = 2\nif x > 0:\n    print(x)';
  const r = analyzeCodeFlowchart({ code, fileName: 'lines.py' });
  const mainNodes = r.nodes.filter(n => n.type !== 'start' && n.type !== 'end');
  mainNodes.forEach(n => {
    assert(typeof n.lineStart === 'number' && n.lineStart >= 1,
      `Node "${n.label}" missing lineStart`);
    assert(typeof n.lineEnd === 'number' && n.lineEnd >= n.lineStart,
      `Node "${n.label}" has invalid lineEnd (${n.lineEnd} < lineStart ${n.lineStart})`);
  });
});

test('Line numbers match actual source positions', () => {
  const code = 'x = 10\nif x > 5:\n    print(x)';
  const r = analyzeCodeFlowchart({ code, fileName: 'pos.py' });
  const decisionNode = r.nodes.find(n => n.type === 'decision');
  assert(decisionNode, 'Expected a decision node');
  assert(decisionNode.lineStart === 2, `Expected decision at line 2, got ${decisionNode.lineStart}`);
});

// ─── METADATA VERIFICATION ────────────────────────────────────────────────────

console.log('\n📊  METADATA TESTS\n');

test('Metadata includes nodeCount and edgeCount', () => {
  const code = 'x = 1\nprint(x)';
  const r = analyzeCodeFlowchart({ code, fileName: 'meta.py' });
  assert(typeof r.metadata.nodeCount === 'number', 'Expected nodeCount in metadata');
  assert(typeof r.metadata.edgeCount === 'number', 'Expected edgeCount in metadata');
  assert(r.metadata.nodeCount === r.nodes.length, 'nodeCount must match nodes array length');
  assert(r.metadata.edgeCount === r.edges.length, 'edgeCount must match edges array length');
});

test('Metadata functions list populated', () => {
  const code = 'def foo():\n    return 1\ndef bar():\n    return 2';
  const r = analyzeCodeFlowchart({ code, fileName: 'funcs.py' });
  assert(Array.isArray(r.metadata.functions), 'Expected functions array');
  assert(r.metadata.functions.includes('foo'), `Expected "foo" in functions: ${r.metadata.functions}`);
  assert(r.metadata.functions.includes('bar'), `Expected "bar" in functions: ${r.metadata.functions}`);
});

test('Every edge references valid node IDs', () => {
  const code = 'for i in range(3):\n    if i > 1:\n        print(i)\n    else:\n        continue';
  const r = analyzeCodeFlowchart({ code, fileName: 'validate.py' });
  const nodeIds = new Set(r.nodes.map(n => n.id));
  r.edges.forEach(e => {
    assert(nodeIds.has(e.source), `Edge source "${e.source}" not in node list`);
    assert(nodeIds.has(e.target), `Edge target "${e.target}" not in node list`);
  });
});

// ─── SUMMARY ──────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(55));
console.log(`  📋  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log('═'.repeat(55));

if (failed > 0) {
  console.log('\n  Failed tests:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  ✗  ${r.name}`);
    if (r.reason) console.log(`     ${r.reason}`);
  });
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
