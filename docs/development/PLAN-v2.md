# PLAN-v2: Codebase Architecture Refactor

## Summary: Why This Plan Exists

### The Problem

This codebase implements a CMS agent using AI SDK v6's `ToolLoopAgent`. While functional, organic growth has introduced several architectural issues that compound maintenance burden and hide bugs:

**1. Database Integrity Bug (Critical)**
SQLite's `foreign_keys` pragma is not enabled in `server/db/client.ts`. This means all `ON DELETE CASCADE` constraints defined in the schema are **silently ignored**. When a session is deleted, its child records (messages, conversation logs) are orphaned in the database. The code has a partial workaround (manually deleting `conversationLogs` before session), but it's incomplete and the root cause was never addressed.

**2. Dead Scaffolding**
The `conversationImages` junction table was created to link images to chat sessions, but it's redundant. When the agent downloads or attaches images, the tool call results (including image IDs and URLs) are already stored in the message history. The junction table duplicates this data and adds unnecessary complexity. It should be removed entirely.

**3. Type Safety Gaps**
The codebase uses `any` types extensively, particularly in:
- `AgentContext` interface (all services typed as `any`)
- `EntityExtractor.extract()` method signature
- `AgentCallOptionsSchema` using `z.custom<any>()` for runtime services
These mask type errors and make refactoring risky.

**4. Inconsistent Tool Patterns**
Tools use different patterns for accessing services:
- Some use `experimental_context as AgentContext` (correct)
- Some use `ServiceContainer.get()` singleton pattern (anti-pattern)
- Some use module-level service locators like `getPexelsService()` (anti-pattern)

**5. Fat Routes, Missing Service Layer**
The `server/routes/agent.ts` file is 600+ lines containing business logic that should be in a dedicated orchestrator service. Routes should be thin controllers handling only HTTP concerns.

**6. Frontend Fetch Sprawl**
API calls are scattered throughout stores and hooks as inline `fetch()` calls. There's no centralized API client layer, making it hard to add consistent error handling, headers, or request/response typing.

### The Solution

A phased refactor that addresses these issues in dependency order:

| Phase | Focus | Why This Order |
|-------|-------|----------------|
| **Phase 0** | Database integrity & schema cleanup | Must fix data corruption bug first. Removing `conversationImages` simplifies Phase 2. |
| **Phase 1** | Type safety foundation | Types must exist before tools can use them. |
| **Phase 2** | Tool layer standardization | All tools use consistent patterns before extracting orchestrator. |
| **Phase 3** | Backend orchestrator extraction | Clean service layer before building frontend API client. |
| **Phase 4** | Frontend API client layer | Centralized API before refactoring hooks/stores that use it. |
| **Phase 5** | Debug logger & hook decomposition | Decouple logging from SSE parsing, simplify large hooks. |
| **Phase 6** | Polish & documentation | Clean up, document patterns, lessons learned. |

### Key Architectural Decisions

1. **Enable FK pragma + defensive deletes**: Both the pragma fix AND explicit child deletion in `deleteSession()`. Defense in depth.

2. **Remove conversationImages**: Chat history is the source of truth for image usage. No separate tracking needed.

3. **Working memory stays inline**: The `sessions.workingContext` JSON column is correct. It's loaded at session start, updated during execution, persisted after completion, and cleared when messages are cleared.

4. **Keep custom FINAL_ANSWER stop condition**: More semantic than SDK's built-in `stopSequence` or regex matching.

5. **Keep conversational HITL pattern**: The `confirmed: true` flag for destructive operations provides better UX than SDK's native `AskForConfirmation` tool.

6. **Thin routes, fat services**: Routes handle HTTP concerns only (headers, streaming, status codes). All business logic moves to `AgentOrchestrator` service.

7. **Standardized ToolResult<T>**: All tools return consistent `{ success, data?, error?, requiresConfirmation? }` format. No more mixed return patterns.

8. **Centralized API client**: All frontend API calls go through `lib/api/*` modules. No inline `fetch()` in stores or hooks.

