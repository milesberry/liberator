import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode, MatchListNodeData } from '../types/nodes';
import { useGraphStore } from '../store/graphStore';

export function MatchListNode({ id, data, selected }: NodeProps<LibNode>) {
  const d = data as MatchListNodeData;
  const updateNodeData = useGraphStore(s => s.updateNodeData);

  return (
    <BaseNode kind="matchlist" label="case [ ] of" ports={d.ports} selected={selected} minWidth={180}>
      <div className="flex flex-col gap-1 text-xs nodrag px-1 py-0.5">
        <div className="flex items-center gap-1">
          <span style={{ color: 'var(--text-faint)', minWidth: '2.5rem' }}>head →</span>
          <input
            value={d.headVar}
            onChange={e => updateNodeData(id, nd => { (nd as MatchListNodeData).headVar = e.target.value; })}
            className="w-14 text-center font-mono rounded px-1 py-0.5 outline-none"
            style={{ background: 'var(--bg-node-input)', color: 'var(--text-primary)', border: '1px solid var(--border-input)' }}
            onClick={e => e.stopPropagation()}
            placeholder="x"
          />
        </div>
        <div className="flex items-center gap-1">
          <span style={{ color: 'var(--text-faint)', minWidth: '2.5rem' }}>tail →</span>
          <input
            value={d.tailVar}
            onChange={e => updateNodeData(id, nd => { (nd as MatchListNodeData).tailVar = e.target.value; })}
            className="w-14 text-center font-mono rounded px-1 py-0.5 outline-none"
            style={{ background: 'var(--bg-node-input)', color: 'var(--text-primary)', border: '1px solid var(--border-input)' }}
            onClick={e => e.stopPropagation()}
            placeholder="xs'"
          />
        </div>
      </div>
    </BaseNode>
  );
}
