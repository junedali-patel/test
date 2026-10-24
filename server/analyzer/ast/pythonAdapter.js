// server/analyzer/ast/pythonAdapter.js
// Python AST parser translating Python source code into Common Intermediate Representation (IR)

const {
  createProcess,
  createDecision,
  createLoop,
  createInput,
  createOutput,
  createFunctionDef,
  createFunctionCall,
  createReturn,
  createBreak,
  createContinue,
  createTryCatch,
  createThrow
} = require('../ir/irTypes');

/**
 * Parses Python source code into Common IR nodes
 * @param {string} code - Python source code
 * @returns {{ irNodes: Array, functions: Array, classes: Array }}
 */
function parsePythonToIR(code = '') {
  const lines = code.split(/\r?\n/);
  const functions = [];
  const classes = [];

  // Pre-process lines: strip comments, compute indentations
  const parsedLines = lines.map((raw, idx) => {
    let text = raw;
    // Strip trailing single-line comment
    const commentIdx = text.indexOf('#');
    if (commentIdx !== -1) {
      // Ensure not inside string
      const beforeComment = text.substring(0, commentIdx);
      const singleQuotes = (beforeComment.match(/'/g) || []).length;
      const doubleQuotes = (beforeComment.match(/"/g) || []).length;
      if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
        text = beforeComment;
      }
    }

    const trimmed = text.trim();
    const indent = text.search(/\S/);
    return {
      lineNum: idx + 1,
      text: trimmed,
      indent: indent >= 0 ? indent : 0,
      isEmpty: trimmed.length === 0
    };
  });

  /**
   * Recursive block parser by indentation
   */
  function parseBlock(startIdx, minIndent) {
    const nodes = [];
    let i = startIdx;

    while (i < parsedLines.length) {
      const line = parsedLines[i];
      if (line.isEmpty) {
        i++;
        continue;
      }

      // If indentation drops below expected minIndent, we've exited this block
      if (line.indent < minIndent) {
        break;
      }

      const text = line.text;
      const lineNum = line.lineNum;

      // 1. IF statement & ELIF / ELSE
      const ifMatch = text.match(/^if\s+(.+?)\s*:$/);
      if (ifMatch) {
        const condition = ifMatch[1];
        const nextIndent = findNextBlockIndent(i + 1, line.indent);
        const { nodes: trueBranch, nextIdx } = parseBlock(i + 1, nextIndent);
        i = nextIdx;

        // Check for chained elif / else at same indentation
        let falseBranch = [];
        let currIdx = i;

        while (currIdx < parsedLines.length) {
          const checkLine = parsedLines[currIdx];
          if (checkLine.isEmpty) {
            currIdx++;
            continue;
          }
          if (checkLine.indent !== line.indent) break;

          const elifMatch = checkLine.text.match(/^elif\s+(.+?)\s*:$/);
          const elseMatch = checkLine.text.match(/^else\s*:$/);

          if (elifMatch) {
            const elifCond = elifMatch[1];
            const elifBlockIndent = findNextBlockIndent(currIdx + 1, checkLine.indent);
            const { nodes: elifTrue, nextIdx: afterElif } = parseBlock(currIdx + 1, elifBlockIndent);
            const nestedDecision = createDecision(elifCond, elifTrue, [], checkLine.lineNum, checkLine.lineNum);
            falseBranch.push(nestedDecision);
            currIdx = afterElif;
          } else if (elseMatch) {
            const elseBlockIndent = findNextBlockIndent(currIdx + 1, checkLine.indent);
            const { nodes: elseNodes, nextIdx: afterElse } = parseBlock(currIdx + 1, elseBlockIndent);
            if (falseBranch.length > 0 && falseBranch[falseBranch.length - 1].type === 'decision') {
              falseBranch[falseBranch.length - 1].falseBranch = elseNodes;
            } else {
              falseBranch = elseNodes;
            }
            currIdx = afterElse;
            break;
          } else {
            break;
          }
        }

        i = currIdx;
        nodes.push(createDecision(condition, trueBranch, falseBranch, lineNum, lineNum));
        continue;
      }

      // 2. FOR loop
      const forMatch = text.match(/^for\s+(.+?)\s+in\s+(.+?)\s*:$/);
      if (forMatch) {
        const condition = `${forMatch[1]} in ${forMatch[2]}`;
        const nextIndent = findNextBlockIndent(i + 1, line.indent);
        const { nodes: body, nextIdx } = parseBlock(i + 1, nextIndent);
        i = nextIdx;
        nodes.push(createLoop('for', condition, body, lineNum, lineNum));
        continue;
      }

      // 3. WHILE loop
      const whileMatch = text.match(/^while\s+(.+?)\s*:$/);
      if (whileMatch) {
        const condition = whileMatch[1];
        const nextIndent = findNextBlockIndent(i + 1, line.indent);
        const { nodes: body, nextIdx } = parseBlock(i + 1, nextIndent);
        i = nextIdx;
        nodes.push(createLoop('while', condition, body, lineNum, lineNum));
        continue;
      }

      // 4. FUNCTION definition
      const defMatch = text.match(/^(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\((.*?)\)\s*:$/);
      if (defMatch) {
        const funcName = defMatch[1];
        const rawParams = defMatch[2];
        const params = rawParams
          ? rawParams.split(',').map(p => p.trim().split(/[=:]/)[0].trim()).filter(Boolean)
          : [];

        const nextIndent = findNextBlockIndent(i + 1, line.indent);
        const { nodes: body, nextIdx } = parseBlock(i + 1, nextIndent);
        const endLine = nextIdx > i + 1 ? parsedLines[nextIdx - 1].lineNum : lineNum;

        const funcNode = createFunctionDef(funcName, params, body, lineNum, endLine);
        functions.push(funcNode);
        nodes.push(funcNode);
        i = nextIdx;
        continue;
      }

      // 5. CLASS definition
      const classMatch = text.match(/^class\s+([a-zA-Z_]\w*)(?:\((.*?)\))?\s*:$/);
      if (classMatch) {
        const className = classMatch[1];
        const nextIndent = findNextBlockIndent(i + 1, line.indent);
        const { nodes: classBody, nextIdx } = parseBlock(i + 1, nextIndent);
        const endLine = nextIdx > i + 1 ? parsedLines[nextIdx - 1].lineNum : lineNum;

        classes.push({ name: className, lineStart: lineNum, lineEnd: endLine, body: classBody });
        i = nextIdx;
        continue;
      }

      // 6. RETURN statement
      if (text.startsWith('return ') || text === 'return') {
        const value = text.replace(/^return\s*/, '');
        nodes.push(createReturn(value, lineNum, lineNum));
        i++;
        continue;
      }

      // 7. BREAK & CONTINUE
      if (text === 'break') {
        nodes.push(createBreak(lineNum, lineNum));
        i++;
        continue;
      }
      if (text === 'continue') {
        nodes.push(createContinue(lineNum, lineNum));
        i++;
        continue;
      }

      // 8. TRY / EXCEPT
      if (text === 'try:') {
        const nextIndent = findNextBlockIndent(i + 1, line.indent);
        const { nodes: tryBody, nextIdx } = parseBlock(i + 1, nextIndent);
        i = nextIdx;

        const catchBlocks = [];
        let finallyBlock = [];

        while (i < parsedLines.length) {
          const nextLine = parsedLines[i];
          if (nextLine.isEmpty) { i++; continue; }
          if (nextLine.indent !== line.indent) break;

          const exceptMatch = nextLine.text.match(/^except(?:\s+(.+?))?\s*:$/);
          const finallyMatch = nextLine.text.match(/^finally\s*:$/);

          if (exceptMatch) {
            const excIndent = findNextBlockIndent(i + 1, nextLine.indent);
            const { nodes: excBody, nextIdx: afterExc } = parseBlock(i + 1, excIndent);
            catchBlocks.push({ param: exceptMatch[1] || 'Exception', body: excBody });
            i = afterExc;
          } else if (finallyMatch) {
            const finIndent = findNextBlockIndent(i + 1, nextLine.indent);
            const { nodes: finBody, nextIdx: afterFin } = parseBlock(i + 1, finIndent);
            finallyBlock = finBody;
            i = afterFin;
            break;
          } else {
            break;
          }
        }

        nodes.push(createTryCatch(tryBody, catchBlocks, finallyBlock, lineNum, lineNum));
        continue;
      }

      // 9. RAISE (Throw)
      if (text.startsWith('raise ') || text === 'raise') {
        nodes.push(createThrow(text.replace(/^raise\s*/, ''), lineNum, lineNum));
        i++;
        continue;
      }

      // 10. INPUT / OUTPUT
      if (/^print\s*\(/.test(text)) {
        nodes.push(createOutput(text, lineNum, lineNum));
        i++;
        continue;
      }
      if (/input\s*\(/.test(text)) {
        nodes.push(createInput(text, lineNum, lineNum));
        i++;
        continue;
      }

      // 11. FUNCTION CALL
      const callMatch = text.match(/^([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)\s*\((.*?)\)$/);
      if (callMatch && !['print', 'input', 'len', 'range', 'str', 'int'].includes(callMatch[1])) {
        const fullCall = callMatch[1];
        const parts = fullCall.split('.');
        const funcName = parts.pop();
        const target = parts.length > 0 ? parts.join('.') : null;
        nodes.push(createFunctionCall(funcName, [callMatch[2]], target, text, lineNum, lineNum));
        i++;
        continue;
      }

      // 12. Standard PROCESS (assignment, expression)
      nodes.push(createProcess(text, lineNum, lineNum));
      i++;
    }

    return { nodes, nextIdx: i };
  }

  function findNextBlockIndent(startIdx, parentIndent) {
    for (let j = startIdx; j < parsedLines.length; j++) {
      if (!parsedLines[j].isEmpty && parsedLines[j].indent > parentIndent) {
        return parsedLines[j].indent;
      }
    }
    return parentIndent + 4;
  }

  const { nodes: irNodes } = parseBlock(0, 0);

  return {
    irNodes,
    functions,
    classes
  };
}

module.exports = {
  parsePythonToIR
};
