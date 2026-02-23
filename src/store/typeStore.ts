// ─── Type store ────────────────────────────────────────────────────────────
// Holds the latest type-checker results keyed by edge ID.
// WireEdge reads from here instead of edge.data so we avoid the
// write-to-edges → subscribe → write-to-edges infinite loop.

import { create } from 'zustand';
import type { CheckedEdge } from '../engine/typeChecker';

interface TypeState {
  checkedEdges: Map<string, CheckedEdge>;
  setCheckedEdges: (results: CheckedEdge[]) => void;
}

export const useTypeStore = create<TypeState>((set) => ({
  checkedEdges: new Map(),
  setCheckedEdges: (results) =>
    set({ checkedEdges: new Map(results.map(r => [r.id, r])) }),
}));
