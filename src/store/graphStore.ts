// ─── Graph store ───────────────────────────────────────────────────────────
// Central Zustand store for nodes, edges, and subgraphs.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  applyNodeChanges, applyEdgeChanges,
  type OnNodesChange, type OnEdgesChange, type OnConnect,
  type Connection, type XYPosition,
} from '@xyflow/react';
import type { LibNode, ModuleNodeData, Port } from '../types/nodes';
import type { LibEdge } from '../types/edges';
import { defaultEdgeData } from '../types/edges';
import { createNode } from '../nodes/registry';
import type { NodeDefinition } from '../nodes/registry';
import { newId } from '../utils/idGen';
import { TUnknown } from '../types/haskell';

export interface SubgraphState {
  nodes: LibNode[];
  edges: LibEdge[];
}

interface GraphState {
  // Root graph
  nodes: LibNode[];
  edges: LibEdge[];
  // Subgraphs keyed by subgraphId (for Module nodes)
  subgraphs: Record<string, SubgraphState>;

  // React Flow event handlers
  onNodesChange: OnNodesChange<LibNode>;
  onEdgesChange: OnEdgesChange<LibEdge>;
  onConnect: OnConnect;

  // Graph mutations
  addNode: (def: NodeDefinition, position: XYPosition) => void;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, updater: (data: LibNode['data']) => void) => void;
  loadGraph: (nodes: LibNode[], edges: LibEdge[], subgraphs?: Record<string, SubgraphState>) => void;
  clearGraph: () => void;

  // Subgraph / module actions
  wrapAsModule: (selectedNodeIds: string[], name: string) => void;
  setSubgraph: (subgraphId: string, nodes: LibNode[], edges: LibEdge[]) => void;
  getSubgraph: (subgraphId: string) => SubgraphState | undefined;

  // Nav: which graph is shown on canvas ('' = root, else subgraphId)
  activeSubgraphId: string;
  pushSubgraph: (subgraphId: string) => void;
  popSubgraph: () => void;
  navStack: string[];
}

export const useGraphStore = create<GraphState>()(
  immer((set, get) => ({
    nodes: [],
    edges: [],
    subgraphs: {},
    activeSubgraphId: '',
    navStack: [],

    onNodesChange: (changes) => {
      set((state) => {
        state.nodes = applyNodeChanges(changes, state.nodes) as LibNode[];
      });
    },

    onEdgesChange: (changes) => {
      set((state) => {
        state.edges = applyEdgeChanges(changes, state.edges) as LibEdge[];
      });
    },

    onConnect: (connection: Connection) => {
      set((state) => {
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

    addNode: (def, position) => {
      set((state) => {
        const node = createNode(def, position) as LibNode;
        state.nodes.push(node);
      });
    },

    removeNode: (id) => {
      set((state) => {
        state.nodes = state.nodes.filter(n => n.id !== id);
        state.edges = state.edges.filter(e => e.source !== id && e.target !== id);
      });
    },

    updateNodeData: (id, updater) => {
      set((state) => {
        const node = state.nodes.find(n => n.id === id);
        if (node) updater(node.data);
      });
    },

    loadGraph: (nodes, edges, subgraphs?) => {
      set((state) => {
        state.nodes = nodes as LibNode[];
        state.edges = edges as LibEdge[];
        if (subgraphs) state.subgraphs = subgraphs;
        state.activeSubgraphId = '';
        state.navStack = [];
      });
    },

    clearGraph: () => {
      set((state) => {
        state.nodes = [];
        state.edges = [];
        state.subgraphs = {};
        state.activeSubgraphId = '';
        state.navStack = [];
      });
    },

    // ── Subgraph / Module actions ────────────────────────────────────────

    wrapAsModule: (selectedNodeIds, name) => {
      set((state) => {
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

        // ── INPUT PORTS ───────────────────────────────────────────────────────
        // Case A: dangling inner input ports (nothing connected to them at all)
        for (const node of innerNodes) {
          for (const port of node.data.ports.filter(p => p.direction === 'input')) {
            const tgtHandle = `${node.id}__${port.id}`;
            if (!innerTargetHandles.has(tgtHandle) && !crossInTargetHandles.has(tgtHandle)) {
              const portId   = `in_${newId()}`;
              const anchorId = newId();
              moduleInputPorts.push({ id: portId, label: port.label, direction: 'input', type: port.type, connected: false });
              subgraphAnchors.push({
                id: anchorId, type: 'value',
                position: { x: -220, y: inputY },
                data: {
                  kind: 'value', valueType: 'Int', literal: '__module_input__',
                  ports: [{ id: 'result', label: port.label, direction: 'output', type: port.type, connected: false }],
                  _modulePortId: portId,
                } as any,
              } as LibNode);
              extraInnerEdges.push({
                id: newId(), type: 'lib',
                source: anchorId, sourceHandle: `${anchorId}__result`,
                target: node.id,  targetHandle: tgtHandle,
              } as LibEdge);
              inputY += 80;
            }
          }
        }

        // Case B: cross-in edges (an external wire is already arriving)
        const seenCrossInTargets = new Map<string, string>(); // tgtHandle → portId
        for (const e of crossIn) {
          const tgtHandle = e.targetHandle ?? `${e.target}__value`;
          if (!seenCrossInTargets.has(tgtHandle)) {
            const portId   = `in_${newId()}`;
            const anchorId = newId();
            const innerNode = innerNodes.find(n => n.id === e.target);
            const innerPort = innerNode?.data.ports.find(p => `${e.target}__${p.id}` === tgtHandle);
            seenCrossInTargets.set(tgtHandle, portId);
            moduleInputPorts.push({ id: portId, label: innerPort?.label ?? 'in', direction: 'input', type: innerPort?.type ?? TUnknown, connected: false });
            subgraphAnchors.push({
              id: anchorId, type: 'value',
              position: { x: -220, y: inputY },
              data: {
                kind: 'value', valueType: 'Int', literal: '__module_input__',
                ports: [{ id: 'result', label: innerPort?.label ?? 'in', direction: 'output', type: innerPort?.type ?? TUnknown, connected: false }],
                _modulePortId: portId,
              } as any,
            } as LibNode);
            extraInnerEdges.push({
              id: newId(), type: 'lib',
              source: anchorId, sourceHandle: `${anchorId}__result`,
              target: e.target,  targetHandle: tgtHandle,
            } as LibEdge);
            extraOuterEdges.push({ ...e, id: newId(), target: moduleId, targetHandle: `${moduleId}__${portId}` });
            inputY += 80;
          } else {
            const portId = seenCrossInTargets.get(tgtHandle)!;
            extraOuterEdges.push({ ...e, id: newId(), target: moduleId, targetHandle: `${moduleId}__${portId}` });
          }
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
              position: { x: 500, y: outputY },
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
        state.navStack.pop();
        state.activeSubgraphId = state.navStack[state.navStack.length - 1] ?? '';
      });
    },
  }))
);
