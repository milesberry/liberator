// ─── CallNode ────────────────────────────────────────────────────────────────
// A node that calls a named Function by reference.
// Once bound to a Function it looks like that Function's own block, and
// double-clicking opens the definition. Unbound, the user types (or picks from
// autocomplete) the target name; ports update to match the function's signature.
// The function lookup searches root nodes AND all subgraphs so that a
// recursive call typed from inside a subgraph resolves correctly.

import { useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { PhoneCall } from 'lucide-react';
import { Handle, Position, useNodeId } from '@xyflow/react';
import type { LibNode, ModuleNodeData, CallNodeData, Port } from '../types/nodes';
import { handleId } from '../types/nodes';
import { useGraphStore } from '../store/graphStore';
import { listFunctions, findFunctionNode, bindCall } from '../utils/functions';
import { showType, wireColor } from '../types/haskell';
import { useTypeStore } from '../store/typeStore';
import { nodeSummary } from './summaries';

// ─── Inline port handle ───────────────────────────────────────────────────
function PortHandle({ nodeId, port }: { nodeId: string; port: Port }) {
  const hId = handleId(nodeId, port.id);
  const type = useTypeStore(s => s.portTypes.get(hId)) ?? port.type;
  const color = wireColor(type, null);
  const isInput = port.direction === 'input';
  return (
    <div
      className={`relative flex items-center gap-1 my-0.5 ${isInput ? 'justify-start' : 'justify-end'}`}
      title={showType(type)}
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
  const openFunction   = useGraphStore(s => s.openFunction);

  // Search root nodes AND all subgraphs so a recursive reference typed
  // from inside a subgraph (e.g. calling the module being built) resolves.
  const rootNodes    = useGraphStore(s => s.nodes);
  const subgraphMap  = useGraphStore(s => s.subgraphs);
  const functionNames = listFunctions(rootNodes, subgraphMap).map(md => md.name);
  const target = d.targetName ? findFunctionNode(d.targetName, rootNodes, subgraphMap) : undefined;

  // Local draft so the input stays responsive while typing
  const [draft, setDraft] = useState(d.targetName);

  const inputPorts  = d.ports.filter(p => p.direction === 'input');
  const outputPorts = d.ports.filter(p => p.direction === 'output');

  function commit(name: string) {
    const trimmed = name.trim();
    const md = trimmed ? findFunctionNode(trimmed, rootNodes, subgraphMap)?.data as ModuleNodeData | undefined : undefined;
    updateNodeData(nodeId, raw => bindCall(raw as CallNodeData, trimmed, md));
  }

  const ports = (
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
  );

  // ── Bound to a Function: look like that Function's own block ─────────────
  // Same amber colours and ports as the definition, so using a function looks
  // like using a built-in. The call icon marks it as a use, not the definition;
  // double-click opens the definition. (Change the target in Properties.)
  if (target) {
    const md = target.data as ModuleNodeData;
    return (
      <div
        className={`rounded-lg shadow-md overflow-hidden border-2 transition-colors cursor-pointer
          ${selected ? 'border-white' : 'border-amber-600'}`}
        style={{ minWidth: 160, background: 'var(--bg-node)' }}
        onDoubleClick={() => openFunction(md.subgraphId)}
      >
        <div className="px-2 py-1 bg-amber-700 text-white text-xs font-semibold tracking-wide flex items-center gap-1.5"
             title={nodeSummary(data)}>
          <PhoneCall size={11} aria-label="uses" />
          <span className="font-mono">{d.targetName}</span>
        </div>
        {ports}
        <div className="text-center text-[9px] pb-0.5 select-none" style={{ color: 'var(--text-faint)' }}>
          dbl-click to open
        </div>
      </div>
    );
  }

  // ── Not bound yet: type or pick the Function's name ──────────────────────
  return (
    <div
      className={`rounded-lg shadow-md overflow-hidden border-2 transition-colors
        ${selected ? 'border-white' : 'border-indigo-500'}`}
      style={{ minWidth: 160, background: 'var(--bg-node)' }}
    >
      {/* Header */}
      <div className="px-2 py-1 bg-indigo-700 text-white text-xs font-semibold tracking-wide flex items-center gap-1.5"
           title={nodeSummary(data)}>
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

      {d.ports.length > 0 && ports}

      {d.ports.length === 0 && (
        <div className="text-center text-[9px] py-1.5 select-none" style={{ color: 'var(--text-faint)' }}>
          {d.targetName ? `no function called "${d.targetName}" yet` : 'type a function name above'}
        </div>
      )}
    </div>
  );
}
