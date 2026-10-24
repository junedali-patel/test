// server/analyzer/ir/irTypes.js
// Common Intermediate Representation (IR) specification for multi-language AST mapping

const IR_TYPES = {
  PROGRAM: 'program',
  PROCESS: 'process',
  DECISION: 'decision',
  LOOP: 'loop',
  INPUT: 'input',
  OUTPUT: 'output',
  FUNCTION_DEF: 'function_def',
  FUNCTION_CALL: 'function_call',
  RETURN: 'return',
  BREAK: 'break',
  CONTINUE: 'continue',
  TRY_CATCH: 'try_catch',
  THROW: 'throw',
  SWITCH: 'switch'
};

function createProcess(label, lineStart = 1, lineEnd = 1, details = {}) {
  return {
    type: IR_TYPES.PROCESS,
    label: label.trim(),
    lineStart,
    lineEnd,
    ...details
  };
}

function createDecision(condition, trueBranch = [], falseBranch = [], lineStart = 1, lineEnd = 1) {
  return {
    type: IR_TYPES.DECISION,
    condition: condition.trim(),
    trueBranch,
    falseBranch,
    lineStart,
    lineEnd
  };
}

function createLoop(loopType, condition, body = [], lineStart = 1, lineEnd = 1, forParts = {}) {
  return {
    type: IR_TYPES.LOOP,
    loopType, // 'for' | 'while' | 'do_while'
    condition: condition.trim(),
    body,
    lineStart,
    lineEnd,
    forInit: forParts.forInit || '',
    forCond: forParts.forCond || condition.trim(),
    forUpdate: forParts.forUpdate || ''
  };
}

function createInput(expression, lineStart = 1, lineEnd = 1) {
  return {
    type: IR_TYPES.INPUT,
    expression: expression.trim(),
    lineStart,
    lineEnd
  };
}

function createOutput(expression, lineStart = 1, lineEnd = 1) {
  return {
    type: IR_TYPES.OUTPUT,
    expression: expression.trim(),
    lineStart,
    lineEnd
  };
}

function createFunctionDef(name, params = [], body = [], lineStart = 1, lineEnd = 1) {
  return {
    type: IR_TYPES.FUNCTION_DEF,
    name,
    params,
    body,
    lineStart,
    lineEnd
  };
}

function createFunctionCall(name, args = [], target = null, label = '', lineStart = 1, lineEnd = 1) {
  return {
    type: IR_TYPES.FUNCTION_CALL,
    name,
    args,
    target,
    label: label || `${name}(${args.join(', ')})`,
    lineStart,
    lineEnd
  };
}

function createReturn(value = '', lineStart = 1, lineEnd = 1) {
  return {
    type: IR_TYPES.RETURN,
    value: value.trim(),
    lineStart,
    lineEnd
  };
}

function createBreak(lineStart = 1, lineEnd = 1) {
  return {
    type: IR_TYPES.BREAK,
    lineStart,
    lineEnd
  };
}

function createContinue(lineStart = 1, lineEnd = 1) {
  return {
    type: IR_TYPES.CONTINUE,
    lineStart,
    lineEnd
  };
}

function createTryCatch(tryBlock = [], catchBlocks = [], finallyBlock = [], lineStart = 1, lineEnd = 1) {
  return {
    type: IR_TYPES.TRY_CATCH,
    tryBlock,
    catchBlocks, // [{ param: 'err', body: [] }]
    finallyBlock,
    lineStart,
    lineEnd
  };
}

function createThrow(expression = '', lineStart = 1, lineEnd = 1) {
  return {
    type: IR_TYPES.THROW,
    expression: expression.trim(),
    lineStart,
    lineEnd
  };
}

function createSwitch(discriminant, cases = [], lineStart = 1, lineEnd = 1) {
  // cases: [{ label: string, body: [], hasBreak: boolean }]
  return {
    type: IR_TYPES.SWITCH,
    discriminant: discriminant.trim(),
    cases,
    lineStart,
    lineEnd
  };
}

module.exports = {
  IR_TYPES,
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
};
