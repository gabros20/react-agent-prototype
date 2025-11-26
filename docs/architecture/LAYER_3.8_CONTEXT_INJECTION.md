# Layer 3.8: Context Injection

> How tools and services receive the context they need

## Overview

Context injection provides tools with access to databases, services, logging, and request-specific information without global state or manual parameter passing. We use AI SDK v6's `experimental_context` pattern combined with a singleton ServiceContainer.

**Key Files:**
- `server/agent/orchestrator.ts` - Context creation
- `server/services/service-container.ts` - Service singleton
- `server/utils/get-context.ts` - Request context extraction

---

## The Problem

Tools need access to many things:
- Database for queries
- Services for business logic
- Logger for debugging
- Stream for real-time feedback
- Session ID for persistence
- Site/environment for multi-tenancy

Without proper injection:
```typescript
// BAD: Global state
const db = globalDb;
const logger = globalLogger;

// BAD: Long parameter chains
async function createPage(title, db, logger, stream, siteId, envId, sessionId) { ... }
```

With context injection:
```typescript
// GOOD: Single context object
execute: async (input, { experimental_context }) => {
  const ctx = experimental_context as AgentContext;
  // ctx.db, ctx.logger, ctx.services, etc.
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Context Injection System                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Request Arrives                          ││
│  │                                                             ││
│  │   POST /v1/agent/stream                                     ││
│  │   { sessionId, message, cmsTarget? }                        ││
│  └───────────────────────────┬─────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                 Context Assembly                            ││
│  │                                                             ││
│  │  AgentContext = {                                           ││
│  │    // From ServiceContainer (singleton)                     ││
│  │    db,                                                      ││
│  │    vectorIndex,                                             ││
│  │    services: { page, section, entry, image, post, ... },   ││
│  │                                                             ││
│  │    // Created per-request                                   ││
│  │    logger,       ← Streams to SSE                           ││
│  │    stream,       ← SSE writer                               ││
│  │    traceId,      ← UUID for this request                    ││
│  │    sessionId,    ← From request body                        ││
│  │                                                             ││
│  │    // Multi-tenant targeting                                ││
│  │    cmsTarget: { siteId, environmentId }                     ││
│  │  }                                                          ││
│  └───────────────────────────┬─────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Agent Execution                          ││
│  │                                                             ││
│  │  new ToolLoopAgent({                                        ││
│  │    experimental_context: agentContext,  ← Passed here      ││
│  │    tools: ALL_TOOLS,                                        ││
│  │    ...                                                      ││
│  │  })                                                         ││
│  └───────────────────────────┬─────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Tool Execution                           ││
│  │                                                             ││
│  │  execute: async (input, { experimental_context }) => {     ││
│  │    const ctx = experimental_context as AgentContext;        ││
│  │    // Full access to all context                            ││
│  │  }                                                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## AgentContext Interface

```typescript
// server/agent/types.ts
interface AgentContext {
  // === DATABASE ===
  db: DrizzleDB;  // Direct database access

  // === SERVICES ===
  vectorIndex: VectorIndexService;  // Semantic search

  services: {
    pageService: PageService;
    sectionService: SectionService;
    entryService: EntryService;
    imageService: ImageService;
    postService: PostService;
    navigationService: NavigationService;
    siteSettingsService: SiteSettingsService;
  };

  sessionService: SessionService;  // Chat persistence

  // === LOGGING ===
  logger: {
    info: (message: string, metadata?: object) => void;
    warn: (message: string, metadata?: object) => void;
    error: (message: string, metadata?: object) => void;
  };

  // === STREAMING ===
  stream?: {
    write: (event: StreamEvent) => void;
  };

  // === IDENTIFIERS ===
  traceId: string;      // Request correlation
  sessionId: string;    // Conversation thread

  // === MULTI-TENANT ===
  cmsTarget?: {
    siteId: string;
    environmentId: string;
  };
}
```

---

## ServiceContainer (Singleton)

The ServiceContainer holds all long-lived services:

```typescript
// server/services/service-container.ts
class ServiceContainer {
  private static instance: ServiceContainer;

