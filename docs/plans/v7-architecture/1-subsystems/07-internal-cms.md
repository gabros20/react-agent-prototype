# Internal CMS Server

> **Summary**: The Internal CMS Server is the single source of truth for ALL persistent agent data (users, sessions, messages, todos, metrics) regardless of which CMS the user chooses for website content. It uses PostgreSQL/SQLite with Drizzle ORM.
>
> **Prerequisites**: [00-overview.md](../00-overview.md), [01-service-architecture.md](01-service-architecture.md)

## Overview

The Internal CMS Server (NestJS @ 3001) stores **all persistent agent data**. Even if users connect Contentful or Sanity for website content, their account and chat history live here.

---

## What's Stored Where

### Always in Internal CMS Server

| Data | Purpose | Used By |
|------|---------|---------|
| **Users & Auth** | User accounts, credentials | All services |
| **Sessions** | Chat sessions with hierarchy | Session Service |
| **Messages** | Full conversation history | Session Service, Compaction |
| **Todos** | Plan tracking items | Todo Service |
| **Token Usage** | Token consumption metrics | Observability |

### Depends on User's CMS Choice

| If Internal CMS | If Third-Party CMS |
|-----------------|---------------------|
| Pages stored here | Pages in Contentful/Sanity |
| Sections stored here | Content in external CMS |
| Posts stored here | Blog posts in external CMS |
| Media stored here | Assets in external CMS |

---

## Database Schema

Using Drizzle ORM with PostgreSQL (production) or SQLite (development):

```typescript
// packages/db-schema/src/schema.ts
import { pgTable, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

// ═══════════════════════════════════════════════════════════
// AGENT DATA (Always stored here)
// ═══════════════════════════════════════════════════════════

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  parentId: text('parent_id').references(() => sessions.id),
  userId: text('user_id').references(() => users.id),
  agentId: text('agent_id').notNull(),
  cmsType: text('cms_type').notNull(),
  status: text('status').notNull().default('active'),
  depth: integer('depth').notNull().default(1),
  finalResponse: text('final_response'),
  artifacts: jsonb('artifacts'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),
  role: text('role').notNull(),  // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  toolCalls: jsonb('tool_calls'),
  toolResults: jsonb('tool_results'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const todos = pgTable('todos', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'),
  priority: text('priority').notNull().default('medium'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tokenUsage = pgTable('token_usage', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),
  userId: text('user_id').references(() => users.id),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ═══════════════════════════════════════════════════════════
// WEBSITE CONTENT (Only if using Internal CMS)
// ═══════════════════════════════════════════════════════════

export const pages = pgTable('pages', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  status: text('status').notNull().default('draft'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const sections = pgTable('sections', {
  id: text('id').primaryKey(),
  pageId: text('page_id').references(() => pages.id),
  templateId: text('template_id').notNull(),
  order: integer('order').notNull(),
  content: jsonb('content'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  content: text('content'),
  excerpt: text('excerpt'),
  status: text('status').notNull().default('draft'),
  publishedAt: timestamp('published_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const media = pgTable('media', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  url: text('url').notNull(),
  altText: text('alt_text'),
  metadata: jsonb('metadata'),  // dimensions, colors, etc.
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## Session Hierarchy

Sessions form a **tree structure** for multi-agent execution:

```
Root Session (router, depth: 1)
├── Orchestrator Session (depth: 2) - for complex tasks
│   ├── research_specialist (depth: 3)
│   ├── research_specialist (depth: 3)
│   └── page_specialist (depth: 3)
│
└── qa_specialist (depth: 2) - for simple tasks
```

### Session Fields

```typescript
interface Session {
  id: string;
  parentId: string | null;      // null for root sessions
  agentId: string;              // Which agent config to use
  userId: string;
  cmsType: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  depth: number;                // 1 = router, 2 = orchestrator/specialist, 3 = spawned
  finalResponse?: string;
  artifacts?: string[];         // IDs of created/modified entities
  metadata: {
    totalTokens?: number;
    totalSteps?: number;
    childSessions?: string[];   // IDs of spawned children
  };
}
```

---

## API Endpoints

The Internal CMS Server exposes REST APIs for the Agent Server:

### Session APIs

```
POST   /api/sessions              - Create session
GET    /api/sessions/:id          - Get session
PATCH  /api/sessions/:id          - Update session
GET    /api/sessions/:id/children - List child sessions
```

### Message APIs

```
POST   /api/sessions/:id/messages - Add message
GET    /api/sessions/:id/messages - List messages
```

### Todo APIs

```
GET    /api/sessions/:id/todos    - List todos
PUT    /api/sessions/:id/todos    - Replace all todos
```

### Website Content APIs (Internal CMS only)

```
GET    /api/pages                 - List pages
POST   /api/pages                 - Create page
GET    /api/pages/:id             - Get page with sections
PATCH  /api/pages/:id             - Update page
DELETE /api/pages/:id             - Delete page

POST   /api/pages/:id/sections    - Add section
PATCH  /api/sections/:id          - Update section
DELETE /api/sections/:id          - Delete section
```

---

## Access Patterns

### From Agent Server

```typescript
// Session Service calls Internal CMS via HTTP
class SessionService {
  constructor(private cmsClient: HttpClient) {}

  async create(data: CreateSessionDto): Promise<Session> {
    return this.cmsClient.post('/api/sessions', data);
  }

  async get(id: string): Promise<Session> {
    return this.cmsClient.get(`/api/sessions/${id}`);
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    await this.cmsClient.post(`/api/sessions/${sessionId}/messages`, message);
  }
}
```

### Horizontal Scaling

Because Agent Server is stateless:
- Any Agent Server instance can access any session
- No session affinity required
- Internal CMS Server is the single source of truth

---

## Database Choice

| Environment | Database | Notes |
|-------------|----------|-------|
| Development | SQLite | Zero config, single file |
| Production | PostgreSQL | Scalable, read replicas |

### Migration Path

Drizzle ORM supports both. Schema is the same, just swap the connection:

```typescript
// Development
import { drizzle } from 'drizzle-orm/better-sqlite3';
const db = drizzle(new Database('data/cms.db'));

// Production
import { drizzle } from 'drizzle-orm/node-postgres';
const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));
```

---

## Webhooks

Internal CMS Server dispatches webhooks on content changes:

```typescript
// After page update
await webhookService.dispatch({
  event: 'page.updated',
  payload: { pageId, changes },
  targets: [
    process.env.WEBSITE_RENDERER_URL + '/api/revalidate',
    process.env.AGENT_SERVER_URL + '/webhooks/internal',
  ],
});
```

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| All agent data in Internal CMS | Single source of truth enables stateless Agent Server |
| Session hierarchy in DB | Track parent/child for multi-agent debugging |
| Drizzle ORM | Type-safe, works with SQLite and PostgreSQL |
| Separate from Agent Server | Different scaling characteristics |

---

## Related Documents

- → [01-service-architecture.md](01-service-architecture.md) - Service separation
- → [02-agent-server.md](02-agent-server.md) - How Agent Server accesses data
- → [../2-agents/10-spawning-flow.md](../2-agents/10-spawning-flow.md) - Session hierarchy
- ↗ [../4-appendices/appendix-b-directory.md](../4-appendices/appendix-b-directory.md) - Monorepo structure
