# Layer 4.2: Session Management

> Chat persistence, message storage, and AI SDK v6 checkpointing

## Overview

The SessionService manages conversation state across agent interactions. It persists chat messages to SQLite, provides checkpoint/restore capabilities for AI SDK v6, auto-generates smart titles from first user message, and stores WorkingContext state for entity tracking between sessions.

**Key Responsibilities:**
- Create and manage chat sessions
- Persist messages for conversation history
- Load/save messages for AI SDK v6 checkpointing
- Auto-generate smart titles from user input
- Store and restore WorkingContext state

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
│                    SESSION MANAGEMENT                            │
│                                                                  │
│  Frontend                                                        │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   SessionService                         │    │
│  │                                                          │    │
│  │  Session Operations:                                     │    │
│  │  ├─ createSession(title?)                               │    │
│  │  ├─ listSessions()          → SessionWithMetadata[]     │    │
│  │  ├─ getSessionById(id)      → Session + Messages        │    │
│  │  ├─ updateSession(id, data)                             │    │
│  │  └─ deleteSession(id)                                   │    │
│  │                                                          │    │
│  │  Message Operations:                                     │    │
│  │  ├─ addMessage(sessionId, msg)                          │    │
│  │  ├─ clearMessages(sessionId)                            │    │
│  │  ├─ loadMessages(sessionId)  → CoreMessage[]            │    │
│  │  └─ saveMessages(sessionId, msgs)                       │    │
│  │                                                          │    │
│  │  WorkingContext Operations:                              │    │
│  │  ├─ saveWorkingContext(sessionId, context)              │    │
│  │  └─ loadWorkingContext(sessionId) → WorkingContext      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      SQLite                              │    │
│  │                                                          │    │
│  │  sessions                    messages                    │    │
│  │  ├─ id (UUID)               ├─ id (UUID)                │    │
│  │  ├─ title                   ├─ sessionId (FK)           │    │
│  │  ├─ checkpoint (JSON)       ├─ role (enum)              │    │
│  │  ├─ workingContext (JSON)   ├─ content (JSON)           │    │
│  │  ├─ archived                ├─ toolName                 │    │
│  │  ├─ createdAt               ├─ stepIdx                  │    │
│  │  └─ updatedAt               └─ createdAt                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

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
      checkpoint: null,
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
          limit: 1, // Only get last message for timestamp
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

  async getSessionById(sessionId: string) {
    const session = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
      with: {
        messages: {
          orderBy: schema.messages.createdAt,
        },
      },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session;
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
  // Verify session exists
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
    stepIdx: input.stepIdx || null,
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
  const session = await this.db.query.sessions.findFirst({
    where: eq(schema.sessions.id, sessionId),
  });

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  await this.db.delete(schema.messages)
    .where(eq(schema.messages.sessionId, sessionId));

  await this.db.update(schema.sessions)
    .set({ updatedAt: new Date() })
    .where(eq(schema.sessions.id, sessionId));

  return { success: true, clearedSessionId: sessionId };
}
```

### AI SDK v6 Checkpointing

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
 * Save messages array (for AI SDK v6 checkpointing)
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

  // Auto-generate title from first user message
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length > 0) {
    const smartTitle = this.generateSmartTitle(userMessages);
    await this.db.update(schema.sessions)
      .set({ title: smartTitle })
      .where(eq(schema.sessions.id, sessionId));
  }

  return { success: true, messageCount: messages.length };
}
```

### Smart Title Generation

```typescript
/**
 * Generate smart title from first user message
 */
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
/**
 * Save working context to session
 */
async saveWorkingContext(sessionId: string, context: WorkingContext): Promise<void> {
  const state = context.toJSON();
  await this.db.update(schema.sessions)
    .set({ workingContext: JSON.stringify(state) })
    .where(eq(schema.sessions.id, sessionId));
}

/**
 * Load working context from session
 */
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
    // If parsing fails, return empty context
    return new WorkingContext();
  }
}
```

---

## Design Decisions

### Why Store Messages as JSON?

```typescript
// Schema
content: JSON.stringify(input.content)

// Load
content: JSON.parse(msg.content)
```

**Reasons:**
1. **Flexible structure** - AI SDK messages can have complex content
2. **Tool calls** - Content can include tool call results
3. **Future-proof** - Schema doesn't need to change for new content types
4. **SQLite compatibility** - SQLite stores JSON as TEXT

### Why Auto-Generate Titles?

