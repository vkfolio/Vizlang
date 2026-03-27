import React, { useState } from 'react';
import { sendMessage } from '@/bridge/MessageBus';
import { useExecutionStore } from '@/stores/executionStore';
import type { InterruptData } from '../../../shared/protocol';

interface Props {
  interrupt: InterruptData;
}

export function InterruptChatCard({ interrupt }: Props) {
  const [response, setResponse] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const value = interrupt.value as any;
  const question = typeof value === 'string' ? value : value?.question || value?.message || 'Input required';
  const options = value?.options as string[] | undefined;

  const handleSubmit = (val: unknown) => {
    setSubmitted(true);
    const stepMode = useExecutionStore.getState().stepMode;
    sendMessage({ type: 'RESOLVE_INTERRUPT', response: val, stepMode });
  };

  if (submitted) {
    return (
      <div className="flex justify-center py-2">
        <div className="text-[11px] text-muted-foreground" style={{ background: 'var(--muted)', padding: '4px 12px', borderRadius: 99 }}>
          Response submitted
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <div
        className="rounded-xl p-4 max-w-[90%]"
        style={{
          background: 'color-mix(in srgb, var(--background) 92%, #f59e0b)',
          border: '1px solid color-mix(in srgb, var(--border) 70%, #f59e0b 30%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-node-warning flex-shrink-0">
            <rect x="3.5" y="2" width="2" height="7" rx="0.5" fill="currentColor"/>
            <rect x="8.5" y="2" width="2" height="7" rx="0.5" fill="currentColor"/>
          </svg>
          <span className="text-xs font-semibold text-node-warning">Human Input Required</span>
          <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--muted-foreground)' }}>{interrupt.nodeId}</span>
        </div>

        {/* Question */}
        <p className="text-[13px] mb-3" style={{ color: 'var(--foreground)' }}>{String(question)}</p>

        {/* Options or text input */}
        {options && Array.isArray(options) ? (
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => handleSubmit(opt)}
                className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                style={{
                  background: 'var(--card)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f59e0b'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && response.trim() && handleSubmit(response)}
              placeholder="Type your response..."
              autoFocus
              className="flex-1 rounded-lg px-3 py-1.5 text-[13px] focus:outline-none"
              style={{
                background: 'var(--input)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
            <button
              onClick={() => handleSubmit(response)}
              disabled={!response.trim()}
              className="px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-30"
              style={{
                background: 'color-mix(in srgb, transparent 80%, #f59e0b)',
                color: '#f59e0b',
              }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