9. **Debug logger abstraction**: Decouple logging from SSE parsing. Create `lib/debug-logger` module that wraps trace-store. Components use `debugLogger.trace(id).toolCall()` instead of direct store manipulation. SSE parsing moves to dedicated `sse-parser.ts` utility.

10. **Simplify use-agent.ts**: Currently 766+ lines with mixed responsibilities (SSE parsing, logging, state management). Target: under 200 lines focused only on agent communication orchestration.

### Session Resume Instructions

**Current Phase:** Check the `[DONE]` markers below to find the current phase.

**Rules for AI:**
1. Execute ONE phase at a time
2. After completing a phase, perform the REVIEW checklist
3. After review, mark the phase `[DONE]` with date
4. **STOP and ask user "Ready to continue to Phase X?"**
5. Do NOT proceed to next phase without user confirmation
6. User may need to `/compact` context between phases

**Quick Status Check:**
- [ ] Phase 0: Database Integrity & Schema Cleanup
- [ ] Phase 1: Foundation - Type Safety
- [ ] Phase 2: Tool Layer Standardization
- [ ] Phase 3: Backend Orchestrator Extraction
- [ ] Phase 4: Frontend API Client Layer
- [ ] Phase 5: Hook/Store Decomposition
- [ ] Phase 6: Final Polish & Documentation

---

## Phase 0: Database Integrity & Schema Cleanup

**Goal:** Fix critical SQLite foreign key issue, remove dead scaffolding, ensure proper cascade deletes work.

**Why this is Phase 0:** This fixes a fundamental data integrity bug. Without it, deleting sessions leaves orphaned data. Must be done before any other refactoring.

### 0.1 Critical Fix: Enable Foreign Keys

- [ ] **0.1.1** Update `server/db/client.ts` - Enable FK pragma
  ```typescript
  // After WAL mode, add:
  sqlite.pragma("foreign_keys = ON");
  ```
  **Why:** SQLite ignores all FK constraints (including cascade deletes) unless this pragma is enabled. Currently, deleting a session does NOT cascade to messages, logs, or images.

### 0.2 Defensive Delete Logic

- [ ] **0.2.1** Update `server/services/session-service.ts` `deleteSession()` method
  - Add explicit deletion of all child records before session delete
  - Works regardless of FK pragma state (defense in depth)
  ```typescript
  async deleteSession(sessionId: string) {
    // Delete all children explicitly (defense in depth)
    await this.db.delete(schema.conversationLogs).where(eq(...));
    await this.db.delete(schema.messages).where(eq(...));
    // Delete session
    await this.db.delete(schema.sessions).where(eq(...));
  }
  ```

### 0.3 Remove Dead Code: conversationImages

The `conversationImages` table is redundant scaffolding. Image usage is already tracked in message history (tool call results). Remove it entirely.

- [ ] **0.3.1** Remove from `server/db/schema.ts`:
  - Delete `conversationImages` table definition (lines ~299-310)
  - Delete `conversationImagesRelations` (lines ~554-563)
  - Delete `insertConversationImageSchema` and `selectConversationImageSchema`
  - Remove from `imagesRelations` the `conversationImages: many(conversationImages)` line

- [ ] **0.3.2** Remove from `server/tools/pexels-tools.ts`:
  - Remove `conversationImages` import
  - Remove insertion logic (~lines 150-160) that links downloaded photos to session

- [ ] **0.3.3** Remove from `server/tools/image-tools.ts`:
  - Remove `conversationImages` import
  - Remove query logic (~lines 152-153) that lists session images

- [ ] **0.3.4** Remove from `server/services/storage/image-processing.service.ts`:
  - Remove `conversationImages` import
  - Remove all insertions (~lines 69, 115)
  - Remove query logic (~lines 296-297)

- [ ] **0.3.5** Generate migration to drop table
  ```bash
  # After removing from schema, generate migration:
  pnpm db:generate
  # Review the generated SQL, should contain:
  # DROP TABLE `conversation_images`;
  ```

