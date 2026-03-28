import { useEffect, useRef } from 'react';
import { onMessage } from '../bridge/MessageBus';
import { useGraphStore } from '../stores/graphStore';
import { useExecutionStore } from '../stores/executionStore';
import { useChatStore, type ChatMessage as ChatMessageType } from '../stores/chatStore';
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

  // Track latest non-message state for display on RUN_COMPLETE
  const pendingNonMessageState = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    const unsubscribe = onMessage((msg: HostMessage) => {
      switch (msg.type) {
        case 'GRAPH_DATA':
          setGraphData(msg.nodes, msg.edges, msg.inputSchema, msg.sampleInput, msg.outputSchema);
          // Clear all state when a new graph is loaded
          useChatStore.getState().clear();
          useExecutionStore.getState().reset();
          useTraceStore.getState().clear();
          useThreadStore.getState().setThreads([]);
          useThreadStore.getState().setActiveThread('default');
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

            // When __start__ completes, the first real node is about to run
            if (nodeId === '__start__') {
              setNodeStatus('__start__', 'completed');
              // Update existing thinking or add new one
              const hasThinking = useChatStore.getState().messages.some((m: ChatMessageType) => m.thinking);
              if (hasThinking) {
                useChatStore.setState((s) => {
                  const msgs = s.messages.map((m: ChatMessageType) =>
                    m.thinking ? { ...m, thinking: 'Running graph...' } : m
                  );
                  return { messages: msgs };
                });
              } else {
                chatAddMessage({ role: 'ai', content: '', thinking: 'Running graph...' });
              }
            } else if (nodeId && nodeId !== '__end__') {
              // Real node completed — update thinking to show next node or remove
              setNodeStatus('__start__', 'completed');

              // Complete previous span
              const prevNode = useExecutionStore.getState().activeNodeId;
              if (prevNode && prevNode !== nodeId) {
                traceCompleteSpan(prevNode, useExecutionStore.getState().nodeStates[prevNode]?.outputs);
                setNodeStatus(prevNode, 'completed');
              }

              setActiveNode(nodeId);
              setNodeStatus(nodeId, 'running');
              updateNodeState(nodeId, { outputs: data[nodeId] });

              // Update thinking to show which node is processing
              useChatStore.setState((s) => {
                const msgs = s.messages.map((m: ChatMessageType) =>
                  m.thinking ? { ...m, thinking: `Processing ${nodeId}...` } : m
                );
                return { messages: msgs };
              });

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

          // Handle error mode from Python bridge
          if (msg.mode === 'error' && typeof msg.data === 'object' && msg.data !== null) {
            const errData = msg.data as { message?: string; traceback?: string };
            setRunStatus('error');
            setError({
              message: errData.message || 'Unknown error',
              traceback: errData.traceback,
            });
            chatSetStreaming(false);
            break;
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

            // Extract messages for chat store if available, or show raw output
            if (stateData && 'messages' in stateData && Array.isArray(stateData.messages)) {
              const lastMsg = stateData.messages[stateData.messages.length - 1];
              if (lastMsg && typeof lastMsg === 'object') {
                const msgObj = lastMsg as any;
                // Detect human messages by type field or class name
                const msgType = (msgObj.type || msgObj.role || '').toLowerCase();
                const isHuman = msgType === 'human' || msgType === 'humanmessage' || msgType === 'user';
                // Also skip if content matches the last human message (duplicate echo)
                const content = typeof msgObj.content === 'string' ? msgObj.content : JSON.stringify(msgObj.content);
                const chatMsgs = useChatStore.getState().messages;
                const lastHuman = [...chatMsgs].reverse().find((m) => m.role === 'human');
                const isDuplicateEcho = lastHuman && lastHuman.content === content;
                if (!isHuman && !isDuplicateEcho) {
                  // Remove thinking message before adding real content
                  useChatStore.setState((s) => {
                    const msgs = s.messages.filter((m: ChatMessageType) => !m.thinking);
                    return msgs.length !== s.messages.length ? { messages: msgs } : {};
                  });

                  // Check for tool calls
                  const toolCalls = msgObj.tool_calls
                    || msgObj.additional_kwargs?.tool_calls
                    || [];
                  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                    for (const tc of toolCalls) {
                      const tcName = tc.name || tc.function?.name || 'tool';
                      const tcArgs = tc.args || tc.function?.arguments || '';
                      chatAddMessage({
                        role: 'tool',
                        content: typeof tcArgs === 'string' ? tcArgs : JSON.stringify(tcArgs, null, 2),
                        toolName: tcName,
                        toolArgs: tcArgs,
                      });
                    }
                  }

                  // Check for tool message type (tool results)
                  const isToolMsg = msgType === 'tool' || msgType === 'toolmessage';
                  if (isToolMsg) {
                    chatAddMessage({
                      role: 'tool',
                      content: content,
                      toolName: msgObj.name || msgObj.tool_call_id || 'tool_result',
                    });
                  } else if (content) {
                    const existing = useChatStore.getState().messages;
                    const lastExisting = existing[existing.length - 1];
                    if (!lastExisting || lastExisting.role !== 'ai' || !lastExisting.isStreaming) {
                      chatAddMessage({ role: 'ai', content, isStreaming: true });
                    } else {
                      // Update content of streaming message
                      useChatStore.setState((s) => {
                        const msgs = [...s.messages];
                        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
                        return { messages: msgs };
                      });
                    }
                  }
                }
              }
            } else if (stateData && !('messages' in stateData)) {
              // Non-message graph — store latest state, will display on RUN_COMPLETE
              // This avoids showing every intermediate values event
              pendingNonMessageState.current = stateData;
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
          // Mark __end__ as completed
          setNodeStatus('__end__', 'completed');
          setRunStatus('completed');
          setActiveNode(null);
          chatSetStreaming(false);
          // Remove any remaining thinking messages
          useChatStore.setState((s) => {
            const msgs = s.messages.filter((m: ChatMessageType) => !m.thinking);
            return msgs.length !== s.messages.length ? { messages: msgs } : {};
          });

          // Display final output for non-message graphs
          if (pendingNonMessageState.current) {
            const finalState = pendingNonMessageState.current;
            const outputSchemaKeys = Object.keys(useGraphStore.getState().outputSchema || {});
            const inputSchemaKeys = Object.keys(useGraphStore.getState().inputSchema || {});

            let toShow: Record<string, unknown>;

            if (outputSchemaKeys.length > 0) {
              // OutputSchema defined — show ONLY those fields
              toShow = {};
              for (const key of outputSchemaKeys) {
                if (key in finalState && finalState[key] !== null && finalState[key] !== undefined) {
                  toShow[key] = finalState[key];
                }
              }
            } else if (inputSchemaKeys.length > 0) {
              // No output schema, but input schema exists — strip input fields
              toShow = {};
              for (const [k, v] of Object.entries(finalState)) {
                if (!inputSchemaKeys.includes(k) && v !== null && v !== undefined) {
                  toShow[k] = v;
                }
              }
            } else {
              // No schemas — show everything non-null
              toShow = {};
              for (const [k, v] of Object.entries(finalState)) {
                if (v !== null && v !== undefined) {
                  toShow[k] = v;
                }
              }
            }

            if (Object.keys(toShow).length > 0) {
              chatAddMessage({ role: 'ai', content: JSON.stringify(toShow, null, 2) });
            }
            pendingNonMessageState.current = null;
          }
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

        case 'STEP_PAUSED':
          // Step-mode pause: highlight the next node, don't show HITL overlay
          setRunStatus('interrupted');
          if (msg.nextNodes?.[0]) {
            setNodeStatus(msg.nextNodes[0], 'running');
            setActiveNode(msg.nextNodes[0]);
          }
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

        case 'THREADS_LIST': {
          // Merge new threads into existing list (avoid duplicates)
          const existing = useThreadStore.getState().threads;
          const existingIds = new Set(existing.map((t) => t.threadId));
          const newThreads = msg.threads.filter((t) => !existingIds.has(t.threadId));
          if (newThreads.length > 0) {
            setThreads([...existing, ...newThreads]);
          } else if (existing.length === 0) {
            setThreads(msg.threads);
          }
          break;
        }

        case 'THREAD_STATE': {
          setCurrentState(msg.values);
          // Rebuild chat messages from thread history if provided
          const hist = (msg as any).history;
          if (hist && Array.isArray(hist)) {
            const rebuilt: Array<{ id: string; role: 'human' | 'ai'; content: string; timestamp: number }> = [];
            for (const checkpoint of hist) {
              const vals = checkpoint?.values as Record<string, unknown> | undefined;
              if (vals && 'messages' in vals && Array.isArray(vals.messages)) {
                for (const m of vals.messages as any[]) {
                  if (m && typeof m === 'object') {
                    const role = m.type === 'human' ? 'human' as const : 'ai' as const;
                    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                    rebuilt.push({
                      id: `hist_${rebuilt.length}`,
                      role,
                      content,
                      timestamp: Date.now(),
                    });
                  }
                }
              }
            }
            useChatStore.getState().setMessages(rebuilt as any);
          }
          break;
        }

        case 'TRACE_UPDATE':
          // Full trace from host — could replace local spans
          break;
      }
    });

    return unsubscribe;
  }, []);
}
