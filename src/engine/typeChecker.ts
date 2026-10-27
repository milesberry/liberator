// ─── Type checker ──────────────────────────────────────────────────────────
// Runs over the graph after every change.
// For each edge, attempts to unify the source output port type with the target
// input port type, propagating the resulting substitution back to all ports.
// Also handles partial application: a PrimOp/HOF node with k of n inputs
// connected produces an output type of (t_{k+1} -> ... -> t_n -> result).

import type { LibNode } from '../types/nodes';
import type { LibEdge } from '../types/edges';
import {
  unify, applySubst, TFun, TUnknown,
  type HaskellType,
} from '../types/haskell';
import type { Port } from '../types/nodes';
import { listLiteralType } from './toExprTree';

// ─── Result ───────────────────────────────────────────────────────────────

export interface CheckedEdge {
  id: string;
  sourceType: HaskellType;
  targetType: HaskellType;
  compatible: boolean;
  errorMessage?: string;   // full explanation, with a hint where one helps
  errorShort?: string;     // compact version for the label on the wire
}

// ─── Main entry point ─────────────────────────────────────────────────────

export function checkGraph(nodes: LibNode[], edges: LibEdge[]): CheckedEdge[] {
  return analyseGraph(nodes, edges).edges;
}

// The edge results plus the inferred type of every port, keyed by handle id
// (nodeId__portId), so the Properties panel can say what a port accepts
export function analyseGraph(
  nodes: LibNode[],
  edges: LibEdge[],
): { edges: CheckedEdge[]; portTypes: Map<string, HaskellType> } {
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

    // A typed-in list's items say what it's a list of
    if (d.kind === 'value' && d.valueType === 'List' && !d._modulePortId) {
      return listLiteralType(d.literal);
    }

    // One-input nodes count too, as the evaluator treats them: negate with
    // its input empty is the function negate, ready for map or compose
    if (portId === 'result' && (d.kind === 'primop' || d.kind === 'hof' || d.kind === 'listop')) {
      const inputPorts = d.ports.filter(p => p.direction === 'input');
      if (inputPorts.length > 0) {
        const connected = connectedInputs.get(nodeId) ?? new Set<string>();
        return applySubst(subst, partialAppOutputType(inputPorts, port.type, connected));
      }
    }

    // Module and Call nodes with unconnected inputs act as partially-applied
    // functions. e.g. lcmPair with both inputs unconnected has output type
    // Int → Int → Int, which is what foldr expects when passed as a HOF argument.
    if ((d.kind === 'module' || d.kind === 'call') && port.direction === 'output') {
      const inputPorts = d.ports.filter(p => p.direction === 'input');
      if (inputPorts.length > 0) {
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

    const msg = compatible ? undefined : mismatchMessage(edge.source, edge.target, tgtPortId, resolvedSrc, resolvedTgt);
    return {
      id: edge.id,
      sourceType: resolvedSrc,
      targetType: resolvedTgt,
      compatible,
      errorMessage: msg?.full,
      errorShort: msg?.short,
    };
  });

  // Pass 3: type classes. A wire can match its port's type and still break a
  // node's class: True wired into + makes a = Bool, but + needs a number.
  for (const node of nodes) {
    const need = classConstraint(node);
    if (!need) continue;
    const declared = node.data.ports.find(p => p.id === need.port)?.type;
    if (declared?.tag !== 'TypeVar') continue;
    const resolved = applySubst(subst, declared);
    if (satisfies(need.cls, resolved)) continue;
    // Blame the wires in that bring a type outside the class. A wire that
    // only clashes with them (1 beside True, both into +) is fine, so clear it.
    const portType = (portId: string | undefined) => node.data.ports.find(p => p.id === portId)?.type;
    const atVar = (t: HaskellType | undefined, carried: HaskellType) => {
      const s = t && unify(t, carried, new Map());
      return s ? applySubst(s, declared) : TUnknown;
    };
    const inward = edges.flatMap((e, i) => {
      const t = portType(e.targetHandle?.split('__')[1]);
      return e.target === node.id && typeMentions(t, declared.name) ? [{ c: checkedEdges[i], t }] : [];
    });
    const culprits = inward.filter(({ c, t }) => !satisfies(need.cls, atVar(t, c.sourceType)));
    for (const { c } of culprits) {
      const msg = classMessage(node, need.cls, resolved, c.sourceType, true);
      c.compatible = false;
      c.errorMessage = msg.full;
      c.errorShort = msg.short;
    }
    if (culprits.length > 0) {
      for (const { c } of inward) {
        if (culprits.some(x => x.c === c) || c.compatible) continue;
        c.compatible = true;
        c.errorMessage = c.errorShort = undefined;
      }
      continue;
    }
    // None of the wires in is to blame, so the wires out forced the bad type
    edges.forEach((e, i) => {
      const c = checkedEdges[i];
      if (e.source !== node.id || !c.compatible) return;
      if (!typeMentions(portType(e.sourceHandle?.split('__')[1]), declared.name)) return;
      const msg = classMessage(node, need.cls, resolved, c.sourceType, false);
      c.compatible = false;
      c.errorMessage = msg.full;
      c.errorShort = msg.short;
    });
  }

  const portTypes = new Map<string, HaskellType>();
  for (const node of nodes) {
    for (const port of node.data.ports) {
      portTypes.set(`${node.id}__${port.id}`, port.direction === 'output'
        ? effectiveOutputType(node.id, port.id)
        : applySubst(subst, port.type));
    }
  }

  return { edges: checkedEdges, portTypes };

  // Does a wire into this node carry a function where a value is wanted?
  function carriesFunctionWhereValueWanted(nodeId: string): boolean {
    return edges.some(e => {
      if (e.target !== nodeId) return false;
      const srcPortId = e.sourceHandle?.split('__')[1];
      const tgtPortId = e.targetHandle?.split('__')[1];
      if (!srcPortId || !tgtPortId) return false;
      const from = applySubst(subst, effectiveOutputType(e.source, srcPortId));
      const to   = applySubst(subst, nodeById.get(nodeId)?.data.ports.find(p => p.id === tgtPortId)?.type ?? TUnknown);
      return from.tag === 'Fun' && to.tag !== 'Fun' && to.tag !== 'TypeVar' && to.tag !== 'Unknown';
    });
  }

  // Follow wires on from a node: does the chain end up in an input that wants a
  // function, like filter's test p or map's f? If so, name it ("filter's p").
  function functionInputDownstream(nodeId: string): string | undefined {
    const seen = new Set<string>();
    let frontier = [nodeId];
    for (let depth = 0; depth < 8 && frontier.length > 0; depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        if (seen.has(id)) continue;
        seen.add(id);
        for (const e of edges.filter(e => e.source === id)) {
          const target = nodeById.get(e.target);
          const portId = e.targetHandle?.split('__')[1];
          const port = target?.data.ports.find(p => p.id === portId);
          if (target && port?.type.tag === 'Fun') return `${nodeName(target)}'s ${port.label}`;
          next.push(e.target);
        }
      }
      frontier = next;
    }
    return undefined;
  }

  // A student-friendly explanation of a type mismatch on one wire. The common
  // slip is a function where a value is wanted, or vice versa, so those cases
  // say which inputs to connect or leave empty.
  function mismatchMessage(srcId: string, tgtId: string, tgtPortId: string,
                           src: HaskellType, tgt: HaskellType): { full: string; short: string } {
    const srcNode = nodeById.get(srcId);
    const tgtNode = nodeById.get(tgtId);
    const tgtPort = tgtNode?.data.ports.find(p => p.id === tgtPortId);
    const where = tgtNode
      ? `The ${tgtPort?.label ?? ''} input of ${nodeName(tgtNode)}`
      : 'This input';
    // Only these nodes become functions when an input is left empty (a Lambda's
    // or an if's inputs aren't arguments)
    const partial = ['primop', 'hof', 'listop', 'module', 'call'].includes(srcNode?.data.kind ?? '');
    const srcInputs = partial ? srcNode!.data.ports.filter(p => p.direction === 'input') : [];
    const connected = connectedInputs.get(srcId) ?? new Set<string>();
    const empty = srcInputs.filter(p => !connected.has(p.id)).length;
    const hasEmpty = empty > 0;
    const srcName = srcNode ? nodeName(srcNode) : 'the source node';

    if (tgt.tag === 'Fun' && src.tag !== 'Fun') {
      let hint = '';
      if (srcNode && carriesFunctionWhereValueWanted(srcNode.id)) {
        // The real mistake is further back; fixing that fixes this one
        hint = ` This comes from the problem on a wire going into ${srcName}: sort that one out first.`;
      } else if (srcInputs.length > 0 && !hasEmpty) {
        hint = ` To pass ${srcName} itself as a function, leave one of its inputs empty.`;
      } else if (srcInputs.length === 0 && srcNode?.data.kind === 'value') {
        hint = ' A typed-in value is not a function. Wire in a function instead: an operator with one input' +
          ' left empty (such as + with only y connected), a Lambda, or one of your Functions from My Functions.';
      }
      return {
        full:  `${where} needs a function (${showTypeSimple(tgt)}), but this wire carries a value of type ${showTypeSimple(src)}.${hint}`,
        short: `Needs a function (${showTypeSimple(tgt)}), got ${showTypeSimple(src)}`,
      };
    }
    if (src.tag === 'Fun' && tgt.tag !== 'Fun') {
      let hint = '';
      const inputs = empty === 1 ? 'input' : 'inputs';
      // Values wired in must be selected too, or they'd become extra parameters
      const wrap = `select ${srcName} and ${tgtNode ? nodeName(tgtNode) : 'this node'}, with the values wired into them,` +
        ` and click Make a Function: the empty ${inputs} on ${srcName} will become the new function's parameter${empty === 1 ? '' : 's'}`;
      // Heading for an input that wants a function (filter's test, map's f)?
      // Then the student is probably building a function, which wrapping makes.
      const wants = tgtNode ? functionInputDownstream(tgtNode.id) : undefined;
      if (hasEmpty && wants) {
        hint = ` It looks as if you are building a function to give to ${wants}. To make it, ${wrap}.` +
          ` (Or, if you meant a single value here, connect the empty ${inputs} on ${srcName}.)`;
      } else if (hasEmpty) {
        hint = ` Connect the empty ${inputs} on ${srcName} to get a value. Or, if you meant to build a new function` +
          ` from these nodes, ${wrap}.`;
      } else {
        hint = ` To use a function's result here, apply it to a value first, for example with Apply ($).`;
      }
      return {
        full:  `${where} needs a value of type ${showTypeSimple(tgt)}, but this wire carries a function (${showTypeSimple(src)}).${hint}`,
        short: `Needs ${showTypeSimple(tgt)}, got a function (${showTypeSimple(src)})`,
      };
    }
    return {
      full:  `${where} needs ${showTypeSimple(tgt)}, but this wire carries ${showTypeSimple(src)}.`,
      short: `Needs ${showTypeSimple(tgt)}, got ${showTypeSimple(src)}`,
    };
  }
}

