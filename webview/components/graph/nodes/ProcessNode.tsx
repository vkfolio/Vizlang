import React from 'react';
import { BaseNode } from './BaseNode';
import type { GraphNodeData } from '@/stores/graphStore';

export function ProcessNode({ data }: { data: GraphNodeData }) {
  return <BaseNode data={data} shape="rect" />;
}
