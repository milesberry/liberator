// ─── Main canvas ───────────────────────────────────────────────────────────
// Wraps React Flow. Handles drag-drop from palette, node selection, connections.
// Supports subgraph navigation: double-clicking a ModuleNode pushes its subgraph.
// IMPORTANT: nodeTypes and edgeTypes must be defined at module level (not inside
// the component) to avoid React Flow re-rendering every node on every render.

import { useCallback, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider,
  Background, Controls, MiniMap,
  BackgroundVariant,
  useReactFlow,
  applyNodeChanges, applyEdgeChanges,
  type NodeTypes, type EdgeTypes,
  type OnNodesChange, type OnEdgesChange, type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronRight, Package } from 'lucide-react';

import { useGraphStore } from '../../store/graphStore';
import { useUIStore }    from '../../store/uiStore';
import { findDefinition } from '../../nodes/registry';
import { newId } from '../../utils/idGen';

import { ValueNode }   from '../../nodes/ValueNode';
import { PrimOpNode }  from '../../nodes/PrimOpNode';
import { ListOpNode }  from '../../nodes/ListOpNode';
import { HofNode }     from '../../nodes/HofNode';
import { LambdaNode }  from '../../nodes/LambdaNode';
import { IfNode }      from '../../nodes/IfNode';
import { ApplyNode }   from '../../nodes/ApplyNode';
import { OutputNode }  from '../../nodes/OutputNode';
import { ModuleNode }  from '../../nodes/ModuleNode';
import { WireEdge }    from './WireEdge';
import type { LibNode } from '../../types/nodes';
import type { LibEdge } from '../../types/edges';

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
  module:  ModuleNode  as any,
};

const EDGE_TYPES: EdgeTypes = {
  lib: WireEdge as any,
};

