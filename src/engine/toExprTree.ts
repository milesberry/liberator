// ─── Graph → ExprTree ──────────────────────────────────────────────────────
// Walks the node graph backwards from an OutputNode, building a lambda
// calculus expression tree that the evaluator can reduce.

import type { LibNode, ModuleNodeData } from '../types/nodes';
import type { LibEdge } from '../types/edges';
import type { HaskellValue } from '../types/values';
import { VInt, VFloat, VBool, VString, VList, VError } from '../types/values';
import type { SubgraphState } from '../store/graphStore';

// ─── Expression tree ───────────────────────────────────────────────────────

export type ExprTree =
  | { tag: 'Lit';        value: HaskellValue }
  | { tag: 'Builtin';    name: string }
  | { tag: 'Var';        name: string }
  | { tag: 'App';        fn: ExprTree; arg: ExprTree }
  | { tag: 'Lam';        param: string; body: ExprTree }
  | { tag: 'If';         cond: ExprTree; thenE: ExprTree; elseE: ExprTree }
  | { tag: 'PartialApp'; fn: ExprTree; args: Array<ExprTree | null> }
  | { tag: 'Err';        message: string };

// ─── Build a section/partial-application expression ───────────────────────
// Given a builtin name and a mixed array of connected (ExprTree) and
// unconnected (null) argument slots, produce an ExprTree that is:
//   • a fully-reduced App chain  — when all args are present
//   • a Lam wrapping the nulls   — when some args are missing
//
// Example: args = [null, Lit(0)]  for  (==)
//   → Lam("__p0", App(App(Builtin("=="), Var("__p0")), Lit(0)))
//   which evaluates to  \x -> x == 0
//
// Example: args = [Lit(2), null]  for  (*)
//   → Lam("__p1", App(App(Builtin("*"), Lit(2)), Var("__p1")))
//   which evaluates to  \x -> 2 * x   (i.e.  (*2) )
function buildPartialExpr(builtinName: string, args: Array<ExprTree | null>): ExprTree {
  // Assign a fresh param name for each null slot
  const params: string[] = args.map((a, i) => a === null ? `__p${i}` : '');

  // Build the innermost application:  fn arg0 arg1 … argN
  // where null slots use their Var placeholder
  const fn: ExprTree = { tag: 'Builtin', name: builtinName };
  const applied = args.reduce<ExprTree>((acc, arg, i) => ({
    tag: 'App',
    fn: acc,
    arg: arg ?? { tag: 'Var', name: params[i] },
  }), fn);

  // Wrap in lambdas for each null slot (right-to-left so outermost = leftmost null)
  const nullIndices = args
    .map((a, i) => (a === null ? i : -1))
    .filter(i => i >= 0)
    .reverse();          // wrap innermost first

  return nullIndices.reduce<ExprTree>((body, i) => ({
    tag: 'Lam',
    param: params[i],
    body,
  }), applied);
}

// ─── Parse a literal string → HaskellValue ────────────────────────────────

function parseLiteral(valueType: string, literal: string): HaskellValue {
  const s = literal.trim();
  switch (valueType) {
    case 'Int': {
      const n = parseInt(s, 10);
      return isNaN(n) ? VError(`Not an integer: "${s}"`) : VInt(n);
    }
    case 'Float': {
      const n = parseFloat(s);
      return isNaN(n) ? VError(`Not a float: "${s}"`) : VFloat(n);
    }
    case 'Bool':
      if (s === 'True' || s === 'true') return VBool(true);
      if (s === 'False' || s === 'false') return VBool(false);
      return VError(`Not a Bool: "${s}"`);
    case 'String': {
      // Strip surrounding quotes if present
      const inner = s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
      return VString(inner);
    }
    case 'List': {
      // Parse a Haskell-style list literal: [1,2,3] or [True,False] or []
      const trimmed = s.replace(/\s/g, '');
      if (trimmed === '[]') return VList([]);
      if (!trimmed.startsWith('[') || !trimmed.endsWith(']'))
        return VError(`Not a list: "${s}"`);
      const inner = trimmed.slice(1, -1);
      // Split on commas (naively — no nested lists in literals for now)
      const items = inner.split(',').map(item => {
        const t = item.trim();
        if (t === 'True' || t === 'true') return VBool(true);
        if (t === 'False' || t === 'false') return VBool(false);
        if (t.startsWith('"')) return VString(t.slice(1, -1));
        if (t.includes('.')) { const n = parseFloat(t); return isNaN(n) ? VError(`Bad float: ${t}`) : VFloat(n); }
        const n = parseInt(t, 10);
        return isNaN(n) ? VError(`Bad list element: "${t}"`) : VInt(n);
      });
      const err = items.find(i => i.tag === 'VError');
      return err ?? VList(items);
    }
    default:
      return VError(`Unknown value type: ${valueType}`);
  }
}

