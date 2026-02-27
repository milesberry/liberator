// ─── Graph → ExprTree ──────────────────────────────────────────────────────
// Walks the node graph backwards from an OutputNode, building a lambda
// calculus expression tree that the evaluator can reduce.

import type { LibNode, ModuleNodeData, CallNodeData } from '../types/nodes';
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
  | { tag: 'Letrec';     name: string; body: ExprTree }   // recursive binding
  | { tag: 'Err';        message: string };

// ─── Build a section/partial-application expression ───────────────────────
function buildPartialExpr(builtinName: string, args: Array<ExprTree | null>): ExprTree {
  const params: string[] = args.map((a, i) => a === null ? `__p${i}` : '');
  const fn: ExprTree = { tag: 'Builtin', name: builtinName };
  const applied = args.reduce<ExprTree>((acc, arg, i) => ({
    tag: 'App',
    fn: acc,
    arg: arg ?? { tag: 'Var', name: params[i] },
  }), fn);
  const nullIndices = args
    .map((a, i) => (a === null ? i : -1))
    .filter(i => i >= 0)
    .reverse();
  return nullIndices.reduce<ExprTree>((body, i) => ({
    tag: 'Lam', param: params[i], body,
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
      const inner = s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
      return VString(inner);
    }
    case 'List': {
      const trimmed = s.replace(/\s/g, '');
      if (trimmed === '[]') return VList([]);
      if (!trimmed.startsWith('[') || !trimmed.endsWith(']'))
        return VError(`Not a list: "${s}"`);
      const inner = trimmed.slice(1, -1);
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
  edgesBySource: Map<string, LibEdge[]>;
  edgeByTarget: Map<string, LibEdge>;
  visited: Set<string>;                     // node-level cycle detection
  subgraphs: Record<string, SubgraphState>;
  buildingModules: Set<string>;             // function names currently on the build stack
  overrides?: Map<string, ExprTree>;        // nodeId → override expression (anchor injection)
}

function makeCtx(
  nodes: LibNode[],
  edges: LibEdge[],
  subgraphs: Record<string, SubgraphState> = {},
  buildingModules: Set<string> = new Set(),
  overrides?: Map<string, ExprTree>,
): BuildCtx {
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

  return { nodeById, edgesBySource, edgeByTarget, visited: new Set(), subgraphs, buildingModules, overrides };
}

// Get the ExprTree wired into a given input port (by node id + port id)
function inputExpr(nodeId: string, portId: string, ctx: BuildCtx): ExprTree | null {
  const handleKey = `${nodeId}__${portId}`;
  const edge = ctx.edgeByTarget.get(handleKey);
  if (!edge) return null;
  const srcPortId = edge.sourceHandle?.split('__')[1] ?? 'result';
  return buildExpr(edge.source, srcPortId, ctx);
}

// ─── Module / Call helper ─────────────────────────────────────────────────
//
// Calling convention for a Function with inputPorts [p0, p1, …]:
//
//   letrec name = λ__p0 → λ__p1 → … → bodyExpr
//   in  name arg0 arg1 …
//
// where bodyExpr is built from the inner subgraph with anchors mapped to
// Var("__p0"), Var("__p1"), … so self-calls inside the body produce
// App(Var(name), recursiveArg) — which the Letrec resolves correctly.
//
// Self-call short-circuit: if `name` is already in buildingModules, we are
// currently building that function's body. We just emit the application of
// Var(name) to the current arguments and return immediately — no JS recursion.

function buildModuleExpr(
  outerNodeId: string,       // module or call node that is being evaluated
  md: ModuleNodeData,
  outerCtx: BuildCtx,
): ExprTree {
  const sub = outerCtx.subgraphs[md.subgraphId];
  if (!sub) return { tag: 'Err', message: `Function "${md.name}": subgraph not found` };

  // Stable parameter names for each input port
  const paramNames = md.inputPorts.map(p => `__fn_${md.name}_${p.id}`);

  // Resolve the actual argument expressions from the outer call site
  const argExprs: Array<ExprTree | null> = md.inputPorts.map((port, i) =>
    inputExpr(outerNodeId, port.id, { ...outerCtx, visited: new Set(outerCtx.visited) })
  );

  // ── Self-call short-circuit ───────────────────────────────────────────────
  // We're already building this function's body — just apply Var(name) to args.
  if (outerCtx.buildingModules.has(md.name)) {
    return argExprs.reduce<ExprTree>(
      (fn, arg) => arg ? { tag: 'App', fn, arg } : fn,
      { tag: 'Var', name: md.name },
    );
  }

  // ── Build the λ-abstracted body ───────────────────────────────────────────
  // Map each input anchor → Var(paramName) so the body is independent of the
  // specific call-site arguments. This gives us the reusable function value.
  const paramOverrides = new Map<string, ExprTree>();
  for (let i = 0; i < md.inputPorts.length; i++) {
    const port = md.inputPorts[i];
    const anchor = sub.nodes.find(n =>
      n.data.kind === 'value' && (n.data as any)._modulePortId === port.id
    );
    if (anchor) paramOverrides.set(anchor.id, { tag: 'Var', name: paramNames[i] });
  }

  // Mark as being built so recursive calls short-circuit
  const subBuildingModules = new Set([...outerCtx.buildingModules, md.name]);

  // Include outer nodes in bodyCtx so inner Call nodes can locate named Functions
  // by scanning nodeById. We merge them; sub.nodes take precedence for edges.
  const allNodesForLookup = [...sub.nodes, ...[...outerCtx.nodeById.values()]];
  const bodyCtx = makeCtx(allNodesForLookup, sub.edges, outerCtx.subgraphs, subBuildingModules, paramOverrides);

  const outputAnchor =
    sub.nodes.find(n => n.data.kind === 'output' && (n.data as any)._modulePortId !== undefined)
    ?? sub.nodes.find(n => n.data.kind === 'output');

  if (!outputAnchor) return { tag: 'Err', message: `Function "${md.name}": no output node` };

  const bodyExpr = buildExpr(outputAnchor.id, 'value', bodyCtx);

  // Wrap in Lams (right-to-left for correct currying)
  const fnExpr = paramNames.reduceRight<ExprTree>(
    (body, param) => ({ tag: 'Lam', param, body }),
    bodyExpr,
  );

  // Build:  letrec name = fnExpr   (binds name → the λ-abstraction)
  // Then apply the current call-site arguments: (letrec …) arg0 arg1 …
  //
  // The evaluator's Letrec case evaluates `body` (= fnExpr) and binds `name`
  // to the result. Self-call sites inside fnExpr see Var(name) resolved to the
  // same VFun via the mutable cell — i.e. the standard JS fixpoint trick.
  const letrec: ExprTree = { tag: 'Letrec', name: md.name, body: fnExpr };

  // Apply arguments to the letrec value
  return argExprs.reduce<ExprTree>(
    (fn, arg) => arg ? { tag: 'App', fn, arg } : fn,
    letrec,
  );
}

// ─── Main builder ─────────────────────────────────────────────────────────

function buildExpr(nodeId: string, portId: string, ctx: BuildCtx): ExprTree {
  // Check override map first (anchor injection)
  if (ctx.overrides?.has(nodeId)) return ctx.overrides.get(nodeId)!;

  const node = ctx.nodeById.get(nodeId);
  if (!node) return { tag: 'Err', message: `Unknown node: ${nodeId}` };

  // Lambda param port: return the bound Var immediately
  if (node.data.kind === 'lambda' && portId === 'param') {
    return { tag: 'Var', name: node.data.paramName };
  }

  // Let param port: return the bound Var immediately
  if (node.data.kind === 'let' && portId === 'param') {
    return { tag: 'Var', name: node.data.varName };
  }

  // Cycle guard
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
      // ── uncons (x:xs): two output ports, each applies head/tail to the list ──
      if (d.kind === 'listop' && d.op === 'uncons') {
        const xs = inputExpr(nodeId, 'list', { ...ctx, visited: new Set(ctx.visited) });
        if (!xs) {
          result = { tag: 'Err', message: 'uncons: list not connected' };
        } else {
          const builtin = portId === 'head' ? 'head' : 'tail';
          result = { tag: 'App', fn: { tag: 'Builtin', name: builtin }, arg: xs };
        }
        break;
      }
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
      const val = inputExpr(nodeId, 'value', { ...ctx, visited: new Set(ctx.visited) });
      result = val ?? { tag: 'Err', message: 'Output: no value connected' };
      break;
    }

    case 'module': {
      result = buildModuleExpr(nodeId, d as ModuleNodeData, ctx);
      break;
    }

    case 'call': {
      const cd = d as CallNodeData;
      if (!cd.targetName) {
        result = { tag: 'Err', message: 'Call: no function selected' };
        break;
      }
      // Find the named Function node in the graph
      const targetModuleNode = [...ctx.nodeById.values()].find(
        n => n.data.kind === 'module' && (n.data as ModuleNodeData).name === cd.targetName
      );
      if (!targetModuleNode) {
        result = { tag: 'Err', message: `Call: function "${cd.targetName}" not found` };
        break;
      }
      result = buildModuleExpr(nodeId, targetModuleNode.data as ModuleNodeData, ctx);
      break;
    }

    case 'let': {
      // let x = value in body  ≡  (λx → body) value
      const val  = inputExpr(nodeId, 'value', { ...ctx, visited: new Set(ctx.visited) });
      const body = inputExpr(nodeId, 'body',  { ...ctx, visited: new Set(ctx.visited) });
      if (!val || !body) {
        result = { tag: 'Err', message: 'Let: both value and body must be connected' };
      } else {
        result = { tag: 'App', fn: { tag: 'Lam', param: d.varName, body }, arg: val };
      }
      break;
    }

    case 'listcomp': {
      // [ f x | x <- xs, p x ]
      // Desugars to:  map f (filter p xs)   if pred connected
      //               map f xs              if pred not connected
      const list      = inputExpr(nodeId, 'list',      { ...ctx, visited: new Set(ctx.visited) });
      const transform = inputExpr(nodeId, 'transform', { ...ctx, visited: new Set(ctx.visited) });
      const pred      = inputExpr(nodeId, 'pred',      { ...ctx, visited: new Set(ctx.visited) });

      if (!list || !transform) {
        result = { tag: 'Err', message: 'List comprehension: list and transform must be connected' };
        break;
      }

      // filtered source: filter pred list   (or just list if no pred)
      const source: ExprTree = pred
        ? { tag: 'App', fn: { tag: 'App', fn: { tag: 'Builtin', name: 'filter' }, arg: pred }, arg: list }
        : list;

      // map transform source
      result = {
        tag: 'App',
        fn: { tag: 'App', fn: { tag: 'Builtin', name: 'map' }, arg: transform },
        arg: source,
      };
      break;
    }

    default:
      result = { tag: 'Err', message: 'Unknown node kind' };
  }

  ctx.visited.delete(nodeId);
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
