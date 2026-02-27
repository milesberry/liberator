// ─── CallNode ────────────────────────────────────────────────────────────────
// A node that calls a named Function by reference.
// The user picks the target from a dropdown; ports update to match the
// selected function's signature, enabling the call to be wired up.

import { type NodeProps } from '@xyflow/react';
import { PhoneCall } from 'lucide-react';
import { Handle, Position, useNodeId } from '@xyflow/react';
import type { LibNode, ModuleNodeData, CallNodeData, Port } from '../types/nodes';
import { handleId } from '../types/nodes';
import { useGraphStore } from '../store/graphStore';
import { showType, wireColor } from '../types/haskell';
import { TUnknown } from '../types/haskell';

// ─── Inline port handle ───────────────────────────────────────────────────
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

export function CallNode({ data, selected }: NodeProps<LibNode>) {
  const d = data as CallNodeData;
  const nodeId = useNodeId() ?? '';
  const nodes = useGraphStore(s => s.nodes);
  const updateNodeData = useGraphStore(s => s.updateNodeData);

  // Collect all named Function (module) nodes on the root canvas
  const functionNodes = nodes.filter(n => n.data.kind === 'module') as LibNode[];
  const functionNames = functionNodes.map(n => (n.data as ModuleNodeData).name);

  const inputPorts  = d.ports.filter(p => p.direction === 'input');
  const outputPorts = d.ports.filter(p => p.direction === 'output');

  function handleSelect(name: string) {
    updateNodeData(nodeId, raw => {
      const cd = raw as CallNodeData;
      cd.targetName = name;

      if (!name) {
        cd.ports = [];
        return;
      }

      // Find the function node and mirror its ports
      const target = functionNodes.find(n => (n.data as ModuleNodeData).name === name);
      if (!target) { cd.ports = []; return; }
      const md = target.data as ModuleNodeData;

      cd.ports = [
        ...md.inputPorts.map(p => ({
          ...p,
          type: p.type ?? TUnknown,
          connected: false,
        })),
        ...md.outputPorts.map(p => ({
          ...p,
          type: p.type ?? TUnknown,
          connected: false,
        })),
      ];
    });
  }

  return (
    <div
      className={`rounded-lg shadow-md overflow-hidden border-2 transition-colors
        ${selected ? 'border-white' : 'border-indigo-500'}`}
      style={{ minWidth: 160, background: 'var(--bg-node)' }}
    >
      {/* Header */}
      <div className="px-2 py-1 bg-indigo-700 text-white text-xs font-semibold tracking-wide flex items-center gap-1.5">
        <PhoneCall size={11} />
        <span>Call Function</span>
      </div>

      {/* Dropdown */}
      <div className="px-2 py-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <select
          className="w-full text-xs rounded px-1.5 py-0.5 outline-none cursor-pointer"
          style={{ background: 'var(--bg-node-input)', color: 'var(--text-primary)', border: '1px solid var(--border-input)' }}
          value={d.targetName}
          onChange={e => handleSelect(e.target.value)}
          onClick={e => e.stopPropagation()}
        >
          <option value="">— select function —</option>
          {functionNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Ports */}
      {d.ports.length > 0 && (
        <div className="flex gap-0">
          {/* Input ports */}
          <div className="flex flex-col justify-center py-1 pl-0 pr-2 min-w-[60px]">
            {inputPorts.map(p => (
              <PortHandle key={p.id} nodeId={nodeId} port={p} />
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Output ports */}
          <div className="flex flex-col justify-center py-1 pl-2 pr-0 min-w-[60px]">
            {outputPorts.map(p => (
              <PortHandle key={p.id} nodeId={nodeId} port={p} />
            ))}
          </div>
        </div>
      )}

      {d.ports.length === 0 && !d.targetName && (
        <div className="text-center text-[9px] py-1.5 select-none" style={{ color: 'var(--text-faint)' }}>
          select a function above
        </div>
      )}
    </div>
  );
}
