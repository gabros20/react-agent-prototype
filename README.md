# ReAct AI Agent Prototype - CMS-Focused

AI-powered content management system with unified ReAct agent using native AI SDK v6 patterns.

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

### 4. Start Development Servers

```bash
# Start all servers: API (8787), Preview (4000), Next.js (3000)
pnpm dev

# Or start individually:
pnpm dev:server   # API server on port 8787
pnpm dev:preview  # Preview server on port 4000
pnpm dev:web      # Next.js frontend on port 3000
```

### 5. Open the Assistant

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
│   ├── renderer.ts   # Nunjucks template rendering
│   ├── vector-index.ts # LanceDB vector search
│   ├── session-service.ts # Session management
│   └── approval-queue.ts # HITL approval coordination
├── routes/      # API routes
│   ├── agent.ts # SSE streaming endpoints
│   └── sessions.ts # Session CRUD routes
├── middleware/  # Express middleware
├── agent/       # AI agent orchestrator
│   └── orchestrator.ts # Unified ReAct agent (native AI SDK v6)
├── tools/       # Agent tools (13 tools)
│   └── all-tools.ts # All tools with experimental_context
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
└── uploads/     # Media files
```

## Available Scripts

### Development
- `pnpm dev` - Start all servers (API + Preview + Next.js)
- `pnpm dev:server` - Start API server only (port 8787)
- `pnpm dev:preview` - Start preview server only (port 4000)
- `pnpm dev:web` - Start Next.js only (port 3000)
- `pnpm preview` - Open preview in browser

### Database
- `pnpm db:push` - Push schema changes to SQLite
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm seed` - Seed database with sample data
- `pnpm reindex` - Populate vector index with existing data

### Code Quality
- `pnpm typecheck` - Check TypeScript types
- `pnpm lint` - Run Biome linter
- `pnpm format` - Format code with Biome

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

## Architecture

This project uses a **3-server architecture**:

1. **API Server (port 8787)**: RESTful CRUD operations + AI agent streaming
2. **Preview Server (port 4000)**: Renders pages as HTML using Nunjucks templates
3. **Next.js (port 3000)**: AI assistant UI with blue chat bubbles

### Unified ReAct Agent

**Native AI SDK v6 pattern** - no custom abstractions:
- **Single agent** with all 13 tools available always
- **Think → Act → Observe → Repeat** autonomous loop
- **Max 15 steps** per conversation turn
- **Auto-retry** with exponential backoff (3 attempts)
- **Auto-checkpoint** every 3 steps for crash recovery
- **Streaming SSE** with execution log events

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

## Troubleshooting

### Common Issues

| Problem                   | Solution                                          |
| ------------------------- | ------------------------------------------------- |
| Agent not responding      | Check API logs, verify OpenRouter API key        |
| Blue bubbles not showing  | Hard refresh (Cmd+Shift+R), check globals.css    |
| Tool execution fails      | Check execution log, agent auto-retries 3x       |
| Database locked           | Stop servers, `rm data/sqlite.db`, re-seed       |
| Vector search no results  | Run `pnpm reindex`                                |
| Port in use               | `lsof -i :8787 \| grep LISTEN` then `kill -9 PID` |

### Full Reset

```bash
# Nuclear option - complete reset
rm -rf node_modules data/sqlite.db data/lancedb
pnpm install
pnpm db:push
pnpm seed
pnpm reindex
pnpm dev
```

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

**Current Status**: Production-ready prototype with 13 tools, unified agent, and modern UI.
