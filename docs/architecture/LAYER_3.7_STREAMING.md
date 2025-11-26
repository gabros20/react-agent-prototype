# Layer 3.7: Streaming

> Server-Sent Events (SSE) for real-time agent feedback

## Overview

Streaming provides real-time feedback as the agent thinks and acts. Users see text appearing character-by-character, tool calls as they happen, and can respond to approval requests. This dramatically improves UX compared to waiting for a complete response.

**Key Files:**
- `server/routes/agent.ts` - SSE endpoint
- `app/api/agent/route.ts` - Next.js proxy
- `app/assistant/_hooks/use-agent.ts` - Stream parser

---

## The Problem

Without streaming:
```
User: "Create a page with 5 sections"
[10 seconds of waiting...]
[Spinner spinning...]
Agent: Done! Here's what I created...
User: "What's happening? Is it broken?"
```

With streaming:
```
User: "Create a page with 5 sections"
Agent: I'll create that page for you...
       ↳ Calling cms_createPage...
       ↳ Page created! Adding sections...
       ↳ Calling cms_addSection (1/5)...
       ↳ Calling cms_addSection (2/5)...
       ...
       Done! Created the page with 5 sections.
User: "Nice, I can see exactly what it's doing!"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Streaming Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐                                             │
│  │   Frontend     │                                             │
│  │  (Next.js)     │                                             │
│  │                │                                             │
│  │  useAgent()    │                                             │
│  │  hook          │                                             │
│  └───────┬────────┘                                             │
│          │                                                       │
│          │ POST /api/agent                                       │
│          ▼                                                       │
│  ┌────────────────┐                                             │
│  │   Next.js      │                                             │
│  │   API Route    │                                             │
│  │                │                                             │
│  │   Proxy to     │                                             │
│  │   Express      │                                             │
│  └───────┬────────┘                                             │
│          │                                                       │
│          │ POST /v1/agent/stream                                 │
│          ▼                                                       │
│  ┌────────────────┐     ┌────────────────┐                      │
│  │   Express      │     │   Agent        │                      │
│  │   Route        │◀───▶│  Orchestrator  │                      │
│  │                │     │                │                      │
│  │   writeSSE()   │     │  Yields events │                      │
│  └───────┬────────┘     └────────────────┘                      │
│          │                                                       │
│          │ SSE Stream                                            │
│          │                                                       │
│          │ event: text-delta                                     │
│          │ data: {"delta": "I'll"}                               │
│          │                                                       │
│          │ event: text-delta                                     │
│          │ data: {"delta": " create"}                            │
│          │                                                       │
│          │ event: tool-call                                      │
│          │ data: {"name": "cms_createPage", ...}                 │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                             │
│  │   Frontend     │                                             │
│  │  State Update  │                                             │
│  │                │                                             │
│  │  ChatStore     │                                             │
│  │  LogStore      │                                             │
│  │  ApprovalStore │                                             │
│  └────────────────┘                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Server-Sent Events (SSE)

### Why SSE over WebSocket?

| Aspect | SSE | WebSocket |
|--------|-----|-----------|
| Direction | Server → Client (one-way) | Bidirectional |
| Complexity | Simple HTTP | Protocol upgrade |
| Reconnection | Built-in | Manual |
| Load Balancers | Works everywhere | Sometimes problematic |
| Our use case | Perfect fit | Overkill |

Agent responses are inherently one-way (server → client), making SSE ideal.

### SSE Format

```
event: <event-type>
data: <json-payload>

event: text-delta
data: {"delta": "Hello"}

event: tool-call
data: {"name": "cms_createPage", "args": {...}}
```

---

## Event Types

### Complete Event Catalog

| Event | When Emitted | Payload |
|-------|--------------|---------|
| `text-delta` | LLM generates text | `{ delta: string }` |
| `tool-call` | Tool invocation starts | `{ name, args, id }` |
| `tool-result` | Tool completes | `{ name, result, id }` |
| `approval-required` | HITL needed | `{ approvalId, toolName, message }` |
| `step-completed` | Agent step done | `{ stepNumber, usage }` |
| `log` | Logger output | `{ level, message, metadata }` |
| `finish` | Stream ends | `{ finishReason, usage }` |
| `error` | Error occurred | `{ error, code }` |

### Event Details

#### text-delta

Streaming text chunks as LLM generates them:

```typescript
// Payload
{
  delta: string;  // Text fragment (can be partial word)
  snapshot?: string;  // Full text so far (optional)
}

// Example sequence
{ delta: "I'll" }
{ delta: " create" }
{ delta: " a" }
{ delta: " page" }
{ delta: " for" }
{ delta: " you" }
{ delta: "." }
```

#### tool-call

When agent decides to call a tool:

```typescript
{
  id: string;        // Unique call ID
  name: string;      // Tool name (e.g., "cms_createPage")
  args: object;      // Tool arguments
}

// Example
{
  id: "call-abc123",
  name: "cms_createPage",
  args: {
    title: "About Us",
    slug: "about"
  }
}
```

#### tool-result

After tool execution completes:

```typescript
{
  id: string;        // Matches tool-call ID
  name: string;      // Tool name
  result: object;    // Tool return value
  duration?: number; // Execution time (ms)
}

