/**
 * Topological sort using Kahn's algorithm.
 *
 * @param {import('@xyflow/react').Node[]} nodes
 * @param {import('@xyflow/react').Edge[]} edges
 * @returns {string[] | null} Sorted node IDs in execution order, or null if a
 *   cycle is detected.
 */
export function topoSort(nodes, edges) {
  const inDegree = {};
  const adj = {};

  nodes.forEach((n) => {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  });

  edges.forEach((e) => {
    if (adj[e.source] !== undefined && inDegree[e.target] !== undefined) {
      adj[e.source].push(e.target);
      inDegree[e.target]++;
    }
  });

  const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
  const sorted = [];

  while (queue.length > 0) {
    const id = queue.shift();
    sorted.push(id);
    adj[id].forEach((neighbor) => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    });
  }

  return sorted.length === nodes.length ? sorted : null;
}

/**
 * Returns a new nodes array with `data.order` populated from topological sort.
 *
 * @param {import('@xyflow/react').Node[]} nodes
 * @param {string[]} sortedIds
 * @returns {import('@xyflow/react').Node[]}
 */
export function applyOrder(nodes, sortedIds) {
  const orderMap = {};
  sortedIds.forEach((id, idx) => {
    orderMap[id] = idx + 1;
  });
  return nodes.map((n) => ({
    ...n,
    data: { ...n.data, order: orderMap[n.id] ?? null },
  }));
}
