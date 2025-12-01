# AI SDK 6 Migration Plan

> **Status**: Ready for Implementation
> **Created**: 2025-12-01
> **Current Version**: ai@6.0.0-beta.95
> **Target**: Native AI SDK 6 patterns replacing custom solutions

---

## Executive Summary

This plan migrates custom agent implementations to native AI SDK 6 patterns for improved maintainability, type safety, and reduced code complexity.

### Migration Overview

| Area | Current | AI SDK 6 Native | Priority |
|------|---------|-----------------|----------|
| Retry Logic | Custom while loop + exponential backoff | `maxRetries` (default: 2) | HIGH |
| Stop Conditions | Custom `stopWhen` callback | Native `stepCountIs()`, `hasToolCall()` | MEDIUM |
| HITL Approval | Custom `ApprovalQueue` + `tool-approval-request` | Native `needsApproval` + state management | HIGH |
| prepareStep | Custom callback | Native `prepareStep` | KEEP |
| Working Memory | Custom `EntityExtractor` + `WorkingContext` | NO SDK EQUIVALENT | KEEP |
| Context Injection | `experimental_context` | `callOptionsSchema` + `prepareCall` | HIGH |
| Message Trimming | Custom in prepareStep | Native `prepareStep` | KEEP |
| Checkpoint System | Dead code (never used) | REMOVE ENTIRELY | HIGH |
| Error Handling | `APICallError.isInstance()` | SDK error types + `onError` | MEDIUM |

### Checkpoint System Removal Rationale

The checkpoint system is **dead code** that was copied from coding agent patterns (like Claude Code). Analysis reveals:

1. **Database `checkpoint` column**: Always `null`, never written to
2. **Orchestrator "checkpoint" logic** (lines 123-137): Misnomer - just saves messages to DB, doesn't use checkpoint field
3. **clearCheckpoint API**: Exists but pointless since checkpoint is never set

**Why we don't need it**:
- CMS agent completes in seconds, not minutes
- Short tool chains (1-5 tools per request)
- Stateless tool execution
- Messages already persisted per-message (source of truth)
- No long-running builds/tests that need resume
- No file system operations needing rollback

**What to keep**: The `saveMessages()` call is useful for message persistence, but remove all checkpoint-specific code.

---

## Phase 1: Create Centralized Agent Module

### 1.1 Create New Agent File

**File**: `server/agent/cms-agent.ts` (NEW)

**Why**: Centralize agent as module-level singleton using `ToolLoopAgent` class.

```typescript
// server/agent/cms-agent.ts
import { ToolLoopAgent, stepCountIs, tool, type StopCondition } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { ALL_TOOLS } from '../tools/all-tools';
import { getSystemPrompt } from './system-prompt';
import type { AgentContext } from '../tools/types';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// ============================================================================
// Call Options Schema (replaces experimental_context typing)
// ============================================================================

export const AgentCallOptionsSchema = z.object({
  sessionId: z.string(),
  traceId: z.string(),
  workingMemory: z.string().optional(),
  cmsTarget: z.object({
    siteId: z.string(),
    environmentId: z.string(),
  }),
  // Runtime injected services (passed through to tools)
  db: z.custom<any>(),
  services: z.custom<any>(),
  sessionService: z.custom<any>(),
  vectorIndex: z.custom<any>(),
  logger: z.custom<any>(),
  stream: z.custom<any>().optional(),
});

export type AgentCallOptions = z.infer<typeof AgentCallOptionsSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

const AGENT_CONFIG = {
  maxSteps: 15,
  modelId: 'openai/gpt-4o-mini',
  maxOutputTokens: 4096,
};

// ============================================================================
// Custom Stop Condition: FINAL_ANSWER Detection
// ============================================================================

const hasFinalAnswer: StopCondition<typeof ALL_TOOLS> = ({ steps }) => {
  const lastStep = steps[steps.length - 1];
  return lastStep?.text?.includes('FINAL_ANSWER:') || false;
};

// ============================================================================
// CMS Agent Definition
// ============================================================================

export const cmsAgent = new ToolLoopAgent({
  model: openrouter.languageModel(AGENT_CONFIG.modelId),

  // Dynamic instructions with call options
  instructions: ({ options }) =>
    getSystemPrompt({
      toolsList: Object.keys(ALL_TOOLS),
      toolCount: Object.keys(ALL_TOOLS).length,
      sessionId: options.sessionId,
      currentDate: new Date().toISOString().split('T')[0],
      workingMemory: options.workingMemory || '',
    }),

  tools: ALL_TOOLS,

  callOptionsSchema: AgentCallOptionsSchema,

  // Inject runtime context for tools
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
    experimental_context: {
      db: options.db,
      services: options.services,
      sessionService: options.sessionService,
      vectorIndex: options.vectorIndex,
      logger: options.logger,
      stream: options.stream,
      traceId: options.traceId,
      sessionId: options.sessionId,
      cmsTarget: options.cmsTarget,
    } as AgentContext,
  }),

  // Native stop conditions (combined with OR logic)
  stopWhen: [stepCountIs(AGENT_CONFIG.maxSteps), hasFinalAnswer],

  // Context window management
  prepareStep: async ({ stepNumber, messages, steps }) => {
    // Trim history if too long (prevent token overflow)
    if (messages.length > 20) {
      return {
        messages: [
          messages[0], // Keep system prompt
          ...messages.slice(-10), // Keep last 10 messages
        ],
      };
    }
    return {};
  },

  // Step completion callback for telemetry
  onStepFinish: async ({ stepNumber, toolCalls, toolResults, usage, finishReason }) => {
    // Logging handled by caller via options.logger
    // No mid-execution checkpointing needed - messages saved at end via onFinish
  },
});
```

