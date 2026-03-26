import React from 'react';
import { cn } from '@/lib/utils';
import { useGraphStore } from '@/stores/graphStore';
import { useExecutionStore } from '@/stores/executionStore';
import { sendMessage } from '@/bridge/MessageBus';

export function GraphToolbar() {
  const availableGraphs = useGraphStore((s) => s.availableGraphs);
  const activeGraphName = useGraphStore((s) => s.activeGraphName);
  const showDots = useGraphStore((s) => s.showDots);
  const setShowDots = useGraphStore((s) => s.setShowDots);
  const runStatus = useExecutionStore((s) => s.runStatus);

  const isRunning = runStatus === 'running';
  const isInterrupted = runStatus === 'interrupted';

  const handleRun = () => {
    sendMessage({
      type: 'START_RUN',
      threadId: 'default',
      input: {},
      stepMode: false,
    });
  };

  const handleStep = () => {
    sendMessage({
      type: 'START_RUN',
      threadId: 'default',
      input: {},
      stepMode: true,
    });
  };

  const handleContinue = () => {
    sendMessage({ type: 'RESUME_RUN', threadId: 'default' });
  };

  const handleStop = () => {
    sendMessage({ type: 'CANCEL_RUN' });
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/50">
      {/* Graph selector */}
      {availableGraphs.length > 1 && (
        <select
          className="bg-input text-foreground text-xs px-2 py-1 rounded border border-border"
          value={activeGraphName || ''}
          onChange={(e) => {
            const name = e.target.value;
            useGraphStore.getState().setActiveGraph(name);
            sendMessage({
              type: 'LOAD_GRAPH',
              filePath: '',
              graphVar: name,
            });
          }}
        >
          {availableGraphs.map((g) => (
            <option key={g.name} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex-1" />

      {/* Dots toggle */}
      <button
        className={cn(
          'text-xs px-2 py-1 rounded transition-colors',
          showDots
            ? 'text-foreground bg-muted'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        onClick={() => setShowDots(!showDots)}
        title="Toggle background dots"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="opacity-70">
          <circle cx="3" cy="3" r="1" />
          <circle cx="7" cy="3" r="1" />
          <circle cx="11" cy="3" r="1" />
          <circle cx="3" cy="7" r="1" />
          <circle cx="7" cy="7" r="1" />
          <circle cx="11" cy="7" r="1" />
          <circle cx="3" cy="11" r="1" />
          <circle cx="7" cy="11" r="1" />
          <circle cx="11" cy="11" r="1" />
        </svg>
      </button>

      <div className="w-px h-4 bg-border" />

      {/* Execution controls */}
      {!isRunning && !isInterrupted && (
        <>
          <button
            className="flex items-center gap-1 text-xs bg-node-success/20 text-node-success px-3 py-1 rounded hover:bg-node-success/30 transition-colors"
            onClick={handleRun}
            title="Run graph (Ctrl+Shift+R)"
          >
            ▶ Run
          </button>
          <button
            className="flex items-center gap-1 text-xs bg-node-active/20 text-node-active px-3 py-1 rounded hover:bg-node-active/30 transition-colors"
            onClick={handleStep}
            title="Step through (Ctrl+Shift+S)"
          >
            ⏭ Step
          </button>
        </>
      )}

      {isRunning && (
        <button
          className="flex items-center gap-1 text-xs bg-node-error/20 text-node-error px-3 py-1 rounded hover:bg-node-error/30 transition-colors"
          onClick={handleStop}
          title="Stop execution"
        >
          ⏹ Stop
        </button>
      )}

      {isInterrupted && (
        <button
          className="flex items-center gap-1 text-xs bg-node-success/20 text-node-success px-3 py-1 rounded hover:bg-node-success/30 transition-colors"
          onClick={handleContinue}
          title="Continue execution"
        >
          ▶ Continue
        </button>
      )}

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
        <div
          className={cn(
            'w-2 h-2 rounded-full',
            runStatus === 'idle' && 'bg-muted-foreground',
            runStatus === 'running' && 'bg-node-active animate-pulse',
            runStatus === 'completed' && 'bg-node-success',
            runStatus === 'error' && 'bg-node-error',
            runStatus === 'interrupted' && 'bg-node-warning animate-pulse'
          )}
        />
        {runStatus}
      </div>
    </div>
  );
}