// ─── Type classes ─────────────────────────────────────────────────────────
// Only the four a student meets first: Num for arithmetic, Eq for ==, Ord for
// < and maximum, Show for show. Each node's class sits on the type variable of
// one port, as in (+) :: Num a => a → a → a. Division stays lenient: Int / Int
// gives a Float, though Haskell would want fromIntegral.

type TypeClass = 'Num' | 'Eq' | 'Ord' | 'Show';

const CLASS_CONSTRAINTS: Record<string, { cls: TypeClass; port: string }> = {
  'primop:+': { cls: 'Num', port: 'arg0' },
  'primop:-': { cls: 'Num', port: 'arg0' },
  'primop:*': { cls: 'Num', port: 'arg0' },
  'primop:/': { cls: 'Num', port: 'arg0' },
  'primop:negate': { cls: 'Num', port: 'arg0' },
  'primop:abs':    { cls: 'Num', port: 'arg0' },
  'primop:==': { cls: 'Eq',  port: 'arg0' },
  'primop:/=': { cls: 'Eq',  port: 'arg0' },
  'primop:<':  { cls: 'Ord', port: 'arg0' },
  'primop:>':  { cls: 'Ord', port: 'arg0' },
  'primop:<=': { cls: 'Ord', port: 'arg0' },
  'primop:>=': { cls: 'Ord', port: 'arg0' },
  'listop:elem':    { cls: 'Eq',  port: 'x' },
  'listop:maximum': { cls: 'Ord', port: 'result' },
  'listop:minimum': { cls: 'Ord', port: 'result' },
  'listop:sum':     { cls: 'Num', port: 'result' },
  'listop:product': { cls: 'Num', port: 'result' },
  'hof:show':       { cls: 'Show', port: 'arg0' },
};

