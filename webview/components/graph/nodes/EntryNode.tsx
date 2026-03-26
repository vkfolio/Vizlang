import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { GraphNodeData } from '@/stores/graphStore';
import { useGraphStore } from '@/stores/graphStore';

export function EntryNode({ data }: { data: GraphNodeData }) {
  const layoutDirection = useGraphStore((s) => s.layoutDirection);
  const isHorizontal = layoutDirection === 'LR';

  return (
    <div
      className={cn(
        'vizlang-node flex items-center justify-center rounded-full',
        'border border-node-success/60 bg-node-success/8 text-card-foreground',
        'py-2.5 cursor-grab active:cursor-grabbing',
        'node-entry-glow'
      )}
      style={{ width: 160 }}
    >
      <span className="text-xs font-semibold tracking-widest text-node-success uppercase select-none">
        {data.label}
      </span>
      <Handle
        type="source"
        position={isHorizontal ? Position.Right : Position.Bottom}
        className="!bg-node-success !border-none !w-2.5 !h-2.5"
      />
    </div>
  );
}
