import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface JsonTreeProps {
  data: unknown;
  depth?: number;
  path?: string;
  defaultExpanded?: boolean;
}

export function JsonTree({ data, depth = 0, path = '', defaultExpanded = true }: JsonTreeProps) {
  if (data === null) return <span className="text-muted-foreground/60">null</span>;
  if (data === undefined) return <span className="text-muted-foreground/60">undefined</span>;

  if (typeof data === 'string') {
    const truncated = data.length > 200;
    return (
      <StringValue value={data} truncated={truncated} />
    );
  }
  if (typeof data === 'number') return <span className="text-blue-400">{data}</span>;
  if (typeof data === 'boolean') return <span className="text-orange-400">{String(data)}</span>;

  if (Array.isArray(data)) {
    return <CollapsibleNode label={`Array(${data.length})`} data={data} depth={depth} path={path} defaultExpanded={defaultExpanded && depth < 2} isArray />;
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data as object);
    return <CollapsibleNode label={`{${keys.length}}`} data={data as Record<string, unknown>} depth={depth} path={path} defaultExpanded={defaultExpanded && depth < 2} />;
  }

  return <span className="text-foreground/70">{String(data)}</span>;
}

function StringValue({ value, truncated }: { value: string; truncated: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded || !truncated ? value : value.slice(0, 200);

  return (
    <span className="text-green-400">
      "{display}"
      {truncated && !expanded && (
        <button onClick={() => setExpanded(true)} className="ml-1 text-[10px] text-muted-foreground hover:text-foreground">
          ...({value.length} chars)
        </button>
      )}
    </span>
  );
}

function CollapsibleNode({
  label,
  data,
  depth,
  path,
  defaultExpanded,
  isArray = false,
}: {
  label: string;
  data: Record<string, unknown> | unknown[];
  depth: number;
  path: string;
  defaultExpanded: boolean;
  isArray?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const entries = isArray
    ? (data as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(data as Record<string, unknown>);

  if (entries.length === 0) {
    return <span className="text-muted-foreground/60">{isArray ? '[]' : '{}'}</span>;
  }

  return (
    <span>
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={cn('transition-transform', expanded && 'rotate-90')}
        >
          <path d="M3 1.5l4 3.5-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="text-[10px]">{label}</span>
      </button>
      {expanded && (
        <div className="ml-3 border-l border-border/50 pl-2">
          {entries.map(([key, val]) => (
            <div key={key} className="py-0.5">
              <span className="text-purple-400/80 text-[11px]">{key}</span>
              <span className="text-muted-foreground mx-1">:</span>
              <JsonTree data={val} depth={depth + 1} path={path ? `${path}.${key}` : key} defaultExpanded={false} />
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
