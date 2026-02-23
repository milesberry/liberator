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
          className="text-xs text-center font-semibold bg-transparent text-emerald-300 border-b border-slate-600 outline-none w-full"
          onClick={e => e.stopPropagation()}
          placeholder="Label…"
        />
        <div className="text-xs font-mono text-white bg-slate-800 rounded px-2 py-1 min-h-[24px]">
          {result
            ? <span className={result.isError ? 'text-red-400' : 'text-emerald-300'}>{result.value}</span>
            : <span className="text-slate-500">—</span>
          }
        </div>
      </div>
    </BaseNode>
  );
}
