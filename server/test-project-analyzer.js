// server/test-project-analyzer.js
// Automated verification suite for CodeMind.AI backend Multi-File Project Analysis Module
// Tests all 14 scenarios specified in the requirements

const { analyzeRepository } = require('./projectAnalyzer');

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    return true;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${err.message}`);
    console.error(err.stack);
    return false;
  }
}

console.log('====================================================');
console.log('🧪 CodeMind.AI Multi-File Project Analysis Test Suite');
console.log('====================================================\n');

let passed = 0;
let total = 0;

// Test 1: One file
total++;
if (runTest('1. One file analysis', () => {
  const files = [
    {
      path: 'app.py',
      content: `
def greet(name):
    return f"Hello, {name}"

print(greet("World"))
`
    }
  ];

  const res = analyzeRepository({ repositoryName: 'single-file', files });
  if (!res.success) throw new Error('Analysis failed');
  if (res.statistics.totalFiles !== 1) throw new Error(`Expected 1 file, got ${res.statistics.totalFiles}`);
  if (res.statistics.totalFunctions < 1) throw new Error('Expected at least 1 function');
})) passed++;

// Test 2: Two files
total++;
if (runTest('2. Two files analysis', () => {
  const files = [
    {
      path: 'main.py',
      content: `from helper import format_text\nprint(format_text("test"))`
    },
    {
      path: 'helper.py',
      content: `def format_text(s):\n    return s.upper()`
    }
  ];

  const res = analyzeRepository({ repositoryName: 'two-files', files });
  if (res.statistics.totalFiles !== 2) throw new Error(`Expected 2 files, got ${res.statistics.totalFiles}`);
  const hasImport = res.dependencies.internal.some(d => d.source === 'main.py' && d.target === 'helper.py');
  if (!hasImport) throw new Error('Missing internal dependency from main.py to helper.py');
})) passed++;

// Test 3: Multiple files
total++;
if (runTest('3. Multiple files analysis (Python pipeline from prompt example)', () => {
  const files = [
    {
      path: 'main.py',
      content: `from auth import login\nlogin()`
    },
    {
      path: 'auth.py',
      content: `from database import check_user\ndef login():\n    check_user()`
    },
    {
      path: 'database.py',
      content: `def check_user():\n    print("Checking user")`
    },
    {
      path: 'utils.py',
      content: `def helper():\n    return 42`
    }
  ];

  const res = analyzeRepository({ repositoryName: 'multi-file-py', files });
  if (res.statistics.totalFiles !== 4) throw new Error(`Expected 4 files, got ${res.statistics.totalFiles}`);
  if (res.statistics.totalFunctions < 3) throw new Error(`Expected at least 3 functions, got ${res.statistics.totalFunctions}`);
  
  // Verify main.py -> auth.py and auth.py -> database.py
  const dep1 = res.dependencies.internal.find(d => d.source === 'main.py' && d.target === 'auth.py');
  const dep2 = res.dependencies.internal.find(d => d.source === 'auth.py' && d.target === 'database.py');
  if (!dep1 || !dep2) throw new Error('Failed to resolve multi-file dependency chain');
})) passed++;

// Test 4: Nested directories
total++;
if (runTest('4. Nested directories resolution', () => {
  const files = [
    {
      path: 'src/controllers/userController.js',
      content: `const userService = require('../services/userService');\nfunction handleUser() { userService.getUser(); }`
    },
    {
      path: 'src/services/userService.js',
      content: `const db = require('../db/client');\nfunction getUser() { db.query(); }`
    },
    {
      path: 'src/db/client.js',
      content: `function query() { return []; }`
    }
  ];

  const res = analyzeRepository({ repositoryName: 'nested-dirs', files });
  if (res.statistics.totalFiles !== 3) throw new Error(`Expected 3 files, got ${res.statistics.totalFiles}`);
  const dep = res.dependencies.internal.find(
    d => d.source === 'src/controllers/userController.js' && d.target === 'src/services/userService.js'
  );
  if (!dep) throw new Error('Failed to resolve nested relative import ../services/userService');
})) passed++;

// Test 5: Python project
total++;
if (runTest('5. Python project with entry point', () => {
  const files = [
    {
      path: 'main.py',
      content: `
import os
from service import run_app

if __name__ == '__main__':
    run_app()
`
    },
    {
      path: 'service.py',
      content: `
