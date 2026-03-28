import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ThreadsPanel } from './ThreadsPanel';
import { TracePanel } from './TracePanel';
import { StatePanel } from './StatePanel';
import { useGraphStore } from '@/stores/graphStore';

type SidebarTab = 'threads' | 'trace' | 'state';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RightSidebar({ isOpen, onClose }: RightSidebarProps) {
  const checkpointerMode = useGraphStore((s) => s.checkpointerMode);
  const memoryEnabled = checkpointerMode === 'memory';

  const availableTabs: SidebarTab[] = memoryEnabled
    ? ['threads', 'trace', 'state']
    : ['trace', 'state'];

  const [activeTab, setActiveTab] = useState<SidebarTab>('trace');

  // If threads tab is active but memory got disabled, switch to trace
  useEffect(() => {
    if (!memoryEnabled && activeTab === 'threads') {
      setActiveTab('trace');
    }
  }, [memoryEnabled, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full border-l border-border/50 bg-card/20" style={{ width: 280 }}>
      {/* Tab bar */}
      <div className="flex items-center border-b border-border/50 flex-shrink-0">
        {availableTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2 text-[11px] font-medium transition-colors relative',
              activeTab === tab
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/70'
            )}
          >
            {tab === 'threads' ? 'Threads' : tab === 'trace' ? 'Trace' : 'State'}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
        <button
          onClick={onClose}
          className="px-2 py-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Close sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l6 6M10 4l-6 6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'threads' && memoryEnabled && <ThreadsPanel />}
        {activeTab === 'trace' && <TracePanel />}
        {activeTab === 'state' && <StatePanel />}
      </div>
    </div>
  );
}
