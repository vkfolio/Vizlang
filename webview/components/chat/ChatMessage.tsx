import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/stores/chatStore';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [expanded, setExpanded] = useState(false);

  if (message.role === 'system') {
    return (
      <div className="flex justify-center py-2">
        <div className="text-[11px] text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full max-w-[80%] text-center">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className="flex justify-start px-4 py-1">
        <div className="max-w-[85%]">
          <button
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" />
              <path d="M4 6h4M6 4v4" />
            </svg>
            <span className="font-mono">{message.toolName || 'tool'}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className={cn('transition-transform', expanded && 'rotate-90')}
            >
              <path d="M3 2l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          {expanded && (
            <pre className="mt-1 text-[11px] font-mono text-foreground/70 bg-muted/30 rounded-md p-2 overflow-auto max-h-[200px] whitespace-pre-wrap break-all">
              {message.content}
            </pre>
          )}
        </div>
      </div>
    );
  }

  const isHuman = message.role === 'human';
  const hasAttachments = message.attachments && message.attachments.length > 0;

  return (
    <div className={cn('flex px-4 py-2', isHuman ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] space-y-2')}>
        {/* Attachment previews */}
        {hasAttachments && (
          <div className={cn('flex flex-wrap gap-1.5', isHuman && 'justify-end')}>
            {message.attachments!.map((att, i) => (
              <AttachmentPreview key={i} attachment={att} />
            ))}
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <div
            className={cn(
              'rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
              isHuman
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-card border border-border/50 rounded-bl-md'
            )}
          >
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
            {message.isStreaming && (
              <span className="streaming-cursor inline-block ml-0.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: { type: string; name: string; mimeType: string; data: string } }) {
  if (attachment.type === 'image') {
    return (
      <div className="w-48 rounded-xl overflow-hidden border border-border">
        <img
          src={`data:${attachment.mimeType};base64,${attachment.data}`}
          alt={attachment.name}
          className="w-full h-auto max-h-48 object-cover"
        />
      </div>
    );
  }

  if (attachment.type === 'audio') {
    return (
      <div className="bg-card border border-border rounded-xl px-3 py-2 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-400/70 flex-shrink-0">
          <path d="M4 6v4M6 4v8M8 5v6M10 3v10M12 6v4" />
        </svg>
        <span className="text-[11px] text-foreground/70 truncate max-w-[120px]">{attachment.name}</span>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 flex items-center gap-2">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-blue-400/70 flex-shrink-0">
        <path d="M8 1.5H3.5a1 1 0 00-1 1v9a1 1 0 001 1h7a1 1 0 001-1V5L8 1.5z" />
        <path d="M8 1.5V5h3.5" />
      </svg>
      <span className="text-[11px] text-foreground/70 truncate max-w-[120px]">{attachment.name}</span>
    </div>
  );
}
