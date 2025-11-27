# Layer 1.5: Route Architecture

> Modular router factories with Zod validation, URL patterns, and service injection

## Overview

Routes are organized as factory functions that receive the ServiceContainer and return Express routers. Each route module is responsible for a specific domain (CMS, sessions, agent, etc.) and follows consistent patterns: Zod validation at the boundary, service method calls, and consistent ApiResponse formatting.

**Key Responsibilities:**
- Define REST endpoints for each domain
- Validate request bodies with Zod schemas
- Extract context from URL parameters
- Delegate to service methods
- Return consistent response format

---

## The Problem

Without structured routing, endpoint handling becomes chaotic:

```typescript
// WRONG: Inline validation
router.post("/pages", (req, res) => {
  if (!req.body.name || req.body.name.length < 1) {
    return res.status(400).json({ error: "Name required" });
  }
  // More manual checks...
});

// WRONG: Services accessed globally
router.get("/pages", async (req, res) => {
  const pageService = require('../services/page-service');
  const pages = await pageService.listPages();
});

// WRONG: Inconsistent responses
router.get("/pages/:id", async (req, res) => {
  res.json(page);           // Route A
  res.json({ page });       // Route B
  res.json({ data: page }); // Route C
});
```

**Our Solution:**
1. Factory functions receive injected services
2. Zod schemas validate all inputs
3. Try/catch with `next(error)` for centralized error handling
4. ApiResponse helpers for consistent format

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROUTE ARCHITECTURE                           │
│                                                                  │
│  server/index.ts                                                 │
│       │                                                          │
│       ├─ app.use("/api", uploadRoutes)                          │
│       ├─ app.use("/api", imageRoutes)                           │
│       ├─ app.use("/v1/teams/:team/.../", createCMSRoutes())     │
│       ├─ app.use("/v1/agent", createAgentRoutes())              │
│       └─ app.use("/v1/sessions", createSessionRoutes())         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    FACTORY PATTERN                       │    │
│  │                                                          │    │
│  │  export function createCMSRoutes(services: ServiceContainer) │
│  │  {                                                       │    │
│  │    const router = express.Router();                      │    │
│  │                                                          │    │
│  │    router.post("/pages", async (req, res, next) => {     │    │
│  │      try {                                               │    │
│  │        // 1. Validate input                              │    │
│  │        const input = createPageSchema.parse(req.body);   │    │
│  │                                                          │    │
│  │        // 2. Extract context                             │    │
│  │        const { siteId, environmentId } = await          │    │
│  │          getSiteAndEnv(services.db, ...);               │    │
│  │                                                          │    │
│  │        // 3. Call service                                │    │
│  │        const page = await services.pageService          │    │
│  │          .createPage({ ...input, siteId, environmentId }); │  │
│  │                                                          │    │
│  │        // 4. Return response                             │    │
│  │        res.status(201).json(ApiResponse.success(page));  │    │
│  │      } catch (error) {                                   │    │
│  │        next(error);  // → Error handler middleware       │    │
│  │      }                                                   │    │
│  │    });                                                   │    │
│  │                                                          │    │
│  │    return router;                                        │    │
│  │  }                                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/routes/cms.ts` | Pages, sections, collections, entries |
| `server/routes/sessions.ts` | Session and message management |
| `server/routes/agent.ts` | Streaming and non-streaming agent |
| `server/routes/upload.ts` | File upload endpoint |
| `server/routes/images.ts` | Image status, search, details |
| `server/routes/posts.ts` | Blog post frontend routes |
| `server/types/api-response.ts` | Response helpers and error codes |
| `server/utils/get-context.ts` | URL context extraction |

---

## Core Implementation

### Route Factory Pattern

```typescript
// server/routes/cms.ts
import express from "express";
import { z } from "zod";
import type { ServiceContainer } from "../services/service-container";
import { ApiResponse, ErrorCodes, HttpStatus } from "../types/api-response";

export function createCMSRoutes(services: ServiceContainer) {
  const router = express.Router();

  // Pages CRUD
  router.get("/pages", async (req, res, next) => {
    try {
      const pages = await services.pageService.listPages();
      res.json(ApiResponse.success(pages));
    } catch (error) {
      next(error);
    }
  });

  // ... more routes

  return router;
}
```

### Zod Schema Validation

```typescript
// server/routes/cms.ts
const createPageSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]{2,64}$/),
  indexing: z.boolean().optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

