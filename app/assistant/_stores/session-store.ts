'use client';

import { create } from 'zustand';

export interface SessionMetadata {
  id: string;
  title: string;
  messageCount: number;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  title: string;
  checkpoint: any;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: any;
    createdAt: Date;
  }>;
}

interface SessionState {
  sessions: SessionMetadata[];
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<Session | null>;
  createSession: (title?: string) => Promise<string>;
  updateSession: (sessionId: string, title: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearHistory: (sessionId: string) => Promise<void>;
  setCurrentSessionId: (sessionId: string | null) => void;
  setError: (error: string | null) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  error: null,

  // Load all sessions with metadata
  loadSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/sessions');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to load sessions');
      }

      // Convert date strings to Date objects
      const sessions = result.data.map((session: any) => ({
        ...session,
        lastActivity: new Date(session.lastActivity),
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      }));

      set({ sessions, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Failed to load sessions:', error);
    }
  },

  // Load single session with messages
  loadSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to load session');
      }

      // Convert date strings to Date objects
      const session = {
        ...result.data,
        createdAt: new Date(result.data.createdAt),
        updatedAt: new Date(result.data.updatedAt),
        messages: result.data.messages.map((msg: any) => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        })),
      };

      set({ isLoading: false, currentSessionId: sessionId });
      return session;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Failed to load session:', error);
      return null;
    }
  },

  // Create new session
  createSession: async (title?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to create session');
      }

      const newSession: SessionMetadata = {
        id: result.data.id,
        title: result.data.title,
        messageCount: 0,
        lastActivity: new Date(result.data.updatedAt),
        createdAt: new Date(result.data.createdAt),
        updatedAt: new Date(result.data.updatedAt),
      };

      set((state) => ({
        sessions: [newSession, ...state.sessions],
        currentSessionId: newSession.id,
        isLoading: false,
      }));

      return newSession.id;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Failed to create session:', error);
      throw error;
    }
  },

  // Update session title
  updateSession: async (sessionId: string, title: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to update session');
      }

      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? { ...session, title, updatedAt: new Date() } : session
        ),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Failed to update session:', error);
      throw error;
    }
  },

  // Delete session permanently
  deleteSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to delete session');
      }

      set((state) => ({
        sessions: state.sessions.filter((session) => session.id !== sessionId),
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Failed to delete session:', error);
      throw error;
    }
  },

  // Clear history (delete messages + checkpoint, keep session)
  clearHistory: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Clear messages
      const messagesResponse = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'DELETE',
      });

      if (!messagesResponse.ok) {
        const result = await messagesResponse.json();
        throw new Error(result.error?.message || 'Failed to clear messages');
      }

      // Clear checkpoint
      const checkpointResponse = await fetch(`/api/sessions/${sessionId}/checkpoint`, {
        method: 'DELETE',
      });

      if (!checkpointResponse.ok) {
        const result = await checkpointResponse.json();
        throw new Error(result.error?.message || 'Failed to clear checkpoint');
      }

      // Update session metadata (messageCount = 0, lastActivity = now)
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, messageCount: 0, lastActivity: new Date(), updatedAt: new Date() }
            : session
        ),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Failed to clear history:', error);
      throw error;
    }
  },

  // Set current session ID
  setCurrentSessionId: (sessionId: string | null) => {
    set({ currentSessionId: sessionId });
  },

  // Set error
  setError: (error: string | null) => {
    set({ error });
  },
}));
