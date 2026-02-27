// ─── ModuleNode ─────────────────────────────────────────────────────────────
// Renders a wrapped subgraph as a compact "chip" card.
// Double-clicking navigates into the subgraph.
// The amber header colour matches the HEADER_STYLES['module'] entry.

import { type NodeProps } from '@xyflow/react';
import { Package } from 'lucide-react';
import { Handle, Position, useNodeId } from '@xyflow/react';
import type { LibNode, ModuleNodeData } from '../types/nodes';
import { useGraphStore } from '../store/graphStore';
import { handleId, type Port } from '../types/nodes';
import { showType, wireColor } from '../types/haskell';
import { useGraphStore as useStore } from '../store/graphStore';

// ─── Inline port handle (same logic as BaseNode's PortHandle) ──────────────
function PortHandle({ nodeId, port }: { nodeId: string; port: Port }) {
  const hId = handleId(nodeId, port.id);
  const color = wireColor(port.type, null);
  const isInput = port.direction === 'input';
  return (
    <div
      className={`relative flex items-center gap-1 my-0.5 ${isInput ? 'justify-start' : 'justify-end'}`}
      title={showType(port.type)}
    >
      <Handle
        id={hId}
        type={isInput ? 'target' : 'source'}
        position={isInput ? Position.Left : Position.Right}
        style={{ background: color, width: 10, height: 10, border: '2px solid var(--handle-border)' }}
      />
      <span className="text-xs font-mono px-1 leading-none select-none"
            style={{ color: 'var(--port-label)' }}>
        {port.label}
      </span>
    </div>
  );
}

export function ModuleNode({ data, selected }: NodeProps<LibNode>) {
  const d = data as ModuleNodeData;
  const nodeId = useNodeId() ?? '';
  const pushSubgraph = useStore(s => s.pushSubgraph);
  const updateNodeData = useGraphStore(s => s.updateNodeData);

  return (
    <div
      className={`rounded-lg shadow-md overflow-hidden border-2 transition-colors cursor-pointer
        ${selected ? 'border-white' : 'border-amber-600'}`}
      style={{ minWidth: 160, background: 'var(--bg-node)' }}
      onDoubleClick={() => pushSubgraph(d.subgraphId)}
    >
      {/* Header */}
      <div className="px-2 py-1 bg-amber-700 text-white text-xs font-semibold tracking-wide flex items-center gap-1.5">
        <Package size={11} />
        <input
          className="bg-transparent outline-none text-white font-semibold w-full cursor-text"
          value={d.name}
          onChange={e => updateNodeData(nodeId, nd => { (nd as ModuleNodeData).name = e.target.value; })}
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
        />
      </div>

      {/* Body: input ports | icon | output ports */}
      <div className="flex gap-0">
        {/* Input ports */}
        <div className="flex flex-col justify-center py-1 pl-0 pr-2 min-w-[60px]">
          {d.inputPorts.map(p => (
            <PortHandle key={p.id} nodeId={nodeId} port={p} />
          ))}
        </div>

        {/* Centre glyph */}
        <div className="flex-1 flex items-center justify-center py-2 px-1">
          <span className="text-amber-400 text-xs italic">⟦ {d.name} ⟧</span>
        </div>

        {/* Output ports */}
        <div className="flex flex-col justify-center py-1 pl-2 pr-0 min-w-[60px]">
          {d.outputPorts.map(p => (
            <PortHandle key={p.id} nodeId={nodeId} port={p} />
          ))}
        </div>
      </div>

      {/* Footer: "double-click to edit" hint */}
      <div className="text-center text-[9px] pb-0.5 select-none" style={{ color: 'var(--text-faint)' }}>
        dbl-click to edit
      </div>
    </div>
  );
}
