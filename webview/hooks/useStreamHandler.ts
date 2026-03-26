import { useEffect } from 'react';
import { onMessage } from '../bridge/MessageBus';
import { useGraphStore } from '../stores/graphStore';
import { useExecutionStore } from '../stores/executionStore';
import { useChatStore } from '../stores/chatStore';
import { useThreadStore } from '../stores/threadStore';
import { useTraceStore } from '../stores/traceStore';
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
  const setError = useExecutionStore((s) => s.setError);
  const setInterrupt = useExecutionStore((s) => s.setInterrupt);
  const setCurrentState = useExecutionStore((s) => s.setCurrentState);

  const chatAddMessage = useChatStore((s) => s.addMessage);
  const chatAppend = useChatStore((s) => s.appendToLastMessage);
  const chatSetStreaming = useChatStore((s) => s.setStreaming);

  const setThreads = useThreadStore((s) => s.setThreads);

  const traceAddSpan = useTraceStore((s) => s.addSpan);
  const traceCompleteSpan = useTraceStore((s) => s.completeSpan);
  const traceClear = useTraceStore((s) => s.clear);

  useEffect(() => {
    const unsubscribe = onMessage((msg: HostMessage) => {
      switch (msg.type) {
        case 'GRAPH_DATA':
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
            if (nodeId && nodeId !== '__start__' && nodeId !== '__end__') {
              // Complete previous span
              const prevNode = useExecutionStore.getState().activeNodeId;
              if (prevNode && prevNode !== nodeId) {
                traceCompleteSpan(prevNode, useExecutionStore.getState().nodeStates[prevNode]?.outputs);
                setNodeStatus(prevNode, 'completed');
              }

              setActiveNode(nodeId);
              setNodeStatus(nodeId, 'running');
              updateNodeState(nodeId, { outputs: data[nodeId] });

              // Add trace span
              traceAddSpan({
                id: nodeId,
                name: nodeId,
                type: 'node',
                startTime: Date.now(),
                status: 'running',
                inputs: data[nodeId],
                children: [],
              });
            }
          }

          if (msg.mode === 'values' && typeof msg.data === 'object') {
            const stateData = msg.data as Record<string, unknown>;
            setCurrentState(stateData);

            // Store state for hover tooltip
            const activeNode = useExecutionStore.getState().activeNodeId;
            if (activeNode) {
              updateNodeState(activeNode, {
                stateAfter: stateData,
              });
            }

            // Extract messages for chat store if available
            if (stateData && 'messages' in stateData && Array.isArray(stateData.messages)) {
              const lastMsg = stateData.messages[stateData.messages.length - 1];
              if (lastMsg && typeof lastMsg === 'object') {
                const msgObj = lastMsg as any;
                const role = msgObj.type === 'human' ? 'human' as const : 'ai' as const;
                const content = typeof msgObj.content === 'string' ? msgObj.content : JSON.stringify(msgObj.content);
                // Only add if it's a new AI message
                if (role === 'ai') {
                  const existing = useChatStore.getState().messages;
                  const lastExisting = existing[existing.length - 1];
                  if (!lastExisting || lastExisting.role !== 'ai' || !lastExisting.isStreaming) {
                    chatAddMessage({ role: 'ai', content, isStreaming: true });
                  } else {
                    // Update content of streaming message
                    chatAppend(''); // trigger re-render
                    useChatStore.setState((s) => {
                      const msgs = [...s.messages];
                      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
                      return { messages: msgs };
                    });
                  }
                }
              }
            }
          }

          if (msg.mode === 'messages' && typeof msg.data === 'object') {
            // Token-level streaming for chat
            const data = msg.data as any;
            const content = typeof data === 'string' ? data : (data?.content || '');
            if (content) {
              const existing = useChatStore.getState().messages;
              const lastExisting = existing[existing.length - 1];
              if (lastExisting && lastExisting.role === 'ai' && lastExisting.isStreaming) {
                chatAppend(content);
              } else {
                chatAddMessage({ role: 'ai', content, isStreaming: true });
              }
            }
          }
          break;
        }

        case 'RUN_COMPLETE': {
          // Complete last running span
          const lastNode = useExecutionStore.getState().activeNodeId;
          if (lastNode) {
            traceCompleteSpan(lastNode, useExecutionStore.getState().nodeStates[lastNode]?.outputs);
            setNodeStatus(lastNode, 'completed');
          }
          setRunStatus('completed');
          setActiveNode(null);
          chatSetStreaming(false);
          break;
        }

        case 'RUN_ERROR':
          setRunStatus('error');
          setError({
            message: msg.error,
            traceback: msg.traceback,
            nodeId: msg.nodeId,
          });
          if (msg.nodeId) {
            setNodeStatus(msg.nodeId, 'error');
          }
          chatSetStreaming(false);
          chatAddMessage({
            role: 'system',
            content: `Error: ${msg.error}`,
          });
          break;

        case 'INTERRUPT_RECEIVED':
          setRunStatus('interrupted');
          setNodeStatus(msg.nodeId, 'interrupted');
          setActiveNode(msg.nodeId);
          setInterrupt(msg.interrupt);
          chatAddMessage({
            role: 'system',
            content: `Execution paused at "${msg.nodeId}" — human input required.`,
          });
          break;

        case 'INTERRUPT_RESUMED':
          setRunStatus('running');
          setInterrupt(null);
          break;

        case 'THREADS_LIST':
          setThreads(msg.threads);
          break;

        case 'THREAD_STATE':
          setCurrentState(msg.values);
          break;

        case 'TRACE_UPDATE':
          // Full trace from host — could replace local spans
          break;
      }
    });

    return unsubscribe;
  }, []);
}
