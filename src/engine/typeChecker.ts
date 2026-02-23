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
  // Build lookup maps
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // We'll accumulate a global substitution as we process edges in topological order.
  // For simplicity (and correctness for trees / DAGs), we do two passes:
  // pass 1 — collect all unifications; pass 2 — apply and annotate.

  type Subst = Map<string, HaskellType>;
  let subst: Subst = new Map();

  // Helper: get a port's current type with substitution applied
  const portType = (nodeId: string, portId: string): HaskellType => {
    const node = nodeById.get(nodeId);
    if (!node) return TUnknown;
    const port = node.data.ports.find(p => p.id === portId);
    if (!port) return TUnknown;
    return applySubst(subst, port.type);
  };

  // Pass 1: unify along each edge, building up substitution
  for (const edge of edges) {
    const srcPortId = edge.sourceHandle?.split('__')[1];
    const tgtPortId = edge.targetHandle?.split('__')[1];
    if (!srcPortId || !tgtPortId) continue;

    const srcType = portType(edge.source, srcPortId);
    const tgtType = portType(edge.target, tgtPortId);

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

    const srcType = portType(edge.source, srcPortId);
    const tgtType = portType(edge.target, tgtPortId);

    // Re-resolve with full subst
    const resolvedSrc = applySubst(subst, srcType);
    const resolvedTgt = applySubst(subst, tgtType);

    // Compatible if unification succeeds
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
