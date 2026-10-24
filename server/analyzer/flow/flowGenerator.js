// server/analyzer/flow/flowGenerator.js
// Translates Common Intermediate Representation (IR) into deterministic Flowchart Nodes and Edges

const { createFlowNode, resetNodeCounter, generateLabel } = require('./flowNode');
const { createFlowEdge, resetEdgeCounter } = require('./flowEdge');
const { IR_TYPES } = require('../ir/irTypes');

/**
 * Recursively counts the number of IR nodes in a sequence (for collapse threshold).
 * @param {Array} ir
 * @returns {number}
 */
function countIRNodes(ir = []) {
  let n = ir.length;
  for (const item of ir) {
    if (item.body) n += countIRNodes(item.body);
    if (item.trueBranch) n += countIRNodes(item.trueBranch);
    if (item.falseBranch) n += countIRNodes(item.falseBranch);
  }
  return n;
}

/**
 * Generates flowchart graph from Common IR representation
 * @param {Object} options
 * @param {Array<Object>} options.irNodes - IR statements array
 * @param {string} options.fileName - Source file name
 * @param {string} [options.functionName] - Optional function to focus on
 * @param {Array<Object>} [options.functions] - Detected function definitions
 * @param {string} [options.detail='standard'] - 'overview' | 'standard' | 'detailed'
 * @returns {{ nodes: Array, edges: Array }} Flowchart graph
 */
