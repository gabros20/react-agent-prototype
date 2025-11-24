# Quick Reference Card

Quick commands, URLs, and key patterns for daily development with the unified ReAct agent and image handling system.

---

## 🚀 Start/Stop

```bash
# Start Redis (required for image processing)
brew services start redis  # macOS
redis-cli ping             # Verify (should return PONG)

# Start everything: API + Preview + Web + Worker (recommended)
pnpm dev

# Or start individually
pnpm dev:server   # API server (8787)
pnpm dev:preview  # Preview server (4000)
pnpm dev:web      # Next.js frontend (3000)
pnpm dev:worker   # Image worker (auto-reload)

# Production worker
pnpm worker

# Stop all
Ctrl+C in terminal
```

---

## 🌐 URLs

| Service          | URL                                        | Purpose                  |
| ---------------- | ------------------------------------------ | ------------------------ |
| **AI Assistant** | http://localhost:3000/assistant            | Unified ReAct agent chat |
| **Preview Site** | http://localhost:4000/                     | Redirects to home        |
| **Preview Page** | http://localhost:4000/pages/home?locale=en | See rendered page        |
| **API Health**   | http://localhost:8787/health               | Check API status         |
| **DB Studio**    | `pnpm db:studio`                           | Browse database          |

---

## 🛠️ Common Commands

```bash
# Database
pnpm db:push      # Update schema
pnpm seed         # Add sample data (CMS)
pnpm seed:images  # Add sample images (3 test images)
pnpm reindex      # Rebuild vector index
pnpm db:studio    # Open Drizzle Studio

# System Reset & Verification
pnpm reset:system    # Clear cache + checkpoint (~2s)
pnpm reset:data      # Truncate + reseed (~15-20s)
pnpm reset:complete  # Nuclear reset (~18-25s)
pnpm verify          # 10 health checks

# Image Processing
pnpm dev:worker   # Start worker (dev with reload)
pnpm worker       # Start worker (production)

# Code Quality
pnpm typecheck    # TypeScript check
pnpm lint         # Biome linter
pnpm format       # Format with Biome

# Development
pnpm preview      # Open homepage in browser
pnpm build        # Production build
```

---

## 📡 API Endpoints

Base URL: `http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main`

```bash
# List pages
curl $BASE/pages

# Get page
curl $BASE/pages/PAGE_ID

# Create page
curl -X POST $BASE/pages \
  -H "Content-Type: application/json" \
  -d '{"name":"About","slug":"about"}'

# Vector search
curl -X POST http://localhost:8787/v1/cms/search/resources \
  -H "Content-Type: application/json" \
  -d '{"query":"homepage","type":"page"}'

# Image upload
curl -X POST http://localhost:8787/api/upload \
  -F "files=@image.jpg" \
  -F "sessionId=test-123"

# Image search
curl "http://localhost:8787/api/images/search?q=sunset&limit=5"

# Image status
curl http://localhost:8787/api/images/{imageId}/status
```

---

## 💬 AI Agent Test Prompts

### Simple (1-2 steps)

```
What pages exist?
Show me the homepage content
List all section definitions
Find pages about contact
What's the link in the Get Started button on About page? (tests granular fetching)
```

### Medium (3-5 steps)

```
Create a "Services" page
Add a hero section to the contact page with title "Get in Touch"
Update the homepage title to "Welcome Home"
```

### Complex (6+ steps)

```
Create an About page with hero and feature sections
Add a hero section to contact page with custom content
Update multiple sections on the services page
```

### Error Handling

```
Create a page with slug "home" (already exists - watch retry)
Add section to non-existent page (watch error recovery)
```

### Image Operations

```
Upload a product image (with file attachment)
Find the sunset photo and add it to the hero section
What images did I upload in this conversation?
Search for images with blue backgrounds
Replace the old logo with the new one across all pages
Delete the outdated screenshot
```

---

## 🤖 Unified ReAct Agent

**Architecture**: Single agent, all tools available always

