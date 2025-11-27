# Layer 6.6: Trace Observability

> LangSmith-inspired debug panel with comprehensive execution tracing, working memory visualization, and system prompt inspection

## Overview

The Trace Observability layer provides deep visibility into agent execution through a structured timeline of events. Unlike the basic execution logs in Layer 6.5, this enhanced debug panel captures every significant event—tool calls, memory updates, retries, checkpoints—and presents them in a filterable, searchable interface inspired by LangSmith's tracing capabilities.

**Key Responsibilities:**

-   Capture and display 23 distinct trace entry types
-   Track tool call durations and calculate metrics
-   Visualize working memory entities in real-time
-   Enable system prompt inspection for debugging
-   Provide filtering, search, and export capabilities
-   Support multiple trace sessions with selector

---

## The Problem

Without comprehensive trace observability:

```typescript
// WRONG: Basic logs miss critical events
console.log("Tool called");  // No timing, no structure

// WRONG: Working memory is invisible
workingContext.track(entity);  // What's in memory now?

// WRONG: System prompt changes are hidden
systemPrompt = compilePrompt();  // What did the LLM actually receive?

// WRONG: No way to correlate events
tool1.call(); tool2.call();  // Which took longer? Why did retry happen?

// WRONG: No export for debugging
// Can't share execution trace with team
```

**Our Solution:**

1. Structured trace entries with 23 event types
2. Zustand store with entries grouped by traceId
3. Automatic duration tracking for tool calls
4. Working memory panel showing tracked entities
5. System prompt viewer for prompt inspection
6. Filter by type groups, levels, and search
7. JSON export and clipboard copy

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Server)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ Orchestrator │───▶│   Logger     │───▶│  SSE Stream  │                   │
│  │              │    │  (context)   │    │   (events)   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         │            Emits structured          │                            │
│         │            log messages              │                            │
│         ▼                   ▼                   ▼                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  AI SDK v6   │    │ tool-call    │    │ system-prompt│                   │
│  │  Events      │    │ tool-result  │    │ log events   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                              SSE Stream
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FRONTEND (Client)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                          use-agent Hook                               │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────────┐ │   │
│  │  │ SSE Parser  │──▶│   Pattern   │──▶│      Trace Store            │ │   │
│  │  │             │   │  Detection  │   │  (Zustand)                  │ │   │
│  │  └─────────────┘   └─────────────┘   └─────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Enhanced Debug Panel                             │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────┐  │   │
│  │  │  Header   │  │  Filters  │  │  Timeline │  │  Working Memory   │  │   │
│  │  │  Metrics  │  │  & Search │  │  Entries  │  │  Panel            │  │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────────────┘  │   │
│  │                        │                                              │   │
│  │                        ▼                                              │   │
│  │              ┌─────────────────────┐                                  │   │
│  │              │   Detail Modal      │                                  │   │
│  │              │   (Full JSON View)  │                                  │   │
│  │              └─────────────────────┘                                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                                                   | Purpose                           |
| ------------------------------------------------------ | --------------------------------- |
| `app/assistant/_stores/trace-store.ts`                 | Zustand store for trace entries   |
| `app/assistant/_components/enhanced-debug/index.tsx`   | Main debug panel container        |
| `app/assistant/_components/enhanced-debug/trace-header.tsx` | Metrics display, trace selector |
| `app/assistant/_components/enhanced-debug/trace-filters.tsx` | Type/level filters, search     |
| `app/assistant/_components/enhanced-debug/trace-timeline.tsx` | Entry list with scroll       |
| `app/assistant/_components/enhanced-debug/timeline-entry.tsx` | Individual entry component   |
| `app/assistant/_components/enhanced-debug/working-memory-panel.tsx` | Entity visualization   |
| `app/assistant/_components/enhanced-debug/json-viewer.tsx` | Collapsible JSON display       |
| `app/assistant/_hooks/use-agent.ts`                    | SSE parsing, pattern detection    |
| `server/agent/orchestrator.ts`                         | system-prompt emission            |

---

## Core Implementation

### Trace Entry Types

```typescript
// app/assistant/_stores/trace-store.ts
export type TraceEntryType =
  | 'trace-start'           // Trace initialization
  | 'prompt-sent'           // User prompt to LLM
  | 'llm-response'          // LLM response received
  | 'tool-call'             // Tool invocation with args
  | 'tool-result'           // Tool execution result
  | 'tool-error'            // Tool execution failed
  | 'step-complete'         // Agent step completed
  | 'approval-request'      // HITL approval needed
  | 'approval-response'     // HITL decision made
  | 'confirmation-required' // Tool confirmation flag pattern
  | 'job-queued'            // Background job queued
  | 'job-progress'          // Job progress update
  | 'job-complete'          // Job finished
  | 'job-failed'            // Job failed
  | 'trace-complete'        // Trace finished
  | 'error'                 // General error
  | 'working-memory-update' // Entity extraction
  | 'memory-trimmed'        // Message history trimmed
  | 'checkpoint-saved'      // Session checkpoint
  | 'retry-attempt'         // Retry with backoff
  | 'session-loaded'        // Previous messages loaded
  | 'system-log'            // General backend log
  | 'system-prompt';        // Compiled system prompt
```

