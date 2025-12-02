'use client';

import { create } from 'zustand';

export interface SessionMetadata {
  id: string;
  title: string;
  modelId: string | null;
  messageCount: number;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  title: string;
  modelId: string | null;
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
  updateSessionModel: (sessionId: string, modelId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<string | null>;
  clearHistory: (sessionId: string) => Promise<void>;
  setCurrentSessionId: (sessionId: string | null) => void;
  setError: (error: string | null) => void;
  getCurrentSessionModel: () => string | null;
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
        modelId: session.modelId || null,
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
        modelId: result.data.modelId || null,
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
        modelId: result.data.modelId || null,
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

  // Update session model
  updateSessionModel: async (sessionId: string, modelId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to update session model');
      }

      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? { ...session, modelId, updatedAt: new Date() } : session
        ),
      }));
    } catch (error: any) {
      console.error('Failed to update session model:', error);
      throw error;
    }
  },

  // Get current session model
  getCurrentSessionModel: () => {
    const state = get();
    if (!state.currentSessionId) return null;
    const session = state.sessions.find((s) => s.id === state.currentSessionId);
    return session?.modelId || null;
  },

  // Delete session permanently
  // Returns the new current session ID (either next session or newly created one)
  deleteSession: async (sessionId: string): Promise<string | null> => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to delete session');
      }

      const state = get();
      const remainingSessions = state.sessions.filter((s) => s.id !== sessionId);
      const wasCurrentSession = state.currentSessionId === sessionId;

      // Determine what session to switch to
      let newCurrentSessionId: string | null = state.currentSessionId;

      if (wasCurrentSession) {
        if (remainingSessions.length > 0) {
          // Switch to the first remaining session
          newCurrentSessionId = remainingSessions[0].id;
        } else {
          // No sessions left - create a new one
          const createResponse = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Session' }),
          });

          const createResult = await createResponse.json();

          if (!createResponse.ok) {
            throw new Error(createResult.error?.message || 'Failed to create new session');
          }

          const newSession: SessionMetadata = {
            id: createResult.data.id,
            title: createResult.data.title,
            modelId: createResult.data.modelId || null,
            messageCount: 0,
            lastActivity: new Date(createResult.data.updatedAt),
            createdAt: new Date(createResult.data.createdAt),
            updatedAt: new Date(createResult.data.updatedAt),
          };

          set({
            sessions: [newSession],
            currentSessionId: newSession.id,
            isLoading: false,
          });

          return newSession.id;
        }
      }

      set({
        sessions: remainingSessions,
        currentSessionId: newCurrentSessionId,
        isLoading: false,
      });

      return wasCurrentSession ? newCurrentSessionId : null;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Failed to delete session:', error);
      throw error;
    }
  },

  // Clear history (delete messages, keep session)
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
