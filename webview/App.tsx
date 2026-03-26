import React, { useState } from 'react';
import { GraphCanvas } from './components/graph/GraphCanvas';
import { ChatPanel } from './components/chat/ChatPanel';
import { RightSidebar } from './components/sidebar/RightSidebar';
import { InterruptOverlay } from './components/hitl/InterruptOverlay';
import { ErrorBanner } from './components/ErrorBanner';
import { useStreamHandler } from './hooks/useStreamHandler';
import { useExecutionStore } from './stores/executionStore';
import { cn } from './lib/utils';

type Tab = 'graph' | 'chat';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('graph');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const runStatus = useExecutionStore((s) => s.runStatus);
  const isInterrupted = runStatus === 'interrupted';

  // Initialize stream handler to route messages to stores
  useStreamHandler();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Error banner */}
      <ErrorBanner />

      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-card/30 flex-shrink-0">
        <TabButton active={activeTab === 'graph'} onClick={() => setActiveTab('graph')}>
          Graph
        </TabButton>
        <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>
          Chat
        </TabButton>

        <div className="flex-1" />

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={cn(
            'px-3 py-2 text-xs transition-colors',
            sidebarOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
          title="Toggle sidebar (Threads, Trace, State)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="2" width="14" height="12" rx="1.5" />
            <path d="M10 2v12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 relative overflow-hidden">
          {/* Graph tab */}
          <div
            className={cn(
              'absolute inset-0 transition-opacity duration-200',
              activeTab === 'graph' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            )}
          >
            <GraphCanvas />
            {/* HITL overlay on graph */}
            {activeTab === 'graph' && isInterrupted && <InterruptOverlay />}
          </div>

          {/* Chat tab */}
          <div
            className={cn(
              'absolute inset-0 transition-opacity duration-200',
              activeTab === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            )}
          >
            <ChatPanel />
          </div>
        </div>

        {/* Right sidebar */}
        <RightSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
