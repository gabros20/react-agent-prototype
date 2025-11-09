# Implementation Sprints — Modular Breakdown

**Purpose**: Break down the comprehensive PLAN.md into actionable, incremental sprints that build the foundation first, layer progressively, and connect everything precisely at the end.

**Philosophy**:

- Each sprint produces **working, testable output**
- Dependencies respected (can't build feature without foundation)
- Modular (can pause/resume between sprints)
- No missing critical details from original plan
- Foundation → Structure → Logic → Integration → Polish

---

## Sprint Overview

| Sprint        | Focus Area                    | Duration    | Dependencies | Deliverable                                                |
| ------------- | ----------------------------- | ----------- | ------------ | ---------------------------------------------------------- |
| **Sprint 0**  | Dev Environment & Tooling     | 3-4 hours   | None         | Working dev environment, folder structure, scripts         |
| **Sprint 1**  | Database Layer & Schemas      | 4-6 hours   | Sprint 0     | Working SQLite DB with all CMS tables + seed data          |
| **Sprint 2**  | Backend API Foundation        | 6-8 hours   | Sprint 1     | Express server with CRUD endpoints, validation             |
| **Sprint 3**  | Vector Index & Search         | 3-4 hours   | Sprint 1, 2  | LanceDB operational, fuzzy resource search working         |
| **Sprint 4**  | Template System & Preview     | 4-6 hours   | Sprint 1, 2  | Nunjucks renderer + preview server on port 4000            |
| **Sprint 5**  | Frontend Foundation           | 6-8 hours   | Sprint 0     | Next.js app, UI components, state management, layout       |
| **Sprint 6**  | Agent Core & Tool Registry    | 8-10 hours  | Sprint 2, 3  | ToolLoopAgent orchestrator, tool registry, basic execution |
| **Sprint 7**  | Prompt Architecture           | 6-8 hours   | Sprint 6     | Modular prompt system, composition engine                  |
| **Sprint 8**  | Agent Intelligence Layer      | 10-12 hours | Sprint 6, 7  | Memory, checkpointing, error recovery, validation          |
| **Sprint 9**  | Frontend-Backend Integration  | 6-8 hours   | Sprint 5, 6  | Streaming working, chat UI functional, debug log           |
| **Sprint 10** | HITL & Safety Features        | 4-6 hours   | Sprint 9     | Approval gates, preflight validation, circuit breaker      |
| **Sprint 11** | Polish & Production Readiness | 4-6 hours   | All          | Testing, error states, documentation, deployment           |

**Total Estimated Time**: 60-80 hours (10-13 days at 6-8 hours/day)

---

## Sprint 0: Dev Environment & Tooling Setup

**Goal**: Set up development environment, install dependencies, configure tooling, create folder structures for both frontend, backend, and shared code.

**Duration**: 3-4 hours

**Prerequisites**: None (starting from scratch)

### Tasks

#### 1. Initialize Project & Dependencies (1 hour)

**1.1 Install Core Dependencies**

```bash
pnpm init
pnpm add ai @openrouter/ai-sdk-provider @ai-sdk/react zod zustand drizzle-orm drizzle-zod better-sqlite3 express cors @lancedb/lancedb nunjucks marked multer @tanstack/react-query sonner
```

**1.2 Install Dev Dependencies**

```bash
pnpm add -D drizzle-kit tsx concurrently @biomejs/biome @types/express @types/multer @types/better-sqlite3 @types/nunjucks @types/marked typescript
```

**1.3 Install Next.js, Tailwind, shadcn/ui**

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
npx shadcn@latest init
npx ai-elements@latest
```

**1.4 Install shadcn Components**

```bash
npx shadcn@latest add accordion collapsible button scroll-area tabs separator textarea alert-dialog toast
```

#### 2. Create Folder Structure (30 min)

**2.1 Backend Structure**

```
server/
├── index.ts                      # Express entry point
├── config/
│   └── constants.ts              # Env variables, defaults
├── db/
│   ├── schema.ts                 # Drizzle table definitions
│   ├── client.ts                 # Drizzle connection
│   └── migrations/               # (future) Migration files
├── services/
│   ├── cms/                      # Business logic layer
│   │   ├── page-service.ts
│   │   ├── section-service.ts
│   │   ├── entry-service.ts
│   │   └── media-service.ts
│   ├── agent/
│   │   ├── orchestrator.ts       # ToolLoopAgent creation
│   │   ├── memory-manager.ts     # Hierarchical context
│   │   └── checkpoint-manager.ts # State persistence
│   ├── vector-index.ts           # LanceDB operations
│   ├── renderer.ts               # Nunjucks template rendering
│   └── service-container.ts      # Lightweight DI
├── repositories/                  # (optional) Complex queries
├── routes/
│   ├── cms.ts                    # CMS CRUD routes
│   ├── agent.ts                  # Agent streaming routes
│   └── preview.ts                # Preview server routes
├── middleware/
│   ├── validation.ts             # Zod payload validation
│   ├── error-handler.ts          # Global error handling
│   └── cors.ts                   # CORS config
├── tools/
│   ├── registry.ts               # Tool registry + factory
│   ├── types.ts                  # Shared tool types
│   └── categories/
│       ├── cms/                  # CMS tools
│       │   ├── index.ts
│       │   ├── pages.ts
│       │   ├── sections.ts
│       │   ├── collections.ts
│       │   ├── entries.ts
│       │   └── search.ts
│       ├── http/
│       │   └── fetch.ts
│       └── planning/
│           └── validate.ts
├── prompts/                       # Modular prompt system
│   ├── core/
│   │   ├── identity.xml
│   │   ├── capabilities.xml
│   │   └── universal-rules.xml
│   ├── modes/
│   │   ├── architect.xml
│   │   ├── cms-crud.xml
│   │   ├── debug.xml
│   │   └── ask.xml
│   ├── components/
│   │   ├── react-pattern.md
│   │   ├── tool-usage.md
│   │   ├── error-handling.md
│   │   └── validation.md
│   ├── examples/
│   │   ├── few-shot-create.xml
│   │   ├── few-shot-update.xml
│   │   └── few-shot-plan.xml
│   └── utils/
│       ├── composer.ts           # Prompt composition engine
│       ├── variables.ts          # Variable injection
│       └── cache.ts              # File caching
├── templates/                     # Nunjucks templates
│   ├── layout/
│   │   └── page.njk              # Base HTML layout
│   ├── sections/
│   │   ├── hero/
│   │   │   ├── default.njk
│   │   │   └── centered.njk
│   │   ├── feature/
│   │   │   └── default.njk
│   │   ├── cta/
│   │   │   └── default.njk
│   │   └── _default.njk          # Fallback template
│   └── assets/
│       └── styles.css            # Minimal CSS utilities
└── utils/
    ├── logger.ts                 # Structured logging
    └── helpers.ts                # Common utilities
```

**2.2 Frontend Structure**

```
app/
├── assistant/                     # Main feature: Assistant UI
│   ├── page.tsx                  # Main composition
│   ├── _components/              # Feature-specific (private)
│   │   ├── chat-pane.tsx         # Right: conversation
│   │   ├── debug-pane.tsx        # Left: debug log
│   │   ├── hitl-modal.tsx        # HITL approval dialog
│   │   ├── mode-selector.tsx     # Mode tabs
│   │   └── preview-button.tsx    # Preview page button
│   ├── _hooks/                   # Feature-specific hooks
│   │   ├── use-agent.ts          # Agent streaming logic
│   │   ├── use-debug-log.ts      # Debug log filtering
│   │   └── use-hitl-approval.ts  # HITL flow
│   ├── _stores/                  # Feature-specific state
│   │   ├── chat-store.ts         # Chat messages, sessionId
│   │   ├── log-store.ts          # Debug log entries
│   │   └── approval-store.ts     # HITL approval state
│   └── _types/                   # Feature-specific types
│       └── log-entry.ts
├── api/
│   └── agent/
│       ├── route.ts              # Streaming proxy
│       └── approve/
│           └── route.ts          # HITL approval endpoint
├── layout.tsx                    # Root layout
└── page.tsx                      # Redirect to /assistant

shared/                            # Shared across features
├── components/                   # Reusable UI
│   ├── ui/                       # shadcn components
│   └── common/                   # Custom shared components
├── hooks/                        # Reusable hooks
│   ├── use-api.ts                # TanStack Query wrapper
│   └── use-toast.ts              # Toast notifications
├── lib/                          # Utilities
│   ├── api-client.ts             # Fetch wrapper
│   ├── query-keys.ts             # TanStack Query keys
│   └── utils.ts                  # Helper functions
├── types/                        # Shared types
│   ├── api.ts                    # API DTOs
│   ├── cms.ts                    # CMS domain types
│   └── agent.ts                  # Agent types
└── stores/                       # Global state (if needed)
    └── user-preferences-store.ts
```

**2.3 Shared & Data Directories**

```
data/                             # Git-ignored
├── sqlite.db                     # SQLite database file
├── uploads/                      # Media files
│   └── local-site/
│       └── main/
└── lancedb/                      # Vector index

scripts/
└── seed.ts                       # Database seed script

docs/                             # Documentation
├── PLAN.md                       # (existing)
├── AGENTIC_PATTERNS_LIBRARY.md   # (existing)
├── PROMPT_ARCHITECTURE_BLUEPRINT.md # (existing)
├── AGENTIC_PATTERNS_ANALYSIS.md  # (existing)
└── IMPLEMENTATION_SPRINTS.md     # (this file)
```

#### 3. Configure Tooling (1 hour)

**3.1 TypeScript Config (`tsconfig.json`)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "incremental": true,
    "paths": { "@/*": ["./*"], "@/shared/*": ["./shared/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", ".next", "out", "data"]
}
```

**3.2 Drizzle Config (`drizzle.config.ts`)**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'sqlite',
  dbCredentials: { url: process.env.DATABASE_URL || 'file:data/sqlite.db' }
})
```

**3.3 Biome Config (`biome.json`)**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 }
}
```

