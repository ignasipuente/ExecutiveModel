import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';

import ModelNode from './nodes/ModelNode';
import './index.css';

// Register custom node types
const nodeTypes = { modelNode: ModelNode };

// ------------------------------------------------------------------
// Hardcoded sample data – just to verify the setup works
// ------------------------------------------------------------------
const SAMPLE_NODES = [
  {
    id: 'node-1',
    type: 'modelNode',
    position: { x: 80, y: 120 },
    data: {
      label: 'Revenue Model.xlsx',
      order: 1,
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
      order: 2,
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
    style: { stroke: '#10b981' },
  },
];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(SAMPLE_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(SAMPLE_EDGES);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge({ ...params, animated: true, style: { stroke: '#6366f1' } }, eds)
      ),
    [setEdges]
  );

  return (
    <div className="w-full h-full bg-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-800 text-white shadow-md z-10 relative">
        <h1 className="text-lg font-bold tracking-tight">
          Executive Model&nbsp;
          <span className="text-slate-400 font-normal text-sm">dependency mapper</span>
        </h1>
        <button
          disabled
          className="px-4 py-1.5 rounded-lg bg-indigo-600 text-sm font-medium opacity-40 cursor-not-allowed"
          title="Coming soon"
        >
          Export JSON
        </button>
      </header>

      {/* Canvas – prevent browser from navigating to a file dropped on the background */}
      <div
        style={{ height: 'calc(100vh - 52px)' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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
