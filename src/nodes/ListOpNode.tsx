import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode, ListOpNodeData } from '../types/nodes';

export function ListOpNode({ data, selected }: NodeProps<LibNode>) {
  const d = data as ListOpNodeData;
  return (
    <BaseNode kind="listop" label={d.op} ports={d.ports} selected={selected} minWidth={130}>
      <span className="text-xs text-purple-300 font-mono select-none">{d.op}</span>
    </BaseNode>
  );
}
