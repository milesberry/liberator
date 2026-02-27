// ─── Auto-layout: left-to-right DAG (longest-path layering) ────────────────
// Pure TypeScript, no external dependencies.
// Assigns each node to a "column" (layer) based on the longest path from any
// source node (in-degree 0).  Within each column nodes are spaced evenly and
// centred vertically.

import type { LibNode } from '../types/nodes';
import type { LibEdge } from '../types/edges';

const COL_WIDTH  = 220;   // horizontal gap between layers (px)
const ROW_HEIGHT = 120;   // vertical gap between nodes in a layer (px)

export interface LayoutPosition {
  x: number;
  y: number;
}

export function computeLayout(
  nodes: LibNode[],
  edges: LibEdge[],
): Record<string, LayoutPosition> {
  if (nodes.length === 0) return {};

  // ── Step 1: build inDegree + successors ─────────────────────────────────
  const nodeIds    = new Set(nodes.map(n => n.id));
  const inDegree   = new Map<string, number>();
  const successors = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    successors.set(n.id, []);
  }

  for (const e of edges) {
    // Skip stale edges that reference nodes not in the current view
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    successors.get(e.source)!.push(e.target);
  }

  // ── Step 2: BFS / Kahn's longest-path layer assignment ──────────────────
  // layer[n] = longest path (in edges) from any source to n
  const layer = new Map<string, number>();

  const queue: string[] = [];
  for (const n of nodes) {
    if (inDegree.get(n.id) === 0) {
      layer.set(n.id, 0);
      queue.push(n.id);
    }
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    const currentLayer = layer.get(id) ?? 0;

    for (const succ of successors.get(id) ?? []) {
      // Longest-path: update layer only if we found a longer path
      const existing = layer.get(succ) ?? -1;
      const proposed = currentLayer + 1;
      if (proposed > existing) {
        layer.set(succ, proposed);
      }

      // Kahn's: decrement in-degree; enqueue when all predecessors visited
      const deg = (inDegree.get(succ) ?? 1) - 1;
      inDegree.set(succ, deg);
      if (deg === 0) {
        queue.push(succ);
      }
    }
  }

  // ── Step 3: fallback for cycle members / orphans ─────────────────────────
  for (const n of nodes) {
    if (!layer.has(n.id)) layer.set(n.id, 0);
  }

  // ── Step 4: group by layer, assign positions ─────────────────────────────
  const byLayer = new Map<number, string[]>();
  for (const n of nodes) {
    const l = layer.get(n.id) ?? 0;
    const bucket = byLayer.get(l) ?? [];
    bucket.push(n.id);
    byLayer.set(l, bucket);
  }

  const positions: Record<string, LayoutPosition> = {};

  for (const [l, ids] of byLayer) {
    const count = ids.length;
    ids.forEach((id, i) => {
      positions[id] = {
        x: l * COL_WIDTH,
        // Centre the column vertically around y = 0
        y: (i - (count - 1) / 2) * ROW_HEIGHT,
      };
    });
  }

  return positions;
}