### 1.2 Extract System Prompt Generator

**File**: `server/agent/system-prompt.ts` (NEW)

```typescript
// server/agent/system-prompt.ts
import Handlebars from 'handlebars';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SystemPromptContext {
  toolsList: string[];
  toolCount: number;
  sessionId: string;
  currentDate: string;
  workingMemory?: string;
}

let compiledTemplate: HandlebarsTemplateDelegate | null = null;

export function getSystemPrompt(context: SystemPromptContext): string {
  // Lazy load and compile template
  if (!compiledTemplate) {
    const promptPath = path.join(__dirname, '../prompts/react.xml');
    const template = fs.readFileSync(promptPath, 'utf-8');
    compiledTemplate = Handlebars.compile(template);
  }

  return compiledTemplate({
    ...context,
    toolsFormatted: context.toolsList.map((t) => `- ${t}`).join('\n'),
    workingMemory: context.workingMemory || '',
  });
}
```

---

## Phase 2: Simplify Retry Logic

### 2.1 Remove Custom Retry Implementation

**File**: `server/agent/orchestrator.ts`

**Remove**: Lines 185-288 (`executeAgentWithRetry`) and 294-633 (`streamAgentWithApproval`) custom retry while loops.

**Replace with**: Native `maxRetries` parameter

```typescript
// Native retry is built into streamText/generateText
// Default: maxRetries: 2

const result = await cmsAgent.stream({
  messages,
  options: callOptions,
  maxRetries: 3, // Native exponential backoff for 429, 5xx errors
});
```

### 2.2 Keep Error Classification

The `APICallError.isInstance()` check for non-recoverable 4xx errors should move to `onError`:

```typescript
// In route handler or agent usage
const result = await streamText({
  // ...config
  onError: ({ error }) => {
    if (APICallError.isInstance(error)) {
      if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        // Log non-recoverable error, don't retry
        logger.error('Non-recoverable API error', { statusCode: error.statusCode });
      }
    }
  },
});
```

---

## Phase 3: Upgrade Human-in-the-Loop (HITL)

### 3.1 Native `needsApproval` on Tools

**File**: `server/tools/all-tools.ts`

**Current**: Only `httpPost` has `needsApproval: true` (line 738)

**Migration**: Add dynamic `needsApproval` to destructive tools

```typescript
// Static approval (always requires)
export const httpPost = tool({
  description: 'Make HTTP POST request to external API',
  inputSchema: z.object({
    url: z.string(),
    body: z.record(z.string(), z.any()),
    headers: z.record(z.string(), z.string()).optional(),
  }),
  needsApproval: true, // Always requires approval
  execute: async (input, { experimental_context }) => {
    // Only runs after approval granted
  },
});

// Dynamic approval based on input
export const cmsDeleteImage = tool({
  description: 'Delete an image permanently',
  inputSchema: z.object({
    imageId: z.string(),
  }),
  needsApproval: true, // Destructive operation
  execute: async ({ imageId }, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    // Execute deletion
  },
});
```

### 3.2 Remove Custom Approval Queue

**File**: `server/services/approval-queue.ts` → DELETE

**Why**: AI SDK 6 handles approval state internally with `result.state.approve()` / `result.state.reject()`

### 3.3 Keep `confirmed` Flag Pattern

The `confirmed: true` pattern on `cmsDeletePage`, `cmsDeletePageSection`, `cmsDeletePageSections` is **application-level prompt engineering**, NOT SDK HITL.

**Decision**: KEEP AS-IS

This pattern:
1. Agent calls tool without `confirmed` flag
2. Tool returns `requiresConfirmation: true`
3. Agent asks user for confirmation
4. User says "yes"
5. Agent calls tool again with `confirmed: true`

This is correct behavior for in-conversation confirmation flows.

### 3.4 Frontend Approval Handling

**File**: Update frontend to use AI SDK 6 approval states

```typescript
// Frontend component handling tool approval
import { useChat } from '@ai-sdk/react';

function ChatMessage({ part }) {
  if (part.state === 'approval-requested') {
    return (
      <div className="approval-dialog">
        <p>Tool "{part.toolName}" requires approval</p>
        <p>Input: {JSON.stringify(part.input)}</p>
        <button onClick={() => part.approve()}>Approve</button>
        <button onClick={() => part.reject('User declined')}>Reject</button>
      </div>
    );
  }

  if (part.state === 'approval-responded') {
    return <p>Approved - executing...</p>;
  }

  if (part.state === 'output-denied') {
    return <p>Rejected by user</p>;
  }

  // ... other states
}
```