**3.4 Next.js Config (`next.config.mjs`)**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['@lancedb/lancedb', 'better-sqlite3'] }
}

export default nextConfig
```

**3.5 Environment Variables**

**Backend `.env`:**

```bash
# OpenRouter
OPENROUTER_API_KEY=your-api-key-here
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_HEADERS={"HTTP-Referer": "http://localhost:3000", "X-Title": "ReAct CMS Agent"}

# Embeddings
EMBEDDINGS_PROVIDER=openrouter
EMBEDDING_MODEL=openai/text-embedding-3-small

# Database
DATABASE_URL=file:data/sqlite.db
LANCEDB_DIR=data/lancedb

# Defaults
DEFAULT_TEAM=dev-team
DEFAULT_SITE=local-site
DEFAULT_ENV=main

# Server Ports
EXPRESS_PORT=8787
PREVIEW_PORT=4000

# Security
HTTP_FETCH_ALLOWLIST=example.com

# Templates
TEMPLATE_DIR=server/templates
```

**Frontend `.env.local`:**

```bash
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PORT=3000
```

#### 4. Setup Dev Scripts (30 min)

**4.1 Package.json Scripts**

```json
{
  "scripts": {
    "dev": "concurrently \"pnpm:dev:server\" \"pnpm:dev:web\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:web": "next dev -p 3000",
    "dev:preview": "open http://localhost:4000/pages/home?locale=en",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "seed": "tsx scripts/seed.ts",
    "format": "biome format --write .",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "build": "next build",
    "start": "next start"
  }
}
```

**4.2 Create `.gitignore` entries**

```gitignore
# Data
data/
!data/.gitkeep

# Environment
.env
.env.local

# Dependencies
node_modules/

# Build
.next/
out/
dist/
build/

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db
```

**4.3 Create placeholder files**

```bash
mkdir -p data/uploads/local-site/main
touch data/.gitkeep
touch data/uploads/.gitkeep
```

### Deliverables

✅ **Working dev environment**:

- All dependencies installed
- Folder structure created
- Tooling configured (TypeScript, Drizzle, Biome, Next.js)
- Environment variables set up
- Dev scripts ready

✅ **Acceptance Criteria**:

- `pnpm install` runs without errors
- `pnpm typecheck` passes (no TS errors)
- `pnpm format` runs successfully
- `pnpm dev:web` starts Next.js on port 3000
- Folder structure matches spec

---

## Sprint 1: Database Layer & Schemas

**Goal**: Create production-like CMS database schema with Drizzle ORM, seed default data, verify database operations.

**Duration**: 4-6 hours

**Prerequisites**: Sprint 0 completed

### Tasks

#### 1. Define Drizzle Schema (2-3 hours)

**1.1 Create `server/db/schema.ts`**

Define all tables per PLAN.md Section 5:

**Global Tables:**

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

// teams
export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// sites
export const sites = sqliteTable('sites', {
  id: text('id').primaryKey(),
  teamId: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  domain: text('domain'),
  previewDomain: text('preview_domain'),
  defaultEnvironmentId: text('default_environment_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// environments
export const environments = sqliteTable('environments', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isProtected: integer('is_protected', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// locales
export const locales = sqliteTable('locales', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'inactive'] })
    .notNull()
    .default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})
```

**CMS Content Tables:**

```typescript
// pages
export const pages = sqliteTable('pages', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  environmentId: text('environment_id')
    .notNull()
    .references(() => environments.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  indexing: integer('indexing', { mode: 'boolean' }).notNull().default(true),
  meta: text('meta', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// page_sections
export const pageSections = sqliteTable('page_sections', {
  id: text('id').primaryKey(),
  pageId: text('page_id')
    .notNull()
    .references(() => pages.id, { onDelete: 'cascade' }),
  sectionDefId: text('section_def_id')
    .notNull()
    .references(() => sectionDefinitions.id, { onDelete: 'restrict' }),
  sortOrder: integer('sort_order').notNull(),
  status: text('status', { enum: ['published', 'unpublished'] })
    .notNull()
    .default('published'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// page_section_contents
export const pageSectionContents = sqliteTable(
  'page_section_contents',
  {
    id: text('id').primaryKey(),
    pageSectionId: text('page_section_id')
      .notNull()
      .references(() => pageSections.id, { onDelete: 'cascade' }),
    localeCode: text('locale_code')
      .notNull()
      .references(() => locales.code, { onDelete: 'cascade' }),
    content: text('content', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
  },
  (table) => ({ uniquePageSectionLocale: unique().on(table.pageSectionId, table.localeCode) })
)

// section_definitions
export const sectionDefinitions = sqliteTable('section_definitions', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['published', 'unpublished'] })
    .notNull()
    .default('published'),
  elementsStructure: text('elements_structure', { mode: 'json' }).notNull(),
  templateKey: text('template_key').notNull(),
  defaultVariant: text('default_variant').notNull().default('default'),
  cssBundle: text('css_bundle'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// collection_definitions
export const collectionDefinitions = sqliteTable('collection_definitions', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['published', 'unpublished'] })
    .notNull()
    .default('published'),
  elementsStructure: text('elements_structure', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// collection_entries
export const collectionEntries = sqliteTable('collection_entries', {
  id: text('id').primaryKey(),
  collectionId: text('collection_id')
    .notNull()
    .references(() => collectionDefinitions.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// entry_contents
export const entryContents = sqliteTable(
  'entry_contents',
  {
    id: text('id').primaryKey(),
    entryId: text('entry_id')
      .notNull()
      .references(() => collectionEntries.id, { onDelete: 'cascade' }),
    localeCode: text('locale_code')
      .notNull()
      .references(() => locales.code, { onDelete: 'cascade' }),
    content: text('content', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
  },
  (table) => ({ uniqueEntryLocale: unique().on(table.entryId, table.localeCode) })
)

// media
export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  environmentId: text('environment_id')
    .notNull()
    .references(() => environments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  path: text('path').notNull(),
  mimeType: text('mime_type').notNull(),
  mimeGroup: text('mime_group', { enum: ['image', 'video', 'audio', 'document'] }).notNull(),
  width: integer('width'),
  height: integer('height'),
  duration: integer('duration'),
  alt: text('alt'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

// navigations (minimal)
export const navigations = sqliteTable('navigations', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  environmentId: text('environment_id')
    .notNull()
    .references(() => environments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// navigation_items
export const navigationItems = sqliteTable('navigation_items', {
  id: text('id').primaryKey(),
  navigationId: text('navigation_id')
    .notNull()
    .references(() => navigations.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references(() => navigationItems.id, { onDelete: 'cascade' }),
  value: text('value').notNull(),
  targetType: text('target_type', {
    enum: ['page', 'medium', 'entry', 'url', 'placeholder']
  }).notNull(),
  targetUuid: text('target_uuid'),
  url: text('url'),
  sortOrder: integer('sort_order').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})
```

