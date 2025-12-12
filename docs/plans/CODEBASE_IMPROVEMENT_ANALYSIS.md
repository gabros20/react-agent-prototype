# Codebase Improvement Analysis

**Date**: 2025-12-11
**Status**: Analysis Complete
**Reference**: AI SDK Tools (midday-ai) patterns comparison

---

## Executive Summary

Your codebase is **well-architected** for a prototype, with solid patterns in tool organization, service injection, streaming events, and working memory. However, there are several areas where adopting patterns from AI SDK Tools and agentic best practices would improve maintainability, testability, and developer experience.

**Key Strengths** (Keep as-is):
- Excellent tool organization (per-folder pattern with metadata/schema/execute split)
- Strong type safety with Zod schemas throughout
- Clean service container with dependency injection
- Well-designed SSE event system with typed emitters
- Version-based memoization in WorkingContext

**Improvement Opportunities** (Prioritized):
1. **Critical**: Service Container anti-patterns (singleton + static access)
2. **High**: Missing provider abstraction for memory/storage
3. **High**: Module-level state in main-agent.ts
4. **Medium**: Frontend stores need selector optimization
5. **Medium**: Error handling inconsistency across tools
6. **Low**: Template-driven prompts could use markdown files

---

## Detailed Analysis

### 1. Service Container Pattern Issues (CRITICAL)

**Current Implementation** (`service-container.ts`):
```typescript
export class ServiceContainer {
  private static instance: ServiceContainer;

  static get(): ServiceContainer {
    if (!ServiceContainer.instance) {
      throw new Error("ServiceContainer not initialized");
    }
    return ServiceContainer.instance;
  }
}
```

**Problems**:
- Static singleton access makes testing difficult (global state)
- `ServiceContainer.get()` can be called anywhere, hiding dependencies
- Circular dependency workaround with lazy orchestrator is a code smell

**AI SDK Tools Pattern**:
- Dependency injection via function parameters
- Context objects passed through execution chain
- No global/static access

**Recommended Fix**:
```typescript
// Option A: Factory pattern with explicit dependencies
export function createServices(db: DrizzleDB): Services {
  const vectorIndex = new VectorIndexService();
  const toolSearch = new ToolSearchService();
  const pageService = new PageService(db, vectorIndex);
  // ... compose all services
  return { vectorIndex, toolSearch, pageService, ... };
}

// Option B: Request-scoped context (better for testing)
export interface RequestContext {
  db: DrizzleDB;
  services: Services;
  logger: Logger;
  traceId: string;
}
```

**Impact**: High - affects testability of entire codebase

---

### 2. Memory Provider Abstraction (HIGH)

**Current**: Working memory is tightly coupled to SQLite via `SessionService`.

**AI SDK Tools Pattern**:
```typescript
// Three-tier memory with provider abstraction
interface MemoryProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ttl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

// Auto-detects Upstash/Redis or falls back to in-memory
const memoryProvider = createMemoryProvider({
  upstashUrl: process.env.UPSTASH_URL,
  upstashToken: process.env.UPSTASH_TOKEN,
});
```

**Recommended Implementation**:
```typescript
// server/memory/providers/types.ts
export interface MemoryProvider {
  loadWorkingContext(sessionId: string): Promise<WorkingContext | null>;
  saveWorkingContext(sessionId: string, context: WorkingContext): Promise<void>;
  loadMessages(sessionId: string, limit?: number): Promise<ModelMessage[]>;
  saveMessage(sessionId: string, message: ModelMessage): Promise<void>;
}

// server/memory/providers/sqlite-provider.ts
export class SQLiteMemoryProvider implements MemoryProvider { ... }

// server/memory/providers/redis-provider.ts
export class RedisMemoryProvider implements MemoryProvider { ... }

// server/memory/providers/index.ts
export function createMemoryProvider(config: ProviderConfig): MemoryProvider {
  if (config.redis) {
    return new RedisMemoryProvider(config.redis);
  }
  return new SQLiteMemoryProvider(config.db);
}
```

**Benefits**:
- Redis for production (faster, cross-instance)
- SQLite for development (no setup)
- Easy to test with mock provider

---

### 3. Module-Level State in Agent (HIGH)

**Current** (`main-agent.ts`):
```typescript
// Module-level state - problematic for concurrent requests
let lastInjectedInstructions: { ... } | null = null;
let currentBaseSystemPrompt: string = "";
let persistedDiscoveredTools: string[] = [];
```

**Problem**: This state is shared across ALL concurrent requests. If two users send requests simultaneously, their state will collide.

**The Comment Says It All**:
> "NOTE: Module-level state is a limitation of AI SDK's ToolLoopAgent pattern."

**Recommended Fix**:
```typescript
// Option A: Request-scoped state via WeakMap
const requestState = new WeakMap<object, AgentRequestState>();

// Option B: Pass state through options (if AI SDK supports)
export interface AgentExecutionState {
  baseSystemPrompt: string;
  discoveredTools: string[];
  injectedInstructions: InjectedInstructions | null;
}

// Option C: Store in experimental_context (if accessible in prepareStep)
// This requires AI SDK changes or using a custom agent wrapper
```

**Workaround Until Fixed**:
```typescript
// At minimum, use a request ID to namespace state
const stateByRequestId = new Map<string, AgentRequestState>();

function getStateForRequest(requestId: string): AgentRequestState {
  if (!stateByRequestId.has(requestId)) {
    stateByRequestId.set(requestId, createInitialState());
  }
  return stateByRequestId.get(requestId)!;
}
```

