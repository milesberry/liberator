// ─── BaseNode ──────────────────────────────────────────────────────────────
// Shared shell for all Liberator node types.
// Renders the node header, input handles on the left, output handles on the right.

import { Handle, Position, useNodeId } from '@xyflow/react';
import { showType, wireColor } from '../types/haskell';
import type { Port } from '../types/nodes';
import { handleId } from '../types/nodes';

// ─── Category colour bands ──────────────────────────────────────────────────

const HEADER_STYLES: Record<string, string> = {
  value:    'bg-slate-600 text-white',
  primop:   'bg-blue-700 text-white',
  listop:   'bg-purple-700 text-white',
  hof:      'bg-orange-600 text-white',
  lambda:   'bg-pink-700 text-white',
  if:       'bg-teal-700 text-white',
  apply:    'bg-indigo-700 text-white',
  output:   'bg-emerald-700 text-white',
  module:   'bg-amber-700 text-white',
  call:     'bg-indigo-700 text-white',
  let:      'bg-teal-600 text-white',
  listcomp: 'bg-green-700 text-white',
  comment:  'bg-yellow-600 text-white',
};

// ─── PortHandle ──────────────────────────────────────────────────────────────

interface PortHandleProps {
  nodeId: string;
  port: Port;
  compatible?: boolean | null;
}

function PortHandle({ nodeId, port, compatible }: PortHandleProps) {
  const hId = handleId(nodeId, port.id);
  const color = wireColor(port.type, compatible ?? null);
  const isInput = port.direction === 'input';

  return (
    <div
      className={`relative flex items-center gap-1 my-1 ${isInput ? 'justify-start' : 'justify-end'}`}
      title={showType(port.type)}
    >
      <Handle
        id={hId}
        type={isInput ? 'target' : 'source'}
        position={isInput ? Position.Left : Position.Right}
        style={{
          background: color,
          width: 10,
          height: 10,
          border: '2px solid var(--handle-border)',
        }}
      />
      <span className="text-xs font-mono px-1 leading-none select-none"
            style={{ color: 'var(--port-label)' }}>
        {port.label}
      </span>
    </div>
  );
}

// ─── BaseNode ──────────────────────────────────────────────────────────────

interface BaseNodeProps {
  kind: string;
  label: string;
  ports: Port[];
  children?: React.ReactNode;
  selected?: boolean;
  minWidth?: number;
}

export function BaseNode({ kind, label, ports, children, selected, minWidth = 140 }: BaseNodeProps) {
  const nodeId = useNodeId() ?? '';
  const inputPorts  = ports.filter(p => p.direction === 'input');
  const outputPorts = ports.filter(p => p.direction === 'output');
  const headerStyle = HEADER_STYLES[kind] ?? 'bg-gray-700 text-white';

  return (
    <div
      className={`rounded-lg shadow-md overflow-hidden border-2 transition-colors
        ${selected ? 'border-white' : 'border-transparent'}`}
      style={{ minWidth, background: 'var(--bg-node)' }}
    >
      {/* Header */}
      <div className={`px-2 py-1 text-xs font-semibold tracking-wide ${headerStyle}`}>
        {label}
      </div>

      {/* Body: input ports | content | output ports */}
      <div className="flex gap-0">
        {/* Input ports */}
        <div className="flex flex-col justify-center py-1 pl-0 pr-2 min-w-[60px]">
          {inputPorts.map(p => (
            <PortHandle key={p.id} nodeId={nodeId} port={p} />
          ))}
        </div>

        {/* Optional node-specific content */}
        {children && (
          <div className="flex-1 flex items-center justify-center py-1 px-1">
            {children}
          </div>
        )}

        {/* Output ports */}
        <div className="flex flex-col justify-center py-1 pl-2 pr-0 min-w-[60px]">
          {outputPorts.map(p => (
            <PortHandle key={p.id} nodeId={nodeId} port={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
