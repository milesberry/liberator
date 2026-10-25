// ─── Type store ────────────────────────────────────────────────────────────
// Holds the latest type-checker results keyed by edge ID.
// WireEdge reads from here instead of edge.data so we avoid the
// write-to-edges → subscribe → write-to-edges infinite loop.

import { create } from 'zustand';
import type { CheckedEdge } from '../engine/typeChecker';
import type { HaskellType } from '../types/haskell';

interface TypeState {
  checkedEdges: Map<string, CheckedEdge>;
  portTypes:    Map<string, HaskellType>;   // inferred, keyed by nodeId__portId
  setCheckedEdges: (results: CheckedEdge[], portTypes?: Map<string, HaskellType>) => void;
}

export const useTypeStore = create<TypeState>((set) => ({
  checkedEdges: new Map(),
  portTypes:    new Map(),
  setCheckedEdges: (results, portTypes = new Map()) =>
    set({ checkedEdges: new Map(results.map(r => [r.id, r])), portTypes }),
}));
