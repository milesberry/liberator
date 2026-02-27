// ─── Properties Panel ──────────────────────────────────────────────────────
// Right sidebar. Shows info about the selected node: description, port labels
// (editable), and a Delete button.

import { Trash2 } from 'lucide-react';
import { useUIStore }   from '../../store/uiStore';
import { useGraphStore } from '../../store/graphStore';
import { findDefinition } from '../../nodes/registry';
import { wireColor } from '../../types/haskell';
import type { LibNodeData, Port } from '../../types/nodes';

// ─── Port label row ────────────────────────────────────────────────────────

interface PortRowProps {
  port: Port;
  onRename: (newLabel: string) => void;
}

function PortRow({ port, onRename }: PortRowProps) {
  const color = wireColor(port.type, null);
  return (
    <div className="flex items-center gap-2 py-0.5">
      {/* Type colour dot */}
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/20"
        style={{ background: color }}
        title={String(port.type?.tag ?? '?')}
      />
      <input
        value={port.label}
        onChange={e => onRename(e.target.value)}
        onClick={e => e.stopPropagation()}
        className="flex-1 text-xs font-mono rounded px-1.5 py-0.5 outline-none focus:border-blue-500 nodrag"
        style={{
          background: 'var(--bg-node-input)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-input)',
        }}
      />
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────

export function PropertiesPanel() {
  const selectedNodeId  = useUIStore(s => s.selectedNodeId);
  const setSelectedNodeId = useUIStore(s => s.setSelectedNodeId);

  const nodes          = useGraphStore(s =>
    s.activeSubgraphId
      ? (s.subgraphs[s.activeSubgraphId]?.nodes ?? s.nodes)
      : s.nodes
  );
  const updateNodeData = useGraphStore(s => s.updateNodeData);
  const removeNode     = useGraphStore(s => s.removeNode);

  const node = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function renamePort(portId: string, newLabel: string) {
    if (!selectedNodeId) return;
    updateNodeData(selectedNodeId, data => {
      const p = data.ports.find(pp => pp.id === portId);
      if (p) p.label = newLabel;
    });
  }

  function deleteNode() {
    if (!selectedNodeId) return;
    removeNode(selectedNodeId);
    setSelectedNodeId(null);
  }

  // ── Node-specific editable fields ─────────────────────────────────────────

  function NodeSpecificFields({ data }: { data: LibNodeData }) {
    switch (data.kind) {
      case 'module':
        return (
          <div className="mb-3">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Function name</label>
            <input
              value={data.name}
              onChange={e => updateNodeData(selectedNodeId!, d => {
                (d as typeof data).name = e.target.value;
              })}
              onClick={e => e.stopPropagation()}
              className="w-full text-xs font-mono rounded px-2 py-1 outline-none focus:border-blue-500"
              style={{ background: 'var(--bg-node-input)', color: 'var(--text-primary)', border: '1px solid var(--border-input)' }}
            />
          </div>
        );
      case 'lambda':
        return (
          <div className="mb-3">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Parameter name</label>
            <input
              value={data.paramName}
              onChange={e => updateNodeData(selectedNodeId!, d => {
                (d as typeof data).paramName = e.target.value;
              })}
              onClick={e => e.stopPropagation()}
              className="w-full text-xs font-mono rounded px-2 py-1 outline-none focus:border-blue-500"
              style={{ background: 'var(--bg-node-input)', color: 'var(--text-primary)', border: '1px solid var(--border-input)' }}
            />
          </div>
        );
      case 'let':
        return (
          <div className="mb-3">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Variable name</label>
            <input
              value={data.varName}
              onChange={e => updateNodeData(selectedNodeId!, d => {
                (d as typeof data).varName = e.target.value;
              })}
              onClick={e => e.stopPropagation()}
              className="w-full text-xs font-mono rounded px-2 py-1 outline-none focus:border-blue-500"
              style={{ background: 'var(--bg-node-input)', color: 'var(--text-primary)', border: '1px solid var(--border-input)' }}
            />
          </div>
        );
      case 'output':
        return (
          <div className="mb-3">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Output label</label>
            <input
              value={data.label}
              onChange={e => updateNodeData(selectedNodeId!, d => {
                (d as typeof data).label = e.target.value;
              })}
              onClick={e => e.stopPropagation()}
              className="w-full text-xs font-mono rounded px-2 py-1 outline-none focus:border-blue-500"
              style={{ background: 'var(--bg-node-input)', color: 'var(--text-primary)', border: '1px solid var(--border-input)' }}
            />
          </div>
        );
      default:
        return null;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const open = !!node;

  return (
    <div
      className="flex-shrink-0 flex flex-col border-l overflow-hidden transition-all duration-200"
      style={{
        width: open ? 240 : 0,
        minWidth: open ? 240 : 0,
        background: 'var(--bg-palette)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Panel header */}
      <div className="px-3 py-2 border-b text-xs font-semibold uppercase tracking-wider select-none whitespace-nowrap"
           style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        Properties
      </div>

      {!node ? null : (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {/* Node kind + label */}
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {findDefinition(node.data.kind, (node.data as any).op ?? (node.data as any).subtype)?.label
                ?? node.data.kind}
            </p>
            <p className="text-xs capitalize mt-0.5" style={{ color: 'var(--text-faint)' }}>
              {node.data.kind}
              {(node.data as any).op ? ` · ${(node.data as any).op}` : ''}
            </p>
          </div>

          {/* Description */}
          {(() => {
            const def = findDefinition(node.data.kind, (node.data as any).op ?? (node.data as any).subtype);
            return def?.description ? (
              <div>
                <p className="text-xs leading-relaxed font-mono whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>
                  {def.description}
                </p>
              </div>
            ) : null;
          })()}

          {/* Node-specific editable fields */}
          <NodeSpecificFields data={node.data} />

          {/* Port labels */}
          {node.data.ports.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Ports</p>
              <div className="space-y-1">
                {node.data.ports.filter(p => p.direction === 'input').length > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Inputs</p>
                    {node.data.ports
                      .filter(p => p.direction === 'input')
                      .map(p => (
                        <PortRow key={p.id} port={p} onRename={label => renamePort(p.id, label)} />
                      ))}
                  </div>
                )}
                {node.data.ports.filter(p => p.direction === 'output').length > 0 && (
                  <div className="mt-1">
                    <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Outputs</p>
                    {node.data.ports
                      .filter(p => p.direction === 'output')
                      .map(p => (
                        <PortRow key={p.id} port={p} onRename={label => renamePort(p.id, label)} />
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Delete button */}
          <button
            onClick={deleteNode}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded
                       bg-red-900/40 hover:bg-red-700 text-red-300 hover:text-white
                       text-xs font-medium border border-red-800 hover:border-red-600
                       transition-colors"
          >
            <Trash2 size={12} />
            Delete node
          </button>
        </div>
      )}
    </div>
  );
}
