# Layer 6.2: SSE Streaming

> Server-Sent Events parsing, event dispatch, buffer handling, store coordination

## Overview

SSE (Server-Sent Events) streaming connects the frontend to the backend agent. The `useAgent` hook manages the full lifecycle: sending prompts, parsing the event stream, dispatching events to appropriate stores, and handling errors. This enables real-time feedback during agent execution.

**Key Responsibilities:**
- Send prompts to `/api/agent` endpoint
- Parse SSE stream with proper buffering
- Dispatch events to chat, log, and approval stores
- Handle streaming state (loading indicators)
- Manage session ID synchronization

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

// WRONG: No error recovery
const reader = response.body.getReader();
const { value } = await reader.read();  // No error handling

// WRONG: Session ID mismatch
setSessionId(data.traceId);  // Wrong! traceId ≠ sessionId
```

**Our Solution:**
1. Buffer-based SSE parsing with `\n\n` splitting
2. Event type switch for proper dispatch
3. Typed event handlers per event type
4. Backend provides explicit `sessionId` in result
5. Cross-store coordination via direct store access

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SSE STREAMING FLOW                           │
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
│  │                 Event Type Dispatch                     │    │
│  │                                                         │    │
│  │  switch (eventType) {                                   │    │
│  │    case 'log'              → logStore.addLog()          │    │
│  │    case 'text-delta'       → accumulate text            │    │
│  │    case 'tool-call'        → logStore.addLog()          │    │
│  │    case 'tool-result'      → logStore.addLog()          │    │
│  │    case 'step'             → logStore.addLog()          │    │
│  │    case 'result'           → chatStore.addMessage()     │    │
│  │    case 'error'            → setError(), logStore       │    │
│  │    case 'approval-required'→ approvalStore.set()        │    │
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

## Core Implementation

### SSE Stream Parsing

```typescript
// app/assistant/_hooks/use-agent.ts
export function useAgent() {
  const { addMessage, setIsStreaming, sessionId, setSessionId, setCurrentTraceId } =
    useChatStore();
  const { addLog } = useLogStore();
  const { setPendingApproval } = useApprovalStore();
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
        buffer = lines.pop() || '';  // Keep incomplete chunk

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
  }, [sessionId, addMessage, setIsStreaming, ...]);

  return { messages, sendMessage, isStreaming, error };
}
```

### SSE Event Format Parsing

```typescript
// SSE format: "event: <type>\ndata: <json>"
const processSSEEvent = (line: string) => {
  const eventMatch = line.match(/^event: (.+)\ndata: (.+)$/s);
  if (!eventMatch) return;

  const [, eventType, dataStr] = eventMatch;
  const data = JSON.parse(dataStr);

  switch (eventType) {
    case 'log':
      addLog({
        id: crypto.randomUUID(),
        traceId: data.traceId || currentTraceId,
        stepId: '',
        timestamp: new Date(data.timestamp),
        type: 'info',
        message: data.message,
        input: data.metadata
      });
      currentTraceId = data.traceId || currentTraceId;
      break;

    case 'text-delta':
      // Accumulate streaming text (displayed on 'result')
      assistantText += data.delta || data.text || '';
      break;

    case 'tool-call':
      addLog({
        id: crypto.randomUUID(),
        traceId: currentTraceId,
        stepId: data.toolCallId || crypto.randomUUID(),
        timestamp: new Date(),
        type: 'tool-call',
        message: `Calling tool: ${data.toolName}`,
        input: data.args
      });
      break;

    case 'tool-result':
      addLog({
        id: crypto.randomUUID(),
        traceId: currentTraceId,
        stepId: data.toolCallId || crypto.randomUUID(),
        timestamp: new Date(),
        type: 'tool-result',
        message: `Tool ${data.toolName || 'result'} completed`,
        input: data.result
      });
      break;

    case 'result':
      currentTraceId = data.traceId;
      setCurrentTraceId(data.traceId);
      assistantText = data.text || '';

      // IMPORTANT: Use sessionId from backend, not traceId
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
      }

      // Add final assistant message
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantText,
        createdAt: new Date()
      });
      break;

    case 'approval-required':
      // Show HITL modal
      useApprovalStore.getState().setPendingApproval({
        approvalId: data.approvalId,
        traceId: data.traceId || currentTraceId,
        stepId: data.approvalId || data.stepId || '',
        toolName: data.toolName,
        input: data.input,
        description: data.description || `Approve execution of ${data.toolName}?`
      });
      break;

    case 'error':
      addLog({
        id: crypto.randomUUID(),
        traceId: data.traceId || currentTraceId,
        stepId: 'error',
        timestamp: new Date(),
        type: 'error',
        message: data.error || 'Unknown error'
      });
      setError(new Error(data.error || 'Unknown error'));
      break;

    case 'done':
    case 'finish':
      // Stream finished, cleanup handled in finally
      break;
  }
};
```

---

## Design Decisions

### Why Buffer-Based Parsing?

```typescript
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split('\n\n');
buffer = lines.pop() || '';  // Keep incomplete
```

**Reasons:**
1. **Partial chunks** - Network may split events mid-message
2. **stream: true flag** - Handles multi-byte UTF-8 characters
3. **Buffer retention** - Incomplete chunk kept for next iteration
4. **SSE standard** - Double newline is message boundary

### Why Accumulate text-delta?

```typescript
case 'text-delta':
  assistantText += data.delta || data.text || '';
  break;