**Assistant Tables:**

```typescript
// sessions
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  checkpoint: text('checkpoint', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// messages
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['system', 'user', 'assistant', 'tool'] }).notNull(),
  content: text('content', { mode: 'json' }).notNull(),
  toolName: text('tool_name'),
  stepIdx: integer('step_idx'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})
```

**Relations (for Drizzle queries):**

```typescript
export const teamsRelations = relations(teams, ({ many }) => ({ sites: many(sites) }))

export const sitesRelations = relations(sites, ({ one, many }) => ({
  team: one(teams, { fields: [sites.teamId], references: [teams.id] }),
  environments: many(environments),
  pages: many(pages),
  media: many(media),
  navigations: many(navigations)
}))

export const pagesRelations = relations(pages, ({ one, many }) => ({
  site: one(sites, { fields: [pages.siteId], references: [sites.id] }),
  environment: one(environments, { fields: [pages.environmentId], references: [environments.id] }),
  pageSections: many(pageSections)
}))

export const pageSectionsRelations = relations(pageSections, ({ one, many }) => ({
  page: one(pages, { fields: [pageSections.pageId], references: [pages.id] }),
  sectionDefinition: one(sectionDefinitions, {
    fields: [pageSections.sectionDefId],
    references: [sectionDefinitions.id]
  }),
  contents: many(pageSectionContents)
}))

export const pageSectionContentsRelations = relations(pageSectionContents, ({ one }) => ({
  pageSection: one(pageSections, {
    fields: [pageSectionContents.pageSectionId],
    references: [pageSections.id]
  }),
  locale: one(locales, { fields: [pageSectionContents.localeCode], references: [locales.code] })
}))

// ... (add all other relations)
```

**1.2 Generate Zod Schemas for Validation**

```typescript
// Export Zod schemas for runtime validation
export const insertTeamSchema = createInsertSchema(teams)
export const selectTeamSchema = createSelectSchema(teams)

export const insertSiteSchema = createInsertSchema(sites)
export const selectSiteSchema = createSelectSchema(sites)

export const insertPageSchema = createInsertSchema(pages)
export const selectPageSchema = createSelectSchema(pages)

// ... (add for all tables)
```

**1.3 Create DB Client (`server/db/client.ts`)**

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

const sqlite = new Database(process.env.DATABASE_URL || 'data/sqlite.db')

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL')

export const db = drizzle(sqlite, { schema })

export type DrizzleDB = typeof db
```

#### 2. Create Seed Script (1-2 hours)

**2.1 Create `scripts/seed.ts`**

```typescript
import { db } from '../server/db/client'
import * as schema from '../server/db/schema'
import { randomUUID } from 'crypto'

async function seed() {
  console.log('Seeding database...')

  // 1. Create team
  const teamId = randomUUID()
  await db
    .insert(schema.teams)
    .values({ id: teamId, name: 'dev-team', createdAt: new Date(), updatedAt: new Date() })

  // 2. Create site
  const siteId = randomUUID()
  const envId = randomUUID()
  await db
    .insert(schema.sites)
    .values({
      id: siteId,
      teamId,
      name: 'local-site',
      domain: 'localhost:4000',
      previewDomain: 'localhost:4000',
      defaultEnvironmentId: envId,
      createdAt: new Date(),
      updatedAt: new Date()
    })

  // 3. Create environment
  await db
    .insert(schema.environments)
    .values({
      id: envId,
      siteId,
      name: 'main',
      isProtected: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })

  // 4. Create locales
  await db.insert(schema.locales).values([
    { code: 'en', name: 'English', status: 'active', createdAt: new Date() },
    { code: 'de', name: 'German', status: 'inactive', createdAt: new Date() }
  ])

  // 5. Create section definition: hero
  const heroSectionId = randomUUID()
  await db.insert(schema.sectionDefinitions).values({
    id: heroSectionId,
    key: 'hero',
    name: 'Hero Section',
    description: 'Homepage hero with title, subtitle, image, and CTA',
    status: 'published',
    elementsStructure: JSON.stringify({
      version: 1,
      rows: [
        {
          id: 'row-1',
          slots: [
            { key: 'title', type: 'text', label: 'Title', dataRules: { required: true } },
            { key: 'subtitle', type: 'text', label: 'Subtitle' },
            { key: 'image', type: 'image', label: 'Hero Image' },
            { key: 'ctaText', type: 'text', label: 'CTA Button Text' },
            {
              key: 'ctaLink',
              type: 'link',
              label: 'CTA Link',
              dataRules: { linkTargets: ['url', 'page'] }
            }
          ]
        }
      ]
    }),
    templateKey: 'hero',
    defaultVariant: 'default',
    createdAt: new Date(),
    updatedAt: new Date()
  })

  // 6. Create collection definition: blog
  const blogCollectionId = randomUUID()
  await db.insert(schema.collectionDefinitions).values({
    id: blogCollectionId,
    slug: 'blog',
    name: 'Blog Posts',
    description: 'Collection of blog posts',
    status: 'published',
    elementsStructure: JSON.stringify({
      version: 1,
      rows: [
        {
          id: 'row-1',
          slots: [
            { key: 'body', type: 'richText', label: 'Post Body', dataRules: { required: true } },
            { key: 'cover', type: 'image', label: 'Cover Image' },
            {
              key: 'tags',
              type: 'option',
              label: 'Tags',
              dataRules: { multiple: true, optionValues: ['AI', 'Tech', 'Design', 'Development'] }
            }
          ]
        }
      ]
    }),
    createdAt: new Date(),
    updatedAt: new Date()
  })

  // 7. Create page: home
  const homePageId = randomUUID()
  await db
    .insert(schema.pages)
    .values({
      id: homePageId,
      siteId,
      environmentId: envId,
      slug: 'home',
      name: 'Homepage',
      indexing: true,
      meta: JSON.stringify({ title: 'Home', description: 'Welcome to our site' }),
      createdAt: new Date(),
      updatedAt: new Date()
    })

  // 8. Add hero section to home page
  const pageSectionId = randomUUID()
  await db
    .insert(schema.pageSections)
    .values({
      id: pageSectionId,
      pageId: homePageId,
      sectionDefId: heroSectionId,
      sortOrder: 0,
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date()
    })

  // 9. Add hero content (English)
  await db
    .insert(schema.pageSectionContents)
    .values({
      id: randomUUID(),
      pageSectionId,
      localeCode: 'en',
      content: JSON.stringify({
        title: 'Welcome to Our CMS',
        subtitle: 'AI-powered content management',
        image: null,
        ctaText: 'Get Started',
        ctaLink: { type: 'url', href: '/contact' }
      }),
      createdAt: new Date(),
      updatedAt: new Date()
    })

  // 10. Create blog entry
  const blogEntryId = randomUUID()
  await db
    .insert(schema.collectionEntries)
    .values({
      id: blogEntryId,
      collectionId: blogCollectionId,
      slug: 'hello-world',
      title: 'Hello World',
      createdAt: new Date(),
      updatedAt: new Date()
    })

  // 11. Add blog entry content
  await db
    .insert(schema.entryContents)
    .values({
      id: randomUUID(),
      entryId: blogEntryId,
      localeCode: 'en',
      content: JSON.stringify({
        body: '# Hello World\n\nThis is my first blog post!',
        cover: null,
        tags: ['AI', 'Tech']
      }),
      createdAt: new Date(),
      updatedAt: new Date()
    })

  // 12. Create default session
  const sessionId = randomUUID()
  await db
    .insert(schema.sessions)
    .values({
      id: sessionId,
      title: 'New Session',
      checkpoint: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })

  console.log('✅ Seed completed successfully!')
  console.log(`Team ID: ${teamId}`)
  console.log(`Site ID: ${siteId}`)
  console.log(`Environment ID: ${envId}`)
  console.log(`Home Page ID: ${homePageId}`)
  console.log(`Session ID: ${sessionId}`)

  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
```

#### 3. Initialize Database (30 min)

**3.1 Push Schema to SQLite**

```bash
pnpm db:push
```

**3.2 Run Seed Script**

```bash
pnpm seed
```

**3.3 Verify Data**

```bash
pnpm db:studio
# Opens Drizzle Studio at http://localhost:3000/drizzle-studio
# Verify all tables have seed data
```

### Deliverables

✅ **Working SQLite database**:

- All CMS tables created
- All assistant tables created
- Seed data loaded (team, site, env, locales, hero section, blog collection, home page, blog entry, session)

✅ **Drizzle ORM operational**:

- Schema exports types
- DB client ready for queries
- Zod schemas generated for validation

✅ **Acceptance Criteria**:

- `pnpm db:push` runs without errors
- `pnpm seed` completes successfully
- Drizzle Studio shows all tables with data
- Can query database: `db.pages.findFirst()` returns home page

---

## Sprint 2: Backend API Foundation

**Goal**: Create Express server with production-like CRUD endpoints, validation, error handling, service layer architecture.

**Duration**: 6-8 hours

**Prerequisites**: Sprint 1 completed

### Tasks

#### 1. Create Service Layer (2-3 hours)

**1.1 Create `server/services/service-container.ts`**

```typescript
import { DrizzleDB } from '../db/client'

export class ServiceContainer {
  private static instance: ServiceContainer

  readonly pageService: PageService
  readonly sectionService: SectionService
  readonly entryService: EntryService
  // ... other services

  private constructor(db: DrizzleDB) {
    // Initialize services
    this.pageService = new PageService(db)
    this.sectionService = new SectionService(db)
    this.entryService = new EntryService(db)
  }

  static initialize(db: DrizzleDB): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer(db)
    }
    return ServiceContainer.instance
  }

  static get(): ServiceContainer {
    if (!ServiceContainer.instance) {
      throw new Error('ServiceContainer not initialized')
    }
    return ServiceContainer.instance
  }
}
```

**1.2 Create `server/services/cms/page-service.ts`**

```typescript
import { DrizzleDB } from '../../db/client'
import * as schema from '../../db/schema'
import { eq, like } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export interface CreatePageInput {
  name: string
  slug: string
  siteId: string
  environmentId: string
  indexing?: boolean
  meta?: Record<string, any>
}

