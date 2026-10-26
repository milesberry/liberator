// ─── Properties Panel ──────────────────────────────────────────────────────
// Right sidebar. Shows info about the selected node or edge.

import { Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useUIStore }   from '../../store/uiStore';
import { useGraphStore, parameterAnchors } from '../../store/graphStore';
import { useTypeStore }  from '../../store/typeStore';
import { findDefinition } from '../../nodes/registry';
import { useEvaluationStore } from '../../store/evaluationStore';
import { wireValueText } from '../../utils/wireValues';
import { nodeSummary } from '../../nodes/summaries';
import { wireColor, showType, TUnknown, type HaskellType } from '../../types/haskell';
import type { LibNodeData, Port } from '../../types/nodes';

// ─── Port label row ────────────────────────────────────────────────────────

interface PortRowProps {
  port: Port;
  inferred?: HaskellType;   // the type the checker has worked out for this port
  onRename: (newLabel: string) => void;
}

// Registry entry for a node: operators are keyed by op, values by their type.
// A function's Parameter and output nodes aren't palette entries, so have none.
function definitionFor(data: LibNodeData) {
  const d = data as { op?: string; valueType?: string; _modulePortId?: string };
  if (d._modulePortId) return undefined;
  return findDefinition(data.kind, d.op ?? d.valueType);
}

// Heading and subheading for a node that has no registry entry
function headingFor(data: LibNodeData): [string, string] {
  const d = data as { name?: string; _modulePortId?: string };
  if (data.kind === 'module') return [d.name ?? 'Function', 'Function'];
  if (d._modulePortId) return data.kind === 'value' ? ['Parameter', 'Function input'] : ['Output', 'Function result'];
  return [data.kind, data.kind];
}

function PortRow({ port, inferred, onRename }: PortRowProps) {
  const type = inferred ?? port.type;
  const color = wireColor(type, null);
  return (
    <div className="flex items-center gap-2 py-0.5">
      {/* Type colour dot */}
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/20"
        style={{ background: color }}
        title={showType(type)}
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
      {/* What this port carries: once a wire fixes the type, it says so */}
      <span className="text-[10px] font-mono flex-shrink-0 max-w-[45%] truncate"
            style={{ color: 'var(--text-muted)' }} title={showType(type)}>
        {showType(type)}
      </span>
    </div>
  );
}

// ─── Edge properties ───────────────────────────────────────────────────────

