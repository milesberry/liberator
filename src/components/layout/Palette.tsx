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
      className="px-2 py-1 rounded text-xs cursor-grab active:cursor-grabbing transition-colors select-none"
      style={{ color: 'var(--text-primary)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--ctrl-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
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
    <div className="flex flex-col h-full overflow-hidden border-r"
         style={{ background: 'var(--bg-palette)', borderColor: 'var(--border-subtle)' }}>
      <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search nodes…"
            className="w-full text-xs rounded pl-6 pr-2 py-1 outline-none border focus:border-blue-500"
            style={{
              background: 'var(--ctrl-bg)',
              color: 'var(--text-primary)',
              borderColor: 'var(--ctrl-border)',
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {filtered ? (
          <div>
            {filtered.length === 0 && (
              <p className="text-xs p-2" style={{ color: 'var(--text-faint)' }}>
                No nodes match "{query}"
              </p>
            )}
            {filtered.map(def => <PaletteItem key={`${def.kind}-${def.subtype}`} def={def} />)}
          </div>
        ) : (
          Array.from(grouped.entries()).map(([cat, defs]) => (
            <details key={cat} open className="mb-1">
              <summary className="text-xs font-semibold uppercase tracking-wider px-2 py-1 cursor-pointer select-none"
                       style={{ color: 'var(--text-muted)' }}>
                {CATEGORY_LABELS[cat]}
              </summary>
              <div className="pl-1">
                {defs.map(def => <PaletteItem key={`${def.kind}-${def.subtype}`} def={def} />)}
              </div>
            </details>
          ))
        )}
      </div>

      <div className="p-2 border-t text-xs text-center select-none"
           style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-faint)' }}>
        Drag nodes onto canvas
      </div>
    </div>
  );
}