export interface UpdatePageInput {
  name?: string
  slug?: string
  indexing?: boolean
  meta?: Record<string, any>
}

export class PageService {
  constructor(private db: DrizzleDB) {}

  async createPage(input: CreatePageInput) {
    // Validation
    this.validateSlug(input.slug)

    // Create page
    const page = {
      id: randomUUID(),
      siteId: input.siteId,
      environmentId: input.environmentId,
      slug: input.slug,
      name: input.name,
      indexing: input.indexing ?? true,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await this.db.insert(schema.pages).values(page)

    return page
  }

  async updatePage(id: string, input: UpdatePageInput) {
    if (input.slug) {
      this.validateSlug(input.slug)
    }

    const updated = {
      ...input,
      meta: input.meta ? JSON.stringify(input.meta) : undefined,
      updatedAt: new Date()
    }

    await this.db.update(schema.pages).set(updated).where(eq(schema.pages.id, id))

    return this.getPageById(id)
  }

  async getPageById(id: string) {
    return await this.db.query.pages.findFirst({ where: eq(schema.pages.id, id) })
  }

  async getPageBySlug(slug: string) {
    return await this.db.query.pages.findFirst({
      where: eq(schema.pages.slug, slug),
      with: {
        pageSections: {
          with: { sectionDefinition: true, contents: true },
          orderBy: (ps) => ps.sortOrder
        }
      }
    })
  }

  async listPages(query?: string) {
    if (query) {
      return await this.db.query.pages.findMany({ where: like(schema.pages.name, `%${query}%`) })
    }
    return await this.db.query.pages.findMany()
  }

  async deletePage(id: string) {
    await this.db.delete(schema.pages).where(eq(schema.pages.id, id))
  }

  private validateSlug(slug: string): void {
    if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
      throw new Error(
        'Invalid slug format: must be lowercase, alphanumeric with hyphens, 2-64 chars'
      )
    }
  }
}
```

**1.3 Create similar services**:

- `server/services/cms/section-service.ts`
- `server/services/cms/entry-service.ts`
- `server/services/cms/media-service.ts`

(Follow same pattern: validate, execute, return)

#### 2. Create Routes (2-3 hours)

**2.1 Create `server/routes/cms.ts`**

```typescript
import express from 'express'
import { ServiceContainer } from '../services/service-container'
import { z } from 'zod'

const createPageSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]{2,64}$/),
  indexing: z.boolean().optional(),
  meta: z.record(z.any()).optional()
})

export function createCMSRoutes(services: ServiceContainer) {
  const router = express.Router()

  // Pages
  router.get('/:prefix/pages', async (req, res, next) => {
    try {
      const { q } = req.query
      const pages = await services.pageService.listPages(q as string)
      res.json({ data: pages, statusCode: 200 })
    } catch (error) {
      next(error)
    }
  })

  router.post('/:prefix/pages', async (req, res, next) => {
    try {
      const input = createPageSchema.parse(req.body)
      const page = await services.pageService.createPage({
        ...input,
        siteId: process.env.DEFAULT_SITE!,
        environmentId: process.env.DEFAULT_ENV!
      })
      res.status(201).json({ data: page, statusCode: 201 })
    } catch (error) {
      next(error)
    }
  })

  router.get('/:prefix/pages/:page', async (req, res, next) => {
    try {
      const page = await services.pageService.getPageById(req.params.page)
      if (!page) {
        return res
          .status(404)
          .json({ error: { code: 'NOT_FOUND', message: 'Page not found' }, statusCode: 404 })
      }
      res.json({ data: page, statusCode: 200 })
    } catch (error) {
      next(error)
    }
  })

  router.put('/:prefix/pages/:page', async (req, res, next) => {
    try {
      const input = createPageSchema.partial().parse(req.body)
      const page = await services.pageService.updatePage(req.params.page, input)
      res.json({ data: page, statusCode: 200 })
    } catch (error) {
      next(error)
    }
  })

  router.delete('/:prefix/pages/:page', async (req, res, next) => {
    try {
      await services.pageService.deletePage(req.params.page)
      res.json({ data: { success: true }, statusCode: 200 })
    } catch (error) {
      next(error)
    }
  })

  // ... Add routes for sections, collections, entries, media, navigations

  return router
}
```

#### 3. Create Express Server (1-2 hours)

**3.1 Create `server/index.ts`**

```typescript
import express from 'express'
import cors from 'cors'
import { db } from './db/client'
import { ServiceContainer } from './services/service-container'
import { createCMSRoutes } from './routes/cms'
import { errorHandler } from './middleware/error-handler'

const app = express()
const PORT = process.env.EXPRESS_PORT || 8787

// Middleware
app.use(
  cors({ origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', credentials: true })
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Initialize services
const services = ServiceContainer.initialize(db)

// Routes
app.use('/v1', createCMSRoutes(services))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handler (must be last)
app.use(errorHandler)

// Start server
app.listen(PORT, () => {
  console.log(`✅ Express API server running on http://localhost:${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/health`)
})
```

**3.2 Create `server/middleware/error-handler.ts`**

```typescript
import { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error('Error:', err)

  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: err.errors },
        statusCode: 400
      })
  }

  if (err.message.includes('UNIQUE constraint failed')) {
    return res
      .status(409)
      .json({
        error: { code: 'CONFLICT', message: 'Resource already exists', details: err.message },
        statusCode: 409
      })
  }

  res
    .status(500)
    .json({
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Internal server error' },
      statusCode: 500
    })
}
```

#### 4. Test API Endpoints (1 hour)

**4.1 Start Server**

```bash
pnpm dev:server
```

**4.2 Test with curl**

```bash
# Health check
curl http://localhost:8787/health

