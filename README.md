# ReAct AI Agent Prototype - CMS-Focused

AI-powered content management system with ReAct-style agent assistant.

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
pnpm dev:web      # Next.js on port 3000
```

### 5. Preview Your Site

```bash
# Open rendered homepage in browser
pnpm preview

# Or visit manually:
http://localhost:4000/pages/home?locale=en
```

## Project Structure

```
server/          # Backend Express API
├── db/          # Database schema & client
├── services/    # Business logic layer
│   ├── cms/     # CMS services (pages, sections, entries)
│   ├── renderer.ts   # Nunjucks template rendering
│   └── vector-index.ts # LanceDB vector search
├── routes/      # API routes
├── middleware/  # Express middleware
├── agent/       # AI agent orchestrator
│   └── orchestrator.ts # ToolLoopAgent with AI SDK v6
├── tools/       # Agent tools (17 tools)
│   ├── registry.ts    # Tool registry with mode filtering
│   └── categories/    # Tool categories (cms, http, planning)
├── prompts/     # Modular prompt system
│   ├── core/    # Identity, capabilities, rules
│   ├── modes/   # Mode-specific prompts (architect, cms-crud, debug, ask)
│   ├── components/ # Reusable patterns (ReAct, tool usage, error handling)
│   ├── examples/ # Few-shot examples
│   └── utils/   # PromptComposer with caching
├── templates/   # Nunjucks templates
│   ├── layout/  # Page layout (HTML shell)
│   ├── sections/ # Section templates (hero, feature, cta)
│   └── assets/  # Static assets (CSS)
├── index.ts     # API server (port 8787)
├── preview.ts   # Preview server (port 4000)
└── utils/       # Helper functions

app/             # Next.js frontend
├── assistant/   # Main assistant UI
└── api/         # Next.js API routes

shared/          # Shared code
├── components/  # Reusable UI
├── hooks/       # Custom hooks
└── types/       # TypeScript types

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

### Endpoints
- `GET /pages/:slug?locale=en` - Render page as HTML
- `GET /pages/:slug/raw?locale=en` - Get page data as JSON (debugging)
- `GET /assets/*` - Static assets (CSS, images)
- `GET /health` - Health check with template registry

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

- **Frontend**: Next.js 16, React 19, Tailwind CSS, shadcn/ui
- **Backend**: Express, Drizzle ORM, SQLite
- **Templates**: Nunjucks with custom filters (markdown, truncate, asset)
- **AI**: Vercel AI SDK v6, OpenRouter (Google Gemini 2.5 Flash)
- **Vector Search**: LanceDB with OpenRouter embeddings
- **State**: Zustand with localStorage persistence

## Architecture

This project uses a **3-server architecture**:

1. **API Server (port 8787)**: RESTful CRUD operations for CMS resources
2. **Preview Server (port 4000)**: Renders pages as HTML using Nunjucks templates
3. **Next.js (port 3000)**: Admin UI with AI assistant (future sprint)

The preview server is **production-ready** - it can be deployed separately to serve your actual website.

## Prompt Architecture

The AI agent uses a **modular prompt system** following production patterns from Anthropic, OpenAI, and LangChain.

### Architecture

**Three-Layer System**:
1. **Core Layer**: Identity, capabilities, universal rules (always included)
2. **Mode Layer**: Mode-specific instructions (architect/cms-crud/debug/ask)
3. **Component Layer**: Reusable patterns (ReAct, tool usage, error handling)

**Format**: Hybrid XML + Markdown for LLM-native parsing

### Directory Structure

