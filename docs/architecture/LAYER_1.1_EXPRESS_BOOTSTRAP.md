# Layer 1.1: Express Bootstrap

> Application initialization, startup sequence, and environment configuration

## Overview

The Express bootstrap handles server initialization in a specific order: load environment variables, initialize the service container (which connects to databases), configure middleware, mount routes, and finally start listening on the configured port.

**Entry Point:** `server/index.ts`
**Default Port:** 8787

**Key Responsibilities:**
- Load environment configuration
- Initialize services asynchronously before accepting requests
- Configure middleware stack in correct order
- Mount route handlers
- Start HTTP server with startup confirmation

---

## The Problem

Naive server initialization causes issues:

```typescript
// WRONG: Synchronous initialization
const app = express();
const db = connectToDatabase(); // What if this fails?
app.use("/api", routes);        // Routes might use uninitialized services
app.listen(3000);               // Server starts before DB is ready

// Result: Requests fail because services aren't initialized
```

**Our Solution:**
1. Async startup function wraps all initialization
2. Services fully initialized before routes are mounted
3. Server only starts listening after everything is ready
4. Clear error handling if startup fails

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     STARTUP SEQUENCE                             │
│                                                                  │
│  1. Load Environment (.env)                                      │
│       │                                                          │
│       ▼                                                          │
│  2. Create Express App                                           │
│       │                                                          │
│       ▼                                                          │
│  3. Apply Global Middleware (CORS, JSON, Logging)               │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  4. startServer() - Async Function                       │    │
│  │       │                                                  │    │
│  │       ▼                                                  │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  ServiceContainer.initialize(db)                │    │    │
│  │  │  - Connect to SQLite                            │    │    │
│  │  │  - Initialize VectorIndex (LanceDB)             │    │    │
│  │  │  - Create service instances                     │    │    │
│  │  └─────────────────────┬───────────────────────────┘    │    │
│  │                        │                                │    │
│  │                        ▼                                │    │
│  │  5. Mount Route Handlers                                │    │
│  │       ├─ /api/upload, /api/images                      │    │
│  │       ├─ /v1/teams/:team/sites/:site/...               │    │
│  │       ├─ /v1/agent                                      │    │
│  │       ├─ /v1/sessions                                   │    │
│  │       └─ /uploads (static)                              │    │
│  │                        │                                │    │
│  │                        ▼                                │    │
│  │  6. Mount Error Handler (last)                          │    │
│  │                        │                                │    │
│  │                        ▼                                │    │
│  │  7. app.listen(PORT)                                    │    │
│  │       │                                                  │    │
│  │       ▼                                                  │    │
│  │  ✅ Server Ready                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/index.ts` | Main entry point, startup orchestration |
| `server/preview.ts` | Separate preview server (port 4000) |
| `.env` | Environment variables |
| `package.json` | Start scripts |

---

## Core Implementation

### Main Entry Point

```typescript
// server/index.ts
import "dotenv/config";  // Load .env first!
import express from "express";
import path from "node:path";
import { db } from "./db/client";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/error-handler";
import { createCMSRoutes } from "./routes/cms";
import { createAgentRoutes } from "./routes/agent";
import { createSessionRoutes } from "./routes/sessions";
import uploadRoutes from "./routes/upload";
import imageRoutes from "./routes/images";
import { ServiceContainer } from "./services/service-container";

const app = express();
const PORT = process.env.EXPRESS_PORT || 8787;

// Global middleware (applied before async startup)
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Skip logging for health checks and static assets
  if (path === '/health' || path.startsWith('/uploads')) {
    return next();
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusEmoji = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';
    console.log(`${statusEmoji} [API] ${req.method} ${path} → ${status} (${duration}ms)`);
  });

  next();
});

