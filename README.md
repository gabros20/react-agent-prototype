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
# Start both API server (8787) and Next.js (3000)
pnpm dev

# Or start individually:
pnpm dev:server  # API server on port 8787
pnpm dev:web     # Next.js on port 3000
```

## Project Structure

```
server/          # Backend Express API
├── db/          # Database schema & client
├── services/    # Business logic layer
├── routes/      # API routes
├── middleware/  # Express middleware
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

- `pnpm dev` - Start both servers
- `pnpm dev:server` - Start API server only
- `pnpm dev:web` - Start Next.js only
- `pnpm db:push` - Push schema changes to DB
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm seed` - Seed database with sample data
- `pnpm reindex` - Populate vector index
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

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS, shadcn/ui
- **Backend**: Express, Drizzle ORM, SQLite
- **AI**: Vercel AI SDK v6, OpenRouter (Google Gemini 2.5 Flash)
- **Vector Search**: LanceDB with OpenRouter embeddings
- **State**: Zustand with localStorage persistence

## Development Status

See [PROGRESS.md](PROGRESS.md) for implementation sprint status.
