// ─── Edge (wire) types ─────────────────────────────────────────────────────

import type { Edge } from '@xyflow/react';
import type { HaskellType } from './haskell';
import { TUnknown } from './haskell';

export interface LibEdgeData {
  sourceType: HaskellType;          // type of the source output port
  targetType: HaskellType;          // type of the target input port
  compatible: boolean | null;       // null = not yet checked; false = mismatch
  errorMessage?: string;
}

export type LibEdge = Edge<LibEdgeData>;

export function defaultEdgeData(): LibEdgeData {
  return {
    sourceType: TUnknown,
    targetType: TUnknown,
    compatible: null,
  };
}