| Property       | Value                          |
| -------------- | ------------------------------ |
| **Pattern**    | Think → Act → Observe → Repeat |
| **Max Steps**  | 15 per conversation turn       |
| **Tools**      | 27 (CMS + image operations)    |
| **Retries**    | 3 with exponential backoff     |
| **Model**      | openai/gpt-4o-mini             |
| **Checkpoint** | Auto-save every 3 steps        |

---

## 🔧 Troubleshooting

```bash
# System Reset (RECOMMENDED - use these first!)
pnpm reset:data      # Fast reset (~15-20s) - preserves schema
pnpm reset:complete  # Nuclear reset (~18-25s) - recreates everything
pnpm verify          # Check system health after reset

# Manual Database Reset (if scripts fail)
rm data/sqlite.db && pnpm db:push && pnpm seed

# Clear vector index
rm -rf data/lancedb && pnpm reindex

# Check logs
# API server logs: Terminal running dev:server
# Browser console: F12 → Console tab

# Port in use?
lsof -i :8787  # Find process
kill -9 PID    # Kill it

# TypeScript errors?
pnpm typecheck  # Check real errors
# VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"

# Redis not running?
brew services start redis  # macOS
redis-cli ping             # Should return PONG

# Worker not processing images?
pnpm dev:worker            # Start individually if needed
# Or just run: pnpm dev (starts worker automatically)
# Check worker logs for errors
# Verify Redis is running

# Image search returns no results?
curl http://localhost:8787/api/images/{imageId}/status
# Wait for status: "completed" (5-10 seconds)
# Verify embeddings job succeeded in worker logs

# Navigation links broken?
# Fixed in seed.ts - navigation URLs now use /pages/{slug}?locale=en pattern
# Run: pnpm reset:data to apply navigation fix
```

---

## 📊 Execution Log Color Codes

| Color     | Type          | Meaning             |
| --------- | ------------- | ------------------- |
| 🔵 Blue   | tool-call     | Agent calling tool  |
| 🟢 Green  | tool-result   | Tool success        |
| 🟣 Purple | step-complete | Step finished       |
| 🔴 Red    | error         | Tool/agent error    |
| ⚪ Gray   | info          | General information |

---

## 🔑 Environment Variables

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-...

# Optional (with current defaults)
OPENROUTER_MODEL=openai/gpt-4o-mini          # Unified agent model
EMBEDDING_MODEL=openai/text-embedding-3-small # Vector search
DATABASE_URL=file:data/sqlite.db
LANCEDB_DIR=data/lancedb
EXPRESS_PORT=8787
PREVIEW_PORT=4000
NEXT_PORT=3000

# Image Processing
UPLOADS_DIR=./uploads
MAX_FILE_SIZE=5242880     # 5MB
MAX_FILES_PER_UPLOAD=10
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## 📁 Key Files

```
server/
├── agent/orchestrator.ts       # Unified ReAct agent orchestrator
├── tools/
│   ├── all-tools.ts            # All 27 tools (CMS + images)
│   └── image-tools.ts          # 6 image operation tools
├── prompts/react.xml           # Single unified prompt
├── routes/
│   ├── agent.ts                # SSE streaming endpoints
│   ├── upload.ts               # Image upload endpoint
│   └── images.ts               # Image API endpoints
├── services/
│   ├── cms/*.ts                # Business logic (pages, sections, etc.)
│   ├── storage/                # Image storage & processing
│   ├── ai/                     # Embeddings & metadata
│   ├── session-service.ts      # Session management
│   └── approval-queue.ts       # HITL approval coordination
├── queues/image-queue.ts       # BullMQ job queue
├── workers/image-worker.ts     # Async image processing
└── middleware/upload.ts        # Multer upload handler

app/
├── assistant/
│   ├── page.tsx                # Main layout (chat + execution log)
│   ├── _hooks/use-agent.ts     # Streaming integration
│   ├── _components/
│   │   ├── chat-pane.tsx       # Blue bubble chat UI
│   │   └── debug-pane.tsx      # Execution log with colors
│   └── _stores/
│       ├── chat-store.ts       # Messages + sessions
│       └── log-store.ts        # Execution log entries
└── globals.css                 # OKLCH theme (blue bubbles)

data/
├── sqlite.db                   # SQLite database
└── lancedb/                    # Vector index (embeddings)

uploads/
└── images/
    └── YYYY/MM/DD/             # Date-based organization
        ├── original/           # Original uploaded images
        ├── webp/               # WebP variants (3 sizes)
        └── avif/               # AVIF variants (3 sizes)
```

