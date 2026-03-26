import { create } from 'zustand';
import type { TraceSpan } from '../../shared/protocol';

interface TraceState {
  spans: TraceSpan[];
  selectedSpanId: string | null;

  addSpan: (span: TraceSpan) => void;
  completeSpan: (spanId: string, outputs?: unknown) => void;
  setSelectedSpan: (spanId: string | null) => void;
  clear: () => void;
}

export const useTraceStore = create<TraceState>((set) => ({
  spans: [],
  selectedSpanId: null,

  addSpan: (span) =>
    set((s) => ({ spans: [...s.spans, span] })),

  completeSpan: (spanId, outputs) =>
    set((s) => ({
      spans: s.spans.map((span) =>
        span.id === spanId
          ? { ...span, endTime: Date.now(), status: 'success' as const, outputs }
          : span
      ),
    })),

  setSelectedSpan: (spanId) => set({ selectedSpanId: spanId }),

  clear: () => set({ spans: [], selectedSpanId: null }),
}));