- [ ] **0.3.6** Apply migration
  ```bash
  pnpm db:push
  ```

### 0.4 Files to Modify

| File | Change |
|------|--------|
| `server/db/client.ts` | Add `foreign_keys = ON` pragma |
| `server/db/schema.ts` | Remove conversationImages table, relations, zod schemas |
| `server/services/session-service.ts` | Add explicit child deletion in deleteSession() |
| `server/tools/pexels-tools.ts` | Remove conversationImages insertions |
| `server/tools/image-tools.ts` | Remove conversationImages queries |
| `server/services/storage/image-processing.service.ts` | Remove conversationImages references |

### 0.5 Review Checklist

After completing tasks, verify:

- [ ] `pnpm typecheck` passes
- [ ] `grep -r "conversationImages" server/` returns NO results (only migrations)
- [ ] `grep -r "conversation_images" server/db/schema.ts` returns NO results
- [ ] New migration exists to drop `conversation_images` table
- [ ] `pnpm db:push` succeeds
- [ ] Deleting a session via API also deletes its messages and logs (test manually)
- [ ] No orphaned data after session delete (check DB directly)
- [ ] Creating a session still works
- [ ] Clearing messages still works and resets working memory

### 0.6 Phase Completion

```
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] DONE
Completed Date: ___________
Notes:
```

**>>> STOP: Ask user "Ready to continue to Phase 1?" <<<**

---

## Phase 1: Foundation - Type Safety

**Goal:** Eliminate `any` types and establish type contracts that all subsequent phases build upon.

### 1.1 Tasks

- [ ] **1.1.1** Update `server/tools/types.ts` - Add proper imports and typed `AgentContext`
  ```typescript
  // Replace any with:
  import type { DrizzleDB } from '../db/client';
  import type { ServiceContainer } from '../services/service-container';
  // etc.
  ```

- [ ] **1.1.2** Create `server/tools/result-types.ts` - Standardized tool response types
  ```typescript
  export interface ToolResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    requiresConfirmation?: boolean;
    confirmationMessage?: string;
  }
  ```

- [ ] **1.1.3** Update `server/agent/cms-agent.ts` - Replace `z.custom<any>()` with proper types in `AgentCallOptionsSchema`

- [ ] **1.1.4** Fix `server/services/working-memory/entity-extractor.ts` - Replace `any` with proper type
  ```typescript
  // Change from:
  extract(toolName: string, result: any): Entity[]
  // To:
  extract(toolName: string, result: unknown): Entity[]
  ```
  - Add type guards for safe property access
  - Keep implementation logic unchanged (just type safety)

- [ ] **1.1.5** Run `pnpm typecheck` - Fix any type errors introduced

### 1.2 Files to Modify

| File | Change |
|------|--------|
| `server/tools/types.ts` | Add typed AgentContext interface |
| `server/tools/result-types.ts` | NEW FILE - ToolResult types |
| `server/agent/cms-agent.ts` | Type the callOptionsSchema |
| `server/services/working-memory/entity-extractor.ts` | Replace `any` with `unknown` + type guards |

### 1.3 Review Checklist

After completing tasks, verify:

- [ ] `pnpm typecheck` passes with no errors
- [ ] No `any` types remain in `AgentContext` interface
- [ ] No `any` types remain in `EntityExtractor.extract()` signature
- [ ] `ToolResult<T>` type is exported and usable
- [ ] `AgentCallOptionsSchema` has proper Zod types (not `z.custom<any>()`)
- [ ] No dead imports or unused code introduced
- [ ] Git diff shows only intended changes

### 1.4 Phase Completion

```
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] DONE
Completed Date: ___________
Notes:
```

**>>> STOP: Ask user "Ready to continue to Phase 2?" <<<**

---

## Phase 2: Tool Layer Standardization

**Goal:** All tools use consistent context injection and response patterns.

**Depends on:** Phase 1 (types must exist)

### 2.1 Tasks

- [ ] **2.1.1** Refactor `server/tools/image-tools.ts`
  - Remove `ServiceContainer.get()` pattern
  - Use `experimental_context as AgentContext` pattern
  - Return `ToolResult<T>` format

