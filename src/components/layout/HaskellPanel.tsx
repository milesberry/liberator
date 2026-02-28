// ─── Haskell Code Panel ────────────────────────────────────────────────────
// Slide-in right panel that shows the current graph as Haskell source.
// Users can copy the code to paste into GHCi or a .hs file.

import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useUIStore }    from '../../store/uiStore';
import { useGraphStore } from '../../store/graphStore';
import { graphToHaskell } from '../../engine/toHaskell';

export function HaskellPanel() {
  const { showHaskell, setShowHaskell } = useUIStore();
  const { nodes, edges, subgraphs }     = useGraphStore();
  const [copied, setCopied] = useState(false);

  const code = showHaskell
    ? graphToHaskell(nodes, edges, subgraphs)
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className="flex-shrink-0 flex flex-col border-l overflow-hidden transition-all duration-200"
      style={{
        width: showHaskell ? 340 : 0,
        minWidth: showHaskell ? 340 : 0,
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {showHaskell && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
               style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-muted)' }}>
              Haskell
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                title="Copy to clipboard"
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs
                           hover:bg-emerald-700 hover:text-white transition-colors"
                style={{ background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', color: 'var(--text-muted)' }}
              >
                {copied
                  ? <><Check size={10} /> Copied!</>
                  : <><Copy size={10} /> Copy</>
                }
              </button>
              <button
                onClick={() => setShowHaskell(false)}
                title="Close"
                className="p-1 rounded hover:text-white hover:bg-slate-700 transition-colors"
                style={{ color: 'var(--text-faint)' }}
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Code */}
          <div className="flex-1 overflow-y-auto p-3">
            <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed"
                 style={{ color: 'var(--color-result)' }}>
              {code}
            </pre>
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t flex-shrink-0"
               style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
              Generated from graph — may need minor edits to compile
            </p>
          </div>
        </>
      )}
    </div>
  );
}