### Trace Entry Structure

```typescript
export interface TraceEntry {
  id: string;
  traceId: string;
  parentId?: string;
  timestamp: number;
  duration?: number;

  type: TraceEntryType;
  level: 'debug' | 'info' | 'warn' | 'error';

  stepNumber?: number;
  toolName?: string;
  toolCallId?: string;

  summary: string;
  input?: unknown;
  output?: unknown;

  tokens?: { input: number; output: number };
  error?: { message: string; stack?: string };

  jobId?: string;
  jobProgress?: number;
}
```

### Trace Store

```typescript
// app/assistant/_stores/trace-store.ts
export const useTraceStore = create<TraceState>((set, get) => ({
  entriesByTrace: new Map(),
  allTraceIds: [],
  activeTraceId: null,
  pendingTimings: new Map(),
  filters: DEFAULT_FILTERS,

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

      // Track timing for duration calculation
      const newPendingTimings = new Map(state.pendingTimings);
      if (fullEntry.type === 'tool-call' || fullEntry.type === 'job-queued') {
        newPendingTimings.set(
          fullEntry.toolCallId || fullEntry.jobId || id,
          fullEntry.timestamp
        );
      }

      return {
        entriesByTrace: newEntriesByTrace,
        allTraceIds: state.allTraceIds.includes(fullEntry.traceId)
          ? state.allTraceIds
          : [...state.allTraceIds, fullEntry.traceId],
        activeTraceId: state.activeTraceId || fullEntry.traceId,
        pendingTimings: newPendingTimings,
      };
    });
  },

  completeEntry: (id, output, error) => {
    const state = get();
    const startTime = state.pendingTimings.get(id);
    const duration = startTime ? Date.now() - startTime : undefined;

    // Update entry with duration and output
    // ...
  },

  getFilteredEntries: () => {
    const state = get();
    const entries = state.entriesByTrace.get(state.activeTraceId || '') || [];

    return entries.filter((entry) => {
      if (state.filters.types.length > 0 && !state.filters.types.includes(entry.type)) {
        return false;
      }
      if (state.filters.levels.length > 0 && !state.filters.levels.includes(entry.level)) {
        return false;
      }
      if (!state.filters.showJobEvents && entry.type.startsWith('job-')) {
        return false;
      }
      if (state.filters.searchQuery) {
        const query = state.filters.searchQuery.toLowerCase();
        const searchable = [entry.summary, entry.toolName, JSON.stringify(entry.input), JSON.stringify(entry.output)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
  },

  getMetrics: () => {
    const entries = get().entriesByTrace.get(get().activeTraceId || '') || [];
    return {
      totalDuration: entries.length > 1 ? entries[entries.length - 1].timestamp - entries[0].timestamp : 0,
      toolCallCount: entries.filter(e => e.type === 'tool-call').length,
      stepCount: entries.filter(e => e.type === 'step-complete').length,
      tokens: entries.reduce((acc, e) => ({
        input: acc.input + (e.tokens?.input || 0),
        output: acc.output + (e.tokens?.output || 0),
      }), { input: 0, output: 0 }),
      errorCount: entries.filter(e => ['error', 'tool-error', 'job-failed'].includes(e.type)).length,
    };
  },
}));
```

### Log Pattern Detection

```typescript
// app/assistant/_hooks/use-agent.ts
case 'log': {
  const { message, metadata, level } = data;

  // Detect working memory update
  if (message.includes('Extracted entities to working memory')) {
    addEntry({
      traceId: currentTraceId,
      timestamp: Date.now(),
      type: 'working-memory-update',
      level: 'info',
      summary: `Working memory: +${metadata.entityCount || 0} entities`,
      input: metadata,
    });
  }
  // Detect memory trimming
  else if (message.includes('Trimming message history')) {
    addEntry({
      traceId: currentTraceId,
      timestamp: Date.now(),
      type: 'memory-trimmed',
      level: 'warn',
      summary: `Trimmed messages: ${metadata.originalCount} → ${metadata.newCount}`,
      input: metadata,
    });
  }
  // Detect checkpoint
  else if (message.includes('Checkpoint saved')) {
    addEntry({
      traceId: currentTraceId,
      timestamp: Date.now(),
      type: 'checkpoint-saved',
      level: 'info',
      summary: `Checkpoint at step ${metadata.stepNumber || '?'}`,
      input: metadata,
    });
  }
  // ...more patterns
  break;
}

case 'system-prompt': {
  addEntry({
    traceId: currentTraceId,
    timestamp: Date.now(),
    type: 'system-prompt',
    level: 'info',
    summary: `System prompt (${data.promptLength?.toLocaleString() || '?'} chars)`,
    output: data.prompt,
    input: {
      workingMemory: data.workingMemory,
      promptLength: data.promptLength,
    },
  });
  break;
}
```

