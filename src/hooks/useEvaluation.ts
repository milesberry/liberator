// ─── useEvaluation ────────────────────────────────────────────────────────
// Provides a runAll() function that evaluates all OutputNodes and stores results,
// along with the value on every wire (shown when you hover over a wire).

import { useCallback, useEffect } from 'react';
import { useGraphStore }      from '../store/graphStore';
import { useEvaluationStore, type WireValue } from '../store/evaluationStore';
import { buildOutputExprs, wireSourceExprs, VARIES } from '../engine/toExprTree';
import { evaluate }           from '../engine/evaluator';
import { showValue, type HaskellValue } from '../types/values';
import type { LibNode } from '../types/nodes';
import type { LibEdge } from '../types/edges';

// How a wire's value is described to the student
function describe(v: HaskellValue): WireValue {
  switch (v.tag) {
    case 'VFun':    return { kind: 'function', text: 'a function' };
    case 'VBottom': return { kind: 'error', text: '⊥ (no answer: step limit reached)' };
    case 'VError':
      // A parameter (or a lambda's input) somewhere upstream: no single value
      return v.message.includes(VARIES) || v.message.includes('Unbound variable')
        ? { kind: 'varies', text: 'varies: depends on an input' }
        : { kind: 'error', text: v.message };
    default:        return { kind: 'value', text: showValue(v) };
  }
}

// Values for every wire in the root graph and inside every function
function computeWireValues(
  nodes: LibNode[], edges: LibEdge[],
  subgraphs: Record<string, { nodes: LibNode[]; edges: LibEdge[] }>,
): Map<string, WireValue> {
  const values = new Map<string, WireValue>();
  const allNodes = [...nodes, ...Object.values(subgraphs).flatMap(s => s.nodes)];
  const graphs = [{ nodes, edges }, ...Object.values(subgraphs)];
  for (const g of graphs) {
    const exprs = wireSourceExprs(g.nodes, g.edges, subgraphs, allNodes);
    // A let's variable has one value (let x = 3 → x is 3), so bind it; a
    // lambda's input really does vary, so those wires say so
    const env = new Map<string, HaskellValue>();
    for (const n of g.nodes) {
      if (n.data.kind !== 'let') continue;
      const bound = g.edges.find(e => e.target === n.id && e.targetHandle === `${n.id}__value`);
      const expr = bound && exprs.get(bound.sourceHandle ?? `${bound.source}__result`);
      if (expr) env.set((n.data as { varName: string }).varName, evaluate(expr, env));
    }
    for (const [handle, expr] of exprs) {
      values.set(handle, describe(evaluate(expr, env)));
    }
  }
  return values;
}

// A wire's value is only true of the graph it was worked out for: clear the
// values whenever a wire or a node's settings change (but not when nodes are
// merely moved or selected)
export function useClearStaleWireValues() {
  useEffect(() => {
    const wiring = (edges: LibEdge[]) =>
      edges.map(e => `${e.sourceHandle}>${e.targetHandle}`).join('|');
    return useGraphStore.subscribe((state, prev) => {
      if (useEvaluationStore.getState().wireValues.size === 0) return;
      const graphs = (s: typeof state) =>
        [{ nodes: s.nodes, edges: s.edges }, ...Object.values(s.subgraphs)];
      const now = graphs(state), before = graphs(prev);
      const changed = now.length !== before.length || now.some((g, i) => {
        const b = before[i];
        if (g.edges !== b.edges && wiring(g.edges) !== wiring(b.edges)) return true;
        if (g.nodes === b.nodes) return false;
        if (g.nodes.length !== b.nodes.length) return true;
        return g.nodes.some((n, j) => n.data !== b.nodes[j]?.data);
      });
      if (changed) useEvaluationStore.getState().clearWireValues();
    });
  }, []);
}

export function useEvaluation() {
  const setResults = useEvaluationStore(s => s.setResults);
  const setRunning = useEvaluationStore(s => s.setRunning);
  const setWireValues = useEvaluationStore(s => s.setWireValues);

  const runAll = useCallback(() => {
    const { nodes, edges } = useGraphStore.getState();
    setRunning(true);

    // Run asynchronously so the "running" state renders before we block
    setTimeout(() => {
      try {
        const { subgraphs } = useGraphStore.getState();
        const targets = buildOutputExprs(nodes, edges, subgraphs);
        const results = targets.map(({ nodeId, label, expr }) => {
          const val = evaluate(expr);
          const isError = val.tag === 'VError';
          const value = val.tag === 'VBottom'
            ? '⊥ (step limit exceeded — possible infinite recursion)'
            : showValue(val);
          return { nodeId, label, value, isError };
        });
        setResults(results);
        setWireValues(computeWireValues(nodes, edges, subgraphs));
      } catch (e) {
        setResults([{
          nodeId: '__error__',
          label: 'Error',
          value: String(e),
          isError: true,
        }]);
      } finally {
        setRunning(false);
      }
    }, 0);
  }, [setResults, setRunning, setWireValues]);

  return { runAll };
}
