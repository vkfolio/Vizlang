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

  const dx = Math.abs(sourceX - targetX);
  const dy = Math.abs(sourceY - targetY);

  let edgePath: string;

  // Determine if layout is vertical (TB) or horizontal (LR) based on positions
  const isVertical = dy > dx;

  if (isVertical) {
    // Vertical layout: aligned on X
    if (dx < 2) {
      edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else {
      const midY = (sourceY + targetY) / 2;
      edgePath = `M ${sourceX} ${sourceY} C ${sourceX} ${midY} ${targetX} ${midY} ${targetX} ${targetY}`;
    }
  } else {
    // Horizontal layout: aligned on Y
    if (dy < 2) {
      edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else {
      const midX = (sourceX + targetX) / 2;
      edgePath = `M ${sourceX} ${sourceY} C ${midX} ${sourceY} ${midX} ${targetY} ${targetX} ${targetY}`;
    }
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: 'var(--muted-foreground)',
        opacity: 0.4,
        strokeWidth: 1.5,
        ...style,
      }}
      className={isRunning ? 'animated' : ''}
    />
  );
}