# List pages
curl http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages

# Create page
curl -X POST http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages \
  -H "Content-Type: application/json" \
  -d '{"name":"About Us","slug":"about"}'

# Get page by ID
curl http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages/{id}

# Update page
curl -X PUT http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages/{id} \
  -H "Content-Type: application/json" \
  -d '{"name":"About Our Company"}'

# Delete page
curl -X DELETE http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages/{id}
```

### Deliverables

✅ **Working Express API server**:

- Service layer with business logic
- CRUD routes for pages (and other CMS resources)
- Validation with Zod
- Error handling with proper envelopes
- Production-like URL structure

✅ **Acceptance Criteria**:

- `pnpm dev:server` starts server on port 8787
- Health check endpoint returns 200
- Can create, read, update, delete pages via API
- Validation errors return 400 with details
- Not found returns 404

---

## Sprint 3: Vector Index & Search

**Goal**: Integrate LanceDB for semantic resource lookup, implement auto-sync on CRUD operations, create fuzzy search endpoint.

**Duration**: 3-4 hours

**Prerequisites**: Sprint 1, 2 completed

### Tasks

#### 1. Create Vector Index Service (1-2 hours)

**1.1 Create `server/services/vector-index.ts`**

```typescript
import { connect, Table } from '@lancedb/lancedb'
import { OpenAI } from 'openai'

export interface ResourceDocument {
  id: string
  type: 'page' | 'section_def' | 'collection' | 'entry'
  name: string
  slug: string
  searchableText: string
  metadata: Record<string, any>
  embedding: number[]
  updatedAt: Date
}

export interface SearchResult {
  id: string
  type: string
  name: string
  slug: string
  similarity: number
}

export class VectorIndexService {
  private db: any
  private table: Table | null = null
  private openai: OpenAI

  constructor(private dbPath: string) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1'
    })
  }

  async initialize() {
    this.db = await connect(this.dbPath)

    try {
      this.table = await this.db.openTable('resource_index')
    } catch {
      // Table doesn't exist, create it
      const schema = {
        id: 'string',
        type: 'string',
        name: 'string',
        slug: 'string',
        searchableText: 'string',
        metadata: 'json',
        embedding: 'float32[1536]',
        updatedAt: 'timestamp'
      }

      this.table = await this.db.createTable('resource_index', [], schema)
    }
  }

  async add(doc: Omit<ResourceDocument, 'embedding' | 'updatedAt'>) {
    if (!this.table) await this.initialize()

    // Generate embedding
    const embedding = await this.embed(doc.searchableText)

    const record = { ...doc, embedding, updatedAt: new Date() }

    await this.table!.add([record])
  }

  async update(id: string, doc: Partial<Omit<ResourceDocument, 'id' | 'embedding' | 'updatedAt'>>) {
    if (!this.table) await this.initialize()

    // Delete old record
    await this.delete(id)

    // Generate new searchable text if fields changed
    let searchableText = doc.searchableText
    if (!searchableText && (doc.name || doc.slug)) {
      searchableText = `${doc.name || ''} ${doc.slug || ''}`.trim()
    }

    // Re-add with new embedding
    const embedding = await this.embed(searchableText!)

    const record = {
      id,
      type: doc.type!,
      name: doc.name!,
      slug: doc.slug!,
      searchableText: searchableText!,
      metadata: doc.metadata || {},
      embedding,
      updatedAt: new Date()
    }

    await this.table!.add([record])
  }

  async search(query: string, type?: string, limit = 3): Promise<SearchResult[]> {
    if (!this.table) await this.initialize()

    // Generate query embedding
    const queryEmbedding = await this.embed(query)

    // Vector similarity search
    let results = await this.table!.search(queryEmbedding)
      .limit(limit * 2) // Get extra for filtering
      .toArray()

    // Filter by type if specified
    if (type) {
      results = results.filter((r: any) => r.type === type)
    }

    // Return top results
    return results.slice(0, limit).map((r: any) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      slug: r.slug,
      similarity: r._distance ? 1 - r._distance : 0 // Convert distance to similarity
    }))
  }

  async exists(id: string): Promise<boolean> {
    if (!this.table) await this.initialize()

    const results = await this.table!.search().where(`id = '${id}'`).limit(1).toArray()

    return results.length > 0
  }

  async delete(id: string) {
    if (!this.table) await this.initialize()

    await this.table!.delete(`id = '${id}'`)
  }

  async close() {
    // LanceDB auto-closes connections
  }

  private async embed(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'openai/text-embedding-3-small',
      input: text.slice(0, 200) // Truncate to 200 chars
    })

    return response.data[0].embedding
  }
}
```

#### 2. Integrate Vector Sync into Services (1 hour)

**2.1 Update `server/services/service-container.ts`**

```typescript
import { VectorIndexService } from './vector-index'

export class ServiceContainer {
  private static instance: ServiceContainer

  readonly vectorIndex: VectorIndexService
  readonly pageService: PageService
  // ...

  private constructor(db: DrizzleDB) {
    // Initialize vector index first
    this.vectorIndex = new VectorIndexService(process.env.LANCEDB_DIR!)

    // Initialize services with vector index
    this.pageService = new PageService(db, this.vectorIndex)
    this.sectionService = new SectionService(db, this.vectorIndex)
    // ...
  }

  static async initialize(db: DrizzleDB): Promise<ServiceContainer> {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer(db)
      await ServiceContainer.instance.vectorIndex.initialize()
    }
    return ServiceContainer.instance
  }

  async dispose(): Promise<void> {
    await this.vectorIndex.close()
  }
}
```

**2.2 Update `server/services/cms/page-service.ts`**

```typescript
export class PageService {
  constructor(
    private db: DrizzleDB,
    private vectorIndex: VectorIndexService
  ) {}

