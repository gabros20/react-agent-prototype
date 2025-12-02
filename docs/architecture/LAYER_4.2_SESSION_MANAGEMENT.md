# Layer 4.2: Session Management

> Chat persistence, message storage, and working context

## Overview

The SessionService manages conversation state across agent interactions. It persists chat messages to SQLite, auto-generates smart titles from user input, and stores WorkingContext state for entity tracking between sessions.

**Key Changes (AI SDK 6 Migration):**
- Checkpoint system removed (was dead code)
- Messages saved at end of execution only
- No mid-step checkpointing needed
- NEW: ConversationLogs table for debug trace persistence (see Layer 4 Services)

---

## The Problem

Without proper session management, conversations are lost:

```typescript
// WRONG: Messages lost on refresh
const messages = []; // In-memory only

// WRONG: Agent has no history
const result = await agent.execute(prompt);
// Next request: agent doesn't know what happened before

// WRONG: No way to resume conversations
// User closes browser, conversation gone forever

// WRONG: Manual title management
session.title = "Untitled Session";
// User has to manually rename every session
```

**Our Solution:**
1. SQLite persistence for messages and sessions
2. Load/save methods compatible with AI SDK v6
3. Auto-generate titles from first user message
4. WorkingContext serialization for entity state

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SESSION MANAGEMENT                           │
│                                                                 │
│  Frontend                                                       │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   SessionService                        │    │
│  │                                                         │    │
│  │  Session Operations:                                    │    │
│  │  ├─ createSession(title?)                               │    │
│  │  ├─ listSessions()          → SessionWithMetadata[]     │    │
│  │  ├─ getSessionById(id)      → Session + Messages        │    │
│  │  ├─ updateSession(id, data)                             │    │
│  │  └─ deleteSession(id)                                   │    │
│  │                                                         │    │
│  │  Message Operations:                                    │    │
│  │  ├─ addMessage(sessionId, msg)                          │    │
│  │  ├─ clearMessages(sessionId)                            │    │
│  │  ├─ loadMessages(sessionId)  → CoreMessage[]            │    │
│  │  └─ saveMessages(sessionId, msgs)                       │    │
│  │                                                         │    │
│  │  WorkingContext Operations:                             │    │
│  │  ├─ saveWorkingContext(sessionId, context)              │    │
│  │  └─ loadWorkingContext(sessionId) → WorkingContext      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                        │
│                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      SQLite                             │    │
│  │                                                         │    │
│  │  sessions                    messages                   │    │
│  │  ├─ id (UUID)               ├─ id (UUID)                │    │
│  │  ├─ title                   ├─ sessionId (FK)           │    │
│  │  ├─ workingContext (JSON)   ├─ role (enum)              │    │
│  │  ├─ archived                ├─ content (JSON)           │    │
│  │  ├─ createdAt               ├─ toolName                 │    │
│  │  └─ updatedAt               └─ createdAt                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Notes**:
- `checkpoint` column removed from sessions table
- `conversation_logs` table added for debug trace persistence (see ConversationLogService in Layer 4)

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/session-service.ts` | Session and message management |
| `server/db/schema.ts` | Sessions and messages table definitions |
| `server/routes/sessions.ts` | Session REST endpoints |
| `server/services/working-memory/` | WorkingContext for entity state |

---

## Core Implementation

### Session CRUD

```typescript
// server/services/session-service.ts
export class SessionService {
  constructor(private db: DrizzleDB) {}

  async createSession(input: CreateSessionInput = {}) {
    const session = {
      id: randomUUID(),
      title: input.title || "New Session",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.sessions).values(session);
    return session;
  }

  async listSessions(): Promise<SessionWithMetadata[]> {
    const sessionsData = await this.db.query.sessions.findMany({
      with: {
        messages: {
          orderBy: desc(schema.messages.createdAt),
          limit: 1,
        },
      },
      orderBy: desc(schema.sessions.updatedAt),
    });

    return sessionsData.map((session) => {
      const lastMessage = session.messages[0];
      const lastActivity = lastMessage?.createdAt || session.updatedAt;

      return {
        id: session.id,
        title: session.title,
        messageCount: session.messages.length,
        lastActivity,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
    });
  }

  async deleteSession(sessionId: string) {
    const existing = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!existing) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Messages cascade-deleted via FK
    await this.db.delete(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));

