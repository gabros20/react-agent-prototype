'use client';

import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

export interface AgentStatus {
  state: 'thinking' | 'tool-call';
  toolName?: string;
}

// Represents a message being streamed in real-time
export interface StreamingMessage {
  id: string;
  content: string;
}

interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  streamingMessage: StreamingMessage | null; // Currently streaming message
  currentTraceId: string | null;
  isStreaming: boolean;
  agentStatus: AgentStatus | null;

  // Session management
  setSessionId: (sessionId: string | null) => void;

  // Message management
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;

  // Streaming message management
  startStreamingMessage: (id: string) => void;
  appendToStreamingMessage: (delta: string) => void;
  finalizeStreamingMessage: () => void;
  clearStreamingMessage: () => void;

  // Status management
  setCurrentTraceId: (traceId: string | null) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setAgentStatus: (status: AgentStatus | null) => void;

  // Reset
  reset: () => void;
}

// No localStorage persistence - DB is single source of truth
export const useChatStore = create<ChatState>()((set, get) => ({
  sessionId: null,
  messages: [],
  streamingMessage: null,
  currentTraceId: null,
  isStreaming: false,
  agentStatus: null,

  setSessionId: (sessionId) => set({ sessionId }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  // Start a new streaming message
  startStreamingMessage: (id) => set({
    streamingMessage: { id, content: '' }
  }),

  // Append text delta to the current streaming message
  appendToStreamingMessage: (delta) => set((state) => {
    if (!state.streamingMessage) {
      // If no streaming message started, create one
      return {
        streamingMessage: { id: crypto.randomUUID(), content: delta }
      };
    }
    return {
      streamingMessage: {
        ...state.streamingMessage,
        content: state.streamingMessage.content + delta
      }
    };
  }),

  // Finalize the streaming message - move it to messages array
  finalizeStreamingMessage: () => set((state) => {
    if (!state.streamingMessage || !state.streamingMessage.content.trim()) {
      return { streamingMessage: null };
    }

    const newMessage: ChatMessage = {
      id: state.streamingMessage.id,
      role: 'assistant',
      content: state.streamingMessage.content,
      createdAt: new Date(),
    };

    return {
      messages: [...state.messages, newMessage],
      streamingMessage: null,
    };
  }),

  // Clear streaming message without adding to messages
  clearStreamingMessage: () => set({ streamingMessage: null }),

  setCurrentTraceId: (traceId) => set({ currentTraceId: traceId }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setAgentStatus: (status) => set({ agentStatus: status }),

  reset: () => set({
    sessionId: null,
    messages: [],
    streamingMessage: null,
    currentTraceId: null,
    isStreaming: false,
    agentStatus: null,
  }),
}));
