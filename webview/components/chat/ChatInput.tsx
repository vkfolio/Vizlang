import React, { useState, useRef, useCallback } from 'react';
import { sendMessage } from '@/bridge/MessageBus';
import { useChatStore } from '@/stores/chatStore';
import { useExecutionStore } from '@/stores/executionStore';
import { useThreadStore } from '@/stores/threadStore';
import { useGraphStore } from '@/stores/graphStore';
import { cn } from '@/lib/utils';
import type { Attachment } from '../../../shared/protocol';

interface PendingAttachment {
  file: File;
  preview?: string;
  attachment: Attachment;
}

export function ChatInput() {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const [showExtra, setShowExtra] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const activeThreadId = useThreadStore((s) => s.activeThreadId);
  const hasGraph = useGraphStore((s) => s.nodes.length > 0);
  const addMessage = useChatStore((s) => s.addMessage);
  const inputSchema = useGraphStore((s) => s.inputSchema);
  const sampleInput = useGraphStore((s) => s.sampleInput);

  // Non-message fields from schema
  const extraFieldDefs = React.useMemo(() => {
    if (!inputSchema) return [];
    return Object.entries(inputSchema)
      .filter(([key]) => key !== 'messages')
      .map(([key, type]) => ({ key, type, sample: sampleInput?.[key] }));
  }, [inputSchema, sampleInput]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming || !hasGraph) return;

    const messageAttachments = attachments.map((a) => a.attachment);

    addMessage({
      role: 'human',
      content: trimmed || (attachments.length > 0 ? `[${attachments.map(a => a.file.name).join(', ')}]` : ''),
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
    });

    // Add thinking indicator and mark as running immediately
    addMessage({ role: 'ai', content: '', thinking: 'Thinking...' });
    useExecutionStore.getState().setRunStatus('running');

    // Build extra input fields (parse JSON values)
    const extraInput: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(extraFields)) {
      if (val.trim()) {
        try {
          extraInput[key] = JSON.parse(val);
        } catch {
          extraInput[key] = val; // Use as string if not valid JSON
        }
      }
    }

    sendMessage({
      type: 'SEND_MESSAGE',
      threadId: activeThreadId,
      content: trimmed,
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
      extraInput: Object.keys(extraInput).length > 0 ? extraInput : undefined,
    });

    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, attachments, isStreaming, hasGraph, activeThreadId, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter sends, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const isImage = file.type.startsWith('image/');
        const isAudio = file.type.startsWith('audio/');

        const pending: PendingAttachment = {
          file,
          preview: isImage ? reader.result as string : undefined,
          attachment: {
            type: isImage ? 'image' : isAudio ? 'audio' : 'file',
            name: file.name,
            mimeType: file.type,
            data: base64,
          },
        };
        setAttachments((prev) => [...prev, pending]);
      };
      reader.readAsDataURL(file);
    }

    // Reset file input
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const disabled = isStreaming || !hasGraph;
  const canSend = (text.trim() || attachments.length > 0) && !disabled;

  return (
    <div className="border-t border-border/50 bg-card/30 p-3">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {attachments.map((att, i) => (
            <div key={i} className="relative group">
              {att.preview ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img src={att.preview} alt={att.file.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-muted/30 border border-border rounded-lg px-2.5 py-1.5">
                  <FileIcon type={att.attachment.type} />
                  <span className="text-[11px] text-foreground/70 max-w-[100px] truncate">
                    {att.file.name}
                  </span>
                </div>
              )}
              {/* Remove button */}
              <button
                onClick={() => removeAttachment(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1.5" fill="none">
                  <path d="M2 2l4 4M6 2l-4 4" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Extra state fields (non-message schema fields) */}
      {extraFieldDefs.length > 0 && (
        <div className="mb-2">
          <button
            onClick={() => setShowExtra(!showExtra)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-1"
          >
            <span className="text-[10px]">{showExtra ? '▼' : '▶'}</span>
            Extra fields ({extraFieldDefs.length})
          </button>
          {showExtra && (
            <div className="space-y-1.5 p-2 bg-muted/20 rounded-lg border border-border/50">
              {extraFieldDefs.map(({ key, type, sample }) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="text-[11px] text-muted-foreground w-20 text-right flex-shrink-0 font-mono">
                    {key}
                  </label>
                  <input
                    type="text"
                    className="flex-1 bg-input text-foreground text-xs px-2 py-1 rounded border border-border focus:outline-none focus:ring-1 focus:ring-accent/30 font-mono placeholder:text-muted-foreground/40"
                    placeholder={`${type} — e.g. ${JSON.stringify(sample ?? '')}`}
                    value={extraFields[key] || ''}
                    onChange={(e) =>
                      setExtraFields((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 bg-muted/30 border border-border rounded-xl px-1 py-1 focus-within:border-accent/30 transition-colors">
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0',
            'text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors',
            'disabled:opacity-30 disabled:cursor-not-allowed'
          )}
          title="Attach file (image, audio, document)"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M15.25 8.35l-6.3 6.3a3.5 3.5 0 01-4.95-4.95l6.3-6.3a2.33 2.33 0 013.3 3.3l-6.3 6.28a1.17 1.17 0 01-1.65-1.65l5.84-5.82" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,audio/*,.pdf,.txt,.csv,.json,.py,.md"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            !hasGraph
              ? 'Load a graph first...'
              : isStreaming
                ? 'Waiting for response...'
                : 'Message... (Shift+Enter for new line)'
          }
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent py-1.5 px-1',
            'text-[13px] text-foreground placeholder:text-muted-foreground/40',
            'focus:outline-none',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'min-h-[32px] max-h-[160px]'
          )}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-all',
            canSend
              ? 'bg-primary text-primary-foreground hover:bg-primary/80'
              : 'text-muted-foreground/30'
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 13V3l11 5-11 5z"
              fill={canSend ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Hint text */}
      <div className="flex items-center justify-between mt-1.5 px-1">
        <span className="text-[10px] text-muted-foreground/30">
          Enter to send, Shift+Enter for new line
        </span>
        {attachments.length > 0 && (
          <span className="text-[10px] text-muted-foreground/50">
            {attachments.length} file{attachments.length > 1 ? 's' : ''} attached
          </span>
        )}
      </div>
    </div>
  );
}

function FileIcon({ type }: { type: string }) {
  if (type === 'image') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-green-400/70">
        <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
        <circle cx="5" cy="5" r="1.25" />
        <path d="M1.5 9.5l3-3 2 2 2.5-2.5 3.5 3.5" />
      </svg>
    );
  }
  if (type === 'audio') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-purple-400/70">
        <path d="M3.5 5v4M5.5 3.5v7M7.5 4.5v5M9.5 3v8M11.5 5v4" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-blue-400/70">
      <path d="M8 1.5H3.5a1 1 0 00-1 1v9a1 1 0 001 1h7a1 1 0 001-1V5L8 1.5z" />
      <path d="M8 1.5V5h3.5" />
    </svg>
  );
}