    return { success: true, deletedId: sessionId };
  }
}
```

### Message Management

```typescript
async addMessage(sessionId: string, input: CreateMessageInput) {
  const session = await this.db.query.sessions.findFirst({
    where: eq(schema.sessions.id, sessionId),
  });

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const message = {
    id: randomUUID(),
    sessionId,
    role: input.role,
    content: JSON.stringify(input.content),
    toolName: input.toolName || null,
    createdAt: new Date(),
  };

  await this.db.insert(schema.messages).values(message);

  // Update session timestamp
  await this.db.update(schema.sessions)
    .set({ updatedAt: new Date() })
    .where(eq(schema.sessions.id, sessionId));

  // Auto-generate title from first user message
  const messageCount = await this.db.query.messages.findMany({
    where: eq(schema.messages.sessionId, sessionId),
  });

  if (messageCount.length === 1 && input.role === "user") {
    const smartTitle = this.generateSmartTitle([input.content]);
    await this.db.update(schema.sessions)
      .set({ title: smartTitle })
      .where(eq(schema.sessions.id, sessionId));
  }

  return message;
}

async clearMessages(sessionId: string) {
  await this.db.delete(schema.messages)
    .where(eq(schema.messages.sessionId, sessionId));

  await this.db.update(schema.sessions)
    .set({ updatedAt: new Date() })
    .where(eq(schema.sessions.id, sessionId));

  return { success: true };
}
```

### Message Load/Save for AI SDK

```typescript
/**
 * Load messages as CoreMessage array (for AI SDK v6)
 */
async loadMessages(sessionId: string): Promise<CoreMessage[]> {
  const session = await this.getSessionById(sessionId);

  return session.messages.map((msg: any) => ({
    role: msg.role,
    content: typeof msg.content === 'string'
      ? JSON.parse(msg.content)
      : msg.content
  }));
}

/**
 * Save messages array (after agent completes)
 */
