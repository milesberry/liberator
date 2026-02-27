// ─── ListCompNode ─────────────────────────────────────────────────────────────
// Visual representation of a list comprehension:
//   [ f x | x ← xs, p x ]
// Desugars in toExprTree to:  map f (filter p xs)
// The pred (p) port is optional — if unconnected, no filter is applied.

import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode, ListCompNodeData } from '../types/nodes';

export function ListCompNode({ data, selected }: NodeProps<LibNode>) {
  const d = data as ListCompNodeData;

  return (
    <BaseNode kind="listcomp" label="List Comprehension" ports={d.ports} selected={selected} minWidth={170}>
      <div className="flex flex-col items-center gap-0.5 text-xs text-slate-300 font-mono select-none px-1">
        <span className="text-green-400 text-[10px]">[ f x | x ← xs, p x ]</span>
      </div>
    </BaseNode>
  );
}