- [ ] **2.1.2** Refactor `server/tools/post-tools.ts`
  - Remove `ServiceContainer.get()` pattern
  - Use `experimental_context as AgentContext` pattern
  - Return `ToolResult<T>` format

- [ ] **2.1.3** Refactor `server/tools/pexels-tools.ts`
  - Remove `getPexelsService()` locator pattern
  - Pass Pexels service through context OR keep as singleton but document why
  - Return `ToolResult<T>` format

- [ ] **2.1.4** Refactor `server/tools/site-settings-tools.ts`
  - Ensure uses `experimental_context` pattern
  - Return `ToolResult<T>` format

- [ ] **2.1.5** Refactor `server/tools/web-research-tools.ts`
  - Ensure uses `experimental_context` pattern
  - Return `ToolResult<T>` format

- [ ] **2.1.6** Update `server/tools/all-tools.ts` (CMS tools)
  - Audit all CMS tools for consistent response format
  - Ensure throws are converted to `ToolResult` returns where appropriate

- [ ] **2.1.7** Run `pnpm typecheck` and fix errors

### 2.2 Files to Modify

| File | Change |
|------|--------|
| `server/tools/image-tools.ts` | Context pattern + ToolResult |
| `server/tools/post-tools.ts` | Context pattern + ToolResult |
| `server/tools/pexels-tools.ts` | Context pattern + ToolResult |
| `server/tools/site-settings-tools.ts` | Verify pattern + ToolResult |
| `server/tools/web-research-tools.ts` | Verify pattern + ToolResult |
| `server/tools/all-tools.ts` | Audit CMS tools |

### 2.3 Review Checklist

After completing tasks, verify:

- [ ] `pnpm typecheck` passes
- [ ] `grep -r "ServiceContainer.get()" server/tools/` returns NO results
- [ ] All tool files use `experimental_context as AgentContext`
- [ ] All tools return consistent `ToolResult<T>` or documented exception
- [ ] No orphaned imports (old service imports removed)
- [ ] Test one tool manually via API to verify still works

### 2.4 Phase Completion

```
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] DONE
Completed Date: ___________
Notes:
```

**>>> STOP: Ask user "Ready to continue to Phase 3?" <<<**

---

## Phase 3: Backend Orchestrator Extraction

**Goal:** Extract business logic from routes into a dedicated `AgentOrchestrator` service, and add AI SDK v6 error handling features.

**Depends on:** Phase 2 (tools must be standardized)

### 3.1 Orchestrator Service

- [ ] **3.1.1** Create `server/services/agent/orchestrator.ts`
  - Extract working context loading
  - Extract entity extraction logic
  - Extract working context persistence
  - Handle SSE stream coordination
  - Return async iterable of events

- [ ] **3.1.2** Create `server/services/agent/types.ts`
  - Define `ExecuteOptions` interface
  - Define `StreamEvent` union type
  - Define `OrchestratorResult` type

- [ ] **3.1.3** Update `server/services/service-container.ts`
  - Add `AgentOrchestrator` to container
  - Initialize with required dependencies

- [ ] **3.1.4** Refactor `server/routes/agent.ts` `/stream` endpoint
  - Replace 150+ lines with orchestrator call
  - Route should be ~20-30 lines max
  - Handle only HTTP concerns (headers, streaming response)

- [ ] **3.1.5** Refactor `server/routes/agent.ts` `/generate` endpoint
  - Apply same pattern as /stream
  - Use orchestrator for execution

### 3.2 AI SDK Error Handling Integration

- [ ] **3.2.1** Add `experimental_repairToolCall` to `server/agent/cms-agent.ts`
  ```typescript
  import { NoSuchToolError, InvalidToolInputError } from 'ai';

  export const cmsAgent = new ToolLoopAgent({
    // ... existing config

    experimental_repairToolCall: async ({ toolCall, tools, error }) => {
      // Don't attempt to fix unknown tool names
      if (NoSuchToolError.isInstance(error)) {
        return null;
      }

      // For invalid input, log and let prompt-based recovery handle it
      if (InvalidToolInputError.isInstance(error)) {
        // Could implement schema-based repair here in future
        // For now, return null to let the model retry naturally
        return null;
      }

      return null;
    },
  });
  ```

