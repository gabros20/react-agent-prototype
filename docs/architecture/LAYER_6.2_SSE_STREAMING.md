# Layer 6.2: SSE Streaming (AI SDK 6 Protocol)

> Server-Sent Events parsing, AI SDK UI protocol, store coordination

## Overview

SSE (Server-Sent Events) streaming connects the frontend to the backend agent. Since the AI SDK 6 migration, the streaming uses the **AI SDK UI protocol** with standardized event types. The `useAgent` hook parses the stream, dispatches to stores, and handles the enhanced event set.

**Key Changes (AI SDK 6 Migration):**
- Uses AI SDK 6 stream protocol events
- New event types: `step-start`, `step-finish`, `usage`
- Token usage and cost tracking displayed in UI
- Consolidated tool-call states

---

## The Problem

Without proper SSE handling:

```typescript
// WRONG: No buffering
response.on('data', (chunk) => {
  const event = JSON.parse(chunk);  // Fails on partial chunks
});

// WRONG: No event type dispatch
const data = JSON.parse(eventData);
setMessages(prev => [...prev, data]);  // All events treated same

// WRONG: Session ID mismatch
setSessionId(data.traceId);  // Wrong! traceId ≠ sessionId
```

**Our Solution:**
1. Buffer-based SSE parsing with `\n\n` splitting
2. AI SDK 6 protocol event dispatch
3. Typed event handlers per event type
4. Token/cost tracking from `usage` events
5. Cross-store coordination via direct store access

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SSE STREAMING FLOW                           │
│                   (AI SDK 6 Protocol)                           │
│                                                                 │
│  User Input                                                     │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   sendMessage(prompt)                   │    │
│  │                                                         │    │
│  │  1. setIsStreaming(true)                                │    │
│  │  2. addMessage(userMessage)                             │    │
│  │  3. fetch('/api/agent', { prompt, sessionId })          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                        │
│                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 SSE Stream Parsing                      │    │
│  │                                                         │    │
│  │  while (true) {                                         │    │
│  │    const { done, value } = await reader.read();         │    │
│  │    if (done) break;                                     │    │
│  │    buffer += decoder.decode(value, { stream: true });   │    │
│  │    const lines = buffer.split('\n\n');                  │    │
│  │    buffer = lines.pop();  // Keep incomplete chunk      │    │
│  │    for (const line of lines) { ... }                    │    │
│  │  }                                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                        │
│                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              AI SDK 6 Event Dispatch                    │    │
│  │                                                         │    │
│  │  switch (eventType) {                                   │    │
│  │    case 'text-delta'       → accumulate text            │    │
│  │    case 'tool-call'        → logStore (consolidated)    │    │
│  │    case 'tool-result'      → logStore (consolidated)    │    │
│  │    case 'step-start'       → logStore (NEW)             │    │
│  │    case 'step-finish'      → logStore + usage (NEW)     │    │
│  │    case 'usage'            → usageStore (NEW)           │    │
│  │    case 'result'           → chatStore.addMessage()     │    │
│  │    case 'error'            → setError(), logStore       │    │
│  │    case 'done'/'finish'    → cleanup                    │    │
│  │  }                                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                        │
│                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Cleanup                              │    │
│  │                                                         │    │
│  │  finally {                                              │    │
│  │    setIsStreaming(false);                               │    │
│  │  }                                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/assistant/_hooks/use-agent.ts` | SSE parsing and event dispatch |
| `server/routes/agent.ts` | SSE event emission |
| `app/assistant/_stores/*.ts` | Target stores for events |

---

## AI SDK 6 Event Types

| Event | Data Shape | Store Action |
|-------|------------|--------------|
| `text-delta` | `{ delta }` | accumulate (no store) |
| `tool-call` | `{ toolCallId, toolName, args, state }` | logStore.addLog() |
| `tool-result` | `{ toolCallId, toolName, result }` | logStore.addLog() |
| `step-start` | `{ stepNumber }` | logStore.addLog() |
| `step-finish` | `{ stepNumber, usage }` | logStore + usageStore |
| `usage` | `{ promptTokens, completionTokens, totalTokens, cost }` | usageStore.update() |
| `result` | `{ traceId, sessionId, text }` | chatStore.addMessage() |
| `error` | `{ error, traceId }` | setError(), logStore |
| `log` | `{ traceId, message, metadata }` | logStore.addLog() |
| `done` / `finish` | `{}` | cleanup |

---

## Core Implementation

### SSE Stream Parsing

```typescript
// app/assistant/_hooks/use-agent.ts
export function useAgent() {
  const { addMessage, setIsStreaming, sessionId, setSessionId, setCurrentTraceId } =
    useChatStore();
  const { addLog, updateToolState } = useLogStore();
  const { setUsage } = useUsageStore();
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;

    setError(null);
    setIsStreaming(true);

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      createdAt: new Date()
    };
    addMessage(userMessage);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          prompt
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      // Parse SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentTraceId = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on double newline (SSE message boundary)
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          processSSEEvent(line);
        }
      }
    } catch (err) {
      handleError(err as Error);
    } finally {
      setIsStreaming(false);
    }
  }, [sessionId, addMessage, setIsStreaming]);

  return { messages, sendMessage, isStreaming, error };
}
```

### AI SDK 6 Event Dispatch

```typescript
const processSSEEvent = (line: string) => {
  const eventMatch = line.match(/^event: (.+)\ndata: (.+)$/s);
  if (!eventMatch) return;

  const [, eventType, dataStr] = eventMatch;
  const data = JSON.parse(dataStr);

  switch (eventType) {
    // Text streaming
    case 'text-delta':
      assistantText += data.delta || data.text || '';
      break;

    // Tool execution (consolidated states)
    case 'tool-call':
      addLog({
        id: data.toolCallId || crypto.randomUUID(),
        traceId: currentTraceId,
        timestamp: new Date(),
        type: 'tool-call',
        toolName: data.toolName,
        input: data.args,
        state: data.state || 'pending',  // NEW: consolidated state
      });
      break;

    case 'tool-result':
      updateToolState(data.toolCallId, {
        state: 'completed',
        output: data.result,
      });
      break;

    // Step boundaries (NEW in AI SDK 6)
    case 'step-start':
      addLog({
        id: crypto.randomUUID(),
        traceId: currentTraceId,
        timestamp: new Date(),
        type: 'step-start',
        message: `Step ${data.stepNumber} started`,
      });
      break;

    case 'step-finish':
      addLog({
        id: crypto.randomUUID(),
        traceId: currentTraceId,
        timestamp: new Date(),
        type: 'step-finish',
        message: `Step ${data.stepNumber} finished`,
        usage: data.usage,
      });
      break;

    // Usage tracking (NEW)
    case 'usage':
      setUsage({
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        estimatedCost: data.estimatedCost,
        formattedCost: data.formattedCost,
      });
      break;

    // Final result
    case 'result':
      currentTraceId = data.traceId;
      setCurrentTraceId(data.traceId);
      assistantText = data.text || assistantText;

      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
      }

      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantText,
        createdAt: new Date()
      });
      break;

    // Errors
    case 'error':
      addLog({
        id: crypto.randomUUID(),
        traceId: data.traceId || currentTraceId,
        timestamp: new Date(),
        type: 'error',
        message: data.error || 'Unknown error'
      });
      setError(new Error(data.error || 'Unknown error'));
      break;

    // Debug logs
    case 'log':
      addLog({
        id: crypto.randomUUID(),
        traceId: data.traceId || currentTraceId,
        timestamp: new Date(data.timestamp),
        type: 'info',
        message: data.message,
        metadata: data.metadata
      });
      currentTraceId = data.traceId || currentTraceId;
      break;

    case 'done':
    case 'finish':
      // Stream complete
      break;
  }
};
```

---

## Consolidated Tool States

AI SDK 6 uses consolidated states for tool calls:

```typescript
type ToolCallState =
  | 'pending'      // Tool called, waiting for execution
  | 'streaming'    // Tool executing with streaming output
  | 'completed'    // Tool finished successfully
  | 'failed';      // Tool execution failed

// In logStore
interface ToolLogEntry {
  id: string;
  traceId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  state: ToolCallState;
  timestamp: Date;
}
```

### State Transitions

```
tool-call event → state: 'pending'
                      ↓
             tool executes...
                      ↓
tool-result event → state: 'completed'
                    (or 'failed' on error)
```

---

## Usage Store (NEW)

Tracks token usage and costs:

```typescript
// app/assistant/_stores/usage-store.ts
interface UsageState {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  formattedCost: string;
  sessionTotals: {
    tokens: number;
    cost: number;
  };
}

export const useUsageStore = create<UsageState & UsageActions>((set, get) => ({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  estimatedCost: 0,
  formattedCost: '$0.0000',
  sessionTotals: { tokens: 0, cost: 0 },

  setUsage: (usage) => {
    const current = get();
    set({
      ...usage,
      sessionTotals: {
        tokens: current.sessionTotals.tokens + usage.totalTokens,
        cost: current.sessionTotals.cost + usage.estimatedCost,
      }
    });
  },

  resetSessionTotals: () => {
    set({ sessionTotals: { tokens: 0, cost: 0 } });
  }
}));
```

---

## Debug Panel Integration

The debug panel shows consolidated tool states:

```typescript
// app/assistant/_components/debug-panel.tsx
function ToolCallEntry({ entry }: { entry: ToolLogEntry }) {
  const stateColors = {
    pending: 'text-yellow-500',
    streaming: 'text-blue-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
  };

  return (
    <div className="flex items-center gap-2">
      <span className={stateColors[entry.state]}>
        {entry.state === 'pending' && <Loader className="animate-spin" />}
        {entry.state === 'completed' && <Check />}
        {entry.state === 'failed' && <X />}
      </span>
      <span>{entry.toolName}</span>
      {entry.output && (
        <span className="text-muted-foreground">
          → {JSON.stringify(entry.output).slice(0, 50)}...
        </span>
      )}
    </div>
  );
}
```

---

## Design Decisions

### Why Consolidated Tool States?

```typescript
// Before: Multiple event types
'tool-call-streaming-start'
'tool-call'
'tool-result'

// After: Single state field
{ state: 'pending' | 'streaming' | 'completed' | 'failed' }
```

**Benefits:**
1. Simpler state management in stores
2. Easier UI rendering logic
3. Consistent with AI SDK 6 patterns
4. Reduces event handler complexity

### Why Track Usage Per-Request?

```typescript
case 'usage':
  setUsage({
    promptTokens: data.promptTokens,
    completionTokens: data.completionTokens,
    totalTokens: data.totalTokens,
    estimatedCost: data.estimatedCost,
  });
```

**Benefits:**
1. Cost visibility for users
2. Session-level cost tracking
3. Helps with API budget management
4. Debug panel shows token breakdown

### Why Buffer-Based Parsing?

```typescript
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split('\n\n');
buffer = lines.pop() || '';
```

**Benefits:**
1. Handles partial chunks from network
2. UTF-8 multi-byte character safety
3. Standard SSE message boundary handling

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 3.7 (Agent Streaming) | Backend emits SSE events |
| Layer 6.1 (State Management) | Updates chat, log, usage stores |
| Layer 6.4 (Chat Components) | ChatPane consumes messages |
| Layer 6.5 (Debug Panel) | Shows tool states and usage |

### Event Flow Diagram

```
Backend SSE             useAgent          Stores          Components
    │                      │                │                 │
    │──event: step-start──▶│                │                 │
    │                      │──addLog()─────▶│                 │
    │                      │                │──re-render────▶DebugPanel
    │                      │                │                 │
    │──event: tool-call───▶│                │                 │
    │                      │──addLog()─────▶│                 │
    │                      │                │──re-render────▶DebugPanel
    │                      │                │                 │
    │──event: tool-result─▶│                │                 │
    │                      │──updateState()▶│                 │
    │                      │                │──re-render────▶DebugPanel
    │                      │                │                 │
    │──event: usage───────▶│                │                 │
    │                      │──setUsage()───▶│                 │
    │                      │                │──re-render────▶ UsageDisplay
    │                      │                │                 │
    │──event: result──────▶│                │                 │
    │                      │──addMessage()─▶│                 │
    │                      │                │──re-render────▶ ChatPane
```

---

## Common Issues / Debugging

### Incomplete Messages

**Cause:** Buffer not retained between reads.

**Fix:**
```typescript
const lines = buffer.split('\n\n');
buffer = lines.pop() || '';  // Don't discard
```

### Tool State Not Updating

**Cause:** `updateToolState` not finding entry.

**Debug:**
```typescript
console.log('Tool result for:', data.toolCallId);
console.log('Current logs:', useLogStore.getState().logs);
```

### Usage Not Displaying

**Cause:** `usage` event not emitted or store not connected.

**Debug:**
```typescript
// In processSSEEvent
console.log('Usage event:', data);
// In component
const usage = useUsageStore();
console.log('Usage state:', usage);
```

### Session Not Persisting

**Cause:** sessionId not passed to API.

**Debug:**
```typescript
console.log('Sending with sessionId:', sessionId);
```

---

## Further Reading

- [Layer 3.7: Agent Streaming](./LAYER_3.7_STREAMING.md) - Backend SSE emission
- [Layer 6.1: State Management](./LAYER_6.1_STATE_MANAGEMENT.md) - Store definitions
- [AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) - Official docs
- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
