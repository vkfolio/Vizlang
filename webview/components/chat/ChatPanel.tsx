import React, { useRef, useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useThreadStore } from '@/stores/threadStore';
import { useExecutionStore } from '@/stores/executionStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { InterruptChatCard } from '../hitl/InterruptChatCard';

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const activeThreadId = useThreadStore((s) => s.activeThreadId);
  const activeInterrupt = useExecutionStore((s) => s.activeInterrupt);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  return (
    <div className="flex flex-col h-full">
      {/* Thread indicator */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-card/20 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-node-active" />
        <span className="text-[11px] font-mono text-muted-foreground">
          Thread: {activeThreadId}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-30">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span className="text-xs">Send a message to start</span>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
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
