import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode, OutputNodeData } from '../types/nodes';
import { useGraphStore } from '../store/graphStore';
import { useEvaluationStore } from '../store/evaluationStore';

export function OutputNode({ id, data, selected }: NodeProps<LibNode>) {
  const d = data as OutputNodeData;
  const updateNodeData = useGraphStore(s => s.updateNodeData);
  const result = useEvaluationStore(s => s.results.find(r => r.nodeId === id));

  return (
    <BaseNode kind="output" label="Output" ports={d.ports} selected={selected} minWidth={170}>
      <div className="flex flex-col gap-1 nodrag text-center w-full px-1">
        <input
          value={d.label}
          onChange={e => updateNodeData(id, nd => { (nd as OutputNodeData).label = e.target.value; })}
          className="text-xs text-center font-semibold bg-transparent border-b outline-none w-full"
          style={{ color: 'var(--color-result)', borderColor: 'var(--border-input)' }}
          onClick={e => e.stopPropagation()}
          placeholder="Label…"
        />
        <div className="text-xs font-mono rounded px-2 py-1 min-h-[24px]"
             style={{ background: 'var(--bg-node-input)', color: 'var(--text-primary)' }}>
          {result
            ? <span style={{ color: result.isError ? '#f87171' : 'var(--color-result)' }}>{result.value}</span>
            : <span style={{ color: 'var(--text-faint)' }}>—</span>
          }
        </div>
      </div>
    </BaseNode>
  );
}
