'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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

interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  currentTraceId: string | null;
  isStreaming: boolean;
  agentStatus: AgentStatus | null;
  setSessionId: (sessionId: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setCurrentTraceId: (traceId: string | null) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setAgentStatus: (status: AgentStatus | null) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessionId: null,
      messages: [],
      currentTraceId: null,
      isStreaming: false,
      agentStatus: null,
      setSessionId: (sessionId) => set({ sessionId }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      setCurrentTraceId: (traceId) => set({ currentTraceId: traceId }),
      setIsStreaming: (isStreaming) => set({ isStreaming }),
      setAgentStatus: (status) => set({ agentStatus: status }),
      reset: () => set({ sessionId: null, messages: [], currentTraceId: null, isStreaming: false, agentStatus: null }),
    }),
    {
      name: 'chat-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        messages: state.messages.slice(-50), // Keep last 50 messages only
      }),
    }
  )
);
