import React, { useState } from 'react';
import { useTraceStore } from '@/stores/traceStore';
import { sendMessage } from '@/bridge/MessageBus';
import { cn } from '@/lib/utils';

export function TracePanel() {
  const spans = useTraceStore((s) => s.spans);
  const selectedSpanId = useTraceStore((s) => s.selectedSpanId);

  if (spans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-2 py-8">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-30">
          <path d="M12 2v20M2 12h20" />
          <circle cx="12" cy="6" r="2" />
          <circle cx="12" cy="18" r="2" />
        </svg>
        <span className="text-[11px]">No trace data</span>
        <span className="text-[10px]">Run a graph to see execution trace</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Execution Trace</span>
        <span className="text-[10px] text-muted-foreground">{spans.length} spans</span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {spans.map((span, i) => (
          <TraceSpanItem
            key={span.id + i}
            span={span}
            isSelected={selectedSpanId === span.id}
            onSelect={() => {
              useTraceStore.getState().setSelectedSpan(span.id);
              sendMessage({ type: 'HIGHLIGHT_NODE', nodeId: span.id });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TraceSpanItem({
  span,
  isSelected,
  onSelect,
}: {
  span: { id: string; name: string; type: string; startTime: number; endTime?: number; status: string; inputs?: unknown; outputs?: unknown };
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const duration = span.endTime ? span.endTime - span.startTime : null;

  const statusColor = {
    running: 'bg-node-active',
    success: 'bg-node-success',
    error: 'bg-node-error',
    interrupted: 'bg-node-warning',
  }[span.status] || 'bg-muted-foreground';

  return (
    <div className={cn(
      'border-b border-white/3',
      isSelected && 'bg-primary/5'
    )}>
      <button
        onClick={() => { onSelect(); setExpanded(!expanded); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/20 transition-colors"
      >
        {/* Status dot */}
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor, span.status === 'running' && 'animate-pulse')} />

        {/* Name */}
        <span className="text-[12px] font-mono text-foreground/80 flex-1 truncate">{span.name}</span>

        {/* Duration */}
        {duration !== null ? (
          <span className="text-[10px] font-mono text-muted-foreground">{duration}ms</span>
        ) : (
          <span className="text-[10px] font-mono text-node-active animate-pulse">running</span>
        )}

        {/* Expand chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={cn('text-muted-foreground transition-transform', expanded && 'rotate-90')}
        >
          <path d="M3 1.5l4 3.5-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-2">
          {span.inputs !== undefined && (
            <div className="mb-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Output</span>
              <pre className="mt-1 text-[10px] font-mono text-foreground/60 bg-muted/20 rounded p-2 overflow-auto max-h-[120px] whitespace-pre-wrap break-all">
                {formatData(span.inputs)}
              </pre>
            </div>
          )}
          {span.outputs !== undefined && (
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">State After</span>
              <pre className="mt-1 text-[10px] font-mono text-foreground/60 bg-muted/20 rounded p-2 overflow-auto max-h-[120px] whitespace-pre-wrap break-all">
                {formatData(span.outputs)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatData(data: unknown): string {
  try {
    const str = JSON.stringify(data, null, 2);
    return str.length > 600 ? str.slice(0, 600) + '\n...' : str;
  } catch {
    return String(data);
  }
}
