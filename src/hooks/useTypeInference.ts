// ─── useTypeInference ──────────────────────────────────────────────────────
// Subscribes to the graph store and re-runs the type checker whenever
// nodes or edges change. Results are written into typeStore (not back into
// the edges themselves) to avoid infinite update loops.

import { useEffect } from 'react';
import { useGraphStore } from '../store/graphStore';
import { useTypeStore }  from '../store/typeStore';
import { checkGraph }    from '../engine/typeChecker';

export function useTypeInference() {
  useEffect(() => {
    const run = (nodes = useGraphStore.getState().nodes,
                 edges = useGraphStore.getState().edges) => {
      const checked = checkGraph(nodes, edges);
      useTypeStore.getState().setCheckedEdges(checked);
    };

    // Zustand 5: subscribe takes a plain (state, prevState) => void listener
    const unsub = useGraphStore.subscribe((state, prev) => {
      // Only re-run if nodes or edges actually changed reference
      if (state.nodes !== prev.nodes || state.edges !== prev.edges) {
        run(state.nodes, state.edges);
      }
    });

    // Run once immediately on mount
    run();
    return unsub;
  }, []);
}
