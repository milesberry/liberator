// Custom edge renderer — colours wires by their Haskell type.
// Reads type info from typeStore (not edge.data) to stay in sync with
// the type checker without causing write-back loops.

import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { wireColor, TUnknown } from '../../types/haskell';
import type { LibEdge } from '../../types/edges';
import { useTypeStore } from '../../store/typeStore';
import { useEvaluationStore } from '../../store/evaluationStore';
import { wireValueText } from '../../utils/wireValues';

const MAX_LABEL = 40;   // longer values are shortened on the wire; Properties shows them in full

export function WireEdge({
  id,
  source, sourceHandleId,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  markerEnd,
  selected,
}: EdgeProps<LibEdge>) {
  // Read type info from the dedicated type store, keyed by edge ID
  const info = useTypeStore(s => s.checkedEdges.get(id));
  // The value flowing along this wire at the last Run, like a function machine
  const value = useEvaluationStore(s => s.wireValues.get(sourceHandleId ?? `${source}__result`));
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const sourceType = info?.sourceType ?? TUnknown;
  const compatible = info?.compatible ?? null;
  const color = wireColor(sourceType, compatible);
  // Function-typed wires are thicker — a visual cue that a function value is flowing
  const strokeWidth = sourceType.tag === 'Fun' ? 3 : 2;

  const valueText = wireValueText(value, sourceType);
  const shortText = valueText.length > MAX_LABEL ? `${valueText.slice(0, MAX_LABEL - 1)}…` : valueText;
  const showValue = hovered || selected;
  const hasError  = compatible === false && Boolean(info?.errorMessage);

  return (
    <>
      {/* A wide invisible strip along the wire, so it's easy to hover over */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {/* Selection halo — wider semi-transparent glow rendered behind the wire */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 7}
          opacity={0.35}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: selected ? strokeWidth + 1 : strokeWidth,
          opacity: selected ? 1 : 0.85,
        }}
      />
      {compatible === false && info?.errorMessage && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute bg-red-800 text-white text-xs rounded px-1 py-0.5 whitespace-nowrap cursor-help"
            title={info.errorMessage}
          >
            {info.errorShort ?? info.errorMessage}
          </div>
        </EdgeLabelRenderer>
      )}
      {showValue && (
        <EdgeLabelRenderer>
          <div
            style={{
              // Sits above an error label rather than on top of it
              transform: `translate(-50%, ${hasError ? '-150%' : '-50%'}) translate(${labelX}px,${labelY}px)`,
              background: 'var(--bg-panel)',
              color: value?.kind === 'value' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: `1px solid ${color}`,
              zIndex: 1001,   // above the nodes, so a short wire's value isn't hidden
            }}
            className="absolute pointer-events-none text-xs font-mono rounded px-1.5 py-0.5 whitespace-nowrap shadow"
            role="status"
          >
            {shortText}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