function classConstraint(node: LibNode): { cls: TypeClass; port: string } | undefined {
  const d = node.data as { kind: string; op?: string };
  return d.op ? CLASS_CONSTRAINTS[`${d.kind}:${d.op}`] : undefined;
}

// Is the type in the class? A type not yet known might be, so it passes.
// Int, Float, Bool, String, and lists and pairs of them, can all be compared
// and shown; functions can't. Only Int and Float are numbers.
function satisfies(cls: TypeClass, t: HaskellType): boolean {
  switch (t.tag) {
    case 'TypeVar': case 'Unknown': return true;
    case 'Fun':   return false;
    case 'Int': case 'Float': return true;
    case 'Bool': case 'String': return cls !== 'Num';
    case 'List':  return cls !== 'Num' && satisfies(cls, t.elem);
    case 'Tuple': return cls !== 'Num' && t.elems.every(e => satisfies(cls, e));
  }
}

function typeMentions(t: HaskellType | undefined, name: string): boolean {
  if (!t) return false;
  switch (t.tag) {
    case 'TypeVar': return t.name === name;
    case 'List':    return typeMentions(t.elem, name);
    case 'Fun':     return typeMentions(t.from, name) || typeMentions(t.to, name);
    case 'Tuple':   return t.elems.some(e => typeMentions(e, name));
    default:        return false;
  }
}

