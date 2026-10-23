// ─── UI store ──────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { LibNode, LibNodeData } from '../types/nodes';
import type { LibEdge } from '../types/edges';

// A clipboard entry: a deep-plain-object snapshot of a node (no Immer proxies)
export interface ClipboardNode {
  id: string;                         // the copied node's id, so wires can be remapped
  data: LibNodeData;
  position: { x: number; y: number };
  type: string;
}

// A wire between two copied nodes, by their original ids and port ids
export interface ClipboardEdge {
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
}

export interface Clipboard {
  nodes: ClipboardNode[];
  edges: ClipboardEdge[];
}

export type Theme = 'dark' | 'light';

interface UIState {
  selectedNodeId:  string | null;
  selectedNodeIds: string[];                // multi-selection (mirrors RF selection)
  selectedEdgeId:  string | null;           // single selected edge
  clipboard:       Clipboard | null;        // null = nothing copied yet
  graphNavStack:   string[];
  paletteSearchQuery: string;
  activeOutputTab: 'results' | 'errors';
  showHaskell:     boolean;                 // Haskell code panel visibility
  theme:           Theme;

  setSelectedNodeId:  (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setSelectedEdgeId:  (id: string | null) => void;
  setClipboard:       (clipboard: Clipboard | null) => void;
  pushSubgraph: (subgraphId: string) => void;
  popSubgraph:  () => void;
  setSearchQuery: (q: string) => void;
  setOutputTab:   (tab: 'results' | 'errors') => void;
  setShowHaskell: (v: boolean) => void;
  setTheme:       (t: Theme) => void;
}

// Apply theme to <html> so CSS vars cascade everywhere (incl. ReactFlow portals)
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// Initialise from localStorage or system preference
const savedTheme = (localStorage.getItem('liberator-theme') as Theme | null);
const initialTheme: Theme = savedTheme ?? 'dark';
applyTheme(initialTheme);

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId:  null,
  selectedNodeIds: [],
  selectedEdgeId:  null,
  clipboard:       null,
  graphNavStack:   [],
  paletteSearchQuery: '',
  activeOutputTab: 'results',
  showHaskell:     false,
  theme:           initialTheme,

  setSelectedNodeId:  (id)  => set({ selectedNodeId: id }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  setSelectedEdgeId:  (id)  => set({ selectedEdgeId: id }),
  setClipboard:       (clipboard) => set({ clipboard }),
  pushSubgraph: (id) => set((s) => ({ graphNavStack: [...s.graphNavStack, id] })),
  popSubgraph:  ()   => set((s) => ({ graphNavStack: s.graphNavStack.slice(0, -1) })),
  setSearchQuery: (q)   => set({ paletteSearchQuery: q }),
  setOutputTab:   (tab) => set({ activeOutputTab: tab }),
  setShowHaskell: (v)   => set({ showHaskell: v }),
  setTheme: (t) => {
    applyTheme(t);
    localStorage.setItem('liberator-theme', t);
    set({ theme: t });
  },
}));

// ─── Helper: snapshot selected nodes from the active graph ─────────────────
// Returns a Clipboard that can be stored in uiStore.clipboard: the selected
// nodes, plus the wires that run between them. Wires to unselected nodes are
// left behind, so a pasted copy never shares inputs with the original.
// Handles deep-cloning data (strips Immer proxies via JSON round-trip).
export function snapshotNodes(nodes: LibNode[], edges: LibEdge[], ids: Set<string>): Clipboard {
  return {
    nodes: nodes
      .filter(n => ids.has(n.id))
      .map(n => ({
        id:       n.id,
        // JSON round-trip gives a plain object — safe to store outside Immer
        data:     JSON.parse(JSON.stringify(n.data)) as LibNodeData,
        position: { x: n.position.x, y: n.position.y },
        type:     n.type ?? n.data.kind,
      })),
    edges: edges
      .filter(e => ids.has(e.source) && ids.has(e.target))
      .map(e => ({
        source:     e.source,
        sourcePort: e.sourceHandle?.split('__')[1] ?? '',
        target:     e.target,
        targetPort: e.targetHandle?.split('__')[1] ?? '',
      })),
  };
}
