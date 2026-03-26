import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { GraphNodeData } from '@/stores/graphStore';
import { useGraphStore } from '@/stores/graphStore';

const statusIcons: Record<GraphNodeData['status'], string> = {
  idle: '',
  running: '',
  completed: '',
  error: '',
  interrupted: '',
};

interface BaseNodeProps {
  data: GraphNodeData;
  className?: string;
  shape?: 'rect' | 'pill' | 'diamond';
  accentColor?: string;
  children?: React.ReactNode;
}

export function BaseNode({
  data,
  className,
  shape = 'rect',
  accentColor,
  children,
}: BaseNodeProps) {
  const layoutDirection = useGraphStore((s) => s.layoutDirection);
  const isHorizontal = layoutDirection === 'LR';

  const shapeClasses = {
    rect: 'rounded-lg',
    pill: 'rounded-full',
    diamond: 'rounded-lg',
  };

  const statusClasses: Record<GraphNodeData['status'], string> = {
    idle: 'node-idle',
    running: 'node-status-running',
    completed: 'node-status-completed',
    error: 'node-status-error',
    interrupted: 'node-status-interrupted',
  };

  return (
    <div
      className={cn(
        'vizlang-node relative flex items-center justify-center border transition-all duration-200',
        'bg-card text-card-foreground',
        'cursor-grab active:cursor-grabbing',
        shapeClasses[shape],
        statusClasses[data.status],
        accentColor && data.status === 'idle' ? accentColor : '',
        className
      )}
      style={{ width: 160 }}
    >
      <Handle
        type="target"
        position={isHorizontal ? Position.Left : Position.Top}
        style={isHorizontal ? { top: '50%' } : { left: '50%' }}
        className="!bg-muted-foreground/60 !border-none !w-2 !h-2 hover:!bg-foreground hover:!w-2.5 hover:!h-2.5 !transition-all"
      />

      <div className="flex items-center gap-2 px-4 py-2.5">
        {data.status === 'running' && (
          <div className="node-spinner" />
        )}
        {data.status === 'completed' && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-node-success flex-shrink-0">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {data.status === 'error' && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-node-error flex-shrink-0">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
        {data.status === 'interrupted' && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-node-warning flex-shrink-0">
            <rect x="3" y="2.5" width="2" height="7" rx="0.5" fill="currentColor"/>
            <rect x="7" y="2.5" width="2" height="7" rx="0.5" fill="currentColor"/>
          </svg>
        )}
        <span className="text-sm font-medium truncate max-w-[160px]">
          {data.label}
        </span>
        {children}
      </div>

      <Handle
        type="source"
        position={isHorizontal ? Position.Right : Position.Bottom}
        style={isHorizontal ? { top: '50%' } : { left: '50%' }}
        className="!bg-muted-foreground/60 !border-none !w-2 !h-2 hover:!bg-foreground hover:!w-2.5 hover:!h-2.5 !transition-all"
      />
    </div>
  );
}
