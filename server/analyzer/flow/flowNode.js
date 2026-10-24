// server/analyzer/flow/flowNode.js
// Factory for creating standardized Flowchart nodes with source line numbers

let nodeCounter = 1;

function resetNodeCounter() {
  nodeCounter = 1;
}

function nextNodeId(prefix = 'node') {
  return `${prefix}_${nodeCounter++}`;
}

/**
 * Produces a short, human-readable label from a raw source string.
 * @param {string} type - IR node type (DECISION, LOOP, PROCESS, etc.)
 * @param {string} rawCode - Raw source expression or statement
 * @returns {string} Short label
 */
function generateLabel(type, rawCode) {
  const src = (rawCode || '').trim();
  const upperType = (type || '').toUpperCase();

  if (upperType === 'FUNCTION_DEF') {
    const m = src.match(/^(\w+)\s*\(/);
    return m ? `Function: ${m[1]}` : `Function: ${src.slice(0, 30)}`;
  }

  if (upperType === 'FUNCTION_CALL' || upperType === 'function_call'.toUpperCase()) {
    const m = src.match(/^(\w+)\s*\(/);
    return m ? `Call: ${m[1]}` : `Call: ${src.slice(0, 30)}`;
  }

  if (upperType === 'RETURN') {
    const val = src.replace(/^return\s*/i, '').trim();
    return val ? `Return ${val.slice(0, 40)}` : 'Return';
  }

  if (upperType === 'INPUT') {
    return 'Read Input';
  }

  if (upperType === 'OUTPUT') {
    return 'Print Output';
  }

  if (upperType === 'DECISION') {
    const cond = src.replace(/\?$/, '').trim().slice(0, 40);
    return `Check: ${cond}`;
  }

  if (upperType === 'LOOP') {
    return `Loop: ${src.slice(0, 40)}`;
  }

  // Assignment heuristics (PROCESS / generic)
  if (upperType === 'PROCESS' || upperType === '') {
    // Calc pattern: variable name contains total/sum/count/result/avg/score
    const assignMatch = src.match(/^([A-Za-z_$][\w$]*)\s*[+\-*/%]?=/);
    if (assignMatch) {
      const varName = assignMatch[1];
      if (/(total|sum|count|result|avg|average|score)/i.test(varName)) {
        return `Calculate ${varName}`;
      }
      // Check it's not == / != / <= / >=
      if (!/[!<>=]=[^=]/.test(src) && !/==/.test(src)) {
        return `Set ${varName}`;
      }
    }
  }

  // Fallback: first 50 chars
  return src.slice(0, 50) || type || 'Statement';
}

/**
 * Creates a flowchart node with line mappings
 * @param {Object} options
 * @param {string} options.type - 'start' | 'end' | 'process' | 'decision' | 'input' | 'output' | 'function' | 'loop' | 'return' | 'error'
 * @param {string} options.label - Display text
 * @param {string} [options.code=''] - Raw source code for this node
 * @param {string} options.file - Filename or relative path
 * @param {number} [options.lineStart=1] - Starting line
 * @param {number} [options.lineEnd=1] - Ending line
 * @param {string} [options.id] - Optional custom ID
 * @returns {Object} FlowNode
 */
function createFlowNode({
  type = 'process',
  label = '',
  code = '',
  file = 'main.py',
  lineStart = 1,
  lineEnd = 1,
  id = null,
  data = {}
}) {
  return {
    id: id || nextNodeId('node'),
    type: type.toLowerCase(),
    label: label.trim(),
    code: code || '',
    file,
    lineStart: lineStart || 1,
    lineEnd: lineEnd || lineStart || 1,
    data
  };
}

module.exports = {
  createFlowNode,
  resetNodeCounter,
  nextNodeId,
  generateLabel
};
