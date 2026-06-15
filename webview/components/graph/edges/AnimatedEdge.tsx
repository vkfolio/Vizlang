import React from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
  type Position,
} from '@xyflow/react';
import { useExecutionStore } from '@/stores/executionStore';
import type { Waypoint, EdgeData } from '@/stores/graphStore';
import { WaypointOverlay } from './WaypointOverlay';

// ─── Edge rendering constants ────────────────────────────────────────────────
/**
 * Step offset for back-edges: how far the path travels along the handle axis
 * before turning sideways. Scales with vertical distance so the arc stays
 * proportional. getSmoothStepPath picks left/right automatically based on
 * relative node positions.
 */
const BACK_EDGE_MIN_OFFSET = 40;
const BACK_EDGE_OFFSET_RATIO = 0.3;
// ─────────────────────────────────────────────────────────────────────────────

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
  style,
  selected,
}: EdgeProps) {
  const runStatus = useExecutionStore((s) => s.runStatus);
  const isRunning = runStatus === 'running';
  const waypoints = (data as EdgeData)?.waypoints;

  const edgePath = computeEdgePath(
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    waypoints,
  );

  return (
    <>
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
      <WaypointOverlay
        edgeId={id}
        waypoints={waypoints || []}
        sourceX={sourceX}
        sourceY={sourceY}
        targetX={targetX}
        targetY={targetY}
        selected={selected}
      />
    </>
  );
}

/**
 * Build a smooth path through waypoints using rounded corners.
 */
function buildWaypointPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const r = 8; // corner radius
  const segments: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Vector from prev to curr
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

    // Vector from curr to next
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    // Clamp radius to half the shortest segment
    const maxR = Math.min(len1, len2) / 2;
    const cr = Math.min(r, maxR);

    if (cr < 1 || len1 < 1 || len2 < 1) {
      // Too short for rounding, just go to the point
      segments.push(`L ${curr.x} ${curr.y}`);
      continue;
    }

    // Point before the corner
    const beforeX = curr.x - (dx1 / len1) * cr;
    const beforeY = curr.y - (dy1 / len1) * cr;

    // Point after the corner
    const afterX = curr.x + (dx2 / len2) * cr;
    const afterY = curr.y + (dy2 / len2) * cr;

    segments.push(`L ${beforeX} ${beforeY}`);
    segments.push(`Q ${curr.x} ${curr.y} ${afterX} ${afterY}`);
  }

  const last = points[points.length - 1];
  segments.push(`L ${last.x} ${last.y}`);

  return segments.join(' ');
}

/**
 * Compute a clean edge path that handles:
 * - Waypoint routing (user-defined control points)
 * - Straight vertical lines for aligned nodes (with tolerance)
 * - Forward edges with gentle bezier curves
 * - Back-edges with direction-aware orthogonal routing via getSmoothStepPath
 */
export function computeEdgePath(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  targetX: number,
  targetY: number,
  targetPosition: Position,
  waypoints?: Waypoint[],
): string {
  // If waypoints exist, route through them
  if (waypoints && waypoints.length > 0) {
    const points = [
      { x: sourceX, y: sourceY },
      ...waypoints,
      { x: targetX, y: targetY },
    ];
    return buildWaypointPath(points);
  }

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Back-edge: target is above source.
  // Use getSmoothStepPath so the route respects handle direction (giving lift),
  // then routes left or right based on relative node positions automatically.
  if (dy < -20) {
    const offset = Math.max(BACK_EDGE_MIN_OFFSET, absDy * BACK_EDGE_OFFSET_RATIO);
    const [path] = getSmoothStepPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
      borderRadius: 12,
      offset,
    });
    return path;
  }

  // Straight vertical: nodes are aligned (with 8px tolerance)
  if (absDx < 8) {
    const x = Math.round((sourceX + targetX) / 2);
    return `M ${x} ${sourceY} L ${x} ${targetY}`;
  }

  // Forward edge with gentle bezier curve
  if (absDy > absDx) {
    const midY = (sourceY + targetY) / 2;
    return `M ${sourceX} ${sourceY} C ${sourceX} ${midY} ${targetX} ${midY} ${targetX} ${targetY}`;
  } else {
    const midX = (sourceX + targetX) / 2;
    return `M ${sourceX} ${sourceY} C ${midX} ${sourceY} ${midX} ${targetY} ${targetX} ${targetY}`;
  }
}
