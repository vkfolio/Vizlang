import React, { useState } from 'react';
import { EdgeLabelRenderer } from '@xyflow/react';
import type { Waypoint } from '@/stores/graphStore';
import { WaypointHandle } from './WaypointHandle';

interface WaypointOverlayProps {
  edgeId: string;
  waypoints: Waypoint[];
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  selected?: boolean;
}

export function WaypointOverlay({
  edgeId,
  waypoints,
  selected,
}: WaypointOverlayProps) {
  // Only show handles when edge has waypoints (always show them so user can drag)
  if (!waypoints || waypoints.length === 0) return null;

  return (
    <EdgeLabelRenderer>
      {waypoints.map((wp) => (
        <WaypointHandle
          key={wp.id}
          edgeId={edgeId}
          waypoint={wp}
          allWaypoints={waypoints}
        />
      ))}
    </EdgeLabelRenderer>
  );
}