function classMessage(node: LibNode, cls: TypeClass, bad: HaskellType, carried: HaskellType,
                      inward: boolean): { full: string; short: string } {
  const name = nodeName(node);
  const wire = inward ? `this wire carries ${showTypeSimple(carried)}` : `this wire makes it work on ${showTypeSimple(bad)}`;
  const hint = carried.tag === 'Fun' && inward
    ? ' If you meant to use the function\'s answer, connect its empty inputs first.' : '';
  switch (cls) {
    case 'Num':
      return { full: `${name} works with numbers (Int or Float), but ${wire}.${hint}`,
               short: `${name} needs numbers, got ${showTypeSimple(bad)}` };
    case 'Eq':
      return { full: `${name} can't compare functions: there's no way to tell whether two functions are equal, but ${wire}.${hint}`,
               short: `Can't compare functions with ${name}` };
    case 'Ord':
      return { full: `${name} can't put functions in order, but ${wire}.${hint}`,
               short: `Functions have no order for ${name}` };
    case 'Show':
      return { full: `${name} can't turn a function into text, but ${wire}.${hint}`,
               short: `${name} can't show a function` };
  }
}

// The name a student sees on a node: the operator, function or node kind
function nodeName(node: LibNode): string {
  const d = node.data as { kind: string; op?: string; name?: string; targetName?: string };
  if (d.kind === 'call')   return d.targetName || 'Call';
  if (d.kind === 'module') return d.name || 'Function';
  if (d.kind === 'if')     return 'if/then/else';
  if (d.op === 'snoc')   return 'append item';
  if (d.op === 'uncons') return 'x:xs';
  if (d.op) return /^[a-z]/i.test(d.op) ? d.op : `(${d.op})`;
  return d.kind.charAt(0).toUpperCase() + d.kind.slice(1);
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