const updatePageSchema = createPageSchema.partial();

router.post("/pages", async (req, res, next) => {
  try {
    // Zod validates - throws ZodError if invalid
    const input = createPageSchema.parse(req.body);

    const page = await services.pageService.createPage({
      ...input,
      siteId,
      environmentId,
    });
    res.status(HttpStatus.CREATED).json(ApiResponse.success(page));
  } catch (error) {
    // ZodError caught by error handler → 400 VALIDATION_ERROR
    next(error);
  }
});
```

### Context Extraction

```typescript
// server/utils/get-context.ts
import type { DrizzleDB } from "../db/client";

export async function getSiteAndEnv(
  db: DrizzleDB,
  siteName: string,
  envName: string
) {
  const site = await db.query.sites.findFirst({
    where: (sites, { eq }) => eq(sites.name, siteName),
  });

  if (!site) {
    throw new Error(`Site '${siteName}' not found`);
  }

  const env = await db.query.environments.findFirst({
    where: (environments, { eq, and }) =>
      and(
        eq(environments.name, envName),
        eq(environments.siteId, site.id)
      ),
  });

  if (!env) {
    throw new Error(`Environment '${envName}' not found`);
  }

  return { siteId: site.id, environmentId: env.id };
}
```

### ApiResponse Helpers

```typescript
// server/types/api-response.ts
export const ApiResponse = {
  success: <T>(data: T, meta?: Partial<ResponseMeta>): ApiResponse<T> => ({
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      ...meta,
    },
  }),

  error: (
    code: string,
    message: string,
    details?: unknown
  ): ApiResponse<never> => ({
    success: false,
    error: { code, message, details },
    meta: { timestamp: Date.now() },
  }),

  paginated: <T>(
    data: T[],
    pagination: PaginationMeta
  ): ApiResponse<T[]> => ({
    success: true,
    data,
    meta: { timestamp: Date.now(), pagination },
  }),
};
```

### Session Routes

```typescript
// server/routes/sessions.ts
export function createSessionRoutes(services: ServiceContainer) {
  const router = express.Router();

  const createSessionSchema = z.object({
    title: z.string().min(1).max(200).optional(),
  });

  // POST /v1/sessions - Create new session
  router.post("/", async (req, res, next) => {
    try {
      const input = createSessionSchema.parse(req.body);
      const session = await services.sessionService.createSession(input);
      res.status(HttpStatus.CREATED).json(ApiResponse.success(session));
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/sessions - List all sessions
  router.get("/", async (req, res, next) => {
    try {
      const sessions = await services.sessionService.listSessions();
      res.json(ApiResponse.success(sessions));
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/sessions/:id - Get session with messages
  router.get("/:id", async (req, res, next) => {
    try {
      const session = await services.sessionService.getSessionById(
        req.params.id
      );
      res.json(ApiResponse.success(session));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

### Agent Streaming Route

```typescript
// server/routes/agent.ts
const agentRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  prompt: z.string().min(1),
  toolsEnabled: z.array(z.string()).optional(),
  cmsTarget: z.object({
    siteId: z.string().optional(),
    environmentId: z.string().optional()
  }).optional()
});

router.post('/stream', async (req, res) => {
  try {
    const input = agentRequestSchema.parse(req.body);

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // SSE helper
    const writeSSE = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Create agent context with services
    const context: AgentContext = {
      db: services.db,
      vectorIndex: services.vectorIndex,
      logger,
      traceId,
      sessionId,
      services,
      sessionService: services.sessionService,
      cmsTarget
    };

    // Execute agent
    const result = await streamAgentWithApproval(
      input.prompt,
      context,
      previousMessages,
      approvalHandler
    );

    // Send final result
    writeSSE('result', { traceId, sessionId, text: result.text, ... });
    writeSSE('done', { traceId, sessionId });
    res.end();

  } catch (error) {
    res.status(HttpStatus.BAD_REQUEST).json(
      ApiResponse.error(ErrorCodes.VALIDATION_ERROR, error.message)
    );
  }
});
```

---

## URL Structure

### Multi-Tenant CMS Routes

```
/v1/teams/:team/sites/:site/environments/:env/
├── pages                    GET, POST
├── pages/:page              GET, PUT, DELETE
├── pages/:page/section      POST
├── pages/:page/contents     GET
├── pages/:page/sections/:section/contents  POST
├── sections                 GET, POST
├── sections/:section        GET, PUT, DELETE
├── collections              GET, POST
├── collections/:collection  GET, PUT, DELETE
├── collections/:collection/entries          GET, POST
├── collections/:collection/entries/:entry   GET, DELETE
└── search/resources         POST
```

### Session Routes

```
/v1/sessions/
├── /                        GET (list), POST (create)
├── /:id                     GET, PATCH, DELETE
├── /:id/messages            POST, DELETE
└── /:id/checkpoint          DELETE
```

### Agent Routes

```
/v1/agent/
├── /stream                  POST (SSE streaming)
├── /generate                POST (non-streaming)
└── /approval/:approvalId    POST (HITL approval)
```

### Image API Routes

```
/api/
├── upload                   POST (Multer file upload)
├── images/:id/status        GET
├── images/:id/thumbnail     GET
├── images/:id/details       GET
├── images/conversation/:sessionId  GET
├── images/search            GET (with rate limiting)
├── images/find              POST
└── images/:id               DELETE
```

---

## Design Decisions

### Why Router Factories?

```typescript
// Option A: Export router directly
export const router = express.Router();
router.get("/pages", (req, res) => {
  // How to access services?
});

// Option B: Factory function (chosen)
export function createCMSRoutes(services: ServiceContainer) {
  const router = express.Router();
  router.get("/pages", (req, res) => {
    await services.pageService.listPages(); // Services injected
  });
  return router;
}
```

**Reasons:**
1. **Dependency injection** - Services passed explicitly
2. **Testability** - Can inject mock services
3. **No global state** - No module-level service access
4. **Type safety** - ServiceContainer type defines what's available

### Why Zod at Route Level?

```typescript
// Option A: Validate in service
pageService.createPage(req.body); // Service validates

// Option B: Validate in route (chosen)
const input = createPageSchema.parse(req.body);
pageService.createPage(input);
```

**Reasons:**
1. **Fail fast** - Invalid data rejected before service call
2. **Type inference** - `input` has correct TypeScript type
3. **Centralized errors** - ZodError caught by error handler
4. **Clean services** - Services trust they receive valid data

### Why Try/Catch + next(error)?

```typescript
// All routes follow this pattern
router.post("/pages", async (req, res, next) => {
  try {
    // Route logic
  } catch (error) {
    next(error); // Always pass to error handler
  }
});
```

**Reasons:**
1. **Async errors** - Express doesn't catch async rejections automatically
2. **Centralized handling** - All errors processed by error middleware
3. **Consistent format** - Error handler ensures same response shape
4. **Stack traces** - Errors logged with full context

### Why Explicit 404 in GET Routes?

```typescript
router.get("/pages/:page", async (req, res, next) => {
  try {
    const page = await services.pageService.getPageById(req.params.page);

    if (!page) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiResponse.error(ErrorCodes.NOT_FOUND, "Page not found")
      );
    }

    res.json(ApiResponse.success(page));
  } catch (error) {
    next(error);
  }
});
```

**Reasons:**
1. **Clear intention** - Explicitly checking for null result
2. **Specific message** - "Page not found" vs generic "Not found"
3. **Alternative** - Could throw in service, but less explicit

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1.1 (Bootstrap) | Routes mounted in startServer() |
| Layer 1.2 (Container) | ServiceContainer passed to factories |
| Layer 1.3 (Middleware) | Routes processed after body parsing |
| Layer 1.4 (Error Handler) | `next(error)` sends to error middleware |
| Layer 4 (Services) | Services called via container |
| Layer 3 (Agent) | AgentContext built from services |

### Mounting in index.ts

```typescript
// server/index.ts
async function startServer() {
  const services = await ServiceContainer.initialize(db);

  // Mount routes with services
  app.use("/api", uploadRoutes);
  app.use("/api", imageRoutes);
  app.use(
    "/v1/teams/:team/sites/:site/environments/:env",
    createCMSRoutes(services)
  );
  app.use("/v1/agent", createAgentRoutes(services));
  app.use("/v1/sessions", createSessionRoutes(services));

  // Error handler LAST
  app.use(errorHandler);
}
```

---

## Common Issues / Debugging

### Route Not Found (404)

```
GET /v1/pages → 404
```

**Cause:** Route mounted at wrong path.

**Debug:**

```typescript
// Check actual mount path
app.use("/v1/teams/:team/sites/:site/environments/:env", createCMSRoutes());
// Full path: /v1/teams/x/sites/y/environments/z/pages

// NOT:
// /v1/pages
```

### Validation Errors Not Formatted

```json
{
  "success": false,
  "issues": [...]  // Raw Zod output
}
```

**Cause:** Error handler not processing ZodError.

**Fix:** Ensure error handler checks for ZodError:

```typescript
if (err instanceof ZodError) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: err.issues,
    },
  });
}
```

### req.params Not Available

```typescript
router.get("/pages/:page", (req, res) => {
  console.log(req.params.page); // undefined!
});
```

**Cause:** Parent router doesn't pass params.

**Fix:** Use `mergeParams` in sub-routers:

```typescript
const router = express.Router({ mergeParams: true });
```

### Async Errors Not Caught

```
UnhandledPromiseRejection: Error: Database connection failed
```

**Cause:** Missing try/catch in async handler.

**Fix:** Always wrap async routes:

```typescript
// WRONG
router.get("/pages", async (req, res) => {
  const pages = await services.pageService.listPages(); // Throws!
  res.json(pages);
});

// RIGHT
router.get("/pages", async (req, res, next) => {
  try {
    const pages = await services.pageService.listPages();
    res.json(ApiResponse.success(pages));
  } catch (error) {
    next(error);
  }
});
```

### SSE Connection Closed Unexpectedly

```
Error: write after end
```

**Cause:** Writing to closed response.

**Fix:** Check connection before writing:

```typescript
const writeSSE = (event: string, data: any) => {
  if (!res.writableEnded) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
};
```

---

## Route Patterns Summary

### CRUD Pattern

```typescript
// List
router.get("/resources", async (req, res, next) => {
  try {
    const items = await service.list();
    res.json(ApiResponse.success(items));
  } catch (error) {
    next(error);
  }
});

// Create
router.post("/resources", async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const item = await service.create(input);
    res.status(HttpStatus.CREATED).json(ApiResponse.success(item));
  } catch (error) {
    next(error);
  }
});

// Read
router.get("/resources/:id", async (req, res, next) => {
  try {
    const item = await service.getById(req.params.id);
    if (!item) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiResponse.error(ErrorCodes.NOT_FOUND, "Resource not found")
      );
    }
    res.json(ApiResponse.success(item));
  } catch (error) {
    next(error);
  }
});

// Update
router.put("/resources/:id", async (req, res, next) => {
  try {
    const input = updateSchema.parse(req.body);
    const item = await service.update(req.params.id, input);
    if (!item) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiResponse.error(ErrorCodes.NOT_FOUND, "Resource not found")
      );
    }
    res.json(ApiResponse.success(item));
  } catch (error) {
    next(error);
  }
});

// Delete
router.delete("/resources/:id", async (req, res, next) => {
  try {
    await service.delete(req.params.id);
    res.json(ApiResponse.success({ success: true }));
  } catch (error) {
    next(error);
  }
});
```

---

## Further Reading

- [Layer 1.2: Service Container](./LAYER_1.2_SERVICE_CONTAINER.md) - DI pattern
- [Layer 1.4: Error Handling](./LAYER_1.4_ERROR_HANDLING.md) - Error normalization
- [Layer 1.6: File Upload](./LAYER_1.6_FILE_UPLOAD.md) - Multer routes
- [Layer 3.7: Streaming](./LAYER_3.7_STREAMING.md) - SSE patterns
- [Zod Documentation](https://zod.dev/) - Schema validation
- [Express Router](https://expressjs.com/en/guide/routing.html) - Routing basics