// Async startup
async function startServer() {
  try {
    // Initialize services (includes vector index)
    const services = await ServiceContainer.initialize(db);
    console.log("✓ Services initialized");

    // Mount routes (services now available)
    app.use("/api", uploadRoutes);
    app.use("/api", imageRoutes);
    app.use("/v1/teams/:team/sites/:site/environments/:env", createCMSRoutes(services));
    app.use("/v1/agent", createAgentRoutes(services));
    app.use("/v1/sessions", createSessionRoutes(services));

    // Static file serving for uploads
    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    app.use("/uploads", express.static(uploadsDir));

    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          vectorIndex: "ready",
        },
      });
    });

    // Error handler (must be last)
    app.use(errorHandler);

    // Start listening
    app.listen(PORT, () => {
      console.log(`✅ [API] Express API server running on http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   Agent: http://localhost:${PORT}/v1/agent/stream`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
```

### Environment Variables

```bash
# .env
# Server
EXPRESS_PORT=8787
NODE_ENV=development

# Database
DATABASE_URL=file:data/sqlite.db
LANCEDB_DIR=data/lancedb

# External Services
OPENROUTER_API_KEY=sk-or-v1-xxx
REDIS_URL=redis://localhost:6379

# File Storage
UPLOADS_DIR=./uploads
MAX_FILE_SIZE=5242880
MAX_FILES_PER_UPLOAD=10

# Frontend (for CORS)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Defaults for CMS context
DEFAULT_SITE=local-site
DEFAULT_ENV=main
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "pnpm start",
    "start": "concurrently \"pnpm:dev:*\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:preview": "tsx watch server/preview.ts",
    "dev:web": "next dev --turbo",
    "dev:worker": "tsx watch server/workers/image-worker.ts"
  }
}
```

---

## Design Decisions

### Why Async Startup Function?

```typescript
// Option A: Top-level await (requires ESM)
const services = await ServiceContainer.initialize(db);
app.listen(PORT);

// Option B: Async IIFE wrapper (chosen)
async function startServer() {
  const services = await ServiceContainer.initialize(db);
  app.listen(PORT);
}
startServer();
```

**Reasons:**
1. **Compatibility** - Works with CommonJS and ESM
2. **Error handling** - try/catch wraps entire startup
3. **Explicit** - Clear what happens in sequence
4. **Exit on failure** - `process.exit(1)` if startup fails

### Why Mount Routes After Service Init?

```typescript
// Services initialized first
const services = await ServiceContainer.initialize(db);

// THEN mount routes
app.use("/v1/agent", createAgentRoutes(services));
```

**Reasons:**
1. **Dependency injection** - Routes receive initialized services
2. **No race conditions** - Services ready before first request
3. **Fail fast** - If DB connection fails, server doesn't start

### Why Separate Global vs Route-Specific Middleware?

```typescript
// Global (before startServer)
app.use(corsMiddleware);
app.use(express.json());

// Route-specific (inside startServer)
app.use("/api", uploadRoutes);  // Multer for /api/upload only
```

**Reasons:**
1. **Performance** - Multer only runs on upload routes
2. **Clarity** - Global middleware applies everywhere
3. **Order control** - CORS before JSON, error handler last

### Why Health Check Endpoint?

```typescript
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: { database: "connected", vectorIndex: "ready" },
  });
});
```

**Reasons:**
1. **Load balancer probes** - K8s, Docker Swarm, etc.
2. **Monitoring** - Uptime checks
3. **Debugging** - Quick verification server is running
4. **No auth** - Health checks shouldn't require credentials

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1.2 (Service Container) | `ServiceContainer.initialize(db)` |
| Layer 1.3 (Middleware) | Applied before routes |
| Layer 1.5 (Routes) | Mounted after services ready |
| Layer 2.7 (DB Connection) | `db` imported from client |
| Layer 6 (Client) | CORS configured for Next.js origin |

### Process Management

```bash
# Development: Multiple processes via concurrently
pnpm start
# Runs: dev:server, dev:preview, dev:web, dev:worker

# Production: Single process or PM2
node server/index.js
# Or
pm2 start ecosystem.config.js
```

---

## Common Issues / Debugging

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::8787
```

**Cause:** Another process using port 8787.

**Fix:**

```bash
# Find and kill process
lsof -i :8787
kill -9 <PID>

# Or use different port
EXPRESS_PORT=8788 pnpm dev:server
```

### Services Not Initialized

```
Error: ServiceContainer not initialized. Call initialize() first.
```

**Cause:** Code accessing `ServiceContainer.get()` before `initialize()`.

**Fix:** Ensure async startup completes:

```typescript
// WRONG: Accessing before init
const container = ServiceContainer.get(); // Throws!

// RIGHT: Access after init
const services = await ServiceContainer.initialize(db);
// Now ServiceContainer.get() works
```

### Environment Variables Not Loading

```typescript
console.log(process.env.DATABASE_URL); // undefined
```

**Cause:** `dotenv/config` not imported first.

**Fix:** Import at very top of entry point:

```typescript
import "dotenv/config";  // MUST be first import
import express from "express";
```

### Startup Hangs

```
✓ Services initialized
(nothing else...)
```

**Cause:** Something blocking before `app.listen()`.

**Debug:**

```typescript
async function startServer() {
  console.log("1. Starting...");
  const services = await ServiceContainer.initialize(db);
  console.log("2. Services initialized");

  // Add more checkpoints
  app.use("/api", uploadRoutes);
  console.log("3. Routes mounted");

  app.listen(PORT, () => {
    console.log("4. Server listening");
  });
}
```

### CORS Errors from Frontend

```
Access to fetch at 'http://localhost:8787/v1/agent' from origin
'http://localhost:3000' has been blocked by CORS policy
```

**Cause:** CORS middleware misconfigured or not applied.

**Fix:** Check CORS is first middleware and origin matches:

```typescript
// middleware/cors.ts
export const corsOptions = {
  origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  credentials: true,
};

// index.ts - MUST be before routes
app.use(corsMiddleware);  // First!
app.use(express.json());
```

---

## Further Reading

- [Layer 1.2: Service Container](./LAYER_1.2_SERVICE_CONTAINER.md) - DI pattern
- [Layer 1.3: Middleware](./LAYER_1.3_MIDDLEWARE.md) - Middleware stack details
- [Layer 1.4: Error Handling](./LAYER_1.4_ERROR_HANDLING.md) - Error normalization
- [Layer 2.7: Connection](./LAYER_2.7_CONNECTION.md) - Database setup
- [Express.js Documentation](https://expressjs.com/)