---

### 4. Frontend Store Optimization (MEDIUM)

**Current** (`chat-store.ts`):
```typescript
// OK - simple store
export const useChatStore = create<ChatState>()((set, get) => ({ ... }));
```

**Issue in `use-agent.ts`**:
```typescript
// This creates a new object reference on every render
const chatActions = useChatStore((s) => ({
  addMessage: s.addMessage,
  setIsStreaming: s.setIsStreaming,
  // ... many more
}));
```

**Problem**: Object selectors always return new references, causing unnecessary re-renders.

**Recommended Fix**:
```typescript
// Option A: Stable actions (already stable since they don't change)
const addMessage = useChatStore((s) => s.addMessage);
const setIsStreaming = useChatStore((s) => s.setIsStreaming);

// Option B: Use shallow comparison for object selectors
import { useShallow } from 'zustand/react/shallow';

const chatActions = useChatStore(
  useShallow((s) => ({
    addMessage: s.addMessage,
    setIsStreaming: s.setIsStreaming,
    // ...
  }))
);

// Option C: Export actions separately from store (best)
// chat-store.ts
const chatStore = create<ChatState>()(...);
export const useChatStore = chatStore;
export const chatActions = {
  addMessage: (msg) => chatStore.setState((s) => ({ messages: [...s.messages, msg] })),
  setIsStreaming: (v) => chatStore.setState({ isStreaming: v }),
};
```

---

### 5. Tool Error Handling Inconsistency (MEDIUM)

**Current Pattern** (varies across tools):
```typescript
// Some tools return error in result
return { success: false, error: "Page not found" };

// Some tools throw
throw new Error("Page not found");

// Some tools return null
return null;
```

**AI SDK Tools Pattern**:
```typescript
// Consistent structure for all tools
interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Example usage
async function execute(input: Input): Promise<ToolResult<Page>> {
  try {
    const page = await service.getPage(input.id);
    if (!page) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: `Page ${input.id} not found` }
      };
    }
    return { success: true, data: page };
  } catch (e) {
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: e.message }
    };
  }
}
```

**Recommendation**: Create a standard result type and helper functions:
```typescript
// server/tools/_utils/result.ts
export type ToolResult<T> = SuccessResult<T> | ErrorResult;

export function success<T>(data: T): SuccessResult<T> {
  return { success: true, data };
}

export function error(code: string, message: string): ErrorResult {
  return { success: false, error: { code, message } };
}

export function notFound(entity: string, id: string): ErrorResult {
  return error('NOT_FOUND', `${entity} with id "${id}" not found`);
}
```

---

### 6. Prompt File Organization (LOW)

**Current**: XML prompt files in `server/prompts/tools/*.xml`

**AI SDK Tools Pattern**: Markdown files for prompts
- Better IDE support (syntax highlighting, preview)
- Easier to edit for non-developers
- Natural format for structured content

**Recommendation**:
```
server/prompts/
├── agent/
│   └── main-agent-prompt.md      # Main system prompt
├── tools/
│   └── getPage.md                # Tool-specific instructions
└── templates/
    └── memory-template.md        # Working memory template structure
```

**Not Critical** - XML works fine, this is DX preference.

---

## Architecture Comparison Table

| Aspect | Your Codebase | AI SDK Tools | Gap Level |
|--------|--------------|--------------|-----------|
| **Tool Organization** | Per-folder with metadata/schema/execute | Per-folder with schema | ✅ Better |
| **Type Safety** | Zod throughout | Zod throughout | ✅ Equal |
| **Service Injection** | Static singleton | Context passing | ⚠️ Needs work |
| **Memory System** | WorkingContext + SQLite | Provider abstraction | ⚠️ Needs work |
| **Event System** | Typed SSE emitter | Similar | ✅ Equal |
| **State Management** | Zustand stores | Artifacts + hooks | ✅ Equal |
| **Multi-Agent** | Single agent + tool discovery | Triage → specialists | ℹ️ Different approach |
| **Caching** | SimpleCache + CMS cache | @ai-sdk-tools/cache | ✅ Equal |
| **Error Handling** | Inconsistent | Structured results | ⚠️ Needs standardization |

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. Add `useShallow` to frontend store selectors
2. Create standard ToolResult type and apply to new tools
3. Document the module-level state issue with TODO for future fix

### Phase 2: Medium Effort (1 week)
4. Create MemoryProvider abstraction
5. Implement Redis provider for production
6. Refactor ServiceContainer to factory pattern

### Phase 3: Larger Refactors (Future)
7. Solve module-level state in main-agent.ts (may require AI SDK changes)
8. Consider markdown prompts migration
9. Evaluate multi-agent architecture if tool count grows beyond ~50

---

## Files to Modify

**Phase 1**:
- `app/assistant/_hooks/use-agent.ts` - Add useShallow
- `server/tools/_utils/result.ts` - New file for ToolResult type

**Phase 2**:
- `server/memory/providers/` - New provider abstraction
- `server/services/service-container.ts` - Refactor to factory
- `server/agents/main-agent.ts` - Document/mitigate state issue

---

## Conclusion

Your codebase follows many best practices already. The most impactful improvements are:

1. **Service Container refactor** - Improves testability significantly
2. **Memory Provider abstraction** - Enables Redis for production scale
3. **Module-level state fix** - Required for concurrent request safety

The tool organization, type safety, and event system are already excellent and match or exceed the AI SDK Tools patterns.

**Next Step**: Would you like me to implement any of these improvements? I recommend starting with Phase 1 (quick wins) first.
