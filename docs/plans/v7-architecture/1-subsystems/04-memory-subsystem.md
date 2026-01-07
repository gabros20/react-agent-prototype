# Memory Subsystem

> **Summary**: Memory is kept simple. Chat history + compaction handles context. A lightweight Todo system (like OpenCode) handles plan tracking for multi-step agents. No complex memory types - just what's proven to work.
>
> **Prerequisites**: [00-overview.md](../00-overview.md), [02-agent-server.md](02-agent-server.md)

## Overview

The memory subsystem has two components:
1. **Compaction Service** - Manages context window limits
2. **Todo Service** - Simple plan tracking for orchestrator/specialists

Both are intentionally simple. Complex memory systems add overhead without proven benefits for CMS tasks.

---

## Todo System (OpenCode-style)

A simple task list for agents that need to track multi-step plans. **Not all agents need this.**

### Schema

```typescript
interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
}

interface SessionTodos {
  sessionId: string;
  todos: TodoItem[];
}
```

### Tools

**`todowrite`** - Update the todo list

```typescript
const todoWriteTool: ToolDefinition = {
  id: 'todowrite',
  name: 'todowrite',
  description: 'Update the todo list to track your current plan and progress',
  parameters: z.object({
    todos: z.array(z.object({
      id: z.string(),
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
      priority: z.enum(['high', 'medium', 'low']),
    })),
  }),
  execute: async (input, ctx) => {
    await todoService.update(ctx.sessionId, input.todos);
    ctx.eventBus.publish('todo.updated', {
      sessionId: ctx.sessionId,
      todos: input.todos
    });
    return { success: true };
  },
};
```

**`todoread`** - Read current todos (rarely needed, context usually has them)

### When to Use

| Agent | todoEnabled | Why |
|-------|-------------|-----|
| `router` | ❌ | Single-step classification |
| `orchestrator` | ✅ | Tracks subtask progress |
| `qa_specialist` | ❌ | Simple retrieval, no plan |
| `research_specialist` | ❌ | Chat history sufficient |
| `page_specialist` | ✅ | Multi-step page building |
| `post_specialist` | ✅ | Multi-step content creation |
| `image_specialist` | ❌ | Simple operations |

---

## Compaction Service

Two-phase context management (like OpenCode and current prototype):

1. **Pruning**: Trim large tool outputs first (replace with `[trimmed]`)
2. **Summarization**: When still over limit, summarize older conversation

### Algorithm

```typescript
class CompactionService {
  async shouldCompact(session: Session, provider: Provider): Promise<boolean> {
    const tokenCount = await this.countTokens(session.messages);
    const limit = provider.contextWindow;
    const outputBuffer = Math.min(provider.maxOutput, 32000);

    return tokenCount > (limit - outputBuffer);
  }

  async compact(session: Session): Promise<void> {
    // 1. First pass: prune large tool outputs
    await this.pruneToolOutputs(session);

    // 2. If still over limit, summarize older messages
    if (await this.shouldCompact(session, provider)) {
      const toSummarize = session.messages.slice(0, -4);
      const summary = await this.generateSummary(toSummarize);
      await this.sessionStore.replaceWithSummary(session.id, summary);
    }

    this.eventBus.publish('session.compacted', { sessionId: session.id });
  }

  private async pruneToolOutputs(session: Session): Promise<void> {
    for (const message of session.messages) {
      if (message.toolResults) {
        for (const result of message.toolResults) {
          if (JSON.stringify(result).length > 10000) {
            result.content = '[trimmed - large output]';
          }
        }
      }
    }
  }
}
```

### Provider-Anchored Token Counting

Uses the provider's reported context window as source of truth, not hardcoded values:

```typescript
interface Provider {
  contextWindow: number;   // e.g., 128000 for GPT-4
  maxOutput: number;       // e.g., 4096
}

// Leave buffer for output + system prompt
const safeLimit = provider.contextWindow - Math.min(provider.maxOutput, 32000);
```

### Compaction Events

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `session.compacted` | `{ sessionId, tokensBefore, tokensAfter }` | Logging |

---

## What Memory Does NOT Include

**Intentionally omitted** (based on OpenCode's successful simplicity):

| Feature | Why Omitted |
|---------|-------------|
| Long-term memory | Chat history + compaction sufficient for CMS tasks |
| Entity memory | Working memory extraction handled separately if needed |
| Semantic memory | RAG via vector search handles knowledge retrieval |
| Episodic memory | Session history provides needed context |

The philosophy: **Add complexity only when simple approaches fail**.

---

## Memory Configuration in AgentConfig

```typescript
interface AgentConfig {
  // ... other fields
  memory: {
    compactionEnabled: boolean;   // Auto-summarize long contexts
    todoEnabled: boolean;         // Enable todowrite/todoread tools
    preserveErrorsInContext?: boolean;  // Manus pattern: keep errors visible
  };
}
```

### Example Configurations

**Orchestrator** (needs both):
```typescript
memory: {
  compactionEnabled: true,
  todoEnabled: true,
  preserveErrorsInContext: true,
}
```

**QA Specialist** (minimal):
```typescript
memory: {
  compactionEnabled: false,  // Short conversations
  todoEnabled: false,        // Single-shot Q&A
}
```

**Page Specialist** (full tracking):
```typescript
memory: {
  compactionEnabled: true,   // Long sessions possible
  todoEnabled: true,         // Multi-step building
}
```

---

## Storage

All memory data stored in **Internal CMS Server**:

| Data | Table | Access |
|------|-------|--------|
| Todos | `todos` | Todo Service via HTTP |
| Messages | `messages` | Session Service via HTTP |
| Compaction metadata | Session `metadata` | Session Service via HTTP |

This enables:
- Agent Server horizontal scaling
- Persistent memory across sessions
- Debugging via database inspection

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Simple todo list | OpenCode proves this is sufficient for planning |
| Two-phase compaction | Preserve recent context, summarize old |
| Provider-anchored limits | Accurate across different models |
| No complex memory | YAGNI - add when proven necessary |

---

## Related Documents

- → [02-agent-server.md](02-agent-server.md) - Memory services in Agent Server
- → [07-internal-cms.md](07-internal-cms.md) - Data persistence
- → [../2-agents/08-agent-model.md](../2-agents/08-agent-model.md) - Which agents use which memory
- ↗ [../4-appendices/appendix-a-schemas.md](../4-appendices/appendix-a-schemas.md) - Full TodoItem schema
