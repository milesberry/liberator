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

// The Function node with this name, wherever it is defined
export function findFunctionNode(
  name: string,
  rootNodes: LibNode[],
  subgraphs: Record<string, { nodes: LibNode[] }>,
): LibNode | undefined {
  return [...rootNodes, ...Object.values(subgraphs).flatMap(sub => sub.nodes)]
    .find(n => n.data.kind === 'module' && (n.data as ModuleNodeData).name === name);
}

// Point a Call node's data at the named Function, mirroring its ports. If no
// Function has that name yet (a forward reference, e.g. to the Function being
// built), the existing ports are kept so wires stay attached.
export function bindCall(cd: CallNodeData, name: string, target: ModuleNodeData | undefined): void {
  cd.targetName = name;
  if (!name) { cd.ports = []; return; }
  if (target) cd.ports = callDataFor(target).ports;
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
