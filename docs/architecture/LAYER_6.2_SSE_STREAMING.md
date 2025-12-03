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
| `log` | `{ traceId, message, metadata }` | Initialize trace, traceStore.addEntry() |
| `system-prompt` | `{ prompt, tokens, workingMemoryTokens }` | traceStore.addEntry('system-prompt') |
| `user-prompt` | `{ prompt, tokens, messageHistoryTokens }` | traceStore.addEntry('user-prompt') |
| `model-info` | `{ modelId, pricing }` | traceStore.setModelInfo() |
| `step-start` | `{ stepNumber }` | traceStore.addEntry('step-start'), create streaming entry |
| `text-delta` | `{ delta }` | accumulate text, update streaming entry |
| `tool-call` | `{ toolCallId, toolName, args }` | traceStore.addEntry('tool-call'), track timing |
| `tool-result` | `{ toolCallId, toolName, result }` | traceStore.completeEntry(), check confirmation |
| `tool-error` | `{ toolCallId, toolName, error }` | traceStore.completeEntry() with error |
| `step-finish` | `{ stepNumber, duration, usage }` | finalize streaming entry, traceStore.addEntry('step-complete') |
| `result` | `{ traceId, sessionId, text, usage }` | chatStore.addMessage(), traceStore.addEntry('llm-response') |
| `error` | `{ error, traceId }` | setError(), traceStore.addEntry('error') |
| `finish` | `{ finishReason, usage }` | log completion |
| `done` | `{ traceId, sessionId }` | traceStore.addEntry('trace-complete'), save conversation log |

---

## Core Implementation

### SSE Stream Parsing

```typescript
// app/assistant/_hooks/use-agent.ts
export function useAgent() {
  const { addMessage, setIsStreaming, sessionId, setSessionId, setCurrentTraceId } =
    useChatStore();
  const { addEntry, completeEntry, updateEntry } = useTraceStore();
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

    // Tool execution
    case 'tool-call':
      addEntry({
        id: data.toolCallId || crypto.randomUUID(),
        traceId: currentTraceId,
        timestamp: Date.now(),
        type: 'tool-call',
        level: 'info',
        toolName: data.toolName,
        toolCallId: data.toolCallId,
        summary: `Calling ${data.toolName}...`,
        input: data.args,
      });
      break;

    case 'tool-result':
      completeEntry(data.toolCallId, data.result);
      break;

    // Step boundaries (AI SDK 6)
    case 'step-start':
      addEntry({
        id: crypto.randomUUID(),
        traceId: currentTraceId,
        timestamp: Date.now(),
        type: 'step-start',
        level: 'info',
        stepNumber: data.stepNumber,
        summary: `Step ${data.stepNumber} started`,
      });
      break;

    case 'step-finish':
      addEntry({
        id: crypto.randomUUID(),
        traceId: currentTraceId,
        timestamp: Date.now(),
        type: 'step-complete',
        level: 'info',
        stepNumber: data.stepNumber,
        summary: `Step ${data.stepNumber} finished`,
        tokens: data.usage ? {
          input: data.usage.promptTokens,
          output: data.usage.completionTokens,
        } : undefined,
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
      addEntry({
        id: crypto.randomUUID(),
        traceId: data.traceId || currentTraceId,
        timestamp: Date.now(),
        type: 'error',
        level: 'error',
        summary: data.error || 'Unknown error',
      });
      setError(new Error(data.error || 'Unknown error'));
      break;

    // Debug logs
    case 'log':
      addEntry({
        id: crypto.randomUUID(),
        traceId: data.traceId || currentTraceId,
        timestamp: Date.now(),
        type: 'system-log',
        level: data.level || 'info',
        summary: data.message,
        input: data.metadata,
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

## Usage & Cost Tracking (via trace-store)

Token usage and costs are tracked in the trace-store, not a separate usage-store:

```typescript
// app/assistant/_stores/trace-store.ts
interface TraceMetrics {
  totalDuration: number;
  toolCallCount: number;
  stepCount: number;
  tokens: { input: number; output: number };
  cost: number;          // Calculated from model pricing
  errorCount: number;
}

// Model pricing stored per trace for cost calculation
modelInfoByTrace: Map<string, { modelId: string; pricing: ModelPricing | null }>

// getMetrics() calculates totals from entries
getMetrics: () => {
  const entries = entriesByTrace.get(activeTraceId) || [];
  return entries.reduce((acc, entry) => ({
    ...acc,
    tokens: {
      input: acc.tokens.input + (entry.tokens?.input || 0),
      output: acc.tokens.output + (entry.tokens?.output || 0),
    },
    // Cost calculated from model pricing
  }), initialMetrics);
}

// Total metrics across all conversation logs
getTotalMetrics: () => TraceMetrics;
```

---

## Design Decisions

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
| Layer 6.1 (State Management) | Updates chat store, trace store (metrics, entries) |
| Layer 6.4 (Chat Components) | ChatPane consumes messages |
| Layer 6.5/6.6 (Debug Panel) | Shows trace entries, metrics, cost tracking |

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

**Cause:** `completeEntry` not finding entry by toolCallId.

**Debug:**
```typescript
console.log('Tool result for:', data.toolCallId);
console.log('Pending timings:', useTraceStore.getState().pendingTimings);
```

### Metrics Not Displaying

**Cause:** Token data not being extracted from step-finish events.

**Debug:**
```typescript
// In processSSEEvent
console.log('Step finish usage:', data.usage);
// In component
const metrics = useTraceStore.getState().getMetrics();
console.log('Metrics:', metrics);
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
