// ─── Graph store ───────────────────────────────────────────────────────────
// Central Zustand store for nodes, edges, and subgraphs.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current } from 'immer';
import {
  applyNodeChanges, applyEdgeChanges,
  type OnNodesChange, type OnEdgesChange, type OnConnect,
  type Connection, type XYPosition,
} from '@xyflow/react';
import type { LibNode, ModuleNodeData, CallNodeData, Port } from '../types/nodes';
import { handleId } from '../types/nodes';
import type { LibEdge } from '../types/edges';
import { defaultEdgeData } from '../types/edges';
import { createNode } from '../nodes/registry';
import type { NodeDefinition } from '../nodes/registry';
import type { Clipboard } from './uiStore';
import { newId } from '../utils/idGen';
import { callDataFor } from '../utils/functions';
import { TUnknown, TVar, type HaskellType } from '../types/haskell';

export interface SubgraphState {
  nodes: LibNode[];
  edges: LibEdge[];
}

// ─── History snapshot ──────────────────────────────────────────────────────

interface GraphSnapshot {
  nodes: LibNode[];
  edges: LibEdge[];
  subgraphs: Record<string, SubgraphState>;
}

// Rename type variables belonging to one node (a_<oldId>) to another's
function renameTypeVars(t: HaskellType, oldId: string, newId: string): HaskellType {
  switch (t.tag) {
    case 'TypeVar':
      return t.name.endsWith(`_${oldId}`)
        ? { tag: 'TypeVar', name: t.name.slice(0, -oldId.length) + newId }
        : t;
    case 'List':  return { tag: 'List', elem: renameTypeVars(t.elem, oldId, newId) };
    case 'Tuple': return { tag: 'Tuple', elems: t.elems.map(e => renameTypeVars(e, oldId, newId)) };
    case 'Fun':   return { tag: 'Fun', from: renameTypeVars(t.from, oldId, newId), to: renameTypeVars(t.to, oldId, newId) };
    default:      return t;
  }
}

// ─── Module sync helper ────────────────────────────────────────────────────
// Re-derives a module node's inputPorts / outputPorts from its subgraph's
// anchor nodes. Call this inside an Immer set() whenever the user leaves a
// subgraph so the outer module chip reflects any edits made inside.
//
// Anchor convention (set by wrapAsModule):
//   Input  anchors: kind='value',  literal='__module_input__', _modulePortId=<portId>
//   Output anchors: kind='output', _modulePortId=<portId>
// Input anchors are recognised by _modulePortId alone, as the evaluator does:
// the built-in examples' hand-written anchors carry ordinary literals.
//
// If a plain Output node exists without _modulePortId it was added after
// wrapping — we promote it to a new output port automatically.
// A function's Parameter nodes, in parameter order: top to bottom, then left to right
export function parameterAnchors(nodes: LibNode[]): LibNode[] {
  return nodes
    .filter(n => n.data.kind === 'value' && (n.data as { _modulePortId?: string })._modulePortId)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
}