case 'result':
  assistantText = data.text || '';  // Final text
  addMessage({ content: assistantText });
  break;
```

**Reasons:**
1. **Streaming UX** - Could show typing indicator
2. **Final message** - Only add complete message to store
3. **Backend authority** - result.text is canonical
4. **Flexibility** - Can show incremental or final

### Why Direct Store Access for Approval?

```typescript
useApprovalStore.getState().setPendingApproval({...});
```

**Reasons:**
1. **Outside component** - Event handler not in React tree
2. **Zustand pattern** - getState() for imperative access
3. **Immediate update** - No React render cycle needed
4. **Cross-store** - useAgent doesn't re-render on approval change

### Why sessionId from result, not traceId?

```typescript
// CORRECT
if (data.sessionId && data.sessionId !== sessionId) {
  setSessionId(data.sessionId);
}

// WRONG
setSessionId(data.traceId);  // traceId is per-request
```

**Reasons:**
1. **Different lifecycles** - Session persists, trace is per-request
2. **Backend authority** - Backend manages session creation
3. **New session detection** - First message creates session
4. **Idempotency** - Only update if different

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 3.7 (Agent Streaming) | Backend emits SSE events |
| Layer 6.1 (State Management) | Updates chat, log, approval stores |
| Layer 6.4 (Chat Components) | ChatPane consumes messages |
| Layer 6.5 (HITL Modal) | Approval events trigger modal |

### Event Flow Diagram

```
Backend SSE             useAgent          Stores          Components
    │                      │                │                 │
    │──event: log─────────▶│                │                 │
    │                      │──addLog()─────▶│                 │
    │                      │                │──re-render────▶DebugPane
    │                      │                │                 │
    │──event: tool-call───▶│                │                 │
    │                      │──addLog()─────▶│                 │
    │                      │                │──re-render────▶DebugPane
    │                      │                │                 │
    │──event: result──────▶│                │                 │
    │                      │──addMessage()─▶│                 │
    │                      │──setSessionId()│                 │
    │                      │                │──re-render────▶ChatPane
    │                      │                │                 │
    │──event: approval────▶│                │                 │
    │                      │──setPending()─▶│                 │
    │                      │                │──re-render────▶HITLModal
```

### SSE Event Types

| Event | Data Shape | Store Action |
|-------|------------|--------------|
| `log` | `{ traceId, message, metadata }` | logStore.addLog() |
| `text-delta` | `{ delta }` | accumulate (no store) |
| `tool-call` | `{ toolName, args, toolCallId }` | logStore.addLog() |
| `tool-result` | `{ toolName, result, toolCallId }` | logStore.addLog() |
| `step` | `{ traceId, stepId }` | logStore.addLog() |
| `result` | `{ traceId, sessionId, text }` | chatStore.addMessage() |
| `error` | `{ error, traceId }` | setError(), logStore |
| `approval-required` | `{ approvalId, toolName, input }` | approvalStore.set() |
| `done` / `finish` | `{ usage? }` | cleanup |

---

## Common Issues / Debugging

### Incomplete Messages

```
// Message truncated mid-sentence
```

**Cause:** Buffer not retained between reads.

**Fix:** Keep incomplete chunk:

```typescript
const lines = buffer.split('\n\n');
buffer = lines.pop() || '';  // Don't discard
```

### Session Not Persisting

```
// New session created on every message
```

**Cause:** sessionId not passed to API.

**Debug:**

```typescript
console.log('Sending with sessionId:', sessionId);
// Should be non-null after first message
```

### Approval Modal Not Showing

```
// approval-required event received but no modal
```

**Cause:** setPendingApproval not called or modal not mounted.

**Debug:**

```typescript
console.log('Approval request:', data);
console.log('Store state:', useApprovalStore.getState());
```

### Stream Errors Not Displayed

```
// Error silently logged but not shown
```

**Cause:** Error state not connected to UI.

**Fix:** Ensure error is surfaced:

```typescript
const { error } = useAgent();
if (error) return <ErrorDisplay error={error} />;
```

### Text Not Accumulating

```
// Only final chunk shown, not full response
```

**Cause:** assistantText reset on each chunk.

**Fix:** Use `+=` not `=`:

```typescript
case 'text-delta':
  assistantText += data.delta;  // Accumulate
  break;
```

---

## Further Reading

- [Layer 3.7: Agent Streaming](./LAYER_3.7_STREAMING.md) - Backend SSE emission
- [Layer 6.1: State Management](./LAYER_6.1_STATE_MANAGEMENT.md) - Store definitions
- [Layer 6.5: HITL UI](./LAYER_6.5_HITL_DEBUG_UI.md) - Approval handling
- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