---

## Phase 4: Type-Safe Context Injection

### 4.1 Replace `experimental_context` Pattern

**Current** (`orchestrator.ts:375`):
```typescript
experimental_context: context,
```

**Migration**: Use `callOptionsSchema` + `prepareCall` (see Phase 1.1)

The `prepareCall` function receives typed `options` and injects them into `experimental_context` for tools:

```typescript
prepareCall: ({ options, ...settings }) => ({
  ...settings,
  experimental_context: {
    db: options.db,
    services: options.services,
    // ... other context
  } as AgentContext,
}),
```

### 4.2 Tool Access Pattern (Unchanged)

Tools continue to access context the same way:

```typescript
execute: async (input, { experimental_context }) => {
  const ctx = experimental_context as AgentContext;
  await ctx.services.pageService.getPageBySlug(input.slug);
}
```

---

## Phase 5: Remove Checkpoint System (Dead Code Cleanup)

The checkpoint system is dead code that was never properly implemented. This phase removes it entirely.

### 5.1 Database Schema Change

**File**: `server/db/schema.ts`

**Action**: Remove `checkpoint` column from sessions table

```typescript
// REMOVE this line from sessions table definition:
// checkpoint: text("checkpoint"), // line ~377

// The sessions table should only have:
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("New Session"),
  workingContext: text("working_context"), // Keep this - used for working memory
  archived: integer("archived", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

**Database migration**:
```sql
ALTER TABLE sessions DROP COLUMN checkpoint;
```

### 5.2 Remove Session Service Checkpoint Methods

**File**: `server/services/session-service.ts`

**Remove**:
- `checkpoint: null` from `createSession()` (line ~43)
- `clearCheckpoint()` method entirely (lines ~215-230)

```typescript
// REMOVE this method entirely:
// async clearCheckpoint(sessionId: string) { ... }