// ─── Breadcrumb navigation bar ─────────────────────────────────────────────
function BreadcrumbNav() {
  const { navStack, popSubgraph, nodes: rootNodes } = useGraphStore();
  if (navStack.length === 0) return null;

  function nameFor(subgraphId: string): string {
    const mod = rootNodes.find(n =>
      n.data.kind === 'module' && (n.data as { subgraphId: string }).subgraphId === subgraphId
    );
    return mod ? (mod.data as { name: string }).name : subgraphId.slice(0, 6);
  }

  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-1 px-3 py-1.5
                    bg-slate-900/90 border-b border-amber-700 text-xs backdrop-blur-sm select-none">
      <button
        onClick={() => { for (let i = 0; i < navStack.length; i++) popSubgraph(); }}
        className="text-slate-400 hover:text-white transition-colors"
      >
        root
      </button>
      {navStack.map((id, i) => {
        const isLast = i === navStack.length - 1;
        const label = nameFor(id);
        return (
          <span key={id} className="flex items-center gap-1">
            <ChevronRight size={10} className="text-slate-600" />
            {isLast ? (
              <span className="text-amber-400 flex items-center gap-1">
                <Package size={10} />
                {label}
              </span>
            ) : (
              <button
                onClick={() => {
                  const stepsBack = navStack.length - i - 1;
                  for (let j = 0; j < stepsBack; j++) popSubgraph();
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
      <div className="flex-1" />
      <button
        onClick={popSubgraph}
        className="text-slate-400 hover:text-amber-300 transition-colors text-[10px] border border-slate-700
                   hover:border-amber-600 rounded px-2 py-0.5"
      >
        ← back
      </button>
    </div>
  );
}

// ─── Wrap-as-function floating button ──────────────────────────────────────
function WrapModuleButton({ selectedIds }: { selectedIds: string[] }) {
  const [name, setName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const { wrapAsModule } = useGraphStore();

  if (selectedIds.length < 2) return null;

  const doWrap = () => {
    const n = name.trim() || 'myFunction';
    wrapAsModule(selectedIds, n);
    setName('');
    setShowInput(false);
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
      {showInput ? (
        <div className="flex items-center gap-1.5 bg-slate-900 border border-amber-600 rounded-lg px-3 py-1.5 shadow-xl">
          <Package size={12} className="text-amber-400" />
          <input
            autoFocus
            placeholder="Function name…"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doWrap(); if (e.key === 'Escape') setShowInput(false); }}
            className="bg-transparent text-white text-xs outline-none w-32"
          />
          <button onClick={doWrap}
            className="text-amber-400 hover:text-white text-xs border border-amber-600 rounded px-2 py-0.5">
            Wrap
          </button>
          <button onClick={() => setShowInput(false)} className="text-slate-500 hover:text-white text-xs">✕</button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs
                     font-medium rounded-lg shadow-xl transition-colors border border-amber-500"
        >
          <Package size={12} />
          Wrap {selectedIds.length} nodes as Function
        </button>
      )}
    </div>
  );
}

// ─── Inner canvas — has access to ReactFlow context (useReactFlow) ─────────
function CanvasInner() {
  const {
    nodes: rootNodes, edges: rootEdges,
    onNodesChange: rootOnNodesChange,
    onEdgesChange: rootOnEdgesChange,
    onConnect: rootOnConnect,
    addNode, subgraphs, activeSubgraphId,
    setSubgraph,
  } = useGraphStore();
  const { setSelectedNodeId } = useUIStore();
  const { screenToFlowPosition } = useReactFlow();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ── Choose which graph is active ──────────────────────────────────────────
  const subgraph = activeSubgraphId ? subgraphs[activeSubgraphId] : null;
  const activeNodes: LibNode[] = subgraph ? subgraph.nodes : rootNodes;
  const activeEdges: LibEdge[] = subgraph ? subgraph.edges : rootEdges;

  // ── Change handlers: route to root or active subgraph ────────────────────
  const onNodesChange: OnNodesChange<LibNode> = useCallback((changes) => {
    if (!activeSubgraphId) {
      rootOnNodesChange(changes);
    } else {
      // Apply changes locally to the subgraph
      const sub = useGraphStore.getState().subgraphs[activeSubgraphId];
      if (!sub) return;
      const updated = applyNodeChanges(changes, sub.nodes) as LibNode[];
      setSubgraph(activeSubgraphId, updated, sub.edges);
    }
  }, [activeSubgraphId, rootOnNodesChange, setSubgraph]);

  const onEdgesChange: OnEdgesChange<LibEdge> = useCallback((changes) => {
    if (!activeSubgraphId) {
      rootOnEdgesChange(changes);
    } else {
      const sub = useGraphStore.getState().subgraphs[activeSubgraphId];
      if (!sub) return;
      const updated = applyEdgeChanges(changes, sub.edges) as LibEdge[];
      setSubgraph(activeSubgraphId, sub.nodes, updated);
    }
  }, [activeSubgraphId, rootOnEdgesChange, setSubgraph]);

  const onConnect: OnConnect = useCallback((connection) => {
    if (!activeSubgraphId) {
      rootOnConnect(connection);
    } else {
      // Add edge directly into the active subgraph
      setSubgraph(
        activeSubgraphId,
        useGraphStore.getState().subgraphs[activeSubgraphId]?.nodes ?? [],
        [
          ...( useGraphStore.getState().subgraphs[activeSubgraphId]?.edges ?? []),
          {
            id: newId(),
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle ?? undefined,
            targetHandle: connection.targetHandle ?? undefined,
            type: 'lib',
          } as LibEdge,
        ],
      );
    }
  }, [activeSubgraphId, rootOnConnect, setSubgraph]);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind    = event.dataTransfer.getData('application/liberator-kind');
    const subtype = event.dataTransfer.getData('application/liberator-subtype') || undefined;
    if (!kind) return;
    const def = findDefinition(kind, subtype);
    if (!def) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    if (!activeSubgraphId) {
      addNode(def, position);
    } else {
      // Add node directly into the active subgraph
      const { nodes: sNodes, edges: sEdges } = useGraphStore.getState().subgraphs[activeSubgraphId] ?? { nodes: [], edges: [] };
      const id = newId();
      const newNode = { id, type: def.kind, position, data: def.makeData(id) } as LibNode;
      setSubgraph(activeSubgraphId, [...sNodes, newNode], sEdges);
    }
  }, [addNode, screenToFlowPosition, activeSubgraphId, setSubgraph]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onSelectionChange = useCallback(({ nodes }: { nodes: LibNode[] }) => {
    setSelectedIds(nodes.map(n => n.id));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedIds([]);
  }, [setSelectedNodeId]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: LibNode) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  return (
    <div className="w-full h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
      <BreadcrumbNav />
      {!activeSubgraphId && <WrapModuleButton selectedIds={selectedIds} />}
      <ReactFlow
        nodes={activeNodes}
        edges={activeEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onSelectionChange={onSelectionChange as any}
        onPaneClick={onPaneClick}
        defaultEdgeOptions={{ type: 'lib' }}
        selectionOnDrag
        multiSelectionKeyCode="Shift"
        panOnDrag={[1, 2]}
        panOnScroll
        panOnScrollMode="free"
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode="Control"
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