  // Database
  readonly db: DrizzleDB;

  // Services
  readonly vectorIndex: VectorIndexService;
  readonly pageService: PageService;
  readonly sectionService: SectionService;
  readonly entryService: EntryService;
  readonly imageService: ImageService;
  readonly postService: PostService;
  readonly navigationService: NavigationService;
  readonly siteSettingsService: SiteSettingsService;
  readonly sessionService: SessionService;

  private constructor() {
    // Initialize database
    this.db = createDatabase();

    // Initialize vector index (requires async)
    // Handled separately via initialize()
  }

  static async initialize(): Promise<ServiceContainer> {
    if (!this.instance) {
      this.instance = new ServiceContainer();

      // Async initialization
      this.instance.vectorIndex = await VectorIndexService.create();

      // Initialize services with dependencies
      this.instance.pageService = new PageService(
        this.instance.db,
        this.instance.vectorIndex
      );
      // ... other services
    }
    return this.instance;
  }

  static get(): ServiceContainer {
    if (!this.instance) {
      throw new Error('ServiceContainer not initialized');
    }
    return this.instance;
  }

  async dispose(): Promise<void> {
    await this.vectorIndex.close();
    // Cleanup other resources
  }
}

export const getContainer = () => ServiceContainer.get();
```

### Why Singleton?

| Approach | Tradeoff |
|----------|----------|
| Create per request | Expensive, slow startup |
| Dependency injection | Complex setup |
| Singleton | Simple, fast, appropriate for stateless services |

Services are stateless - they only transform data. Singleton is appropriate.

---

## Per-Request Context

Created fresh for each request:

```typescript
// server/routes/agent.ts
router.post('/stream', async (req, res) => {
  const container = getContainer();
  const traceId = randomUUID();

  // Create streaming logger
  const logger = createStreamingLogger(res, traceId);

  // Resolve CMS target (multi-tenant)
  const cmsTarget = await resolveCmsTarget(req.body.cmsTarget, container.db);

  // Assemble full context
  const agentContext: AgentContext = {
    // From container (shared)
    db: container.db,
    vectorIndex: container.vectorIndex,
    services: {
      pageService: container.pageService,
      sectionService: container.sectionService,
      entryService: container.entryService,
      imageService: container.imageService,
      postService: container.postService,
      navigationService: container.navigationService,
      siteSettingsService: container.siteSettingsService
    },
    sessionService: container.sessionService,

    // Per-request (unique)
    logger,
    stream: { write: (event) => writeSSE(res, event) },
    traceId,
    sessionId: req.body.sessionId,
    cmsTarget
  };

  // Execute agent with this context
  for await (const event of streamAgent(messages, agentContext)) {
    // ... handle events
  }
});
```

---

## CMS Target Resolution (Multi-Tenant)

The system supports multiple sites/environments:

```typescript
// server/utils/get-context.ts
interface CmsTarget {
  siteId: string;
  environmentId: string;
}

async function resolveCmsTarget(
  input: { siteId?: string; siteName?: string; envName?: string } | undefined,
  db: DrizzleDB
): Promise<CmsTarget> {
  // Option 1: Direct UUID provided
  if (input?.siteId?.includes('-')) {
    // Looks like UUID, use directly
    const env = await db.query.environments.findFirst({
      where: eq(environments.siteId, input.siteId)
    });
    return {
      siteId: input.siteId,
      environmentId: env?.id || input.siteId  // Fallback
    };
  }

  // Option 2: Name-based lookup
  if (input?.siteName) {
    const site = await db.query.sites.findFirst({
      where: eq(sites.slug, input.siteName)
    });
    const env = await db.query.environments.findFirst({
      where: and(
        eq(environments.siteId, site?.id),
        eq(environments.slug, input.envName || 'main')
      )
    });
    if (site && env) {
      return { siteId: site.id, environmentId: env.id };
    }
  }

  // Option 3: Default (first available)
  const site = await db.query.sites.findFirst();
  const env = await db.query.environments.findFirst({
    where: eq(environments.siteId, site?.id)
  });

  if (!site || !env) {
    throw new Error('No site/environment found');
  }

  return { siteId: site.id, environmentId: env.id };
}
```

### Request Examples

```typescript
// Explicit UUIDs
{ cmsTarget: { siteId: "site-abc-123", environmentId: "env-xyz-789" } }