function syncModuleNodeInState(state: GraphState, subgraphId: string): void {
  const sub = state.subgraphs[subgraphId];
  if (!sub) return;

  // ── Find the parent graph that owns the module node ──────────────────────
  let moduleNode: LibNode | undefined;
  let parentKey = '';            // '' = root, else a subgraphId

  moduleNode = state.nodes.find(
    n => n.data.kind === 'module' && (n.data as ModuleNodeData).subgraphId === subgraphId
  );
  if (!moduleNode) {
    for (const key of Object.keys(state.subgraphs)) {
      const found = state.subgraphs[key].nodes.find(
        n => n.data.kind === 'module' && (n.data as ModuleNodeData).subgraphId === subgraphId
      );
      if (found) { moduleNode = found; parentKey = key; break; }
    }
  }
  if (!moduleNode) return;

  const md = moduleNode.data as ModuleNodeData;

  // ── Rebuild input ports from input anchor nodes ───────────────────────────
  // Parameters come in the order their nodes appear, top to bottom (then left
  // to right), so moving a Parameter node up or down changes its position
  const newInputPorts: Port[] = parameterAnchors(sub.nodes)
    .map(n => {
      const d = n.data as any;
      const resultPort = (d.ports as Port[] | undefined)?.find(p => p.id === 'result');
      const existing   = md.inputPorts.find(p => p.id === d._modulePortId);
      return {
        id:        d._modulePortId as string,
        label:     resultPort?.label ?? existing?.label ?? 'in',
        direction: 'input'  as const,
        type:      resultPort?.type  ?? existing?.type  ?? TUnknown,
        connected: existing?.connected ?? false,
      };
    });

  // ── Rebuild output ports from tagged output anchor nodes ──────────────────
  const newOutputPorts: Port[] = sub.nodes
    .filter(n => n.data.kind === 'output' && (n.data as any)._modulePortId)
    .map(n => {
      const d         = n.data as any;
      const valuePort = (d.ports as Port[] | undefined)?.find(p => p.id === 'value');
      const existing  = md.outputPorts.find(p => p.id === d._modulePortId);
      return {
        id:        d._modulePortId as string,
        label:     d.label ?? existing?.label ?? 'out',
        direction: 'output' as const,
        type:      valuePort?.type ?? existing?.type ?? TUnknown,
        connected: existing?.connected ?? false,
      };
    });

  // ── Promote untagged output nodes added after wrapping ────────────────────
  for (const node of sub.nodes) {
    if (node.data.kind === 'output' && !(node.data as any)._modulePortId) {
      const portId    = `out_${newId()}`;
      const d         = node.data as any;
      const valuePort = (d.ports as Port[] | undefined)?.find((p: Port) => p.id === 'value');
      d._modulePortId = portId;
      newOutputPorts.push({
        id:        portId,
        label:     d.label ?? 'out',
        direction: 'output',
        type:      valuePort?.type ?? TUnknown,
        connected: false,
      });
    }
  }

  // ── Detect port IDs that disappeared → prune stale outer edges ───────────
  const newPortIds   = new Set([...newInputPorts, ...newOutputPorts].map(p => p.id));
  const stalePortIds = new Set(
    [...md.inputPorts, ...md.outputPorts]
      .map(p => p.id)
      .filter(id => !newPortIds.has(id))
  );

  // ── Write updated ports back to the module node (Immer-mutable) ──────────
  md.inputPorts  = newInputPorts;
  md.outputPorts = newOutputPorts;
  md.ports       = [...newInputPorts, ...newOutputPorts];

  // ── Prune stale edges in the parent graph ─────────────────────────────────
  if (stalePortIds.size > 0) {
    const isStale = (e: LibEdge): boolean => {
      const srcPort = e.sourceHandle ? e.sourceHandle.split('__')[1] : '';
      const tgtPort = e.targetHandle ? e.targetHandle.split('__')[1] : '';
      return stalePortIds.has(srcPort) || stalePortIds.has(tgtPort);
    };
    if (parentKey === '') {
      state.edges = state.edges.filter(e => !isStale(e)) as typeof state.edges;
    } else {
      state.subgraphs[parentKey].edges =
        state.subgraphs[parentKey].edges.filter(e => !isStale(e));
    }
  }

  // ── Refresh every Call node that references this module by name ───────────
  // This means navigating back out is the only step needed — no manual
  // re-selection of the function to pick up port changes.
  const freshPorts = [...newInputPorts, ...newOutputPorts];
  const moduleName = md.name;

  function refreshCallNode(node: LibNode) {
    if (node.data.kind !== 'call') return;
    const cd = node.data as CallNodeData;
    if (cd.targetName !== moduleName) return;
    cd.ports = freshPorts.map(p => ({ ...p, connected: false }));
  }

  for (const node of state.nodes)  refreshCallNode(node);
  for (const sub of Object.values(state.subgraphs))
    for (const node of sub.nodes) refreshCallNode(node);
}

// Helper: push current state onto the undo stack and clear redo.
// Must be called inside an Immer set() callback, before mutating state.
function pushHistory(state: GraphState) {
  state.history.push({
    nodes: current(state.nodes) as LibNode[],
    edges: current(state.edges) as LibEdge[],
    subgraphs: current(state.subgraphs) as Record<string, SubgraphState>,
  });
  if (state.history.length > 100) state.history.shift(); // cap at 100 entries
  state.future = []; // any new action clears redo
}

