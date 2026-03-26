import { create } from 'zustand';
import type { RunStatus, NodeStatus } from '../../shared/protocol';

interface NodeState {
  inputs?: unknown;
  outputs?: unknown;
  stateBefore?: Record<string, unknown>;
  stateAfter?: Record<string, unknown>;
}

interface ExecutionState {
  runStatus: RunStatus;
  activeNodeId: string | null;
  nodeStates: Record<string, NodeState>;
  stepMode: boolean;

  // Actions
  setRunStatus: (status: RunStatus) => void;
  setActiveNode: (nodeId: string | null) => void;
  updateNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  setStepMode: (enabled: boolean) => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  runStatus: 'idle',
  activeNodeId: null,
  nodeStates: {},
  stepMode: false,

  setRunStatus: (status) => set({ runStatus: status }),

  setActiveNode: (nodeId) => set({ activeNodeId: nodeId }),

  updateNodeState: (nodeId, state) =>
    set((prev) => ({
      nodeStates: {
        ...prev.nodeStates,
        [nodeId]: { ...prev.nodeStates[nodeId], ...state },
      },
    })),

  setStepMode: (enabled) => set({ stepMode: enabled }),

  reset: () =>
    set({
      runStatus: 'idle',
      activeNodeId: null,
      nodeStates: {},
    }),
}));
