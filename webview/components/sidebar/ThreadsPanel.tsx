import React from 'react';
import { useThreadStore } from '@/stores/threadStore';
import { useChatStore } from '@/stores/chatStore';
import { useTraceStore } from '@/stores/traceStore';
import { useExecutionStore } from '@/stores/executionStore';
import { useGraphStore } from '@/stores/graphStore';
import { sendMessage } from '@/bridge/MessageBus';
import { cn } from '@/lib/utils';

export function ThreadsPanel() {
  const threads = useThreadStore((s) => s.threads);
  const activeThreadId = useThreadStore((s) => s.activeThreadId);

  const handleCreate = () => {
    sendMessage({ type: 'CREATE_THREAD' });
  };

  const handleSwitch = (threadId: string) => {
    if (threadId === activeThreadId) return;
    // Save current chat messages and restore target thread's messages
    useChatStore.getState().switchThread(activeThreadId, threadId);
    useThreadStore.getState().setActiveThread(threadId);
    sendMessage({ type: 'SWITCH_THREAD', threadId });
  };

  const clearRunState = () => {
    useTraceStore.getState().clear();
    useExecutionStore.getState().reset();
    useGraphStore.getState().resetNodeStatuses();
  };

  const handleDelete = (threadId: string) => {
    sendMessage({ type: 'DELETE_THREAD', threadId });
    useThreadStore.getState().removeThread(threadId);
    useChatStore.getState().clearThread(threadId);
    // If we deleted the active thread, switch to default and clear traces
    if (activeThreadId === threadId) {
      clearRunState();
      useChatStore.getState().switchThread(threadId, 'default');
      useThreadStore.getState().setActiveThread('default');
      sendMessage({ type: 'SWITCH_THREAD', threadId: 'default' });
    }
  };

  const handleClearDefault = () => {
    // Clear Python-side thread state
    sendMessage({ type: 'DELETE_THREAD', threadId: 'default' });
    // Clear webview-side state
    useChatStore.getState().clear();
    useChatStore.getState().clearThread('default');
    clearRunState();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Threads</span>
        <button
          onClick={handleCreate}
          className="text-[11px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 2v8M2 6h8" />
          </svg>
          New
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Default thread always shown */}
        <ThreadItem
          threadId="default"
          isActive={activeThreadId === 'default'}
          onClick={() => handleSwitch('default')}
          onClear={handleClearDefault}
        />

        {threads.filter((t) => t.threadId !== 'default').map((t) => (
          <ThreadItem
            key={t.threadId}
            threadId={t.threadId}
            status={t.status}
            isActive={activeThreadId === t.threadId}
            onClick={() => handleSwitch(t.threadId)}
            onDelete={() => handleDelete(t.threadId)}
          />
        ))}

        {threads.length === 0 && (
          <div className="px-3 py-4 text-[11px] text-muted-foreground/50 text-center">
            No additional threads
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadItem({
  threadId,
  status,
  isActive,
  onClick,
  onDelete,
  onClear,
}: {
  threadId: string;
  status?: string;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onClear?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors group',
        isActive
          ? 'bg-primary/10 border-l-2 border-primary'
          : 'hover:bg-muted/30 border-l-2 border-transparent'
      )}
    >
      <div className={cn(
        'w-1.5 h-1.5 rounded-full flex-shrink-0',
        isActive ? 'bg-primary' : 'bg-muted-foreground/30'
      )} />
      <span className="text-[12px] font-mono text-foreground/80 truncate flex-1">
        {threadId === 'default' ? 'default' : threadId.slice(0, 8) + '...'}
      </span>
      {onClear && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
          title="Clear messages"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3h8M4 3V2h4v1M3 3v7h6V3" />
          </svg>
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-node-error transition-all"
          title="Delete thread"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      )}
    </button>
  );
}
