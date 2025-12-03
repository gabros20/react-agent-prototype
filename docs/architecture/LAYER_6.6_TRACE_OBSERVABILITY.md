# Layer 6.6: Trace Observability

> LangSmith-inspired debug panel with comprehensive execution tracing, working memory visualization, and system prompt inspection
>
> **Updated**: 2025-12-03

## Overview

The Trace Observability layer provides deep visibility into agent execution through a structured timeline of events. Unlike the basic execution logs in Layer 6.5, this enhanced debug panel captures every significant event—tool calls, memory updates, retries, checkpoints—and presents them in a filterable, searchable interface inspired by LangSmith's tracing capabilities.

**Key Responsibilities:**

-   Capture and display 26 distinct trace entry types
-   Track tool call durations and calculate metrics (including cost)
-   Persist conversation logs to backend for session history
-   Visualize working memory entities in real-time
-   Enable system prompt inspection for debugging
-   Provide filtering, search, and export capabilities
-   Support multiple trace sessions with selector
-   Aggregate metrics across all conversations in session

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
| `app/assistant/_stores/trace-store.ts`                 | Zustand store for trace entries + conversation logs |
| `app/assistant/_components/enhanced-debug/`            | Enhanced debug panel components   |
| `app/assistant/_hooks/use-agent.ts`                    | SSE parsing, pattern detection, trace entry creation |
| `lib/debug-logger/`                                    | Debug logger abstraction (trace-logger, hooks) |
| `server/services/agent/orchestrator.ts`                | Agent orchestrator, SSE emission |
| `server/services/conversation-log-service.ts`          | Conversation log persistence |
| `server/services/worker-events.service.ts`             | Redis pub/sub for worker events   |

---

## Core Implementation

### Trace Entry Types

```typescript
// app/assistant/_stores/trace-store.ts
export type TraceEntryType =
  // Trace lifecycle
  | "trace-start"           // Trace initialization

  // LLM interaction
  | "system-prompt"         // Compiled system prompt (for inspection)
  | "user-prompt"           // User prompt with token count
  | "prompt-sent"           // User prompt to LLM
  | "llm-response"          // LLM response received
  | "text-streaming"        // LLM generating text - updated in place
  | "tools-available"       // List of tools passed to agent
  | "model-info"            // Model ID and pricing info

  // Tool execution (tool-call is updated in-place with output/error)
  | "tool-call"             // Tool invocation - updated with output when complete

  // Agent steps
  | "step-start"            // Step starting
  | "step-complete"         // Agent step completed

  // HITL (conversational pattern)
  | "approval-request"      // HITL approval needed
  | "approval-response"     // HITL decision made
  | "confirmation-required" // Tool returned requiresConfirmation flag

  // Background jobs
  | "job-queued"            // Background job queued
  | "job-progress"          // Job progress update
  | "job-complete"          // Job finished
  | "job-failed"            // Job failed

  // Memory and session
  | "working-memory-update" // Entity extraction happened
  | "memory-trimmed"        // Message history was trimmed
  | "session-loaded"        // Previous messages loaded
  | "checkpoint-saved"      // Session checkpoint saved

  // System
  | "system-log"            // General log from backend
  | "retry-attempt"         // Retry with backoff
  | "error";                // General error

// Tool results/errors update the existing tool-call entry via completeEntry()
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

### Conversation Log

Persisted exchange history with metrics for session-level aggregation:

```typescript
export interface ConversationLog {
  id: string;                // Same as traceId
  sessionId: string;
  conversationIndex: number; // 1-indexed within session
  userPrompt: string;        // Original user message
  startedAt: Date;
  completedAt: Date | null;
  metrics: TraceMetrics | null;
  modelInfo: { modelId: string; pricing: ModelPricing | null } | null;
  entries: TraceEntry[];     // All trace entries for this exchange
  isLive?: boolean;          // True if currently streaming
}

export interface TraceMetrics {
  totalDuration: number;
  toolCallCount: number;
  stepCount: number;
  tokens: { input: number; output: number };
  cost: number;              // Calculated from model pricing
  errorCount: number;
}