// Example
{
  id: "call-abc123",
  name: "cms_createPage",
  result: {
    success: true,
    page: { id: "page-123", title: "About Us" }
  },
  duration: 245
}
```

#### approval-required

HITL pause point:

```typescript
{
  approvalId: string;   // Unique approval ID
  toolName: string;     // Which tool needs approval
  input: object;        // Tool arguments
  message: string;      // User-facing description
}

// Example
{
  approvalId: "apr-xyz789",
  toolName: "cms_deletePost",
  input: { slug: "old-post" },
  message: "Delete post 'old-post'? This cannot be undone."
}
```

#### log

Debug/info messages:

```typescript
{
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: object;
  timestamp: string;
  traceId: string;
}

// Example
{
  level: "info",
  message: "Fetched page data",
  metadata: { pageId: "page-123", sectionCount: 5 },
  timestamp: "2025-01-15T10:30:00.000Z",
  traceId: "trace-abc"
}
```

#### finish

Stream completion:

```typescript
{
  finishReason: 'stop' | 'max-steps' | 'error' | 'cancelled';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  stepCount: number;
}
```

#### error

Error during execution:

```typescript
{
  error: string;         // Error message
  code?: string;         // Error code
  recoverable: boolean;  // Can retry?
}
```

---

## Server Implementation

### Express Route

```typescript
// server/routes/agent.ts
import { Router } from 'express';

const router = Router();

router.post('/stream', async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // Disable nginx buffering

  // Helper to write SSE events
  const writeSSE = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Create logger that streams to client
  const logger = {
    info: (message: string, metadata?: object) => {
      console.log('[INFO]', message, metadata);
      writeSSE('log', {
        level: 'info',
        message,
        metadata,
        timestamp: new Date().toISOString(),
        traceId: context.traceId
      });
    },
    warn: (message: string, metadata?: object) => {
      console.warn('[WARN]', message, metadata);
      writeSSE('log', { level: 'warn', message, metadata, ... });
    },
    error: (message: string, metadata?: object) => {
      console.error('[ERROR]', message, metadata);
      writeSSE('log', { level: 'error', message, metadata, ... });
    }
  };

  try {
    // Create agent context
    const context = createAgentContext(req, logger);

    // Stream agent execution
    for await (const event of streamAgentWithApproval(messages, context)) {
      switch (event.type) {
        case 'text-delta':
          writeSSE('text-delta', { delta: event.text });
          break;

        case 'tool-call':
          writeSSE('tool-call', {
            id: event.id,
            name: event.name,
            args: event.args
          });
          break;

        case 'tool-result':
          writeSSE('tool-result', {
            id: event.id,
            name: event.name,
            result: event.result
          });
          break;

        case 'approval-required':
          writeSSE('approval-required', event);
          break;

        case 'finish':
          writeSSE('finish', {
            finishReason: event.reason,
            usage: event.usage,
            stepCount: event.steps
          });
          break;
      }
    }
  } catch (error) {
    writeSSE('error', {
      error: error.message,
      code: error.code,
      recoverable: isRecoverableError(error)
    });
  } finally {
    res.end();
  }
});
```

### Keep-Alive

For long operations, send keep-alive comments:

```typescript
// Send comment every 15 seconds to prevent timeout
const keepAlive = setInterval(() => {
  res.write(': keep-alive\n\n');
}, 15000);

// Cleanup on close
req.on('close', () => {
  clearInterval(keepAlive);
});
```

---

## Next.js Proxy

### API Route

```typescript
// app/api/agent/route.ts
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Forward to Express backend
  const response = await fetch(`${process.env.API_URL}/v1/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Forward auth headers if present
      ...getAuthHeaders(request)
    },
    body: JSON.stringify(body)
  });

  // Return streaming response
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

### Why Proxy?

1. **CORS** - Frontend and backend on different ports
2. **Auth** - Can add authentication in proxy
3. **Monitoring** - Central point for logging
4. **Flexibility** - Can switch backends without frontend changes

---

## Frontend Consumer

### useAgent Hook

```typescript
// app/assistant/_hooks/use-agent.ts
import { useChatStore } from '../_stores/chat-store';
import { useLogStore } from '../_stores/log-store';
import { useApprovalStore } from '../_stores/approval-store';

export function useAgent() {
  const { addMessage, updateLastMessage, setStreaming } = useChatStore();
  const { addLog } = useLogStore();
  const { setPendingApproval } = useApprovalStore();

  const sendMessage = async (content: string) => {
    // Add user message immediately
    addMessage({ role: 'user', content });

    // Add empty assistant message (will be updated)
    addMessage({ role: 'assistant', content: '' });

    setStreaming(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: useChatStore.getState().sessionId,
          message: content
        })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Parse complete events from buffer
        const events = parseSSEBuffer(buffer);
        buffer = events.remaining;

        for (const event of events.parsed) {
          handleEvent(event);
        }
      }
    } catch (error) {
      addLog({ level: 'error', message: error.message });
    } finally {
      setStreaming(false);
    }
  };

  const handleEvent = (event: SSEEvent) => {
    switch (event.type) {
      case 'text-delta':
        // Append text to last assistant message
        updateLastMessage(event.data.delta);
        break;

      case 'tool-call':
        addLog({
          level: 'info',
          message: `Calling ${event.data.name}...`,
          metadata: { args: event.data.args }
        });
        break;

      case 'tool-result':
        addLog({
          level: 'info',
          message: `${event.data.name} completed`,
          metadata: { result: event.data.result }
        });
        break;

      case 'approval-required':
        setPendingApproval(event.data);
        break;

      case 'log':
        addLog(event.data);
        break;

      case 'finish':
        addLog({
          level: 'info',
          message: 'Completed',
          metadata: event.data
        });
        break;

      case 'error':
        addLog({
          level: 'error',
          message: event.data.error
        });
        break;
    }
  };

  return { sendMessage };
}
```

### SSE Parsing

```typescript
interface ParsedEvents {
  parsed: SSEEvent[];
  remaining: string;
}

