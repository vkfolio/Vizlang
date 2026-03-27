import React, { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useGraphStore } from '@/stores/graphStore';
import type { Waypoint } from '@/stores/graphStore';

interface WaypointHandleProps {
  edgeId: string;
  waypoint: Waypoint;
  allWaypoints: Waypoint[];
}

export function WaypointHandle({ edgeId, waypoint, allWaypoints }: WaypointHandleProps) {
  const { screenToFlowPosition } = useReactFlow();
  const updateEdgeWaypoints = useGraphStore((s) => s.updateEdgeWaypoints);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, wpX: 0, wpY: 0 });

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      draggingRef.current = true;
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        wpX: waypoint.x,
        wpY: waypoint.y,
      };

      const onMouseMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const flowPos = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        const updated = allWaypoints.map((wp) =>
          wp.id === waypoint.id ? { ...wp, x: flowPos.x, y: flowPos.y } : wp
        );
        updateEdgeWaypoints(edgeId, updated);
      };

      const onMouseUp = () => {
        draggingRef.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [edgeId, waypoint, allWaypoints, screenToFlowPosition, updateEdgeWaypoints]
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const updated = allWaypoints.filter((wp) => wp.id !== waypoint.id);
      updateEdgeWaypoints(edgeId, updated);
    },
    [edgeId, waypoint.id, allWaypoints, updateEdgeWaypoints]
  );

  return (
    <div
      className="waypoint-handle"
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${waypoint.x}px, ${waypoint.y}px)`,
        pointerEvents: 'all',
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      title="Drag to move • Right-click to remove"
    />
  );
}
