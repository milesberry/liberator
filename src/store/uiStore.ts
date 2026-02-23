// ─── UI store ──────────────────────────────────────────────────────────────

import { create } from 'zustand';

interface UIState {
  selectedNodeId: string | null;
  graphNavStack: string[];          // empty = root; non-empty = inside a module
  paletteSearchQuery: string;
  activeOutputTab: 'results' | 'errors';

  setSelectedNodeId: (id: string | null) => void;
  pushSubgraph: (subgraphId: string) => void;
  popSubgraph: () => void;
  setSearchQuery: (q: string) => void;
  setOutputTab: (tab: 'results' | 'errors') => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId: null,
  graphNavStack: [],
  paletteSearchQuery: '',
  activeOutputTab: 'results',

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  pushSubgraph: (id) => set((s) => ({ graphNavStack: [...s.graphNavStack, id] })),
  popSubgraph: () => set((s) => ({ graphNavStack: s.graphNavStack.slice(0, -1) })),
  setSearchQuery: (q) => set({ paletteSearchQuery: q }),
  setOutputTab: (tab) => set({ activeOutputTab: tab }),
}));
