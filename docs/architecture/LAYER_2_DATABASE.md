# Layer 2: Database & Persistence

> SQLite with Drizzle ORM, LanceDB vector storage, and schema design

## Overview

The persistence layer uses SQLite for relational data and LanceDB for vector embeddings. Drizzle ORM provides type-safe database access with a clean migration system.

**Database File:** `./data/sqlite.db`
**Vector Store:** `./data/lancedb`
**Mode:** WAL (Write-Ahead Logging) for concurrent reads

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Persistence Layer                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │      SQLite         │    │        LanceDB              │  │
│  │   (Relational)      │    │    (Vector Store)           │  │
│  │                     │    │                             │  │
│  │  Teams              │    │  page_embeddings            │  │
│  │  └─ Sites           │    │  section_embeddings         │  │
│  │     └─ Environments │    │  image_embeddings           │  │
│  │        ├─ Pages     │    │                             │  │
│  │        ├─ Sections  │    │  Uses: OpenRouter embeddings│  │
│  │        ├─ Entries   │    │  Dims: 1536                 │  │
│  │        ├─ Posts     │    │                             │  │
│  │        └─ Images    │    └─────────────────────────────┘  │
│  │                     │                                     │
│  │  Sessions           │                                     │
│  │  SiteSettings       │                                     │
│  │  Navigation         │                                     │
│  └─────────────────────┘                                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    Drizzle ORM                         │  │
│  │  Type-safe queries • Migrations • Schema inference     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                    | Purpose               |
| ----------------------- | --------------------- |
| `server/db/schema.ts`   | Table definitions     |
| `server/db/index.ts`    | DB connection         |
| `server/db/migrations/` | Migration files       |
| `drizzle.config.ts`     | Drizzle configuration |

---

## Core Schema

### Entity Hierarchy

```
Team (organization)
└── Site (website)
    └── Environment (dev/staging/prod)
        ├── Page (individual page)
        │   └── PageSection (junction)
        │       └── PageSectionContent (localized content)
        ├── SectionTemplate (section type) [GLOBAL]
        ├── CollectionTemplate (blog, products) [GLOBAL]
        │   └── CollectionEntry (blog post)
        │       └── EntryContent (localized)
        ├── Image (uploaded media)
        │   ├── ImageMetadata (AI-generated)
        │   └── ImageVariant (responsive sizes)
        └── SiteSettings (key-value config) [GLOBAL]

Session (chat session)
├── Message (conversation message)
│   └── MessagePart (text/tool-call/tool-result)
└── ConversationLog (trace history)
```

### Key Tables

**Pages & Sections:**

```typescript
// server/db/schema.ts
export const pages = sqliteTable("pages", {
	id: text("id").primaryKey(),
	siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
	environmentId: text("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
	parentId: text("parent_id"), // Self-reference for hierarchy
	slug: text("slug").notNull().unique(),
	name: text("name").notNull(),
	isProtected: integer("is_protected", { mode: "boolean" }).default(false),
	indexing: integer("indexing", { mode: "boolean" }).notNull().default(true),
	meta: text("meta", { mode: "json" }),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sectionTemplates = sqliteTable("section_templates", {
	id: text("id").primaryKey(),
	key: text("key").notNull().unique(), // 'hero', 'features', etc.
	name: text("name").notNull(),
	description: text("description"),
	status: text("status", { enum: ["published", "unpublished"] }).notNull().default("published"),
	fields: text("fields", { mode: "json" }).notNull(), // Field definitions
	templateFile: text("template_file").notNull(), // Nunjucks template
	defaultVariant: text("default_variant").notNull().default("default"),
	cssBundle: text("css_bundle"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const pageSections = sqliteTable("page_sections", {
	id: text("id").primaryKey(),
	pageId: text("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
	sectionTemplateId: text("section_template_id").notNull().references(() => sectionTemplates.id, { onDelete: "restrict" }),
	sortOrder: integer("sort_order").notNull(),
	status: text("status", { enum: ["published", "unpublished", "draft"] }).notNull().default("published"),
	hidden: integer("hidden", { mode: "boolean" }).default(false),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const pageSectionContents = sqliteTable("page_section_contents", {
	id: text("id").primaryKey(),
	pageSectionId: text("page_section_id").notNull().references(() => pageSections.id, { onDelete: "cascade" }),
	localeCode: text("locale_code").notNull().references(() => locales.code, { onDelete: "cascade" }),
	content: text("content", { mode: "json" }).notNull(), // Actual content data
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

**Images:**

```typescript
export const images = sqliteTable("images", {
	id: text("id").primaryKey(),
	filename: text("filename").notNull(),
	originalPath: text("original_path").notNull(),
	mimeType: text("mime_type").notNull(),
	size: integer("size").notNull(),
	width: integer("width"),
	height: integer("height"),
	hash: text("hash"), // SHA256 for dedup
	status: text("status").default("pending"), // pending/processing/completed/failed
	metadata: text("metadata", { mode: "json" }), // AI-generated
	createdAt: integer("created_at", { mode: "timestamp" }),
});

