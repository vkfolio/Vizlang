import { useEffect } from 'react';
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { useGraphStore, type GraphNodeData } from '../stores/graphStore';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 44;

/**
 * Computes node positions using dagre auto-layout.
 * Uses TB (top-to-bottom) direction with center alignment.
 */
export function useAutoLayout() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const setNodes = useGraphStore((s) => s.setNodes);
  const layoutVersion = useGraphStore((s) => s.layoutVersion);

  useEffect(() => {
    if (nodes.length === 0) return;

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: 'TB',
      nodesep: 60,
      ranksep: 80,
      marginx: 30,
      marginy: 30,
    });

    // Use uniform width for all nodes — must match rendered width
    for (const node of nodes) {
      g.setNode(node.id, {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    }

    // Detect back-edges via DFS and reverse them for dagre
    const visited = new Set<string>();
    const backEdgeIds = new Set<string>();

    function dfs(nodeId: string) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      for (const edge of edges) {
        if (edge.source === nodeId) {
          if (visited.has(edge.target)) {
            backEdgeIds.add(edge.id);
          } else {
            dfs(edge.target);
          }
        }
      }
    }

    const startNode = nodes.find((n) => n.id === '__start__') || nodes[0];
    if (startNode) dfs(startNode.id);
    for (const node of nodes) {
      if (!visited.has(node.id)) dfs(node.id);
    }

    for (const edge of edges) {
      if (backEdgeIds.has(edge.id)) {
        g.setEdge(edge.target, edge.source);
      } else {
        g.setEdge(edge.source, edge.target);
      }
    }

    dagre.layout(g);

    // Snap positions to integers to avoid sub-pixel float drift
    const layoutedNodes = nodes.map((node) => {
      const dagreNode = g.node(node.id);
      if (!dagreNode) return node;

      return {
        ...node,
        position: {
          x: Math.round(dagreNode.x - NODE_WIDTH / 2),
          y: Math.round(dagreNode.y - NODE_HEIGHT / 2),
        },
      };
    });

    setNodes(layoutedNodes);
  }, [nodes.length, edges.length, layoutVersion]);
}
