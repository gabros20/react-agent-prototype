# Gold Standard Refactor Plan

**Date**: 2025-12-11
**Status**: ✅ COMPLETED
**Goal**: Transform codebase into a school-book example of agentic app architecture
**Approach**: Phased implementation with verification after each phase

---

## Implementation Summary

All 7 phases have been completed successfully:

- ✅ Phase 1: Foundation Types & Utilities
- ✅ Phase 2: Provider Abstraction Layer
- ✅ Phase 3: Service Container Refactor
- ✅ Phase 4: Agent Context Refactor
- ✅ Phase 5: Tool Error Handling Standardization
- ✅ Phase 6: Frontend Store Optimization
- ✅ Phase 7: Integration Testing & Cleanup

**Key Changes Made**:
- Removed `ServiceContainer` singleton in favor of `createServices()` factory
- Created `MemoryProvider` and `LoggerProvider` abstractions
- Unified `Services` interface for dependency injection
- Updated all routes to use factory pattern
- Standardized tool result types (`ToolResult<T>`, `CMSToolResult<T>`)
- Optimized frontend store selectors

---

## Overview

This plan addresses all identified issues while establishing patterns that make this codebase a reference implementation for building agentic applications.

**Core Principles**:
1. **Dependency Injection** - No static singletons, explicit dependencies
2. **Provider Abstraction** - Pluggable implementations for all I/O
3. **Request-Scoped State** - No module-level mutable state
4. **Consistent Contracts** - Standard result types, error handling
5. **Testability** - Every component mockable in isolation
6. **Type Safety** - TypeScript strict mode patterns throughout

---

## Phase 1: Foundation Types & Utilities

**Duration**: ~30 minutes
**Risk**: Low
**Goal**: Establish shared types and utilities that all phases depend on

### 1.1 Create Standard Result Type

```typescript
// server/types/result.ts
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

### 1.2 Create Tool Result Type

```typescript
// server/tools/_types/result.ts
export interface ToolSuccess<T> {
  success: true;
  data: T;
}

export interface ToolError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ToolResult<T> = ToolSuccess<T> | ToolError;

// Helper constructors
export const toolSuccess = <T>(data: T): ToolSuccess<T> => ({ success: true, data });
export const toolError = (code: string, message: string, details?: unknown): ToolError => ({
  success: false,
  error: { code, message, details }
});
export const notFound = (entity: string, id: string): ToolError =>
  toolError('NOT_FOUND', `${entity} "${id}" not found`);
export const validationError = (message: string, details?: unknown): ToolError =>
  toolError('VALIDATION_ERROR', message, details);
```

### 1.3 Create Request Context Type

```typescript
// server/types/context.ts
export interface RequestContext {
  // Identifiers
  traceId: string;
  requestId: string;

  // Timestamp
  startedAt: Date;
}
```

### Files to Create:
- `server/types/result.ts`
- `server/types/context.ts`
- `server/tools/_types/result.ts`
- `server/types/index.ts` (barrel export)

### Verification:
- [ ] TypeScript compiles with no errors
- [ ] Types are exported correctly from barrel

---

## Phase 2: Provider Abstraction Layer

**Duration**: ~1 hour
**Risk**: Medium
**Goal**: Create pluggable provider interfaces for memory and logging

### 2.1 Memory Provider Interface

```typescript
// server/providers/memory/types.ts
export interface MemoryProvider {
  // Working context
  loadWorkingContext(sessionId: string): Promise<WorkingContextState | null>;
  saveWorkingContext(sessionId: string, context: WorkingContextState): Promise<void>;

  // Messages
  loadMessages(sessionId: string, limit?: number): Promise<StoredMessage[]>;
  saveMessage(sessionId: string, message: NewMessage): Promise<void>;

  // Session
  ensureSession(sessionId: string): Promise<void>;
  getSession(sessionId: string): Promise<Session | null>;
}
```

### 2.2 SQLite Memory Provider

```typescript
// server/providers/memory/sqlite-provider.ts
export class SQLiteMemoryProvider implements MemoryProvider {
  constructor(private db: DrizzleDB) {}

  // Implement all methods using existing SessionService logic
}
```

### 2.3 Logger Provider Interface

```typescript
// server/providers/logger/types.ts
export interface LoggerProvider {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): LoggerProvider;
}
```

### 2.4 Console Logger Provider

```typescript
// server/providers/logger/console-provider.ts
export class ConsoleLoggerProvider implements LoggerProvider {
  constructor(private bindings: Record<string, unknown> = {}) {}