### System Prompt Emission

```typescript
// server/agent/orchestrator.ts
// After prompt compilation, emit to stream
if (context.stream) {
  context.stream.write({
    type: "system-prompt",
    prompt: systemPrompt,
    promptLength: systemPrompt.length,
    workingMemory: workingContext.toContextString(),
    timestamp: new Date().toISOString(),
  });
}
```

---

## Filter System

### Type Groups

```typescript
const TYPE_GROUPS = {
  'LLM': ['system-prompt', 'prompt-sent', 'llm-response'],
  'Tools': ['tool-call', 'tool-result', 'tool-error', 'confirmation-required'],
  'Flow': ['trace-start', 'step-complete', 'trace-complete'],
  'Memory': ['working-memory-update', 'memory-trimmed', 'session-loaded', 'checkpoint-saved'],
  'Approval': ['approval-request', 'approval-response'],
  'Jobs': ['job-queued', 'job-progress', 'job-complete', 'job-failed'],
  'System': ['system-log', 'retry-attempt', 'error'],
};
```

### Level Filters

| Level   | Color         | Use Case                    |
| ------- | ------------- | --------------------------- |
| `debug` | Gray          | Detailed diagnostic info    |
| `info`  | Blue          | Normal operation events     |
| `warn`  | Yellow        | Potential issues            |
| `error` | Red           | Failures and exceptions     |

---

## Color Scheme

### Entry Type Colors

```typescript
const ENTRY_TYPE_COLORS: Record<TraceEntryType, string> = {
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
  'working-memory-update': 'bg-teal-500',
  'memory-trimmed': 'bg-gray-500',
  'checkpoint-saved': 'bg-sky-500',
  'retry-attempt': 'bg-yellow-600',
  'session-loaded': 'bg-violet-500',
  'system-log': 'bg-gray-400',
  'system-prompt': 'bg-pink-500',
};
```

---

## Design Decisions

### Why Zustand with Map?

```typescript
entriesByTrace: Map<string, TraceEntry[]>
```

**Reasons:**

1. **O(1) lookup** - Fast access by traceId
2. **Multiple traces** - Support switching between sessions
3. **Memory efficient** - Only active trace in memory
4. **Natural grouping** - Each trace is isolated

### Why Pattern Detection?

```typescript
if (message.includes('Extracted entities to working memory')) {
  // Create structured trace entry
}
```

**Reasons:**

1. **Backend simplicity** - Log normally, frontend interprets
2. **Backwards compatible** - Existing logs work without changes
3. **Rich metadata** - Extract structured data from log metadata
4. **Flexible** - Add new patterns without backend changes

### Why System Prompt Inspection?

```typescript
type: 'system-prompt',
output: data.prompt,  // Full system prompt
```

**Reasons:**

1. **Prompt debugging** - See exactly what LLM received
2. **Working memory verification** - Confirm entities in context
3. **Template inspection** - Verify prompt compilation
4. **Length tracking** - Monitor token usage

### Why Separate from Basic Logs?

Layer 6.5 handles HITL approval and basic execution logs. This layer (6.6) provides:

1. **23 trace types** vs 6 log types
2. **Duration tracking** with start/end correlation
3. **Working memory visualization**
4. **System prompt inspection**
5. **Multi-trace session support**
6. **Advanced filtering and search**
7. **Export capabilities**

---

## Component Hierarchy

```
EnhancedDebugPanel
├── TraceHeader
│   ├── Metrics display (duration, tools, steps, tokens, errors)
│   ├── Trace selector dropdown
│   └── Action buttons (copy, export, clear)
├── TraceFilters (compact mode)
│   ├── Search input
│   ├── Quick type badges
│   └── Job toggle
├── WorkingMemoryPanel (collapsible)
│   ├── Entity count summary
│   └── Grouped entity badges by type
├── TraceTimeline
│   └── TimelineEntry (for each entry)
│       ├── Timestamp
│       ├── Type badge with icon
│       ├── Duration badge
│       ├── Tool name
│       ├── Summary
│       └── Collapsible input/output JSON
└── TraceDetailModal
    ├── Full entry details
    └── JsonViewer with syntax highlighting
```