async saveMessages(sessionId: string, messages: CoreMessage[]) {
  // Create session if doesn't exist
  let session = await this.db.query.sessions.findFirst({
    where: eq(schema.sessions.id, sessionId),
  });

  if (!session) {
    await this.db.insert(schema.sessions).values({
      id: sessionId,
      title: 'New Session',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Clear existing messages
  await this.db.delete(schema.messages)
    .where(eq(schema.messages.sessionId, sessionId));

  // Insert all messages
  for (const msg of messages) {
    await this.addMessage(sessionId, {
      role: msg.role,
      content: msg.content,
    });
  }

  return { success: true, messageCount: messages.length };
}
```

### Smart Title Generation

```typescript
generateSmartTitle(messages: any[]): string {
  const firstUserMessage = messages.find(
    (m) => typeof m === "string" || (m && m.role === "user")
  );

  if (!firstUserMessage) {
    return "New Session";
  }

  const content = typeof firstUserMessage === "string"
    ? firstUserMessage
    : firstUserMessage.content || "New Session";

  // Extract first 40 chars, clean up
  const title = content
    .slice(0, 40)
    .replace(/\n/g, " ")
    .trim();

  return title.length < content.length ? `${title}...` : title;
}
```

### WorkingContext Persistence

```typescript
async saveWorkingContext(sessionId: string, context: WorkingContext): Promise<void> {
  const state = context.toJSON();
  await this.db.update(schema.sessions)
    .set({ workingContext: JSON.stringify(state) })
    .where(eq(schema.sessions.id, sessionId));
}

async loadWorkingContext(sessionId: string): Promise<WorkingContext> {
  const session = await this.db.query.sessions.findFirst({
    where: eq(schema.sessions.id, sessionId),
  });

  if (!session?.workingContext || typeof session.workingContext !== 'string') {
    return new WorkingContext();
  }

  try {
    const state = JSON.parse(session.workingContext) as WorkingContextState;
    return WorkingContext.fromJSON(state);
  } catch (error) {
    return new WorkingContext();
  }
}
```

---

## Removed: Checkpoint System

The checkpoint system was dead code and has been removed:

### What Was Removed

```typescript
// REMOVED from schema.ts
// checkpoint: text("checkpoint"),

// REMOVED from session-service.ts
// async saveCheckpoint(sessionId: string, state: CheckpointState)
// async loadCheckpoint(sessionId: string)
// async clearCheckpoint(sessionId: string)

// REMOVED from routes/sessions.ts
// DELETE /:id/checkpoint

// REMOVED from app/api
// app/api/sessions/[sessionId]/checkpoint/route.ts
```

### Why Removed

1. **Never used** - Checkpoint column was always null
2. **CMS agent is fast** - Completes in seconds, not minutes
3. **Messages suffice** - Saved at end of execution
4. **Copied from wrong pattern** - Coding agents need checkpoints, CMS agents don't

---

## Usage in Agent Route

```typescript
// server/routes/agent.ts
router.post('/stream', async (req, res) => {
  const { sessionId, prompt } = req.body;
  const services = getContainer();

  // Load previous messages
  let previousMessages: CoreMessage[] = [];
  if (sessionId) {
    try {
      previousMessages = await services.sessionService.loadMessages(sessionId);
    } catch (error) {
      // Session might not exist yet
    }
  }

  // Load working context
  const workingContext = sessionId
    ? await services.sessionService.loadWorkingContext(sessionId)
    : new WorkingContext();

  // Run agent
  const result = await runAgent(
    [...previousMessages, { role: 'user', content: prompt }],
    options
  );

  // Save messages AFTER completion (no mid-step checkpoints)
  const updatedMessages = [
    ...previousMessages,
    { role: 'user', content: prompt },
    ...result.responseMessages,
  ];
  await services.sessionService.saveMessages(sessionId, updatedMessages);

  // Save working context
  await services.sessionService.saveWorkingContext(sessionId, workingContext);
});
```

---

## Design Decisions

### Why Store Messages as JSON?

```typescript
content: JSON.stringify(input.content)
```

**Reasons:**
1. **Flexible structure** - AI SDK messages can have complex content
2. **Tool calls** - Content can include tool call results
3. **Future-proof** - Schema doesn't need to change for new content types

### Why Auto-Generate Titles?

```typescript
if (messageCount.length === 1 && input.role === "user") {
  const smartTitle = this.generateSmartTitle([input.content]);
}
```

**Reasons:**
1. **Better UX** - Users don't have to manually title sessions
2. **Contextual** - Title reflects what user asked about
3. **First message only** - Title set once, not constantly changing

### Why Save Messages at End Only?

1. **Simpler** - No checkpoint logic needed
2. **Atomic** - All-or-nothing saves
3. **Fast** - CMS agent completes in seconds
4. **Reliable** - No partial state issues

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1.2 (Container) | Instantiated in ServiceContainer |
| Layer 1.5 (Routes) | Session routes call service methods |
| Layer 3.1 (ReAct Loop) | Agent saves messages at end |
| Layer 4.6 (Working Memory) | Persists WorkingContext state |
| Layer 6 (Client) | Frontend lists and selects sessions |

---

## Common Issues / Debugging

### Session Not Found

```
Error: Session not found: abc-123
```

**Fix:** Session auto-creates on first saveMessages call now.

### Messages Not Persisting

```
// Messages disappear after restart
```

**Cause:** Using in-memory state instead of service.

**Fix:** Always use SessionService.saveMessages after agent completes.

### JSON Parse Error

```
SyntaxError: Unexpected token in JSON
```

**Cause:** Content stored as non-JSON string.

**Fix:** Ensure content is stringified on save.

### WorkingContext Lost

**Cause:** WorkingContext not saved after agent execution.

**Fix:**
```typescript
await sessionService.saveWorkingContext(sessionId, workingContext);
```

---

## Further Reading

- [Layer 2.3: Content Model](./LAYER_2.3_CONTENT_MODEL.md) - Database schema
- [Layer 3.1: ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Agent execution
- [Layer 4.6: Working Memory](./LAYER_4.6_WORKING_MEMORY.md) - Entity state persistence
- [Layer 6: Client](./LAYER_6_CLIENT.md) - Session selection UI
