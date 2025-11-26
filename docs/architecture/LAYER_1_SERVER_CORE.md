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
│  │  CORS   │ Logger  │BodyParse│ RateLim │ ErrorHandle │ │
│  └─────────┴─────────┴─────────┴─────────┴─────────────┘ │
├──────────────────────────────────────────────────────────┤
│  Route Handlers                                          │
│  ┌─────────────┬────────────┬───────────┬─────────────┐  │
│  │ /v1/agent   │ /v1/session│ /v1/teams │ /api/images │  │
│  └─────────────┴────────────┴───────────┴─────────────┘  │
├──────────────────────────────────────────────────────────┤
│  Service Container (Singleton DI)                        │
│  ┌─────────┬─────────┬─────────┬─────────┬────────────┐  │
│  │   DB    │ Vector  │  Page   │ Section │  Session   │  │
│  └─────────┴─────────┴─────────┴─────────┴────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                                   | Purpose                         |
| -------------------------------------- | ------------------------------- |
| `server/index.ts`                      | App bootstrap, middleware setup |
| `server/services/service-container.ts` | Singleton DI container          |
| `server/middleware/`                   | CORS, logging, errors, uploads  |
| `server/routes/`                       | API route definitions           |

---

## Service Container

The `ServiceContainer` implements a simple singleton pattern for dependency injection. All services are initialized once and shared across the application.

```typescript
// server/services/service-container.ts
class ServiceContainer {
	private static instance: ServiceContainer;

	readonly db: DrizzleDatabase;
	readonly vectorIndex: VectorIndexService;
	readonly pageService: PageService;
	readonly sectionService: SectionService;
	readonly entryService: EntryService;
	readonly sessionService: SessionService;

	static getInstance(): ServiceContainer {
		if (!this.instance) {
			this.instance = new ServiceContainer();
		}
		return this.instance;
	}
}
```

**Access Pattern:**

```typescript
import { ServiceContainer } from "./services/service-container";
const container = ServiceContainer.getInstance();
const pages = await container.pageService.getPages(siteId, envId);
```

---

## Middleware Stack

Middleware executes in order for every request:

| Order | Middleware     | Purpose                    |
| ----- | -------------- | -------------------------- |
| 1     | CORS           | Cross-origin configuration |
| 2     | Request Logger | Log method, path, duration |
| 3     | Body Parser    | JSON + URL-encoded bodies  |
| 4     | Rate Limiter   | Request throttling         |
| 5     | Static Files   | Serve `/uploads/*`         |
| 6     | Routes         | Handle API endpoints       |
| 7     | Error Handler  | Catch + format errors      |

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
│   └── /stream          POST - SSE agent execution
├── /sessions
│   ├── /                GET/POST - List/create sessions
│   ├── /:id             GET/DELETE - Session details
│   ├── /:id/messages    GET/POST - Message history
│   └── /:id/checkpoint  POST - Save checkpoint
└── /teams/:team/sites/:site/environments/:env
    ├── /pages           GET/POST/PUT/DELETE
    ├── /sections        GET/POST/PUT/DELETE
    └── /entries         GET/POST/PUT/DELETE

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

1. Initialize ServiceContainer (DB, services)
2. Apply middleware stack
3. Mount route handlers
4. Start HTTP server
5. Log startup confirmation

```typescript
// server/index.ts
const app = express();
const container = ServiceContainer.getInstance();

// Middleware
app.use(cors(corsOptions));
app.use(requestLogger);
app.use(express.json());

// Routes
app.use("/v1/agent", agentRoutes);
app.use("/v1/sessions", sessionRoutes);
app.use("/v1/teams", teamsRoutes);

// Error handling (must be last)
app.use(errorHandler);

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
```

---

## Integration Points

| Connects To          | How                      |
| -------------------- | ------------------------ |
| Layer 2 (Database)   | ServiceContainer.db      |
| Layer 3 (Agent)      | `/v1/agent/stream` route |
| Layer 4 (Services)   | ServiceContainer.\*      |
| Layer 5 (Background) | Job dispatch from routes |
| Layer 6 (Client)     | HTTP/SSE responses       |

---

## Deep Dive Topics

-   Middleware implementation details
-   Rate limiting strategies
-   CORS configuration for multi-origin
-   Error handling patterns
-   Request logging and tracing
