import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode, HofNodeData } from '../types/nodes';

const HOF_SYMBOLS: Record<string, string> = {
  map: 'map', filter: 'filter', foldr: 'foldr', foldl: 'foldl', zipWith: 'zipWith',
  foldl1: 'foldl1', foldr1: 'foldr1',
};

export function HofNode({ data, selected }: NodeProps<LibNode>) {
  const d = data as HofNodeData;
  return (
    <BaseNode kind="hof" label={d.op} ports={d.ports} selected={selected} minWidth={140}>
      <span className="text-sm text-orange-300 font-bold italic select-none">{HOF_SYMBOLS[d.op]}</span>
    </BaseNode>
  );
}