  info(message: string, meta?: Record<string, unknown>): void {
    console.log('[INFO]', message, { ...this.bindings, ...meta });
  }
  // ... other methods
}
```

### Files to Create:
- `server/providers/memory/types.ts`
- `server/providers/memory/sqlite-provider.ts`
- `server/providers/memory/index.ts`
- `server/providers/logger/types.ts`
- `server/providers/logger/console-provider.ts`
- `server/providers/logger/index.ts`
- `server/providers/index.ts`

### Verification:
- [ ] SQLiteMemoryProvider implements all MemoryProvider methods
- [ ] ConsoleLoggerProvider implements all LoggerProvider methods
- [ ] TypeScript compiles
- [ ] Providers can be instantiated

---

## Phase 3: Service Container Refactor

**Duration**: ~1 hour
**Risk**: High
**Goal**: Replace static singleton with factory pattern and dependency injection

### 3.1 Create Services Interface

```typescript
// server/services/types.ts
export interface Services {
  readonly db: DrizzleDB;
  readonly memory: MemoryProvider;
  readonly logger: LoggerProvider;
  readonly vectorIndex: VectorIndexService;
  readonly toolSearch: ToolSearchService;
  readonly pageService: PageService;
  readonly sectionService: SectionService;
  readonly entryService: EntryService;
}
```

### 3.2 Create Services Factory

```typescript
// server/services/create-services.ts
export interface CreateServicesOptions {
  db: DrizzleDB;
  memory?: MemoryProvider;
  logger?: LoggerProvider;
}

export async function createServices(options: CreateServicesOptions): Promise<Services> {
  const { db } = options;

  // Use provided or create defaults
  const logger = options.logger ?? new ConsoleLoggerProvider();
  const memory = options.memory ?? new SQLiteMemoryProvider(db);

  // Initialize vector index
  const vectorIndex = new VectorIndexService(process.env.LANCEDB_DIR || "data/lancedb");
  await vectorIndex.initialize();

  // Initialize tool search
  const toolSearch = new ToolSearchService();
  await toolSearch.initialize();

  // Create services
  const pageService = new PageService(db, vectorIndex);
  const sectionService = new SectionService(db, vectorIndex);
  const entryService = new EntryService(db, vectorIndex);

  return {
    db,
    memory,
    logger,
    vectorIndex,
    toolSearch,
    pageService,
    sectionService,
    entryService,
  };
}
```

### 3.3 Update Server Bootstrap

```typescript
// server/index.ts
async function startServer() {
  const services = await createServices({ db });

  // Pass services to route factories
  app.use("/v1/agent", createAgentRoutes(services));
  app.use("/v1/sessions", createSessionRoutes(services));
  // ...
}
```

### 3.4 Deprecate Old ServiceContainer

```typescript
// server/services/service-container.ts
/** @deprecated Use createServices() instead */
export class ServiceContainer { ... }
```

### Files to Modify:
- `server/services/types.ts` (new)
- `server/services/create-services.ts` (new)
- `server/services/service-container.ts` (deprecate, keep for now)
- `server/index.ts` (update bootstrap)
- `server/routes/agent.ts` (update to use Services interface)
- `server/routes/sessions.ts` (update to use Services interface)

### Verification:
- [ ] Server starts successfully
- [ ] Agent endpoint works (POST /v1/agent/stream)
- [ ] Sessions endpoint works
- [ ] No runtime errors in console

---

## Phase 4: Agent Context Refactor

**Duration**: ~1.5 hours
**Risk**: High
**Goal**: Eliminate module-level state, make agent execution request-scoped

### 4.1 Create Agent Execution Context

```typescript
// server/agents/execution-context.ts
export interface AgentExecutionContext {
  // Request identification
  traceId: string;
  sessionId: string;
  requestId: string;

  // Services (injected)
  services: Services;

  // Mutable state (request-scoped)
  state: AgentExecutionState;
}

export interface AgentExecutionState {
  baseSystemPrompt: string;
  discoveredTools: string[];
  injectedInstructions: InjectedInstructions | null;
}

