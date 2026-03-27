import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type Edge,
  applyNodeChanges,
  applyEdgeChanges,
  getNodesBounds,
  getViewportForBounds,
} from '@xyflow/react';
import { toPng } from 'html-to-image';
import { useGraphStore, type Waypoint, type EdgeData } from '@/stores/graphStore';
import { useExecutionStore } from '@/stores/executionStore';
import { useAutoLayout } from '@/hooks/useAutoLayout';
import { EntryNode } from './nodes/EntryNode';
import { ProcessNode } from './nodes/ProcessNode';
import { ConditionalNode } from './nodes/ConditionalNode';
import { EndNode } from './nodes/EndNode';
import { AnimatedEdge } from './edges/AnimatedEdge';
import { ConditionalEdge } from './edges/ConditionalEdge';
import { NodeStateTooltip } from './NodeStateTooltip';
import { GraphToolbar } from './GraphToolbar';
import { sendMessage } from '@/bridge/MessageBus';

const nodeTypes = {
  entry: EntryNode,
  process: ProcessNode,
  conditional: ConditionalNode,
  end: EndNode,
};

const edgeTypes = {
  animated: AnimatedEdge,
  conditional: ConditionalEdge,
};

/** Distance from point (px, py) to line segment (a, b) */
function pointToSegmentDist(
  px: number,
  py: number,
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function GraphCanvasInner() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const setNodes = useGraphStore((s) => s.setNodes);
  const setEdges = useGraphStore((s) => s.setEdges);
  const isLoading = useGraphStore((s) => s.isLoading);
  const showDots = useGraphStore((s) => s.showDots);

  // Hover state for node tooltip
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);
  const isOverTooltipRef = useRef(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { getNodes, screenToFlowPosition } = useReactFlow();

  // Register PNG export function in store
  useEffect(() => {
    const exportFn = () => {
      const allNodes = getNodes();
      if (allNodes.length === 0) return;

      const nodesBounds = getNodesBounds(allNodes);
      const pad = 20;
      const imgWidth = nodesBounds.width + pad * 2;
      const imgHeight = nodesBounds.height + pad * 2;
      const scale = 3;

      const flowEl = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!flowEl) return;

      // Compute transform: shift so graph top-left is at (pad, pad), scale 1:1
      const tx = -nodesBounds.x + pad;
      const ty = -nodesBounds.y + pad;

      toPng(flowEl, {
        backgroundColor: getComputedStyle(document.body).getPropertyValue('background-color') || '#1e1e1e',
        width: imgWidth * scale,
        height: imgHeight * scale,
        pixelRatio: 1, // we handle scaling via canvas size
        filter: (node) => {
          // Exclude minimap, controls, background dots from export
          if (node.classList) {
            if (
              node.classList.contains('react-flow__minimap') ||
              node.classList.contains('react-flow__controls') ||
              node.classList.contains('react-flow__background') ||
              node.classList.contains('react-flow__panel')
            ) {
              return false;
            }
          }
          return true;
        },
        style: {
          width: `${imgWidth * scale}px`,
          height: `${imgHeight * scale}px`,
          transform: `translate(${tx * scale}px, ${ty * scale}px) scale(${scale})`,
        },
      }).then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `graph-${Date.now()}.png`;
        a.click();
      }).catch((err) => {
        console.error('Failed to export PNG:', err);
      });
    };

    useGraphStore.getState().setExportPng(exportFn);
    return () => useGraphStore.getState().setExportPng(null);
  }, [getNodes]);

  // Compute auto-layout
  useAutoLayout();

  // Enable node dragging
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, nodes);
      setNodes(updated as typeof nodes);
    },
    [nodes, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updated = applyEdgeChanges(changes, edges);
      setEdges(updated as typeof edges);
    },
    [edges, setEdges]
  );

  // Double-click edge to add a waypoint
  const onEdgeDoubleClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const edgeData = (edge.data as EdgeData) || {};
      const existing = edgeData.waypoints || [];

      // Find insertion index: closest segment
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      // Build points list: source center → existing waypoints → target center
      const srcX = sourceNode.position.x + (sourceNode.measured?.width ?? 160) / 2;
      const srcY = sourceNode.position.y + (sourceNode.measured?.height ?? 40) / 2;
      const tgtX = targetNode.position.x + (targetNode.measured?.width ?? 160) / 2;
      const tgtY = targetNode.position.y + (targetNode.measured?.height ?? 40) / 2;

      const points = [
        { x: srcX, y: srcY },
        ...existing,
        { x: tgtX, y: tgtY },
      ];

      // Find closest segment
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < points.length - 1; i++) {
        const d = pointToSegmentDist(flowPos.x, flowPos.y, points[i], points[i + 1]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }

      const newWp: Waypoint = {
        id: crypto.randomUUID(),
        x: flowPos.x,
        y: flowPos.y,
      };

      const updated = [...existing];
      // Insert after bestIdx (which is the segment index; waypoints start at index 0 = after source)
      updated.splice(bestIdx, 0, newWp);
      useGraphStore.getState().updateEdgeWaypoints(edge.id, updated);
    },
    [nodes, screenToFlowPosition]
  );

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const scheduleHide = () => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (!isOverTooltipRef.current) {
        setHoveredNodeId(null);
        setTooltipAnchor(null);
      }
    }, 150);
  };

  // Node hover for state tooltip
  const onNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: any) => {
      clearHideTimeout();
      setHoveredNodeId(node.id);
      setTooltipAnchor({ x: _event.clientX, y: _event.clientY });
    },
    []
  );

  const onNodeMouseLeave = useCallback(() => {
    scheduleHide();
  }, []);

  const onTooltipMouseEnter = useCallback(() => {
    isOverTooltipRef.current = true;
    clearHideTimeout();
  }, []);

  const onTooltipMouseLeave = useCallback(() => {
    isOverTooltipRef.current = false;
    scheduleHide();
  }, []);

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <GraphToolbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading graph...</span>
          </div>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <GraphToolbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="flex flex-col items-center gap-4 text-muted-foreground max-w-sm text-center">
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="opacity-30"
            >
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="18" cy="6" r="2.5" />
              <circle cx="12" cy="18" r="2.5" />
              <path d="M8.5 6h7M6.7 8.4l4.6 7.7M17.3 8.4l-4.6 7.7" />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/70">No graph loaded</p>
              <p className="text-xs leading-relaxed">
                Open a Python file with a LangGraph and click the
                <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">VizLang</span>
                button in the editor title bar.
              </p>
            </div>

            {/* Browse button */}
            <button
              onClick={() => sendMessage({ type: 'OPEN_FILE_PICKER' })}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 5.5V3a1 1 0 011-1h3l1.5 1.5H11a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V8" />
                <path d="M5 7.5h4M7 5.5v4" />
              </svg>
              Open Python File
            </button>

            <div className="text-xs space-y-1.5 text-muted-foreground/70">
              <p>Or right-click a <code className="px-1 py-0.5 bg-muted rounded text-[10px]">.py</code> file → "Open in VizLang"</p>
              <p>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Ctrl+Shift+P</kbd> → "VizLang: Load Graph"
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <GraphToolbar />
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={true}
            nodesConnectable={false}
            edgesFocusable={true}
            elementsSelectable={true}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.1}
            maxZoom={3}
            defaultEdgeOptions={{
              type: 'animated',
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Controls
              position="bottom-left"
              showInteractive={false}
            />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={(node) => {
                const data = node.data as any;
                switch (data?.status) {
                  case 'running': return '#3b82f6';
                  case 'completed': return '#22c55e';
                  case 'error': return '#ef4444';
                  case 'interrupted': return '#f59e0b';
                  default:
                    switch (data?.nodeType) {
                      case 'entry': return '#22c55e';
                      case 'end': return '#ef4444';
                      case 'conditional': return '#a855f7';
                      default: return '#6b7280';
                    }
                }
              }}
              style={{
                backgroundColor: 'var(--card)',
              }}
              maskColor="var(--muted)"
            />
            {showDots && (
              <Background
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1.5}
                color="var(--border)"
              />
            )}
          </ReactFlow>

          {/* State tooltip on hover */}
          {hoveredNodeId && tooltipAnchor && (
            <NodeStateTooltip
              nodeId={hoveredNodeId}
              anchor={tooltipAnchor}
              onMouseEnter={onTooltipMouseEnter}
              onMouseLeave={onTooltipMouseLeave}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner />
    </ReactFlowProvider>
  );
}