export interface ModelPricing {
  prompt: number;            // $ per million tokens
  completion: number;        // $ per million tokens
}
```

**Key Additions:**
- Conversation logs are saved to backend via `/api/sessions/:id/logs` on trace completion
- `getTotalMetrics()` aggregates metrics across all conversation logs
- `getTotalEventCount()` counts total events in session
- Logs can be expanded/collapsed in UI via `expandedConversationIds`
- Completion detected via `completedAt !== null` on ConversationLog
- UI shows a completion footer with duration and cost

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
  'LLM': ['system-prompt', 'user-prompt', 'prompt-sent', 'llm-response', 'text-streaming', 'model-info', 'tools-available'],
  'Tools': ['tool-call', 'confirmation-required'],
  'Flow': ['trace-start', 'step-start', 'step-complete'],
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
  // Trace lifecycle
  "trace-start": "bg-slate-500",

  // LLM interaction
  "system-prompt": "bg-pink-500",
  "user-prompt": "bg-blue-600",
  "prompt-sent": "bg-blue-500",
  "llm-response": "bg-indigo-500",
  "text-streaming": "bg-violet-500",
  "tools-available": "bg-amber-600",
  "model-info": "bg-cyan-600",

  // Tool execution
  "tool-call": "bg-amber-500",        // Updated in-place with output/error

  // Agent steps
  "step-start": "bg-emerald-500",
  "step-complete": "bg-emerald-500",

  // HITL
  "approval-request": "bg-orange-500",
  "approval-response": "bg-cyan-500",
  "confirmation-required": "bg-orange-400",

  // Background jobs
  "job-queued": "bg-yellow-500",
  "job-progress": "bg-blue-400",
  "job-complete": "bg-emerald-500",
  "job-failed": "bg-rose-500",

  // Memory and session
  "working-memory-update": "bg-teal-500",
  "memory-trimmed": "bg-gray-500",
  "session-loaded": "bg-violet-500",
  "checkpoint-saved": "bg-sky-500",

  // System
  "system-log": "bg-gray-400",
  "retry-attempt": "bg-yellow-600",
  "error": "bg-red-600",
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

1. **26 trace types** vs 6 log types
2. **Duration tracking** with start/end correlation
3. **Working memory visualization**
4. **System prompt inspection**
5. **Multi-trace session support**
6. **Advanced filtering and search**
7. **Export capabilities**
8. **Conversation log persistence** to backend
9. **Cost tracking** via model pricing
10. **Session-level metrics aggregation**

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
├── ConversationAccordion
│   └── ConversationSection (for each conversation)
│       ├── Header (prompt, stats badges)
│       ├── TimelineEntry (for each entry)
│       │   ├── Timestamp
│       │   ├── Type badge with icon
│       │   ├── Duration badge
│       │   ├── Tool name
│       │   ├── Summary
│       │   └── Collapsible input/output JSON
│       └── CompletionFooter (when completedAt is set)
│           ├── CheckCircle2 icon
│           ├── "Completed in Xms"
│           └── Cost display (optional)
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
| Layer 5.1 (Redis Connection) | Worker events pub/sub channel        |
| Layer 5.3 (Worker Lifecycle) | Publishes job lifecycle events       |
| Layer 5.4 (Job Processors)   | Job status events                    |
| Layer 6.1 (State Management) | trace-store alongside other stores   |
| Layer 6.2 (SSE Streaming)    | Agent + worker events flow via SSE   |
| Layer 6.5 (HITL UI)          | Approval events in timeline          |

---

## Usage Examples

### Debugging a Tool Call

1. Send message: "List all pages"
2. Observe timeline:
   - `trace-start` - Trace begins
   - `system-prompt` - Click to view compiled prompt
   - `user-prompt` - User message with token count
   - `tool-call` - `cms_listPages` called (amber badge)
   - Tool result updates the tool-call entry (green checkmark when complete)
   - `llm-response` - Agent response with token counts
   - ✓ Completion footer - "Completed in 1.2s • $0.0012" (shown when `completedAt` is set)

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

## Worker Events Streaming

Background job events (image processing) are streamed to the debug panel via a dedicated Redis pub/sub → SSE pipeline. This allows real-time visibility into worker activity even though workers run in a separate process.

### Architecture

```
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│   Worker Process    │      │    Main Server      │      │      Browser        │
│                     │      │                     │      │                     │
│  BullMQ Worker      │      │  Redis Subscriber   │      │  EventSource        │
│  ├─ on('active')    │      │  ├─ on('message')   │      │  ├─ worker-event    │
│  ├─ on('completed') │─────▶│  └─ forward to SSE  │─────▶│  └─ addEntry()      │
│  └─ on('failed')    │      │                     │      │                     │
│                     │      │  /v1/worker-events  │      │  useWorkerEvents()  │
│  WorkerEventPublisher      │  /stream            │      │                     │
└─────────────────────┘      └─────────────────────┘      └─────────────────────┘
        │                              │
        │     Redis Pub/Sub            │
        └───── worker:events ──────────┘
