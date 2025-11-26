# ReAct AI Agent Prototype - CMS with AI Image Management

AI-powered content management system with unified ReAct agent, semantic image search, and automatic metadata generation using native AI SDK v6 patterns.

## 🚀 New to the Project?

- **[Getting Started Guide](GETTING_STARTED.md)** - Complete setup walkthrough with test cases
- **[Quick Reference Card](QUICK_REFERENCE.md)** - Commands, URLs, patterns, and troubleshooting

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure API Key

Get your OpenRouter API key from [https://openrouter.ai/keys](https://openrouter.ai/keys) and add it to `.env`:

```bash
OPENROUTER_API_KEY=your-actual-api-key-here
```

### 3. Initialize Database

```bash
# Push schema to SQLite
pnpm db:push

# Seed with sample data
pnpm seed

# (Optional) Populate vector index for semantic search
pnpm reindex
```

### 4. Start Services

```bash
# Install Redis (one-time setup)
brew install redis

# Start all services (Redis + dev processes)
pnpm start:all    # Starts Redis, then shows dev command
pnpm start        # Start dev processes (server, preview, web, worker)

# Or use individual commands:
pnpm start:redis  # Start Redis only
pnpm dev          # Alias for 'start'
```

**What runs where:**
- **API Server**: http://localhost:8787
- **Preview Server**: http://localhost:4000
- **Next.js Frontend**: http://localhost:3000
- **Worker**: Background process (no port)

### 6. Seed Sample Images (Optional)

```bash
# Download and process 3 sample images (mountain, puppy, workspace)
pnpm seed:images

# Wait 5-10 seconds for processing to complete
# Check worker logs for: "✅ Job ... completed successfully"
```

### 7. Open the Assistant

```bash
# Visit the AI assistant
http://localhost:3000/assistant

# Preview rendered pages
http://localhost:4000/pages/home?locale=en
```

## Project Structure

```
server/          # Backend Express API
├── db/          # Database schema & client
├── services/    # Business logic layer
│   ├── cms/     # CMS services (pages, sections, entries)
│   ├── storage/ # Image processing & storage services
│   ├── ai/      # AI services (metadata, embeddings)
│   ├── renderer.ts   # Nunjucks template rendering
│   ├── vector-index.ts # LanceDB vector search
│   ├── session-service.ts # Session management
│   └── approval-queue.ts # HITL approval coordination
├── routes/      # API routes
│   ├── agent.ts # SSE streaming endpoints
│   ├── sessions.ts # Session CRUD routes
│   ├── upload.ts # Image upload endpoint
│   └── images.ts # Image serving endpoints
├── middleware/  # Express middleware
│   └── upload.ts # Multer file upload validation
├── queues/      # Job queues
│   └── image-queue.ts # BullMQ image processing queue
├── workers/     # Background workers
│   └── image-worker.ts # Image processing worker
├── agent/       # AI agent orchestrator
│   └── orchestrator.ts # Unified ReAct agent (native AI SDK v6)
├── tools/       # Agent tools (27 tools)
│   ├── all-tools.ts # All tools with experimental_context
│   └── image-tools.ts # 6 image management tools
├── prompts/     # Single unified prompt
│   └── react.xml # ReAct pattern prompt
├── templates/   # Nunjucks templates
│   ├── layout/  # Page layout (HTML shell)
│   ├── sections/ # Section templates (hero, feature, cta)
│   └── assets/  # Static assets (CSS)
├── index.ts     # API server (port 8787)
├── preview.ts   # Preview server (port 4000)
└── utils/       # Helper functions

app/             # Next.js frontend
├── assistant/   # Main assistant UI
│   ├── page.tsx # Layout (chat + execution log)
│   ├── _components/ # Chat pane, debug pane, HITL modal
│   ├── _hooks/  # use-agent (SSE streaming)
│   └── _stores/ # chat-store, log-store, approval-store
├── api/         # Next.js API routes (proxies)
└── globals.css  # OKLCH theme with blue bubbles

data/            # Local data (git-ignored)
├── sqlite.db    # SQLite database
├── lancedb/     # Vector index

uploads/         # Media files (git-ignored)
└── images/      # Uploaded images
    └── YYYY/MM/DD/
        ├── original/  # Full-size originals
        └── variants/  # Responsive sizes (WebP/AVIF)
```

## Available Scripts

### Service Management

**Start Services:**
```bash
pnpm start          # Start dev processes (server, preview, web, worker)
pnpm start:redis    # Start Redis only
pnpm start:all      # Start Redis + show dev instructions
pnpm dev            # Alias for 'start'
```

**Stop Services:**
```bash
pnpm stop           # Stop dev processes only
pnpm stop:redis     # Stop Redis only
pnpm stop:all       # Stop everything (dev + Redis)
```

**Utilities:**
```bash
pnpm restart        # Restart dev processes
pnpm status         # Check what's running
pnpm ps             # Process monitor - shows all services, ports, and duplicates
```

**Individual Services** (if needed):
```bash
pnpm dev:server     # API server only (port 8787)
pnpm dev:preview    # Preview server only (port 4000)
pnpm dev:web        # Next.js only (port 3000)
pnpm dev:worker     # Worker only
```

### Database
- `pnpm db:push` - Push schema changes to SQLite
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm seed` - Seed database with sample data
- `pnpm seed:images` - Download and process 3 sample images
- `pnpm check:images` - Verify image setup
- `pnpm reindex` - Populate vector index with existing data

### System Reset & Verification
- `pnpm reset:system` - Clear Redis cache and checkpoint DB (~2s)
- `pnpm reset:data` - Truncate tables, reseed data (~15-20s)
- `pnpm reset:complete` - Nuclear reset with schema recreation (~18-25s)
- `pnpm verify` - Run 10 health checks (Redis, DB, images, ports)

### Code Quality
- `pnpm typecheck` - Check TypeScript types
- `pnpm lint` - Run Biome linter
- `pnpm format` - Format code with Biome
- `pnpm build` - Build for production
- `pnpm prod` - Start production server

## API Endpoints

Base URL: `http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main`

### Pages
- `GET /pages` - List all pages
- `POST /pages` - Create new page
- `GET /pages/:id` - Get page by ID
- `PUT /pages/:id` - Update page
- `DELETE /pages/:id` - Delete page
- `GET /pages/:id/contents` - Get page with sections

### Sections
- `GET /sections` - List section definitions
- `POST /sections` - Create section definition
- `GET /sections/:id` - Get section by ID
- `PUT /sections/:id` - Update section
- `DELETE /sections/:id` - Delete section

### Collections & Entries
- `GET /collections` - List collections
- `POST /collections` - Create collection
- `GET /collections/:id/entries` - List entries
- `POST /collections/:id/entries` - Create entry

### Search
- `POST /search/resources` - Vector-based fuzzy search
  ```json
  {
    "query": "homepage",
    "type": "page",
    "limit": 3
  }
  ```

### Images
- `POST /api/upload` - Upload images (1-10 files)
- `GET /api/images/:id/status` - Check processing status
- `GET /api/images/:id/details` - Full metadata & variants
- `GET /api/images/:id/thumbnail` - Serve 150x150 WebP thumbnail
- `GET /api/images/search?q=query` - Semantic image search
- `POST /api/images/find` - Find best match by description
- `DELETE /api/images/:id` - Delete image with cascade

## Preview Server

The preview server renders your CMS pages as a real website using Nunjucks templates.

**Base URL**: `http://localhost:4000`

### Routes
- `GET /` - Redirects to `/pages/home?locale=en` (default homepage)
- `GET /pages/:slug?locale=en` - Render page as HTML
- `GET /pages/:slug/raw?locale=en` - Get page data as JSON (debugging)
- `GET /assets/*` - Static assets (CSS, images)
- `GET /health` - Health check with template registry

**Note**: The root path (`/`) returns a 404 without the redirect - this is expected behavior as the preview server is designed to render specific page slugs.

### Navigation URL Format

**IMPORTANT**: Navigation links must use the preview URL format:

```
/pages/{slug}?locale=en
```

**Examples**:
- `/pages/home?locale=en` ✅
- `/pages/about?locale=en` ✅
- `/pages/contact?locale=en` ✅

**Wrong** (causes 404):
- `/` ❌
- `/about` ❌
- `/contact` ❌

The AI agent automatically uses this format when adding pages to navigation after creation.

### Templates

Templates are located in `server/templates/`:

- **Layout**: `layout/page.njk` - HTML shell with `<head>` and `<body>`
- **Sections**: `sections/{templateKey}/{variant}.njk` - Section components
  - `hero/default.njk` - Standard hero section
  - `hero/centered.njk` - Centered hero variant
  - `feature/default.njk` - Feature list section
  - `cta/default.njk` - Call-to-action section
- **Fallback**: `sections/_default.njk` - Used when template not found
- **Assets**: `assets/styles.css` - Production-quality CSS

### Custom Filters

- `{{ text | markdown }}` - Render markdown to HTML
- `{{ text | truncate(100) }}` - Truncate text to N characters
- `{{ path | asset }}` - Resolve asset URL

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, shadcn/ui
- **Backend**: Express, Drizzle ORM, SQLite
- **Templates**: Nunjucks with custom filters (markdown, truncate, asset)
- **AI**: Vercel AI SDK v6 (native patterns), OpenRouter (GPT-4o-mini)
- **Vector Search**: LanceDB with OpenRouter embeddings
- **State**: Zustand with localStorage persistence
- **Image Processing**: Sharp, BullMQ, Redis, CLIP embeddings
- **Storage**: Filesystem with date-based organization (optional CDN)

## Architecture

### Service Infrastructure

**What's running:**
- ✅ **Redis** (brew service) - Job queue for BullMQ worker
- ✅ **SQLite** (file-based) - Main database (no service needed)
- ✅ **LanceDB** (file-based) - Vector search index (no service needed)
- ❌ **Docker** - Not used in this project

**Quick commands:**
```bash
pnpm status      # Check what's running (simple)
pnpm ps          # Process monitor (detailed - shows duplicates!)
pnpm start:all   # Start everything (Redis + dev)
pnpm stop:all    # Stop everything
```

### 3-Server Development Architecture

This project uses a **3-server architecture**:

1. **API Server (port 8787)**: RESTful CRUD operations + AI agent streaming
2. **Preview Server (port 4000)**: Renders pages as HTML using Nunjucks templates
3. **Next.js (port 3000)**: AI assistant UI with blue chat bubbles
4. **Worker** (background): Image processing queue (BullMQ + Redis)

### Unified ReAct Agent

**Native AI SDK v6 pattern** - no custom abstractions:
- **Single agent** with all 21 tools available always
- **Think → Act → Observe → Repeat** autonomous loop
- **Max 15 steps** per conversation turn
- **Auto-retry** with exponential backoff (3 attempts)
- **Auto-checkpoint** every 3 steps for crash recovery
- **Streaming SSE** with execution log events

## Hybrid Content Fetching (Token Optimization)

**Problem**: Fetching entire pages with all content wastes tokens when user asks for one specific field.

**Solution**: Granular fetching with 40-96% token savings:

1. **Lightweight First** (default):
   ```typescript
   cms_getPage({ slug: "about" }) // Returns metadata + section IDs (~100 tokens)
   cms_getSectionContent({ pageSectionId: "s1" }) // Get only needed content (~150 tokens)
   // Total: ~250 tokens vs ~2000 tokens with full fetch
   ```

2. **Full Fetch** (opt-in):
   ```typescript
   cms_getPage({ slug: "about", includeContent: true }) // All content (~2000 tokens)
   ```

**New Tools**:
- `cms_getPageSections` - Get all sections for a page (metadata or full content)
- `cms_getSectionContent` - Get content for one specific section
- `cms_getCollectionEntries` - Get all entries for a collection (metadata or full content)
- `cms_getEntryContent` - Get content for one specific entry

**Agent learns optimal strategy**: ReAct pattern naturally prefers efficient granular fetching for targeted queries.

## Unified ReAct Prompt

The agent uses a **single unified prompt** (`server/prompts/react.xml`) - 82 lines, replaces 800+ lines of modular system.

### Prompt Structure

**Single file with embedded examples**:
- Agent identity and ReAct pattern
- Think → Act → Observe → Repeat instructions
- Complete example session (create page + add sections)
- Tool list (injected dynamically)
- Session context (sessionId, date)

### Key Sections

```xml
<agent>
You are an autonomous AI assistant using the ReAct pattern.

**CORE LOOP:**
Think → Act → Observe → Repeat until completion

**CRITICAL RULES:**
1. THINK before acting
2. EXECUTE immediately (no permission needed)
3. CHAIN operations (multi-step in one turn)
4. OBSERVE results
5. RECURSE when needed

**EXAMPLE SESSION:**
User: "Add a hero section to the about page"
[Shows complete multi-step flow with thinking, tool calls, observations]

**AVAILABLE TOOLS:** {{toolCount}} tools
{{toolsFormatted}}
</agent>
```

### Benefits

✅ **Simpler**: 82 lines vs 800+ lines (90% reduction)  
✅ **Faster**: No composition overhead (~0ms vs ~1ms)  
✅ **Clearer**: Everything in one file, easy to understand  
✅ **More effective**: Agent sees complete example flow  
✅ **Hot-reload**: Edit and test immediately  

### Customization

To modify the prompt:

1. Edit `server/prompts/react.xml`
2. Server auto-reloads in development
3. Test with agent immediately
4. Use Handlebars syntax for variables: `{{toolCount}}`

## Native AI SDK v6 Pattern

The agent uses **native AI SDK v6 patterns** without custom abstractions:

### 1. Tools with `experimental_context`

Tools created once with execute functions that receive context automatically:

```typescript
export const cmsGetPage = tool({
  description: 'Get page by slug or ID',
  inputSchema: z.object({
    slug: z.string().optional()
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext
    return await ctx.services.pageService.getPageBySlug(input.slug)
  }
})
```

**No factories, no wrappers, no recreation** - tools passed AS-IS to agent.

### 2. Memory Management with `prepareStep`

Replaces 331-line memory manager with 15 lines:

```typescript
prepareStep: async ({ stepNumber, messages }) => {
  // Auto-checkpoint every 3 steps
  if (stepNumber % 3 === 0) {
    await sessionService.saveMessages(sessionId, messages)
  }
  
  // Trim history (keep last 20 messages)
  if (messages.length > 20) {
    return { messages: [messages[0], ...messages.slice(-10)] }
  }
  
  return {}
}
```

### 3. Retry Logic with Exponential Backoff

Built into orchestrator, follows v0 pattern:

```typescript
async function executeWithRetry() {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await agent.generate({ messages, experimental_context })
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + jitter()
        await sleep(delay)
        continue
      }
      throw error
    }
  }
}
```

### 4. Automatic Checkpointing

Simple message array save/load:

```typescript
// Save checkpoint
await sessionService.saveMessages(sessionId, messages)

// Resume from checkpoint
const messages = await sessionService.loadMessages(sessionId)
const result = await agent.generate({ messages, experimental_context })
```

### Benefits

✅ **Simpler**: 28% less code (1,200 → 860 lines)  
✅ **Native**: Follows AI SDK v6 patterns exactly  
✅ **Reliable**: No "_zod" errors, no context issues  
✅ **Fast**: No overhead from abstractions  
✅ **Maintainable**: Easy to understand and extend

## Session Management

Multiple chat sessions with full history persistence:

### Features

- **Unlimited sessions** - Create as many conversations as needed
- **Session sidebar** - Switch between sessions instantly
- **Full history** - All messages saved to SQLite database
- **Auto-save** - Messages persisted after each agent response
- **Smart titles** - Auto-generated from first user message
- **Session actions** - Clear history or delete session

### Implementation

**Backend** (`server/services/session-service.ts`):
```typescript
class SessionService {
  async createSession(title?: string): Promise<Session>
  async loadMessages(sessionId: string): Promise<CoreMessage[]>
  async saveMessages(sessionId: string, messages: CoreMessage[]): Promise<void>
  async updateSessionTitle(sessionId: string, title: string): Promise<void>
  async deleteSession(sessionId: string): Promise<void>
  async clearSessionHistory(sessionId: string): Promise<void>
}
```

**Frontend** (`app/assistant/_stores/session-store.ts`):
```typescript
interface SessionStore {
  sessions: Session[]
  currentSessionId: string | null
  loadSessions(): Promise<void>
  createSession(): Promise<void>
  switchSession(sessionId: string): Promise<void>
  deleteSession(sessionId: string): Promise<void>
}
```

### Database Schema

```sql
-- sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  checkpoint TEXT, -- JSON checkpoint data
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)

-- messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' | 'assistant' | 'tool'
  content TEXT NOT NULL, -- JSON content
  tool_name TEXT,
  step_idx INTEGER,
  created_at INTEGER NOT NULL
)
```

## Modern UI with OKLCH Theme

Professional interface with modern color system:

### Design Features

- **Blue chat bubbles** - Assistant messages in light blue/purple gradient
- **2/3 chat layout** - Chat is main focus (was 1/3 in old design)
- **1/3 execution log** - Terminal icon with color-coded events
- **OKLCH colors** - Modern color system with better perceptual uniformity
- **Reduced border radius** - 0.375rem for sharper, more professional look
- **Improved dark mode** - Better contrast and consistent theming
- **Responsive** - Session sidebar hidden on mobile

### Color System

```css
/* Primary colors (purple/blue) */
--primary: 262.1 83.3% 57.8%
--primary-foreground: 210 20% 98%

/* Assistant message bubbles */
.message-assistant {
  background: linear-gradient(135deg, 
    oklch(var(--primary) / 0.1) 0%, 
    oklch(var(--primary) / 0.15) 100%);
  border-left: 3px solid oklch(var(--primary));
}
```

### Layout

```
┌─────────────────────────────────────────┐
│ Header: Bot Icon + "CMS ReAct Agent"   │
├──────────┬──────────────────────────────┤
│ Session  │         Chat Pane            │
│ Sidebar  │    (Blue Bubbles)            │
│ (1/6)    │         (2/3)                │
│          ├──────────────────────────────┤
│          │    Execution Log             │
│          │  (Color-coded events)        │
│          │         (1/3)                │
└──────────┴──────────────────────────────┘
```

## AI-Powered Image Handling

Complete image management system with semantic search and agent integration.

### Features

- 🤖 **AI Metadata Generation** - GPT-4o-mini automatically generates descriptions, tags, categories, colors, and mood
- 🔍 **Semantic Search** - Find images by natural language ("sunset photo", "blue product image")
- 🎯 **Agent Tools** - 6 dedicated tools for finding, attaching, replacing, and deleting images
- ♻️ **Deduplication** - SHA256 hash checking prevents duplicate storage
- 📦 **Async Processing** - BullMQ + Redis queue handles metadata, variants, and embeddings
- 🖼️ **Modern Formats** - Automatic WebP/AVIF variants in 3 sizes (640w, 1024w, 1920w)
- 📊 **Status Tracking** - Real-time processing status (processing → completed → failed)

### Quick Start

```bash
# 1. Start all services (one command)
pnpm start:all      # Starts Redis + shows dev command
pnpm start          # Start dev processes

# Or check status first
pnpm status         # See what's running

# 2. Seed sample images (optional - 3 test images)
pnpm seed:images
# Downloads: mountain landscape, golden puppy, desk workspace
# Wait 5-10 seconds for processing

# 3. Upload an image (or use seed:images above)
curl -X POST http://localhost:8787/api/upload \
  -F "files=@photo.jpg" \
  -F "sessionId=test-123"

# 4. Search for images
curl "http://localhost:8787/api/images/search?q=sunset&limit=5"
# Or try: "mountain", "puppy", "workspace" if you used seed:images

# 5. Test the complete pipeline
./scripts/test-image-upload.sh

# 6. Stop services when done
pnpm stop           # Stop dev only (Redis stays running)
pnpm stop:all       # Stop everything
```

### Agent Tools

The agent has 6 image operation tools:

- **cms_findImage** - Find single image by natural language description
- **cms_searchImages** - Search for multiple images
- **cms_listConversationImages** - List images uploaded in current session
- **cms_addImageToSection** - Attach image to page section field
- **cms_replaceImage** - Replace image across all locations
- **cms_deleteImage** - Safe deletion with confirmation

**Example prompts:**
```
"Find the sunset photo and add it to the hero section"
"What images did I upload in this conversation?"
"Search for product images with blue backgrounds"
"Replace the old logo with the new one across all pages"
```

### Image Architecture: Inline JSON Pattern

Section images use the **Inline JSON Content Pattern** - image data is stored directly in the `page_section_contents.content` JSON field:

**Storage Example**:
```json
{
  "title": "Welcome to Our CMS",
  "image": {
    "url": "/uploads/images/2025/11/22/original/uuid.jpg",
    "alt": "AI-generated description"
  },
  "ctaText": "Get Started"
}
```

**Why Inline JSON?**
- ✅ Simpler - Content is self-contained
- ✅ Faster - No database joins on render
- ✅ Template-friendly - Direct access to image data
- ✅ Industry standard - Matches WordPress, Contentful, Strapi

**Agent Tools**:
- `cms_updateSectionImage` - Update image field in section
- `cms_addImageToSection` - Add image to section field
- `cms_replaceImage` - Find and replace images across sections

See **[docs/IMAGE_ARCHITECTURE.md](docs/IMAGE_ARCHITECTURE.md)** for complete architecture guide and decision record.

### Documentation

- **[docs/IMAGE_HANDLING_README.md](docs/IMAGE_HANDLING_README.md)** - Complete API reference and examples
- **[docs/IMAGE_SETUP_CHECKLIST.md](docs/IMAGE_SETUP_CHECKLIST.md)** - Setup verification checklist
- **[docs/IMAGE_SYSTEM_COMPLETE.md](docs/IMAGE_SYSTEM_COMPLETE.md)** - Implementation summary
- **[docs/IMAGE_ARCHITECTURE.md](docs/IMAGE_ARCHITECTURE.md)** - Architecture pattern and decision record

## Development Workflow

### Recommended Daily Workflow

**Prevent duplicate processes** (avoid resource drain):

```bash
# 1. ALWAYS check first (make it a habit!)
pnpm ps             # Shows all services, ports, and duplicates

# 2. If anything running, stop it first
pnpm stop:all       # Clean slate

# 3. Start fresh
pnpm start:all      # Start Redis
pnpm start          # Start dev processes

# 4. When done for the day
pnpm stop           # Stop dev (leave Redis running)
```

### Why This Matters

**Duplicate processes happen when:**
- ❌ Using Ctrl+C (doesn't kill child processes from concurrently)
- ❌ Terminal crashes (leaves orphaned processes)
- ❌ Starting without stopping (stacks processes)

**Prevention:**
- ✅ **Always use `pnpm stop` or `pnpm stop:all`** (never Ctrl+C)
- ✅ **Check `pnpm ps` before starting** (catch duplicates early)
- ✅ **Run `pnpm ps` when things feel slow** (likely duplicates)
- ✅ **Weekly cleanup**: `pnpm stop:all` to fully reset

### Process Monitor Output

`pnpm ps` shows:
- 🔴 **Redis status** - Running/Stopped
- 🔌 **Port usage** - What's using 8787, 4000, 3000, 6379
- 💻 **Project processes** - All tsx/node/pnpm processes with PIDs
- ⚠️ **Duplicate detection** - Highlights when multiple instances running
- 👻 **Zombie detection** - Finds old processes from previous sessions

## Troubleshooting

### Common Issues

| Problem                   | Solution                                          |
| ------------------------- | ------------------------------------------------- |
| Agent not responding      | Check API logs, verify OpenRouter API key        |
| Blue bubbles not showing  | Hard refresh (Cmd+Shift+R), check globals.css    |
| Tool execution fails      | Check execution log, agent auto-retries 3x       |
| Database locked           | `pnpm stop:all`, `rm data/sqlite.db`, re-seed    |
| Vector search no results  | Run `pnpm reindex`                                |
| Port in use               | Run `pnpm ps` to see what's using it, then `pnpm stop:all` |
| Redis connection refused  | `pnpm start:redis`, verify with `redis-cli ping` |
| Worker not processing     | Check `pnpm ps`, restart with `pnpm restart`     |
| Image upload fails        | Check `UPLOADS_DIR` exists, verify file size limits |
| Image search no results   | Wait for processing, check status shows "completed" |
| Duplicate/zombie processes | Run `pnpm ps` to identify, then `pnpm stop:all`  |
| System slow/high CPU      | Run `pnpm ps` - likely duplicate processes       |

### System Reset Options

**Three-tier reset system** for different scenarios:

```bash
# 1. Cache Reset (fastest - ~2s)
pnpm reset:system
# Clears Redis cache, checkpoints DB (WAL files)
# Kills orphaned processes
# Use when: Things feel slow or broken

# 2. Data Reset (fast - ~15-20s)
pnpm reset:data
# Truncates all tables (preserves schema)
# Clears uploads, vector store
# Reseeds data + processes images
# Use when: Need fresh data, schema unchanged

# 3. Complete Reset (nuclear - ~18-25s)
pnpm reset:complete
# Deletes entire database + schema
# Clears all caches, uploads, processes
# Recreates schema + reseeds + processes images
# Use when: Schema changed or deep corruption

# 4. System Verification
pnpm verify
# Runs 10 health checks (Redis, DB, images, ports, etc.)
# Use after: Any reset to confirm system state
```

**When to use each**:
- **reset:system**: Browser cache issues, stale sessions, slow performance
- **reset:data**: Testing fresh data, navigation changes, content updates
- **reset:complete**: Schema migrations, corrupted database, major refactors
- **verify**: After any reset, before reporting bugs

See scripts:
- `scripts/reset-system.ts` - Cache + checkpoint reset
- `scripts/reset-data-only.ts` - Data-only reset
- `scripts/reset-complete.ts` - Nuclear reset with verification
- `scripts/verify-system.ts` - 10-point health check

See [QUICK_REFERENCE.md](QUICK_REFERENCE.md#-common-issues) for detailed troubleshooting.

## Implementation History

See [docs/PROGRESS.md](docs/PROGRESS.md) for complete sprint-by-sprint details.

**Major Milestones**:
- ✅ **Sprints 0-11**: Foundation, CMS API, Agent Core, Modular Prompts, Frontend
- ✅ **Sprint 12**: Native AI SDK v6 Refactor (28% code reduction)
- ✅ **Sprint 13**: Unified ReAct Agent (no modes, single prompt)
- ✅ **Sprint 14**: Modern UI with OKLCH theme (blue bubbles)

**Key Refactors**:
1. [Native AI SDK v6 Pattern](docs/NATIVE_AI_SDK_REFACTOR_PLAN.md) - Eliminated custom abstractions
2. [Unified ReAct Agent](docs/UNIFIED_REACT_AGENT_REFACTOR.md) - Removed mode complexity
3. [UI Overhaul](docs/UI_OVERHAUL_SUMMARY.md) - Modern design with blue bubbles

**Current Status**: Production-ready prototype with 27 tools (21 CMS + 6 image operations), unified agent, modern UI, and AI-powered image management.
