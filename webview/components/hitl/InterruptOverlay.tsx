import React, { useState } from 'react';
import { sendMessage } from '@/bridge/MessageBus';
import { useExecutionStore } from '@/stores/executionStore';

export function InterruptOverlay() {
  const interrupt = useExecutionStore((s) => s.activeInterrupt);
  const [response, setResponse] = useState('');

  if (!interrupt) return null;

  const value = interrupt.value as any;
  const question = typeof value === 'string' ? value : value?.question || value?.message || 'Input required';
  const options = value?.options as string[] | undefined;

  const handleSubmit = (val: unknown) => {
    const stepMode = useExecutionStore.getState().stepMode;
    sendMessage({ type: 'RESOLVE_INTERRUPT', response: val, stepMode });
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div
        className="rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'color-mix(in srgb, var(--card) 92%, #f59e0b)',
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, transparent 80%, #f59e0b)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-node-warning">
              <rect x="4" y="2.5" width="2.5" height="8" rx="0.5" fill="currentColor"/>
              <rect x="9.5" y="2.5" width="2.5" height="8" rx="0.5" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Human Input Required</h3>
            <p className="text-[11px] font-mono" style={{ color: 'var(--muted-foreground)' }}>Node: {interrupt.nodeId}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-[13px] mb-4 leading-relaxed" style={{ color: 'var(--foreground)' }}>{String(question)}</p>

          {/* Render interrupt value details if complex object */}
          {typeof value === 'object' && value !== null && !options && value.question === undefined && (
            <pre
              className="text-[11px] font-mono rounded-lg p-3 mb-4 max-h-[150px] overflow-auto whitespace-pre-wrap break-all"
              style={{
                background: 'var(--muted)',
                color: 'var(--muted-foreground)',
                border: '1px solid var(--border)',
              }}
            >
              {JSON.stringify(value, null, 2)}
            </pre>
          )}

          {options && Array.isArray(options) ? (
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSubmit(opt)}
                  className="px-4 py-2 text-sm rounded-lg transition-all"
                  style={{
                    background: 'var(--secondary)',
                    color: 'var(--secondary-foreground)',
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
            <div className="space-y-3">
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Type your response..."
                rows={3}
                autoFocus
                className="w-full resize-none rounded-lg px-3 py-2 text-[13px] focus:outline-none"
                style={{
                  background: 'var(--input)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleSubmit('__reject__')}
                  className="px-4 py-2 text-xs rounded-lg transition-colors"
                  style={{
                    background: 'color-mix(in srgb, transparent 90%, #ef4444)',
                    color: '#ef4444',
                  }}
                >
                  Reject
                </button>
                <button
                  onClick={() => handleSubmit(response || '__approve__')}
                  className="px-4 py-2 text-xs rounded-lg transition-colors"
                  style={{
                    background: 'color-mix(in srgb, transparent 80%, #f59e0b)',
                    color: '#f59e0b',
                  }}
                >
                  {response.trim() ? 'Submit' : 'Approve'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
