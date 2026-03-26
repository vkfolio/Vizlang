import { create } from 'zustand';
import type { ThreadInfo } from '../../shared/protocol';

interface ThreadState {
  threads: ThreadInfo[];
  activeThreadId: string;

  setThreads: (threads: ThreadInfo[]) => void;
  setActiveThread: (threadId: string) => void;
  addThread: (thread: ThreadInfo) => void;
  removeThread: (threadId: string) => void;
}

export const useThreadStore = create<ThreadState>((set) => ({
  threads: [],
  activeThreadId: 'default',

  setThreads: (threads) => set({ threads }),

  setActiveThread: (threadId) => set({ activeThreadId: threadId }),

  addThread: (thread) =>
    set((s) => ({ threads: [...s.threads, thread] })),

  removeThread: (threadId) =>
    set((s) => ({
      threads: s.threads.filter((t) => t.threadId !== threadId),
    })),
}));