- [ ] **3.2.2** Add structured error type handling in orchestrator
  - Import `NoSuchToolError`, `InvalidToolInputError` from 'ai'
  - Check for `tool-error` content parts in steps
  - Log structured error info for debugging
  ```typescript
  // In orchestrator, after agent execution
  const toolErrors = steps.flatMap(step =>
    step.content?.filter(part => part.type === 'tool-error') ?? []
  );
  if (toolErrors.length > 0) {
    logger.warn('Tool errors in execution', { toolErrors });
  }
  ```

- [ ] **3.2.3** Run `pnpm typecheck` and fix errors

- [ ] **3.2.4** Test streaming manually - verify SSE events still work

### 3.3 Files to Modify/Create

| File | Change |
|------|--------|
| `server/services/agent/orchestrator.ts` | NEW FILE |
| `server/services/agent/types.ts` | NEW FILE |
| `server/services/agent/index.ts` | NEW FILE - exports |
| `server/services/service-container.ts` | Add orchestrator |
| `server/routes/agent.ts` | Slim down to thin controller |
| `server/agent/cms-agent.ts` | Add `experimental_repairToolCall` |

### 3.4 Review Checklist

After completing tasks, verify:

- [ ] `pnpm typecheck` passes
- [ ] `/stream` route handler is under 30 lines
- [ ] `/generate` route handler is under 30 lines
- [ ] `AgentOrchestrator` handles all business logic
- [ ] Working memory persistence still works (test manually)
- [ ] SSE streaming still works (test in browser)
- [ ] Entity extraction still populates working memory
- [ ] No dead code in `agent.ts` route file
- [ ] Old inline functions removed (no `getOrLoadWorkingContext` in routes)
- [ ] `experimental_repairToolCall` is configured in cms-agent.ts
- [ ] Tool errors are logged with structured types in orchestrator

### 3.5 Phase Completion

```
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] DONE
Completed Date: ___________
Notes:
```

**>>> STOP: Ask user "Ready to continue to Phase 4?" <<<**

---

## Phase 4: Frontend API Client Layer

**Goal:** Centralize API calls into a dedicated client layer, removing fetch calls from stores.

**Depends on:** Phase 3 (backend must be stable)

### 4.1 Tasks

- [ ] **4.1.1** Create `lib/api/client.ts`
  - Base fetch wrapper with error handling
  - Type-safe request/response
  - Centralized headers

- [ ] **4.1.2** Create `lib/api/sessions.ts`
  - `list()`, `get()`, `create()`, `update()`, `delete()`
  - `clearHistory()`, `getLogs()`, `saveLogs()`

- [ ] **4.1.3** Create `lib/api/agent.ts`
  - `stream()` - returns ReadableStream
  - Handle SSE connection

- [ ] **4.1.4** Create `lib/api/models.ts`
  - `list()` - fetch models from OpenRouter

- [ ] **4.1.5** Create `lib/api/index.ts`
  - Export all API modules

- [ ] **4.1.6** Refactor `app/assistant/_stores/session-store.ts`
  - Replace inline fetch with `sessionsApi`
  - Keep store focused on state management

- [ ] **4.1.7** Refactor `app/assistant/_stores/models-store.ts`
  - Replace inline fetch with `modelsApi`

- [ ] **4.1.8** Update `app/assistant/_hooks/use-agent.ts`
  - Replace inline fetch with `agentApi.stream()`

- [ ] **4.1.9** Run `pnpm typecheck` and fix errors

### 4.2 Files to Create/Modify