export function createExecutionContext(
  traceId: string,
  sessionId: string,
  services: Services
): AgentExecutionContext {
  return {
    traceId,
    sessionId,
    requestId: randomUUID(),
    services,
    state: {
      baseSystemPrompt: '',
      discoveredTools: [],
      injectedInstructions: null,
    },
  };
}
```

### 4.2 Create Request-Scoped State Store

```typescript
// server/agents/state-store.ts
/**
 * Request-scoped state store using AsyncLocalStorage
 * This replaces module-level state with request-isolated state
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const executionStore = new AsyncLocalStorage<AgentExecutionContext>();

export function runWithContext<T>(
  context: AgentExecutionContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return executionStore.run(context, fn);
}

export function getExecutionContext(): AgentExecutionContext {
  const ctx = executionStore.getStore();
  if (!ctx) {
    throw new Error('No execution context available. Ensure you are inside runWithContext()');
  }
  return ctx;
}

export function getExecutionState(): AgentExecutionState {
  return getExecutionContext().state;
}
```

### 4.3 Refactor main-agent.ts

```typescript
// server/agents/main-agent.ts
// REMOVE module-level state:
// - let lastInjectedInstructions
// - let currentBaseSystemPrompt
// - let persistedDiscoveredTools

// REPLACE with context access:
import { getExecutionState, getExecutionContext } from './state-store';

// In prepareCall:
prepareCall: ({ options, ...settings }) => {
  const state = getExecutionState();
  state.baseSystemPrompt = getAgentSystemPrompt({ ... });
  state.discoveredTools = options.discoveredTools || [];
  // ...
}

// In prepareStep:
prepareStep: async ({ stepNumber, steps }) => {
  const state = getExecutionState();
  // Use state.baseSystemPrompt instead of currentBaseSystemPrompt
  // Use state.discoveredTools instead of persistedDiscoveredTools
  // ...
}
```

### 4.4 Update Orchestrator to Use Context

```typescript
// server/execution/orchestrator.ts
async *executeStream(options: ExecuteOptions, writeSSE: SSEWriter) {
  const resolved = await this.contextCoordinator.resolveOptions(options);

  // Create execution context
  const execContext = createExecutionContext(
    resolved.traceId,
    resolved.sessionId,
    this.deps.services
  );

  // Run agent within context
  await runWithContext(execContext, async () => {
    // ... existing execution logic
  });
}
```

### Files to Create:
- `server/agents/execution-context.ts`
- `server/agents/state-store.ts`

### Files to Modify:
- `server/agents/main-agent.ts` (remove module state)
- `server/execution/orchestrator.ts` (wrap in context)

### Verification:
- [ ] Single request works correctly
- [ ] Two concurrent requests don't interfere (test manually)
- [ ] State is properly isolated per request
- [ ] TypeScript compiles

---

## Phase 5: Tool Error Handling Standardization

**Duration**: ~45 minutes
**Risk**: Low
**Goal**: Apply consistent ToolResult pattern across all tools

### 5.1 Update Tool Base Pattern

Update tools to use the new ToolResult type. Start with one tool as template:

```typescript
// server/tools/getPage/getPage-tool.ts
import { toolSuccess, notFound, type ToolResult } from '../_types/result';

export async function execute(
  input: z.infer<typeof schema>,
  context: AgentContext
): Promise<ToolResult<PageData | PageData[]>> {
  const { services, logger } = context;

  try {
    if (input.id) {
      const page = await services.pageService.getPageById(input.id);
      if (!page) return notFound('Page', input.id);
      return toolSuccess(formatPage(page));
    }

    if (input.slug) {
      const page = await services.pageService.getPageBySlug(input.slug);
      if (!page) return notFound('Page', input.slug);
      return toolSuccess(formatPage(page));
    }

    const pages = await services.pageService.listPages();
    return toolSuccess(pages.map(formatPage));
  } catch (error) {
    logger.error('getPage failed', { error: (error as Error).message });
    return toolError('INTERNAL_ERROR', (error as Error).message);
  }
}
```

### 5.2 Apply to High-Risk Tools First

Priority order (destructive operations first):
1. `deletePage`, `deletePost`, `deleteSection` - Need clear success/failure
2. `createPage`, `createPost`, `createSection` - Need validation errors
3. `updatePage`, `updatePost`, `updateSection` - Need conflict handling
4. Read tools can be updated incrementally

### Files to Modify:
- All tools in `server/tools/*/` (incremental, start with delete tools)

### Verification:
- [ ] Updated tools return ToolResult type
- [ ] Agent can interpret success/error from tools
- [ ] Error messages are clear and actionable

---

## Phase 6: Frontend Store Optimization

**Duration**: ~30 minutes
**Risk**: Low
**Goal**: Optimize Zustand selectors to prevent unnecessary re-renders

### 6.1 Add useShallow to Object Selectors

```typescript
// app/assistant/_hooks/use-agent.ts
import { useShallow } from 'zustand/react/shallow';

