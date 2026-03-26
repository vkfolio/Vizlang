// ═══════════════════════════════════════════════════════════════
// Python Bridge Protocol Types (JSON Lines over stdio)
// ═══════════════════════════════════════════════════════════════

export interface BridgeRequest {
  id: string;
  method: BridgeMethod;
  params: Record<string, unknown>;
}

export type BridgeMethod =
  | 'load_graph'
  | 'get_graph'
  | 'list_graphs'
  | 'run'
  | 'resume'
  | 'cancel'
  | 'get_state'
  | 'get_history'
  | 'update_state'
  | 'create_thread'
  | 'list_threads'
  | 'delete_thread'
  | 'set_checkpointer'
  | 'ping';

export type BridgeResponseType = 'response' | 'stream' | 'interrupt' | 'step_pause' | 'done' | 'error';

export interface BridgeResponse {
  id: string;
  type: BridgeResponseType;
  mode?: string; // stream mode (values, updates, debug, etc.)
  data: unknown;
}

export interface BridgeError {
  message: string;
  traceback?: string;
}

export interface BridgeGraphData {
  nodes: Array<{
    id: string;
    name: string;
    data: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    data?: string;
    conditional: boolean;
  }>;
}

export interface BridgeStateSnapshot {
  values: Record<string, unknown>;
  next: string[];
  config: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at?: string;
  parent_config?: Record<string, unknown>;
  tasks?: unknown[];
}
