'use client';

import { create } from 'zustand';

export interface LogEntry {
  id: string;
  traceId: string;
  stepId: string;
  timestamp: Date;
  type: 'tool-call' | 'tool-result' | 'step-complete' | 'error' | 'info' | 'system';
  toolName?: string;
  input?: unknown;
  output?: unknown;
  success?: boolean;
  message?: string;
}

interface LogState {
  logs: LogEntry[];
  filterType: LogEntry['type'] | 'all';
  addLog: (log: LogEntry) => void;
  setFilterType: (filterType: LogEntry['type'] | 'all') => void;
  clearLogs: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  filterType: 'all',
  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  setFilterType: (filterType) => set({ filterType }),
  clearLogs: () => set({ logs: [] }),
}));
