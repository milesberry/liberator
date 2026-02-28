// ─── Main canvas ───────────────────────────────────────────────────────────
// Wraps React Flow. Handles drag-drop from palette, node selection, connections.
// Supports subgraph navigation: double-clicking a ModuleNode pushes its subgraph.
// IMPORTANT: nodeTypes and edgeTypes must be defined at module level (not inside
// the component) to avoid React Flow re-rendering every node on every render.

import { useCallback, useState, useEffect } from 'react';
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
import { ChevronRight, Package, RefreshCw } from 'lucide-react';

import { useGraphStore } from '../../store/graphStore';
import { useUIStore, snapshotNodes } from '../../store/uiStore';
import { findDefinition } from '../../nodes/registry';
import { newId } from '../../utils/idGen';
import { computeLayout } from '../../utils/layout';

import { ValueNode }   from '../../nodes/ValueNode';
import { PrimOpNode }  from '../../nodes/PrimOpNode';
import { ListOpNode }  from '../../nodes/ListOpNode';
import { HofNode }     from '../../nodes/HofNode';
import { LambdaNode }  from '../../nodes/LambdaNode';
import { IfNode }      from '../../nodes/IfNode';
import { ApplyNode }   from '../../nodes/ApplyNode';
import { OutputNode }  from '../../nodes/OutputNode';
import { ModuleNode }  from '../../nodes/ModuleNode';
import { CallNode }     from '../../nodes/CallNode';
import { LetNode }      from '../../nodes/LetNode';
import { ListCompNode }  from '../../nodes/ListCompNode';
import { MatchListNode } from '../../nodes/MatchListNode';
import { WireEdge }     from './WireEdge';
import { QuickAdd }    from './QuickAdd';
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
  call:     CallNode     as any,
  let:       LetNode      as any,
  listcomp:  ListCompNode as any,
  matchlist: MatchListNode as any,
};

const EDGE_TYPES: EdgeTypes = {
  lib: WireEdge as any,
};

