// server/projectAnalyzer/callGraph.js
// Resolves function-to-function calls across files and within files with confidence checking

/**
 * Generates unique function node ID from file path and function name
 */
function functionId(filePath, functionName) {
  const cleanPath = filePath.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const cleanFunc = functionName.replace(/[^a-zA-Z0-9]/g, '_');
  return `fn_${cleanPath}_${cleanFunc}`;
}

/**
 * Builds function call graph, resolving cross-file calls using symbol and module import maps
 * @param {Array<Object>} analyzedFiles
 * @param {Map} symbolMap - "sourceFilePath:symbolName" -> { targetFile, originalName }
 * @param {Map} moduleMap - "sourceFilePath:moduleName" -> targetFile
 * @returns {{ functionNodes: Array, callEdges: Array, unresolvedCalls: Array }}
 */
function buildCallGraph(analyzedFiles, symbolMap = new Map(), moduleMap = new Map()) {
  const functionNodes = [];
  const callEdges = [];
  const unresolvedCalls = [];

  // Function registry: "filePath:funcName" -> funcObject
  const functionRegistry = new Map();
  // Name to candidate functions: "funcName" -> [funcObject, ...]
  const nameToFunctions = new Map();

  // 1. Register all functions across all files
  analyzedFiles.forEach(file => {
    file.functions.forEach(f => {
      const fId = functionId(file.path, f.name);
      const funcNode = {
        id: fId,
        type: 'function',
        label: `${f.name}()`,
        name: f.name,
        file: file.path,
        parameters: f.parameters || [],
        lineStart: f.lineStart,
        lineEnd: f.lineEnd,
        isAsync: f.isAsync || false,
        isExported: f.isExported || false,
        parentClass: f.parentClass || null,
        calls: [],
        calledBy: [],
        rawCalls: f.calls || []
      };

      functionNodes.push(funcNode);
      functionRegistry.set(`${file.path}:${f.name}`, funcNode);

      if (!nameToFunctions.has(f.name)) {
        nameToFunctions.set(f.name, []);
      }
      nameToFunctions.get(f.name).push(funcNode);
    });

    // 2. Also register a top-level pseudo-function if file has top-level execution calls
    if (Array.isArray(file.topLevelCalls) && file.topLevelCalls.length > 0) {
      const topLevelId = functionId(file.path, '__toplevel__');
      const topLevelNode = {
        id: topLevelId,
        type: 'function',
        label: `${file.filename}: <main>`,
        name: '<main>',
        file: file.path,
        parameters: [],
        lineStart: 1,
        lineEnd: file.lineCount || 1,
        isAsync: false,
        isExported: false,
        parentClass: null,
        calls: [],
        calledBy: [],
        rawCalls: file.topLevelCalls,
        isTopLevel: true
      };

      functionNodes.push(topLevelNode);
      functionRegistry.set(`${file.path}:__toplevel__`, topLevelNode);
    }
  });

  // 2. Resolve calls from every function (and top-level)
  const seenCallEdges = new Set();

  function resolveCall(callerNode, call) {
    const callerFilePath = callerNode.file;
    const callName = call.name;
    const objectOrModule = call.objectOrModule;
    let targetFuncNode = null;
    let resolutionReason = '';

    // CASE A: Direct imported function symbol
    // e.g. `from auth import login` -> `login()` called in main.py
    const symbolKey = `${callerFilePath}:${callName}`;
    if (symbolMap.has(symbolKey)) {
      const { targetFile, originalName } = symbolMap.get(symbolKey);
      targetFuncNode = functionRegistry.get(`${targetFile}:${originalName}`) || null;
      if (targetFuncNode) {
        resolutionReason = `Imported symbol from ${targetFile}`;
      }
    }

    // CASE B: Module / Namespace call
    // e.g. `import auth; auth.login()` or `const db = require('./db'); db.check_user()`
    if (!targetFuncNode && objectOrModule) {
      const moduleKey = `${callerFilePath}:${objectOrModule}`;
      if (moduleMap.has(moduleKey)) {
        const targetFile = moduleMap.get(moduleKey);
        targetFuncNode = functionRegistry.get(`${targetFile}:${callName}`) || null;
        if (targetFuncNode) {
          resolutionReason = `Module method call on ${objectOrModule} (${targetFile})`;
        }
      }
    }

    // CASE C: Local function call in same file
    if (!targetFuncNode && !objectOrModule) {
      targetFuncNode = functionRegistry.get(`${callerFilePath}:${callName}`) || null;
      if (targetFuncNode) {
        resolutionReason = `Local function in ${callerFilePath}`;
      }
    }

    // CASE D: Method call on class within same file
    if (!targetFuncNode && callerNode.parentClass) {
      targetFuncNode = functionRegistry.get(`${callerFilePath}:${callName}`) || null;
    }

    // IF RESOLVED:
    if (targetFuncNode && targetFuncNode.id !== callerNode.id) {
      // Record in bidirectional lists
      if (!callerNode.calls.includes(targetFuncNode.id)) {
        callerNode.calls.push(targetFuncNode.id);
      }
      if (!targetFuncNode.calledBy.includes(callerNode.id)) {
        targetFuncNode.calledBy.push(callerNode.id);
      }

      const edgeKey = `${callerNode.id}->${targetFuncNode.id}`;
      if (!seenCallEdges.has(edgeKey)) {
        seenCallEdges.add(edgeKey);
        callEdges.push({
          id: `call_${callEdges.length + 1}`,
          source: callerNode.id,
          target: targetFuncNode.id,
          callerFile: callerFilePath,
          targetFile: targetFuncNode.file,
          type: 'function_call',
          label: 'calls',
          resolved: true,
          reason: resolutionReason,
          line: call.line
        });
      }
    } else {
      // Unresolved call: record cleanly without inventing fake relationships
      unresolvedCalls.push({
        caller: callerNode.id,
        callerFile: callerFilePath,
        callName,
        objectOrModule,
        line: call.line,
        resolved: false
      });
    }
  }

  // Iterate over all function nodes and resolve their calls
  functionNodes.forEach(fn => {
    fn.rawCalls.forEach(call => {
      resolveCall(fn, call);
    });
    // Remove raw calls from final node to keep JSON clean
    delete fn.rawCalls;
  });

  return {
    functionNodes,
    callEdges,
    unresolvedCalls
  };
}

module.exports = {
  buildCallGraph,
  functionId
};
