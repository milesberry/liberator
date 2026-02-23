// ─── useTypeInference ──────────────────────────────────────────────────────
// Subscribes to the graph store and re-runs the type checker whenever
// nodes or edges change. Writes compatibility + type data back into edges
// so WireEdge can colour them correctly.

import { useEffect } from 'react';
import { useGraphStore } from '../store/graphStore';
import { checkGraph } from '../engine/typeChecker';

export function useTypeInference() {
  // Subscribe to nodes + edges; re-run checker on every change.
  useEffect(() => {
    // Run once immediately, then subscribe
    const run = () => {
      const { nodes, edges } = useGraphStore.getState();
      if (edges.length === 0) return;

      const checked = checkGraph(nodes, edges);

      // Write type info back into each edge's data without triggering
      // a full re-render — we use setState directly on the store.
      useGraphStore.setState(state => ({
        edges: state.edges.map(edge => {
          const info = checked.find(c => c.id === edge.id);
          if (!info) return edge;
          // Only update if something changed (avoids infinite loops)
          if (
            edge.data?.compatible === info.compatible &&
            edge.data?.errorMessage === info.errorMessage
          ) return edge;
          return {
            ...edge,
            data: {
              ...edge.data,
              sourceType: info.sourceType,
              targetType: info.targetType,
              compatible: info.compatible,
              errorMessage: info.errorMessage,
            },
          };
        }),
      }));
    };

    // Subscribe to store changes
    const unsub = useGraphStore.subscribe(
      state => ({ nodes: state.nodes, edges: state.edges }),
      run,
      { equalityFn: (a, b) => a.nodes === b.nodes && a.edges === b.edges },
    );

    // Run once on mount
    run();
    return unsub;
  }, []);
}
