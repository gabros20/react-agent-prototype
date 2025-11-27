# Layer 2.2: Entity Hierarchy & Relations

> Multi-tenant data model with cascading ownership and referential integrity

## Overview

The database follows a strict ownership hierarchy: **Team → Site → Environment → Content**. This enables multi-tenant isolation where each team's data is completely separate, while environments (dev/staging/prod) can share section definitions and templates.

**Key Concepts:**
- Teams own Sites (organizations/workspaces)
- Sites own Environments (deployment targets)
- Environments own all content (pages, images, posts)
- Cascade deletes maintain referential integrity automatically

---

## The Problem

Multi-tenant applications face data isolation challenges:

```typescript
// Without hierarchy - accidental cross-tenant data access
const pages = await db.select().from(pages);
// Whose pages? All tenants mixed together!

// Manual filtering everywhere
const pages = await db.select().from(pages)
  .where(eq(pages.tenantId, currentTenant)); // Easy to forget
```

**Our Solution:** Hierarchical ownership with foreign key cascades. Delete a site = all its environments, pages, images, etc. are automatically removed. Query a page = you always know which site/environment it belongs to.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    GLOBAL (Shared Across All)                  │
│           ┌──────────────────┐  ┌──────────────────┐           │
│           │ SectionDefs      │  │ CollectionDefs   │           │
│           │ (templates)      │  │ (blog, products) │           │
│           └──────────────────┘  └──────────────────┘           │
│           ┌──────────────────┐  ┌──────────────────┐           │
│           │ Locales          │  │ SiteSettings     │           │
│           │ (en, de, fr)     │  │ (navigation)     │           │
│           └──────────────────┘  └──────────────────┘           │
├────────────────────────────────────────────────────────────────┤
│                         TENANT LAYER                           │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                         TEAM                             │  │
│  │  id, name, createdAt, updatedAt                          │  │
│  │                           │                              │  │
│  │              ┌────────────┴────────────┐                 │  │
│  │              ▼                         ▼                 │  │
│  │  ┌─────────────────┐       ┌─────────────────┐           │  │
│  │  │     SITE 1      │       │     SITE 2      │           │  │
│  │  │  (marketing)    │       │   (e-commerce)  │           │  │
│  │  │       │         │       │       │         │           │  │
│  │  │       ▼         │       │       ▼         │           │  │
│  │  │  ENVIRONMENTS   │       │  ENVIRONMENTS   │           │  │
│  │  │  ├─ dev         │       │  ├─ staging     │           │  │
│  │  │  ├─ staging     │       │  └─ prod        │           │  │
│  │  │  └─ prod        │       │                 │           │  │
│  │  └─────────────────┘       └─────────────────┘           │  │
│  └──────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────┤
│                       CONTENT LAYER                            │
│                  (Scoped to Environment)                       │
│                                                                │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │   Pages    │ │   Posts    │ │   Images   │ │ Navigation │   │
│  │            │ │ (entries)  │ │            │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/db/schema.ts` | Table definitions with FK constraints |
| `server/db/schema.ts` (relations section) | Drizzle relation definitions |
| `scripts/seed.ts` | Creates hierarchy: team → site → env |

---

## Core Implementation

### Team (Top-Level Tenant)

```typescript
// server/db/schema.ts
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  sites: many(sites),
}));
```

### Site (Project/Website)

```typescript
export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }), // ← CASCADE
  name: text("name").notNull(),
  domain: text("domain"),
  previewDomain: text("preview_domain"),
  defaultEnvironmentId: text("default_environment_id"), // Soft reference
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sitesRelations = relations(sites, ({ one, many }) => ({
  team: one(teams, { fields: [sites.teamId], references: [teams.id] }),
  environments: many(environments),
  pages: many(pages),
  media: many(media),
  navigations: many(navigations),
}));
```

### Environment (Deployment Target)

```typescript
export const environments = sqliteTable("environments", {
  id: text("id").primaryKey(),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }), // ← CASCADE
  name: text("name").notNull(), // "dev", "staging", "prod"
  isProtected: integer("is_protected", { mode: "boolean" })
    .notNull()
    .default(false), // Prevent accidental deletion
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  site: one(sites, { fields: [environments.siteId], references: [sites.id] }),
  pages: many(pages),
  media: many(media),
  navigations: many(navigations),
}));
```

### Content Tables (Environment-Scoped)

All content tables follow the same pattern - dual FK to both site and environment:

```typescript
export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  environmentId: text("environment_id")
    .notNull()
    .references(() => environments.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // ... other fields
});

// Same pattern for: images, navigations, media
export const images = sqliteTable("images", {
  // Note: images don't have siteId/environmentId in current schema
  // They're global and linked via page_section_images junction
});
```

### Cascade Delete Behavior

```typescript
// onDelete options:
.references(() => parent.id, { onDelete: "cascade" })   // Delete children
.references(() => parent.id, { onDelete: "restrict" })  // Block if children exist
.references(() => parent.id, { onDelete: "set null" })  // Nullify FK (if nullable)
```

Our cascade chain:

```
DELETE team
  └─→ CASCADE: delete all sites
       └─→ CASCADE: delete all environments
            └─→ CASCADE: delete all pages
                 └─→ CASCADE: delete all page_sections
                      └─→ CASCADE: delete all page_section_contents