```typescript
if (messageCount.length === 1 && input.role === "user") {
  const smartTitle = this.generateSmartTitle([input.content]);
}
```

**Reasons:**
1. **UX improvement** - Users don't have to manually title sessions
2. **Contextual** - Title reflects what user asked about
3. **Discoverable** - Easy to find sessions by topic
4. **First message only** - Title set once, not constantly changing

### Why Session Auto-Creation in saveMessages?

```typescript
if (!session) {
  await this.db.insert(schema.sessions).values({
    id: sessionId,
    title: 'New Session',
    ...
  });
}
```

**Reasons:**
1. **Agent route simplicity** - Agent can save without pre-creating session
2. **Session ID from client** - Client generates UUID, server creates session
3. **Idempotent** - Safe to call multiple times with same ID

### Why Cascade Delete Messages?

```sql
-- FK constraint
messages.sessionId REFERENCES sessions.id ON DELETE CASCADE
```

**Reasons:**
1. **Data integrity** - No orphaned messages
2. **Simple cleanup** - Delete session, messages go with it
3. **Atomic** - Single operation cleans up everything

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1.2 (Container) | Instantiated in ServiceContainer |
| Layer 1.5 (Routes) | Session routes call service methods |
| Layer 3.1 (ReAct Loop) | Agent saves/loads messages |
| Layer 4.6 (Working Memory) | Persists WorkingContext state |
| Layer 6 (Client) | Frontend lists and selects sessions |

### Agent Route Integration

```typescript
// server/routes/agent.ts
router.post('/stream', async (req, res) => {
  const { sessionId, prompt } = req.body;

  // Load previous messages
  let previousMessages: CoreMessage[] = [];
  if (sessionId) {
    try {
      previousMessages = await services.sessionService.loadMessages(sessionId);
    } catch (error) {
      // Session might not exist yet
    }
  }

  // Execute agent
  const result = await streamAgentWithApproval(prompt, context, previousMessages);

  // Save updated conversation
  if (sessionId) {
    const updatedMessages: CoreMessage[] = [
      ...previousMessages,
      { role: 'user', content: prompt },
      ...result.response.messages
    ];
    await services.sessionService.saveMessages(sessionId, updatedMessages);
  }
});
```

---

## Common Issues / Debugging

### Session Not Found

```
Error: Session not found: abc-123
```

**Cause:** Session ID doesn't exist in database.

**Fix:** Check if session was created:

```typescript
// Create session first
const session = await sessionService.createSession();
// Then use session.id for messages
```

### Messages Not Persisting

```
// Messages disappear after restart
```

**Cause:** Using in-memory state instead of service.

**Fix:** Always use SessionService:

```typescript
// WRONG: In-memory array
const messages = [];
messages.push(newMessage);

// RIGHT: Persist via service
await sessionService.addMessage(sessionId, {
  role: 'user',
  content: 'Hello',
});
```

### JSON Parse Error on Load

```
SyntaxError: Unexpected token in JSON
```

**Cause:** Content stored as non-JSON string.

**Debug:**

```typescript
const session = await getSessionById(id);
console.log('Raw content:', session.messages[0].content);
console.log('Type:', typeof session.messages[0].content);
```

**Fix:** Ensure content is stringified on save:

```typescript
content: JSON.stringify(input.content)
```

### WorkingContext Lost

```
// Entity references not available after reload
```

**Cause:** WorkingContext not saved to session.

**Fix:** Save after agent execution:

```typescript
// After agent completes
await sessionService.saveWorkingContext(sessionId, workingContext);

// On next request
const context = await sessionService.loadWorkingContext(sessionId);
```

### Title Not Updating

```
// Session still shows "New Session"
```

**Cause:** First message wasn't a user message, or content was empty.

**Debug:**

```typescript
const messages = await sessionService.loadMessages(sessionId);
console.log('First message:', messages[0]);
console.log('Role:', messages[0].role);
```

---

## Further Reading

- [Layer 2.3: Content Model](./LAYER_2.3_CONTENT_MODEL.md) - Database schema
- [Layer 3.1: ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Agent checkpointing
- [Layer 4.6: Working Memory](./LAYER_4.6_WORKING_MEMORY.md) - Entity state persistence
- [Layer 6: Client](./LAYER_6_CLIENT.md) - Session selection UI
- [AI SDK v6 Checkpointing](https://sdk.vercel.ai/docs/ai-sdk-core/agents)
