// ─── Toolbar ───────────────────────────────────────────────────────────────
// Top bar: title + Run / Reset controls (Step comes in Phase 3).

import { Play, Square, RotateCcw } from 'lucide-react';
import { useEvaluationStore } from '../../store/evaluationStore';

export function Toolbar() {
  const { isRunning, reset } = useEvaluationStore();

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-700 select-none">
      {/* Logo / title */}
      <div className="flex items-center gap-2 mr-4">
        <span className="text-blue-400 font-bold text-lg tracking-tight">Liberator</span>
        <span className="text-slate-500 text-xs">visual Haskell</span>
      </div>

      {/* Run button — wired up fully in Phase 3; placeholder callback for now */}
      <button
        title="Run (evaluate all outputs)"
        disabled={isRunning}
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600
                   disabled:opacity-50 text-white text-xs font-medium transition-colors"
      >
        <Play size={12} />
        Run
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
        Phase 1 — live type inference
      </span>
    </div>
  );
}