  async createPage(input: CreatePageInput) {
    this.validateSlug(input.slug)

    const page = {
      id: randomUUID(),
      siteId: input.siteId,
      environmentId: input.environmentId,
      slug: input.slug,
      name: input.name,
      indexing: input.indexing ?? true,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await this.db.insert(schema.pages).values(page)

    // Index in vector DB
    await this.vectorIndex.add({
      id: page.id,
      type: 'page',
      name: page.name,
      slug: page.slug,
      searchableText: `${page.name} ${page.slug}`,
      metadata: { siteId: page.siteId }
    })

    return page
  }

  async updatePage(id: string, input: UpdatePageInput) {
    const original = await this.getPageById(id)
    if (!original) throw new Error('Page not found')

    if (input.slug) {
      this.validateSlug(input.slug)
    }

    const updated = {
      ...input,
      meta: input.meta ? JSON.stringify(input.meta) : undefined,
      updatedAt: new Date()
    }

    await this.db.update(schema.pages).set(updated).where(eq(schema.pages.id, id))

    // Re-index if name/slug changed
    if (input.name !== original.name || input.slug !== original.slug) {
      await this.vectorIndex.update(id, {
        type: 'page',
        name: input.name || original.name,
        slug: input.slug || original.slug,
        searchableText: `${input.name || original.name} ${input.slug || original.slug}`,
        metadata: { siteId: original.siteId }
      })
    }

    return this.getPageById(id)
  }

  async deletePage(id: string) {
    await this.db.delete(schema.pages).where(eq(schema.pages.id, id))

    // Remove from vector index
    await this.vectorIndex.delete(id)
  }
}
```

#### 3. Create Search Endpoint (30 min)

**3.1 Add search route to `server/routes/cms.ts`**

```typescript
router.post('/cms/search/resources', async (req, res, next) => {
  try {
    const schema = z.object({
      query: z.string().min(1),
      type: z.enum(['page', 'section_def', 'collection', 'entry']).optional(),
      limit: z.number().int().min(1).max(10).optional().default(3)
    })

    const { query, type, limit } = schema.parse(req.body)

    const results = await services.vectorIndex.search(query, type, limit)

    res.json({ data: results, statusCode: 200 })
  } catch (error) {
    next(error)
  }
})
```

#### 4. Test Vector Search (30 min)

**4.1 Test search**

```bash
# Search for pages
curl -X POST http://localhost:8787/v1/cms/search/resources \
  -H "Content-Type: application/json" \
  -d '{"query":"home page","type":"page","limit":3}'

# Should return: [{ id: '...', type: 'page', name: 'Homepage', slug: 'home', similarity: 0.95 }]

# Test fuzzy search
curl -X POST http://localhost:8787/v1/cms/search/resources \
  -H "Content-Type: application/json" \
  -d '{"query":"homepage","type":"page"}'

# Test typo tolerance
curl -X POST http://localhost:8787/v1/cms/search/resources \
  -H "Content-Type: application/json" \
  -d '{"query":"hme pag"}'

# Test synonym matching
curl -X POST http://localhost:8787/v1/cms/search/resources \
  -H "Content-Type: application/json" \
  -d '{"query":"landing","type":"page"}'
```

### Deliverables

✅ **Working vector search**:

- LanceDB operational
- Auto-sync on page/section/entry CRUD
- Fuzzy search endpoint returns relevant results
- Handles typos and synonyms

✅ **Acceptance Criteria**:

- Vector index initialized on server startup
- Creating page auto-indexes in LanceDB
- Updating page name/slug re-indexes
- Deleting page removes from index
- Search returns top-3 matches with similarity scores
- Search handles misspellings gracefully

---

## Sprint 4: Template System & Preview Server

**Goal**: Set up Nunjucks template rendering engine, create section templates, launch preview web server on port 4000.

**Duration**: 4-6 hours

**Prerequisites**: Sprint 1, 2 completed

### Tasks

#### 1. Create Template Files (1-2 hours)

**1.1 Create `server/templates/layout/page.njk`**

```html
<!DOCTYPE html>
<html lang="{{ locale }}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{ page.meta.title or page.name }}</title>
    {% if page.meta.description %}
    <meta name="description" content="{{ page.meta.description }}" />
    {% endif %}
    <link rel="stylesheet" href="/assets/styles.css" />
  </head>
  <body>
    {{ content | safe }}
  </body>
</html>
```

**1.2 Create `server/templates/sections/hero/default.njk`**

```html
<section class="hero">
  <div class="container">
    {% if title %}
    <h1 class="hero__title">{{ title }}</h1>
    {% endif %} {% if subtitle %}
    <p class="hero__subtitle">{{ subtitle }}</p>
    {% endif %} {% if image %}
    <img src="{{ image.url }}" alt="{{ image.alt or '' }}" class="hero__image" />
    {% endif %} {% if ctaText and ctaLink %}
    <a href="{{ ctaLink.href }}" class="hero__cta">{{ ctaText }}</a>
    {% endif %}
  </div>
</section>
```

**1.3 Create `server/templates/sections/feature/default.njk`**

```html
<section class="feature">
  <div class="container">
    {% if heading %}
    <h2 class="feature__heading">{{ heading }}</h2>
    {% endif %} {% if description %}
    <p class="feature__description">{{ description | markdown | safe }}</p>
    {% endif %} {% if items and items.length > 0 %}
    <ul class="feature__list">
      {% for item in items %}
      <li class="feature__item">
        {% if item.icon %}
        <img src="{{ item.icon.url }}" alt="" class="feature__icon" />
        {% endif %}
        <h3>{{ item.title }}</h3>
        <p>{{ item.description }}</p>
      </li>
      {% endfor %}
    </ul>
    {% endif %}
  </div>
</section>
```

**1.4 Create `server/templates/sections/cta/default.njk`**

```html
<section class="cta">
  <div class="container">
    {% if heading %}
    <h2 class="cta__heading">{{ heading }}</h2>
    {% endif %} {% if description %}
    <p class="cta__description">{{ description }}</p>
    {% endif %} {% if buttonText and buttonLink %}
    <a href="{{ buttonLink.href }}" class="cta__button">{{ buttonText }}</a>
    {% endif %}
  </div>
</section>
```

**1.5 Create `server/templates/sections/_default.njk`**

```html
<section class="section--fallback">
  <div class="container">
    <p>Section: {{ sectionKey }}</p>
    <pre>{{ content | dump(2) }}</pre>
  </div>
</section>
```

**1.6 Create `server/templates/assets/styles.css`**

```css
/* Reset */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  color: #333;
  line-height: 1.6;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

.container {
  margin: 0 auto;
  padding: 0 1rem;
  max-width: 1200px;
}

/* Hero */
.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 4rem 0;
  color: white;
  text-align: center;
}

.hero__title {
  margin-bottom: 1rem;
  font-size: 3rem;
}

.hero__subtitle {
  margin-bottom: 2rem;
  font-size: 1.5rem;
}

.hero__image {
  margin: 2rem 0;
  max-width: 100%;
  height: auto;
}

.hero__cta {
  display: inline-block;
  border-radius: 0.5rem;
  background: white;
  padding: 1rem 2rem;
  color: #667eea;
  font-weight: 600;
  text-decoration: none;
}

/* Feature */
.feature {
  padding: 4rem 0;
}

.feature__heading {
  margin-bottom: 1rem;
  font-size: 2rem;
  text-align: center;
}

.feature__description {
  margin-bottom: 2rem;
  text-align: center;
}

.feature__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  list-style: none;
}

