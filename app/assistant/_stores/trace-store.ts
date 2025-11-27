'use client';

import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export type TraceEntryType =
  | 'trace-start'
  | 'prompt-sent'
  | 'llm-response'
  | 'tool-call'
  | 'tool-result'
  | 'tool-error'
  | 'step-complete'
  | 'approval-request'
  | 'approval-response'
  | 'confirmation-required' // Tool asks for confirmation (confirmed flag pattern)
  | 'job-queued'
  | 'job-progress'
  | 'job-complete'
  | 'job-failed'
  | 'trace-complete'
  | 'error'
  // New types for comprehensive debugging
  | 'working-memory-update'  // Entity extraction happened
  | 'memory-trimmed'         // Message history was trimmed
  | 'checkpoint-saved'       // Session checkpoint saved
  | 'retry-attempt'          // Retry with backoff
  | 'session-loaded'         // Previous messages loaded
  | 'system-log'             // General log from backend
  | 'system-prompt';         // Compiled system prompt (for inspection)

export type TraceLevel = 'debug' | 'info' | 'warn' | 'error';

export interface TraceEntry {
  id: string;
  traceId: string;
  parentId?: string;
  timestamp: number;
  duration?: number;

  type: TraceEntryType;
  level: TraceLevel;

  stepNumber?: number;
  toolName?: string;
  toolCallId?: string;

  summary: string;
  input?: unknown;
  output?: unknown;

  tokens?: { input: number; output: number };
  error?: { message: string; stack?: string };

  // Job-specific fields
  jobId?: string;
  jobProgress?: number;
}

export interface TraceFilters {
  types: TraceEntryType[];
  levels: TraceLevel[];
  searchQuery: string;
  showJobEvents: boolean;
}

export interface TraceMetrics {
  totalDuration: number;
  toolCallCount: number;
  stepCount: number;
  tokens: { input: number; output: number };
  errorCount: number;
}

// ============================================================================
// Store
// ============================================================================

interface TraceState {
  // Entries grouped by traceId
  entriesByTrace: Map<string, TraceEntry[]>;
  allTraceIds: string[];
  activeTraceId: string | null;

  // Timing tracking for duration calculation
  pendingTimings: Map<string, number>; // id -> startTime

  // Filters
  filters: TraceFilters;

  // UI state
  selectedEntryId: string | null;
  isModalOpen: boolean;
  modalEntry: TraceEntry | null;

  // Actions
  addEntry: (entry: Omit<TraceEntry, 'id'> & { id?: string }) => void;
  updateEntry: (id: string, updates: Partial<TraceEntry>) => void;
  completeEntry: (id: string, output?: unknown, error?: TraceEntry['error']) => void;
  setActiveTrace: (traceId: string | null) => void;
  setFilters: (filters: Partial<TraceFilters>) => void;
  setSelectedEntry: (id: string | null) => void;
  openModal: (entry: TraceEntry) => void;
  closeModal: () => void;
  clearTrace: (traceId?: string) => void;
  clearAllTraces: () => void;

  // Export utilities
  exportTrace: (traceId: string) => string;
  copyAllLogs: () => Promise<void>;
  getFilteredEntries: () => TraceEntry[];
  getMetrics: () => TraceMetrics;
}

const DEFAULT_FILTERS: TraceFilters = {
  types: [],
  levels: [],
  searchQuery: '',
  showJobEvents: true,
};