---

## 🐛 Common Issues

| Problem                        | Solution                                                  |
| ------------------------------ | --------------------------------------------------------- |
| "Cannot GET /" on preview      | Expected - root redirects to `/pages/home`                |
| "API key not found"            | Check `.env` file has `OPENROUTER_API_KEY=...`            |
| "Port in use"                  | Kill process: `lsof -i :8787` then `kill -9 PID`          |
| "Database locked"              | Run `pnpm reset:data` (proper cleanup)                    |
| "No results in search"         | Run `pnpm reindex`                                        |
| Agent not responding           | Check API logs, verify API key, try simple prompt         |
| Blue bubbles not showing       | Hard refresh (Cmd+Shift+R), check `app/globals.css`      |
| Execution log empty            | Check browser console (F12), verify SSE connection        |
| TypeScript errors              | Run `pnpm typecheck`, restart TS server (VS Code)         |
| Tool execution fails           | Check execution log for error details, agent auto-retries |
| "Redis connection refused"     | `brew services start redis`, verify with `redis-cli ping` |
| Worker not processing images   | Included in `pnpm dev`, or run `pnpm dev:worker`, check Redis |
| Image upload fails             | Check `UPLOADS_DIR` exists, check file size limits        |
| Image search no results        | Wait for processing, check status endpoint shows "completed" |
| Navigation links 404           | Fixed - run `pnpm reset:data` to apply navigation URL fix |
| Images broken after reset      | Automatic - reset scripts now update URLs and use fixed IDs |

### Architecture Pattern: Native AI SDK v6

**Current Implementation** (Post-Refactor):
```typescript
// Tools created ONCE with execute function
export const cmsGetPage = tool({
  description: 'Get page by slug or ID',
  inputSchema: z.object({ slug: z.string().optional() }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    return await ctx.services.pageService.getPageBySlug(input.slug)
  }
})

// All tools exported in ALL_TOOLS object
export const ALL_TOOLS = {
  cmsGetPage,
  cmsCreatePage,
  // ... 11 more tools
}

// Agent uses tools AS-IS (no wrappers!)
const agent = new ToolLoopAgent({
  model: openrouter.languageModel('openai/gpt-4o-mini'),
  instructions: systemPrompt,
  tools: ALL_TOOLS,  // Passed directly
  stopWhen: stepCountIs(15)
})
```

**Key Files**:
- `server/tools/all-tools.ts` - All 27 tools (CMS + images)
- `server/tools/image-tools.ts` - 6 image operation tools
- `server/agent/orchestrator.ts` - Unified agent
- `server/prompts/react.xml` - Single prompt

---

## 📚 Documentation

**Getting Started**:
- [GETTING_STARTED.md](GETTING_STARTED.md) - Complete setup guide with test cases
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - This file (commands & patterns)
- [README.md](README.md) - Architecture overview and features

**Image Handling**:
- [docs/IMAGE_HANDLING_README.md](docs/IMAGE_HANDLING_README.md) - Image system API reference
- [docs/IMAGE_SETUP_CHECKLIST.md](docs/IMAGE_SETUP_CHECKLIST.md) - Complete setup steps
- [docs/IMAGE_SYSTEM_COMPLETE.md](docs/IMAGE_SYSTEM_COMPLETE.md) - Implementation summary

**Implementation History**:
- [docs/PROGRESS.md](docs/PROGRESS.md) - Sprint-by-sprint progress
- [docs/IMPLEMENTATION_SPRINTS.md](docs/IMPLEMENTATION_SPRINTS.md) - Detailed sprint breakdown
- [docs/PLAN.md](docs/PLAN.md) - Original technical specification