// REMOVE checkpoint: null from createSession:
async createSession(input: CreateSessionInput = {}) {
  const session = {
    id: randomUUID(),
    title: input.title || "New Session",
    // checkpoint: null,  ← REMOVE THIS LINE
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  // ...
}
```

### 5.3 Remove Checkpoint API Routes

**File**: `server/routes/sessions.ts`

**Remove**: DELETE `/:id/checkpoint` endpoint (lines ~117-123)

```typescript
// REMOVE this entire route:
// router.delete("/:id/checkpoint", async (req, res) => {
//   const { id } = req.params;
//   const result = await sessionService.clearCheckpoint(id);
//   res.json(result);
// });
```

**File**: `app/api/sessions/[sessionId]/checkpoint/route.ts`

**Action**: DELETE entire file

### 5.4 Remove Frontend Checkpoint References

**File**: `app/assistant/_stores/session-store.ts`

**Remove**: Checkpoint clearing from `clearHistory()` (lines ~217-224)

```typescript
// REMOVE checkpoint clearing logic:
// In clearHistory(), remove any calls to clear checkpoint
async clearHistory() {
  // Keep message clearing
  await fetch(`/api/sessions/${this.sessionId}/messages`, { method: 'DELETE' });

  // REMOVE this:
  // await fetch(`/api/sessions/${this.sessionId}/checkpoint`, { method: 'DELETE' });
}
```

**File**: `components/ai-elements/checkpoint.tsx`

**Action**: DELETE entire file (unused UI component)

### 5.5 Remove Orchestrator "Checkpoint" Logic

**File**: `server/agent/orchestrator.ts`

**Remove**: Lines 123-137 (the misnamed "checkpoint" logic in prepareStep)

```typescript
// REMOVE this block from prepareStep:
// // Auto-checkpoint every 3 steps
// if (stepNumber % 3 === 0 && stepNumber > 0) {
//   await sessionService.saveMessages(sessionId, messages);
// }
```

**Note**: Message saving at the END of agent execution (in `onFinish`) is still useful and should be kept. The per-3-steps saving is unnecessary overhead for a CMS agent.

### 5.6 Update Documentation

**Files to update**:
- `docs/knowledge-base/4-state/4.4.1-why-checkpoint.md` → DELETE or mark as "Not applicable to CMS agent"
- Any other docs referencing checkpoints

### 5.7 Files Summary for Checkpoint Removal

| File | Action |
|------|--------|
| `server/db/schema.ts` | Remove `checkpoint` column |
| `server/services/session-service.ts` | Remove `checkpoint: null`, `clearCheckpoint()` |
| `server/routes/sessions.ts` | Remove DELETE `/:id/checkpoint` route |
| `app/api/sessions/[sessionId]/checkpoint/route.ts` | DELETE entire file |
| `app/assistant/_stores/session-store.ts` | Remove checkpoint clearing |
| `components/ai-elements/checkpoint.tsx` | DELETE entire file |
| `server/agent/orchestrator.ts` | Remove "checkpoint" logic in prepareStep |
| `docs/knowledge-base/4-state/4.4.1-why-checkpoint.md` | DELETE or update |

---

## Phase 6: Update Routes for Native Streaming

### 6.1 Use `createAgentUIStreamResponse`

**File**: `server/routes/agent.ts`

**Current**: Manual SSE + custom event handling

**Migration**:

```typescript
// server/routes/agent.ts
import { createAgentUIStreamResponse } from 'ai';
import { cmsAgent } from '../agent/cms-agent';

router.post('/stream', async (req, res) => {
  const input = agentRequestSchema.parse(req.body);
  const sessionId = input.sessionId || randomUUID();
  const traceId = randomUUID();

  // Load working memory
  const workingContext = getWorkingContext(sessionId);

  // Load previous messages
  const previousMessages = input.sessionId
    ? await services.sessionService.loadMessages(input.sessionId)
    : [];

  const messages = [
    ...previousMessages,
    { role: 'user', content: input.prompt },
  ];

  // Get CMS target
  const cmsTarget = await resolveCmsTarget(input.cmsTarget, services.db);

  // Create agent call options
  const options = {
    sessionId,
    traceId,
    workingMemory: workingContext.toContextString(),
    cmsTarget,
    db: services.db,
    services,
    sessionService: services.sessionService,
    vectorIndex: services.vectorIndex,
    logger: createLogger(traceId, res),
    stream: createSSEWriter(res),
  };

  // Use native agent UI stream response
  return createAgentUIStreamResponse({
    agent: cmsAgent,
    messages,
    options,
    onFinish: async ({ messages: finalMessages }) => {
      // Save conversation
      await services.sessionService.saveMessages(sessionId, finalMessages);

      // Extract entities to working memory
      // (Custom logic - keep from current implementation)
    },
  });
});
```

### 6.2 Keep Custom SSE for Debug Events

The debug panel uses custom SSE events (`system-prompt`, `log`). Keep these alongside native streaming:

```typescript
function createLogger(traceId: string, res: Response) {
  const writeSSE = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  return {
    info: (msg: string | object, meta?: any) => {
      console.log('[INFO]', msg, meta);
      writeSSE('log', { type: 'log', level: 'info', message: msg, metadata: meta });
    },
    // ... warn, error
  };
}
```

---

## Phase 7: Working Memory (KEEP AS-IS)

### 7.1 No Migration Needed

**Files**:
- `server/services/working-memory/index.ts`
- `server/services/working-memory/working-context.ts`
- `server/services/working-memory/entity-extractor.ts`
- `server/services/working-memory/types.ts`

**Decision**: **KEEP CUSTOM IMPLEMENTATION**

**Why**:
1. AI SDK 6 has NO equivalent feature
2. Your implementation provides:
   - Session-scoped entity tracking (sliding window of 10)
   - Automatic extraction from tool results
   - Injection into system prompt as `[WORKING MEMORY]`
   - Enables pronoun resolution ("this page", "that section")
3. This is a competitive advantage

### 7.2 Continue Entity Extraction in Route Handler

```typescript
// In stream handler, extract entities from tool results
for await (const chunk of result.fullStream) {
  if (chunk.type === 'tool-result') {
    const entities = extractor.extract(chunk.toolName, chunk.output);
    if (entities.length > 0) {
      workingContext.addMany(entities);
    }
  }
}
```

---

## Phase 8: Message Persistence Updates

### 8.1 Update to UIMessage Format

**File**: `server/services/session-service.ts`

AI SDK 6 recommends storing `UIMessage[]` format (includes `id`, `createdAt`, parts).

```typescript
// session-service.ts updates

import { createIdGenerator } from 'ai';

const generateMessageId = createIdGenerator({ prefix: 'msg', size: 16 });

export class SessionService {
  // ... existing methods

  /**
   * Save messages in UIMessage format
   */
  async saveUIMessages(sessionId: string, messages: UIMessage[]) {
    // Ensure session exists
    await this.ensureSession(sessionId);

    // Clear and re-insert (or use upsert logic)
    await this.db.delete(schema.messages).where(eq(schema.messages.sessionId, sessionId));

    for (const msg of messages) {
      await this.db.insert(schema.messages).values({
        id: msg.id || generateMessageId(),
        sessionId,
        role: msg.role,
        content: JSON.stringify(msg.parts || msg.content),
        createdAt: msg.createdAt || new Date(),
      });
    }
  }

  /**
   * Load messages as UIMessage array
   */
  async loadUIMessages(sessionId: string): Promise<UIMessage[]> {
    const session = await this.getSessionById(sessionId);

    return session.messages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      parts: JSON.parse(msg.content),
      createdAt: msg.createdAt,
    }));
  }
}
```

### 8.2 Use `consumeStream` for Disconnect Handling

```typescript
// Ensure messages saved even if client disconnects
result.consumeStream(); // No await - removes backpressure

