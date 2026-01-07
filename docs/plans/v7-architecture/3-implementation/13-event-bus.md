# Event Bus

> **Summary**: The Event Bus provides typed pub/sub for all agent events. It's in-memory (no persistence needed) and enables decoupled communication between components.
>
> **Prerequisites**: [../00-overview.md](../00-overview.md)

## Overview

The Event Bus is the **central communication hub** for agent events. It enables:
- UI updates via SSE streaming
- Logging and analytics
- HITL approval flow
- Decoupled component communication

---

## Event Categories

### Session Events

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `session.started` | `{ sessionId, agentId, userId, parentId? }` | Logging, Analytics, UI |
| `session.compacted` | `{ sessionId, tokensBefore, tokensAfter }` | Logging |
| `session.completed` | `{ sessionId, result, artifacts }` | Logging, Parent Session |
| `session.error` | `{ sessionId, error, recoverable }` | Logging, UI, Alerting |
| `session.aborted` | `{ sessionId, reason }` | Logging, UI |

### Agent Events

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `agent.thinking` | `{ sessionId, step, maxSteps, toolCalls? }` | UI (SSE) |
| `agent.stuck` | `{ sessionId, lastToolCalls, reason }` | UI (HITL prompt) |
| `agent.response` | `{ sessionId, content, finishReason }` | UI (SSE) |

### Multi-Agent Events

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `agent.spawned` | `{ parentSessionId, childSessionId, agentId, task, resumed }` | UI, Logging |
| `agent.child_completed` | `{ parentSessionId, childSessionId, agentId, result }` | Parent Session, UI |
| `agent.handoff` | `{ fromAgent, toAgent, sessionId, reason }` | Logging, Analytics |

### Tool Events

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `tool.executing` | `{ sessionId, tool, input, step }` | UI (SSE), Logging |
| `tool.completed` | `{ sessionId, tool, result, durationMs }` | UI (SSE), Logging |
| `tool.error` | `{ sessionId, tool, error, isRetryable }` | UI (SSE), Alerting |

### Approval Events (HITL)

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `approval.required` | `{ sessionId, action, resource, preview }` | UI (HITL modal) |
| `approval.received` | `{ sessionId, action, approved, feedback? }` | Session Processor |

### Todo Events

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `todo.updated` | `{ sessionId, todos }` | UI (plan view) |

---

## Event Payloads (TypeScript)

```typescript
// Session Events
interface SessionStartedEvent {
  sessionId: string;
  agentId: string;
  userId: string;
  parentId?: string;
}

interface SessionCompactedEvent {
  sessionId: string;
  tokensBefore: number;
  tokensAfter: number;
}

interface SessionCompletedEvent {
  sessionId: string;
  result: string;
  artifacts: string[];
}

interface SessionErrorEvent {
  sessionId: string;
  error: string;
  recoverable: boolean;
}

// Agent Events
interface AgentThinkingEvent {
  sessionId: string;
  step: number;
  maxSteps: number;
  toolCalls?: string[];
}

interface AgentStuckEvent {
  sessionId: string;
  lastToolCalls: { name: string; params: unknown }[];
  reason: string;
}

// Multi-Agent Events
interface AgentSpawnedEvent {
  parentSessionId: string;
  childSessionId: string;
  agentId: string;
  task: string;
  resumed: boolean;
}

interface AgentChildCompletedEvent {
  parentSessionId: string;
  childSessionId: string;
  agentId: string;
  result: string;
}

// Tool Events
interface ToolExecutingEvent {
  sessionId: string;
  tool: string;
  input: unknown;
  step: number;
}

interface ToolCompletedEvent {
  sessionId: string;
  tool: string;
  result: unknown;
  durationMs: number;
}

interface ToolErrorEvent {
  sessionId: string;
  tool: string;
  error: string;
  isRetryable: boolean;
}

// Approval Events
interface ApprovalRequiredEvent {
  sessionId: string;
  action: string;
  resource: string;
  preview: {
    description: string;
    affectedEntities: string[];
    reversible: boolean;
  };
}

interface ApprovalReceivedEvent {
  sessionId: string;
  action: string;
  approved: boolean;
  feedback?: string;
}

// Todo Events
interface TodoUpdatedEvent {
  sessionId: string;
  todos: TodoItem[];
}
```

---

## Implementation

```typescript
// core/event-bus/event-bus.service.ts
type EventHandler<T> = (payload: T) => void | Promise<void>;

class EventBus {
  private handlers: Map<string, Set<EventHandler<any>>> = new Map();

  subscribe<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  async publish<T>(event: string, payload: T): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    // Execute all handlers (don't wait for slow ones)
    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (error) {
        console.error(`Event handler error for ${event}:`, error);
      }
    }
  }

  // Convenience method for typed events
  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): () => void {
    return this.subscribe(event, handler);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): Promise<void> {
    return this.publish(event, payload);
  }
}
```

---

## SSE Streaming

Events are streamed to the client via Server-Sent Events:

```typescript
// api/sse.controller.ts
@Get('/sessions/:sessionId/events')
async streamEvents(
  @Param('sessionId') sessionId: string,
  @Res() res: Response
) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const unsubscribers: (() => void)[] = [];

  // Subscribe to relevant events
  const events = [
    'agent.thinking',
    'agent.response',
    'tool.executing',
    'tool.completed',
    'approval.required',
    'todo.updated',
    'session.completed',
    'session.error',
  ];

  for (const event of events) {
    const unsub = this.eventBus.subscribe(event, (payload) => {
      if (payload.sessionId === sessionId) {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    });
    unsubscribers.push(unsub);
  }

  // Cleanup on disconnect
  res.on('close', () => {
    unsubscribers.forEach(unsub => unsub());
  });
}
```

---

## Usage Patterns

### Publishing Events

```typescript
// In SessionProcessor
this.eventBus.emit('agent.thinking', {
  sessionId,
  step: currentStep,
  maxSteps: agent.loop.maxSteps,
  toolCalls: pendingCalls.map(c => c.name),
});

// In Tool Execution
this.eventBus.emit('tool.completed', {
  sessionId: ctx.sessionId,
  tool: toolName,
  result: truncateResult(result),
  durationMs: Date.now() - startTime,
});
```

### Subscribing to Events

```typescript
// In Logging Service
this.eventBus.on('session.completed', async (event) => {
  await this.logger.info('Session completed', {
    sessionId: event.sessionId,
    artifacts: event.artifacts.length,
  });
});

// In Analytics Service
this.eventBus.on('tool.completed', async (event) => {
  await this.metrics.recordToolUsage({
    tool: event.tool,
    durationMs: event.durationMs,
  });
});
```

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| In-memory | Low latency, no persistence needed for events |
| Async handlers | Don't block publisher on slow subscribers |
| Per-session filtering | SSE streams only relevant events |
| Typed events | TypeScript safety for payloads |

---

## Future Considerations

These areas may need enhancement:

| Area | Current State | Future Need |
|------|---------------|-------------|
| Event persistence | In-memory only | May need audit log |
| Distributed events | Single instance | Redis pub/sub for scaling |
| Event replay | Not supported | May need for debugging |
| Rate limiting | None | May need for noisy events |

---

## Related Documents

- → [12-session-processor.md](12-session-processor.md) - Event publishing
- → [../2-agents/11-hitl-integration.md](../2-agents/11-hitl-integration.md) - Approval events
- ↗ [../4-appendices/appendix-a-schemas.md](../4-appendices/appendix-a-schemas.md) - Event type definitions