function generateFlowchartFromIR({
  irNodes = [],
  fileName = 'main.py',
  functionName = null,
  functions = [],
  detail = 'standard'
}) {
  resetNodeCounter();
  resetEdgeCounter();

  const nodes = [];
  const edges = [];

  // Determine starting line and ending line
  const firstLine = irNodes[0]?.lineStart || 1;
  const lastLine = irNodes[irNodes.length - 1]?.lineEnd || 1;

  // Filter for specific function if requested
  let activeIR = irNodes;
  let startLabel = 'START';

  if (functionName && functionName !== 'all') {
    const targetFunc = functions.find(f => f.name === functionName);
    if (targetFunc && Array.isArray(targetFunc.body) && targetFunc.body.length > 0) {
      activeIR = targetFunc.body;
      startLabel = `START: ${functionName}()`;
    }
  }

  // Handle empty code file
  if (!activeIR || activeIR.length === 0) {
    const startNode = createFlowNode({
      id: 'start',
      type: 'start',
      label: startLabel,
      code: '',
      file: fileName,
      lineStart: 1,
      lineEnd: 1
    });

    const emptyNode = createFlowNode({
      id: 'node_empty',
      type: 'process',
      label: 'Empty file / No execution statements',
      code: '',
      file: fileName,
      lineStart: 1,
      lineEnd: 1
    });

    const endNode = createFlowNode({
      id: 'end',
      type: 'end',
      label: 'END',
      code: '',
      file: fileName,
      lineStart: 1,
      lineEnd: 1
    });

    edges.push(createFlowEdge({ source: 'start', target: 'node_empty' }));
    edges.push(createFlowEdge({ source: 'node_empty', target: 'end' }));

    return {
      nodes: [startNode, emptyNode, endNode],
      edges
    };
  }

  // 1. Create START node
  const startNode = createFlowNode({
    id: 'start',
    type: 'start',
    label: startLabel,
    code: '',
    file: fileName,
    lineStart: firstLine,
    lineEnd: firstLine
  });
  nodes.push(startNode);

  // 2. Create END node (pushed at the end)
  const endNode = createFlowNode({
    id: 'end',
    type: 'end',
    label: 'END',
    code: '',
    file: fileName,
    lineStart: lastLine,
    lineEnd: lastLine
  });

  /**
   * Recursive IR Sequence Translator
   * @param {Array<Object>} sequence - Array of IR nodes
   * @param {Array<{ id: string, label?: string }>} incoming - Array of previous node IDs to connect from
   * @param {Object} loopContext - Context for break and continue
   * @returns {Array<{ id: string, label?: string }>} - Exit node IDs to connect to subsequent statements
   */
  function translateSequence(sequence, incoming, loopContext = null) {
    let currentIncoming = incoming;

    for (let idx = 0; idx < sequence.length; idx++) {
      const item = sequence[idx];
      if (!item) continue;

      switch (item.type) {
        // --- PROCESS / STATEMENT ---
        case IR_TYPES.PROCESS: {
          // In overview mode, skip PROCESS entirely
          if (detail === 'overview') break;

          if (detail === 'standard') {
            // Collect consecutive PROCESS items starting at idx
            const run = [item];
            while (
              idx + run.length < sequence.length &&
              sequence[idx + run.length]?.type === IR_TYPES.PROCESS
            ) {
              run.push(sequence[idx + run.length]);
            }

            if (run.length >= 2) {
              // Emit one merged node
              const label = `Statements (${run.length})`;
              const rawCode = run[0].label || '';
              const procNode = createFlowNode({
                type: 'process',
                label,
                code: rawCode,
                file: fileName,
                lineStart: run[0].lineStart,
                lineEnd: run[run.length - 1].lineEnd
              });
              nodes.push(procNode);
              currentIncoming.forEach(inc =>
                edges.push(createFlowEdge({ source: inc.id, target: procNode.id, label: inc.label || null }))
              );
              currentIncoming = [{ id: procNode.id }];
              idx += run.length - 1; // compensate; loop will +1
              break;
            }
            // Single PROCESS in standard — fall through to emit normally
          }

          // detailed mode OR single PROCESS in standard
          const rawCode = item.label || '';
          const procNode = createFlowNode({
            type: 'process',
            label: generateLabel('PROCESS', rawCode),
            code: rawCode,
            file: fileName,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd
          });
          nodes.push(procNode);
          currentIncoming.forEach(inc =>
            edges.push(createFlowEdge({ source: inc.id, target: procNode.id, label: inc.label || null }))
          );
          currentIncoming = [{ id: procNode.id }];
          break;
        }

        // --- INPUT ---
        case IR_TYPES.INPUT: {
          if (detail === 'overview') break;

          const rawExpr = item.expression || item.label || '';
          const inNode = createFlowNode({
            type: 'input',
            label: generateLabel('INPUT', rawExpr),
            code: rawExpr,
            file: fileName,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd
          });
          nodes.push(inNode);
          currentIncoming.forEach(inc =>
            edges.push(createFlowEdge({ source: inc.id, target: inNode.id, label: inc.label || null }))
          );
          currentIncoming = [{ id: inNode.id }];
          break;
        }

        // --- OUTPUT ---
        case IR_TYPES.OUTPUT: {
          if (detail === 'overview') break;

          const rawExpr = item.expression || item.label || '';
          const outNode = createFlowNode({
            type: 'output',
            label: generateLabel('OUTPUT', rawExpr),
            code: rawExpr,
            file: fileName,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd
          });
          nodes.push(outNode);
          currentIncoming.forEach(inc =>
            edges.push(createFlowEdge({ source: inc.id, target: outNode.id, label: inc.label || null }))
          );
          currentIncoming = [{ id: outNode.id }];
          break;
        }

        // --- FUNCTION CALL ---
        case IR_TYPES.FUNCTION_CALL: {
          if (detail === 'overview') break;

          const rawLabel = item.label || '';
          const callNode = createFlowNode({
            type: 'function',
            label: generateLabel('FUNCTION_CALL', rawLabel),
            code: rawLabel,
            file: fileName,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd
          });
          nodes.push(callNode);
          currentIncoming.forEach(inc =>
            edges.push(createFlowEdge({ source: inc.id, target: callNode.id, label: inc.label || 'CALLS' }))
          );
          currentIncoming = [{ id: callNode.id }];
          break;
        }

        // --- FUNCTION DEFINITION ---
        case IR_TYPES.FUNCTION_DEF: {
          const funcLabel = `${item.name}(${(item.params || []).join(', ')})`;
          const funcDefNode = createFlowNode({
            type: 'function',
            label: generateLabel('FUNCTION_DEF', funcLabel),
            code: funcLabel,
            file: fileName,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd
          });
          nodes.push(funcDefNode);
          currentIncoming.forEach(inc =>
            edges.push(createFlowEdge({ source: inc.id, target: funcDefNode.id, label: inc.label || null }))
          );
          currentIncoming = [{ id: funcDefNode.id }];

          // In overview mode: emit the def node only, don't recurse
          if (detail === 'overview') break;

          // Collapse if adding body would exceed 80 total nodes
          const bodySize = countIRNodes(item.body || []);
          if (nodes.length + bodySize > 80) {
            // Collapsed — do not recurse
            break;
          }

          // Recurse into body
          if (Array.isArray(item.body) && item.body.length > 0) {
            const bodyExits = translateSequence(item.body, [{ id: funcDefNode.id }], loopContext);
            currentIncoming = bodyExits;
          }
          break;
        }

        // --- DECISION (IF / ELSE IF / ELSE) ---
        case IR_TYPES.DECISION: {
          const rawCond = item.condition || '';
          const decisionNode = createFlowNode({
            type: 'decision',
            label: generateLabel('DECISION', rawCond),
            code: rawCond,
            file: fileName,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd
          });
          nodes.push(decisionNode);
          currentIncoming.forEach(inc =>
            edges.push(createFlowEdge({ source: inc.id, target: decisionNode.id, label: inc.label || null }))
          );

          // Translate TRUE branch (YES)
          const trueExits = translateSequence(
            item.trueBranch || [],
            [{ id: decisionNode.id, label: 'YES' }],
            loopContext
          );

          // Translate FALSE branch (NO)
          let falseExits = [];
          if (Array.isArray(item.falseBranch) && item.falseBranch.length > 0) {
            falseExits = translateSequence(
              item.falseBranch,
              [{ id: decisionNode.id, label: 'NO' }],
              loopContext
            );
          } else {
            falseExits = [{ id: decisionNode.id, label: 'NO' }];
          }

          currentIncoming = [...trueExits, ...falseExits];
          break;
        }

        // --- LOOP (FOR / WHILE / DO_WHILE) ---
        case IR_TYPES.LOOP: {
          if (item.loopType === 'for' && item.forInit) {
            // --- Decomposed FOR loop ---
            // 1. Init node
            const initRaw = item.forInit || '';
            const initNode = createFlowNode({
              type: 'process',
              label: generateLabel('PROCESS', initRaw),
              code: initRaw,
              file: fileName,
              lineStart: item.lineStart,
              lineEnd: item.lineStart
            });
            nodes.push(initNode);
            currentIncoming.forEach(inc =>
              edges.push(createFlowEdge({ source: inc.id, target: initNode.id, label: inc.label || null }))
            );

            // 2. Condition (loop) node
            const loopCondLabel = item.forCond || item.condition || '';
            const loopCondNode = createFlowNode({
              type: 'loop',
              label: generateLabel('LOOP', loopCondLabel),
              code: loopCondLabel,
              file: fileName,
              lineStart: item.lineStart,
              lineEnd: item.lineEnd
            });
            nodes.push(loopCondNode);
            edges.push(createFlowEdge({ source: initNode.id, target: loopCondNode.id }));

            const breakExits = [];
            const currentLoopCtx = { loopNodeId: loopCondNode.id, breakExits };

            const bodyExits = translateSequence(
              item.body || [],
              [{ id: loopCondNode.id, label: 'YES' }],
              currentLoopCtx
            );

            if (item.forUpdate) {
              const updateRaw = item.forUpdate || '';
              const updateNode = createFlowNode({
                type: 'process',
                label: generateLabel('PROCESS', updateRaw),
                code: updateRaw,
                file: fileName,
                lineStart: item.lineEnd,
                lineEnd: item.lineEnd
              });
              nodes.push(updateNode);
              bodyExits.forEach(bExit =>
                edges.push(createFlowEdge({ source: bExit.id, target: updateNode.id, label: bExit.label || null }))
              );
              edges.push(createFlowEdge({ source: updateNode.id, target: loopCondNode.id, label: 'LOOP', type: 'LOOP' }));
            } else {
              bodyExits.forEach(bExit =>
                edges.push(createFlowEdge({ source: bExit.id, target: loopCondNode.id, label: 'LOOP', type: 'LOOP' }))
              );
            }

            currentIncoming = [
              { id: loopCondNode.id, label: 'NO' },
              ...breakExits
            ];
          } else {
            // --- WHILE / DO_WHILE ---
            const loopCond = item.condition || '';
            const loopNode = createFlowNode({
              type: 'loop',
              label: generateLabel('LOOP', loopCond),
              code: loopCond,
              file: fileName,
              lineStart: item.lineStart,
              lineEnd: item.lineEnd
            });
            nodes.push(loopNode);
            currentIncoming.forEach(inc =>
              edges.push(createFlowEdge({ source: inc.id, target: loopNode.id, label: inc.label || null }))
            );

            const breakExits = [];
            const currentLoopCtx = { loopNodeId: loopNode.id, breakExits };

            const bodyExits = translateSequence(
              item.body || [],
              [{ id: loopNode.id, label: 'YES' }],
              currentLoopCtx
            );

            bodyExits.forEach(bExit =>
              edges.push(createFlowEdge({ source: bExit.id, target: loopNode.id, label: 'LOOP', type: 'LOOP' }))
            );

            currentIncoming = [
              { id: loopNode.id, label: 'NO' },
              ...breakExits
            ];
          }
          break;
        }

        // --- BREAK ---
        case IR_TYPES.BREAK: {
          if (detail === 'overview') break;

          const breakNode = createFlowNode({
            type: 'process',
            label: 'break',
            code: 'break',
            file: fileName,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd
          });
          nodes.push(breakNode);
          currentIncoming.forEach(inc =>
            edges.push(createFlowEdge({ source: inc.id, target: breakNode.id, label: inc.label || null }))
          );

          if (loopContext && loopContext.breakExits) {
            loopContext.breakExits.push({ id: breakNode.id });
          }
          currentIncoming = [];
          break;
        }

        // --- CONTINUE ---
        case IR_TYPES.CONTINUE: {
          if (detail === 'overview') break;

          const contNode = createFlowNode({
            type: 'process',
            label: 'continue',
            code: 'continue',
            file: fileName,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd
          });
          nodes.push(contNode);
          currentIncoming.forEach(inc =>
            edges.push(createFlowEdge({ source: inc.id, target: contNode.id, label: inc.label || null }))
          );

          if (loopContext && loopContext.loopNodeId) {
            edges.push(createFlowEdge({
              source: contNode.id,
              target: loopContext.loopNodeId,
              label: 'LOOP',
              type: 'LOOP'
            }));
          }
          currentIncoming = [];
          break;
        }

        // --- RETURN ---
        case IR_TYPES.RETURN: {
          const retVal = item.value || '';
          const returnNode = createFlowNode({
            type: 'return',
            label: generateLabel('RETURN', `return ${retVal}`.trim()),
            code: `return ${retVal}`.trim(),
            file: fileName,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd
          });
          nodes.push(returnNode);
          currentIncoming.forEach(inc =>
            edges.push(createFlowEdge({ source: inc.id, target: returnNode.id, label: inc.label || null }))
          );

          edges.push(createFlowEdge({
            source: returnNode.id,
            target: 'end',
            label: 'RETURN',
            type: 'RETURN'
          }));

          currentIncoming = [];
          break;
        }

        // --- THROW / ERROR ---
        case IR_TYPES.THROW: {
          const throwExpr = item.expression || '';
          const throwNode = createFlowNode({
            type: 'error',
            label: `throw ${throwExpr}`,
            code: `throw ${throwExpr}`,
            file: fileName,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd
          });
          nodes.push(throwNode);
          currentIncoming.forEach(inc =>
            edges.push(createFlowEdge({ source: inc.id, target: throwNode.id, label: inc.label || 'ERROR' }))
          );

          edges.push(createFlowEdge({
            source: throwNode.id,
            target: 'end',
            label: 'ERROR',
            type: 'ERROR'
          }));

          currentIncoming = [];
          break;
        }

        // --- SWITCH / CASE ---
        case IR_TYPES.SWITCH: {
          const switchDisc = item.discriminant || '';
          const switchNode = createFlowNode({
            type: 'decision',
            label: `switch(${switchDisc})`,
            code: `switch(${switchDisc})`,
            file: fileName,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd
          });
          nodes.push(switchNode);
          currentIncoming.forEach(inc =>
            edges.push(createFlowEdge({ source: inc.id, target: switchNode.id, label: inc.label || null }))
          );

          const caseExits = [];
          (item.cases || []).forEach(caseItem => {
            const caseExitsLocal = translateSequence(
              caseItem.body || [],
              [{ id: switchNode.id, label: caseItem.label }],
              loopContext
            );
            caseExits.push(...caseExitsLocal);
          });

          const hasDefault = (item.cases || []).some(c => c.label === 'case default');
          if (!hasDefault) {
            caseExits.push({ id: switchNode.id, label: 'default' });
          }

          currentIncoming = caseExits;
          break;
        }

        // --- TRY / CATCH ---
        case IR_TYPES.TRY_CATCH: {
          const tryExits = translateSequence(
            item.tryBlock || [],
            currentIncoming,
            loopContext
          );

          let catchExits = [];
          if (Array.isArray(item.catchBlocks)) {
            item.catchBlocks.forEach(cb => {
              const catchNode = createFlowNode({
                type: 'error',
                label: `catch (${cb.param})`,
                code: `catch (${cb.param})`,
                file: fileName,
                lineStart: item.lineStart,
                lineEnd: item.lineEnd
              });
              nodes.push(catchNode);

              edges.push(createFlowEdge({
                source: tryExits[0]?.id || 'start',
                target: catchNode.id,
                label: 'ERROR',
                type: 'ERROR'
              }));

              const cExits = translateSequence(
                cb.body || [],
                [{ id: catchNode.id }],
                loopContext
              );
              catchExits.push(...cExits);
            });
          }

          let finallyExits = [];
          if (Array.isArray(item.finallyBlock) && item.finallyBlock.length > 0) {
            finallyExits = translateSequence(
              item.finallyBlock,
              [...tryExits, ...catchExits],
              loopContext
            );
            currentIncoming = finallyExits;
          } else {
            currentIncoming = [...tryExits, ...catchExits];
          }
          break;
        }

        default:
          break;
      }
    }

    return currentIncoming;
  }

  // Translate all statements starting from START node
  const finalExits = translateSequence(activeIR, [{ id: 'start' }]);

  // Connect remaining open paths to END node
  finalExits.forEach(exit => {
    edges.push(createFlowEdge({
      source: exit.id,
      target: 'end',
      label: exit.label || null
    }));
  });

  nodes.push(endNode);

  return { nodes, edges };
}

module.exports = {
  generateFlowchartFromIR
};