def run_app():
    print("App running")
`
    }
  ];

  const res = analyzeRepository({ repositoryName: 'python-proj', files });
  const ep = res.entryPoints.find(e => e.file === 'main.py' && e.type === 'python_main');
  if (!ep) throw new Error('Failed to detect Python if __name__ == "__main__" entry point');
})) passed++;

// Test 6: JavaScript project
total++;
if (runTest('6. JavaScript project with ES6 imports/exports and CommonJS', () => {
  const files = [
    {
      path: 'server.js',
      content: `
const express = require('express');
const auth = require('./auth');

const app = express();
app.listen(4000, () => {
  auth.authenticate();
});
`
    },
    {
      path: 'auth.js',
      content: `
function authenticate() {
  return true;
}
module.exports = { authenticate };
`
    },
    {
      path: 'package.json',
      content: JSON.stringify({ name: 'js-proj', main: 'server.js' })
    }
  ];

  const res = analyzeRepository({ repositoryName: 'js-proj', files });
  if (res.statistics.totalFiles !== 2) throw new Error(`Expected 2 source files, got ${res.statistics.totalFiles}`);
  if (!res.dependencies.external.includes('express')) throw new Error('Failed to detect external dependency "express"');
  const ep = res.entryPoints.find(e => e.file === 'server.js');
  if (!ep) throw new Error('Failed to detect server.js as entry point');
})) passed++;

// Test 7: TypeScript project
total++;
if (runTest('7. TypeScript project with interfaces and typed functions', () => {
  const files = [
    {
      path: 'src/index.ts',
      content: `
import { UserService } from './services/UserService';

const service = new UserService();
service.fetchProfile(101);
`
    },
    {
      path: 'src/services/UserService.ts',
      content: `
import { User } from '../models/User';

export class UserService {
  fetchProfile(id: number): User {
    return { id, name: "Alice" };
  }
}
`
    },
    {
      path: 'src/models/User.ts',
      content: `
export interface User {
  id: number;
  name: string;
}
`
    }
  ];

  const res = analyzeRepository({ repositoryName: 'ts-proj', files });
  if (res.statistics.totalFiles !== 3) throw new Error(`Expected 3 files, got ${res.statistics.totalFiles}`);
  if (res.statistics.totalClasses < 1) throw new Error('Expected class UserService');
})) passed++;

// Test 8: Java project
total++;
if (runTest('8. Java project with package imports and main method', () => {
  const files = [
    {
      path: 'com/example/Main.java',
      content: `
package com.example;
import com.example.service.Calculator;

public class Main {
    public static void main(String[] args) {
        Calculator calc = new Calculator();
        calc.add(5, 3);
    }
}
`
    },
    {
      path: 'com/example/service/Calculator.java',
      content: `
package com.example.service;

public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }
}
`
    }
  ];

  const res = analyzeRepository({ repositoryName: 'java-proj', files });
  if (res.statistics.totalFiles !== 2) throw new Error(`Expected 2 files, got ${res.statistics.totalFiles}`);
  const ep = res.entryPoints.find(e => e.file === 'com/example/Main.java' && e.type === 'java_main');
  if (!ep) throw new Error('Failed to detect Java public static void main entry point');
})) passed++;

// Test 9: Function calls across files
total++;
if (runTest('9. Function calls across files resolution', () => {
  const files = [
    {
      path: 'main.py',
      content: `
from auth import login
from db import query

login()
query()
`
    },
    {
      path: 'auth.py',
      content: `
from db import query

def login():
    query()
`
    },
    {
      path: 'db.py',
      content: `
def query():
    print("Executing query")
`
    }
  ];

  const res = analyzeRepository({ repositoryName: 'cross-calls', files });
  // Find call edges
  const loginCall = res.edges.find(e => e.type === 'function_call' && e.targetFile === 'auth.py');
  const queryCall = res.edges.find(e => e.type === 'function_call' && e.targetFile === 'db.py');
  if (!loginCall) throw new Error('Failed to resolve cross-file function call to login()');
  if (!queryCall) throw new Error('Failed to resolve cross-file function call to query()');
})) passed++;

// Test 10: Circular dependencies
total++;
if (runTest('10. Circular dependencies handling without crashing', () => {
  const files = [
    {
      path: 'moduleA.js',
      content: `const b = require('./moduleB'); function a() { b.b(); } module.exports = { a };`
    },
    {
      path: 'moduleB.js',
      content: `const a = require('./moduleA'); function b() { a.a(); } module.exports = { b };`
    }
  ];

  const res = analyzeRepository({ repositoryName: 'circular', files });
  if (res.circularDependencies.length === 0) throw new Error('Failed to detect circular dependency cycle');
  const circularEdge = res.edges.find(e => e.isCircular);
  if (!circularEdge) throw new Error('Failed to flag circular edge');
})) passed++;

// Test 11: Unresolved dependencies
total++;
if (runTest('11. Unresolved / external calls flagged with resolved: false without fake edges', () => {
  const files = [
    {
      path: 'calc.js',
      content: `