```
server/prompts/
├── core/                    # Universal components
│   ├── identity.xml         # Agent identity and purpose
│   ├── capabilities.xml     # What agent can/cannot do
│   └── universal-rules.xml  # Critical safety rules
├── modes/                   # Mode-specific instructions
│   ├── architect.xml        # Planning mode (read-only)
│   ├── cms-crud.xml         # Execution mode (full access)
│   ├── debug.xml            # Error analysis mode
│   └── ask.xml              # Inspection mode (read-only)
├── components/              # Reusable instruction blocks
│   ├── react-pattern.md     # ReAct (Think→Act→Observe→Reflect→Respond)
│   ├── tool-usage.md        # Tool selection strategies
│   ├── error-handling.md    # Error recovery patterns
│   ├── validation.md        # Pre/post-mutation validation
│   └── output-format.md     # Response formatting guidelines
├── examples/                # Few-shot examples
│   ├── few-shot-create.xml  # Create page workflow
│   └── few-shot-update.xml  # Update page workflow
└── utils/
    └── composer.ts          # PromptComposer class
```

### Agent Modes

**1. Architect Mode** (Planning)
- **Max steps**: 6
- **Tools**: Read-only + cms.validatePlan
- **Purpose**: Plan CMS changes, validate feasibility
- **Use case**: "Plan a blog system with categories"

**2. CMS CRUD Mode** (Execution)
- **Max steps**: 10
- **Tools**: All CMS tools (read + write)
- **Purpose**: Execute mutations with validation
- **Use case**: "Create an About page with hero section"

**3. Debug Mode** (Error Analysis)
- **Max steps**: 4
- **Tools**: Read tools + limited corrective writes
- **Purpose**: Fix failed operations
- **Use case**: "Why did my page creation fail?"

**4. Ask Mode** (Inspection)
- **Max steps**: 6
- **Tools**: Read-only
- **Purpose**: Explain CMS structure
- **Use case**: "What sections are on the homepage?"

### PromptComposer

The `PromptComposer` class handles prompt composition:

```typescript
import { getSystemPrompt } from './server/prompts/utils/composer'

// Compose prompt for specific mode
const systemPrompt = getSystemPrompt({
  mode: 'cms-crud',
  maxSteps: 10,
  toolsList: ['cms.createPage', 'cms.getPage', ...],
  toolCount: 17,
  sessionId: 'session-123',
  traceId: 'trace-456',
  currentDate: '2025-11-10'
})
```

**Features**:
- File-based loading with filesystem caching
- Handlebars template engine for variable injection
- Mode-specific composition logic
- Cache warmup on server startup (~1ms for 14 files)
- Hot-reload support in development
- Token estimation for monitoring

### Prompt Composition Flow

1. Load core components (identity, capabilities, rules, ReAct pattern)
2. Load mode-specific instructions
3. Load shared components (tool usage, output format)
4. Load mode-specific components (error handling, validation for CRUD)
5. Load few-shot examples (create, update for CRUD)
6. Concatenate with separators (`---`)
7. Inject runtime variables via Handlebars
8. Return composed system prompt

### Cache Warmup

Prompts are cached on server startup:

```
⏳ Warming up prompt cache...
✓ Prompt cache warmed up (14 files, 1ms)
```

Cache statistics:
```typescript
import { promptComposer } from './server/prompts/utils/composer'

const stats = promptComposer.getCacheStats()
// { size: 14, keys: [...], enabled: true }
```

### Benefits

✅ **Maintainable**: Edit prompts without code changes  
✅ **Testable**: Composition tested separately from agent  
✅ **Extensible**: Add new modes by creating new files  
✅ **Performant**: Cached prompts load in ~1ms  
✅ **Versioned**: Git-tracked, rollback-friendly  
✅ **Production-ready**: Follows industry best practices  

### Development

To modify prompts:

1. Edit files in `server/prompts/`
2. Server auto-reloads in development (tsx watch)
3. Cache cleared automatically on file changes
4. Test with different modes via API

To add a new mode:

1. Create `server/prompts/modes/your-mode.xml`
2. Add mode to `AgentMode` type in `server/tools/types.ts`
3. Add mode config to `MODE_CONFIG` in `server/agent/orchestrator.ts`
4. Update registry to filter tools for new mode

## Development Status

See [PROGRESS.md](PROGRESS.md) for implementation sprint status.