// Name-based
{ cmsTarget: { siteName: "my-site", envName: "production" } }

// Default (local development)
{ }  // Uses first available site/env
```

---

## Tracing

### TraceId

Generated per request for correlation:

```typescript
const traceId = randomUUID();
// Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

Used for:
- Log correlation
- Error tracking
- Performance monitoring

### SessionId

Persists across requests in a conversation:

```typescript
// First request - create session
const session = await sessionService.createSession();
// session.id = "sess-abc123"

// Subsequent requests - reuse
{ sessionId: "sess-abc123", message: "..." }
```

### Propagation

```typescript
// All logs include traceId
logger.info('Processing request', { traceId });

// All SSE events include traceId
writeSSE('log', { message: '...', traceId });

// Database queries can be tagged
await db.query.pages.findMany({
  // Query comments for tracing (if supported)
});
```

---

## Streaming Logger

Logger that outputs to both console and SSE stream:

```typescript
function createStreamingLogger(
  res: Response,
  traceId: string
): AgentContext['logger'] {
  const writeSSE = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  return {
    info: (message: string, metadata?: object) => {
      // Console output
      console.log(`[INFO] [${traceId.slice(0, 8)}] ${message}`, metadata || '');

      // Stream to frontend
      writeSSE('log', {
        level: 'info',
        message,
        metadata,
        timestamp: new Date().toISOString(),
        traceId
      });
    },

    warn: (message: string, metadata?: object) => {
      console.warn(`[WARN] [${traceId.slice(0, 8)}] ${message}`, metadata || '');
      writeSSE('log', { level: 'warn', message, metadata, timestamp: new Date().toISOString(), traceId });
    },

    error: (message: string, metadata?: object) => {
      console.error(`[ERROR] [${traceId.slice(0, 8)}] ${message}`, metadata || '');
      writeSSE('log', { level: 'error', message, metadata, timestamp: new Date().toISOString(), traceId });
    }
  };
}
```

---

## Tool Access Pattern

Every tool follows this pattern:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const cms_createPage = tool({
  description: 'Create a new page',
  inputSchema: z.object({
    title: z.string(),
    slug: z.string().optional()
  }),

  execute: async (input, { experimental_context }) => {
    // Type assertion (AI SDK uses unknown)
    const ctx = experimental_context as AgentContext;

    // Log action
    ctx.logger.info('Creating page', { title: input.title });

    // Use service (respects multi-tenant target)
    const page = await ctx.services.pageService.createPage(
      ctx.cmsTarget.siteId,
      ctx.cmsTarget.environmentId,
      {
        title: input.title,
        slug: input.slug || slugify(input.title)
      }
    );

    // Log result
    ctx.logger.info('Page created', { pageId: page.id });

    return {
      success: true,
      page: { id: page.id, title: page.title, slug: page.slug }
    };
  }
});
```

### What Tools Can Access

| Property | Use Case |
|----------|----------|
| `ctx.db` | Direct queries (rare) |
| `ctx.services.*` | Business logic (common) |
| `ctx.vectorIndex` | Semantic search |
| `ctx.logger` | Debug output |
| `ctx.cmsTarget` | Multi-tenant targeting |
| `ctx.sessionId` | Session correlation |
| `ctx.traceId` | Request tracing |

---

## Design Decisions

### Why `experimental_context`?

AI SDK v6 provides this mechanism specifically for passing context to tools:

```typescript
// AI SDK passes context automatically
new ToolLoopAgent({
  experimental_context: myContext,  // Provided here
  tools: { myTool }                  // Available in tools
});

