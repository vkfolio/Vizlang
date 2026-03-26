import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react';
import { useExecutionStore } from '@/stores/executionStore';

export function ConditionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
}: EdgeProps) {
  const runStatus = useExecutionStore((s) => s.runStatus);
  const isRunning = runStatus === 'running';

  const dx = Math.abs(sourceX - targetX);
  const midY = (sourceY + targetY) / 2;

  let edgePath: string;
  if (dx < 2) {
    edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  } else {
    edgePath = `M ${sourceX} ${sourceY} C ${sourceX} ${midY} ${targetX} ${midY} ${targetX} ${targetY}`;
  }

  const labelX = (sourceX + targetX) / 2;
  const labelY = midY;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: 'rgba(168, 85, 247, 0.5)',
          strokeWidth: 1.5,
          strokeDasharray: '6 4',
          ...style,
        }}
        className={isRunning ? 'animated' : ''}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="bg-card/90 text-[10px] text-node-conditional px-2 py-0.5 rounded-full border border-node-conditional/20 font-mono backdrop-blur-sm"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
