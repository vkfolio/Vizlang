import React, { useCallback, useState, useRef } from 'react';
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
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { useGraphStore } from '@/stores/graphStore';
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

function GraphCanvasInner() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const setNodes = useGraphStore((s) => s.setNodes);
  const setEdges = useGraphStore((s) => s.setEdges);
  const isLoading = useGraphStore((s) => s.isLoading);

  // Hover state for node tooltip
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);
  const isOverTooltipRef = useRef(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="opacity-40"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
            </svg>
            <span className="text-sm">No graph loaded</span>
            <span className="text-xs">
              Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Ctrl+Shift+P</kbd> → "VizLang: Load Graph"
            </span>
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
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={true}
            nodesConnectable={false}
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
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
              }}
              maskColor="rgba(0, 0, 0, 0.4)"
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.5}
              color="rgba(255, 255, 255, 0.08)"
            />
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
