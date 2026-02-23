// Custom edge renderer — colours wires by their Haskell type.

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { wireColor } from '../../types/haskell';
import type { LibEdge } from '../../types/edges';

export function WireEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data,
  markerEnd,
}: EdgeProps<LibEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const sourceType = data?.sourceType ?? { tag: 'Unknown' as const };
  const compatible = data?.compatible ?? null;
  const color = wireColor(sourceType, compatible);
  // Function-typed wires are thicker to signal "this is a function value"
  const strokeWidth = sourceType.tag === 'Fun' ? 3 : 2;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: color, strokeWidth, opacity: 0.85 }}
      />
      {compatible === false && data?.errorMessage && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute pointer-events-none bg-red-800 text-white text-xs rounded px-1 py-0.5 whitespace-nowrap"
          >
            {data.errorMessage}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
