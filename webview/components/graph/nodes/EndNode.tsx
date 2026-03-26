import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { GraphNodeData } from '@/stores/graphStore';
import { useGraphStore } from '@/stores/graphStore';

export function EndNode({ data }: { data: GraphNodeData }) {
  const layoutDirection = useGraphStore((s) => s.layoutDirection);
  const isHorizontal = layoutDirection === 'LR';

  return (
    <div
      className={cn(
        'vizlang-node flex items-center justify-center rounded-full',
        'border border-node-error/40 bg-node-error/6 text-card-foreground',
        'py-2.5 cursor-grab active:cursor-grabbing',
        'node-end-glow'
      )}
      style={{ width: 160 }}
    >
      <Handle
        type="target"
        position={isHorizontal ? Position.Left : Position.Top}
        className="!bg-node-error/60 !border-none !w-2.5 !h-2.5"
      />
      <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase select-none">
        {data.label}
      </span>
    </div>
  );
}
