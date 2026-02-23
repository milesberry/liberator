// ─── Main canvas ───────────────────────────────────────────────────────────
// Wraps React Flow. Handles drag-drop from palette, node selection, connections.
// IMPORTANT: nodeTypes and edgeTypes must be defined at module level (not inside
// the component) to avoid React Flow re-rendering every node on every render.

import { useCallback } from 'react';
import {
  ReactFlow, ReactFlowProvider,
  Background, Controls, MiniMap,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes, type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGraphStore } from '../../store/graphStore';
import { useUIStore }    from '../../store/uiStore';
import { findDefinition } from '../../nodes/registry';

import { ValueNode }   from '../../nodes/ValueNode';
import { PrimOpNode }  from '../../nodes/PrimOpNode';
import { ListOpNode }  from '../../nodes/ListOpNode';
import { HofNode }     from '../../nodes/HofNode';
import { LambdaNode }  from '../../nodes/LambdaNode';
import { IfNode }      from '../../nodes/IfNode';
import { ApplyNode }   from '../../nodes/ApplyNode';
import { OutputNode }  from '../../nodes/OutputNode';
import { WireEdge }    from './WireEdge';

// ─── MUST be defined at module level, not inside a component ───────────────
const NODE_TYPES: NodeTypes = {
  value:   ValueNode   as any,
  primop:  PrimOpNode  as any,
  listop:  ListOpNode  as any,
  hof:     HofNode     as any,
  lambda:  LambdaNode  as any,
  if:      IfNode      as any,
  apply:   ApplyNode   as any,
  output:  OutputNode  as any,
};

const EDGE_TYPES: EdgeTypes = {
  lib: WireEdge as any,
};

// ─── Inner canvas — has access to ReactFlow context (useReactFlow) ─────────
function CanvasInner() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode } = useGraphStore();
  const { setSelectedNodeId } = useUIStore();
  const { screenToFlowPosition } = useReactFlow();

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind    = event.dataTransfer.getData('application/liberator-kind');
    const subtype = event.dataTransfer.getData('application/liberator-subtype') || undefined;
    if (!kind) return;

    const def = findDefinition(kind, subtype);
    if (!def) return;

    // Correctly maps screen coords → canvas coords (respects pan + zoom)
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNode(def, position);
  }, [addNode, screenToFlowPosition]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div className="w-full h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        defaultEdgeOptions={{ type: 'lib' }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        style={{ background: '#111827' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
        <Controls />
        <MiniMap
          nodeColor="#374151"
          maskColor="rgba(0,0,0,0.5)"
          style={{ background: '#1f2937' }}
        />
      </ReactFlow>
    </div>
  );
}

// ─── Outer wrapper — provides the ReactFlow context ───────────────────────
export function LiberatorCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
