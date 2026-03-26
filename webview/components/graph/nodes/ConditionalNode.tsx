import React from 'react';
import { BaseNode } from './BaseNode';
import type { GraphNodeData } from '@/stores/graphStore';

export function ConditionalNode({ data }: { data: GraphNodeData }) {
  return (
    <BaseNode data={data} shape="rect" accentColor="border-node-conditional">
      <span className="ml-1 text-[10px] text-node-conditional">⑂</span>
    </BaseNode>
  );
}
