// ─── useTypeInference ──────────────────────────────────────────────────────
// Subscribes to the graph store and re-runs the type checker whenever
// nodes or edges change. Results are written into typeStore (not back into
// the edges themselves) to avoid infinite update loops.
//
// Subgraph-aware: when inside a subgraph, runs the checker on the active
// subgraph's nodes/edges rather than the root graph.

import { useEffect } from 'react';
import { useGraphStore } from '../store/graphStore';
import { useTypeStore }  from '../store/typeStore';
import { checkGraph }    from '../engine/typeChecker';

export function useTypeInference() {
  useEffect(() => {
    const run = () => {
      const state = useGraphStore.getState();
      const activeId = state.activeSubgraphId;
      const sub = activeId ? state.subgraphs[activeId] : null;
      const nodes = sub?.nodes ?? state.nodes;
      const edges = sub?.edges ?? state.edges;
      const checked = checkGraph(nodes, edges);
      useTypeStore.getState().setCheckedEdges(checked);
    };

    // Zustand 5: subscribe takes a plain (state, prevState) => void listener
    const unsub = useGraphStore.subscribe((state, prev) => {
      const activeId = state.activeSubgraphId;

      // Re-run if the active subgraph changed
      if (activeId !== prev.activeSubgraphId) { run(); return; }

      if (activeId) {
        // Inside a subgraph — re-run if this subgraph's nodes/edges changed
        const sub     = state.subgraphs[activeId];
        const prevSub = prev.subgraphs[activeId];
        if (sub?.nodes !== prevSub?.nodes || sub?.edges !== prevSub?.edges) {
          run();
        }
      } else {
        // Root graph — re-run if root nodes or edges changed
        if (state.nodes !== prev.nodes || state.edges !== prev.edges) {
          run();
        }
      }
    });

    // Run once immediately on mount
    run();
    return unsub;
  }, []);
}