// ─── Context passed through the traversal ─────────────────────────────────

interface BuildCtx {
  nodeById: Map<string, LibNode>;
  // source port → list of edges leaving that port
  edgesBySource: Map<string, LibEdge[]>;
  // target port handle → the single edge arriving at that port
  edgeByTarget: Map<string, LibEdge>;
  visited: Set<string>;   // cycle detection
  subgraphs: Record<string, SubgraphState>;   // for module node evaluation
}

function makeCtx(nodes: LibNode[], edges: LibEdge[], subgraphs: Record<string, SubgraphState> = {}): BuildCtx {
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const edgesBySource = new Map<string, LibEdge[]>();
  const edgeByTarget  = new Map<string, LibEdge>();

  for (const e of edges) {
    const srcKey = e.sourceHandle ?? `${e.source}__result`;
    const tgtKey = e.targetHandle ?? `${e.target}__value`;
    const existing = edgesBySource.get(srcKey) ?? [];
    existing.push(e);
    edgesBySource.set(srcKey, existing);
    edgeByTarget.set(tgtKey, e);
  }

  return { nodeById, edgesBySource, edgeByTarget, visited: new Set(), subgraphs };
}

// Get the ExprTree wired into a given input port (by node id + port id)
function inputExpr(nodeId: string, portId: string, ctx: BuildCtx): ExprTree | null {
  const handleKey = `${nodeId}__${portId}`;
  const edge = ctx.edgeByTarget.get(handleKey);
  if (!edge) return null;
  const srcPortId = edge.sourceHandle?.split('__')[1] ?? 'result';
  return buildExprWithOverrides(edge.source, srcPortId, ctx);
}

// ─── Module evaluation helper ─────────────────────────────────────────────
// Evaluates a module node by resolving its subgraph.
// Input anchors (value nodes tagged with _modulePortId) are overridden with
// the expressions connected to the module's input ports in the outer graph.
// The result is the expression from the matching output anchor in the subgraph.

function buildModuleExpr(
  moduleNodeId: string,
  md: ModuleNodeData,
  requestedPortId: string,
  ctx: BuildCtx
): ExprTree {
  const sub = ctx.subgraphs[md.subgraphId];
  if (!sub) return { tag: 'Err', message: `Module "${md.name}": subgraph not found` };

  // Build a sub-context from the inner subgraph
  const subCtx = makeCtx(sub.nodes, sub.edges, ctx.subgraphs);

  // For each input port, resolve the outer expression and patch the anchor node
  // by replacing it in subCtx.nodeById with a synthetic "value" node.
  for (const port of md.inputPorts) {
    const outerExpr = inputExpr(moduleNodeId, port.id, { ...ctx, visited: new Set(ctx.visited) });
    if (!outerExpr) continue;

    // Find anchor: a value node inside subgraph with _modulePortId === port.id
    const anchor = sub.nodes.find(n =>
      n.data.kind === 'value' && (n.data as any)._modulePortId === port.id
    );
    if (!anchor) continue;

    // Replace the anchor in subCtx.nodeById with a synthetic Lit-producing node.
    // We do this by injecting a special '_override' kind that we handle below.
    // Actually simpler: store the override in a side-map on subCtx.
    (subCtx as any)._overrides = (subCtx as any)._overrides ?? new Map<string, ExprTree>();
    (subCtx as any)._overrides.set(anchor.id, outerExpr);
  }

  // Find the output anchor matching requestedPortId (or the first output if unspecified)
  const outputAnchor =
    sub.nodes.find(n => n.data.kind === 'output' && (n.data as any)._modulePortId === requestedPortId)
    ?? sub.nodes.find(n => n.data.kind === 'output');

  if (!outputAnchor) return { tag: 'Err', message: `Module "${md.name}": no output node` };
  return buildExprWithOverrides(outputAnchor.id, 'value', subCtx);
}

