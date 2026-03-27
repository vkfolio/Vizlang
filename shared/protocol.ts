// ═══════════════════════════════════════════════════════════════
// Shared types between Extension Host and Webview
// ═══════════════════════════════════════════════════════════════

// --- Graph Types ---

export interface GraphNode {
  id: string;
  name: string;
  type: 'entry' | 'process' | 'conditional' | 'end';
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  conditional: boolean;
  data?: string; // condition label
}

export interface GraphInfo {
  name: string;
  stateSchema?: Record<string, unknown>;
}

// --- Execution Types ---

export type StreamMode = 'values' | 'updates' | 'messages' | 'debug' | 'custom';

export type RunStatus = 'idle' | 'running' | 'completed' | 'error' | 'interrupted';

export type NodeStatus = 'idle' | 'running' | 'completed' | 'error' | 'interrupted';

// --- HITL Types ---

export interface InterruptData {
  id: string;
  value: unknown;
  nodeId: string;
  resumable: boolean;
}

// --- Thread Types ---

export interface ThreadInfo {
  threadId: string;
  status: RunStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CheckpointInfo {
  id: string;
  nodeId: string;
  values: unknown;
  metadata?: Record<string, unknown>;
  createdAt: string;
  parentId?: string;
}

// --- Attachment Types ---

export interface Attachment {
  type: 'image' | 'file' | 'audio';
  name: string;
  mimeType: string;
  /** Base64-encoded data or file URI */
  data: string;
}

// --- Trace Types ---

export interface TraceSpan {
  id: string;
  name: string;
  type: 'graph' | 'node' | 'llm' | 'tool';
  startTime: number;
  endTime?: number;
  status: 'running' | 'success' | 'error' | 'interrupted';
  inputs: unknown;
  outputs?: unknown;
  children: TraceSpan[];
  metadata?: {
    tokens?: { input: number; output: number; total: number };
    model?: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// Host → Webview Messages
// ═══════════════════════════════════════════════════════════════

export type HostMessage =
  // Graph
  | { type: 'GRAPH_DATA'; nodes: GraphNode[]; edges: GraphEdge[] }
  | { type: 'GRAPHS_LIST'; graphs: GraphInfo[] }
  // Execution
  | { type: 'STREAM_EVENT'; mode: StreamMode; data: unknown; nodeId?: string }
  | { type: 'RUN_COMPLETE'; finalState: unknown }
  | { type: 'RUN_ERROR'; error: string; traceback?: string; nodeId?: string }
  // Step mode
  | { type: 'STEP_PAUSED'; nodeId: string; nextNodes: string[] }
  // HITL
  | { type: 'INTERRUPT_RECEIVED'; interrupt: InterruptData; nodeId: string }
  | { type: 'INTERRUPT_RESUMED' }
  // Threads
  | { type: 'THREADS_LIST'; threads: ThreadInfo[] }
  | {
      type: 'THREAD_STATE';
      values: unknown;
      next: string[];
      history: CheckpointInfo[];
    }
  // Trace
  | { type: 'TRACE_UPDATE'; rootSpan: TraceSpan }
  // Bridge
  | {
      type: 'BRIDGE_STATUS';
      status: 'starting' | 'ready' | 'error' | 'stopped';
      error?: string;
    };

// ═══════════════════════════════════════════════════════════════
// Webview → Host Messages
// ═══════════════════════════════════════════════════════════════

export type WebviewMessage =
  // Graph
  | { type: 'LOAD_GRAPH'; filePath: string; graphVar?: string }
  | { type: 'REQUEST_GRAPHS'; filePath: string }
  // Execution
  | {
      type: 'START_RUN';
      threadId: string;
      input: unknown;
      stepMode: boolean;
    }
  | { type: 'RESUME_RUN'; threadId: string; stepMode?: boolean }
  | { type: 'CANCEL_RUN' }
  // HITL
  | { type: 'RESOLVE_INTERRUPT'; response: unknown }
  // Chat
  | { type: 'SEND_MESSAGE'; threadId: string; content: string; attachments?: Attachment[] }
  // Threads
  | { type: 'CREATE_THREAD' }
  | { type: 'SWITCH_THREAD'; threadId: string }
  | { type: 'DELETE_THREAD'; threadId: string }
  // State / Time Travel
  | { type: 'GET_STATE'; threadId: string }
  | { type: 'GET_HISTORY'; threadId: string }
  | {
      type: 'UPDATE_STATE';
      threadId: string;
      values: unknown;
      asNode?: string;
    }
  | { type: 'TIME_TRAVEL'; threadId: string; checkpointId: string }
  // File picker
  | { type: 'OPEN_FILE_PICKER' }
  | { type: 'RELOAD_GRAPH' }
  | { type: 'CLOSE_FILE' }
  // Navigation
  | { type: 'HIGHLIGHT_NODE'; nodeId: string };
