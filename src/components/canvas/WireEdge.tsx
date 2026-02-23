// Custom edge renderer — colours wires by their Haskell type.
// Reads type info from typeStore (not edge.data) to stay in sync with
// the type checker without causing write-back loops.

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { wireColor, TUnknown } from '../../types/haskell';
import type { LibEdge } from '../../types/edges';
import { useTypeStore } from '../../store/typeStore';

export function WireEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  markerEnd,
}: EdgeProps<LibEdge>) {
  // Read type info from the dedicated type store, keyed by edge ID
  const info = useTypeStore(s => s.checkedEdges.get(id));

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const sourceType = info?.sourceType ?? TUnknown;
  const compatible = info?.compatible ?? null;
  const color = wireColor(sourceType, compatible);
  // Function-typed wires are thicker — a visual cue that a function value is flowing
  const strokeWidth = sourceType.tag === 'Fun' ? 3 : 2;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: color, strokeWidth, opacity: 0.85 }}
      />
      {compatible === false && info?.errorMessage && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute pointer-events-none bg-red-800 text-white text-xs rounded px-1 py-0.5 whitespace-nowrap"
          >
            {info.errorMessage}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
