import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode, IfNodeData } from '../types/nodes';

export function IfNode({ data, selected }: NodeProps<LibNode>) {
  const d = data as IfNodeData;
  return (
    <BaseNode kind="if" label="if / then / else" ports={d.ports} selected={selected} minWidth={150}>
      <span className="text-xs text-teal-300 font-mono select-none">if … then … else</span>
    </BaseNode>
  );
}