export const useTraceStore = create<TraceState>((set, get) => ({
  entriesByTrace: new Map(),
  allTraceIds: [],
  activeTraceId: null,
  pendingTimings: new Map(),
  filters: DEFAULT_FILTERS,
  selectedEntryId: null,
  isModalOpen: false,
  modalEntry: null,

  addEntry: (entry) => {
    const id = entry.id || crypto.randomUUID();
    const fullEntry: TraceEntry = {
      ...entry,
      id,
      timestamp: entry.timestamp || Date.now(),
    };

    set((state) => {
      const newEntriesByTrace = new Map(state.entriesByTrace);
      const traceEntries = newEntriesByTrace.get(fullEntry.traceId) || [];
      newEntriesByTrace.set(fullEntry.traceId, [...traceEntries, fullEntry]);

      // Track new trace IDs
      const newTraceIds = state.allTraceIds.includes(fullEntry.traceId)
        ? state.allTraceIds
        : [...state.allTraceIds, fullEntry.traceId];

      // Auto-set active trace if none set
      const activeTraceId = state.activeTraceId || fullEntry.traceId;

      // Track timing for entries that need duration calculation
      const newPendingTimings = new Map(state.pendingTimings);
      if (fullEntry.type === 'tool-call' || fullEntry.type === 'job-queued') {
        newPendingTimings.set(fullEntry.toolCallId || fullEntry.jobId || id, fullEntry.timestamp);
      }

      return {
        entriesByTrace: newEntriesByTrace,
        allTraceIds: newTraceIds,
        activeTraceId,
        pendingTimings: newPendingTimings,
      };
    });
  },

  updateEntry: (id, updates) => {
    set((state) => {
      const newEntriesByTrace = new Map(state.entriesByTrace);

      for (const [traceId, entries] of newEntriesByTrace) {
        const index = entries.findIndex((e) => e.id === id);
        if (index !== -1) {
          const updatedEntries = [...entries];
          updatedEntries[index] = { ...updatedEntries[index], ...updates };
          newEntriesByTrace.set(traceId, updatedEntries);
          break;
        }
      }

      return { entriesByTrace: newEntriesByTrace };
    });
  },

  completeEntry: (id, output, error) => {
    const state = get();
    const startTime = state.pendingTimings.get(id);
    const duration = startTime ? Date.now() - startTime : undefined;

    set((state) => {
      const newPendingTimings = new Map(state.pendingTimings);
      newPendingTimings.delete(id);

      const newEntriesByTrace = new Map(state.entriesByTrace);

      for (const [traceId, entries] of newEntriesByTrace) {
        const index = entries.findIndex(
          (e) => e.toolCallId === id || e.jobId === id || e.id === id
        );
        if (index !== -1) {
          const updatedEntries = [...entries];
          updatedEntries[index] = {
            ...updatedEntries[index],
            duration,
            output,
            error,
          };
          newEntriesByTrace.set(traceId, updatedEntries);
          break;
        }
      }

      return {
        entriesByTrace: newEntriesByTrace,
        pendingTimings: newPendingTimings,
      };
    });
  },

  setActiveTrace: (traceId) => {
    set({ activeTraceId: traceId, selectedEntryId: null });
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  setSelectedEntry: (id) => {
    set({ selectedEntryId: id });
  },

  openModal: (entry) => {
    set({ isModalOpen: true, modalEntry: entry });
  },

  closeModal: () => {
    set({ isModalOpen: false, modalEntry: null });
  },

  clearTrace: (traceId) => {
    set((state) => {
      const targetTraceId = traceId || state.activeTraceId;
      if (!targetTraceId) return state;

      const newEntriesByTrace = new Map(state.entriesByTrace);
      newEntriesByTrace.delete(targetTraceId);

      const newTraceIds = state.allTraceIds.filter((id) => id !== targetTraceId);
      const newActiveTraceId =
        state.activeTraceId === targetTraceId
          ? newTraceIds[newTraceIds.length - 1] || null
          : state.activeTraceId;

      return {
        entriesByTrace: newEntriesByTrace,
        allTraceIds: newTraceIds,
        activeTraceId: newActiveTraceId,
        selectedEntryId: null,
      };
    });
  },

  clearAllTraces: () => {
    set({
      entriesByTrace: new Map(),
      allTraceIds: [],
      activeTraceId: null,
      pendingTimings: new Map(),
      selectedEntryId: null,
      isModalOpen: false,
      modalEntry: null,
    });
  },

  exportTrace: (traceId) => {
    const state = get();
    const entries = state.entriesByTrace.get(traceId) || [];
    const metrics = get().getMetrics();

    const exportData = {
      traceId,
      exportedAt: new Date().toISOString(),
      metrics,
      entries: entries.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp).toISOString(),
      })),
    };

    return JSON.stringify(exportData, null, 2);
  },

  copyAllLogs: async () => {
    const state = get();
    const entries = state.getFilteredEntries();

    const logText = entries
      .map((e) => {
        const time = new Date(e.timestamp).toISOString();
        const duration = e.duration ? ` (${e.duration}ms)` : '';
        const tool = e.toolName ? ` [${e.toolName}]` : '';
        const inputStr = e.input ? `\n  Input: ${JSON.stringify(e.input)}` : '';
        const outputStr = e.output ? `\n  Output: ${JSON.stringify(e.output)}` : '';
        const errorStr = e.error ? `\n  Error: ${e.error.message}` : '';

        return `[${time}] [${e.type}]${tool}${duration}\n  ${e.summary}${inputStr}${outputStr}${errorStr}`;
      })
      .join('\n\n');

    await navigator.clipboard.writeText(logText);
  },

  getFilteredEntries: () => {
    const state = get();
    const entries = state.entriesByTrace.get(state.activeTraceId || '') || [];

    return entries.filter((entry) => {
      // Type filter
      if (state.filters.types.length > 0 && !state.filters.types.includes(entry.type)) {
        return false;
      }

      // Level filter
      if (state.filters.levels.length > 0 && !state.filters.levels.includes(entry.level)) {
        return false;
      }

      // Job events toggle
      if (!state.filters.showJobEvents && entry.type.startsWith('job-')) {
        return false;
      }

      // Search query
      if (state.filters.searchQuery) {
        const query = state.filters.searchQuery.toLowerCase();
        const searchable = [
          entry.summary,
          entry.toolName,
          JSON.stringify(entry.input),
          JSON.stringify(entry.output),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchable.includes(query)) {
          return false;
        }
      }

      return true;
    });
  },

  getMetrics: () => {
    const state = get();
    const entries = state.entriesByTrace.get(state.activeTraceId || '') || [];

    const metrics: TraceMetrics = {
      totalDuration: 0,
      toolCallCount: 0,
      stepCount: 0,
      tokens: { input: 0, output: 0 },
      errorCount: 0,
    };

    if (entries.length === 0) return metrics;

    // Calculate total duration from first to last entry
    const firstEntry = entries[0];
    const lastEntry = entries[entries.length - 1];
    metrics.totalDuration = lastEntry.timestamp - firstEntry.timestamp;

    for (const entry of entries) {
      if (entry.type === 'tool-call') {
        metrics.toolCallCount++;
      }
      if (entry.type === 'step-complete') {
        metrics.stepCount++;
      }
      if (entry.type === 'error' || entry.type === 'tool-error' || entry.type === 'job-failed') {
        metrics.errorCount++;
      }
      if (entry.tokens) {
        metrics.tokens.input += entry.tokens.input;
        metrics.tokens.output += entry.tokens.output;
      }
    }

    return metrics;
  },
}));

