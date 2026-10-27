// ─── Node palette ──────────────────────────────────────────────────────────
// Left panel. Lists all node types grouped by category. Drag onto canvas.

import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { NODE_REGISTRY, CATEGORY_LABELS, CATEGORY_ORDER, groupByCategory, type NodeDefinition } from '../../nodes/registry';
import { useGraphStore } from '../../store/graphStore';
import { listFunctions, signatureOf } from '../../utils/functions';
import { definitionSummary } from '../../nodes/summaries';
import type { ModuleNodeData } from '../../types/nodes';

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
      title={paletteTooltip(def)}
    >
      {def.label}
    </div>
  );
}

// Plain-English summary first, then the Haskell type signature
function paletteTooltip(def: NodeDefinition): string {
  const summary = definitionSummary(def.kind, def.subtype);
  return summary ? `${summary}\n${def.description}` : def.description;
}

// A user-defined Function: dropping it creates a Call node bound to that name
function FunctionItem({ fn }: { fn: ModuleNodeData }) {
  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/liberator-kind', 'call');
    e.dataTransfer.setData('application/liberator-call', fn.name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="px-2 py-1 rounded text-xs font-mono cursor-grab active:cursor-grabbing transition-colors select-none"
      style={{ color: 'var(--text-primary)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--ctrl-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
      title={`Call ${signatureOf(fn)}`}
    >
      {signatureOf(fn)}
    </div>
  );
}

// Starts an empty Function and opens it: the way in for a recursive function,
// which can't be made by wrapping nodes that already exist
function NewFunctionButton() {
  const [name, setName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const newFunction = useGraphStore(s => s.newFunction);

  const make = () => {
    newFunction(name);
    setName('');
    setShowInput(false);
  };

  return showInput ? (
    <div className="flex items-center gap-1 mx-1 my-1 px-2 py-1 rounded border border-amber-600">
      <input
        autoFocus
        placeholder="Name it…"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') make(); if (e.key === 'Escape') setShowInput(false); }}
        className="bg-transparent text-xs font-mono outline-none min-w-0 flex-1"
        style={{ color: 'var(--text-primary)' }}
      />
      <button onClick={make}
        className="text-amber-500 hover:text-amber-300 text-xs border border-amber-600 rounded px-1.5">
        Make
      </button>
      <button onClick={() => setShowInput(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
    </div>
  ) : (
    <button
      onClick={() => setShowInput(true)}
      title="Start a new, empty Function and open it. Build what it does from its Parameter x; to make it recursive, drag it from My Functions into its own definition."
      className="flex items-center gap-1 mx-1 my-1 px-2 py-1 rounded text-xs font-medium text-white bg-amber-700 hover:bg-amber-600 border border-amber-500"
    >
      <Plus size={12} />
      New Function
    </button>
  );
}

export function Palette() {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? NODE_REGISTRY.filter(d =>
        d.label.toLowerCase().includes(query.toLowerCase()) ||
        d.description.toLowerCase().includes(query.toLowerCase()) ||
        (definitionSummary(d.kind, d.subtype) ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : null;

  const grouped = groupByCategory();

  const rootNodes = useGraphStore(s => s.nodes);
  const subgraphs = useGraphStore(s => s.subgraphs);
  const functions = listFunctions(rootNodes, subgraphs);
  const matchingFunctions = filtered
    ? functions.filter(fn => fn.name.toLowerCase().includes(query.toLowerCase()))
    : functions;

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
            {matchingFunctions.map(fn => <FunctionItem key={`fn-${fn.name}`} fn={fn} />)}
            {filtered.length === 0 && matchingFunctions.length === 0 && (
              <p className="text-xs p-2" style={{ color: 'var(--text-faint)' }}>
                No nodes match "{query}"
              </p>
            )}
            {filtered.map(def => <PaletteItem key={`${def.kind}-${def.subtype}`} def={def} />)}
          </div>
        ) : (
          <>
          <details open className="mb-1">
            <summary className="text-xs font-semibold uppercase tracking-wider px-2 py-1 cursor-pointer select-none"
                     style={{ color: 'var(--text-muted)' }}>
              My Functions
            </summary>
            <div className="pl-1">
              <NewFunctionButton />
              {functions.map(fn => <FunctionItem key={`fn-${fn.name}`} fn={fn} />)}
            </div>
          </details>
          {CATEGORY_ORDER.filter(cat => grouped.has(cat)).map(cat => {
            const defs = grouped.get(cat)!; return (
            <details key={cat} open className="mb-1">
              <summary className="text-xs font-semibold uppercase tracking-wider px-2 py-1 cursor-pointer select-none"
                       style={{ color: 'var(--text-muted)' }}>
                {CATEGORY_LABELS[cat]}
              </summary>
              <div className="pl-1">
                {defs.map(def => <PaletteItem key={`${def.kind}-${def.subtype}`} def={def} />)}
              </div>
            </details>
          ); })}
          </>
        )}
      </div>

      <div className="p-2 border-t text-xs text-center select-none"
           style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-faint)' }}>
        Drag nodes onto canvas
      </div>
    </div>
  );
}