function parseSSEBuffer(buffer: string): ParsedEvents {
  const events: SSEEvent[] = [];
  const lines = buffer.split('\n');
  let remaining = '';
  let currentEvent: Partial<SSEEvent> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Event type line
    if (line.startsWith('event: ')) {
      currentEvent.type = line.slice(7);
    }
    // Data line
    else if (line.startsWith('data: ')) {
      try {
        currentEvent.data = JSON.parse(line.slice(6));
      } catch {
        currentEvent.data = line.slice(6);
      }
    }
    // Empty line = end of event
    else if (line === '' && currentEvent.type) {
      events.push(currentEvent as SSEEvent);
      currentEvent = {};
    }
    // Incomplete event at end
    else if (i === lines.length - 1 && line !== '') {
      remaining = lines.slice(i).join('\n');
      break;
    }
  }

  return { parsed: events, remaining };
}
```

---

## State Updates

### ChatStore

```typescript
// Streaming text updates
updateLastMessage: (delta: string) => {
  set((state) => {
    const messages = [...state.messages];
    const last = messages[messages.length - 1];

    if (last?.role === 'assistant') {
      last.content += delta;
    }

    return { messages };
  });
}
```

### LogStore

```typescript
// Add log entry
addLog: (entry: LogEntry) => {
  set((state) => ({
    logs: [
      ...state.logs,
      {
        ...entry,
        id: nanoid(),
        timestamp: Date.now()
      }
    ]
  }));
}
```

---

## Error Handling

### Connection Errors

```typescript
try {
  const response = await fetch('/api/agent', { ... });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  // Process stream...
} catch (error) {
  if (error.name === 'AbortError') {
    // User cancelled
    addLog({ level: 'info', message: 'Request cancelled' });
  } else if (error.message.includes('network')) {
    // Network error
    addLog({
      level: 'error',
      message: 'Connection lost. Please check your internet and try again.'
    });
  } else {
    // Other error
    addLog({ level: 'error', message: error.message });
  }
}
```

### Stream Interruption

```typescript
// Detect premature close
req.on('close', () => {
  if (!res.writableEnded) {
    logger.warn('Client disconnected before stream completed');
    // Cleanup agent resources
    agent.abort();
  }
});
```

---

## Performance Considerations

### Buffering

```typescript
// Disable buffering at all layers
res.setHeader('X-Accel-Buffering', 'no');  // nginx
res.setHeader('Cache-Control', 'no-cache');
res.flushHeaders();  // Send headers immediately
```

### Backpressure

```typescript
// Check if client can receive
if (!res.writable) {
  logger.warn('Client not writable, pausing stream');
  await new Promise(resolve => res.once('drain', resolve));
}
```

### Memory

```typescript
// Don't accumulate all events in memory
// Process and discard as they arrive
for await (const event of agentStream) {
  writeSSE(event.type, event.data);
  // Event is garbage collected after this iteration
}
```

---

## Debugging

### Browser DevTools

Network tab → select request → EventStream tab shows events

### Server Logging

```typescript
const writeSSE = (event: string, data: unknown) => {
  if (process.env.DEBUG_SSE) {
    console.log(`[SSE] ${event}:`, JSON.stringify(data).slice(0, 100));
  }
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Events arrive in batches | Buffering | Disable buffering headers |
| Connection drops | Timeout | Add keep-alive |
| Events not parsed | Buffer splitting | Handle partial events |
| Memory growth | Event accumulation | Process incrementally |

---

## Integration Points

| Connects To | How |
|-------------|-----|
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) | Orchestrator yields events |
| [3.5 HITL](./LAYER_3.5_HITL.md) | approval-required event |
| [3.6 Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md) | error event |
| [3.8 Context](./LAYER_3.8_CONTEXT_INJECTION.md) | Logger in context |
| Layer 6 (Client) | State stores consume events |

---

## Further Reading

- [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Event generation
- [3.5 HITL](./LAYER_3.5_HITL.md) - Approval flow
- [Layer 6 Client](./LAYER_6_CLIENT.md) - Frontend state management