| File | Change |
|------|--------|
| `lib/api/client.ts` | NEW FILE |
| `lib/api/sessions.ts` | NEW FILE |
| `lib/api/agent.ts` | NEW FILE |
| `lib/api/models.ts` | NEW FILE |
| `lib/api/index.ts` | NEW FILE |
| `app/assistant/_stores/session-store.ts` | Use API client |
| `app/assistant/_stores/models-store.ts` | Use API client |
| `app/assistant/_hooks/use-agent.ts` | Use API client |

### 4.3 Review Checklist

After completing tasks, verify:

- [ ] `pnpm typecheck` passes
- [ ] `grep -r "fetch('/api" app/` shows only API client usage
- [ ] No inline fetch calls in stores
- [ ] No inline fetch calls in hooks
- [ ] Session CRUD still works (test in browser)
- [ ] Model selection still works
- [ ] Agent streaming still works
- [ ] API client exports all required methods

### 4.4 Phase Completion

```
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] DONE
Completed Date: ___________
Notes:
```

**>>> STOP: Ask user "Ready to continue to Phase 5?" <<<**

---

## Phase 5: Debug Logger Module & Hook Decomposition

**Goal:** Create a pluggable debug logger module that decouples logging from SSE parsing, then decompose large hooks into focused modules.

**Depends on:** Phase 4 (API layer must be in place)

**Why this matters:** Currently, debug logging is tightly coupled inside `use-agent.ts` (766 lines). The trace store has a clean API, but it's only accessible via direct store calls embedded in SSE parsing logic. This phase creates a proper abstraction layer.

### 5.1 Debug Logger Module (Core Abstraction)

- [ ] **5.1.1** Create `lib/debug-logger/types.ts` - Logger interfaces
  ```typescript
  export interface DebugLogger {
    // Scoped trace logger - use for agent execution flows
    trace(traceId: string): TraceLogger;

    // Quick logging - auto-assigns to active trace
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, error?: Error): void;

    // Access active trace
    getActiveTraceId(): string | null;
    setActiveTraceId(traceId: string | null): void;
  }

  export interface TraceLogger {
    start(options?: { sessionId?: string; userPrompt?: string }): void;

    // Tool lifecycle
    toolCall(name: string, args: unknown, callId: string): string; // returns entryId
    toolResult(callId: string, result: unknown): void;
    toolError(callId: string, error: Error): void;

    // Step lifecycle
    stepStart(stepNumber: number): void;
    stepComplete(stepNumber: number, metrics?: { tokens?: number }): void;

    // Content
    textDelta(delta: string): void;
    systemPrompt(prompt: string, tokens: number): void;
    userPrompt(prompt: string, tokens: number): void;

    // Metadata
    modelInfo(modelId: string, pricing: { prompt: number; completion: number } | null): void;
    toolsAvailable(tools: string[]): void;

    // Working memory
    workingMemoryUpdate(entityCount: number, entities?: unknown): void;

    // Completion
    complete(metrics?: Partial<TraceMetrics>): void;
    error(error: Error): void;
  }
  ```

- [ ] **5.1.2** Create `lib/debug-logger/trace-logger.ts` - TraceLogger implementation
  - Wraps trace-store actions
  - Manages entry IDs and timing internally
  - Handles text streaming accumulation
  - Returns entry IDs for updates

- [ ] **5.1.3** Create `lib/debug-logger/debug-logger.ts` - DebugLogger implementation
  - Creates TraceLogger instances
  - Manages active trace ID
  - Provides quick logging methods
  - Singleton pattern for global access

- [ ] **5.1.4** Create `lib/debug-logger/index.ts` - Public exports
  ```typescript
  export { debugLogger } from './debug-logger';
  export type { DebugLogger, TraceLogger } from './types';
  ```

- [ ] **5.1.5** Create `lib/debug-logger/hooks.ts` - React hooks for logger access
  ```typescript
  // For components that need logger access
  export function useDebugLogger(): DebugLogger;
  export function useTraceLogger(traceId: string): TraceLogger;
  ```

### 5.2 SSE Parser Extraction

