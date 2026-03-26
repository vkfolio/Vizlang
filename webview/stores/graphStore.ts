import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { GraphNode, GraphEdge, GraphInfo } from '../../shared/protocol';

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
  // Loading
  isLoading: boolean;

  // Actions
  setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  setAvailableGraphs: (graphs: GraphInfo[]) => void;
  setActiveGraph: (name: string) => void;
  setLayoutDirection: (dir: 'TB' | 'LR') => void;
  setNodeStatus: (nodeId: string, status: GraphNodeData['status']) => void;
  resetNodeStatuses: () => void;
  setNodes: (nodes: Node<GraphNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setLoading: (loading: boolean) => void;
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
  isLoading: false,

  setGraphData: (apiNodes, apiEdges) => {
    const { nodes, edges } = transformToReactFlow(apiNodes, apiEdges);
    set({
      apiNodes,
      apiEdges,
      nodes,
      edges,
      isLoading: false,
    });
  },

  setAvailableGraphs: (graphs) => set({ availableGraphs: graphs }),

  setActiveGraph: (name) => set({ activeGraphName: name }),

  setLayoutDirection: (dir) => set({ layoutDirection: dir }),

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
}));
