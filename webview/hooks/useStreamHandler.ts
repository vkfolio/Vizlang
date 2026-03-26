import { useEffect } from 'react';
import { onMessage } from '../bridge/MessageBus';
import { useGraphStore } from '../stores/graphStore';
import { useExecutionStore } from '../stores/executionStore';
import type { HostMessage } from '../../shared/protocol';

/**
 * Routes incoming messages from extension host to Zustand stores.
 */
export function useStreamHandler() {
  const setGraphData = useGraphStore((s) => s.setGraphData);
  const setAvailableGraphs = useGraphStore((s) => s.setAvailableGraphs);
  const setNodeStatus = useGraphStore((s) => s.setNodeStatus);
  const resetNodeStatuses = useGraphStore((s) => s.resetNodeStatuses);
  const setLoading = useGraphStore((s) => s.setLoading);

  const setRunStatus = useExecutionStore((s) => s.setRunStatus);
  const setActiveNode = useExecutionStore((s) => s.setActiveNode);
  const updateNodeState = useExecutionStore((s) => s.updateNodeState);

  useEffect(() => {
    const unsubscribe = onMessage((msg: HostMessage) => {
      console.log('[VizLang] Received message:', msg.type, msg);
      switch (msg.type) {
        case 'GRAPH_DATA':
          console.log('[VizLang] Setting graph data:', msg.nodes.length, 'nodes,', msg.edges.length, 'edges');
          setGraphData(msg.nodes, msg.edges);
          break;

        case 'GRAPHS_LIST':
          setAvailableGraphs(msg.graphs);
          break;

        case 'BRIDGE_STATUS':
          if (msg.status === 'starting') {
            setLoading(true);
          } else if (msg.status === 'ready') {
            setLoading(false);
          } else if (msg.status === 'error') {
            setLoading(false);
          }
          break;

        case 'STREAM_EVENT': {
          setRunStatus('running');

          if (msg.mode === 'updates' && typeof msg.data === 'object' && msg.data !== null) {
            const data = msg.data as Record<string, unknown>;
            const nodeId = Object.keys(data)[0];
            if (nodeId) {
              setActiveNode(nodeId);
              setNodeStatus(nodeId, 'running');
              updateNodeState(nodeId, { outputs: data[nodeId] });

              // Mark previous active node as completed
              setTimeout(() => {
                setNodeStatus(nodeId, 'completed');
              }, 300);
            }
          }

          if (msg.mode === 'values' && typeof msg.data === 'object') {
            // Full state snapshot — store for hover popover
            const activeNode = useExecutionStore.getState().activeNodeId;
            if (activeNode) {
              updateNodeState(activeNode, {
                stateAfter: msg.data as Record<string, unknown>,
              });
            }
          }
          break;
        }

        case 'RUN_COMPLETE':
          setRunStatus('completed');
          setActiveNode(null);
          break;

        case 'RUN_ERROR':
          setRunStatus('error');
          if (msg.nodeId) {
            setNodeStatus(msg.nodeId, 'error');
          }
          break;

        case 'INTERRUPT_RECEIVED':
          setRunStatus('interrupted');
          setNodeStatus(msg.nodeId, 'interrupted');
          setActiveNode(msg.nodeId);
          break;

        case 'INTERRUPT_RESUMED':
          setRunStatus('running');
          break;
      }
    });

    return unsubscribe;
  }, []);
}