// Variant of buildExpr that checks _overrides first
function buildExprWithOverrides(nodeId: string, portId: string, ctx: BuildCtx): ExprTree {
  const overrides: Map<string, ExprTree> | undefined = (ctx as any)._overrides;
  if (overrides?.has(nodeId)) return overrides.get(nodeId)!;
  return buildExpr(nodeId, portId, ctx);
}

// ─── Main builder ─────────────────────────────────────────────────────────

function buildExpr(nodeId: string, portId: string, ctx: BuildCtx): ExprTree {
  const node = ctx.nodeById.get(nodeId);
  if (!node) return { tag: 'Err', message: `Unknown node: ${nodeId}` };

  // Lambda param port: return the bound Var immediately (not a cycle, not the full lambda)
  if (node.data.kind === 'lambda' && portId === 'param') {
    return { tag: 'Var', name: node.data.paramName };
  }

  // Cycle guard (only for non-param ports)
  if (ctx.visited.has(nodeId)) return { tag: 'Err', message: `Cycle detected at node ${nodeId}` };
  ctx.visited.add(nodeId);

  const d = node.data;
  let result: ExprTree;

  switch (d.kind) {
    case 'value': {
      result = { tag: 'Lit', value: parseLiteral(d.valueType, d.literal) };
      break;
    }

    case 'primop':
    case 'listop': {
      const inputPorts = d.ports.filter(p => p.direction === 'input');
      const args: Array<ExprTree | null> = inputPorts.map(p =>
        inputExpr(nodeId, p.id, { ...ctx, visited: new Set(ctx.visited) })
      );
      result = buildPartialExpr(d.op, args);
      break;
    }

    case 'hof': {
      const inputPorts = d.ports.filter(p => p.direction === 'input');
      const args: Array<ExprTree | null> = inputPorts.map(p =>
        inputExpr(nodeId, p.id, { ...ctx, visited: new Set(ctx.visited) })
      );
      result = buildPartialExpr(d.op, args);
      break;
    }

    case 'lambda': {
      const body = inputExpr(nodeId, 'body', { ...ctx, visited: new Set(ctx.visited) });
      if (!body) {
        // Unconnected body: λx → ⊥
        result = { tag: 'Lam', param: d.paramName, body: { tag: 'Err', message: 'Lambda body not connected' } };
      } else {
        result = { tag: 'Lam', param: d.paramName, body };
      }
      break;
    }

    case 'if': {
      const cond  = inputExpr(nodeId, 'cond', { ...ctx, visited: new Set(ctx.visited) });
      const thenE = inputExpr(nodeId, 'then', { ...ctx, visited: new Set(ctx.visited) });
      const elseE = inputExpr(nodeId, 'else', { ...ctx, visited: new Set(ctx.visited) });
      if (!cond || !thenE || !elseE) {
        result = { tag: 'Err', message: 'if/then/else: not all branches connected' };
      } else {
        result = { tag: 'If', cond, thenE, elseE };
      }
      break;
    }

    case 'apply': {
      const fn  = inputExpr(nodeId, 'fn',  { ...ctx, visited: new Set(ctx.visited) });
      const arg = inputExpr(nodeId, 'arg', { ...ctx, visited: new Set(ctx.visited) });
      if (!fn || !arg) {
        result = { tag: 'Err', message: 'apply ($): both fn and arg must be connected' };
      } else {
        result = { tag: 'App', fn, arg };
      }
      break;
    }

    case 'output': {
      // The output node just passes through whatever is wired to its input
      const val = inputExpr(nodeId, 'value', { ...ctx, visited: new Set(ctx.visited) });
      result = val ?? { tag: 'Err', message: 'Output: no value connected' };
      break;
    }

    case 'module': {
      const md = d as ModuleNodeData;
      result = buildModuleExpr(nodeId, md, portId, ctx);
      break;
    }

    default:
      result = { tag: 'Err', message: 'Unknown node kind' };
  }

  ctx.visited.delete(nodeId); // allow the same node to be reached via different paths
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface OutputTarget {
  nodeId: string;
  label: string;
  expr: ExprTree;
}

export function buildOutputExprs(
  nodes: LibNode[],
  edges: LibEdge[],
  subgraphs: Record<string, SubgraphState> = {}
): OutputTarget[] {
  const ctx = makeCtx(nodes, edges, subgraphs);
  return nodes
    .filter(n => n.data.kind === 'output')
    .map(n => ({
      nodeId: n.id,
      label: (n.data as { kind: 'output'; label: string }).label || 'Output',
      expr: buildExpr(n.id, 'value', { ...ctx, visited: new Set() }),
    }));
}
