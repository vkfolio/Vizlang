import React, { useState, useRef, useEffect } from 'react';
import { useExecutionStore } from '@/stores/executionStore';

interface NodeStateTooltipProps {
  nodeId: string;
  anchor: { x: number; y: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function NodeStateTooltip({ nodeId, anchor, onMouseEnter, onMouseLeave }: NodeStateTooltipProps) {
  const nodeState = useExecutionStore((s) => s.nodeStates[nodeId]);
  const tooltipRef = useRef<HTMLDivElement>(null);

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
      ref={tooltipRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="node-state-tooltip"
      style={{
        position: 'fixed',
        left: anchor.x + 20,
        top: anchor.y - 12,
        zIndex: 1000,
        maxWidth: 440,
        maxHeight: 380,
      }}
    >
      <div className="bg-[#1e1e2e]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 380 }}>
        {/* Header */}
        <div className="px-3 py-1.5 border-b border-white/5 flex items-center gap-2 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-node-active" />
          <span className="text-[11px] font-mono text-foreground/70">{nodeId}</span>
        </div>

        {/* Scrollable content */}
        <div
          className="overflow-auto flex-1"
          style={{ maxHeight: 340 }}
          onWheel={(e) => e.stopPropagation()}
        >
          {sections.map((section) => (
            <div key={section.label} className="border-b border-white/5 last:border-b-0">
              <div className="px-3 py-1 bg-white/[0.02]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </span>
              </div>
              <pre className="px-3 py-2 text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all leading-relaxed">
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