.feature__item {
  border: 1px solid #e0e0e0;
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.feature__icon {
  margin-bottom: 1rem;
  width: 48px;
  height: 48px;
}

/* CTA */
.cta {
  background: #f5f5f5;
  padding: 4rem 0;
  text-align: center;
}

.cta__heading {
  margin-bottom: 1rem;
  font-size: 2rem;
}

.cta__description {
  margin-bottom: 2rem;
  font-size: 1.125rem;
}

.cta__button {
  display: inline-block;
  border-radius: 0.5rem;
  background: #667eea;
  padding: 1rem 2rem;
  color: white;
  font-weight: 600;
  text-decoration: none;
}

/* Fallback */
.section--fallback {
  border: 2px dashed #e0e0e0;
  background: #fafafa;
  padding: 2rem 0;
}

.section--fallback pre {
  border-radius: 0.25rem;
  background: white;
  padding: 1rem;
  overflow-x: auto;
}
```

#### 2. Create Renderer Service (1-2 hours)

**2.1 Create `server/services/renderer.ts`**

```typescript
import nunjucks from 'nunjucks'
import { marked } from 'marked'
import path from 'path'
import fs from 'fs'

export interface TemplateRegistry {
  [templateKey: string]: { variants: string[]; path: string }
}

export class RendererService {
  private env: nunjucks.Environment
  private templateRegistry: TemplateRegistry = {}

  constructor(private templateDir: string) {
    // Configure Nunjucks
    this.env = nunjucks.configure(templateDir, {
      autoescape: true,
      watch: process.env.NODE_ENV === 'development',
      noCache: process.env.NODE_ENV === 'development'
    })

    // Add custom filters
    this.env.addFilter('markdown', (str: string) => {
      return marked.parse(str || '')
    })

    this.env.addFilter('truncate', (str: string, length: number) => {
      if (str.length <= length) return str
      return str.slice(0, length) + '...'
    })

    this.env.addFilter('asset', (assetPath: string) => {
      return `/assets/${assetPath}`
    })

    // Build template registry
    this.buildRegistry()
  }

  private buildRegistry() {
    const sectionsDir = path.join(this.templateDir, 'sections')

    if (!fs.existsSync(sectionsDir)) {
      console.warn('Sections directory not found:', sectionsDir)
      return
    }

    const templateKeys = fs
      .readdirSync(sectionsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)

    for (const templateKey of templateKeys) {
      const templatePath = path.join(sectionsDir, templateKey)
      const variants = fs
        .readdirSync(templatePath)
        .filter((file) => file.endsWith('.njk'))
        .map((file) => file.replace('.njk', ''))

      this.templateRegistry[templateKey] = { variants, path: `sections/${templateKey}` }
    }

    console.log('Template registry:', this.templateRegistry)
  }

  async renderPage(
    pageSlug: string,
    locale: string,
    pageService: any,
    sectionService: any
  ): Promise<string> {
    // 1. Fetch page with sections
    const page = await pageService.getPageBySlug(pageSlug)

    if (!page) {
      throw new Error(`Page not found: ${pageSlug}`)
    }

    // 2. Render each section
    const sectionHtmlList: string[] = []

    for (const pageSection of page.pageSections) {
      const sectionDef = pageSection.sectionDefinition
      const templateKey = sectionDef.templateKey
      const variant = pageSection.variant || sectionDef.defaultVariant || 'default'

      // Get localized content
      const content = pageSection.contents.find((c: any) => c.localeCode === locale)

      if (!content) {
        console.warn(`No content found for section ${pageSection.id} in locale ${locale}`)
        continue
      }

      // Resolve template
      const templatePath = this.resolveTemplate(templateKey, variant)

      // Render section
      const sectionHtml = this.env.render(templatePath, {
        ...JSON.parse(content.content),
        sectionKey: sectionDef.key,
        locale
      })

      sectionHtmlList.push(sectionHtml)
    }

    // 3. Wrap in layout
    const html = this.env.render('layout/page.njk', {
      page,
      locale,
      content: sectionHtmlList.join('\n')
    })

    return html
  }

  private resolveTemplate(templateKey: string, variant: string): string {
    const registry = this.templateRegistry[templateKey]

    if (!registry) {
      console.warn(`Template not found: ${templateKey}, using fallback`)
      return 'sections/_default.njk'
    }

    if (!registry.variants.includes(variant)) {
      console.warn(`Variant '${variant}' not found for ${templateKey}, using default`)
      variant = 'default'
    }

    return `${registry.path}/${variant}.njk`
  }
}
```

#### 3. Create Preview Server (1 hour)

**3.1 Create `server/routes/preview.ts`**

```typescript
import express from 'express'
import { ServiceContainer } from '../services/service-container'
import { RendererService } from '../services/renderer'

export function createPreviewRoutes(services: ServiceContainer, renderer: RendererService) {
  const router = express.Router()

  // Render page
  router.get('/pages/:slug', async (req, res, next) => {
    try {
      const { slug } = req.params
      const locale = (req.query.locale as string) || 'en'

      const html = await renderer.renderPage(
        slug,
        locale,
        services.pageService,
        services.sectionService
      )

      res.setHeader('Content-Type', 'text/html')
      res.send(html)
    } catch (error) {
      next(error)
    }
  })

  // Raw JSON (for debugging)
  router.get('/pages/:slug/raw', async (req, res, next) => {
    try {
      const { slug } = req.params
      const locale = (req.query.locale as string) || 'en'

      const page = await services.pageService.getPageBySlug(slug)

      if (!page) {
        return res.status(404).json({ error: 'Page not found' })
      }

      res.json({ data: page, statusCode: 200 })
    } catch (error) {
      next(error)
    }
  })

  // Serve static assets
  router.use('/assets', express.static(path.join(process.env.TEMPLATE_DIR!, 'assets')))

  return router
}
```

**3.2 Update `server/index.ts` to add preview server**

```typescript
// ... existing code ...

// Initialize renderer
const renderer = new RendererService(process.env.TEMPLATE_DIR!)

// Preview server (separate port)
const previewApp = express()
const PREVIEW_PORT = process.env.PREVIEW_PORT || 4000

previewApp.use(createPreviewRoutes(services, renderer))

previewApp.listen(PREVIEW_PORT, () => {
  console.log(`✅ Preview web server running on http://localhost:${PREVIEW_PORT}`)
  console.log(`   Preview home page: http://localhost:${PREVIEW_PORT}/pages/home?locale=en`)
})

// ... API server code ...
```

#### 4. Test Preview Rendering (30 min)

**4.1 Start servers**

```bash
pnpm dev:server
```

**4.2 Open preview in browser**

```bash
open http://localhost:4000/pages/home?locale=en
```

**4.3 Verify rendering**

- Should see hero section with "Welcome to Our CMS"
- CSS styling applied
- No errors in console

**4.4 Test raw JSON**

```bash
curl http://localhost:4000/pages/home/raw?locale=en
```

### Deliverables

✅ **Working template system**:

- Nunjucks configured with custom filters
- Section templates created (hero, feature, cta, fallback)
- Layout template with CSS
- Preview server running on port 4000

✅ **Acceptance Criteria**:

- Preview server starts on port 4000
- `/pages/home` renders HTML with hero section
- CSS styling visible
- Markdown filter works in richText fields
- Fallback template shows when template missing

---

## Sprint 5: Frontend Foundation

**Goal**: Create Next.js app with UI components, state management, two-pane layout (debug + chat).

**Duration**: 6-8 hours

**Prerequisites**: Sprint 0 completed

### Tasks

#### 1. Create Zustand Stores (1-2 hours)

**1.1 Create `app/assistant/_stores/chat-store.ts`**

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  toolName: string
  input: Record<string, any>
}

interface ChatState {
  sessionId: string | null
  messages: Message[]
  currentTraceId: string | null
  isStreaming: boolean

  // Actions
  setSessionId: (id: string) => void
  addMessage: (message: Message) => void
  clearMessages: () => void
  setIsStreaming: (streaming: boolean) => void
  setCurrentTraceId: (traceId: string | null) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessionId: null,
      messages: [],
      currentTraceId: null,
      isStreaming: false,

      setSessionId: (id) => set({ sessionId: id }),

      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

      clearMessages: () => set({ messages: [] }),

      setIsStreaming: (streaming) => set({ isStreaming: streaming }),

      setCurrentTraceId: (traceId) => set({ currentTraceId: traceId })
    }),
    {
      name: 'chat-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        messages: state.messages.slice(-50) // Keep last 50 only
      })
    }
  )
)
```

**1.2 Create `app/assistant/_stores/log-store.ts`**

```typescript
import { create } from 'zustand'

export interface LogEntry {
  id: string
  type: 'user' | 'assistant' | 'tool' | 'system' | 'error' | 'event'
  traceId: string
  stepId?: string
  timestamp: Date
  summary: string
  details: Record<string, any>
}

interface LogState {
  entries: LogEntry[]
  filter: string
  typeFilter: LogEntry['type'] | 'all'

  // Actions
  addEntry: (entry: LogEntry) => void
  clearEntries: () => void
  setFilter: (filter: string) => void
  setTypeFilter: (type: LogEntry['type'] | 'all') => void
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  filter: '',
  typeFilter: 'all',

  addEntry: (entry) =>
    set((state) => ({
      entries: [...state.entries, entry].slice(-200) // Keep last 200
    })),

  clearEntries: () => set({ entries: [] }),

  setFilter: (filter) => set({ filter }),

  setTypeFilter: (typeFilter) => set({ typeFilter })
}))
```

**1.3 Create `app/assistant/_stores/approval-store.ts`**

```typescript
import { create } from 'zustand'

export interface ApprovalRequest {
  toolName: string
  input: Record<string, any>
  description: string
  traceId: string
  stepId: string
  timestamp: Date
}

interface ApprovalState {
  pendingApproval: ApprovalRequest | null
  decisions: Array<{
    request: ApprovalRequest
    decision: 'approve' | 'reject' | 'alternative'
    timestamp: Date
  }>

  // Actions
  setPendingApproval: (request: ApprovalRequest | null) => void
  recordDecision: (decision: 'approve' | 'reject' | 'alternative') => void
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  pendingApproval: null,
  decisions: [],

  setPendingApproval: (request) => set({ pendingApproval: request }),

  recordDecision: (decision) =>
    set((state) => ({
      decisions: state.pendingApproval
        ? [...state.decisions, { request: state.pendingApproval, decision, timestamp: new Date() }]
        : state.decisions,
      pendingApproval: null
    }))
}))
```

#### 2. Create UI Components (2-3 hours)

**2.1 Create `app/assistant/_components/debug-pane.tsx`**

```typescript
'use client'

import { useLogStore } from '../_stores/log-store'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion'
import { Button } from '@/shared/components/ui/button'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

export function DebugPane() {
  const { entries, filter, typeFilter, setFilter, setTypeFilter, clearEntries } = useLogStore()

  const filteredEntries = entries.filter((entry) => {
    if (typeFilter !== 'all' && entry.type !== typeFilter) return false
    if (filter && !entry.summary.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex flex-col h-full border rounded-lg">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Debug Log</h2>
          <Button variant="outline" size="sm" onClick={clearEntries}>
            Clear
          </Button>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />

          <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <TabsList className="grid grid-cols-7 w-full">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="user">User</TabsTrigger>
              <TabsTrigger value="assistant">Assistant</TabsTrigger>
              <TabsTrigger value="tool">Tool</TabsTrigger>
              <TabsTrigger value="system">System</TabsTrigger>
              <TabsTrigger value="error">Error</TabsTrigger>
              <TabsTrigger value="event">Event</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Log Entries */}
      <ScrollArea className="flex-1 p-4">
        <Accordion type="multiple" className="space-y-2">
          {filteredEntries.map((entry) => (
            <AccordionItem key={entry.id} value={entry.id}>
              <AccordionTrigger className={getTypeColor(entry.type)}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="font-medium">{entry.type.toUpperCase()}</span>
                  <span>{entry.summary}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
                <div className="mt-2 text-xs text-gray-500">
                  TraceID: {entry.traceId}
                  {entry.stepId && ` | StepID: ${entry.stepId}`}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {filteredEntries.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No log entries match your filters
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'user': return 'text-blue-600'
    case 'assistant': return 'text-green-600'
    case 'tool': return 'text-purple-600'
    case 'system': return 'text-gray-600'
    case 'error': return 'text-red-600'
    case 'event': return 'text-orange-600'
    default: return ''
  }
}
```

**2.2 Create `app/assistant/_components/chat-pane.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useChatStore } from '../_stores/chat-store'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { ScrollArea } from '@/shared/components/ui/scroll-area'

export function ChatPane() {
  const { messages, isStreaming, addMessage } = useChatStore()
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (!input.trim() || isStreaming) return

    // Add user message
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date()
    })

    // TODO: Send to agent (next sprint)

    setInput('')
  }

  return (
    <div className="flex flex-col h-full border rounded-lg">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Chat</h2>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm font-medium mb-1">{message.role}</p>
                <p>{message.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <p className="text-sm">Assistant is typing...</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Type your message..."
            disabled={isStreaming}
            className="flex-1"
            rows={2}
          />
          <Button onClick={handleSend} disabled={isStreaming || !input.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**2.3 Create `app/assistant/_components/mode-selector.tsx`**

```typescript
'use client'

import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

export type AgentMode = 'architect' | 'cms-crud' | 'debug' | 'ask'

interface ModeSelectorProps {
  mode: AgentMode
  onModeChange: (mode: AgentMode) => void
}

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <Tabs value={mode} onValueChange={(v) => onModeChange(v as AgentMode)}>
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="architect">Architect</TabsTrigger>
        <TabsTrigger value="cms-crud">CMS CRUD</TabsTrigger>
        <TabsTrigger value="debug">Debug</TabsTrigger>
        <TabsTrigger value="ask">Ask</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
```

**2.4 Create `app/assistant/_components/hitl-modal.tsx`**

```typescript
'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/shared/components/ui/alert-dialog'
import { useApprovalStore } from '../_stores/approval-store'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { Button } from '@/shared/components/ui/button'
import { ChevronDown } from 'lucide-react'

export function HITLModal() {
  const { pendingApproval, setPendingApproval, recordDecision } = useApprovalStore()

  if (!pendingApproval) return null

  const handleApprove = () => {
    recordDecision('approve')
    // TODO: Send approval to backend (next sprint)
  }

  const handleReject = () => {
    recordDecision('reject')
    // TODO: Send rejection to backend (next sprint)
  }

  const handleAlternative = () => {
    recordDecision('alternative')
    // TODO: Send alternative request to backend (next sprint)
  }

  return (
    <AlertDialog open={!!pendingApproval} onOpenChange={() => setPendingApproval(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approval Required</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingApproval.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full">
              <ChevronDown className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto mt-2">
              {JSON.stringify(pendingApproval.input, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleAlternative}>
            Ask for Alternative
          </Button>
          <AlertDialogCancel onClick={handleReject}>Reject</AlertDialogCancel>
          <AlertDialogAction onClick={handleApprove}>Approve</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**2.5 Create `app/assistant/_components/preview-button.tsx`**

```typescript
'use client'

import { Button } from '@/shared/components/ui/button'
import { ExternalLink } from 'lucide-react'

interface PreviewButtonProps {
  pageSlug: string
  locale?: string
}

export function PreviewButton({ pageSlug, locale = 'en' }: PreviewButtonProps) {
  const handlePreview = () => {
    const url = `http://localhost:4000/pages/${pageSlug}?locale=${locale}`
    window.open(url, '_blank')
  }

  return (
    <Button onClick={handlePreview} variant="outline" size="sm">
      <ExternalLink className="h-4 w-4 mr-2" />
      Preview
    </Button>
  )
}
```

#### 3. Create Main Layout (1 hour)

**3.1 Create `app/assistant/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { DebugPane } from './_components/debug-pane'
import { ChatPane } from './_components/chat-pane'
import { ModeSelector, AgentMode } from './_components/mode-selector'
import { HITLModal } from './_components/hitl-modal'
import { PreviewButton } from './_components/preview-button'

export default function AssistantPage() {
  const [mode, setMode] = useState<AgentMode>('cms-crud')

  return (
    <div className="h-screen flex flex-col p-4 bg-gray-50">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">ReAct CMS Agent</h1>
          <PreviewButton pageSlug="home" />
        </div>
        <ModeSelector mode={mode} onModeChange={setMode} />
      </div>

      {/* Two-Pane Layout */}
      <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
        {/* Left: Debug Pane (2/3) */}
        <div className="col-span-2">
          <DebugPane />
        </div>

        {/* Right: Chat Pane (1/3) */}
        <div className="col-span-1">
          <ChatPane />
        </div>
      </div>

      {/* HITL Modal */}
      <HITLModal />
    </div>
  )
}
```

**3.2 Create `app/layout.tsx`**

```typescript
import './globals.css'
import { Toaster } from '@/shared/components/ui/toaster'

export const metadata = {
  title: 'ReAct CMS Agent',
  description: 'AI-powered CMS assistant'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

**3.3 Create `app/page.tsx` (redirect)**

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/assistant')
}
```

#### 4. Test Frontend (30 min)

**4.1 Start Next.js**

```bash
pnpm dev:web
```

**4.2 Open browser**

```
http://localhost:3000
```

**4.3 Verify layout**

- Two-pane layout visible
- Mode selector shows 4 tabs
- Debug log pane on left (empty)
- Chat pane on right
- Can type message and click Send (adds to UI)
- Preview button opens new tab with localhost:4000

### Deliverables

✅ **Working frontend app**:

- Zustand stores for chat, log, approval
- Two-pane layout (debug + chat)
- Mode selector
- HITL modal
- Preview button

✅ **Acceptance Criteria**:

- `pnpm dev:web` starts Next.js on port 3000
- Layout renders correctly
- Can switch between modes
- Can type and send messages (stored in state)
- Debug pane filters work
- Preview button opens external preview

---

**Continue this format for remaining sprints...**

Due to length constraints, I'll create the document with the first 5 sprints detailed. The remaining sprints (6-11) will follow the same structure. Would you like me to:

1. Complete all 11 sprints in this file?
2. Or would you prefer I create a summary of sprints 6-11 and you can ask for details on specific ones?

Let me know and I'll continue!