**Key Refactors**:
- [docs/NATIVE_AI_SDK_REFACTOR_PLAN.md](docs/NATIVE_AI_SDK_REFACTOR_PLAN.md) - Sprint 12: Native AI SDK v6
- [docs/UNIFIED_REACT_AGENT_REFACTOR.md](docs/UNIFIED_REACT_AGENT_REFACTOR.md) - Sprint 13: Unified agent
- [docs/UI_OVERHAUL_SUMMARY.md](docs/UI_OVERHAUL_SUMMARY.md) - Sprint 14: Modern UI

---

## 🎓 Learning Path

1. **Day 1**: Follow [GETTING_STARTED.md](GETTING_STARTED.md) - Setup and basic testing
2. **Day 2**: Try all test prompts - Simple to complex tasks
3. **Day 3**: Read [README.md](README.md) - Understand architecture
4. **Day 4**: Explore code:
   - `server/agent/orchestrator.ts` - Agent logic
   - `server/tools/all-tools.ts` - All 27 tools
   - `server/prompts/react.xml` - Unified prompt
5. **Day 5**: Test image handling - Upload, search, agent tools
6. **Day 6**: Create your first tool - Add to `all-tools.ts`
7. **Day 7**: Customize the prompt - Edit `react.xml`
8. **Day 8**: Build a custom feature - Sessions, UI, etc.

---

## 🚦 Health Check Checklist

Before reporting issues, verify:

- [ ] All 3 servers running (`pnpm dev`)
- [ ] API health check passes (http://localhost:8787/health)
- [ ] Preview renders pages (http://localhost:4000/pages/home?locale=en)
- [ ] Assistant UI loads (http://localhost:3000/assistant)
- [ ] `.env` file exists with valid `OPENROUTER_API_KEY`
- [ ] Database has data (`pnpm db:studio` → check pages table)
- [ ] Vector index populated (`ls data/lancedb/` shows files)
- [ ] TypeScript compiles (`pnpm typecheck` shows 0 errors)
- [ ] Browser console clean (F12 → Console → no red errors)
- [ ] Execution log shows events (blue/green/purple entries)
- [ ] Redis is running (`redis-cli ping` returns PONG)
- [ ] Worker is running if using images (included in `pnpm dev`)
- [ ] Image uploads work (test with `scripts/test-image-upload.sh`)

---

## 🔧 Quick Fixes

```bash
# RECOMMENDED: Use reset scripts (faster & safer)
pnpm reset:data      # Fast reset with auto-reseeding (~15-20s)
pnpm reset:complete  # Nuclear reset + verification (~18-25s)
pnpm verify          # Check system health (10 checks)

# Manual full reset (only if scripts fail)
rm -rf node_modules data/sqlite.db data/lancedb uploads/
pnpm install
pnpm db:push
pnpm seed
pnpm seed:images
pnpm reindex
pnpm dev

# Restart servers
Ctrl+C (stop all)
pnpm dev (restart)

# Clear frontend cache
# Browser: Cmd/Ctrl + Shift + R (hard refresh)

# Check what's running
lsof -i :3000  # Next.js
lsof -i :4000  # Preview
lsof -i :8787  # API server
lsof -i :6379  # Redis

# Test image upload system
./scripts/test-image-upload.sh  # Automated test script
```

---

## 📝 Code Snippets

**Add a new tool**:
```typescript
// In server/tools/all-tools.ts
export const myNewTool = tool({
  description: 'What this tool does',
  inputSchema: z.object({
    param: z.string().describe('Parameter description')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    // Your logic here
    return { success: true, result: '...' }
  }
})

// Add to ALL_TOOLS export
export const ALL_TOOLS = {
  // ... existing tools
  myNewTool,
}
```

**Test the agent**:
```bash
curl -X POST http://localhost:8787/v1/agent/stream \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session",
    "prompt": "What pages exist?",
    "stream": true
  }'
```

---

**Pro Tip**: Keep this file open while developing for quick reference!
