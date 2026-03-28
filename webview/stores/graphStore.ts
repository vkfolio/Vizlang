import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { GraphNode, GraphEdge, GraphInfo } from '../../shared/protocol';

export interface Waypoint {
  id: string;
  x: number;
  y: number;
}

export interface EdgeData extends Record<string, unknown> {
  waypoints?: Waypoint[];
}

export interface GraphNodeData extends Record<string, unknown> {
  label: string;
  nodeType: GraphNode['type'];
  status: 'idle' | 'running' | 'completed' | 'error' | 'interrupted';
  metadata?: Record<string, unknown>;
}

interface GraphState {
  // React Flow data
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
  // Raw API data
  apiNodes: GraphNode[];
  apiEdges: GraphEdge[];
  // Available graphs
  availableGraphs: GraphInfo[];
  activeGraphName: string | null;
  // Layout
  layoutDirection: 'TB' | 'LR';
  showDots: boolean;
  // Persistence
  checkpointerMode: 'memory' | 'none';
  // Schema
  inputSchema: Record<string, string> | null;
  outputSchema: Record<string, string> | null;
  sampleInput: Record<string, unknown> | null;
  // Loading
  isLoading: boolean;
  // Layout version — increment to force relayout
  layoutVersion: number;

  // Actions
  setGraphData: (nodes: GraphNode[], edges: GraphEdge[], inputSchema?: Record<string, string>, sampleInput?: Record<string, unknown>, outputSchema?: Record<string, string>) => void;
  setAvailableGraphs: (graphs: GraphInfo[]) => void;
  setActiveGraph: (name: string) => void;
  setLayoutDirection: (dir: 'TB' | 'LR') => void;
  setShowDots: (show: boolean) => void;
  setCheckpointerMode: (mode: 'memory' | 'none') => void;
  relayout: () => void;
  setNodeStatus: (nodeId: string, status: GraphNodeData['status']) => void;
  resetNodeStatuses: () => void;
  setNodes: (nodes: Node<GraphNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setLoading: (loading: boolean) => void;
  // Edge waypoints
  updateEdgeWaypoints: (edgeId: string, waypoints: Waypoint[]) => void;
  // Export
  exportPng: (() => void) | null;
  setExportPng: (fn: (() => void) | null) => void;
}

/**
 * Transform API graph data to React Flow format.
 * Positions are computed later by useAutoLayout hook.
 */
function transformToReactFlow(
  apiNodes: GraphNode[],
  apiEdges: GraphEdge[]
): { nodes: Node<GraphNodeData>[]; edges: Edge[] } {
  const nodes: Node<GraphNodeData>[] = apiNodes.map((n) => ({
    id: n.id,
    type: n.type, // Maps to custom node component
    position: { x: 0, y: 0 }, // Will be computed by dagre
    data: {
      label: n.id === '__start__' ? 'START' : n.id === '__end__' ? 'END' : n.name,
      nodeType: n.type,
      status: 'idle' as const,
      metadata: n.metadata,
    },
  }));

  const edges: Edge[] = apiEdges.map((e, i) => ({
    id: `${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    type: e.conditional ? 'conditional' : 'animated',
    label: e.data || undefined,
    animated: false,
    data: { waypoints: [] } as EdgeData,
  }));

  return { nodes, edges };
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  apiNodes: [],
  apiEdges: [],
  availableGraphs: [],
  activeGraphName: null,
  layoutDirection: 'TB',
  showDots: true,
  checkpointerMode: 'memory',
  inputSchema: null,
  outputSchema: null,
  sampleInput: null,
  isLoading: false,
  layoutVersion: 0,

  setGraphData: (apiNodes, apiEdges, inputSchema, sampleInput, outputSchema) => {
    const { nodes, edges } = transformToReactFlow(apiNodes, apiEdges);
    set((s) => ({
      apiNodes,
      apiEdges,
      nodes,
      edges,
      inputSchema: inputSchema || null,
      outputSchema: outputSchema || null,
      sampleInput: sampleInput || null,
      isLoading: false,
      layoutVersion: s.layoutVersion + 1,
    }));
  },

  setAvailableGraphs: (graphs) => set({ availableGraphs: graphs }),

  setActiveGraph: (name) => set({ activeGraphName: name }),

  setLayoutDirection: (dir) => set({ layoutDirection: dir }),

  setShowDots: (show) => set({ showDots: show }),
  setCheckpointerMode: (mode) => set({ checkpointerMode: mode }),

  relayout: () => {
    // Clear all waypoints on relayout since they use absolute coordinates
    const edges = get().edges.map((e) => ({
      ...e,
      data: { ...e.data, waypoints: [] },
    }));
    set((s) => ({ edges, layoutVersion: s.layoutVersion + 1 }));
  },

  setNodeStatus: (nodeId, status) => {
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, status } } : n
    );
    set({ nodes });
  },

  resetNodeStatuses: () => {
    const nodes = get().nodes.map((n) => ({
      ...n,
      data: { ...n.data, status: 'idle' as const },
    }));
    set({ nodes });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setLoading: (loading) => set({ isLoading: loading }),

  updateEdgeWaypoints: (edgeId, waypoints) => {
    const edges = get().edges.map((e) =>
      e.id === edgeId ? { ...e, data: { ...e.data, waypoints } } : e
    );
    set({ edges });
  },
  exportPng: null,
  setExportPng: (fn) => set({ exportPng: fn }),
}));