// ─── State interface ───────────────────────────────────────────────────────

interface GraphState {
  // Root graph
  nodes: LibNode[];
  edges: LibEdge[];
  // Subgraphs keyed by subgraphId (for Module nodes)
  subgraphs: Record<string, SubgraphState>;

  // History for undo/redo
  history: GraphSnapshot[];
  future:  GraphSnapshot[];

  // React Flow event handlers
  onNodesChange: OnNodesChange<LibNode>;
  onEdgesChange: OnEdgesChange<LibEdge>;
  onConnect: OnConnect;

  // Graph mutations
  addNode: (def: NodeDefinition, position: XYPosition) => void;
  addPreparedNode: (node: LibNode) => void;   // root graph, undoable
  removeNode:  (id: string) => void;
  removeNodes: (ids: string[]) => void;
  pasteNodes:  (clipboard: Clipboard, offset?: { x: number; y: number }) => void;
  updateNodeData: (id: string, updater: (data: LibNode['data']) => void) => void;
  loadGraph: (nodes: LibNode[], edges: LibEdge[], subgraphs?: Record<string, SubgraphState>) => void;
  clearGraph: () => void;
  layoutNodes: (positions: Record<string, { x: number; y: number }>) => void;

  // Undo / redo
  undo: () => void;
  redo: () => void;

  // Subgraph / module actions
  wrapAsModule: (selectedNodeIds: string[], name: string) => void;
  setSubgraph: (subgraphId: string, nodes: LibNode[], edges: LibEdge[]) => void;
  getSubgraph: (subgraphId: string) => SubgraphState | undefined;
  syncModuleNode: (subgraphId: string) => void;
  // Inside a function: add a new Parameter node, or move one up or down the order
  addParameter: () => void;
  moveParameter: (nodeId: string, direction: -1 | 1) => void;

