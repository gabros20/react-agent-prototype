# Layer 7.6: Preview Server

> Express preview server, static assets, request logging, health endpoint

## Overview

The Preview Server is a standalone Express application that serves rendered pages and posts for development preview. It initializes services, mounts routes for pages and posts, serves static assets (CSS, images, uploads), and provides a health endpoint exposing the template registry.

**Key Responsibilities:**
- Start Express server on port 4000
- Initialize services and renderer
- Mount page and post routes
- Serve static assets
- Log requests with timing
- Provide health check endpoint

---

## The Problem

Without a preview server:

```typescript
// WRONG: No way to see rendered pages
// API only returns JSON, not HTML

// WRONG: No static asset serving
<link href="/assets/styles.css">  // 404 Not Found

// WRONG: No upload serving
<img src="/uploads/image.jpg">  // 404 Not Found

// WRONG: No request logging
// Can't debug slow requests or errors

// WRONG: No health check
// Can't verify server is running correctly
```

**Our Solution:**
1. Dedicated preview server on port 4000
2. RendererService for HTML generation
3. Static middleware for /assets and /uploads
4. Request logging with timing
5. Health endpoint with template registry

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PREVIEW SERVER                               │
│                                                                 │
│  pnpm preview → server/preview.ts                               │
│       │                                                         │
│       ▼                                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Initialization                            │  │
│  │                                                           │  │
│  │  1. ServiceContainer.initialize(db)                       │  │
│  │  2. new RendererService(TEMPLATE_DIR)                     │  │
│  │  3. Configure middleware                                  │  │
│  │  4. Mount routes                                          │  │
│  │  5. Start listening on PORT                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        │                                        │
│                        ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Route Handlers                          │  │
│  │                                                           │  │
│  │  GET /                    → Redirect to /pages/home       │  │
│  │  GET /pages/:slug         → Render page HTML              │  │
│  │  GET /pages/:slug/raw     → Return page JSON              │  │
│  │  GET /posts/:collection   → Render post list              │  │
│  │  GET /posts/:coll/:slug   → Render single post            │  │
│  │  GET /health              → Server status + registry      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        │                                        │
│                        ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Static Serving                          │  │
│  │                                                           │  │
│  │  /assets/*  → server/templates/assets/                    │  │
│  │  /uploads/* → uploads/ (env: UPLOADS_DIR)                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        │                                        │
│                        ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Error Handling                          │  │
│  │                                                           │  │
│  │  app.use((err, req, res, next) => {                       │  │
│  │    res.status(500).send(`                                 │  │
│  │      <h1>Preview Error</h1>                               │  │
│  │      <p>${err.message}</p>                                │  │
│  │      <pre>${err.stack}</pre>                              │  │
│  │    `);                                                    │  │
│  │  });                                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/preview.ts` | Preview server entry point |
| `server/services/renderer.ts` | RendererService |
| `server/routes/posts.ts` | Post routes factory |
| `server/templates/assets/` | Static CSS, images |

---

## Core Implementation

### Server Initialization

```typescript
// server/preview.ts
import "dotenv/config";
import path from "node:path";
import express from "express";
import { db } from "./db/client";
import { RendererService } from "./services/renderer";
import { ServiceContainer } from "./services/service-container";
import { createPostsRouter } from "./routes/posts";

const app = express();
const PORT = process.env.PREVIEW_PORT || 4000;
const TEMPLATE_DIR = process.env.TEMPLATE_DIR || path.join(__dirname, "templates");

async function startPreviewServer() {
  try {
    // Initialize services
    const services = await ServiceContainer.initialize(db);
    console.log("✓ Services initialized for preview");

    // Initialize renderer
    const renderer = new RendererService(TEMPLATE_DIR);
    console.log("✓ Renderer initialized");

    // ... configure routes and middleware

    app.listen(PORT, () => {
      console.log(`✅ [Preview] Preview server running on http://localhost:${PORT}`);
      console.log(`   Pages: http://localhost:${PORT}/pages/home?locale=en`);
      console.log(`   Raw: http://localhost:${PORT}/pages/home/raw?locale=en`);
      console.log(`   Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start preview server:", error);
    process.exit(1);
  }
}

startPreviewServer();
```

### Request Logging Middleware

```typescript
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Skip logging for static files
  if (path === '/health' || path.startsWith('/assets') || path.startsWith('/uploads')) {
    return next();
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusEmoji = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';
    console.log(`${statusEmoji} [Preview] ${req.method} ${path} → ${status} (${duration}ms)`);
  });

  next();
});
```

### Page Routes

```typescript
// Render page as HTML
app.get("/pages/:slug", async (req, res, next) => {
  try {
    const { slug } = req.params;
    const locale = (req.query.locale as string) || "en";

    const html = await renderer.renderPage(slug, locale, services.pageService);

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    next(error);
  }
});

// Return page data as JSON (for debugging)
app.get("/pages/:slug/raw", async (req, res, next) => {
  try {
    const { slug } = req.params;
    const locale = (req.query.locale as string) || "en";

    const page = await services.pageService.getPageBySlug(slug, true, locale);

    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }

    res.json({ data: page, locale, statusCode: 200 });
  } catch (error) {
    next(error);
  }
});

// Redirect root to home page
app.get("/", (_req, res) => {
  res.redirect("/pages/home?locale=en");
});
```

### Post Routes

```typescript
// Mount post routes
app.use("/posts", createPostsRouter(renderer, services.entryService));
```

### Static Assets

```typescript
// Serve template assets (CSS, images, fonts)
app.use("/assets", express.static(path.join(TEMPLATE_DIR, "assets")));

// Serve uploaded images
const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir));
```

### Health Endpoint

```typescript
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "preview-server",
    templateRegistry: renderer.getTemplateRegistry(),
  });
});

// Example response:
// {
//   "status": "ok",
//   "timestamp": "2025-11-27T10:30:00.000Z",
//   "service": "preview-server",
//   "templateRegistry": {
//     "hero": { "variants": ["default", "centered"], "path": "sections/hero" },
//     "feature": { "variants": ["default"], "path": "sections/feature" },
//     ...
//   }
// }
```

### Error Handling

```typescript
app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Preview server error:", err);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Preview Error</h1>
          <p>${err.message}</p>
          <pre>${err.stack}</pre>
        </body>
      </html>
    `);
  }
);
```

---

## Design Decisions

### Why Separate Preview Server?

```typescript
// Main API server: port 8787
// Preview server: port 4000
```

**Reasons:**
1. **Separation of concerns** - API serves JSON, preview serves HTML
2. **Independent scaling** - Can run multiple preview instances
3. **Different middleware** - No auth, no rate limiting for preview
4. **Development focus** - Optimized for template iteration

### Why Skip Logging for Static Files?

```typescript
if (path.startsWith('/assets') || path.startsWith('/uploads')) {
  return next();
}
```

**Reasons:**
1. **Reduce noise** - Many static requests per page
2. **Performance** - Skip timing calculation
3. **Focus on pages** - Log meaningful requests only
4. **Clean output** - Easier to read logs

### Why Serve Raw JSON?

```typescript
app.get("/pages/:slug/raw", async (req, res) => {
  const page = await pageService.getPageBySlug(slug, true, locale);
  res.json({ data: page });
});
```

**Reasons:**
1. **Debugging** - See what data renderer receives
2. **Development** - Test data without rendering
3. **API consistency** - Same format as main API
4. **Template development** - Know available variables

### Why Health Endpoint with Registry?

```typescript
res.json({
  status: "ok",
  templateRegistry: renderer.getTemplateRegistry(),
});
```

**Reasons:**
1. **Server status** - Verify server is running
2. **Template discovery** - See available templates
3. **Debugging** - Check if templates registered
4. **Monitoring** - Can ping from external tools

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1.2 (Service Container) | ServiceContainer.initialize() |
| Layer 7.1 (Nunjucks Engine) | RendererService |
| Layer 7.3 (Page Rendering) | renderPage() |
| Layer 7.5 (Post Rendering) | createPostsRouter() |

### URL Reference

| URL | Description |
|-----|-------------|
| `http://localhost:4000/` | Redirect to home |
| `http://localhost:4000/pages/home?locale=en` | Home page HTML |
| `http://localhost:4000/pages/about?locale=es` | About page (Spanish) |
| `http://localhost:4000/pages/home/raw` | Home page JSON |
| `http://localhost:4000/posts/blog` | Blog post list |
| `http://localhost:4000/posts/blog/my-post` | Single blog post |
| `http://localhost:4000/health` | Health check |
| `http://localhost:4000/assets/styles.css` | Static CSS |
| `http://localhost:4000/uploads/images/2025/01/img.jpg` | Uploaded image |

### Environment Variables

```bash
PREVIEW_PORT=4000           # Server port
TEMPLATE_DIR=server/templates  # Template directory
UPLOADS_DIR=uploads         # Uploaded files directory
DATABASE_URL=file:data/sqlite.db  # Database path
```

---

## Common Issues / Debugging

### Server Won't Start

```
❌ Failed to start preview server: Error
```

**Cause:** Database not initialized or services failed.

**Debug:**

```bash
# Check database exists
ls -la data/sqlite.db

# Run migrations
pnpm db:push
```

### 404 for Pages

```
Page not found: about-us
```

**Cause:** Page doesn't exist or wrong slug.

**Debug:**

```bash
# List all pages
curl http://localhost:4000/health | jq

# Check raw data
curl http://localhost:4000/pages/home/raw
```

### Static Files Not Loading

```
GET /assets/styles.css → 404
```

**Cause:** Wrong TEMPLATE_DIR or file doesn't exist.

**Debug:**

```bash
ls -la server/templates/assets/
echo $TEMPLATE_DIR
```

### Uploads Not Serving

```
GET /uploads/images/img.jpg → 404
```

**Cause:** Wrong UPLOADS_DIR or file doesn't exist.

**Debug:**

```bash
ls -la uploads/
echo $UPLOADS_DIR
```

### Slow Requests

```
✅ [Preview] GET /pages/home → 200 (2500ms)
```

**Cause:** Database queries or template compilation slow.

**Debug:**

```typescript
// Add timing in renderPage
console.time('fetch-page');
const page = await pageService.getPageBySlug(slug, true, locale);
console.timeEnd('fetch-page');

console.time('render-sections');
// ... render sections
console.timeEnd('render-sections');
```

---

## Further Reading

- [Layer 7.3: Page Rendering](./LAYER_7.3_PAGE_RENDERING.md) - renderPage() details
- [Layer 7.5: Post Rendering](./LAYER_7.5_POST_RENDERING.md) - Post routes
- [Layer 1.2: Service Container](./LAYER_1.2_SERVICE_CONTAINER.md) - Service initialization
- [Express Static Files](https://expressjs.com/en/starter/static-files.html)
