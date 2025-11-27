# Layer 1.3: Middleware Stack

> Request processing pipeline with CORS, body parsing, logging, and static file serving

## Overview

Express middleware functions execute in order for every request. The stack is carefully ordered: CORS must be first (to handle preflight), body parsers next (to populate `req.body`), logging for visibility, static files for assets, routes for business logic, and error handler last (to catch all errors).

**Key Middleware:**
- CORS - Cross-origin request handling
- Body parsers - JSON and URL-encoded data
- Request logger - Timing and status logging
- Static files - Serve `/uploads/*`

---

## The Problem

Without proper middleware ordering, requests fail silently:

```typescript
// WRONG ORDER: Routes before body parser
app.use("/api", routes);        // req.body is undefined!
app.use(express.json());

// WRONG ORDER: Error handler in middle
app.use(errorHandler);          // Catches nothing after this
app.use("/api", routes);        // Errors not caught

// WRONG: CORS after routes
app.use("/api", routes);        // Preflight fails
app.use(cors());                // Too late for OPTIONS requests
```

**Our Solution:** Explicit middleware ordering with clear responsibilities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST FLOW                                  │
│                                                                  │
│  Incoming Request                                                │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  1. CORS Middleware                                      │    │
│  │     - Handle OPTIONS preflight                           │    │
│  │     - Set Access-Control-* headers                       │    │
│  └─────────────────────┬───────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  2. Body Parsers                                         │    │
│  │     - express.json() → req.body for JSON                 │    │
│  │     - express.urlencoded() → req.body for forms          │    │
│  └─────────────────────┬───────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  3. Request Logger                                       │    │
│  │     - Log method, path, status, duration                 │    │
│  │     - Skip health checks and static files               │    │
│  └─────────────────────┬───────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  4. Static Files                                         │    │
│  │     - express.static() for /uploads/*                    │    │
│  └─────────────────────┬───────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  5. Route Handlers                                       │    │
│  │     - /api/* (upload, images)                            │    │
│  │     - /v1/* (CMS, agent, sessions)                       │    │
│  └─────────────────────┬───────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  6. Error Handler (MUST BE LAST)                         │    │
│  │     - Catch all errors from routes                       │    │
│  │     - Format consistent error responses                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  Response                                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/middleware/cors.ts` | CORS configuration |
| `server/middleware/error-handler.ts` | Error normalization |
| `server/middleware/upload.ts` | Multer for file uploads |
| `server/index.ts` | Middleware ordering |

---

## Core Implementation

### CORS Middleware

```typescript
// server/middleware/cors.ts
import cors from "cors";

export const corsOptions = {
  // Allow requests from Next.js frontend
  origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

  // Include credentials (cookies, auth headers)
  credentials: true,

  // Allowed HTTP methods
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

  // Allowed request headers
  allowedHeaders: ["Content-Type", "Authorization"],
};

export const corsMiddleware = cors(corsOptions);
```

**How CORS Works:**

1. Browser sends OPTIONS preflight for non-simple requests
2. Server responds with allowed origins/methods/headers
3. If allowed, browser sends actual request
4. Response includes Access-Control headers

### Body Parsers

```typescript
// server/index.ts
// Parse JSON bodies (application/json)
app.use(express.json());

// Parse URL-encoded bodies (form submissions)
app.use(express.urlencoded({ extended: true }));
```

**Options:**
- `express.json({ limit: '10mb' })` - Increase body size limit
- `extended: true` - Use qs library for rich objects

### Request Logger

```typescript
// server/index.ts
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Skip logging for noise
  if (path === '/health' || path.startsWith('/uploads')) {
    return next();
  }

  // Log after response completes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;

    // Emoji indicates status category
    const statusEmoji = status >= 500 ? '❌' :
                        status >= 400 ? '⚠️' : '✅';

    console.log(
      `${statusEmoji} [API] ${method} ${path} → ${status} (${duration}ms)`
    );
  });

  next();
});
```

**Output Examples:**

```
✅ [API] GET /v1/sessions → 200 (12ms)
✅ [API] POST /v1/agent/stream → 200 (1523ms)
⚠️ [API] GET /v1/teams/x/pages/missing → 404 (8ms)
❌ [API] POST /api/upload → 500 (45ms)
```

### Static File Serving

```typescript
// server/index.ts
const uploadsDir = process.env.UPLOADS_DIR ||
                   path.join(process.cwd(), "uploads");

app.use("/uploads", express.static(uploadsDir));
```

**Directory Structure:**

```
uploads/
├── images/
│   └── 2025/
│       └── 11/
│           └── 23/
│               ├── original/
│               │   └── uuid.jpg
│               └── variants/
│                   ├── uuid-640w.webp
│                   └── uuid-1024w.webp
└── temp/
```

### Middleware Order in index.ts

```typescript
// server/index.ts
const app = express();

// 1. CORS - Must be first for preflight
app.use(corsMiddleware);

// 2. Body parsers - Before routes that read req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Request logger - After body parsing, before routes
app.use(requestLogger);

// 4. Static files - Before route handlers
app.use("/uploads", express.static(uploadsDir));

// 5. Routes - Main application logic
app.use("/api", uploadRoutes);
app.use("/v1/agent", agentRoutes);
// ... more routes

// 6. Error handler - MUST BE LAST
app.use(errorHandler);
```

---

## Design Decisions

### Why CORS First?

```typescript
// Browser sends OPTIONS preflight BEFORE actual request
OPTIONS /v1/agent/stream HTTP/1.1
Origin: http://localhost:3000
Access-Control-Request-Method: POST
```

If CORS middleware isn't first, the preflight fails and the actual request never happens.

### Why Separate Logger Middleware?

```typescript
// Option A: Log in every route (DRY violation)
router.get("/pages", (req, res) => {
  console.log(`GET /pages`);
  // ... handler
  console.log(`Response: 200`);
});

// Option B: Centralized middleware (chosen)
app.use(requestLogger);
```

**Reasons:**
1. **DRY** - One place for logging logic
2. **Consistency** - All routes logged same way
3. **Timing** - Captures request duration accurately
4. **Filtering** - Easy to skip certain paths

### Why Skip Logging for Some Paths?

```typescript
if (path === '/health' || path.startsWith('/uploads')) {
  return next();
}
```

**Reasons:**
1. **Noise reduction** - Health checks every few seconds
2. **Performance** - Static files don't need logging
3. **Focus** - See actual API activity clearly

### Why Use `res.on('finish')`?

```typescript
res.on('finish', () => {
  console.log(`${method} ${path} → ${status}`);
});
```

**Reasons:**
1. **Status available** - `res.statusCode` set by handler
2. **Duration accurate** - Measures full request time
3. **After streaming** - Works for SSE responses too

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1.1 (Bootstrap) | Applied during startup |
| Layer 1.4 (Error Handler) | Error handler is last middleware |
| Layer 1.5 (Routes) | Routes receive parsed body |
| Layer 1.6 (File Upload) | Multer is route-specific middleware |
| Layer 6 (Client) | CORS allows frontend requests |

### SSE Streaming Considerations

For Server-Sent Events (agent streaming), special headers are needed:

```typescript
// server/routes/agent.ts
router.post('/stream', async (req, res) => {
  // Override default headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Stream events...
});
```

These headers prevent buffering by proxies and keep connection alive.

---

## Common Issues / Debugging

### CORS Errors

```
Access to fetch at 'http://localhost:8787' from origin
'http://localhost:3000' has been blocked by CORS policy
```

**Causes:**
1. CORS middleware not applied
2. Origin doesn't match allowed list
3. Missing credentials configuration

**Debug:**

```typescript
// Add logging to CORS
app.use((req, res, next) => {
  console.log('Request origin:', req.headers.origin);
  next();
});
app.use(corsMiddleware);

// Check response headers
curl -I -X OPTIONS http://localhost:8787/v1/agent/stream \
  -H "Origin: http://localhost:3000"
```

### req.body is undefined

```typescript
router.post("/pages", (req, res) => {
  console.log(req.body); // undefined!
});
```

**Causes:**
1. Body parser not applied
2. Body parser after routes
3. Wrong Content-Type header

**Fix:**

```typescript
// Ensure order is correct
app.use(express.json());        // Before routes!
app.use("/v1", createRoutes());

// Check Content-Type
curl -X POST http://localhost:8787/v1/pages \
  -H "Content-Type: application/json" \
  -d '{"name": "test"}'
```

### Request Logger Not Showing

```
// No logs appearing
```

**Causes:**
1. Logger after routes (never reached)
2. Path being skipped
3. Request failing before logger

**Fix:**

```typescript
// Add early logger to debug
app.use((req, res, next) => {
  console.log('EARLY:', req.method, req.path);
  next();
});
```

### Static Files 404

```
GET /uploads/images/2025/11/23/original/uuid.jpg 404
```

**Causes:**
1. Wrong uploads directory path
2. Static middleware after route that handles same path
3. File doesn't exist

**Debug:**

```bash
# Check file exists
ls -la uploads/images/2025/11/23/original/

# Check middleware order
# Static should be before routes
```

### Large Request Body Rejected

```
PayloadTooLargeError: request entity too large
```

**Cause:** Default body limit (100KB) exceeded.

**Fix:**

```typescript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

---

## Middleware Patterns

### Route-Specific Middleware

```typescript
// Only for specific routes
router.post("/upload",
  upload.array("files", 10),  // Multer only here
  validateFiles,               // Validation only here
  handleUpload
);
```

### Conditional Middleware

```typescript
// Skip middleware based on condition
app.use((req, res, next) => {
  if (req.path.startsWith('/public')) {
    return next(); // Skip for public routes
  }
  authMiddleware(req, res, next);
});
```

### Async Middleware

```typescript
// Wrap async functions to catch errors
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.use(asyncHandler(async (req, res, next) => {
  req.user = await getUser(req.headers.authorization);
  next();
}));
```

---

## Further Reading

- [Layer 1.1: Express Bootstrap](./LAYER_1.1_EXPRESS_BOOTSTRAP.md) - Middleware ordering
- [Layer 1.4: Error Handling](./LAYER_1.4_ERROR_HANDLING.md) - Error middleware details
- [Layer 1.6: File Upload](./LAYER_1.6_FILE_UPLOAD.md) - Multer middleware
- [Express Middleware Guide](https://expressjs.com/en/guide/using-middleware.html)
- [CORS Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
