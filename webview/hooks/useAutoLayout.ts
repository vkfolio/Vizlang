import { useEffect } from 'react';
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { useGraphStore, type GraphNodeData } from '../stores/graphStore';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 44;

/**
 * Computes node positions using dagre auto-layout.
 * Always uses horizontal (LR) layout direction.
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
      nodesep: 40,
      ranksep: 50,
      marginx: 20,
      marginy: 20,
    });

    for (const node of nodes) {
      g.setNode(node.id, {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    }

    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    const layoutedNodes = nodes.map((node) => {
      const dagreNode = g.node(node.id);
      if (!dagreNode) return node;

      return {
        ...node,
        position: {
          x: dagreNode.x - NODE_WIDTH / 2,
          y: dagreNode.y - NODE_HEIGHT / 2,
        },
      };
    });

    setNodes(layoutedNodes);
  }, [nodes.length, edges.length, layoutVersion]);
}
