// ─── Toolbar ───────────────────────────────────────────────────────────────
// Top bar: title + Run / Reset controls.

import { Play, RotateCcw } from 'lucide-react';
import { useEvaluationStore } from '../../store/evaluationStore';
import { useEvaluation }      from '../../hooks/useEvaluation';

export function Toolbar() {
  const { isRunning, reset } = useEvaluationStore();
  const { runAll } = useEvaluation();

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-700 select-none">
      {/* Logo / title */}
      <div className="flex items-center gap-2 mr-4">
        <span className="text-blue-400 font-bold text-lg tracking-tight">Liberator</span>
        <span className="text-slate-500 text-xs">visual Haskell</span>
      </div>

      {/* Run */}
      <button
        title="Run (evaluate all outputs)"
        onClick={runAll}
        disabled={isRunning}
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600
                   disabled:opacity-50 text-white text-xs font-medium transition-colors"
      >
        <Play size={12} />
        {isRunning ? 'Running…' : 'Run'}
      </button>

      {/* Reset */}
      <button
        title="Reset (clear results)"
        onClick={reset}
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600
                   text-white text-xs font-medium transition-colors"
      >
        <RotateCcw size={12} />
        Reset
      </button>

      <div className="flex-1" />

      <span className="text-slate-600 text-xs">
        Phase 2 — evaluation engine
      </span>
    </div>
  );
}
