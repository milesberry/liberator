// ─── Node palette ──────────────────────────────────────────────────────────
// Left panel. Lists all node types grouped by category. Drag onto canvas.

import { useState } from 'react';
import { Search } from 'lucide-react';
import { NODE_REGISTRY, CATEGORY_LABELS, groupByCategory, type NodeDefinition } from '../../nodes/registry';

function PaletteItem({ def }: { def: NodeDefinition }) {
  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/liberator-kind', def.kind);
    e.dataTransfer.setData('application/liberator-subtype', def.subtype ?? '');
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="px-2 py-1 rounded text-xs cursor-grab active:cursor-grabbing
                 hover:bg-slate-600 text-slate-200 transition-colors select-none"
      title={def.description}
    >
      {def.label}
    </div>
  );
}

export function Palette() {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? NODE_REGISTRY.filter(d =>
        d.label.toLowerCase().includes(query.toLowerCase()) ||
        d.description.toLowerCase().includes(query.toLowerCase())
      )
    : null;

  const grouped = groupByCategory();

  return (
    <div className="flex flex-col h-full bg-slate-800 border-r border-slate-700 overflow-hidden">
      <div className="p-2 border-b border-slate-700">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search nodes…"
            className="w-full bg-slate-700 text-slate-200 text-xs rounded pl-6 pr-2 py-1 outline-none border border-slate-600 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {filtered ? (
          <div>
            {filtered.length === 0 && (
              <p className="text-xs text-slate-500 p-2">No nodes match "{query}"</p>
            )}
            {filtered.map(def => <PaletteItem key={`${def.kind}-${def.subtype}`} def={def} />)}
          </div>
        ) : (
          Array.from(grouped.entries()).map(([cat, defs]) => (
            <details key={cat} open className="mb-1">
              <summary className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 cursor-pointer select-none hover:text-slate-200">
                {CATEGORY_LABELS[cat]}
              </summary>
              <div className="pl-1">
                {defs.map(def => <PaletteItem key={`${def.kind}-${def.subtype}`} def={def} />)}
              </div>
            </details>
          ))
        )}
      </div>

      <div className="p-2 border-t border-slate-700 text-xs text-slate-500 text-center select-none">
        Drag nodes onto canvas
      </div>
    </div>
  );
}
