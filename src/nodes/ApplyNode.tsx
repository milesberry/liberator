import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode, ApplyNodeData } from '../types/nodes';

export function ApplyNode({ data, selected }: NodeProps<LibNode>) {
  const d = data as ApplyNodeData;
  return (
    <BaseNode kind="apply" label="Apply ($)" ports={d.ports} selected={selected} minWidth={130}>
      <span className="text-xl text-indigo-300 font-bold select-none">$</span>
    </BaseNode>
  );
}
