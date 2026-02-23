// ─── Output panel ──────────────────────────────────────────────────────────
// Bottom panel. Shows evaluation results and errors.

import { useEvaluationStore } from '../../store/evaluationStore';
import { useUIStore } from '../../store/uiStore';

export function OutputPanel() {
  const { results } = useEvaluationStore();
  const { activeOutputTab, setOutputTab } = useUIStore();

  const errors = results.filter(r => r.isError);
  const outputs = results.filter(r => !r.isError);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-t border-slate-700">
      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {(['results', 'errors'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setOutputTab(tab)}
            className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors
              ${activeOutputTab === tab
                ? 'border-b-2 border-blue-400 text-blue-300'
                : 'text-slate-400 hover:text-slate-200'}`}
          >
            {tab}
            {tab === 'errors' && errors.length > 0 && (
              <span className="ml-1 bg-red-600 text-white rounded-full px-1.5 text-xs">{errors.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {activeOutputTab === 'results' ? (
          outputs.length === 0 ? (
            <span className="text-slate-500">No results yet. Click Run (▶) to evaluate.</span>
          ) : (
            outputs.map(r => (
              <div key={r.nodeId} className="flex gap-2 items-baseline mb-1">
                <span className="text-slate-400 min-w-[80px]">{r.label}:</span>
                <span className="text-emerald-300">{r.value}</span>
              </div>
            ))
          )
        ) : (
          errors.length === 0 ? (
            <span className="text-slate-500">No errors.</span>
          ) : (
            errors.map(r => (
              <div key={r.nodeId} className="flex gap-2 items-baseline mb-1">
                <span className="text-slate-400 min-w-[80px]">{r.label}:</span>
                <span className="text-red-400">{r.value}</span>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
