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
  const dy = Math.abs(sourceY - targetY);
  const isVertical = dy > dx;

  let edgePath: string;

  if (isVertical) {
    if (dx < 2) {
      edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else {
      const midY = (sourceY + targetY) / 2;
      edgePath = `M ${sourceX} ${sourceY} C ${sourceX} ${midY} ${targetX} ${midY} ${targetX} ${targetY}`;
    }
  } else {
    if (dy < 2) {
      edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else {
      const midX = (sourceX + targetX) / 2;
      edgePath = `M ${sourceX} ${sourceY} C ${midX} ${sourceY} ${midX} ${targetY} ${targetX} ${targetY}`;
    }
  }

  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#a855f7',
          opacity: 0.5,
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
            className="bg-card/90 text-[10px] text-node-conditional px-2 py-0.5 rounded-full border border-node-conditional/20 font-mono"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
