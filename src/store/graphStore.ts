// ─── Graph store ───────────────────────────────────────────────────────────
// Central Zustand store for nodes, edges, and subgraphs.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  applyNodeChanges, applyEdgeChanges,
  type OnNodesChange, type OnEdgesChange, type OnConnect,
  type Connection, type XYPosition,
} from '@xyflow/react';
import type { LibNode } from '../types/nodes';
import type { LibEdge } from '../types/edges';
import { defaultEdgeData } from '../types/edges';
import { createNode } from '../nodes/registry';
import type { NodeDefinition } from '../nodes/registry';
import { newId } from '../utils/idGen';

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
}

export const useGraphStore = create<GraphState>()(
  immer((set) => ({
    nodes: [],
    edges: [],
    subgraphs: {},

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
  }))
);
