# Debug Logging System

**Version**: 1.0
**Last Updated**: 2025-11-27

## Overview

The Debug Logging System provides comprehensive observability into agent execution, inspired by LangSmith's tracing capabilities. It captures every significant event during agent operation and presents them in a structured, filterable timeline.

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
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────────┐│   │
│  │  │ SSE Parser  │──▶│   Pattern   │──▶│      Trace Store            ││   │
│  │  │             │   │  Detection  │   │  (Zustand)                  ││   │
│  │  └─────────────┘   └─────────────┘   └─────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Enhanced Debug Panel                             │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────┐ │   │
│  │  │  Header   │  │  Filters  │  │  Timeline │  │  Working Memory   │ │   │
│  │  │  Metrics  │  │  & Search │  │  Entries  │  │  Panel            │ │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────────────┘ │   │
│  │                        │                                              │   │
│  │                        ▼                                              │   │
│  │              ┌─────────────────────┐                                  │   │
│  │              │   Detail Modal      │                                  │   │
│  │              │   (Full JSON View)  │                                  │   │
│  │              └─────────────────────┘                                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## SSE Event Types

### Events Emitted by Backend

| Event Type | Description | Payload |
|------------|-------------|---------|
| `log` | Backend log message | `{traceId, level, message, metadata, timestamp}` |
| `text-delta` | Streaming text chunk | `{delta, timestamp}` |
| `tool-call` | Tool invocation | `{toolName, toolCallId, args, timestamp}` |
| `tool-result` | Tool completion | `{toolName, toolCallId, result, timestamp}` |
| `system-prompt` | Compiled prompt | `{prompt, promptLength, workingMemory, timestamp}` |
| `step-completed` | Step finished | `{toolsExecuted, finishReason, timestamp}` |
| `approval-required` | HITL gate | `{approvalId, toolName, input, description, timestamp}` |
| `result` | Final response | `{traceId, sessionId, text, toolCalls, usage}` |
| `finish` | Stream finished | `{finishReason, usage, timestamp}` |
| `error` | Error occurred | `{traceId, error, stack}` |
| `done` | Connection close | `{traceId, sessionId}` |

## Trace Entry Types

### Full Type Definition

```typescript
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

### Entry Structure

```typescript
interface TraceEntry {
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

## Log Pattern Detection

The frontend parses backend log messages to create detailed trace entries:

### Detected Patterns

| Log Message Contains | Creates Entry Type | Extracted Data |
|---------------------|-------------------|----------------|
| "Extracted entities to working memory" | `working-memory-update` | entityCount, entities list, workingMemorySize |
| "Trimming message history" | `memory-trimmed` | originalCount, newCount |
| "Checkpoint saved" | `checkpoint-saved` | stepNumber |
| "Retry" | `retry-attempt` | retry count, reason |
| "Loaded session history" | `session-loaded` | messageCount |
| "Creating agent" | `system-log` | toolCount, modelId |
| "Step X starting" | `system-log` | stepNumber, messageCount |
| level: warn/error | `system-log` | full message, metadata |

### Pattern Detection Code

```typescript
// In use-agent.ts, case 'log':
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
```

## Confirmation vs HITL Approval

Two distinct patterns for user confirmation:

### 1. Confirmation Flag Pattern (In-Band)
- Tool returns `{requiresConfirmation: true, message: "..."}`
- Agent shows message and waits for user response
- User responds "yes" → Agent calls tool again with `confirmed: true`
- Does NOT pause SSE stream

### 2. HITL Approval (Out-of-Band)
- Tool marked with `needsApproval: true` in metadata
- AI SDK emits `tool-approval-request` event
- SSE stream pauses waiting for approval
- User approves/rejects via modal
- Stream resumes or terminates

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

- `debug` - Detailed diagnostic info
- `info` - Normal operation events
- `warn` - Potential issues
- `error` - Failures and exceptions

### Search

Full-text search across:
- Entry summary
- Tool name
- Input JSON (stringified)
- Output JSON (stringified)

## Working Memory Tracking

### Entity Structure

```typescript
interface WorkingMemoryEntity {
  type: string;     // 'page' | 'section' | 'collection' | 'media' | 'entry' | 'task'
  id: string;       // UUID
  name: string;     // Human-readable name
  slug?: string;    // URL slug
  timestamp: number; // Last accessed time
}
```

### Extraction Source

Entities extracted from `working-memory-update` trace entries:

```typescript
// Backend emits:
context.logger.info('Extracted entities to working memory', {
  toolName: chunk.toolName,
  entityCount: entities.length,
  entities: entities.map(e => `${e.type}:${e.name}`),
  workingMemorySize: workingContext.size()
});

// Frontend parses:
const entityMap = new Map<string, WorkingMemoryEntity>();
for (const entityStr of metadata.entities) {
  const [type, name] = entityStr.split(':');
  entityMap.set(entityStr, { type, id: entityStr, name, timestamp });
}
```

## System Prompt Inspection

### Backend Emission

```typescript
// In orchestrator.ts, after prompt compilation:
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

### Frontend Handling

```typescript
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

## Timing & Duration Tracking

### Tool Call Duration

```typescript
// Track start time on tool-call
toolTimings.current.set(toolCallId, Date.now());

// Calculate duration on tool-result
const startTime = toolTimings.current.get(toolCallId);
const duration = startTime ? Date.now() - startTime : undefined;
toolTimings.current.delete(toolCallId);
```

### Trace Duration

```typescript
// Calculate total trace duration
const firstEntry = entries[0];
const lastEntry = entries[entries.length - 1];
metrics.totalDuration = lastEntry.timestamp - firstEntry.timestamp;
```

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

## Color Scheme

### Entry Type Colors

```typescript
const ENTRY_TYPE_COLORS = {
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

### Level Colors

```typescript
const LEVEL_COLORS = {
  debug: 'bg-gray-400',
  info: 'bg-blue-400',
  warn: 'bg-yellow-500',
  error: 'bg-red-500',
};
```

## Usage Examples

### Debugging a Tool Call

1. Send message: "List all pages"
2. Observe timeline:
   - `trace-start` - Trace begins
   - `system-prompt` - Click to view compiled prompt
   - `prompt-sent` - User message sent
   - `tool-call` - `cms_listPages` called
   - `tool-result` - Results returned (click to expand)
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

## Performance Considerations

- Entries stored in Zustand with Map for O(1) lookup by traceId
- Filtering computed via `getFilteredEntries()` selector
- Large payloads collapsed by default
- Modal used for viewing large JSON instead of inline expansion
- Clear trace option to free memory on long sessions

## Future Enhancements

- [ ] Trace comparison (diff two traces)
- [ ] Trace replay (step through execution)
- [ ] Trace sharing (shareable URLs)
- [ ] Metrics aggregation (avg tool duration)
- [ ] Alert rules (notify on errors)
- [ ] Trace search across sessions
