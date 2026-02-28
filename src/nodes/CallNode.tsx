// ─── CallNode ────────────────────────────────────────────────────────────────
// A node that calls a named Function by reference.
// The user types (or picks from autocomplete) the target name; ports update to
// match the selected function's signature, enabling the call to be wired up.
// The function lookup searches root nodes AND all subgraphs so that a
// recursive call typed from inside a subgraph resolves correctly.

import { useState } from 'react';
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
  const updateNodeData = useGraphStore(s => s.updateNodeData);

  // Search root nodes AND all subgraphs so a recursive reference typed
  // from inside a subgraph (e.g. calling the module being built) resolves.
  const rootNodes    = useGraphStore(s => s.nodes);
  const subgraphMap  = useGraphStore(s => s.subgraphs);
  const allNodes: LibNode[] = [
    ...rootNodes,
    ...Object.values(subgraphMap).flatMap(sub => sub.nodes as LibNode[]),
  ];
  const functionNodes = allNodes.filter(n => n.data.kind === 'module') as LibNode[];
  const functionNames = [...new Set(functionNodes.map(n => (n.data as ModuleNodeData).name))];

  // Local draft so the input stays responsive while typing
  const [draft, setDraft] = useState(d.targetName);

  const inputPorts  = d.ports.filter(p => p.direction === 'input');
  const outputPorts = d.ports.filter(p => p.direction === 'output');

  function commit(name: string) {
    const trimmed = name.trim();
    updateNodeData(nodeId, raw => {
      const cd = raw as CallNodeData;
      cd.targetName = trimmed;

      if (!trimmed) { cd.ports = []; return; }

      // Find the module and mirror its ports
      const target = functionNodes.find(n => (n.data as ModuleNodeData).name === trimmed);
      if (!target) {
        // Name typed but module not yet found (e.g. forward reference to the
        // module currently being built). Keep any existing ports so wires stay.
        return;
      }
      const md = target.data as ModuleNodeData;
      cd.ports = [
        ...md.inputPorts.map(p => ({ ...p, type: p.type ?? TUnknown, connected: false })),
        ...md.outputPorts.map(p => ({ ...p, type: p.type ?? TUnknown, connected: false })),
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

      {/* Name input with datalist autocomplete */}
      <div className="px-2 py-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <input
          list={`fn-list-${nodeId}`}
          value={draft}
          placeholder="function name…"
          className="w-full text-xs font-mono rounded px-1.5 py-0.5 outline-none focus:border-blue-500 nodrag"
          style={{
            background: 'var(--bg-node-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-input)',
          }}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { commit((e.target as HTMLInputElement).value); e.currentTarget.blur(); }
            if (e.key === 'Escape') { setDraft(d.targetName); e.currentTarget.blur(); }
          }}
          onClick={e => e.stopPropagation()}
        />
        <datalist id={`fn-list-${nodeId}`}>
          {functionNames.map(name => <option key={name} value={name} />)}
        </datalist>
      </div>

      {/* Ports */}
      {d.ports.length > 0 && (
        <div className="flex gap-0">
          <div className="flex flex-col justify-center py-1 pl-0 pr-2 min-w-[60px]">
            {inputPorts.map(p => (
              <PortHandle key={p.id} nodeId={nodeId} port={p} />
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex flex-col justify-center py-1 pl-2 pr-0 min-w-[60px]">
            {outputPorts.map(p => (
              <PortHandle key={p.id} nodeId={nodeId} port={p} />
            ))}
          </div>
        </div>
      )}

      {d.ports.length === 0 && (
        <div className="text-center text-[9px] py-1.5 select-none" style={{ color: 'var(--text-faint)' }}>
          {d.targetName ? `"${d.targetName}" — navigate back to resolve` : 'type a function name above'}
        </div>
      )}
    </div>
  );
}