```

### Protected References (RESTRICT)

Section definitions can't be deleted if pages use them:

```typescript
export const pageSections = sqliteTable("page_sections", {
  sectionDefId: text("section_def_id")
    .notNull()
    .references(() => sectionDefinitions.id, { onDelete: "restrict" }),
    // ← RESTRICT: Can't delete definition if sections exist
});
```

---

## Design Decisions

### Why Dual FKs (siteId + environmentId)?

```typescript
// Pages have both siteId and environmentId
siteId: text("site_id").references(() => sites.id),
environmentId: text("environment_id").references(() => environments.id),
```

**Reasons:**
1. **Query efficiency** - Can filter by site without joining environments
2. **Denormalization trade-off** - Extra column vs. extra join
3. **Environment independence** - Pages explicitly belong to one environment

**Alternative considered:** Only environmentId with join to get siteId. Rejected because most queries need site context immediately.

### Why Global Section Definitions?

```typescript
// SectionDefinitions have NO siteId or environmentId
export const sectionDefinitions = sqliteTable("section_definitions", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(), // "hero", "feature", "cta"
  // No ownership columns!
});
```

**Reasons:**
1. **Reusability** - Same hero template across all sites/environments
2. **Consistency** - One "hero" definition, not duplicated per tenant
3. **Simpler migrations** - Update template once, affects all

**Trade-off:** Can't have site-specific section types (acceptable for our use case).

### Why Text IDs with UUIDs?

```typescript
id: text("id").primaryKey(), // e.g., "7f27cf0e-0b38-4c24-b6c5-d15528c80ee3"
```

vs. auto-increment integers:
- **Pros:** Globally unique, can generate before insert, no sequence coordination
- **Cons:** Larger storage (36 chars vs 4-8 bytes), no natural ordering

**Decision:** UUIDs win for multi-tenant scenarios where IDs may cross system boundaries.

### Why No Soft Deletes?

We use hard deletes with cascades, not `deletedAt` columns:

```typescript
// We do this:
await db.delete(pages).where(eq(pages.id, pageId));

// Not this:
await db.update(pages).set({ deletedAt: new Date() }).where(eq(pages.id, pageId));
```

**Reasons:**
1. **Simplicity** - No "WHERE deletedAt IS NULL" on every query
2. **Storage** - Deleted data actually removed
3. **Compliance** - GDPR "right to erasure" is real deletion
4. **Recovery** - Use database backups, not soft delete restoration

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 2.3 (Content Model) | Content tables reference this hierarchy |
| Layer 3.8 (Context Injection) | `cmsTarget` contains resolved siteId/environmentId |
| Layer 4 (Services) | All queries filter by site/environment |
| Layer 2.6 (Seeding) | Seed creates complete hierarchy |

### Context Resolution in Agent

The agent receives `cmsTarget` with resolved IDs:

```typescript
// server/agent/context.ts
interface CMSTarget {
  siteId: string;      // Resolved from "local-site" name or UUID
  environmentId: string; // Resolved from "main" name or UUID
}

// Tool usage
const ctx = experimental_context as AgentContext;
const pages = await ctx.services.pageService.getPages(
  ctx.cmsTarget.siteId,
  ctx.cmsTarget.environmentId
);
```

### Service Layer Filtering

Every service method requires scope:

```typescript
// server/services/cms/page-service.ts
class PageService {
  async getPages(siteId: string, environmentId: string) {
    return db.query.pages.findMany({
      where: and(
        eq(pages.siteId, siteId),
        eq(pages.environmentId, environmentId)
      ),
    });
  }

  async createPage(siteId: string, environmentId: string, data: NewPage) {
    return db.insert(pages).values({
      ...data,
      siteId,        // Always set from context
      environmentId, // Always set from context
    }).returning();
  }
}
```

---

## Common Issues / Debugging

### Foreign Key Constraint Failed

```
Error: FOREIGN KEY constraint failed
```

**Causes:**
1. Inserting with non-existent parent ID
2. Deleting parent when RESTRICT children exist
3. ID typo (UUIDs are easy to mis-copy)

**Debug:**

```typescript
// Check if parent exists
const site = await db.select().from(sites).where(eq(sites.id, siteId));
console.log('Site exists:', site.length > 0);

// Check for blocking children (RESTRICT)
const sections = await db.select().from(pageSections)
  .where(eq(pageSections.sectionDefId, defId));
console.log('Blocking sections:', sections.length);
```

### Orphaned Records

If cascades aren't working, check migration applied correctly:

```sql
-- Check FK constraints in SQLite
PRAGMA foreign_key_list(pages);

-- Ensure FK enforcement is on
PRAGMA foreign_keys = ON;
```

### Cross-Tenant Data Leakage

If pages from wrong tenant appear:

```typescript
// WRONG - no tenant filter
const allPages = await db.select().from(pages);

// RIGHT - always filter
const myPages = await db.select().from(pages)
  .where(and(
    eq(pages.siteId, ctx.cmsTarget.siteId),
    eq(pages.environmentId, ctx.cmsTarget.environmentId)
  ));
```

### defaultEnvironmentId Circular Reference

Sites have `defaultEnvironmentId` but environments reference sites:

```typescript
// Site created first (defaultEnvironmentId = null)
const [site] = await db.insert(sites).values({
  id: siteId,
  teamId,
  name: "my-site",
  defaultEnvironmentId: null, // Can't reference env yet
}).returning();

// Environment created second
const [env] = await db.insert(environments).values({
  id: envId,
  siteId,
  name: "main",
}).returning();

// Update site with default env
await db.update(sites)
  .set({ defaultEnvironmentId: env.id })
  .where(eq(sites.id, siteId));
```

---

## Further Reading

- [Layer 2.1: Drizzle ORM](./LAYER_2.1_DRIZZLE_ORM.md) - Schema definition patterns
- [Layer 2.3: Content Model](./LAYER_2.3_CONTENT_MODEL.md) - How content uses this hierarchy
- [Layer 3.8: Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) - How agent resolves tenant context
- [Layer 4: Services](./LAYER_4_SERVICES.md) - Service layer scoping patterns
