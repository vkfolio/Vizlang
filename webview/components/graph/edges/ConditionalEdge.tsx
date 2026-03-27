import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react';
import { useExecutionStore } from '@/stores/executionStore';
import { computeEdgePath } from './AnimatedEdge';
import type { EdgeData } from '@/stores/graphStore';
import { WaypointOverlay } from './WaypointOverlay';

export function ConditionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  data,
  style,
  selected,
}: EdgeProps) {
  const runStatus = useExecutionStore((s) => s.runStatus);
  const isRunning = runStatus === 'running';
  const waypoints = (data as EdgeData)?.waypoints;

  const edgePath = computeEdgePath(sourceX, sourceY, targetX, targetY, waypoints);

  // Position label correctly for both forward and back-edges
  const isBackEdge = targetY < sourceY - 20;
  const labelX = isBackEdge
    ? Math.min(sourceX, targetX) - 50
    : (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#a855f7',
          opacity: 0.7,
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
