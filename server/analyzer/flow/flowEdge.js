// server/analyzer/flow/flowEdge.js
// Factory for creating standardized Flowchart edges

let edgeCounter = 1;

function resetEdgeCounter() {
  edgeCounter = 1;
}

function nextEdgeId(prefix = 'edge') {
  return `${prefix}_${edgeCounter++}`;
}

/**
 * Creates a flowchart edge
 * @param {Object} options
 * @param {string} options.source - Source node ID
 * @param {string} options.target - Target node ID
 * @param {string} [options.label] - Optional edge label ('YES', 'NO', 'LOOP', 'CALLS', etc.)
 * @param {string} [options.type] - Edge type
 * @returns {Object} FlowEdge
 */
function createFlowEdge({
  source,
  target,
  label = null,
  type = 'default',
  id = null
}) {
  const edge = {
    id: id || nextEdgeId('edge'),
    source,
    target
  };

  if (label) {
    edge.label = label;
  }
  if (type) {
    edge.type = type;
  }

  return edge;
}

module.exports = {
  createFlowEdge,
  resetEdgeCounter,
  nextEdgeId
};
