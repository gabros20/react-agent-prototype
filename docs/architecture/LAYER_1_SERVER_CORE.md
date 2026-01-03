# Layer 1: Server Core

> Express.js application foundation, dependency injection, routing, and middleware

## Overview

The server core provides the HTTP foundation for the entire system. It bootstraps Express, configures middleware, sets up dependency injection, and defines API routes.

**Entry Point:** `server/index.ts`
**Port:** 8787

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Express App                          │
├──────────────────────────────────────────────────────────┤
│  Middleware Stack                                        │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────────┐ │
│  │  CORS   │ Logger  │BodyParse│ Static  │ ErrorHandle │ │
│  └─────────┴─────────┴─────────┴─────────┴─────────────┘ │
├──────────────────────────────────────────────────────────┤
│  Route Handlers                                          │
│  ┌─────────────┬────────────┬───────────┬─────────────┐  │
│  │ /v1/agent   │ /v1/session│ /v1/cms   │ /api/images │  │
│  └─────────────┴────────────┴───────────┴─────────────┘  │
├──────────────────────────────────────────────────────────┤
│  Services (Factory Initialized)                          │
│  ┌─────────┬─────────┬─────────┬─────────┬────────────┐  │
│  │   DB    │ Vector  │  Page   │ Section │  Session   │  │
│  └─────────┴─────────┴─────────┴─────────┴────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                                   | Purpose                              |
| -------------------------------------- | ------------------------------------ |
| `server/index.ts`                      | App bootstrap, middleware setup      |
| `server/services/create-services.ts`   | Service factory (async initialization) |
| `server/middleware/`                   | CORS, logging, errors, uploads       |
| `server/routes/`                       | API route definitions                |
| `server/execution/orchestrator.ts`     | Agent execution coordination         |
| `server/agents/main-agent.ts`          | ToolLoopAgent singleton              |
| `server/tools/_registry/`              | Tool registry system                 |

---

## Service Factory

Services are initialized via an async factory function at startup. This replaces the older singleton pattern with explicit dependency injection.

```typescript
// server/services/create-services.ts
export async function createServices({ db }: { db: DrizzleDB }): Promise<Services> {
	const vectorIndex = new VectorIndexService();
	await vectorIndex.initialize();

	const pageService = new PageService(db, vectorIndex);
	const sectionService = new SectionService(db);
	const entryService = new EntryService(db);
	const sessionService = new SessionService(db);
	// ... other services

	return {
		db,
		vectorIndex,
		pageService,
		sectionService,
		entryService,
		sessionService,
		// ...
	};
}
```

**Initialization:**

```typescript
// server/index.ts
const services = await createServices({ db });

// Routes receive services as parameter
app.use("/v1/agent", createAgentRoutes(services));
app.use("/v1/sessions", createSessionRoutes(services));
```

---

## Middleware Stack

Middleware executes in order for every request:

| Order | Middleware     | Purpose                    |
| ----- | -------------- | -------------------------- |
| 1     | CORS           | Cross-origin configuration |
| 2     | Request Logger | Log method, path, duration |
| 3     | Body Parser    | JSON + URL-encoded bodies  |
| 4     | Static Files   | Serve `/uploads/*`         |
| 5     | Routes         | Handle API endpoints       |
| 6     | Error Handler  | Catch + format errors      |

### Error Handler

All errors are normalized to a consistent `ApiResponse` format:

```typescript
// server/middleware/error-handler.ts
interface ApiResponse<T = null> {
	success: boolean;
	data: T | null;
	error: string | null;
}

// Usage: throw new ApiError(404, 'Page not found')
```

---

## Route Structure

Routes are modular and mounted by resource type:

```
/v1
├── /agent
│   └── /stream          POST - SSE agent execution (via orchestrator)
├── /sessions
│   ├── /                GET/POST - List/create sessions
│   ├── /:id             GET/DELETE - Session details
│   ├── /:id/messages    GET - Message history
│   └── /:id/logs        GET - Conversation logs
├── /cms
│   ├── /pages           GET/POST/PUT/DELETE
│   ├── /sections        GET/POST/PUT/DELETE
│   ├── /entries         GET/POST/PUT/DELETE
│   └── /images          GET/POST/PUT/DELETE

/api
├── /upload              POST - File upload (multer)
└── /images              GET/POST/DELETE - Image management

/uploads                 Static file serving
```

---

## Request Context

Routes that operate on CMS data extract context from URL params:

```typescript
// server/utils/get-context.ts
export function getContext(req: Request) {
	const { team, site, env } = req.params;
	return { teamSlug: team, siteSlug: site, envSlug: env };
}
```

This context flows through to services and tools.

---

## SSE Streaming

The agent endpoint uses Server-Sent Events for real-time streaming:

```typescript
// server/routes/agent.ts
router.post("/stream", async (req, res) => {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");

	// Stream events: text-delta, tool-call, tool-result, etc.
	for await (const event of agentStream) {
		res.write(`data: ${JSON.stringify(event)}\n\n`);
	}
});
```

---

## File Upload Handling

Multer middleware handles multipart form data:

```typescript
// server/middleware/upload.ts
const upload = multer({
	dest: "./uploads/temp",
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
	fileFilter: validateImageType,
});

// 10 files max per request
router.post("/upload", upload.array("files", 10), handleUpload);
```

---

## Environment Configuration

Key environment variables:

| Variable             | Purpose          | Default                  |
| -------------------- | ---------------- | ------------------------ |
| `PORT`               | Server port      | 8787                     |
| `DATABASE_URL`       | SQLite path      | `./data/sqlite.db`       |
| `REDIS_URL`          | Redis connection | `redis://localhost:6379` |
| `OPENROUTER_API_KEY` | LLM access       | Required                 |
| `UPLOADS_DIR`        | Upload storage   | `./uploads`              |

---

## Startup Sequence

1. Initialize services via async factory
2. Initialize worker events subscriber for SSE
3. Apply middleware stack
4. Mount route handlers with services
5. Start HTTP server
6. Log startup confirmation

```typescript
// server/index.ts
async function startServer() {
	// Initialize services via factory
	const services = await createServices({ db });

	// Initialize worker events subscriber for SSE
	const workerEventSubscriber = getSubscriber();
	await workerEventSubscriber.subscribe();

	// Routes (receive services as parameter)
	app.use("/api", createUploadRoutes(services));
	app.use("/api", createImageRoutes(services));
	app.use("/v1/agent", createAgentRoutes(services));
	app.use("/v1/sessions", createSessionRoutes(services));
	app.use("/v1/models", createModelsRoutes());
	app.use("/v1/tools", createToolRoutes(services));

	// Error handling (must be last)
	app.use(errorHandler);

	app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

startServer();
```

---

## Integration Points

| Connects To          | How                          |
| -------------------- | ---------------------------- |
| Layer 2 (Database)   | `services.db`                |
| Layer 3 (Agent)      | `/v1/agent/stream` route     |
| Layer 4 (Services)   | `services.*` passed to routes|
| Layer 5 (Background) | Job dispatch from routes     |
| Layer 6 (Client)     | HTTP/SSE responses           |

---

## Deep Dive Topics

-   Middleware implementation details
-   Rate limiting strategies
-   CORS configuration for multi-origin
-   Error handling patterns
-   Request logging and tracing
