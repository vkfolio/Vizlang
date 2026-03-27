import React, { useRef, useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useThreadStore } from '@/stores/threadStore';
import { useExecutionStore } from '@/stores/executionStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { InterruptChatCard } from '../hitl/InterruptChatCard';

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const showToolCalls = useChatStore((s) => s.showToolCalls);
  const setShowToolCalls = useChatStore((s) => s.setShowToolCalls);
  const activeThreadId = useThreadStore((s) => s.activeThreadId);
  const activeInterrupt = useExecutionStore((s) => s.activeInterrupt);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter tool messages if toggle is off
  const visibleMessages = showToolCalls
    ? messages
    : messages.filter((m) => m.role !== 'tool');

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  return (
    <div className="flex flex-col h-full">
      {/* Thread indicator + controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-node-active" />
          <span className="text-[11px] font-mono text-muted-foreground">
            Thread: {activeThreadId}
          </span>
        </div>
        <button
          onClick={() => setShowToolCalls(!showToolCalls)}
          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${
            showToolCalls
              ? 'text-foreground bg-muted'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
          title={showToolCalls ? 'Hide tool calls' : 'Show tool calls'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
            <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" />
            <path d="M4 6h4M6 4v4" />
          </svg>
          Tools
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
        {visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-30">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span className="text-xs">Send a message to start</span>
          </div>
        ) : (
          <>
            {visibleMessages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {/* HITL interrupt card inline in chat */}
            {activeInterrupt && <InterruptChatCard interrupt={activeInterrupt} />}
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput />
    </div>
  );
}