// Tools receive it
tool({
  execute: async (input, { experimental_context }) => {
    // Access here
  }
});
```

**Benefits:**
- No global state
- Type-safe access
- Per-request isolation
- Framework-supported pattern

### Why Not Dependency Injection Framework?

| Option | Tradeoff |
|--------|----------|
| InversifyJS | Heavy, complex for our needs |
| tsyringe | Decorator-based, adds complexity |
| Simple singleton | Sufficient, easy to understand |

Our services are stateless and don't have complex dependency graphs. Simple singleton is appropriate.

### Why Type Assertion?

```typescript
const ctx = experimental_context as AgentContext;
```

AI SDK types `experimental_context` as `unknown`. We assert to our known type because:
- We control what's passed
- TypeScript can't infer across the framework boundary
- Runtime will fail fast if wrong

---

## Testing with Context

### Mock Context

```typescript
function createMockContext(overrides?: Partial<AgentContext>): AgentContext {
  return {
    db: mockDb,
    vectorIndex: mockVectorIndex,
    services: {
      pageService: mockPageService,
      sectionService: mockSectionService,
      // ...
    },
    sessionService: mockSessionService,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    },
    traceId: 'test-trace-id',
    sessionId: 'test-session-id',
    cmsTarget: {
      siteId: 'test-site',
      environmentId: 'test-env'
    },
    ...overrides
  };
}
```

### Tool Testing

```typescript
describe('cms_createPage', () => {
  it('creates a page and logs correctly', async () => {
    const ctx = createMockContext();
    const mockCreate = jest.fn().mockResolvedValue({
      id: 'page-123',
      title: 'Test',
      slug: 'test'
    });
    ctx.services.pageService.createPage = mockCreate;

    const result = await cms_createPage.execute(
      { title: 'Test' },
      { experimental_context: ctx }
    );

    expect(mockCreate).toHaveBeenCalledWith(
      'test-site',
      'test-env',
      expect.objectContaining({ title: 'Test' })
    );
    expect(ctx.logger.info).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });
});
```

---

## Integration Points

| Connects To | How |
|-------------|-----|
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) | Context passed to agent |
| [3.2 Tools](./LAYER_3.2_TOOLS.md) | Tools access via experimental_context |
| [3.7 Streaming](./LAYER_3.7_STREAMING.md) | Logger streams to SSE |
| Layer 1 (Server) | ServiceContainer initialization |
| Layer 4 (Services) | Services in context |

---

## Common Patterns

### Accessing Services

```typescript
// Good: Use service methods
const pages = await ctx.services.pageService.getPages(
  ctx.cmsTarget.siteId,
  ctx.cmsTarget.environmentId
);

// Avoid: Direct DB when service exists
// const pages = await ctx.db.query.pages.findMany(...);
```

### Logging Appropriately

```typescript
// Info: Normal operations
ctx.logger.info('Fetching pages', { count: pages.length });

// Warn: Unexpected but handled
ctx.logger.warn('No images found for query', { query });

// Error: Problems needing attention
ctx.logger.error('Failed to create page', { error: error.message });
```

### Multi-Tenant Awareness

```typescript
// Always use cmsTarget for data operations
const page = await ctx.services.pageService.createPage(
  ctx.cmsTarget.siteId,      // Correct site
  ctx.cmsTarget.environmentId, // Correct environment
  data
);

// Never hardcode site/env
// const page = await pageService.createPage("hardcoded-site", ...);  // BAD
```

---

## Further Reading

- [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Context usage in orchestrator
- [3.2 Tools](./LAYER_3.2_TOOLS.md) - Tool access pattern
- [3.7 Streaming](./LAYER_3.7_STREAMING.md) - Logger integration
- [Layer 4 Services](./LAYER_4_SERVICES.md) - Service implementation
