// ─── useEvaluation ────────────────────────────────────────────────────────
// Provides a runAll() function that evaluates all OutputNodes and stores results.

import { useCallback } from 'react';
import { useGraphStore }      from '../store/graphStore';
import { useEvaluationStore } from '../store/evaluationStore';
import { buildOutputExprs }   from '../engine/toExprTree';
import { evaluate }           from '../engine/evaluator';
import { showValue, VBottom } from '../types/values';

export function useEvaluation() {
  const setResults = useEvaluationStore(s => s.setResults);
  const setRunning = useEvaluationStore(s => s.setRunning);

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
  }, [setResults, setRunning]);

  return { runAll };
}
