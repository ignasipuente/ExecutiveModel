import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';

import ModelNode from './nodes/ModelNode';
import { topoSort, applyOrder } from './utils/topoSort';
import './index.css';

// Defined outside component so nodeTypes object is stable across renders
const nodeTypes = { modelNode: ModelNode };

// ─── Sample data ─────────────────────────────────────────────────────────────

const SAMPLE_NODES = [
  {
    id: 'node-1',
    type: 'modelNode',
    position: { x: 80, y: 120 },
    data: {
      label: 'Revenue Model.xlsx',
      order: null,
      inputs: ['tax_rate', 'discount_rate'],
      outputs: ['gross_revenue', 'net_revenue', 'ebitda'],
    },
  },
  {
    id: 'node-2',
    type: 'modelNode',
    position: { x: 520, y: 80 },
    data: {
      label: 'Cost Model.xlsx',
      order: null,
      inputs: ['gross_revenue', 'headcount'],
      outputs: ['cogs', 'opex', 'gross_profit'],
    },
  },
  {
    id: 'node-3',
    type: 'modelNode',
    position: { x: 520, y: 340 },
    data: {
      label: 'Headcount Model.xlsx',
      order: null,
      inputs: [],
      outputs: ['headcount'],
    },
  },
];

const SAMPLE_EDGES = [
  {
    id: 'e1-2-revenue',
    source: 'node-1',
    sourceHandle: 'out-gross_revenue',
    target: 'node-2',
    targetHandle: 'in-gross_revenue',
    animated: true,
    style: { stroke: '#6366f1' },
  },
  {
    id: 'e3-2-headcount',
    source: 'node-3',
    sourceHandle: 'out-headcount',
    target: 'node-2',
    targetHandle: 'in-headcount',
    animated: true,
    style: { stroke: '#6366f1' },
  },
];

// Compute initial execution order from sample data
const initialSorted = topoSort(SAMPLE_NODES, SAMPLE_EDGES);
const INITIAL_NODES = initialSorted
  ? applyOrder(SAMPLE_NODES, initialSorted)
  : SAMPLE_NODES;

