import React from 'react';
import { useExecutionStore } from '@/stores/executionStore';

interface NodeStateTooltipProps {
  nodeId: string;
  anchor: { x: number; y: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function NodeStateTooltip({ nodeId, anchor, onMouseEnter, onMouseLeave }: NodeStateTooltipProps) {
  const nodeState = useExecutionStore((s) => s.nodeStates[nodeId]);

  if (!nodeState || (!nodeState.outputs && !nodeState.inputs && !nodeState.stateAfter)) {
    return null;
  }

  const sections: { label: string; data: unknown }[] = [];
  if (nodeState.inputs) sections.push({ label: 'Inputs', data: nodeState.inputs });
  if (nodeState.outputs) sections.push({ label: 'Outputs', data: nodeState.outputs });
  if (nodeState.stateAfter) sections.push({ label: 'State After', data: nodeState.stateAfter });

  if (sections.length === 0) return null;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left: anchor.x + 20,
        top: anchor.y - 12,
        zIndex: 1000,
        maxWidth: 440,
        maxHeight: 380,
      }}
    >
      <div
        className="rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{
          maxHeight: 380,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Header */}
        <div className="px-3 py-1.5 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-node-active" />
          <span className="text-[11px] font-mono" style={{ color: 'var(--muted-foreground)' }}>{nodeId}</span>
        </div>

        {/* Scrollable content */}
        <div
          className="overflow-auto flex-1"
          style={{ maxHeight: 340 }}
          onWheel={(e) => e.stopPropagation()}
        >
          {sections.map((section) => (
            <div key={section.label} style={{ borderBottom: '1px solid var(--border)' }} className="last:border-b-0">
              <div className="px-3 py-1" style={{ background: 'var(--muted)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  {section.label}
                </span>
              </div>
              <pre className="px-3 py-2 text-[11px] font-mono overflow-auto max-h-[260px] whitespace-pre-wrap break-all leading-relaxed" style={{ color: 'var(--foreground)' }}>
                {formatData(section.data)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatData(data: unknown): string {
  try {
    const str = JSON.stringify(data, null, 2);
    return str.length > 1200 ? str.slice(0, 1200) + '\n...' : str;
  } catch {
    return String(data);
  }
}
