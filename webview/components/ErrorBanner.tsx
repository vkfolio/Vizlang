import React, { useState, useEffect } from 'react';
import { useExecutionStore } from '@/stores/executionStore';
import { cn } from '@/lib/utils';

export function ErrorBanner() {
  const lastError = useExecutionStore((s) => s.lastError);
  const clearError = useExecutionStore((s) => s.clearError);
  const [showTraceback, setShowTraceback] = useState(false);

  // Auto-dismiss after 20 seconds
  useEffect(() => {
    if (lastError) {
      const timer = setTimeout(clearError, 20000);
      return () => clearTimeout(timer);
    }
  }, [lastError, clearError]);

  if (!lastError) return null;

  return (
    <div className="flex-shrink-0 border-b border-node-error/20 bg-node-error/8 px-4 py-2.5">
      <div className="flex items-start gap-2">
        {/* Error icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-node-error flex-shrink-0 mt-0.5">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 4v3M7 9v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-node-error font-medium">
            {lastError.message}
          </div>
          {lastError.nodeId && (
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
              Node: {lastError.nodeId}
            </div>
          )}
          {lastError.traceback && (
            <>
              <button
                onClick={() => setShowTraceback(!showTraceback)}
                className="text-[10px] text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1"
              >
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 8 8"
                  className={cn('transition-transform', showTraceback && 'rotate-90')}
                >
                  <path d="M2 1l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Traceback
              </button>
              {showTraceback && (
                <pre className="mt-1 text-[10px] font-mono text-foreground/60 bg-muted rounded p-2 overflow-auto max-h-[150px] whitespace-pre-wrap">
                  {lastError.traceback}
                </pre>
              )}
            </>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={clearError}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
