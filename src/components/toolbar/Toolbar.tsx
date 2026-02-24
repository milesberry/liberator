// ─── Toolbar ───────────────────────────────────────────────────────────────
// Top bar: Run / Reset + Save / Load / Examples menu.

import { useState } from 'react';
import { Play, RotateCcw, Save, FolderOpen, BookOpen, ChevronDown, Trash2 } from 'lucide-react';
import { useEvaluationStore } from '../../store/evaluationStore';
import { useEvaluation }      from '../../hooks/useEvaluation';
import { useGraphStore }      from '../../store/graphStore';
import { saveGraph, loadGraph } from '../../utils/serialise';
import { EXAMPLES }           from '../../examples';

export function Toolbar() {
  const { isRunning, reset: resetEval } = useEvaluationStore();
  const { runAll } = useEvaluation();
  const { nodes, edges, subgraphs, loadGraph: loadIntoStore, clearGraph } = useGraphStore();
  const [showExamples, setShowExamples] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const handleSave = () => {
    saveGraph(nodes, edges, subgraphs);
    setSaveMsg('Saved!');
    setTimeout(() => setSaveMsg(''), 1500);
  };

  const handleLoad = () => {
    const g = loadGraph();
    if (!g) { alert('No saved program found.'); return; }
    if (nodes.length > 0 && !confirm(`Load "${g.name}"? This will replace the current canvas.`)) return;
    loadIntoStore(g.nodes, g.edges, g.subgraphs);
    resetEval();
  };

  const handleExample = (idx: number) => {
    const ex = EXAMPLES[idx];
    if (nodes.length > 0 && !confirm(`Load example "${ex.name}"? This will replace the current canvas.`)) return;
    loadIntoStore(ex.nodes, ex.edges, (ex as any).subgraphs);
    resetEval();
    setShowExamples(false);
  };

  const handleClear = () => {
    if (nodes.length === 0 || confirm('Clear canvas?')) {
      clearGraph();
      resetEval();
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-700 select-none relative">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3">
        <span className="text-blue-400 font-bold text-lg tracking-tight">Liberator</span>
        <span className="text-slate-500 text-xs">visual Haskell</span>
      </div>

      {/* Run */}
      <button onClick={runAll} disabled={isRunning}
        title="Evaluate all Output nodes"
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600
                   disabled:opacity-50 text-white text-xs font-medium transition-colors">
        <Play size={12} />
        {isRunning ? 'Running…' : 'Run'}
      </button>

      {/* Reset results */}
      <button onClick={resetEval} title="Clear results"
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600
                   text-white text-xs font-medium transition-colors">
        <RotateCcw size={12} />
        Reset
      </button>

      <div className="w-px h-5 bg-slate-700 mx-1" />

      {/* Save */}
      <button onClick={handleSave} title="Save to browser storage"
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600
                   text-white text-xs font-medium transition-colors">
        <Save size={12} />
        {saveMsg || 'Save'}
      </button>

      {/* Load */}
      <button onClick={handleLoad} title="Load last saved program"
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600
                   text-white text-xs font-medium transition-colors">
        <FolderOpen size={12} />
        Load
      </button>

      {/* Examples dropdown */}
      <div className="relative">
        <button onClick={() => setShowExamples(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-700 hover:bg-indigo-600
                     text-white text-xs font-medium transition-colors">
          <BookOpen size={12} />
          Examples
          <ChevronDown size={10} className={`transition-transform ${showExamples ? 'rotate-180' : ''}`} />
        </button>
        {showExamples && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-600
                          rounded shadow-xl z-50 overflow-hidden">
            {EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => handleExample(i)}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700
                           border-b border-slate-700 last:border-0 transition-colors">
                {ex.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clear canvas */}
      <button onClick={handleClear} title="Clear canvas"
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-700 hover:bg-red-800
                   text-slate-400 hover:text-white text-xs font-medium transition-colors">
        <Trash2 size={12} />
      </button>

      <div className="flex-1" />
      <span className="text-slate-600 text-xs">Phase 4 — named functions</span>

      {/* Close examples dropdown when clicking outside */}
      {showExamples && (
        <div className="fixed inset-0 z-40" onClick={() => setShowExamples(false)} />
      )}
    </div>
  );
}
