// ─── Toolbar ───────────────────────────────────────────────────────────────
// Top bar: Run / Reset + Save / Load / Export / Examples menu.

import { useState, useRef } from 'react';
import { Play, RotateCcw, FolderOpen, FileJson, FileCode, BookOpen, ChevronDown, Trash2, LayoutDashboard, Code, Sun, Moon, HelpCircle } from 'lucide-react';
import { useEvaluationStore } from '../../store/evaluationStore';
import { useEvaluation }      from '../../hooks/useEvaluation';
import { useGraphStore }      from '../../store/graphStore';
import { useUIStore }         from '../../store/uiStore';
import { saveGraphAsJson, loadGraphFromJson, exportGraphAsHaskell } from '../../utils/serialise';
import { graphToHaskell }     from '../../engine/toHaskell';
import { EXAMPLES }           from '../../examples';

interface ToolbarProps {
  onTidyUp: () => void;
}

export function Toolbar({ onTidyUp }: ToolbarProps) {
  const { isRunning, reset: resetEval } = useEvaluationStore();
  const { runAll } = useEvaluation();
  const { nodes, edges, subgraphs, loadGraph: loadIntoStore, clearGraph } = useGraphStore();
  const { showHaskell, setShowHaskell, theme, setTheme } = useUIStore();
  const [showExamples, setShowExamples] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [saveMsg, setSaveMsg]   = useState('');
  const [exportMsg, setExportMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Derive a display name from the canvas (first output label, or fallback) ──
  const canvasName = (() => {
    const out = nodes.find(n => n.data.kind === 'output');
    return (out?.data as any)?.label ?? 'liberator-graph';
  })();

  const handleSaveJson = () => {
    saveGraphAsJson(nodes, edges, subgraphs, canvasName);
    setSaveMsg('Saved!');
    setTimeout(() => setSaveMsg(''), 1500);
  };

  const handleLoadJson = () => {
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-picked if needed
    e.target.value = '';
    const g = await loadGraphFromJson(file);
    if (!g) { alert('Could not read file — make sure it is a Liberator .json graph.'); return; }
    if (nodes.length > 0 && !confirm(`Load "${g.name}"? This will replace the current canvas.`)) return;
    loadIntoStore(g.nodes, g.edges, g.subgraphs);
    resetEval();
  };

  const handleExportHs = () => {
    const src = graphToHaskell(nodes, edges, subgraphs);
    exportGraphAsHaskell(src, canvasName);
    setExportMsg('Exported!');
    setTimeout(() => setExportMsg(''), 1500);
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
    <div className="flex items-center gap-2 px-4 py-2 select-none relative border-b"
         style={{ background: 'var(--bg-toolbar)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3">
        <span className="text-blue-400 font-bold text-lg tracking-tight">Liberator</span>
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>visual Haskell</span>
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
        className="flex items-center gap-1.5 px-3 py-1 rounded text-white text-xs font-medium transition-colors"
        style={{ background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', color: 'var(--text-primary)' }}>
        <RotateCcw size={12} />
        Reset
      </button>

      <div className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />

      {/* Save as JSON */}
      <button onClick={handleSaveJson} title="Download graph as .json file"
        className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors"
        style={{ background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', color: 'var(--text-primary)' }}>
        <FileJson size={12} />
        {saveMsg || 'Save'}
      </button>

      {/* Load from JSON */}
      <button onClick={handleLoadJson} title="Load graph from .json file"
        className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors"
        style={{ background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', color: 'var(--text-primary)' }}>
        <FolderOpen size={12} />
        Load
      </button>

      {/* Export as .hs */}
      <button onClick={handleExportHs} title="Export as Haskell source (.hs)"
        className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-violet-700 text-xs font-medium transition-colors"
        style={{ background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', color: 'var(--text-primary)' }}>
        <FileCode size={12} />
        {exportMsg || 'Export .hs'}
      </button>

      {/* Hidden file input for JSON load */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChosen}
      />

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
          <div className="absolute top-full left-0 mt-1 w-64 rounded shadow-xl z-50 overflow-hidden border"
               style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            {EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => handleExample(i)}
                className="w-full text-left px-3 py-2 text-xs transition-colors border-b last:border-0"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ctrl-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                {ex.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clear canvas */}
      <button onClick={handleClear} title="Clear canvas"
        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-red-800
                   hover:text-white text-xs font-medium transition-colors"
        style={{ background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', color: 'var(--text-muted)' }}>
        <Trash2 size={12} />
      </button>

      {/* Tidy Up — auto-layout nodes */}
      <button onClick={onTidyUp} title="Auto-layout nodes (left-to-right)"
        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-indigo-700
                   hover:text-white text-xs font-medium transition-colors"
        style={{ background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', color: 'var(--text-muted)' }}>
        <LayoutDashboard size={12} />
      </button>

      {/* Show Haskell code panel */}
      <button
        onClick={() => setShowHaskell(!showHaskell)}
        title="Show Haskell code"
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors
                    ${showHaskell
                      ? 'bg-emerald-700 text-white'
                      : 'hover:bg-emerald-700 hover:text-white'}`}
        style={showHaskell ? {} : { background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', color: 'var(--text-muted)' }}
      >
        <Code size={12} />
      </button>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors hover:text-white"
        style={{ background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--ctrl-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--ctrl-bg)')}
      >
        {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
      </button>

      {/* Help dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowHelp(v => !v)}
          title="Help &amp; documentation"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
          style={{ background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--ctrl-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--ctrl-bg)')}
        >
          <HelpCircle size={12} />
          <ChevronDown size={10} className={`transition-transform ${showHelp ? 'rotate-180' : ''}`} />
        </button>
        {showHelp && (
          <div className="absolute top-full right-0 mt-1 w-48 rounded shadow-xl z-50 overflow-hidden border"
               style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
            {[
              { label: 'README',          url: 'https://github.com/milesberry/liberator/blob/main/README.md' },
              { label: 'Getting Started', url: 'https://github.com/milesberry/liberator/blob/main/docs/getting-started.md' },
            ].map(({ label, url }) => (
              <button key={label}
                onClick={() => { window.open(url, '_blank'); setShowHelp(false); }}
                className="w-full text-left px-3 py-2 text-xs transition-colors border-b"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ctrl-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                {label}
              </button>
            ))}
            <button
              onClick={() => { window.open('https://github.com/milesberry/liberator/blob/main/docs/colophon.md', '_blank'); setShowHelp(false); }}
              className="w-full text-left px-3 py-2 text-xs transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ctrl-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>
              About
            </button>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Close dropdowns when clicking outside */}
      {showExamples && (
        <div className="fixed inset-0 z-40" onClick={() => setShowExamples(false)} />
      )}
      {showHelp && (
        <div className="fixed inset-0 z-40" onClick={() => setShowHelp(false)} />
      )}
    </div>
  );
}
