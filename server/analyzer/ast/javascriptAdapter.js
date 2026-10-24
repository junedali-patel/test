// server/analyzer/ast/javascriptAdapter.js
// JavaScript AST parser translating JavaScript source code into Common Intermediate Representation (IR)

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
  createThrow,
  createSwitch
} = require('../ir/irTypes');

/**
 * Extracts balanced curly brace block from an array of lines starting at startLineIdx
 */
function extractBraceBlock(lines, startLineIdx) {
  let depth = 0;
  let blockStarted = false;
  const blockLines = [];
  let endLineIdx = startLineIdx;

  for (let i = startLineIdx; i < lines.length; i++) {
    const line = lines[i];
    const openCount = (line.text.match(/\{/g) || []).length;
    const closeCount = (line.text.match(/\}/g) || []).length;

    if (openCount > 0) {
      blockStarted = true;
    }

    depth += openCount - closeCount;

    if (blockStarted) {
      blockLines.push(line);
      if (depth <= 0) {
        endLineIdx = i;
        break;
      }
    }
  }

  return { blockLines, endLineIdx };
}

/**
 * Parse lines into Common IR nodes
 */
function parseJsLines(lines, functions = [], classes = []) {
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const text = line.text;
    const lineNum = line.lineNum;

    if (!text || text === '}' || text === '{') {
      i++;
      continue;
    }

    // 1. IF statement & ELSE IF / ELSE
    const ifMatch = text.match(/^if\s*\((.*?)\)/);
    if (ifMatch) {
      const condition = ifMatch[1];
      const { blockLines, endLineIdx } = extractBraceBlock(lines, i);

      // Remove outer opening and closing braces from true branch lines
      const trueInnerLines = blockLines.slice(1, -1);
      const trueBranch = parseJsLines(trueInnerLines, functions, classes);
      let falseBranch = [];

      let nextIdx = endLineIdx + 1;
      if (nextIdx < lines.length) {
        const nextText = lines[nextIdx].text;
        const elseIfMatch = nextText.match(/^else\s+if\s*\((.*?)\)/);
        const elseMatch = nextText.match(/^else\s*(?:\{|$)/);

        if (elseIfMatch) {
          // Recurse into else-if
          const subLines = lines.slice(nextIdx);
          const subNodes = parseJsLines(subLines, functions, classes);
          if (subNodes.length > 0) {
            falseBranch.push(subNodes[0]);
            nextIdx += 1;
          }
        } else if (elseMatch) {
          const { blockLines: elseBlockLines, endLineIdx: elseEndIdx } = extractBraceBlock(lines, nextIdx);
          const elseInnerLines = elseBlockLines.slice(1, -1);
          falseBranch = parseJsLines(elseInnerLines, functions, classes);
          nextIdx = elseEndIdx + 1;
        }
      }

      nodes.push(createDecision(condition, trueBranch, falseBranch, lineNum, lineNum));
      i = nextIdx;
      continue;
    }

    // 2. FOR loop
    const forMatch = text.match(/^for\s*\((.*?)\)/);
    if (forMatch) {
      const condition = forMatch[1];
      const { blockLines, endLineIdx } = extractBraceBlock(lines, i);
      const innerLines = blockLines.slice(1, -1);
      const body = parseJsLines(innerLines, functions, classes);

      nodes.push(createLoop('for', condition, body, lineNum, lineNum));
      i = endLineIdx + 1;
      continue;
    }

    // 3. WHILE loop
    const whileMatch = text.match(/^while\s*\((.*?)\)/);
    if (whileMatch) {
      const condition = whileMatch[1];
      const { blockLines, endLineIdx } = extractBraceBlock(lines, i);
      const innerLines = blockLines.slice(1, -1);
      const body = parseJsLines(innerLines, functions, classes);

      nodes.push(createLoop('while', condition, body, lineNum, lineNum));
      i = endLineIdx + 1;
      continue;
    }

    // 4. FUNCTION definition
    const funcMatch =
      text.match(/^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\((.*?)\)/) ||
      text.match(/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>/) ||
      text.match(/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*function(?:\s+[a-zA-Z0-9_$]+)?\s*\((.*?)\)/);

    if (funcMatch && !['if', 'for', 'while', 'switch', 'catch'].includes(funcMatch[1])) {
      const funcName = funcMatch[1];
      const rawParams = funcMatch[2] || '';
      const params = rawParams
        ? rawParams.split(',').map(p => p.trim().split(/[=:]/)[0].trim()).filter(Boolean)
        : [];

      const { blockLines, endLineIdx } = extractBraceBlock(lines, i);
      const innerLines = blockLines.slice(1, -1);
      const body = parseJsLines(innerLines, functions, classes);

      const funcNode = createFunctionDef(funcName, params, body, lineNum, lines[endLineIdx]?.lineNum || lineNum);
      functions.push(funcNode);
      nodes.push(funcNode);
      i = endLineIdx + 1;
      continue;
    }

    // 5. CLASS definition
    const classMatch = text.match(/^(?:export\s+)?class\s+([a-zA-Z0-9_$]+)(?:\s+extends\s+([a-zA-Z0-9_$]+))?/);
    if (classMatch) {
      const className = classMatch[1];
      const { blockLines, endLineIdx } = extractBraceBlock(lines, i);
      const innerLines = blockLines.slice(1, -1);
      const classBody = parseJsLines(innerLines, functions, classes);

      classes.push({ name: className, lineStart: lineNum, lineEnd: lines[endLineIdx]?.lineNum || lineNum, body: classBody });
      i = endLineIdx + 1;
      continue;
    }

    // 6. RETURN statement
    if (text.startsWith('return ') || text === 'return;' || text === 'return') {
      const value = text.replace(/^return\s*/, '').replace(/;$/, '');
      nodes.push(createReturn(value, lineNum, lineNum));
      i++;
      continue;
    }

    // 7. BREAK & CONTINUE
    if (text.startsWith('break')) {
      nodes.push(createBreak(lineNum, lineNum));
      i++;
      continue;
    }
    if (text.startsWith('continue')) {
      nodes.push(createContinue(lineNum, lineNum));
      i++;
      continue;
    }

    // 7.5. SWITCH statement
    const switchMatch = text.match(/^switch\s*\((.*?)\)/);
    if (switchMatch) {
      const discriminant = switchMatch[1];
      const { blockLines, endLineIdx } = extractBraceBlock(lines, i);
      const innerLines = blockLines.slice(1, -1);
      const cases = [];
      let caseIdx = 0;
      while (caseIdx < innerLines.length) {
        const cl = innerLines[caseIdx];
        if (!cl.text) { caseIdx++; continue; }
        const caseMatch = cl.text.match(/^case\s+(.*?)\s*:/) || cl.text.match(/^(default)\s*:/);
        if (caseMatch) {
          const caseLabel = cl.text.startsWith('default') ? 'default' : caseMatch[1];
          caseIdx++;
          const caseBodyLines = [];
          while (caseIdx < innerLines.length) {
            const bl = innerLines[caseIdx];
            if (bl.text.match(/^case\s+/) || bl.text.match(/^default\s*:/)) break;
            caseBodyLines.push(bl);
            caseIdx++;
          }
          const hasBreak = caseBodyLines.some(l => l.text.startsWith('break'));
          const bodyWithoutBreak = caseBodyLines.filter(l => !l.text.startsWith('break'));
          const body = parseJsLines(bodyWithoutBreak, functions, classes);
          cases.push({ label: `case ${caseLabel}`, body, hasBreak });
        } else {
          caseIdx++;
        }
      }
      nodes.push(createSwitch(discriminant, cases, lineNum, lines[endLineIdx]?.lineNum || lineNum));
      i = endLineIdx + 1;
      continue;
    }

    // 8. TRY / CATCH / FINALLY
    if (text.startsWith('try')) {
      const { blockLines: tryBlockLines, endLineIdx: tryEndIdx } = extractBraceBlock(lines, i);
      const tryBody = parseJsLines(tryBlockLines.slice(1, -1), functions, classes);

      let nextIdx = tryEndIdx + 1;
      const catchBlocks = [];
      let finallyBlock = [];

      if (nextIdx < lines.length) {
        const catchMatch = lines[nextIdx].text.match(/^catch\s*(?:\((.*?)\))?/);
        if (catchMatch) {
          const { blockLines: catchBlockLines, endLineIdx: catchEndIdx } = extractBraceBlock(lines, nextIdx);
          const catchBody = parseJsLines(catchBlockLines.slice(1, -1), functions, classes);
          catchBlocks.push({ param: catchMatch[1] || 'error', body: catchBody });
          nextIdx = catchEndIdx + 1;
        }

        if (nextIdx < lines.length && lines[nextIdx].text.startsWith('finally')) {
          const { blockLines: finBlockLines, endLineIdx: finEndIdx } = extractBraceBlock(lines, nextIdx);
          finallyBlock = parseJsLines(finBlockLines.slice(1, -1), functions, classes);
          nextIdx = finEndIdx + 1;
        }
      }

      nodes.push(createTryCatch(tryBody, catchBlocks, finallyBlock, lineNum, lineNum));
      i = nextIdx;
      continue;
    }

    // 9. THROW
    if (text.startsWith('throw ')) {
      nodes.push(createThrow(text.replace(/^throw\s*/, '').replace(/;$/, ''), lineNum, lineNum));
      i++;
      continue;
    }

    // 10. OUTPUT & INPUT
    if (/console\.(?:log|warn|error|info)\s*\(/.test(text)) {
      nodes.push(createOutput(text.replace(/;$/, ''), lineNum, lineNum));
      i++;
      continue;
    }
    if (/prompt\s*\(|readline\s*\(/.test(text)) {
      nodes.push(createInput(text.replace(/;$/, ''), lineNum, lineNum));
      i++;
      continue;
    }

    // 11. FUNCTION CALL
    const callMatch = text.match(/^(?:await\s+)?([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)\s*\((.*?)\);?$/);
    if (callMatch && !['if', 'for', 'while', 'switch', 'catch', 'require'].includes(callMatch[1])) {
      const fullCall = callMatch[1];
      const parts = fullCall.split('.');
      const funcName = parts.pop();
      const target = parts.length > 0 ? parts.join('.') : null;
      nodes.push(createFunctionCall(funcName, [callMatch[2]], target, text.replace(/;$/, ''), lineNum, lineNum));
      i++;
      continue;
    }

    // 12. Standard PROCESS
    nodes.push(createProcess(text.replace(/;$/, ''), lineNum, lineNum));
    i++;
  }

  return nodes;
}

/**
 * Parses JavaScript source code into Common IR nodes
 * @param {string} code - JavaScript source code
 * @returns {{ irNodes: Array, functions: Array, classes: Array }}
 */
function parseJavaScriptToIR(code = '') {
  const rawLines = code.split(/\r?\n/);
  const cleanLines = rawLines.map((raw, idx) => {
    let text = raw;
    // Strip single line comments
    const commentIdx = text.indexOf('//');
    if (commentIdx !== -1) {
      text = text.substring(0, commentIdx);
    }
    // Normalize: split `} catch` and `} finally` onto separate lines so
    // extractBraceBlock sees a clean `}` closing the try block
    text = text.replace(/\}\s*catch\s*/, '}\ncatch ');
    text = text.replace(/\}\s*finally\s*/, '}\nfinally ');
    // Normalize: split `} else` onto separate lines too
    text = text.replace(/\}\s*else\s+if\s*/, '}\nelse if ');
    text = text.replace(/\}\s*else\s*\{/, '}\nelse {');
    return {
      lineNum: idx + 1,
      text: text.trim()
    };
  })
  // Re-flatten multi-line replacements
  .flatMap(item => {
    if (item.text.includes('\n')) {
      return item.text.split('\n').map(t => ({ lineNum: item.lineNum, text: t.trim() }));
    }
    return [item];
  })
  .filter(l => l.text !== '');

  const functions = [];
  const classes = [];
  const irNodes = parseJsLines(cleanLines, functions, classes);

  return {
    irNodes,
    functions,
    classes
  };
}

module.exports = {
  parseJavaScriptToIR
};
