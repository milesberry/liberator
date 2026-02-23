// ─── Graph → ExprTree ──────────────────────────────────────────────────────
// Walks the node graph backwards from an OutputNode, building a lambda
// calculus expression tree that the evaluator can reduce.

import type { LibNode } from '../types/nodes';
import type { LibEdge } from '../types/edges';
import type { HaskellValue } from '../types/values';
import { VInt, VFloat, VBool, VString, VList, VError } from '../types/values';

// ─── Expression tree ───────────────────────────────────────────────────────

export type ExprTree =
  | { tag: 'Lit';        value: HaskellValue }
  | { tag: 'Builtin';    name: string }
  | { tag: 'App';        fn: ExprTree; arg: ExprTree }
  | { tag: 'Lam';        param: string; body: ExprTree }
  | { tag: 'If';         cond: ExprTree; thenE: ExprTree; elseE: ExprTree }
  | { tag: 'PartialApp'; fn: ExprTree; args: Array<ExprTree | null> }
  | { tag: 'Err';        message: string };

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
}

function makeCtx(nodes: LibNode[], edges: LibEdge[]): BuildCtx {
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

  return { nodeById, edgesBySource, edgeByTarget, visited: new Set() };
}

// Get the ExprTree wired into a given input port (by node id + port id)
function inputExpr(nodeId: string, portId: string, ctx: BuildCtx): ExprTree | null {
  const handleKey = `${nodeId}__${portId}`;
  const edge = ctx.edgeByTarget.get(handleKey);
  if (!edge) return null;
  return buildExpr(edge.source, edge.sourceHandle?.split('__')[1] ?? 'result', ctx);
}

// ─── Main builder ─────────────────────────────────────────────────────────

function buildExpr(nodeId: string, _portId: string, ctx: BuildCtx): ExprTree {
  // Cycle guard
  if (ctx.visited.has(nodeId)) return { tag: 'Err', message: `Cycle detected at node ${nodeId}` };
  ctx.visited.add(nodeId);

  const node = ctx.nodeById.get(nodeId);
  if (!node) return { tag: 'Err', message: `Unknown node: ${nodeId}` };

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
      const fn: ExprTree = { tag: 'Builtin', name: d.op };
      // All connected: fully apply
      if (args.every(a => a !== null)) {
        result = args.reduce<ExprTree>((acc, arg) => ({ tag: 'App', fn: acc, arg: arg! }), fn);
      } else {
        // Partially applied
        result = { tag: 'PartialApp', fn, args };
      }
      break;
    }

    case 'hof': {
      const inputPorts = d.ports.filter(p => p.direction === 'input');
      const args: Array<ExprTree | null> = inputPorts.map(p =>
        inputExpr(nodeId, p.id, { ...ctx, visited: new Set(ctx.visited) })
      );
      const fn: ExprTree = { tag: 'Builtin', name: d.op };
      if (args.every(a => a !== null)) {
        result = args.reduce<ExprTree>((acc, arg) => ({ tag: 'App', fn: acc, arg: arg! }), fn);
      } else {
        result = { tag: 'PartialApp', fn, args };
      }
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
      // Phase 5 — not yet implemented
      result = { tag: 'Err', message: `Module "${d.name}" evaluation not yet implemented` };
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

export function buildOutputExprs(nodes: LibNode[], edges: LibEdge[]): OutputTarget[] {
  const ctx = makeCtx(nodes, edges);
  return nodes
    .filter(n => n.data.kind === 'output')
    .map(n => ({
      nodeId: n.id,
      label: (n.data as { kind: 'output'; label: string }).label || 'Output',
      expr: buildExpr(n.id, 'value', { ...ctx, visited: new Set() }),
    }));
}
