import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode, LambdaNodeData } from '../types/nodes';
import { useGraphStore } from '../store/graphStore';

export function LambdaNode({ id, data, selected }: NodeProps<LibNode>) {
  const d = data as LambdaNodeData;
  const updateNodeData = useGraphStore(s => s.updateNodeData);

  return (
    <BaseNode kind="lambda" label="λ Lambda" ports={d.ports} selected={selected} minWidth={150}>
      <div className="flex items-center gap-1 text-xs nodrag">
        <span className="text-pink-300">λ</span>
        <input
          value={d.paramName}
          onChange={e => updateNodeData(id, nd => { (nd as LambdaNodeData).paramName = e.target.value; })}
          className="w-10 text-center font-mono bg-slate-800 text-white border border-slate-600 rounded px-1 py-0.5"
          onClick={e => e.stopPropagation()}
        />
        <span className="text-pink-300">→</span>
      </div>
    </BaseNode>
  );
}