return result.toUIMessageStreamResponse({
  onFinish: async ({ messages }) => {
    await sessionService.saveUIMessages(sessionId, messages);
  },
});
```

---

## Phase 9: Error Handling Standardization

### 9.1 Use Native Error Callbacks

**Current** (`orchestrator.ts:543-560`): Manual error handling in stream loop

**Migration**:

```typescript
const result = streamText({
  // ... config

  onError: ({ error }) => {
    logger.error('Stream error', { error: error.message });

    if (APICallError.isInstance(error)) {
      // Handle API errors
      if (error.statusCode === 429) {
        logger.warn('Rate limited - retry will happen automatically');
      }
    }
  },
});

// Handle errors in fullStream
for await (const part of result.fullStream) {
  switch (part.type) {
    case 'error':
      logger.error('Generation error', { error: part.error });
      stream.write({ type: 'error', error: part.error.message });
      break;

    case 'tool-error':
      logger.error('Tool error', { toolName: part.toolName, error: part.error });
      stream.write({ type: 'tool-error', toolName: part.toolName, error: part.error.message });
      break;

    case 'abort':
      logger.info('Stream aborted');
      break;
  }
}
```

---

## Files Summary

### Files to CREATE

| File | Purpose |
|------|---------|
| `server/agent/cms-agent.ts` | Centralized ToolLoopAgent definition |
| `server/agent/system-prompt.ts` | System prompt generator (extracted) |

### Files to MODIFY

| File | Changes |
|------|---------|
| `server/agent/orchestrator.ts` | Remove custom retry, remove checkpoint logic, simplify to use cms-agent |
| `server/routes/agent.ts` | Use `createAgentUIStreamResponse` |
| `server/routes/sessions.ts` | Remove checkpoint endpoint |
| `server/tools/all-tools.ts` | Add `needsApproval` to more destructive tools |
| `server/services/session-service.ts` | Update to UIMessage format, remove checkpoint methods |
| `server/db/schema.ts` | Remove `checkpoint` column |
| `app/assistant/_stores/session-store.ts` | Remove checkpoint clearing |

### Files to DELETE

| File | Reason |
|------|--------|
| `server/services/approval-queue.ts` | Replaced by native AI SDK 6 approval |
| `app/api/sessions/[sessionId]/checkpoint/route.ts` | Dead code - checkpoint never used |
| `components/ai-elements/checkpoint.tsx` | Unused UI component |
| `docs/knowledge-base/4-state/4.4.1-why-checkpoint.md` | Not applicable to CMS agent |

### Files to KEEP (No Changes)

| File | Reason |
|------|--------|
| `server/services/working-memory/*` | Custom > SDK (no equivalent) |
| `server/prompts/react.xml` | System prompt template |
| `server/tools/types.ts` | AgentContext interface |

---

## Migration Order

```
Phase 1 (Non-breaking) ──────────────────────────────────────────────
├── 1.1 Create server/agent/cms-agent.ts
├── 1.2 Create server/agent/system-prompt.ts
└── Test: Agent works alongside existing orchestrator

Phase 2 (Update Routes) ─────────────────────────────────────────────
├── 2.1 Update server/routes/agent.ts to use cmsAgent
├── 2.2 Remove custom retry logic
└── Test: Streaming works with native agent

Phase 3 (HITL Update) ───────────────────────────────────────────────
├── 3.1 Add needsApproval to destructive tools
├── 3.2 Update frontend approval handling
├── 3.3 Delete approval-queue.ts
└── Test: Tool approval works end-to-end

Phase 4 (Context & Persistence) ─────────────────────────────────────
├── 4.1 Implement callOptionsSchema + prepareCall
├── 4.2 Update session-service.ts for UIMessage format
└── Test: Type-safe context, messages persist correctly

Phase 5 (Dead Code Removal: Checkpoint System) ──────────────────────
├── 5.1 Remove checkpoint column from schema.ts
├── 5.2 Remove clearCheckpoint() from session-service.ts
├── 5.3 Remove DELETE /:id/checkpoint route
├── 5.4 Delete app/api/sessions/[sessionId]/checkpoint/route.ts
├── 5.5 Remove checkpoint clearing from session-store.ts
├── 5.6 Delete components/ai-elements/checkpoint.tsx
├── 5.7 Remove "checkpoint" logic from orchestrator.ts prepareStep
├── 5.8 Run database migration: DROP COLUMN checkpoint
├── 5.9 Delete docs/knowledge-base/4-state/4.4.1-why-checkpoint.md
└── Test: Sessions work without checkpoint field

Phase 6 (Final Cleanup) ─────────────────────────────────────────────
├── 6.1 Remove old orchestrator.ts functions
├── 6.2 Verify all dead code removed
├── 6.3 Run full test suite
└── Done!
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Beta API changes | Pin to specific version (6.0.0-beta.95) |
| Breaking frontend | Phase 3 frontend changes can be gradual |
| Working memory regression | No changes to working memory |
| Message format changes | Migrate session data before switching |

---

## Testing Checklist

### Core Agent Functionality
- [ ] Agent responds to user messages
- [ ] Multi-step tool execution works (up to 15 steps)
- [ ] Stop conditions work (stepCountIs, FINAL_ANSWER)
- [ ] Context window trimming works (>20 messages)

### Human-in-the-Loop
- [ ] Tool approval pauses execution (`needsApproval: true`)
- [ ] Approval accept continues execution
- [ ] Approval reject stops execution gracefully
- [ ] `confirmed` flag pattern still works for delete ops

### Working Memory (Custom - Unchanged)
- [ ] Working memory populates from tool results
- [ ] Pronoun resolution works ("this page", "that section")
- [ ] Entity sliding window (10 max) works

### Persistence
- [ ] Messages save at end of agent execution
- [ ] Client disconnect doesn't lose messages (`consumeStream`)
- [ ] Session persistence works across refreshes
- [ ] UIMessage format correctly serializes/deserializes

### Error Handling
- [ ] API errors handled gracefully
- [ ] Tool errors shown in debug panel
- [ ] Rate limits (429) trigger retry

### Checkpoint Removal Verification
- [ ] No checkpoint column in sessions table
- [ ] No checkpoint-related API endpoints
- [ ] No checkpoint references in frontend
- [ ] Sessions create/load without checkpoint field

---

## Phase 7: Migrate to Native `needsApproval` with Inline Chat Approval

### 7.1 Overview

**Current State**: Two conflicting HITL patterns exist:
1. **`confirmed` flag pattern** - Used by most destructive tools (cmsDeletePage, cmsDeletePost, etc.)
   - Requires 2 tool calls (first returns `requiresConfirmation`, second with `confirmed: true`)
   - Agent handles the back-and-forth conversationally
   - More tokens used, more complex flow

2. **`needsApproval: true`** - Only used by `httpPost`
   - Single tool call, SDK pauses execution
   - Emits `tool-approval-request` event
   - Currently not implemented on frontend

**Target State**: Unified `needsApproval` pattern with **inline chat approval UI**
- Single tool call (cost efficient)
- Native SDK state management
- Approval UI rendered inline in chat (not a popup)
- Better UX: user sees approval card in conversation flow

### 7.2 Benefits of Native `needsApproval`

| Aspect | `confirmed` flag | `needsApproval` |
|--------|------------------|-----------------|
| Tool calls | 2 (ask + confirm) | 1 |
| Token usage | Higher | Lower |
| State management | Agent must understand pattern | SDK handles |
| Atomicity | Tool can fail between calls | Single atomic execution |
| UX | Conversational (agent asks) | Inline approval card |

### 7.3 Tools to Migrate

**File**: `server/tools/all-tools.ts`

| Tool | Current | Migration |
|------|---------|-----------|
| `cmsDeletePage` | `confirmed` flag | Add `needsApproval: true` |
| `cmsDeletePageSection` | `confirmed` flag | Add `needsApproval: true` |
| `cmsDeletePageSections` | `confirmed` flag | Add `needsApproval: true` |
| `httpPost` | `needsApproval: true` | Keep as-is |

**File**: `server/tools/post-tools.ts`

| Tool | Current | Migration |
|------|---------|-----------|
| `cmsPublishPost` | `confirmed` flag | Add `needsApproval: true` |
| `cmsArchivePost` | `confirmed` flag | Add `needsApproval: true` |
| `cmsDeletePost` | `confirmed` flag | Add `needsApproval: true` |

**File**: `server/tools/image-tools.ts`

| Tool | Current | Migration |
|------|---------|-----------|
| `deleteImageTool` | Check implementation | Add `needsApproval: true` if destructive |

### 7.4 Tool Migration Pattern

**Before** (confirmed flag):
```typescript
export const cmsDeletePage = tool({
  description: 'Delete a page. DANGEROUS - requires confirmation.',
  inputSchema: z.object({
    slug: z.string().optional(),
    id: z.string().optional(),
    confirmed: z.boolean().optional().describe('Set to true to confirm deletion'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;

    if (!input.confirmed) {
      return {
        success: false,
        requiresConfirmation: true,
        message: `Are you sure you want to delete page "${input.slug}"?`,
      };
    }

    // Execute deletion
    await ctx.services.pageService.deletePage(input.id);
    return { success: true };
  },
});
```

**After** (needsApproval):
```typescript
export const cmsDeletePage = tool({
  description: 'Delete a page permanently. CASCADE: deletes all sections.',
  inputSchema: z.object({
    slug: z.string().optional().describe('Page slug to delete'),
    id: z.string().optional().describe('Page ID to delete'),
    removeFromNavigation: z.boolean().optional().describe('Also remove from navigation if present'),
  }),
  needsApproval: true,  // SDK handles approval flow
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;

    // This only runs AFTER user approves
    const page = await ctx.services.pageService.getPageBySlug(input.slug);
    await ctx.services.pageService.deletePage(page.id);

    return {
      success: true,
      message: `Deleted page "${page.title}"`,
      deletedId: page.id,
    };
  },
});
```

### 7.5 Backend: Handle Approval Events

**File**: `server/routes/agent.ts`

The `tool-approval-request` event is already handled. Ensure it sends proper SSE:

```typescript
case "tool-approval-request":
  writeSSE("approval-required", {
    type: "approval-required",
    approvalId: chunk.approvalId,
    toolName: chunk.toolCall.toolName,
    input: chunk.toolCall.input,
    // Add human-readable description based on tool
    description: getApprovalDescription(chunk.toolCall.toolName, chunk.toolCall.input),
    timestamp: new Date().toISOString(),
  });
  break;
```

**Helper function**:
```typescript
function getApprovalDescription(toolName: string, input: any): string {
  switch (toolName) {
    case 'cmsDeletePage':
      return `Delete page "${input.slug || input.id}"? This will permanently remove the page and all its sections.`;
    case 'cmsDeletePost':
      return `Permanently delete post "${input.postSlug}"? This cannot be undone.`;
    case 'cmsPublishPost':
      return `Publish post "${input.postSlug}"? This will make it publicly visible.`;
    case 'cmsArchivePost':
      return `Archive post "${input.postSlug}"? It will be hidden from public view.`;
    case 'httpPost':
      return `Send POST request to "${input.url}"?`;
    default:
      return `Execute ${toolName}?`;
  }
}
```

### 7.6 Frontend: Inline Approval Component

**File**: `app/assistant/_components/approval-card.tsx` (NEW)

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ApprovalCardProps {
  approvalId: string;
  toolName: string;
  description: string;
  input: Record<string, any>;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string, reason?: string) => void;
  status: 'pending' | 'approved' | 'rejected';
}

export function ApprovalCard({
  approvalId,
  toolName,
  description,
  input,
  onApprove,
  onReject,
  status,
}: ApprovalCardProps) {
  if (status === 'approved') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex items-center gap-2 py-3">
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700">Approved - executing...</span>
        </CardContent>
      </Card>
    );
  }

  if (status === 'rejected') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center gap-2 py-3">
          <X className="h-4 w-4 text-red-600" />
          <span className="text-sm text-red-700">Rejected by user</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Approval Required
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-gray-700">{description}</p>
        {Object.keys(input).length > 0 && (
          <pre className="mt-2 rounded bg-gray-100 p-2 text-xs">
            {JSON.stringify(input, null, 2)}
          </pre>
        )}
      </CardContent>
      <CardFooter className="gap-2 pt-0">
        <Button
          size="sm"
          variant="default"
          onClick={() => onApprove(approvalId)}
          className="bg-green-600 hover:bg-green-700"
        >
          <Check className="mr-1 h-3 w-3" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReject(approvalId, 'User declined')}
          className="border-red-300 text-red-600 hover:bg-red-50"
        >
          <X className="mr-1 h-3 w-3" />
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### 7.7 Frontend: Integrate Approval in Chat Stream

**File**: `app/assistant/_hooks/use-agent.ts`

Update to handle `approval-required` events and track approval states:

```typescript
interface ApprovalState {
  approvalId: string;
  toolName: string;
  description: string;
  input: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
}

// In the hook state:
const [approvals, setApprovals] = useState<Map<string, ApprovalState>>(new Map());

// Handle SSE event:
case 'approval-required':
  setApprovals(prev => new Map(prev).set(data.approvalId, {
    approvalId: data.approvalId,
    toolName: data.toolName,
    description: data.description,
    input: data.input,
    status: 'pending',
  }));
  break;

// Approval handlers:
const handleApprove = async (approvalId: string) => {
  setApprovals(prev => {
    const next = new Map(prev);
    const approval = next.get(approvalId);
    if (approval) {
      next.set(approvalId, { ...approval, status: 'approved' });
    }
    return next;
  });

  await fetch(`/api/agent/approve/${approvalId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: true }),
  });
};

const handleReject = async (approvalId: string, reason?: string) => {
  setApprovals(prev => {
    const next = new Map(prev);
    const approval = next.get(approvalId);
    if (approval) {
      next.set(approvalId, { ...approval, status: 'rejected' });
    }
    return next;
  });

  await fetch(`/api/agent/approve/${approvalId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: false, reason }),
  });
};
```

### 7.8 Backend: Approval Response Endpoint

**File**: `server/routes/agent.ts`

Add endpoint to handle approval responses:

```typescript
// POST /v1/agent/approve/:approvalId
router.post('/approve/:approvalId', async (req, res) => {
  const { approvalId } = req.params;
  const { approved, reason } = req.body;

  // The SDK's ToolLoopAgent handles approval state internally
  // This endpoint signals the approval to the waiting stream

  // Option 1: If using streaming with approval state
  // The stream result object has approve/reject methods

  // Option 2: Store approval in memory for polling
  approvalResponses.set(approvalId, { approved, reason, timestamp: new Date() });

  res.json({ success: true, approvalId, approved });
});
```

**Note**: The exact implementation depends on how AI SDK v6 handles approval continuation. May need to use:
- `result.state.approve(approvalId)` / `result.state.reject(approvalId)`
- Or a shared state mechanism between the streaming connection and approval endpoint

### 7.9 Render Approvals in Chat

**File**: `app/assistant/_components/chat-messages.tsx`

Insert approval cards inline in the message stream:

```tsx
function ChatMessages({ messages, approvals, onApprove, onReject }) {
  // Interleave approvals with messages based on timestamp
  const items = useMemo(() => {
    const allItems: Array<{ type: 'message' | 'approval'; data: any; timestamp: Date }> = [
      ...messages.map(m => ({ type: 'message' as const, data: m, timestamp: m.createdAt })),
      ...Array.from(approvals.values()).map(a => ({
        type: 'approval' as const,
        data: a,
        timestamp: new Date(), // Use actual timestamp from event
      })),
    ];
    return allItems.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [messages, approvals]);

  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        item.type === 'message' ? (
          <MessageBubble key={`msg-${idx}`} message={item.data} />
        ) : (
          <ApprovalCard
            key={`approval-${item.data.approvalId}`}
            {...item.data}
            onApprove={onApprove}
            onReject={onReject}
          />
        )
      ))}
    </div>
  );
}
```

### 7.10 Migration Steps

```
Phase 7.1 (Backend Tools) ───────────────────────────────────────────
├── 7.1.1 Update cmsDeletePage - add needsApproval, remove confirmed flag
├── 7.1.2 Update cmsDeletePageSection - add needsApproval, remove confirmed flag
├── 7.1.3 Update cmsDeletePageSections - add needsApproval, remove confirmed flag
├── 7.1.4 Update cmsPublishPost - add needsApproval, remove confirmed flag
├── 7.1.5 Update cmsArchivePost - add needsApproval, remove confirmed flag
├── 7.1.6 Update cmsDeletePost - add needsApproval, remove confirmed flag
├── 7.1.7 Keep httpPost as-is (already has needsApproval)
└── Test: Tools emit tool-approval-request event

Phase 7.2 (Backend Routes) ──────────────────────────────────────────
├── 7.2.1 Add getApprovalDescription helper
├── 7.2.2 Enhance approval-required SSE event with description
├── 7.2.3 Add POST /v1/agent/approve/:approvalId endpoint
└── Test: Approval events flow correctly

Phase 7.3 (Frontend Components) ─────────────────────────────────────
├── 7.3.1 Create ApprovalCard component
├── 7.3.2 Update use-agent hook to track approvals
├── 7.3.3 Add approve/reject handlers
├── 7.3.4 Integrate ApprovalCard in chat stream
└── Test: Inline approval UI works end-to-end

Phase 7.4 (Cleanup) ─────────────────────────────────────────────────
├── 7.4.1 Remove confirmed flag from tool schemas
├── 7.4.2 Remove requiresConfirmation return patterns
├── 7.4.3 Update system prompt if it mentions confirmed flag
└── Test: Full approval flow works without confirmed flag
```

### 7.11 Files Summary

| File | Action |
|------|--------|
| `server/tools/all-tools.ts` | Add `needsApproval`, remove `confirmed` flag |
| `server/tools/post-tools.ts` | Add `needsApproval`, remove `confirmed` flag |
| `server/tools/image-tools.ts` | Add `needsApproval` to delete tool |
| `server/routes/agent.ts` | Add approval endpoint, enhance SSE |
| `app/assistant/_components/approval-card.tsx` | NEW - Inline approval UI |
| `app/assistant/_hooks/use-agent.ts` | Handle approval state |
| `app/assistant/_components/chat-messages.tsx` | Render approvals inline |
| `server/prompts/react.xml` | Remove confirmed flag instructions |

### 7.12 Testing Checklist

- [x] Delete page triggers inline approval card
- [x] Approve button executes deletion
- [x] Reject button cancels with message
- [x] Approval card shows correct description
- [x] Multiple pending approvals render correctly
- [x] Approval state persists across component re-renders
- [x] httpPost approval works (existing)
- [x] Publish/archive post approval works
- [x] No `confirmed` flag references remain

**Phase 7 Status: COMPLETED** (2025-12-01)

Implementation Summary:
- All destructive tools use native `needsApproval: true`
- Backend routes handle `tool-approval-request` SSE events
- Frontend renders inline ApprovalCard components in chat
- System prompts updated to reflect native approval flow
- Confirmed flag pattern removed from all tools and prompts

---

## References

- [AI SDK 6 Beta Announcement](https://ai-sdk.dev/docs/announcing-ai-sdk-6-beta)
- [Building Agents](https://ai-sdk.dev/docs/agents/building-agents)
- [Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
- [Configuring Call Options](https://v6.ai-sdk.dev/docs/agents/configuring-call-options)
- [Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Human-in-the-Loop](https://ai-sdk.dev/cookbook/next/human-in-the-loop)
- [Error Handling](https://ai-sdk.dev/docs/ai-sdk-core/error-handling)
- [Message Persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)
- [Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
- [Chatbot Tool Usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)