function compute(x) {
    const r = Math.sqrt(x);
    externalApiCall(r);
    return r;
}
`
    }
  ];

  const res = analyzeRepository({ repositoryName: 'unresolved', files });
  // Make sure we didn't create a fake edge for externalApiCall
  const fakeEdge = res.edges.find(e => e.label === 'externalApiCall');
  if (fakeEdge) throw new Error('Created fake edge for unknown function');
  if (res.statistics.unresolvedCalls < 1) throw new Error('Unresolved call was not tracked');
})) passed++;

// Test 12: Invalid source files
total++;
if (runTest('12. Invalid / malformed source files handling', () => {
  const files = [
    {
      path: 'broken.py',
      content: `def def def (( invalid syntax {{{{`
    },
    {
      path: 'ok.py',
      content: `def valid(): return 1`
    }
  ];

  const res = analyzeRepository({ repositoryName: 'invalid-src', files });
  if (!res.success) throw new Error('Parser crashed on invalid source code');
  if (res.statistics.totalFiles !== 2) throw new Error('Should safely process all files');
})) passed++;

// Test 13: Non-source files & ignored directories
total++;
if (runTest('13. Non-source files & ignored directories filtering', () => {
  const files = [
    { path: 'node_modules/express/index.js', content: '...' },
    { path: '.git/config', content: '...' },
    { path: 'dist/bundle.js', content: '...' },
    { path: 'assets/logo.png', content: 'binary...' },
    { path: 'src/real.js', content: 'function real() {}' }
  ];

  const res = analyzeRepository({ repositoryName: 'ignored-dirs', files });
  if (res.statistics.totalFiles !== 1) {
    throw new Error(`Expected only 1 source file, but got ${res.statistics.totalFiles}`);
  }
  if (res.files[0].path !== 'src/real.js') {
    throw new Error(`Expected src/real.js, got ${res.files[0].path}`);
  }
  if (res.statistics.ignoredFiles < 4) {
    throw new Error('Ignored files count was not incremented');
  }
})) passed++;

// Test 14: Large project & abstraction levels
total++;
if (runTest('14. Large project with level switching (file vs function vs combined)', () => {
  const files = [];
  for (let i = 1; i <= 25; i++) {
    files.push({
      path: `module_${i}.py`,
      content: `
import module_${i === 25 ? 1 : i + 1}

def func_${i}():
    return ${i}
`
    });
  }

  // Level: file
  const resFile = analyzeRepository({ repositoryName: 'large-proj', files, level: 'file' });
  if (resFile.nodes.some(n => n.type === 'function')) {
    throw new Error('File level should only contain file nodes');
  }

  // Level: function
  const resFunc = analyzeRepository({ repositoryName: 'large-proj', files, level: 'function' });
  if (resFunc.nodes.some(n => n.type === 'file')) {
    throw new Error('Function level should only contain function nodes');
  }

  // Level: combined
  const resCombined = analyzeRepository({ repositoryName: 'large-proj', files, level: 'combined' });
  if (resCombined.nodes.length < 50) {
    throw new Error('Combined level should contain both file and function nodes');
  }
  if (resCombined.statistics.totalFiles !== 25) {
    throw new Error(`Expected 25 files, got ${resCombined.statistics.totalFiles}`);
  }
})) passed++;

console.log('\n====================================================');
console.log(`📊 Test Results: ${passed} / ${total} Passed (${Math.round((passed / total) * 100)}%)`);
console.log('====================================================');

if (passed === total) {
  console.log('🎉 ALL 14 TEST SCENARIOS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error(`⚠️ ${total - passed} tests failed.`);
  process.exit(1);
}
