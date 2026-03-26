import { create } from 'zustand';
import type { RunStatus, NodeStatus, InterruptData } from '../../shared/protocol';

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
  lastError: { message: string; traceback?: string; nodeId?: string } | null;
  activeInterrupt: InterruptData | null;
  currentState: unknown;

  // Actions
  setRunStatus: (status: RunStatus) => void;
  setActiveNode: (nodeId: string | null) => void;
  updateNodeState: (nodeId: string, state: Partial<NodeState>) => void;
  setStepMode: (enabled: boolean) => void;
  setError: (error: { message: string; traceback?: string; nodeId?: string }) => void;
  clearError: () => void;
  setInterrupt: (interrupt: InterruptData | null) => void;
  setCurrentState: (state: unknown) => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  runStatus: 'idle',
  activeNodeId: null,
  nodeStates: {},
  stepMode: false,
  lastError: null,
  activeInterrupt: null,
  currentState: null,

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

  setError: (error) => set({ lastError: error }),

  clearError: () => set({ lastError: null }),

  setInterrupt: (interrupt) => set({ activeInterrupt: interrupt }),

  setCurrentState: (state) => set({ currentState: state }),

  reset: () =>
    set({
      runStatus: 'idle',
      activeNodeId: null,
      nodeStates: {},
      lastError: null,
      activeInterrupt: null,
    }),
}));
