// ─── Graph serialisation ───────────────────────────────────────────────────
// Saves/loads the graph topology to/from localStorage.
// VFun values are never serialised (not needed — re-evaluate on load).

import type { LibNode } from '../types/nodes';
import type { LibEdge } from '../types/edges';

const STORAGE_KEY = 'liberator-graph-v1';

export interface SavedGraph {
  version: 1;
  name: string;
  savedAt: string;
  nodes: LibNode[];
  edges: LibEdge[];
}

export function saveGraph(nodes: LibNode[], edges: LibEdge[], name = 'My program'): void {
  const data: SavedGraph = {
    version: 1,
    name,
    savedAt: new Date().toISOString(),
    nodes,
    edges,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadGraph(): SavedGraph | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedGraph;
  } catch {
    return null;
  }
}

export function clearSaved(): void {
  localStorage.removeItem(STORAGE_KEY);
}