export const imageVariants = sqliteTable("image_variants", {
	id: text("id").primaryKey(),
	imageId: text("image_id").notNull(),
	width: integer("width").notNull(),
	format: text("format").notNull(), // webp, avif
	path: text("path").notNull(),
	size: integer("size").notNull(),
});
```

**Sessions (with working context and compaction tracking):**

```typescript
export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	modelId: text("model_id").default("openai/gpt-4o-mini"),
	modelContextLength: integer("model_context_length"), // From OpenRouter
	workingContext: text("working_context", { mode: "json" }), // Working memory
	// Compaction tracking
	compactionCount: integer("compaction_count").default(0),
	lastCompactionAt: integer("last_compaction_at"),
	currentlyCompacting: integer("currently_compacting", { mode: "boolean" }).default(false),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
	id: text("id").primaryKey(),
	sessionId: text("session_id").notNull(),
	role: text("role", { enum: ["system", "user", "assistant", "tool"] }).notNull(),
	content: text("content", { mode: "json" }).notNull(), // AI SDK format
	displayContent: text("display_content"), // Plain text for UI
	toolName: text("tool_name"),
	stepIdx: integer("step_idx"),
	// Token tracking
	tokens: integer("tokens").default(0), // Local estimate
	providerTokens: text("provider_tokens", { mode: "json" }), // {input, output}
	isSummary: integer("is_summary", { mode: "boolean" }).default(false),
	isCompactionTrigger: integer("is_compaction_trigger", { mode: "boolean" }).default(false),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const messageParts = sqliteTable("message_parts", {
	id: text("id").primaryKey(),
	messageId: text("message_id").notNull(),
	sessionId: text("session_id").notNull(),
	type: text("type", { enum: ["text", "tool-call", "tool-result", "compaction-marker", "reasoning", "step-start"] }).notNull(),
	content: text("content", { mode: "json" }).notNull(),
	tokens: integer("tokens").default(0),
	compactedAt: integer("compacted_at"),
	sortOrder: integer("sort_order").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const conversationLogs = sqliteTable("conversation_logs", {
	id: text("id").primaryKey(),
	sessionId: text("session_id").notNull(),
	conversationIndex: integer("conversation_index").notNull(),
	userPrompt: text("user_prompt").notNull(),
	startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
	completedAt: integer("completed_at", { mode: "timestamp" }),
	metrics: text("metrics", { mode: "json" }), // {totalDuration, toolCallCount, stepCount, tokens, cost, errorCount}
	modelInfo: text("model_info", { mode: "json" }), // {modelId, pricing}
	entries: text("entries", { mode: "json" }), // Array of trace entries
});
```

---

## Vector Storage (LanceDB)

LanceDB stores embeddings for semantic search:

```typescript
// server/services/vector-index-service.ts
interface PageEmbedding {
	id: string;
	pageId: string;
	content: string;
	vector: number[]; // 1536 dimensions
}

class VectorIndexService {
	async indexPage(page: Page): Promise<void> {
		const embedding = await generateEmbedding(page.content);
		await this.db.add("page_embeddings", {
			id: page.id,
			pageId: page.id,
			content: page.title + " " + page.content,
			vector: embedding,
		});
	}

	async search(query: string, limit = 5): Promise<SearchResult[]> {
		const queryVector = await generateEmbedding(query);
		return this.db.query("page_embeddings").nearestTo(queryVector).limit(limit).execute();
	}
}
```

**Embedding Model:** OpenRouter (text-embedding-3-small)
**Dimensions:** 1536

---

## Drizzle ORM Patterns

### Type-Safe Queries

```typescript
// Select with relations
const pageWithSections = await db.select().from(pages).leftJoin(pageSections, eq(pages.id, pageSections.pageId)).where(eq(pages.id, pageId));

// Insert
const [newPage] = await db.insert(pages).values({ id: nanoid(), title, slug, siteId, environmentId }).returning();

// Update
await db.update(pages).set({ title: newTitle, updatedAt: new Date() }).where(eq(pages.id, pageId));

// Delete
await db.delete(pages).where(eq(pages.id, pageId));
```

### Transaction Support

```typescript
await db.transaction(async (tx) => {
	const [page] = await tx.insert(pages).values(pageData).returning();
	await tx.insert(sectionEntries).values(sections.map((s) => ({ ...s, pageId: page.id })));
});
```

---

## Migrations

Migrations are managed via Drizzle Kit:

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations
pnpm db:push

# Studio (schema browser)
pnpm db:studio
```

Migration files in `server/db/migrations/`:

-   `0000_initial.sql`
-   `0001_add_images.sql`
-   `0002_add_variants.sql`
-   `0003_add_site_settings.sql`

---

## WAL Mode

SQLite runs in WAL mode for better concurrency:

```typescript
// server/db/index.ts
const sqlite = new Database("./data/sqlite.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });
```

Benefits:

-   Multiple readers, single writer
-   Better performance for read-heavy workloads
-   Crash recovery

---

## Data Flow

```
User Action → Service Layer → Drizzle Query → SQLite
                    ↓
              Vector Index → LanceDB (if content change)
```

**On Page Create:**

1. Insert into `pages` table
2. Insert into `sectionEntries` for each section
3. Generate embedding → store in LanceDB
4. Return created page

**On Image Upload:**

1. Insert into `images` (status: 'pending')
2. Queue background job
3. Worker: generate metadata, variants
4. Update `images` (status: 'completed')
5. Insert into `imageVariants`
6. Generate embedding → LanceDB

---

## Integration Points

| Connects To          | How                         |
| -------------------- | --------------------------- |
| Layer 1 (Server)     | ServiceContainer.db         |
| Layer 4 (Services)   | All services use db         |
| Layer 5 (Background) | Workers update image status |
| Layer 3 (Agent)      | Tools query via services    |

---

## Deep Dive Topics

-   Index optimization strategies
-   Full-text search with SQLite FTS5
-   Vector similarity algorithms
-   Backup and recovery procedures
-   Multi-tenant data isolation