```

### Key Files

| File                                           | Purpose                              |
| ---------------------------------------------- | ------------------------------------ |
| `server/services/worker-events.service.ts`     | Redis pub/sub publisher/subscriber   |
| `server/routes/worker-events.ts`               | SSE endpoint for worker events       |
| `server/workers/image-worker.ts`               | Publishes job lifecycle events       |
| `server/queues/image-queue.ts`                 | Publishes job-queued events          |
| `app/assistant/_hooks/use-worker-events.ts`    | SSE consumer, adds to trace store    |

### Event Flow

```typescript
// 1. Worker publishes event via Redis
await eventPublisher.jobCompleted(jobId, 'generate-metadata', imageId, duration);

// 2. Publisher sends to Redis channel
await redis.publish('worker:events', JSON.stringify(event));

// 3. Main server subscriber receives event
subscriber.on('message', (channel, message) => {
  const event = JSON.parse(message);
  this.emit('event', event);
});

// 4. SSE route forwards to connected clients
eventSource.addEventListener('worker-event', (e) => {
  const event = JSON.parse(e.data);
  handleWorkerEvent(event);
});

// 5. Frontend adds to trace store
addEntry({
  traceId,
  type: 'job-complete',
  summary: `✅ Completed: ${jobName} for ${imageId}... in ${duration}ms`,
});
```

### Worker Event Types

| Event Type      | Trigger                      | Summary Example                                      |
| --------------- | ---------------------------- | ---------------------------------------------------- |
| `job-queued`    | Job added to queue           | 📥 Queued: generate-metadata for abc123... (3 in queue) |
| `job-active`    | Worker starts processing     | ⚙️ Processing: generate-metadata for abc123... (attempt 1/3) |
| `job-progress`  | Progress update (throttled)  | ⏳ generate-metadata: 50% for abc123...              |
| `job-completed` | Job finished successfully    | ✅ Completed: generate-metadata for abc123... in 2500ms |
| `job-failed`    | Job failed                   | ❌ Failed: generate-metadata for abc123... (attempt 2/3) |

### Progress Throttling

To avoid flooding the SSE stream, progress events are throttled:

```typescript
// Only publish every 500ms or at milestones (10%, 50%, 90%, 100%)
const isMilestone = [10, 50, 90, 100].includes(progress);
if (isMilestone || now - lastPublish > 500) {
  await eventPublisher.jobProgress(jobId, jobName, imageId, progress);
}
```

### Connection Management

The `useWorkerEvents` hook manages the SSE connection lifecycle:

```typescript
// Connect on mount
useEffect(() => {
  connect();
  return () => disconnect();
}, []);

// Reconnect with exponential backoff on disconnect
const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
setTimeout(connect, delay);
```

### Initial Queue Status

When a client connects, they receive current queue status:

```typescript
// Server sends on connection
writeSSE('connected', {
  queueStatus: {
    waiting: waitingCount,
    active: activeCount,
    completed: completedCount,
    failed: failedCount,
  },
});
```

---

## Further Reading

-   [Layer 3.1: ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Agent execution flow
-   [Layer 3.3: Working Memory](./LAYER_3.3_WORKING_MEMORY.md) - Entity tracking backend
-   [Layer 6.1: State Management](./LAYER_6.1_STATE_MANAGEMENT.md) - Zustand stores
-   [Layer 6.2: SSE Streaming](./LAYER_6.2_SSE_STREAMING.md) - Event streaming
-   [Layer 6.5: HITL UI](./LAYER_6.5_HITL_UI.md) - Approval modal
-   [DEBUG_LOGGING_SYSTEM.md](../development/DEBUG_LOGGING_SYSTEM.md) - Detailed technical reference
-   [LangSmith Tracing](https://docs.smith.langchain.com/) - Inspiration source
