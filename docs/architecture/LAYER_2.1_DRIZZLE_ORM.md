# Layer 2.1: Drizzle ORM & Schema

> Type-safe database access with schema-first design and automatic validation

## Overview

Drizzle ORM provides type-safe database queries with zero runtime overhead. Unlike traditional ORMs that require decorators or runtime reflection, Drizzle infers TypeScript types directly from schema definitions, catching errors at compile time.

**Key Benefits:**
- Full TypeScript inference from schema
- SQL-like query syntax (no magic)
- Automatic Zod schema generation for validation
- No runtime overhead or code generation step

---

## The Problem

Traditional database access in TypeScript suffers from type safety gaps:

```typescript
// Raw SQL - no type safety
const result = await db.query('SELECT * FROM pages WHERE id = ?', [pageId]);
// result is `any` - runtime errors waiting to happen

// Other ORMs - runtime reflection, decorators, sync issues
@Entity()
class Page {
  @Column() title: string; // Schema can drift from DB
}
```

**Drizzle's Solution:** Schema IS the source of truth. Types flow from table definitions to queries to results automatically.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Schema Definition Layer                      │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  sqliteTable()   │    │   relations()    │                   │
│  │  Column Types    │    │   Foreign Keys   │                   │
│  │  Constraints     │    │   One/Many       │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌─────────────────────────────────────────────┐                │
│  │              TypeScript Types               │                │
│  │  • Insert types (with defaults)             │                │
│  │  • Select types (full row)                  │                │
│  │  • Inferred from schema automatically       │                │
│  └─────────────────────┬───────────────────────┘                │
│                        │                                         │
│           ┌────────────┴────────────┐                           │
│           ▼                         ▼                            │
│  ┌─────────────────┐    ┌─────────────────────┐                 │
│  │  Drizzle Query  │    │   drizzle-zod       │                 │
│  │  Builder API    │    │   Zod Schemas       │                 │
│  │  (type-safe)    │    │   (runtime valid.)  │                 │
│  └─────────────────┘    └─────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/db/schema.ts` | All table definitions (~600 lines) |
| `server/db/client.ts` | Database connection and Drizzle instance |
| `drizzle.config.ts` | Migration configuration |

---

## Core Implementation

### Table Definition Pattern

Every table follows the same structure:

```typescript
// server/db/schema.ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const pages = sqliteTable("pages", {
  // Primary key - always text (UUIDs)
  id: text("id").primaryKey(),

  // Foreign keys with cascade rules
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),

  // Required fields
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),

  // Optional fields with defaults
  indexing: integer("indexing", { mode: "boolean" }).notNull().default(true),

  // JSON fields - stored as TEXT, parsed automatically
  meta: text("meta", { mode: "json" }),

  // Timestamps - stored as integers (Unix epoch)
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

### Column Type Modes

Drizzle's `mode` option controls how values are stored vs. accessed:

```typescript
// Boolean mode: stored as 0/1, accessed as boolean
isProtected: integer("is_protected", { mode: "boolean" }).notNull().default(false),

// Timestamp mode: stored as Unix integer, accessed as Date
createdAt: integer("created_at", { mode: "timestamp" }).notNull(),

// JSON mode: stored as TEXT, accessed as parsed object
content: text("content", { mode: "json" }).notNull(),

// Buffer mode: stored as BLOB, accessed as Buffer
thumbnailData: blob("thumbnail_data", { mode: "buffer" }),
```

### Enum Constraints

Use string unions for type-safe enums:

```typescript
status: text("status", {
  enum: ["draft", "published", "archived"]
}).notNull().default("draft"),

role: text("role", {
  enum: ["system", "user", "assistant", "tool"]
}).notNull(),
```

### Relations Definition

Relations are separate from table definitions (for query API):

```typescript
// server/db/schema.ts
import { relations } from "drizzle-orm";

export const pagesRelations = relations(pages, ({ one, many }) => ({
  // Many-to-one: page belongs to site
  site: one(sites, {
    fields: [pages.siteId],
    references: [sites.id]
  }),

  // One-to-many: page has many sections
  pageSections: many(pageSections),
}));

export const pageSectionsRelations = relations(pageSections, ({ one, many }) => ({
  // Back-reference to page
  page: one(pages, {
    fields: [pageSections.pageId],
    references: [pages.id]
  }),

  // Forward reference to definition
  sectionDefinition: one(sectionDefinitions, {
    fields: [pageSections.sectionDefId],
    references: [sectionDefinitions.id],
  }),

  // Localized content
  contents: many(pageSectionContents),
}));
```

### Zod Schema Generation

Automatic validation schemas from table definitions:

```typescript
// server/db/schema.ts
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Insert schema - includes defaults, excludes generated fields
export const insertPageSchema = createInsertSchema(pages);
// Type: { id: string, siteId: string, slug: string, name: string, ... }

// Select schema - all fields as returned from DB
export const selectPageSchema = createSelectSchema(pages);
// Type: { id: string, siteId: string, slug: string, name: string, createdAt: Date, ... }

// Usage in services
const validated = insertPageSchema.parse(userInput);
await db.insert(pages).values(validated);
```

### Type Inference