  // Nav: which graph is shown on canvas ('' = root, else subgraphId)
  activeSubgraphId: string;
  pushSubgraph: (subgraphId: string) => void;
  popSubgraph: () => void;
  navStack: string[];
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useGraphStore = create<GraphState>()(
  immer((set, get) => ({
    nodes: [],
    edges: [],
    subgraphs: {},
    history: [],
    future:  [],
    activeSubgraphId: '',
    navStack: [],

    // ── React Flow change handlers ─────────────────────────────────────────

    onNodesChange: (changes) => {
      set((state) => {
        // Only snapshot on structural changes (remove, end-of-drag)
        const structural = changes.some(
          c => c.type === 'remove' ||
              (c.type === 'position' && !(c as { dragging?: boolean }).dragging)
        );
        if (structural) pushHistory(state);
        state.nodes = applyNodeChanges(changes, state.nodes) as LibNode[];
      });
    },

    onEdgesChange: (changes) => {
      set((state) => {
        const structural = changes.some(c => c.type === 'remove');
        if (structural) pushHistory(state);
        state.edges = applyEdgeChanges(changes, state.edges) as LibEdge[];
      });
    },

    onConnect: (connection: Connection) => {
      set((state) => {
        pushHistory(state);
        const edge: LibEdge = {
          id: newId(),
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
          type: 'lib',
          data: defaultEdgeData(),
        };
        state.edges.push(edge);

        // Mark ports as connected
        const srcNode = state.nodes.find(n => n.id === connection.source);
        const tgtNode = state.nodes.find(n => n.id === connection.target);
        if (srcNode) {
          const portId = connection.sourceHandle?.split('__')[1];
          const port = srcNode.data.ports.find(p => p.id === portId);
          if (port) port.connected = true;
        }
        if (tgtNode) {
          const portId = connection.targetHandle?.split('__')[1];
          const port = tgtNode.data.ports.find(p => p.id === portId);
          if (port) port.connected = true;
        }
      });
    },

    // ── Graph mutations ────────────────────────────────────────────────────

    addNode: (def, position) => {
      set((state) => {
        pushHistory(state);
        const node = createNode(def, position) as LibNode;
        // Add to whichever graph is on screen — inside a function, that's its subgraph
        const sub = state.activeSubgraphId ? state.subgraphs[state.activeSubgraphId] : undefined;
        if (sub) sub.nodes.push(node);
        else state.nodes.push(node);
      });
    },

    addPreparedNode: (node) => {
      set((state) => {
        pushHistory(state);
        state.nodes.push(node);
      });
    },

    removeNode: (id) => {
      set((state) => {
        pushHistory(state);
        if (state.activeSubgraphId) {
          const sub = state.subgraphs[state.activeSubgraphId];
          if (sub) {
            sub.nodes = sub.nodes.filter(n => n.id !== id);
            sub.edges = sub.edges.filter(e => e.source !== id && e.target !== id);
            return;
          }
        }
        state.nodes = state.nodes.filter(n => n.id !== id);
        state.edges = state.edges.filter(e => e.source !== id && e.target !== id);
      });
    },

    removeNodes: (ids) => {
      set((state) => {
        const idSet = new Set(ids);
        pushHistory(state);
        if (state.activeSubgraphId) {
          const sub = state.subgraphs[state.activeSubgraphId];
          if (sub) {
            sub.nodes = sub.nodes.filter(n => !idSet.has(n.id));
            sub.edges = sub.edges.filter(e => !idSet.has(e.source) && !idSet.has(e.target));
            return;
          }
        }
        state.nodes = state.nodes.filter(n => !idSet.has(n.id));
        state.edges = state.edges.filter(e => !idSet.has(e.source) && !idSet.has(e.target));
      });
    },

    pasteNodes: (clipboard, offset = { x: 24, y: 24 }) => {
      set((state) => {
        pushHistory(state);
        // Paste into whichever graph is on screen — inside a function, that's its subgraph
        const sub = state.activeSubgraphId ? state.subgraphs[state.activeSubgraphId] : undefined;
        const graph = sub ?? state;
        // The pasted nodes become the selection, so they can be moved as a group
        for (const n of graph.nodes) n.selected = false;
        const freshIds = new Map<string, string>();
        const pasted: LibNode[] = [];
        for (const entry of clipboard.nodes) {
          const freshId = newId();
          freshIds.set(entry.id, freshId);
          // Deep-clone data so each paste gets its own copy; reset port connections
          let data = JSON.parse(JSON.stringify(entry.data)) as LibNode['data'];
          let type = entry.type;
          // A copied Function whose original is still in the graph pastes as a
          // Call to it — another use, not a second definition sharing its body.
          // (After a cut the original is gone, so the Function itself is pasted.)
          if (data.kind === 'module') {
            const sgId = (data as ModuleNodeData).subgraphId;
            const live = [...state.nodes, ...Object.values(state.subgraphs).flatMap(sg => sg.nodes)]
              .find(n => n.data.kind === 'module' && (n.data as ModuleNodeData).subgraphId === sgId);
            if (live) {
              data = callDataFor(current(live.data) as ModuleNodeData);
              type = 'call';
            }
          }
          // Type variables are named after the node they belong to (a_<id>), so a
          // copy that kept them would be tied to the original: wire one to a Float
          // and the other would demand a Float too. Rename them for the new node.
          data.ports = data.ports.map(p => ({ ...p, connected: false, type: renameTypeVars(p.type, entry.id, freshId) }));
          // A pasted copy of a Parameter or function output is an ordinary node;
          // keeping the anchor marker would give the function duplicate ports
          const anchor = data as { _modulePortId?: string; literal?: string };
          if (anchor._modulePortId) {
            delete anchor._modulePortId;
            if (anchor.literal === '__module_input__') anchor.literal = '';
          }
          const node: LibNode = {
            id:       freshId,
            type,
            position: { x: entry.position.x + offset.x, y: entry.position.y + offset.y },
            data,
            selected: true,
          };
          graph.nodes.push(node);
          pasted.push(node);
        }
        // Reconnect the wires that ran between the copied nodes
        const byId = new Map(pasted.map(n => [n.id, n]));
        for (const ce of clipboard.edges) {
          const src = byId.get(freshIds.get(ce.source) ?? '');
          const tgt = byId.get(freshIds.get(ce.target) ?? '');
          const srcPort = src?.data.ports.find(p => p.id === ce.sourcePort);
          const tgtPort = tgt?.data.ports.find(p => p.id === ce.targetPort);
          if (!src || !tgt || !srcPort || !tgtPort) continue;
          graph.edges.push({
            id: newId(),
            source: src.id,
            target: tgt.id,
            sourceHandle: handleId(src.id, srcPort.id),
            targetHandle: handleId(tgt.id, tgtPort.id),
            type: 'lib',
            data: defaultEdgeData(),
          });
          srcPort.connected = true;
          tgtPort.connected = true;
        }
      });
    },

    updateNodeData: (id, updater) => {
      set((state) => {
        pushHistory(state);
        // Search root graph first
        const rootNode = state.nodes.find(n => n.id === id);
        if (rootNode) { updater(rootNode.data); return; }
        // Fall through to active subgraph
        if (state.activeSubgraphId) {
          const sub = state.subgraphs[state.activeSubgraphId];
          const subNode = sub?.nodes.find(n => n.id === id);
          if (subNode) updater(subNode.data);
        }
      });
    },

    loadGraph: (nodes, edges, subgraphs?) => {
      set((state) => {
        pushHistory(state);
        state.nodes = nodes as LibNode[];
        state.edges = edges as LibEdge[];
        if (subgraphs) state.subgraphs = subgraphs;
        state.activeSubgraphId = '';
        state.navStack = [];
      });
    },

    clearGraph: () => {
      set((state) => {
        pushHistory(state);
        state.nodes = [];
        state.edges = [];
        state.subgraphs = {};
        state.activeSubgraphId = '';
        state.navStack = [];
      });
    },

    layoutNodes: (positions) => {
      set((state) => {
        pushHistory(state);
        // Update positions in the active view (root or current subgraph)
        const arr = state.activeSubgraphId
          ? state.subgraphs[state.activeSubgraphId]?.nodes
          : state.nodes;
        for (const node of arr ?? []) {
          if (positions[node.id]) {
            node.position = positions[node.id];
          }
        }
      });
    },

    // ── Undo / Redo ────────────────────────────────────────────────────────

    undo: () => {
      set((state) => {
        if (state.history.length === 0) return;
        const snapshot = state.history.pop()!;
        state.future.push({
          nodes:     current(state.nodes)     as LibNode[],
          edges:     current(state.edges)     as LibEdge[],
          subgraphs: current(state.subgraphs) as Record<string, SubgraphState>,
        });
        state.nodes     = snapshot.nodes     as LibNode[];
        state.edges     = snapshot.edges     as LibEdge[];
        state.subgraphs = snapshot.subgraphs as Record<string, SubgraphState>;
      });
    },

    redo: () => {
      set((state) => {
        if (state.future.length === 0) return;
        const snapshot = state.future.pop()!;
        state.history.push({
          nodes:     current(state.nodes)     as LibNode[],
          edges:     current(state.edges)     as LibEdge[],
          subgraphs: current(state.subgraphs) as Record<string, SubgraphState>,
        });
        state.nodes     = snapshot.nodes     as LibNode[];
        state.edges     = snapshot.edges     as LibEdge[];
        state.subgraphs = snapshot.subgraphs as Record<string, SubgraphState>;
      });
    },

    // ── Subgraph / Module actions ────────────────────────────────────────

    wrapAsModule: (selectedNodeIds, name) => {
      set((state) => {
        pushHistory(state);
        const ids = new Set(selectedNodeIds);
        // Deep-clone inner nodes so we can mutate _modulePortId without touching state
        const innerNodes = state.nodes
          .filter(n => ids.has(n.id))
          .map(n => ({ ...n, data: { ...n.data, ports: [...n.data.ports] } })) as LibNode[];
        const outerNodes = state.nodes.filter(n => !ids.has(n.id)) as LibNode[];

        // Partition edges by whether source/target are inside the selection
        const innerEdges: LibEdge[] = [];
        const outerEdges: LibEdge[] = [];
        const crossIn:  LibEdge[] = [];  // outside → inside
        const crossOut: LibEdge[] = [];  // inside  → outside

        for (const e of state.edges) {
          const srcIn = ids.has(e.source);
          const tgtIn = ids.has(e.target);
          if (srcIn && tgtIn)        innerEdges.push(e);
          else if (!srcIn && !tgtIn) outerEdges.push(e);
          else if (!srcIn && tgtIn)  crossIn.push(e);
          else                       crossOut.push(e);
        }

        const subgraphId = newId();
        const moduleId   = `mod_${subgraphId}`;

        // Handles that already have an inner source (fully internal wires)
        const innerTargetHandles  = new Set(innerEdges.map(e => e.targetHandle ?? `${e.target}__value`));
        // Handles fed from outside via a crossIn edge
        const crossInTargetHandles = new Set(crossIn.map(e => e.targetHandle ?? `${e.target}__value`));

        const moduleInputPorts:   Port[]    = [];
        const moduleOutputPorts:  Port[]    = [];
        const subgraphAnchors:    LibNode[] = [];
        const extraInnerEdges:    LibEdge[] = [];
        const extraOuterEdges:    LibEdge[] = [];

        let inputY  = 0;
        let outputY = 0;

        // Parameter names must be distinct: x, x2, x3, …
        const usedParamLabels = new Set<string>();
        const uniqueParamLabel = (base: string): string => {
          let label = base;
          for (let i = 2; usedParamLabels.has(label); i++) label = `${base}${i}`;
          usedParamLabels.add(label);
          return label;
        };

        // ── INPUT PORTS ───────────────────────────────────────────────────────
        // Each parameter feeds one or more inner inputs. Gather them first, then
        // create them in on-screen order (top to bottom), which is the order a
        // student reads them in, and the order the function will take them.
        interface ParamSpec {
          at:      { x: number; y: number };  // where it comes from on screen
          label:   string;
          type:    Port['type'];
          targets: string[];                  // inner target handles it feeds
          outer?:  LibEdge;                   // the wire arriving from outside, if any
        }
        const params: ParamSpec[] = [];

        // Case A: dangling inner input ports (nothing connected to them at all)
        for (const node of innerNodes) {
          for (const port of node.data.ports.filter(p => p.direction === 'input')) {
            const tgtHandle = `${node.id}__${port.id}`;
            if (!innerTargetHandles.has(tgtHandle) && !crossInTargetHandles.has(tgtHandle)) {
              params.push({ at: node.position, label: port.label, type: port.type, targets: [tgtHandle] });
            }
          }
        }

        // Case B: cross-in edges (an external wire is already arriving). One
        // outside value wired into several inner inputs (x * x) is one parameter.
        const bySource = new Map<string, ParamSpec>();
        for (const e of crossIn) {
          const srcHandle = e.sourceHandle ?? `${e.source}__result`;
          const tgtHandle = e.targetHandle ?? `${e.target}__value`;
          const existing = bySource.get(srcHandle);
          if (existing) {
            if (!existing.targets.includes(tgtHandle)) existing.targets.push(tgtHandle);
            continue;
          }
          const innerNode = innerNodes.find(n => n.id === e.target);
          const innerPort = innerNode?.data.ports.find(p => `${e.target}__${p.id}` === tgtHandle);
          const source = state.nodes.find(n => n.id === e.source);
          const spec: ParamSpec = {
            at: source?.position ?? innerNode?.position ?? { x: 0, y: 0 },
            label: innerPort?.label ?? 'in',
            type: innerPort?.type ?? TUnknown,
            targets: [tgtHandle],
            outer: e,
          };
          bySource.set(srcHandle, spec);
          params.push(spec);
        }

        params.sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);

        // Parameter nodes go in a column just left of the wrapped nodes (and any
        // new function outputs just right of them)
        const minX = Math.min(...innerNodes.map(n => n.position.x));
        const maxX = Math.max(...innerNodes.map(n => n.position.x));
        const minY = Math.min(...innerNodes.map(n => n.position.y));
        for (const spec of params) {
          const portId   = `in_${newId()}`;
          const anchorId = newId();
          const paramLabel = uniqueParamLabel(spec.label);
          moduleInputPorts.push({ id: portId, label: paramLabel, direction: 'input', type: spec.type, connected: false });
          subgraphAnchors.push({
            id: anchorId, type: 'value',
            position: { x: minX - 240, y: minY + inputY },
            data: {
              kind: 'value', valueType: 'Int', literal: '__module_input__',
              ports: [{ id: 'result', label: paramLabel, direction: 'output', type: spec.type, connected: false }],
              _modulePortId: portId,
            } as any,
          } as LibNode);
          for (const tgtHandle of spec.targets) {
            extraInnerEdges.push({
              id: newId(), type: 'lib',
              source: anchorId, sourceHandle: `${anchorId}__result`,
              target: tgtHandle.split('__')[0], targetHandle: tgtHandle,
            } as LibEdge);
          }
          if (spec.outer) {
            extraOuterEdges.push({ ...spec.outer, id: newId(), target: moduleId, targetHandle: `${moduleId}__${portId}` });
          }
          inputY += 80;
        }

        // ── OUTPUT PORTS ──────────────────────────────────────────────────────
        // Case A: Output nodes inside the selection → each becomes a module output
        for (const node of innerNodes.filter(n => n.data.kind === 'output')) {
          const portId = `out_${newId()}`;
          const label  = (node.data as { label: string }).label || 'out';
          moduleOutputPorts.push({ id: portId, label, direction: 'output', type: TUnknown, connected: false });
          // Tag the inner Output node so buildModuleExpr can find it
          (node.data as any)._modulePortId = portId;
          outputY += 80;
        }

        // Case B: cross-out edges (inner wire goes to an external node)
        const seenCrossOutSources = new Map<string, string>(); // srcHandle → portId
        for (const e of crossOut) {
          const srcHandle = e.sourceHandle ?? `${e.source}__result`;
          if (!seenCrossOutSources.has(srcHandle)) {
            const portId   = `out_${newId()}`;
            const anchorId = newId();
            const innerNode = innerNodes.find(n => n.id === e.source);
            const innerPort = innerNode?.data.ports.find(p => `${e.source}__${p.id}` === srcHandle);
            seenCrossOutSources.set(srcHandle, portId);
            moduleOutputPorts.push({ id: portId, label: innerPort?.label ?? 'out', direction: 'output', type: innerPort?.type ?? TUnknown, connected: false });
            subgraphAnchors.push({
              id: anchorId, type: 'output',
              position: { x: maxX + 260, y: minY + outputY },
              data: {
                kind: 'output', label: innerPort?.label ?? 'out', lastValue: null,
                ports: [{ id: 'value', label: 'value', direction: 'input', type: innerPort?.type ?? TUnknown, connected: false }],
                _modulePortId: portId,
              } as any,
            } as LibNode);
            extraInnerEdges.push({ ...e, id: newId(), target: anchorId, targetHandle: `${anchorId}__value` });
            extraOuterEdges.push({ ...e, id: newId(), source: moduleId, sourceHandle: `${moduleId}__${portId}` });
            outputY += 80;
          } else {
            const portId = seenCrossOutSources.get(srcHandle)!;
            extraOuterEdges.push({ ...e, id: newId(), source: moduleId, sourceHandle: `${moduleId}__${portId}` });
          }
        }

        // Case C: nothing leaves the selection (e.g. a single node just dropped
        // on the canvas) → expose every unconnected inner output as a module output
        if (moduleOutputPorts.length === 0) {
          const usedSourceHandles = new Set(
            [...innerEdges, ...crossOut].map(e => e.sourceHandle ?? `${e.source}__result`)
          );
          for (const node of innerNodes) {
            for (const port of node.data.ports.filter(p => p.direction === 'output')) {
              const srcHandle = `${node.id}__${port.id}`;
              if (usedSourceHandles.has(srcHandle)) continue;
              const portId   = `out_${newId()}`;
              const anchorId = newId();
              moduleOutputPorts.push({ id: portId, label: port.label, direction: 'output', type: port.type, connected: false });
              subgraphAnchors.push({
                id: anchorId, type: 'output',
                position: { x: maxX + 260, y: minY + outputY },
                data: {
                  kind: 'output', label: port.label, lastValue: null,
                  ports: [{ id: 'value', label: 'value', direction: 'input', type: port.type, connected: false }],
                  _modulePortId: portId,
                } as any,
              } as LibNode);
              extraInnerEdges.push({
                id: newId(), type: 'lib',
                source: node.id, sourceHandle: srcHandle,
                target: anchorId, targetHandle: `${anchorId}__value`,
              } as LibEdge);
              outputY += 80;
            }
          }
        }

        // ── Save subgraph ─────────────────────────────────────────────────────
        state.subgraphs[subgraphId] = {
          nodes: [...innerNodes, ...subgraphAnchors],
          edges: [...innerEdges, ...extraInnerEdges],
        };

        // ── Place module node at centroid of selection ────────────────────────
        const cx = innerNodes.reduce((s, n) => s + n.position.x, 0) / (innerNodes.length || 1);
        const cy = innerNodes.reduce((s, n) => s + n.position.y, 0) / (innerNodes.length || 1);

        const allModulePorts = [...moduleInputPorts, ...moduleOutputPorts];
        const moduleNode: LibNode = {
          id: moduleId, type: 'module',
          position: { x: cx, y: cy },
          data: {
            kind: 'module', name, description: '',
            subgraphId,
            inputPorts: moduleInputPorts,
            outputPorts: moduleOutputPorts,
            ports: allModulePorts,
          } as ModuleNodeData,
        };

        state.nodes = [...outerNodes, moduleNode] as LibNode[];
        state.edges = [...outerEdges, ...extraOuterEdges];

        // Immediately sync so any Call node already bearing this function name
        // (typed in before wrapping) gets its ports without requiring a
        // navigate-out / navigate-in dance — inspired by Snap!'s Apply button.
        syncModuleNodeInState(state, subgraphId);
      });
    },

    setSubgraph: (subgraphId, nodes, edges) => {
      set((state) => {
        state.subgraphs[subgraphId] = { nodes, edges };
      });
    },

    getSubgraph: (subgraphId) => {
      return get().subgraphs[subgraphId];
    },

    pushSubgraph: (subgraphId) => {
      set((state) => {
        state.navStack.push(subgraphId);
        state.activeSubgraphId = subgraphId;
      });
    },

    popSubgraph: () => {
      set((state) => {
        const leavingId = state.activeSubgraphId;
        state.navStack.pop();
        state.activeSubgraphId = state.navStack[state.navStack.length - 1] ?? '';
        // Sync the module node's ports before the parent graph becomes visible
        if (leavingId) syncModuleNodeInState(state, leavingId);
      });
    },

    syncModuleNode: (subgraphId) => {
      set((state) => { syncModuleNodeInState(state, subgraphId); });
    },

    addParameter: () => {
      set((state) => {
        const sub = state.subgraphs[state.activeSubgraphId];
        if (!sub) return;
        pushHistory(state);
        const anchors = parameterAnchors(sub.nodes);
        const labels = new Set(anchors.map(n => n.data.ports[0]?.label));
        let label = 'x';
        for (let i = 2; labels.has(label); i++) label = `x${i}`;
        // Below the last parameter, or left of everything if there are none yet
        const last = anchors[anchors.length - 1];
        const position = last
          ? { x: last.position.x, y: last.position.y + 80 }
          : { x: Math.min(0, ...sub.nodes.map(n => n.position.x)) - 240, y: Math.min(0, ...sub.nodes.map(n => n.position.y)) };
        const id = newId();
        sub.nodes.push({
          id, type: 'value', position,
          data: {
            kind: 'value', valueType: 'Int', literal: '__module_input__',
            ports: [{ id: 'result', label, direction: 'output', type: TVar(`p_${id}`), connected: false }],
            _modulePortId: `in_${newId()}`,
          } as any,
        } as LibNode);
        syncModuleNodeInState(state, state.activeSubgraphId);
      });
    },

    moveParameter: (nodeId, direction) => {
      set((state) => {
        const sub = state.subgraphs[state.activeSubgraphId];
        if (!sub) return;
        const anchors = parameterAnchors(sub.nodes);
        const i = anchors.findIndex(n => n.id === nodeId);
        const j = i + direction;
        if (i < 0 || j < 0 || j >= anchors.length) return;
        pushHistory(state);
        // Order follows position, so swapping places swaps the parameters
        const a = sub.nodes.find(n => n.id === anchors[i].id)!;
        const b = sub.nodes.find(n => n.id === anchors[j].id)!;
        const aPos = { ...a.position };
        a.position = { ...b.position };
        b.position = aPos;
        syncModuleNodeInState(state, state.activeSubgraphId);
      });
    },
  }))
);
