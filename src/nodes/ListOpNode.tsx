import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode, ListOpNodeData } from '../types/nodes';

const OP_DISPLAY: Partial<Record<string, string>> = {
  'uncons': 'x:xs',
  '++':     '++',
};

export function ListOpNode({ data, selected }: NodeProps<LibNode>) {
  const d = data as ListOpNodeData;
  const display = OP_DISPLAY[d.op] ?? d.op;
  return (
    <BaseNode kind="listop" label={display} ports={d.ports} selected={selected} minWidth={130}>
      <span className="text-xs text-purple-300 font-mono select-none">{display}</span>
    </BaseNode>
  );
}
