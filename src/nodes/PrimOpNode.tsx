import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode, PrimOpNodeData } from '../types/nodes';

const OP_SYMBOLS: Record<string, string> = {
  '+': '+', '-': '−', '*': '×', 'div': '÷', 'mod': '%',
  '==': '=', '/=': '≠', '<': '<', '>': '>', '<=': '≤', '>=': '≥',
  '&&': '∧', '||': '∨', 'not': '¬', 'negate': '−x', 'abs': '|x|',
};

export function PrimOpNode({ data, selected }: NodeProps<LibNode>) {
  const d = data as PrimOpNodeData;
  const sym = OP_SYMBOLS[d.op] ?? d.op;
  return (
    <BaseNode kind="primop" label={d.op} ports={d.ports} selected={selected} minWidth={120}>
      <span className="text-2xl text-blue-300 font-bold select-none">{sym}</span>
    </BaseNode>
  );
}
