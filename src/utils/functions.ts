// ─── User-defined functions ──────────────────────────────────────────────────
// Helpers for finding the named Functions (module nodes) in a graph, so they
// can be listed in the palette and dropped onto the canvas as Call nodes.

import type { LibNode, ModuleNodeData, CallNodeData } from '../types/nodes';
import { TUnknown } from '../types/haskell';

// Every distinct named Function, whether defined at the root or nested inside
// another Function's subgraph. Sorted alphabetically by name.
export function listFunctions(
  rootNodes: LibNode[],
  subgraphs: Record<string, { nodes: LibNode[] }>,
): ModuleNodeData[] {
  const all = [...rootNodes, ...Object.values(subgraphs).flatMap(sub => sub.nodes)];
  const byName = new Map<string, ModuleNodeData>();
  for (const n of all) {
    if (n.data.kind !== 'module') continue;
    const md = n.data as ModuleNodeData;
    if (md.name && !byName.has(md.name)) byName.set(md.name, md);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// e.g. "power b n" — the function as it would be applied in Haskell
export function signatureOf(md: ModuleNodeData): string {
  return [md.name, ...md.inputPorts.map(p => p.label)].join(' ');
}

// Data for a Call node already pointing at `md`, with ports mirroring the
// Function's (same port ids, as CallNode's own name lookup produces).
export function callDataFor(md: ModuleNodeData): CallNodeData {
  return {
    kind: 'call',
    targetName: md.name,
    ports: [
      ...md.inputPorts.map(p => ({ ...p, type: p.type ?? TUnknown, connected: false })),
      ...md.outputPorts.map(p => ({ ...p, type: p.type ?? TUnknown, connected: false })),
    ],
  };
}
