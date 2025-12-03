'use client';

import { create } from 'zustand';
import { sessionsApi } from '@/lib/api';
import type { SessionMetadata, Session } from '@/lib/api';

// Re-export types for backward compatibility
export type { SessionMetadata, Session } from '@/lib/api';

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
      const sessions = await sessionsApi.list();
      set({ sessions, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load sessions';
      set({ error: message, isLoading: false });
      console.error('Failed to load sessions:', error);
    }
  },

  // Load single session with messages
  loadSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await sessionsApi.get(sessionId);
      set({ isLoading: false, currentSessionId: sessionId });
      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load session';
      set({ error: message, isLoading: false });
      console.error('Failed to load session:', error);
      return null;
    }
  },

  // Create new session
  createSession: async (title?: string) => {
    set({ isLoading: true, error: null });
    try {
      const newSession = await sessionsApi.create({ title });

      set((state) => ({
        sessions: [newSession, ...state.sessions],
        currentSessionId: newSession.id,
        isLoading: false,
      }));

      return newSession.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create session';
      set({ error: message, isLoading: false });
      console.error('Failed to create session:', error);
      throw error;
    }
  },

  // Update session title
  updateSession: async (sessionId: string, title: string) => {
    set({ isLoading: true, error: null });
    try {
      await sessionsApi.update(sessionId, { title });

      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? { ...session, title, updatedAt: new Date() } : session
        ),
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update session';
      set({ error: message, isLoading: false });
      console.error('Failed to update session:', error);
      throw error;
    }
  },

  // Update session model
  updateSessionModel: async (sessionId: string, modelId: string) => {
    try {
      await sessionsApi.update(sessionId, { modelId });

      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? { ...session, modelId, updatedAt: new Date() } : session
        ),
      }));
    } catch (error) {
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
      await sessionsApi.remove(sessionId);

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
          const newSession = await sessionsApi.create({ title: 'New Session' });

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete session';
      set({ error: message, isLoading: false });
      console.error('Failed to delete session:', error);
      throw error;
    }
  },

  // Clear history (delete messages, keep session)
  clearHistory: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      await sessionsApi.clearMessages(sessionId);

      // Update session metadata (messageCount = 0, lastActivity = now)
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, messageCount: 0, lastActivity: new Date(), updatedAt: new Date() }
            : session
        ),
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear history';
      set({ error: message, isLoading: false });
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