---

## Export Features

### Copy All Logs

```typescript
const logText = entries.map((e) => {
  const time = new Date(e.timestamp).toISOString();
  const duration = e.duration ? ` (${e.duration}ms)` : '';
  const tool = e.toolName ? ` [${e.toolName}]` : '';
  return `[${time}] [${e.type}]${tool}${duration}\n  ${e.summary}`;
}).join('\n\n');

await navigator.clipboard.writeText(logText);
```

### Export JSON

```typescript
const exportData = {
  traceId,
  exportedAt: new Date().toISOString(),
  metrics: getMetrics(),
  entries: entries.map((e) => ({
    ...e,
    timestamp: new Date(e.timestamp).toISOString(),
  })),
};

return JSON.stringify(exportData, null, 2);
```

---

## Integration Points

| Connects To                  | How                                  |
| ---------------------------- | ------------------------------------ |
| Layer 3.1 (ReAct Loop)       | Emits step events, system prompt     |
| Layer 3.3 (Working Memory)   | Entity tracking visualization        |
| Layer 5.4 (Job Processors)   | Job status events                    |
| Layer 6.1 (State Management) | trace-store alongside other stores   |
| Layer 6.2 (SSE Streaming)    | All events flow through SSE          |
| Layer 6.5 (HITL UI)          | Approval events in timeline          |

---

## Usage Examples

### Debugging a Tool Call

1. Send message: "List all pages"
2. Observe timeline:
   - `trace-start` - Trace begins
   - `system-prompt` - Click to view compiled prompt
   - `prompt-sent` - User message sent
   - `tool-call` - `cms_listPages` called (amber badge)
   - `tool-result` - Results returned (green badge, click to expand)
   - `llm-response` - Agent response
   - `trace-complete` - Trace finished

### Debugging Memory Issues

1. Filter by "Memory" type group
2. Look for:
   - `working-memory-update` - Entities being tracked
   - `memory-trimmed` - History being cut (potential context loss)
   - `session-loaded` - Previous conversation restored
   - `checkpoint-saved` - State persistence events

### Debugging Errors

1. Filter by "error" level
2. Expand error entries to see:
   - Error message
   - Stack trace
   - Context (tool name, step number)
3. Export trace JSON for deeper analysis

---

## Common Issues / Debugging

### Working Memory Not Showing

```
// Entities tracked but panel empty
```

**Cause:** working-memory-update entries not being created.

**Debug:**

```typescript
// Check use-agent.ts pattern detection
console.log('Log message:', message);
console.log('Has metadata:', metadata);
```

### System Prompt Missing

```
// No system-prompt entry in timeline
```

**Cause:** Backend not emitting system-prompt event.

**Debug:**

```typescript
// In orchestrator.ts
console.log('Emitting system prompt, length:', systemPrompt.length);
context.stream.write({ type: 'system-prompt', ... });
```

### Duration Not Calculated

```
// Tool call shows no duration
```

**Cause:** toolCallId mismatch between tool-call and tool-result.

**Debug:**

```typescript
console.log('Tool call ID:', toolCallId);
console.log('Pending timings:', pendingTimings);
```

### Filter Not Applied

```
// All entries showing despite filter
```

**Cause:** Filter state not updating or getFilteredEntries not being called.

**Debug:**

```typescript
console.log('Filters:', useTraceStore.getState().filters);
console.log('Filtered count:', useTraceStore.getState().getFilteredEntries().length);
```

---

## Performance Considerations

- Entries stored in Map for O(1) lookup by traceId
- Filtering computed via `getFilteredEntries()` selector
- Large payloads collapsed by default in timeline
- Modal used for viewing large JSON instead of inline expansion
- Clear trace option to free memory on long sessions
- Virtual scrolling possible for very long traces (future)

---

## Further Reading

-   [Layer 3.1: ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Agent execution flow
-   [Layer 3.3: Working Memory](./LAYER_3.3_WORKING_MEMORY.md) - Entity tracking backend
-   [Layer 6.1: State Management](./LAYER_6.1_STATE_MANAGEMENT.md) - Zustand stores
-   [Layer 6.2: SSE Streaming](./LAYER_6.2_SSE_STREAMING.md) - Event streaming
-   [Layer 6.5: HITL UI](./LAYER_6.5_HITL_UI.md) - Approval modal
-   [DEBUG_LOGGING_SYSTEM.md](../development/DEBUG_LOGGING_SYSTEM.md) - Detailed technical reference
-   [LangSmith Tracing](https://docs.smith.langchain.com/) - Inspiration source