- [ ] **5.2.1** Create `app/assistant/_utils/sse-parser.ts` - Pure SSE parsing
  ```typescript
  export interface SSEEvent {
    type: string;
    data: unknown;
  }

  export function parseSSEChunk(chunk: string): SSEEvent[];
  export function createSSEReader(stream: ReadableStream): AsyncIterable<SSEEvent>;
  ```

- [ ] **5.2.2** Create `app/assistant/_hooks/use-sse-stream.ts` - SSE stream hook
  - Uses `createSSEReader` from utils
  - Returns async iterable of typed events
  - Handles connection lifecycle

### 5.3 Agent Hook Refactor

- [ ] **5.3.1** Refactor `use-agent.ts` to use debug logger
  - Replace all direct `addEntry()`, `updateEntry()` calls with `debugLogger.trace()`
  - Replace SSE parsing with `useSSEStream` hook
  - Target: under 200 lines
  - Single responsibility: orchestrate agent communication

- [ ] **5.3.2** Update event handling to use TraceLogger methods
  ```typescript
  // Before (current):
  case "tool-call":
    addEntry({ traceId, type: "tool-call", ... });
    break;

  // After (with logger):
  case "tool-call":
    trace.toolCall(data.toolName, data.args, data.toolCallId);
    break;
  ```

### 5.4 Store Cleanup

- [ ] **5.4.1** Evaluate trace-store simplification
  - Option A: Keep as-is (logger wraps it)
  - Option B: Extract conversation logs to separate store
  - Document decision in notes

- [ ] **5.4.2** Remove legacy log-store if unused
  - Check if `useLogStore` is still needed
  - Remove if debugLogger replaces it

- [ ] **5.4.3** Run `pnpm typecheck` and fix errors

- [ ] **5.4.4** Test full flow in browser

### 5.5 Files to Create/Modify

| File | Change |
|------|--------|
| `lib/debug-logger/types.ts` | NEW FILE - Interfaces |
| `lib/debug-logger/trace-logger.ts` | NEW FILE - TraceLogger impl |
| `lib/debug-logger/debug-logger.ts` | NEW FILE - DebugLogger impl |
| `lib/debug-logger/hooks.ts` | NEW FILE - React hooks |
| `lib/debug-logger/index.ts` | NEW FILE - Exports |
| `app/assistant/_utils/sse-parser.ts` | NEW FILE - SSE parsing |
| `app/assistant/_hooks/use-sse-stream.ts` | NEW FILE - SSE hook |
| `app/assistant/_hooks/use-agent.ts` | Major refactor - use logger |
| `app/assistant/_stores/trace-store.ts` | Evaluate (may keep as-is) |
| `app/assistant/_stores/log-store.ts` | Possibly DELETE |

### 5.6 Review Checklist

After completing tasks, verify:

- [ ] `pnpm typecheck` passes
- [ ] `debugLogger` is importable from `@/lib/debug-logger`
- [ ] `debugLogger.trace(id).toolCall()` works correctly
- [ ] `debugLogger.info()` logs to active trace
- [ ] `use-agent.ts` is under 200 lines
- [ ] No direct `addEntry()` calls in use-agent.ts (all via logger)
- [ ] SSE streaming still works end-to-end
- [ ] Debug panel shows all event types correctly
- [ ] Tool call durations are tracked correctly
- [ ] Text streaming updates work (incremental)
- [ ] No dead code in refactored files
- [ ] Legacy log-store removed or justified

### 5.7 Usage Example (For Reference)

After this phase, logging from anywhere becomes simple:

```typescript
// In any component or hook
import { debugLogger } from '@/lib/debug-logger';

// Quick log to active trace
debugLogger.info("Something happened", { data });

// Scoped trace logging
const trace = debugLogger.trace(traceId);
trace.start({ sessionId, userPrompt });
trace.toolCall("cms_getPage", { slug: "home" }, "call-123");
trace.toolResult("call-123", { id: "page-1", name: "Home" });
trace.complete({ tokens: { input: 500, output: 200 } });
```

### 5.8 Phase Completion

```
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] DONE
Completed Date: ___________
Notes:
```