// ============================================================================
// Type guard helpers
// ============================================================================

export const ENTRY_TYPE_COLORS: Record<TraceEntryType, string> = {
  'trace-start': 'bg-slate-500',
  'prompt-sent': 'bg-blue-500',
  'llm-response': 'bg-indigo-500',
  'tool-call': 'bg-amber-500',
  'tool-result': 'bg-green-500',
  'tool-error': 'bg-red-500',
  'step-complete': 'bg-purple-500',
  'approval-request': 'bg-orange-500',
  'approval-response': 'bg-cyan-500',
  'confirmation-required': 'bg-orange-400',
  'job-queued': 'bg-yellow-500',
  'job-progress': 'bg-blue-400',
  'job-complete': 'bg-emerald-500',
  'job-failed': 'bg-rose-500',
  'trace-complete': 'bg-slate-600',
  'error': 'bg-red-600',
  // New types
  'working-memory-update': 'bg-teal-500',
  'memory-trimmed': 'bg-gray-500',
  'checkpoint-saved': 'bg-sky-500',
  'retry-attempt': 'bg-yellow-600',
  'session-loaded': 'bg-violet-500',
  'system-log': 'bg-gray-400',
  'system-prompt': 'bg-pink-500',
};

export const ENTRY_TYPE_LABELS: Record<TraceEntryType, string> = {
  'trace-start': 'Start',
  'prompt-sent': 'Prompt',
  'llm-response': 'Response',
  'tool-call': 'Tool Call',
  'tool-result': 'Result',
  'tool-error': 'Tool Error',
  'step-complete': 'Step',
  'approval-request': 'Approval',
  'approval-response': 'Approved',
  'confirmation-required': 'Confirm?',
  'job-queued': 'Job Queued',
  'job-progress': 'Progress',
  'job-complete': 'Job Done',
  'job-failed': 'Job Failed',
  'trace-complete': 'Complete',
  'error': 'Error',
  // New types
  'working-memory-update': 'Memory',
  'memory-trimmed': 'Trimmed',
  'checkpoint-saved': 'Checkpoint',
  'retry-attempt': 'Retry',
  'session-loaded': 'Session',
  'system-log': 'Log',
  'system-prompt': 'Prompt',
};

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

export function truncateJson(obj: unknown, maxLength: number = 100): string {
  const str = JSON.stringify(obj);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}