// Monotonically-increasing counter for new node IDs (module-level to survive re-renders)
let nodeCounter = SAMPLE_NODES.length + 1;

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(SAMPLE_EDGES);
  const [cycleError, setCycleError] = useState(null);

  // Always-fresh refs — updated synchronously during render so any callback
  // that reads them always sees the current state without stale closures.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // ── Safety-net: recalculate order after keyboard-delete ──────────────────
  // onConnect and the delete button handle explicit recalculations; this
  // effect covers React Flow's built-in keyboard deletion (Delete / Backspace).
  const prevCounts = useRef({ n: INITIAL_NODES.length, e: SAMPLE_EDGES.length });
  useEffect(() => {
    const nl = nodes.length;
    const el = edges.length;
    if (nl === prevCounts.current.n && el === prevCounts.current.e) return;
    prevCounts.current = { n: nl, e: el };

    const sorted = topoSort(nodesRef.current, edgesRef.current);
    if (!sorted) return;
    setNodes((prev) => {
      const ordered = applyOrder(prev, sorted);
      // Only trigger a re-render if at least one order badge actually changed
      const changed = ordered.some((n, i) => n.data.order !== prev[i]?.data.order);
      return changed ? ordered : prev;
    });
  }, [nodes.length, edges.length, setNodes]);

  // ── Connection validation ────────────────────────────────────────────────
  // Allow ONLY: source handle (out-*) on the right → target handle (in-*) on the left.
  // This prevents input→input, output→output, and reversed connections.
  const isValidConnection = useCallback(
    ({ source, sourceHandle, target, targetHandle }) =>
      source !== target &&
      sourceHandle?.startsWith('out-') &&
      targetHandle?.startsWith('in-'),
    []
  );

  // ── Connect: add edge with cycle check + order recalculation ────────────
  const onConnect = useCallback(
    (params) => {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;

      // Silently reject duplicate connections
      const duplicate = currentEdges.some(
        (e) =>
          e.source === params.source &&
          e.sourceHandle === params.sourceHandle &&
          e.target === params.target &&
          e.targetHandle === params.targetHandle
      );
      if (duplicate) return;

      const newEdge = {
        id: `e-${Date.now()}`,
        ...params,
        animated: true,
        style: { stroke: '#6366f1' },
      };

      const nextEdges = [...currentEdges, newEdge];
      const sorted = topoSort(currentNodes, nextEdges);

      if (!sorted) {
        setCycleError(
          'Circular dependency detected — this connection would create a cycle and was rejected.'
        );
        return;
      }

      setCycleError(null);
      setEdges(nextEdges);
      setNodes(applyOrder(currentNodes, sorted));
    },
    [setEdges, setNodes]
  );

  // ── Add Block ────────────────────────────────────────────────────────────
  const addBlock = useCallback(() => {
    const id = `node-${nodeCounter++}`;
    const newNode = {
      id,
      type: 'modelNode',
      position: { x: 120 + Math.random() * 280, y: 80 + Math.random() * 240 },
      data: { label: 'New Model.xlsx', order: null, inputs: [], outputs: [], error: null },
    };
    setNodes((currentNodes) => {
      const nextNodes = [...currentNodes, newNode];
      // Compute order immediately so the new block shows its badge right away
      const sorted = topoSort(nextNodes, edgesRef.current);
      return sorted ? applyOrder(nextNodes, sorted) : nextNodes;
    });
  }, [setNodes]);

  // ── Export JSON ──────────────────────────────────────────────────────────
  const exportJSON = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    const exportNodes = currentNodes.map((n) => ({
      id: n.id,
      file: n.data.label,
      order: n.data.order ?? null,
      inputs: n.data.inputs ?? [],
      outputs: n.data.outputs ?? [],
    }));

    const connections = currentEdges.map((e) => {
      const src = currentNodes.find((n) => n.id === e.source);
      const tgt = currentNodes.find((n) => n.id === e.target);
      return {
        from_file: src?.data.label ?? '',
        from_variable: e.sourceHandle?.replace(/^out-/, '') ?? '',
        to_file: tgt?.data.label ?? '',
        to_variable: e.targetHandle?.replace(/^in-/, '') ?? '',
      };
    });

    const blob = new Blob(
      [JSON.stringify({ nodes: exportNodes, connections }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), {
      href: url,
      download: 'dependency_map.json',
    }).click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  const bannerVisible = Boolean(cycleError);

  return (
    <div className="w-full h-full bg-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-800 text-white shadow-md z-10 relative">
        <h1 className="text-lg font-bold tracking-tight">
          Executive Model{' '}
          <span className="text-slate-400 font-normal text-sm">dependency mapper</span>
        </h1>

        <div className="flex items-center gap-3">
          {/* Add Block */}
          <button
            onClick={addBlock}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-sm font-medium transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Add Block
          </button>

          {/* Export JSON */}
          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            Export JSON
          </button>
        </div>
      </header>

      {/* Cycle-error banner */}
      {bannerVisible && (
        <div className="flex items-center justify-between px-6 py-2 bg-red-600 text-white text-sm z-10 relative">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            {cycleError}
          </span>
          <button
            onClick={() => setCycleError(null)}
            className="ml-4 text-lg font-bold leading-none hover:text-red-200 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Canvas */}
      <div
        style={{ height: bannerVisible ? 'calc(100vh - 88px)' : 'calc(100vh - 52px)' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
        >
          <Background color="#cbd5e1" gap={20} />
          <Controls />
          <MiniMap nodeColor="#6366f1" maskColor="rgba(0,0,0,0.05)" />
        </ReactFlow>
      </div>
    </div>
  );
}
