import React from 'react';
import {
  BaseEdge,
  type EdgeProps,
} from '@xyflow/react';
import { useExecutionStore } from '@/stores/executionStore';

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  ...rest
}: EdgeProps) {
  const runStatus = useExecutionStore((s) => s.runStatus);
  const isRunning = runStatus === 'running';

  // Use a simple straight line when source and target are roughly aligned,
  // otherwise use a smooth cubic bezier
  const dx = Math.abs(sourceX - targetX);
  const dy = Math.abs(sourceY - targetY);

  let edgePath: string;
  if (dx < 2) {
    // Perfectly aligned — straight line
    edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  } else {
    // Offset — use smooth bezier
    const midY = (sourceY + targetY) / 2;
    edgePath = `M ${sourceX} ${sourceY} C ${sourceX} ${midY} ${targetX} ${midY} ${targetX} ${targetY}`;
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: 'rgba(255, 255, 255, 0.15)',
        strokeWidth: 1.5,
        ...style,
      }}
      className={isRunning ? 'animated' : ''}
    />
  );
}