function EdgeProperties({ edgeId }: { edgeId: string }) {
  const info = useTypeStore(s => s.checkedEdges.get(edgeId));
  const wireValues = useEvaluationStore(s => s.wireValues);

  const nodes = useGraphStore(s =>
    s.activeSubgraphId
      ? (s.subgraphs[s.activeSubgraphId]?.nodes ?? s.nodes)
      : s.nodes
  );
  const edges = useGraphStore(s =>
    s.activeSubgraphId
      ? (s.subgraphs[s.activeSubgraphId]?.edges ?? s.edges)
      : s.edges
  );

  const edge = edges.find(e => e.id === edgeId);
  if (!edge) return null;

  const srcType   = info?.sourceType ?? TUnknown;
  const compatible = info?.compatible ?? null;
  const color     = wireColor(srcType, compatible);

  // Handle IDs are formatted as "nodeId__portId"
  function parseHandle(nodeId: string, handleStr: string | null | undefined) {
    if (!handleStr) return { nodeLabel: nodeId, portLabel: '' };
    const sep = handleStr.indexOf('__');
    const portId = sep >= 0 ? handleStr.slice(sep + 2) : handleStr;
    const nd = nodes.find(n => n.id === nodeId);
    const port = nd?.data.ports.find(p => p.id === portId);
    // Pick the best human-readable label for the node
    const nodeLabel =
      (nd?.data as any)?.label ??
      (nd?.data as any)?.name  ??
      (nd?.data as any)?.op    ??
      nd?.data.kind            ??
      nodeId;
    return { nodeLabel, portLabel: port?.label ?? portId };
  }

  const src = parseHandle(edge.source, edge.sourceHandle);
  const tgt = parseHandle(edge.target, edge.targetHandle);
  const value = wireValues.get(edge.sourceHandle ?? `${edge.source}__result`);

  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

      {/* Wire type */}
      <div>
        <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Wire type
        </p>
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/20"
            style={{ background: color }}
          />
          <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
            {showType(srcType)}
          </span>
        </div>
        {compatible === false && info?.errorMessage && (
          <p className="text-xs mt-1.5 text-red-400">{info.errorMessage}</p>
        )}
        {compatible === true && (
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>Compatible ✓</p>
        )}
      </div>

      {/* The value on the wire at the last Run, in full */}
      <div>
        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Value</p>
        <p className="text-xs font-mono break-words"
           style={{ color: value?.kind === 'value' ? 'var(--text-primary)' : 'var(--text-faint)' }}>
          {wireValueText(value, srcType)}
        </p>
      </div>

      {/* From */}
      <div>
        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>From</p>
        <p className="text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>{src.nodeLabel}</p>
        {src.portLabel && (
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>port: {src.portLabel}</p>
        )}
      </div>

      {/* To */}
      <div>
        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>To</p>
        <p className="text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>{tgt.nodeLabel}</p>
        {tgt.portLabel && (
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>port: {tgt.portLabel}</p>
        )}
      </div>

    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────

export function PropertiesPanel() {
  const selectedNodeId    = useUIStore(s => s.selectedNodeId);
  const setSelectedNodeId = useUIStore(s => s.setSelectedNodeId);
  const selectedEdgeId    = useUIStore(s => s.selectedEdgeId);

  const nodes          = useGraphStore(s =>
    s.activeSubgraphId
      ? (s.subgraphs[s.activeSubgraphId]?.nodes ?? s.nodes)
      : s.nodes
  );
  const updateNodeData = useGraphStore(s => s.updateNodeData);
  const removeNode     = useGraphStore(s => s.removeNode);
  const portTypes      = useTypeStore(s => s.portTypes);
  const moveParameter  = useGraphStore(s => s.moveParameter);

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

  const open  = !!node || !!selectedEdgeId;
  const title = node ? 'Properties' : 'Wire';

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
        {title}
      </div>

      {/* Edge content */}
      {!node && selectedEdgeId && (
        <EdgeProperties edgeId={selectedEdgeId} />
      )}

      {/* Node content */}
      {node && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {/* Node kind + label */}
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {definitionFor(node.data)?.label ?? headingFor(node.data)[0]}
            </p>
            <p className="text-xs capitalize mt-0.5" style={{ color: 'var(--text-faint)' }}>
              {definitionFor(node.data) ? node.data.kind : headingFor(node.data)[1]}
              {(node.data as any).op ? ` · ${(node.data as any).op}` : ''}
            </p>
          </div>

          {/* What the node does, then its Haskell type signature */}
          {nodeSummary(node.data) && (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {nodeSummary(node.data)}
            </p>
          )}
          {(() => {
            const def = definitionFor(node.data);
            return def?.description ? (
              <div>
                <p className="text-xs leading-relaxed font-mono whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>
                  {def.description}
                </p>
              </div>
            ) : null;
          })()}

          {/* A Parameter's place in the function's inputs, with buttons to move it */}
          {(() => {
            if (node.data.kind !== 'value' || !(node.data as { _modulePortId?: string })._modulePortId) return null;
            const anchors = parameterAnchors(nodes);
            const i = anchors.findIndex(n => n.id === node.id);
            const btn = 'p-1 rounded disabled:opacity-30';
            const btnStyle = { border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' };
            return (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="flex-1">Parameter {i + 1} of {anchors.length}</span>
                <button className={btn} style={btnStyle} disabled={i <= 0}
                        title="Make this an earlier parameter" onClick={() => moveParameter(node.id, -1)}>
                  <ArrowUp size={12} />
                </button>
                <button className={btn} style={btnStyle} disabled={i >= anchors.length - 1}
                        title="Make this a later parameter" onClick={() => moveParameter(node.id, 1)}>
                  <ArrowDown size={12} />
                </button>
              </div>
            );
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
                        <PortRow key={p.id} port={p} inferred={portTypes.get(`${node.id}__${p.id}`)}
                                 onRename={label => renamePort(p.id, label)} />
                      ))}
                  </div>
                )}
                {node.data.ports.filter(p => p.direction === 'output').length > 0 && (
                  <div className="mt-1">
                    <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Outputs</p>
                    {node.data.ports
                      .filter(p => p.direction === 'output')
                      .map(p => (
                        <PortRow key={p.id} port={p} inferred={portTypes.get(`${node.id}__${p.id}`)}
                                 onRename={label => renamePort(p.id, label)} />
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