**>>> STOP: Ask user "Ready to continue to Phase 6?" <<<**

---

## Phase 6: Final Polish & Documentation

**Goal:** Clean up, document patterns, ensure no loose ends.

**Depends on:** All previous phases

### 6.1 Tasks

- [ ] **6.1.1** Full codebase audit
  - Search for remaining `any` types
  - Search for TODO comments
  - Search for console.log (remove or convert to logger)

- [ ] **6.1.2** Remove dead code/files
  - Check for unused exports
  - Check for orphaned files
  - Remove commented-out code blocks

- [ ] **6.1.3** Update `CLAUDE.md`
  - Document new patterns
  - Update architecture section

- [ ] **6.1.4** Create/Update `CONTRIBUTING.md`
  - Document tool creation pattern
  - Document service layer pattern
  - Document frontend hook pattern
  - Document API client usage
  - Document debug logger usage (how to log from anywhere)

- [ ] **6.1.5** Update this plan
  - Mark all phases complete
  - Add lessons learned section

- [ ] **6.1.6** Final typecheck and test
  - `pnpm typecheck`
  - Manual end-to-end test
  - Verify all features work

### 6.2 Review Checklist

After completing tasks, verify:

- [ ] `pnpm typecheck` passes
- [ ] `grep -r ": any" server/ app/` minimal results (only justified cases)
- [ ] No console.log in production code
- [ ] No TODO comments without linked issues
- [ ] Documentation reflects current architecture
- [ ] All features work end-to-end

### 6.3 Phase Completion

```
Status: [ ] NOT STARTED  [ ] IN PROGRESS  [ ] DONE
Completed Date: ___________
Notes:
```

---

## Appendix: Quick Reference

### Pattern: Tool Definition

```typescript
// Correct pattern
export const myTool = tool({
  description: '...',
  inputSchema: z.object({ /* ... */ }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    // Use ctx.services, ctx.db, ctx.vectorIndex
    return { success: true, data: result };
  }
});
```

### Pattern: Service Method

```typescript
// Services contain business logic
class MyService {
  constructor(private db: DrizzleDB, private vectorIndex: VectorIndexService) {}

  async doThing(input: Input): Promise<Output> {
    // Business logic here
    // Vector indexing here
    // Return typed result
  }
}
```

### Pattern: Thin Route Handler

```typescript
// Routes only handle HTTP concerns
router.post('/endpoint', async (req, res) => {
  const input = schema.parse(req.body);
  const result = await services.orchestrator.execute(input);
  res.json({ data: result, statusCode: 200 });
});
```

### Pattern: Frontend API Call

```typescript
// Use API client, not inline fetch
import { sessionsApi } from '@/lib/api';

const sessions = await sessionsApi.list();
```

### Pattern: Debug Logger

```typescript
// Import the singleton logger
import { debugLogger } from '@/lib/debug-logger';

// Quick logging (goes to active trace)
debugLogger.info("Something happened", { data });
debugLogger.warn("Warning message");
debugLogger.error("Error occurred", new Error("details"));

// Scoped trace logging (for agent execution flows)
const trace = debugLogger.trace(traceId);
trace.start({ sessionId, userPrompt: "User's question" });
trace.toolCall("cms_getPage", { slug: "home" }, "call-123");
trace.toolResult("call-123", { id: "page-1", name: "Home" });
trace.stepComplete(1, { tokens: 150 });
trace.complete({ tokens: { input: 500, output: 200 } });

// In React components, use hooks
import { useDebugLogger } from '@/lib/debug-logger';
const logger = useDebugLogger();
logger.info("Component event", { action: "click" });
```

---

## Lessons Learned

*To be filled after refactor completion*

-
-
-

---

## Change Log

| Date | Phase | Action | Notes |
|------|-------|--------|-------|
| 2025-12-03 | Summary | Added | Comprehensive summary explaining why plan exists, problems, solutions, architectural decisions |
| 2025-12-03 | Phase 0 | Added | Database integrity fixes: FK pragma, defensive deletes, remove conversationImages |