Extract types from schema for use throughout codebase:

```typescript
// Infer types from schema
type Page = typeof pages.$inferSelect;        // Full row type
type NewPage = typeof pages.$inferInsert;     // Insert type (with optionals)

// Or from Zod schemas
import { z } from "zod";
type Page = z.infer<typeof selectPageSchema>;
type NewPage = z.infer<typeof insertPageSchema>;
```

---

## Design Decisions

### Why Drizzle over Prisma/TypeORM?

| Aspect | Drizzle | Prisma | TypeORM |
|--------|---------|--------|---------|
| Bundle size | ~50KB | ~2MB | ~1MB |
| Type inference | From schema | Generated | Decorators |
| Query syntax | SQL-like | Custom DSL | Query builder |
| Runtime overhead | None | Client init | Reflection |
| SQLite support | Native | Via adapter | Limited |

**Decision:** Drizzle's zero-overhead approach fits our lightweight SQLite architecture.

### Why Text IDs (UUIDs) over Auto-Increment?

```typescript
id: text("id").primaryKey(),  // NOT integer().autoincrement()
```

1. **Distributed generation** - Can create IDs before insert
2. **No collisions** - Safe for multi-tenant / multi-environment
3. **URL-safe** - UUIDs work in routes without encoding
4. **Merge-friendly** - No ID conflicts when combining databases

### Why JSON Columns for Content?

```typescript
content: text("content", { mode: "json" }).notNull(),
```

1. **Flexible schema** - Section content varies by definition
2. **No migrations** - Add fields without ALTER TABLE
3. **Atomic updates** - Replace entire content blob
4. **Trade-off** - Can't query individual JSON fields efficiently (acceptable for our use case)

### Why Separate Relations from Tables?

```typescript
// Table definition (schema.ts)
export const pages = sqliteTable("pages", { ... });

// Relations definition (schema.ts, but separate)
export const pagesRelations = relations(pages, ({ one, many }) => ({ ... }));
```

1. **Circular dependency prevention** - Tables can reference each other
2. **Optional for query API** - Relations only needed for `.with()` queries
3. **Clear separation** - Physical schema vs. logical relationships

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 2.7 (Connection) | Schema imported into `drizzle()` instance |
| Layer 2.6 (Migrations) | Schema changes generate migration SQL |
| Layer 4 (Services) | Services import schema for type-safe queries |
| Layer 3 (Agent) | Tools use Zod schemas for input validation |

### Service Layer Usage

```typescript
// server/services/cms/page-service.ts
import { db } from "../../db/client";
import { pages, pageSections, pageSectionContents } from "../../db/schema";
import { eq, and } from "drizzle-orm";

class PageService {
  async getPage(pageId: string) {
    // Type-safe query - TypeScript knows exact return shape
    return db.query.pages.findFirst({
      where: eq(pages.id, pageId),
      with: {
        pageSections: {
          with: {
            sectionDefinition: true,
            contents: true,
          },
          orderBy: (sections, { asc }) => [asc(sections.sortOrder)],
        },
      },
    });
  }

  async createPage(data: NewPage) {
    const [page] = await db.insert(pages).values(data).returning();
    return page; // Fully typed as Page
  }
}
```

---

## Common Issues / Debugging

### Type Error: Property 'X' does not exist

```typescript
// Error: Property 'pageSections' does not exist on type 'Page'
const page = await db.select().from(pages).where(eq(pages.id, id));
page.pageSections; // ❌ Relations not included
```

**Fix:** Use query API with `.with()`:

```typescript
const page = await db.query.pages.findFirst({
  where: eq(pages.id, id),
  with: { pageSections: true }, // ✅ Now included and typed
});
```

### JSON Column Type Safety

```typescript
// Problem: JSON columns are typed as `unknown`
const page = await db.select().from(pages);
page.meta.title; // ❌ Object is of type 'unknown'
```

**Fix:** Define and apply types:

```typescript
interface PageMeta {
  title?: string;
  description?: string;
}

const meta = page.meta as PageMeta;
meta.title; // ✅ string | undefined
```

### Enum Value Not Assignable

```typescript
// Error: '"pending"' is not assignable to type '"draft" | "published" | "archived"'
await db.insert(posts).values({ status: "pending" });
```

**Fix:** Check enum values in schema match your code:

```typescript
// Schema defines allowed values
status: text("status", { enum: ["draft", "published", "archived"] })
```

### Timestamp Handling

```typescript
// SQLite stores as integer, but mode: "timestamp" expects Date
await db.insert(pages).values({
  createdAt: Date.now(), // ❌ number, not Date
});
```

**Fix:** Always pass `Date` objects:

```typescript
await db.insert(pages).values({
  createdAt: new Date(), // ✅
});
```

---

## Further Reading

- [Layer 2.2: Entity Hierarchy](./LAYER_2.2_ENTITY_HIERARCHY.md) - How tables relate
- [Layer 2.6: Migrations](./LAYER_2.6_MIGRATIONS.md) - Schema evolution
- [Layer 4: Services](./LAYER_4_SERVICES.md) - Query patterns in practice
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [drizzle-zod Docs](https://orm.drizzle.team/docs/zod)
