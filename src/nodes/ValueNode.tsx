import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode } from '../types/nodes';
import type { ValueNodeData } from '../types/nodes';
import { useGraphStore } from '../store/graphStore';

const VALUE_TYPE_LABELS: Record<string, string> = {
  Int: '123', Float: '1.0', Bool: 'T/F', String: '"…"', List: '[…]',
};

export function ValueNode({ id, data, selected }: NodeProps<LibNode>) {
  const d = data as ValueNodeData;
  const updateNodeData = useGraphStore(s => s.updateNodeData);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, (nd) => {
      (nd as ValueNodeData).literal = e.target.value;
    });
  };

  return (
    <BaseNode kind="value" label={`${VALUE_TYPE_LABELS[d.valueType]} ${d.valueType}`} ports={d.ports} selected={selected} minWidth={150}>
      <input
        value={d.literal}
        onChange={handleChange}
        className="w-full text-xs font-mono bg-slate-800 text-white border border-slate-600 rounded px-1 py-0.5 text-center nodrag"
        onClick={e => e.stopPropagation()}
      />
    </BaseNode>
  );
}
