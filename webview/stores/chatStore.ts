import { create } from 'zustand';
import type { Attachment } from '../../shared/protocol';

export interface ChatMessage {
  id: string;
  role: 'human' | 'ai' | 'tool' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolName?: string;
  toolArgs?: unknown;
  attachments?: Attachment[];
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;

  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  appendToLastMessage: (content: string) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  setStreaming: (streaming: boolean) => void;
  clear: () => void;
}

let msgCounter = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,

  addMessage: (msg) => {
    const message: ChatMessage = {
      ...msg,
      id: `msg_${++msgCounter}`,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, message] }));
  },

  appendToLastMessage: (content) => {
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'ai') {
        msgs[msgs.length - 1] = { ...last, content: last.content + content };
      }
      return { messages: msgs };
    });
  },

  setMessages: (msgs) => set({ messages: msgs }),

  setStreaming: (streaming) => {
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'ai') {
        msgs[msgs.length - 1] = { ...last, isStreaming: streaming };
      }
      return { messages: msgs, isStreaming: streaming };
    });
  },

  clear: () => set({ messages: [], isStreaming: false }),
}));