// ─── Breadcrumb navigation bar ─────────────────────────────────────────────
function BreadcrumbNav() {
  const { navStack, popSubgraph, syncModuleNode, activeSubgraphId, nodes: rootNodes } = useGraphStore();
  const [applyFlash, setApplyFlash] = useState(false);
  if (navStack.length === 0) return null;

  function nameFor(subgraphId: string): string {
    const mod = rootNodes.find(n =>
      n.data.kind === 'module' && (n.data as { subgraphId: string }).subgraphId === subgraphId
    );
    return mod ? (mod.data as { name: string }).name : subgraphId.slice(0, 6);
  }

  const handleApply = () => {
    if (activeSubgraphId) syncModuleNode(activeSubgraphId);
    setApplyFlash(true);
    setTimeout(() => setApplyFlash(false), 1200);
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-1 px-3 py-1.5
                    border-b border-amber-600 text-xs backdrop-blur-sm select-none"
         style={{ background: 'var(--bg-toolbar)', color: 'var(--text-muted)' }}>
      <button
        onClick={() => { for (let i = 0; i < navStack.length; i++) popSubgraph(); }}
        className="hover:text-amber-500 transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        root
      </button>
      {navStack.map((id, i) => {
        const isLast = i === navStack.length - 1;
        const label = nameFor(id);
        return (
          <span key={id} className="flex items-center gap-1">
            <ChevronRight size={10} style={{ color: 'var(--text-faint)' }} />
            {isLast ? (
              <span className="text-amber-500 flex items-center gap-1">
                <Package size={10} />
                {label}
              </span>
            ) : (
              <button
                onClick={() => {
                  const stepsBack = navStack.length - i - 1;
                  for (let j = 0; j < stepsBack; j++) popSubgraph();
                }}
                className="hover:text-amber-500 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
      <div className="flex-1" />
      {/* Apply — sync module ports + refresh Call nodes without navigating out */}
      <button
        onClick={handleApply}
        title="Sync this module's ports and update all Call nodes that reference it — no need to navigate out"
        className="flex items-center gap-1 transition-colors text-[10px] rounded px-2 py-0.5 mr-1"
        style={{
          color: applyFlash ? '#f59e0b' : 'var(--text-muted)',
          border: `1px solid ${applyFlash ? '#f59e0b' : 'var(--border-subtle)'}`,
        }}
      >
        <RefreshCw size={10} className={applyFlash ? 'text-amber-400' : ''} />
        {applyFlash ? 'Applied!' : 'Apply'}
      </button>
      <button
        onClick={popSubgraph}
        className="hover:text-amber-500 hover:border-amber-500 transition-colors text-[10px] rounded px-2 py-0.5"
        style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
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
interface CanvasInnerProps {
  onRegisterTidyUp: (fn: () => void) => void;
}

function CanvasInner({ onRegisterTidyUp }: CanvasInnerProps) {
  const {
    nodes: rootNodes, edges: rootEdges,
    onNodesChange: rootOnNodesChange,
    onEdgesChange: rootOnEdgesChange,
    onConnect: rootOnConnect,
    addNode, subgraphs, activeSubgraphId,
    setSubgraph, undo, redo, removeNodes, pasteNodes,
    layoutNodes,
  } = useGraphStore();
  const {
    setSelectedNodeId,
    selectedNodeIds, setSelectedNodeIds,
    setSelectedEdgeId,
    setClipboard,
    theme,
  } = useUIStore();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing inside an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (ctrl && e.key === 'k') { e.preventDefault(); setQuickAddOpen(true); return; }

      if (ctrl && e.key === 'c') {
        e.preventDefault();
        const activeNodes = useGraphStore.getState().nodes; // root only for now
        const ids = new Set(useUIStore.getState().selectedNodeIds);
        if (ids.size > 0) setClipboard(snapshotNodes(activeNodes, ids));
        return;
      }
      if (ctrl && e.key === 'x') {
        e.preventDefault();
        const activeNodes = useGraphStore.getState().nodes;
        const ids = new Set(useUIStore.getState().selectedNodeIds);
        if (ids.size > 0) {
          setClipboard(snapshotNodes(activeNodes, ids));
          removeNodes([...ids]);
          setSelectedNodeIds([]);
        }
        return;
      }
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        const cb = useUIStore.getState().clipboard;
        if (cb && cb.length > 0) pasteNodes(cb);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, removeNodes, pasteNodes, setClipboard, setSelectedNodeIds]);

  // ── Choose which graph is active ──────────────────────────────────────────
  const subgraph = activeSubgraphId ? subgraphs[activeSubgraphId] : null;
  const activeNodes: LibNode[] = subgraph ? subgraph.nodes : rootNodes;
  const activeEdges: LibEdge[] = subgraph ? subgraph.edges : rootEdges;

  // ── Tidy Up: DAG auto-layout + fitView ───────────────────────────────────
  const handleTidyUp = useCallback(() => {
    if (activeNodes.length === 0) return;
    const positions = computeLayout(activeNodes, activeEdges);
    layoutNodes(positions);
    // Delay fitView slightly so React can flush the position updates first
    setTimeout(() => fitView({ duration: 400, padding: 0.15 }), 50);
  }, [activeNodes, activeEdges, layoutNodes, fitView]);

  useEffect(() => {
    onRegisterTidyUp(handleTidyUp);
  }, [onRegisterTidyUp, handleTidyUp]);

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
    // Clear selectedEdgeId if the selected edge is being removed
    const removedIds = changes.filter(c => c.type === 'remove').map(c => c.id);
    if (removedIds.length > 0 && removedIds.includes(useUIStore.getState().selectedEdgeId ?? '')) {
      setSelectedEdgeId(null);
    }
    if (!activeSubgraphId) {
      rootOnEdgesChange(changes);
    } else {
      const sub = useGraphStore.getState().subgraphs[activeSubgraphId];
      if (!sub) return;
      const updated = applyEdgeChanges(changes, sub.edges) as LibEdge[];
      setSubgraph(activeSubgraphId, sub.nodes, updated);
    }
  }, [activeSubgraphId, rootOnEdgesChange, setSubgraph, setSelectedEdgeId]);

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
    setSelectedNodeIds(nodes.map(n => n.id));
  }, [setSelectedNodeIds]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: LibEdge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, [setSelectedEdgeId, setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  }, [setSelectedNodeId, setSelectedNodeIds, setSelectedEdgeId]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: LibNode) => {
    // Toggle: clicking the already-selected node closes the panel
    setSelectedNodeId(
      useUIStore.getState().selectedNodeId === node.id ? null : node.id
    );
    setSelectedEdgeId(null);
  }, [setSelectedNodeId, setSelectedEdgeId]);

  return (
    <div className="w-full h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <BreadcrumbNav />
      {!activeSubgraphId && <WrapModuleButton selectedIds={selectedNodeIds} />}
      <ReactFlow
        nodes={activeNodes}
        edges={activeEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onSelectionChange={onSelectionChange as any}
        onPaneClick={onPaneClick}
        defaultEdgeOptions={{ type: 'lib' }}
        selectionOnDrag
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        panOnDrag={[1, 2]}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode="Control"
        minZoom={0.2}
        maxZoom={2}
        style={{ background: theme === 'dark' ? '#111827' : '#e2e8f0' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={theme === 'dark' ? '#4b5563' : '#94a3b8'}
        />
        <Controls />
        <MiniMap
          nodeColor={theme === 'dark' ? '#374151' : '#94a3b8'}
          maskColor={theme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(200,210,220,0.6)'}
          style={{ background: theme === 'dark' ? '#1f2937' : '#f1f5f9' }}
        />
      </ReactFlow>
    </div>
  );
}

// ─── Outer wrapper — provides the ReactFlow context ───────────────────────
interface LiberatorCanvasProps {
  onRegisterTidyUp: (fn: () => void) => void;
}

export function LiberatorCanvas({ onRegisterTidyUp }: LiberatorCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner onRegisterTidyUp={onRegisterTidyUp} />
    </ReactFlowProvider>
  );
}
