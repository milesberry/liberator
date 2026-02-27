// ─── Graph serialisation ───────────────────────────────────────────────────
// Saves/loads the graph topology to/from localStorage.
// VFun values are never serialised (not needed — re-evaluate on load).

import type { LibNode } from '../types/nodes';
import type { LibEdge } from '../types/edges';
import type { SubgraphState } from '../store/graphStore';

const STORAGE_KEY = 'liberator-graph-v1';

export interface SavedGraph {
  version: 1;
  name: string;
  savedAt: string;
  nodes: LibNode[];
  edges: LibEdge[];
  subgraphs?: Record<string, SubgraphState>;
}

export function saveGraph(
  nodes: LibNode[],
  edges: LibEdge[],
  subgraphs: Record<string, SubgraphState> = {},
  name = 'My program'
): void {
  const data: SavedGraph = {
    version: 1,
    name,
    savedAt: new Date().toISOString(),
    nodes,
    edges,
    subgraphs,
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

// ─── File-based save / load / export ──────────────────────────────────────

/** Trigger a browser download of any text blob. */
function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download the current graph as a .json file. */
export function saveGraphAsJson(
  nodes: LibNode[],
  edges: LibEdge[],
  subgraphs: Record<string, SubgraphState> = {},
  name = 'My program',
): void {
  const data: SavedGraph = {
    version: 1,
    name,
    savedAt: new Date().toISOString(),
    nodes,
    edges,
    subgraphs,
  };
  const filename = name.replace(/[^a-z0-9_\- ]/gi, '_').replace(/\s+/g, '_') + '.json';
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json');
}

/** Parse a .json file chosen by the user and return a SavedGraph, or null on error. */
export function loadGraphFromJson(file: File): Promise<SavedGraph | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as SavedGraph;
        if (parsed.version !== 1) { resolve(null); return; }
        resolve(parsed);
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

/** Download the Haskell pretty-print as a .hs file. */
export function exportGraphAsHaskell(haskellSource: string, name = 'My program'): void {
  const filename = name.replace(/[^a-z0-9_\- ]/gi, '_').replace(/\s+/g, '_') + '.hs';
  downloadText(filename, haskellSource, 'text/plain');
}
