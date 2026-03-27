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
  style,
}: EdgeProps) {
  const runStatus = useExecutionStore((s) => s.runStatus);
  const isRunning = runStatus === 'running';

  const edgePath = computeEdgePath(sourceX, sourceY, targetX, targetY);

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: 'var(--border)',
        strokeWidth: 1.5,
        ...style,
      }}
      className={isRunning ? 'animated' : ''}
    />
  );
}

/**
 * Compute a clean edge path that handles:
 * - Straight vertical lines for aligned nodes (with tolerance)
 * - Forward edges with gentle bezier curves
 * - Back-edges with clean orthogonal (right-angle) routing on the left side
 */
export function computeEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): string {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Back-edge: target is above source (loop back up)
  // Use clean orthogonal routing like Mermaid
  if (dy < -20) {
    const r = 8; // corner radius
    const pad = 20; // exit/entry stub length
    const loopX = Math.min(sourceX, targetX) - 50; // left offset for the loop

    // Path: down from source → left → up → right → into target
    // Using quadratic bezier (Q) for smooth 90° corners
    return [
      `M ${sourceX} ${sourceY}`,
      // Down stub
      `L ${sourceX} ${sourceY + pad - r}`,
      // Corner: turn left
      `Q ${sourceX} ${sourceY + pad} ${sourceX - r} ${sourceY + pad}`,
      // Left horizontal
      `L ${loopX + r} ${sourceY + pad}`,
      // Corner: turn up
      `Q ${loopX} ${sourceY + pad} ${loopX} ${sourceY + pad - r}`,
      // Up vertical
      `L ${loopX} ${targetY - pad + r}`,
      // Corner: turn right
      `Q ${loopX} ${targetY - pad} ${loopX + r} ${targetY - pad}`,
      // Right horizontal
      `L ${targetX - r} ${targetY - pad}`,
      // Corner: turn down into target
      `Q ${targetX} ${targetY - pad} ${targetX} ${targetY - pad + r}`,
      // Down into target
      `L ${targetX} ${targetY}`,
    ].join(' ');
  }

  // Straight vertical: nodes are aligned (with 8px tolerance)
  if (absDx < 8) {
    // Snap to averaged X for pixel-perfect straight line
    const x = Math.round((sourceX + targetX) / 2);
    return `M ${x} ${sourceY} L ${x} ${targetY}`;
  }

  // Forward edge with gentle bezier curve
  if (absDy > absDx) {
    // Mostly vertical: S-curve
    const midY = (sourceY + targetY) / 2;
    return `M ${sourceX} ${sourceY} C ${sourceX} ${midY} ${targetX} ${midY} ${targetX} ${targetY}`;
  } else {
    // Mostly horizontal: S-curve
    const midX = (sourceX + targetX) / 2;
    return `M ${sourceX} ${sourceY} C ${midX} ${sourceY} ${midX} ${targetY} ${targetX} ${targetY}`;
  }
}
