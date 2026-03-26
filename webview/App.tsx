import React, { useState } from 'react';
import { GraphCanvas } from './components/graph/GraphCanvas';
import { useStreamHandler } from './hooks/useStreamHandler';
import { cn } from './lib/utils';

type Tab = 'graph' | 'chat';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('graph');

  // Initialize stream handler to route messages to stores
  useStreamHandler();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-card/30">
        <TabButton
          active={activeTab === 'graph'}
          onClick={() => setActiveTab('graph')}
        >
          Graph
        </TabButton>
        <TabButton
          active={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-200',
            activeTab === 'graph' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
          )}
        >
          <GraphCanvas />
        </div>
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-200',
            activeTab === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
          )}
        >
          <div className="flex-1 flex items-center justify-center h-full text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm">Chat view</span>
              <span className="text-xs">Coming in Phase 3</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={cn(
        'relative px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
      onClick={onClick}
    >
      {children}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
      )}
    </button>
  );
}
