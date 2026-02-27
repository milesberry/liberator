// ─── QuickAdd ──────────────────────────────────────────────────────────────
// Ctrl+K / Cmd+K spotlight-style dialog. Type to filter nodes, Enter to drop
// the highlighted node at the current canvas centre.

import { useState, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Search } from 'lucide-react';
import { NODE_REGISTRY, CATEGORY_LABELS, type NodeDefinition } from '../../nodes/registry';
import { useGraphStore } from '../../store/graphStore';

interface QuickAddProps {
  open: boolean;
  onClose: () => void;
}

const MAX_RESULTS = 10;

export function QuickAdd({ open, onClose }: QuickAddProps) {
  const [query, setQuery]           = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLUListElement>(null);

  const addNode    = useGraphStore(s => s.addNode);
  const reactFlow  = useReactFlow();

  // Reset state whenever dialog opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      // Small delay so the element is mounted before focus
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Filter registry
  const q = query.trim().toLowerCase();
  const filtered: NodeDefinition[] = q
    ? NODE_REGISTRY.filter(d =>
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
      ).slice(0, MAX_RESULTS)
    : NODE_REGISTRY.slice(0, MAX_RESULTS);

  // Clamp selection when list changes
  const clampedIdx = Math.min(selectedIdx, filtered.length - 1);

  // Scroll selected item into view
  useEffect(() => {
    const item = listRef.current?.children[clampedIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [clampedIdx]);

  function addAtCentre(def: NodeDefinition) {
    const viewport = reactFlow.getViewport();
    const domNode  = reactFlow.getNodesBounds ? null : null; // unused
    // Get canvas container bounds from the viewport's DOM element
    const rfContainer = document.querySelector('.react-flow') as HTMLElement | null;
    const rect = rfContainer?.getBoundingClientRect();
    const w = rect?.width  ?? window.innerWidth;
    const h = rect?.height ?? window.innerHeight;

    const centreX = (-viewport.x + w / 2) / viewport.zoom;
    const centreY = (-viewport.y + h / 2) / viewport.zoom;
    addNode(def, { x: centreX - 80, y: centreY - 40 });
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const def = filtered[clampedIdx];
      if (def) addAtCentre(def);
      return;
    }
  }

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="absolute inset-0 z-50 flex items-start justify-center pt-24 bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Dialog card */}
      <div className="w-96 rounded-xl shadow-2xl overflow-hidden border"
           style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b"
             style={{ borderColor: 'var(--border-subtle)' }}>
          <Search size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search nodes… (Enter to add)"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <kbd className="text-xs font-mono rounded px-1"
               style={{ color: 'var(--text-faint)', border: '1px solid var(--border-input)' }}>Esc</kbd>
        </div>

        {/* Results list */}
        <ul ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-xs" style={{ color: 'var(--text-faint)' }}>
              No nodes match "{query}"
            </li>
          ) : (
            filtered.map((def, i) => (
              <li
                key={`${def.kind}-${def.subtype ?? i}`}
                onMouseDown={() => addAtCentre(def)}
                onMouseEnter={() => setSelectedIdx(i)}
                className="flex items-center justify-between px-3 py-2 cursor-pointer select-none transition-colors"
                style={{
                  background: i === clampedIdx ? '#2563eb' : '',
                  color: i === clampedIdx ? 'white' : 'var(--text-primary)',
                }}
              >
                <span className="text-sm font-medium">{def.label}</span>
                <span className="text-xs"
                      style={{ color: i === clampedIdx ? '#bfdbfe' : 'var(--text-faint)' }}>
                  {CATEGORY_LABELS[def.category]}
                </span>
              </li>
            ))
          )}
        </ul>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-3 py-2 border-t text-xs"
             style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-faint)' }}>
          <span><kbd className="font-mono rounded px-1"
                     style={{ border: '1px solid var(--border-input)' }}>↑↓</kbd> navigate</span>
          <span><kbd className="font-mono rounded px-1"
                     style={{ border: '1px solid var(--border-input)' }}>↵</kbd> add</span>
          <span><kbd className="font-mono rounded px-1"
                     style={{ border: '1px solid var(--border-input)' }}>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
