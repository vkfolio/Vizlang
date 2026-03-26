import type { BridgeManager } from '../bridge/BridgeManager';
import type { GraphNode, GraphEdge, GraphInfo } from '../../shared/protocol';

/**
 * Handles graph introspection via the Python bridge.
 */
export class GraphService {
  constructor(private bridge: BridgeManager) {}

  async loadGraph(
    filePath: string,
    graphVar?: string
  ): Promise<{ graphs: string[] }> {
    const result = (await this.bridge.request('load_graph', {
      file: filePath,
      graph_var: graphVar,
    })) as { success: boolean; graphs: string[] };

    return { graphs: result.graphs };
  }

  async getGraphStructure(graphVar?: string): Promise<{
    nodes: GraphNode[];
    edges: GraphEdge[];
  }> {
    const data = (await this.bridge.request('get_graph', {
      graph_var: graphVar,
    })) as { nodes: any[]; edges: any[] };

    // Python bridge returns { id, name, type, metadata } directly (no nested data)
    const nodes: GraphNode[] = data.nodes.map((n: any) => ({
      id: n.id,
      name: n.name,
      type: (n.type || n.data?.type || (
        n.id === '__start__' ? 'entry' :
        n.id === '__end__' ? 'end' :
        'process'
      )) as GraphNode['type'],
      metadata: n.metadata,
    }));

    const edges: GraphEdge[] = data.edges.map((e: any) => ({
      source: e.source,
      target: e.target,
      conditional: e.conditional ?? false,
      data: e.data,
    }));

    return { nodes, edges };
  }

  async listGraphs(filePath: string): Promise<GraphInfo[]> {
    const result = (await this.bridge.request('list_graphs', {
      file: filePath,
    })) as { graphs: Array<{ name: string; node_count?: number; edge_count?: number }> };

    return result.graphs.map((g) => ({
      name: g.name,
      stateSchema: { nodeCount: g.node_count, edgeCount: g.edge_count },
    }));
  }
}
