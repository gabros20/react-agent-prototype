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

## Development Status

See [PROGRESS.md](PROGRESS.md) for implementation sprint status.
