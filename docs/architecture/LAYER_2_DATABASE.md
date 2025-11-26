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
        │   └── PageSection (junction to SectionEntry)
        ├── SectionDefinition (template type)
        ├── SectionEntry (instance of definition)
        ├── Post (blog content)
        ├── Image (uploaded media)
        │   └── ImageVariant (responsive sizes)
        └── Navigation (menu structure)
```

### Key Tables

**Pages & Sections:**

```typescript
// server/db/schema.ts
export const pages = sqliteTable("pages", {
	id: text("id").primaryKey(),
	siteId: text("site_id").notNull(),
	environmentId: text("environment_id").notNull(),
	title: text("title").notNull(),
	slug: text("slug").notNull(),
	status: text("status").default("draft"),
	metadata: text("metadata", { mode: "json" }),
	createdAt: integer("created_at", { mode: "timestamp" }),
	updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const sectionDefinitions = sqliteTable("section_definitions", {
	id: text("id").primaryKey(),
	name: text("name").notNull(), // 'hero', 'features', etc.
	schema: text("schema", { mode: "json" }), // Zod schema
	defaultContent: text("default_content", { mode: "json" }),
});

export const sectionEntries = sqliteTable("section_entries", {
	id: text("id").primaryKey(),
	definitionId: text("definition_id").notNull(),
	content: text("content", { mode: "json" }), // Actual data
	pageId: text("page_id"), // Which page it's on
	order: integer("order"),
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

**Sessions:**

```typescript
export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	title: text("title"),
	createdAt: integer("created_at", { mode: "timestamp" }),
	updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const messages = sqliteTable("messages", {
	id: text("id").primaryKey(),
	sessionId: text("session_id").notNull(),
	role: text("role").notNull(), // user/assistant/tool
	content: text("content", { mode: "json" }),
	createdAt: integer("created_at", { mode: "timestamp" }),
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
