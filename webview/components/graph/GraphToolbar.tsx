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
  const stepMode = useExecutionStore((s) => s.stepMode);

  const isRunning = runStatus === 'running';
  const isInterrupted = runStatus === 'interrupted';

  const handleRun = () => {
    useExecutionStore.getState().setStepMode(false);
    useExecutionStore.getState().reset();
    useGraphStore.getState().resetNodeStatuses();
    sendMessage({
      type: 'START_RUN',
      threadId: 'default',
      input: {},
      stepMode: false,
    });
  };

  const handleStep = () => {
    useExecutionStore.getState().setStepMode(true);
    useExecutionStore.getState().reset();
    useGraphStore.getState().resetNodeStatuses();
    sendMessage({
      type: 'START_RUN',
      threadId: 'default',
      input: {},
      stepMode: true,
    });
  };

  const handleNextStep = () => {
    sendMessage({ type: 'RESUME_RUN', threadId: 'default', stepMode: true });
  };

  const handleContinue = () => {
    useExecutionStore.getState().setStepMode(false);
    sendMessage({ type: 'RESUME_RUN', threadId: 'default', stepMode: false });
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

      {/* Icon button group */}
      <div className="flex items-center gap-0.5">
        <button
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => sendMessage({ type: 'OPEN_FILE_PICKER' })}
          title="Open Python file"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2.26946V6.4C14 6.96005 14 7.24008 14.109 7.45399C14.2049 7.64215 14.3578 7.79513 14.546 7.89101C14.7599 8 15.0399 8 15.6 8H19.7305M20 9.98822V17.2C20 18.8802 20 19.7202 19.673 20.362C19.3854 20.9265 18.9265 21.3854 18.362 21.673C17.7202 22 16.8802 22 15.2 22H8.8C7.11984 22 6.27976 22 5.63803 21.673C5.07354 21.3854 4.6146 20.9265 4.32698 20.362C4 19.7202 4 18.8802 4 17.2V6.8C4 5.11984 4 4.27976 4.32698 3.63803C4.6146 3.07354 5.07354 2.6146 5.63803 2.32698C6.27976 2 7.11984 2 8.8 2H12.0118C12.7455 2 13.1124 2 13.4577 2.08289C13.7638 2.15638 14.0564 2.27759 14.3249 2.44208C14.6276 2.6276 14.887 2.88703 15.4059 3.40589L18.5941 6.59411C19.113 7.11297 19.3724 7.3724 19.5579 7.67515C19.7224 7.94356 19.8436 8.2362 19.9171 8.5423C20 8.88757 20 9.25445 20 9.98822Z" />
          </svg>
        </button>
        <button
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => sendMessage({ type: 'RELOAD_GRAPH' })}
          title="Reload graph"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 10C2 10 4.00498 7.26822 5.63384 5.63824C7.26269 4.00827 9.5136 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.89691 21 4.43511 18.2543 3.35177 14.5M2 10V4M2 10H8" />
          </svg>
        </button>
        <button
          className="p-1.5 rounded text-muted-foreground hover:text-node-error hover:bg-muted transition-colors"
          onClick={() => sendMessage({ type: 'CLOSE_FILE' })}
          title="Close file"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 9L15 15M15 9L9 15M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z" />
          </svg>
        </button>
        <button
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => useGraphStore.getState().relayout()}
          title="Re-arrange nodes"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 5V7H15V5H19ZM9 5V11H5V5H9ZM19 13V19H15V13H19ZM9 17V19H5V17H9ZM21 3H13V9H21V3ZM11 3H3V13H11V3ZM21 11H13V21H21V11ZM11 15H3V21H11V15Z" />
          </svg>
        </button>
        <button
          className={cn(
            'p-1.5 rounded transition-colors',
            showDots
              ? 'text-foreground bg-muted'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          onClick={() => setShowDots(!showDots)}
          title="Toggle background dots"
        >
          <svg width="15" height="15" viewBox="0 0 14 14" fill="currentColor" className="opacity-70">
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
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Execution controls */}
      {!isRunning && !isInterrupted && (
        <>
          <button
            className="flex items-center gap-1 text-xs bg-node-success/20 text-node-success px-3 py-1 rounded hover:bg-node-success/30 transition-colors"
            onClick={handleRun}
            title="Run graph"
          >
            ▶ Run
          </button>
          <button
            className="flex items-center gap-1 text-xs bg-node-active/20 text-node-active px-3 py-1 rounded hover:bg-node-active/30 transition-colors"
            onClick={handleStep}
            title="Step through node by node"
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
        <div className="flex items-center gap-1.5">
          {stepMode && (
            <button
              className="flex items-center gap-1 text-xs bg-node-active/20 text-node-active px-3 py-1 rounded hover:bg-node-active/30 transition-colors"
              onClick={handleNextStep}
              title="Execute next node"
            >
              ⏭ Next
            </button>
          )}
          <button
            className="flex items-center gap-1 text-xs bg-node-success/20 text-node-success px-3 py-1 rounded hover:bg-node-success/30 transition-colors"
            onClick={handleContinue}
            title={stepMode ? 'Continue running all remaining nodes' : 'Continue execution'}
          >
            ▶ {stepMode ? 'Continue All' : 'Continue'}
          </button>
          <button
            className="flex items-center gap-1 text-xs bg-node-error/20 text-node-error px-3 py-1 rounded hover:bg-node-error/30 transition-colors"
            onClick={handleStop}
            title="Stop execution"
          >
            ⏹ Stop
          </button>
        </div>
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
        {runStatus === 'interrupted' && stepMode ? 'stepped' : runStatus}
      </div>
    </div>
  );
}
