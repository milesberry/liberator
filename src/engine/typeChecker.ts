// ─── Type checker ──────────────────────────────────────────────────────────
// Runs over the graph after every change.
// For each edge, attempts to unify the source output port type with the target
// input port type, propagating the resulting substitution back to all ports.
// Also handles partial application: a PrimOp/HOF node with k of n inputs
// connected produces an output type of (t_{k+1} -> ... -> t_n -> result).

import type { LibNode } from '../types/nodes';
import type { LibEdge } from '../types/edges';
import {
  unify, applySubst, TFun, TUnknown, typesEqual,
  type HaskellType,
} from '../types/haskell';
import type { Port } from '../types/nodes';

// ─── Result ───────────────────────────────────────────────────────────────

export interface CheckedEdge {
  id: string;
  sourceType: HaskellType;
  targetType: HaskellType;
  compatible: boolean;
  errorMessage?: string;
}

// ─── Main entry point ─────────────────────────────────────────────────────

export function checkGraph(
  nodes: LibNode[],
  edges: LibEdge[],
): CheckedEdge[] {
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  type Subst = Map<string, HaskellType>;
  let subst: Subst = new Map();

  // Build a map: nodeId → set of connected input portIds
  const connectedInputs = new Map<string, Set<string>>();
  for (const edge of edges) {
    const tgtPortId = edge.targetHandle?.split('__')[1];
    if (!tgtPortId) continue;
    const s = connectedInputs.get(edge.target) ?? new Set<string>();
    s.add(tgtPortId);
    connectedInputs.set(edge.target, s);
  }

  // Compute the effective output type for a node's output port.
  // For primop/hof/listop with unconnected inputs, the result is a partial-application
  // function type: (missing0 → missing1 → … → declared_result).
  const effectiveOutputType = (nodeId: string, portId: string): HaskellType => {
    const node = nodeById.get(nodeId);
    if (!node) return TUnknown;
    const d = node.data;
    const port = d.ports.find(p => p.id === portId);
    if (!port) return TUnknown;

    // Only compute partial-app type for result ports on multi-input nodes
    if (portId === 'result' && (d.kind === 'primop' || d.kind === 'hof' || d.kind === 'listop')) {
      const inputPorts = d.ports.filter(p => p.direction === 'input');
      if (inputPorts.length > 1) {
        const connected = connectedInputs.get(nodeId) ?? new Set<string>();
        return applySubst(subst, partialAppOutputType(inputPorts, port.type, connected));
      }
    }

    return applySubst(subst, port.type);
  };

  // Pass 1: unify along each edge, building substitution
  for (const edge of edges) {
    const srcPortId = edge.sourceHandle?.split('__')[1];
    const tgtPortId = edge.targetHandle?.split('__')[1];
    if (!srcPortId || !tgtPortId) continue;

    const srcType = effectiveOutputType(edge.source, srcPortId);
    const tgtType = applySubst(subst, nodeById.get(edge.target)?.data.ports.find(p => p.id === tgtPortId)?.type ?? TUnknown);

    const result = unify(srcType, tgtType, subst);
    if (result) subst = result;
  }

  // Pass 2: annotate each edge with resolved types + compatibility
  const checkedEdges: CheckedEdge[] = edges.map(edge => {
    const srcPortId = edge.sourceHandle?.split('__')[1];
    const tgtPortId = edge.targetHandle?.split('__')[1];
    if (!srcPortId || !tgtPortId) {
      return { id: edge.id, sourceType: TUnknown, targetType: TUnknown, compatible: false, errorMessage: 'Missing port handle' };
    }

    const resolvedSrc = applySubst(subst, effectiveOutputType(edge.source, srcPortId));
    const resolvedTgt = applySubst(subst, nodeById.get(edge.target)?.data.ports.find(p => p.id === tgtPortId)?.type ?? TUnknown);

    const testResult = unify(resolvedSrc, resolvedTgt, new Map());
    const compatible = testResult !== null;

    return {
      id: edge.id,
      sourceType: resolvedSrc,
      targetType: resolvedTgt,
      compatible,
      errorMessage: compatible ? undefined : `Cannot match ${showTypeSimple(resolvedSrc)} with ${showTypeSimple(resolvedTgt)}`,
    };
  });

  return checkedEdges;
}

// ─── Partial application output type ─────────────────────────────────────
// Given a node's ports and the set of connected input port IDs, compute
// what the output port type should be.
// e.g. (+) with arg0 connected but not arg1: output becomes Int -> Int
//
// Used by the type checker to update output port types reactively.

export function partialAppOutputType(
  inputPorts: Port[],
  outputType: HaskellType,
  connectedInputIds: Set<string>,
): HaskellType {
  // Find unconnected inputs in order
  const unconnected = inputPorts.filter(p => !connectedInputIds.has(p.id));
  if (unconnected.length === 0) return outputType;
  // Build a curried function type for the remaining inputs
  return unconnected.reduceRight<HaskellType>(
    (acc, port) => TFun(port.type, acc),
    outputType,
  );
}

// Simple type display for error messages (avoids circular dep on showType)
function showTypeSimple(t: HaskellType): string {
  switch (t.tag) {
    case 'Int':     return 'Int';
    case 'Float':   return 'Float';
    case 'Bool':    return 'Bool';
    case 'String':  return 'String';
    case 'Unknown': return '?';
    case 'TypeVar': return t.name.split('_')[0];
    case 'List':    return `[${showTypeSimple(t.elem)}]`;
    case 'Fun':     return `${showTypeSimple(t.from)} → ${showTypeSimple(t.to)}`;
    case 'Tuple':   return `(${t.elems.map(showTypeSimple).join(', ')})`;
  }
}