// BEFORE (creates new object every render):
const chatActions = useChatStore((s) => ({
  addMessage: s.addMessage,
  setIsStreaming: s.setIsStreaming,
}));

// AFTER (stable reference with shallow compare):
const chatActions = useChatStore(
  useShallow((s) => ({
    addMessage: s.addMessage,
    setIsStreaming: s.setIsStreaming,
  }))
);
```

### 6.2 Extract Stable Actions

```typescript
// app/assistant/_stores/chat-store.ts
// Export store instance for direct action access
const chatStoreImpl = create<ChatState>()((set, get) => ({ ... }));

export const useChatStore = chatStoreImpl;

// Stable action references (don't cause re-renders)
export const chatActions = {
  addMessage: (message: ChatMessage) =>
    chatStoreImpl.setState((s) => ({ messages: [...s.messages, message] })),
  setIsStreaming: (isStreaming: boolean) =>
    chatStoreImpl.setState({ isStreaming }),
  setAgentStatus: (status: AgentStatus | null) =>
    chatStoreImpl.setState({ agentStatus: status }),
  // ... other actions
};
```

### Files to Modify:
- `app/assistant/_hooks/use-agent.ts`
- `app/assistant/_stores/chat-store.ts`
- `app/assistant/_stores/session-store.ts`
- `app/assistant/_stores/trace-store.ts`

### Verification:
- [ ] React DevTools shows fewer re-renders
- [ ] Chat UI still works correctly
- [ ] Streaming still works correctly

---

## Phase 7: Integration Testing & Cleanup

**Duration**: ~30 minutes
**Risk**: Low
**Goal**: Verify all changes work together, clean up deprecated code

### 7.1 Manual Integration Tests

Run through these scenarios:
1. Start fresh session, send message, verify response
2. Continue existing session, verify history loaded
3. Send concurrent requests (two browser tabs)
4. Verify tool discovery works (ask about pages)
5. Verify tool execution works (create a page)
6. Verify error handling (try to get non-existent page)

### 7.2 Code Cleanup

- Remove `ServiceContainer.get()` usages
- Remove deprecated comments
- Update imports to use new paths
- Run `pnpm typecheck`
- Run `pnpm lint` (if available)

### 7.3 Documentation Update

Update CLAUDE.md with new patterns:
- Service injection pattern
- Provider abstraction
- Request-scoped context
- ToolResult pattern

---

## Implementation Order Summary

```
Phase 1: Foundation Types (30 min)
├── Create Result types
├── Create ToolResult types
├── Create RequestContext type
└── VERIFY: TypeScript compiles

Phase 2: Provider Abstraction (1 hr)
├── Create MemoryProvider interface
├── Implement SQLiteMemoryProvider
├── Create LoggerProvider interface
├── Implement ConsoleLoggerProvider
└── VERIFY: Providers work

Phase 3: Service Container (1 hr)
├── Create Services interface
├── Create createServices factory
├── Update server bootstrap
├── Update route factories
└── VERIFY: Server starts, endpoints work

Phase 4: Agent Context (1.5 hr)
├── Create AgentExecutionContext
├── Create state-store with AsyncLocalStorage
├── Refactor main-agent.ts
├── Update orchestrator
└── VERIFY: Concurrent requests isolated

Phase 5: Tool Error Handling (45 min)
├── Update tool result helpers
├── Update delete tools
├── Update create tools
├── Update update tools
└── VERIFY: Tools return consistent results

Phase 6: Frontend Optimization (30 min)
├── Add useShallow to selectors
├── Extract stable actions
└── VERIFY: UI works, fewer re-renders

Phase 7: Integration & Cleanup (30 min)
├── Manual integration tests
├── Code cleanup
├── Documentation update
└── VERIFY: Everything works end-to-end
```

**Total Estimated Time**: ~5-6 hours

---

## Success Criteria

After completing all phases:

1. **No Static Singletons** - ServiceContainer.get() removed
2. **Request Isolation** - Concurrent requests don't interfere
3. **Provider Abstraction** - Memory and logging are pluggable
4. **Consistent Errors** - All tools return ToolResult type
5. **Optimized Frontend** - No unnecessary re-renders
6. **TypeScript Strict** - No type errors
7. **All Features Work** - No regressions from current behavior

---

## Rollback Plan

If any phase breaks functionality:
1. Git stash/revert the phase changes
2. Identify the breaking change
3. Fix in isolation
4. Re-apply with fix

Each phase is designed to be independently revertible.
