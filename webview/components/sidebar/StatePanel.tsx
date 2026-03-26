import React, { useState } from 'react';
import { useExecutionStore } from '@/stores/executionStore';
import { JsonTree } from '../shared/JsonTree';

export function StatePanel() {
  const currentState = useExecutionStore((s) => s.currentState);
  const [searchQuery, setSearchQuery] = useState('');

  if (!currentState) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-2 py-8">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-30">
          <path d="M3 3h18v18H3z" />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
        </svg>
        <span className="text-[11px]">No state data</span>
        <span className="text-[10px]">Run a graph to inspect state</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with search */}
      <div className="px-3 py-2 border-b border-border/50 space-y-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">State Inspector</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter keys..."
          className="w-full bg-muted/30 border border-border/50 rounded px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/50"
        />
      </div>

      {/* State tree */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="font-mono text-[11px] leading-relaxed">
          {searchQuery ? (
            <FilteredTree data={currentState} query={searchQuery.toLowerCase()} />
          ) : (
            <JsonTree data={currentState} defaultExpanded />
          )}
        </div>
      </div>
    </div>
  );
}

function FilteredTree({ data, query }: { data: unknown; query: string }) {
  if (typeof data !== 'object' || data === null) {
    return <JsonTree data={data} defaultExpanded />;
  }

  const obj = data as Record<string, unknown>;
  const matchingKeys = Object.keys(obj).filter((k) => k.toLowerCase().includes(query));

  if (matchingKeys.length === 0) {
    return <span className="text-muted-foreground/50 text-[11px]">No matching keys</span>;
  }

  return (
    <div>
      {matchingKeys.map((key) => (
        <div key={key} className="py-0.5">
          <span className="text-purple-400/80">{key}</span>
          <span className="text-muted-foreground mx-1">:</span>
          <JsonTree data={obj[key]} defaultExpanded />
        </div>
      ))}
    </div>
  );
}
