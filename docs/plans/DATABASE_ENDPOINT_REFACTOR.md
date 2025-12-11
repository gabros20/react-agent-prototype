# Database & Endpoint Refactor Plan

## Status: Draft (Revised for Production Alignment)
## Date: 2025-12-11
## Prerequisite: [ATOMIC_CRUD_TOOL_ARCHITECTURE.md](./ATOMIC_CRUD_TOOL_ARCHITECTURE.md)
## Reference: Brease Production Backend (`brease-backend`)

---

## Executive Summary

This document aligns the prototype with the **production Brease backend** to ensure:
- Easy migration path when agent server matures
- Testing real CMS complexity (not toy examples)
- Same endpoint structure and entity relationships

**Key principle**: Simplify implementation details (skip revisions, skip grid layouts), but **keep the same structure** (multi-tenant, same tables, same endpoints).

---

## Production Backend Analysis

### Technology Comparison

| Aspect | Production (Brease) | Prototype |
|--------|---------------------|-----------|
| **Framework** | Laravel 11 (PHP) | Express + Next.js (TypeScript) |
| **ORM** | Eloquent | Drizzle |
| **Database** | PostgreSQL | SQLite |
| **API Pattern** | RESTful JSON | RESTful JSON |

### What Production Has (That We Need)

| Feature | Production | Prototype Status | Action |
|---------|------------|------------------|--------|
| Multi-tenant (teams → sites → envs) | ✅ | ✅ Have it | **Keep** |
| Pages with hierarchy (parent_id) | ✅ | ❌ Missing | **Add** |
| Sections (reusable blocks) | ✅ | ✅ As `sectionDefinitions` | **Rename** |
| Page sections (pivot) | ✅ | ✅ `pageSections` | **Keep** |
| Collections + Entries | ✅ | ✅ Have it | **Keep** |
| Entry contents (localized) | ✅ | ✅ `entryContents` | **Keep** |
| Navigation tables | ✅ Proper tables | ❌ Using siteSettings JSON | **Fix** |
| Media table | ✅ | ✅ Have it | **Keep** |
| Locales (per environment) | ✅ Junction table | ⚠️ Global table | **Align** |

### What Production Has (That We Skip)

| Feature | Why Skip |
|---------|----------|
| Content revisions | Production concern - agent doesn't need rollback |
| Polymorphic content types | JSON blobs work for testing |
| Grid layout (row/col/size) | Visual editor concern |
| Billing/subscriptions | Not relevant for agent testing |
| User roles/permissions | Single-user prototype |
| Variables table | Nice-to-have, not critical |
| Redirects table | Nice-to-have, not critical |
| Cache invalidation tables | Production optimization |

---

## Schema Changes

### 1. Keep Multi-Tenant Hierarchy ✅

**DO NOT REMOVE** - This matches production:

```typescript
// KEEP AS-IS
export const teams = sqliteTable("teams", {...});
export const sites = sqliteTable("sites", { teamId, ... });
export const environments = sqliteTable("environments", { siteId, isProtected, ... });
export const pages = sqliteTable("pages", { siteId, environmentId, ... });
```

### 2. Add Page Hierarchy

**Production has**: `pages.parent_id` for nested pages (e.g., `/about/team`)

```typescript
// ADD to pages table
export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  environmentId: text("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  parentId: text("parent_id").references(() => pages.id, { onDelete: "set null" }), // NEW
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  isProtected: integer("is_protected", { mode: "boolean" }).default(false), // NEW - for default pages
  indexing: integer("indexing", { mode: "boolean" }).notNull().default(true),
  meta: text("meta", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ADD self-referential relation
export const pagesRelations = relations(pages, ({ one, many }) => ({
  site: one(sites, { fields: [pages.siteId], references: [sites.id] }),
  environment: one(environments, { fields: [pages.environmentId], references: [environments.id] }),
  parent: one(pages, { fields: [pages.parentId], references: [pages.id] }), // NEW
  children: many(pages), // NEW
  pageSections: many(pageSections),
}));
```

### 3. Rename Section Definitions → Section Templates

Aligns with tool naming (`getSectionTemplate`) and is clearer:

```typescript
// RENAME: sectionDefinitions → sectionTemplates
export const sectionTemplates = sqliteTable("section_templates", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["published", "unpublished"] }).notNull().default("published"),
  fields: text("fields", { mode: "json" }).notNull(), // RENAME: elementsStructure → fields
  templateFile: text("template_file").notNull(), // RENAME: templateKey → templateFile
  defaultVariant: text("default_variant").notNull().default("default"),
  cssBundle: text("css_bundle"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// UPDATE pageSections reference
export const pageSections = sqliteTable("page_sections", {
  id: text("id").primaryKey(),
  pageId: text("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  sectionTemplateId: text("section_template_id").notNull().references(() => sectionTemplates.id), // RENAME
  sortOrder: integer("sort_order").notNull(),
  status: text("status", { enum: ["published", "unpublished", "draft"] }).notNull().default("published"), // ADD draft
  hidden: integer("hidden", { mode: "boolean" }).default(false), // ADD - matches production
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

### 4. Fix Navigation Tables

**Current (wrong)**: Navigation stored as JSON in `siteSettings`
**Production (correct)**: Proper `navigations` + `navigation_items` tables

We already have the tables, just not using them! Update tools to use:

```typescript
// ALREADY EXISTS - just need to use it
export const navigations = sqliteTable("navigations", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  environmentId: text("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "header", "footer", "main"
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const navigationItems = sqliteTable("navigation_items", {
  id: text("id").primaryKey(),
  navigationId: text("navigation_id").notNull().references(() => navigations.id, { onDelete: "cascade" }),
  parentId: text("parent_id"), // For nested menus
  label: text("label").notNull(), // Display text (was "value" in production)
  targetType: text("target_type", { enum: ["page", "entry", "media", "url", "placeholder"] }).notNull(),
  targetId: text("target_id"), // UUID of page/entry/media (was targetUuid)
  url: text("url"), // For external URLs
  sortOrder: integer("sort_order").notNull(),
  visible: integer("visible", { mode: "boolean" }).default(true), // ADD
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

### 5. Align Locales with Environment

**Production**: `environment_locale` junction table with `is_default` flag
**Current**: Global `locales` table

```typescript
// ADD junction table
export const environmentLocales = sqliteTable("environment_locales", {
  id: text("id").primaryKey(),
  environmentId: text("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  localeCode: text("locale_code").notNull().references(() => locales.code, { onDelete: "cascade" }),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  status: text("status", { enum: ["active", "inactive"] }).default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

### 6. Rename Collection Definitions → Collection Templates

For consistency with section templates:

```typescript
// RENAME: collectionDefinitions → collectionTemplates
export const collectionTemplates = sqliteTable("collection_templates", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(), // e.g., "blog", "products"
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["published", "unpublished"] }).notNull().default("published"),
  fields: text("fields", { mode: "json" }).notNull(), // RENAME: elementsStructure → fields
  hasSlug: integer("has_slug", { mode: "boolean" }).default(true), // ADD - matches production
  orderDirection: text("order_direction", { enum: ["asc", "desc"] }).default("desc"), // ADD
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

---

## Endpoint Structure

### Keep Production-Aligned Paths ✅

**DO NOT SIMPLIFY** - Keep the multi-tenant path structure:

```
/v1/teams/{team}/sites/{site}/environments/{env}/pages
/v1/teams/{team}/sites/{site}/environments/{env}/pages/{page}
/v1/teams/{team}/sites/{site}/environments/{env}/pages/{page}/sections
/v1/teams/{team}/sites/{site}/environments/{env}/collections
/v1/teams/{team}/sites/{site}/environments/{env}/collections/{col}/entries
/v1/teams/{team}/sites/{site}/environments/{env}/navigations
/v1/teams/{team}/sites/{site}/environments/{env}/media
```

This matches production exactly!

### Full Endpoint Map (Production-Aligned)

#### Pages
```
GET    /v1/.../pages                    → List pages
POST   /v1/.../pages                    → Create page
GET    /v1/.../pages/{page}             → Get page
PATCH  /v1/.../pages/{page}             → Update page
DELETE /v1/.../pages/{page}             → Delete page
```

#### Page Sections
```
GET    /v1/.../pages/{page}/sections              → List sections on page
POST   /v1/.../pages/{page}/sections              → Add section to page
DELETE /v1/.../pages/{page}/sections/{section}    → Remove section
POST   /v1/.../pages/{page}/sections/{section}/publish    → Publish section
POST   /v1/.../pages/{page}/sections/{section}/visibility → Toggle visibility
POST   /v1/.../pages/{page}/sections/order        → Reorder sections
```

#### Page Contents
```
GET    /v1/.../pages/{page}/contents              → Get all content
POST   /v1/.../pages/{page}/contents              → Save content
```

#### Section Templates (was Section Definitions)
```
GET    /v1/.../section-templates                  → List templates
GET    /v1/.../section-templates/{key}            → Get template fields
POST   /v1/.../section-templates                  → Create template
PATCH  /v1/.../section-templates/{key}            → Update template
DELETE /v1/.../section-templates/{key}            → Delete template
```

#### Collections
```
GET    /v1/.../collections                        → List collections
POST   /v1/.../collections                        → Create collection
GET    /v1/.../collections/{col}                  → Get collection
PATCH  /v1/.../collections/{col}                  → Update collection
DELETE /v1/.../collections/{col}                  → Delete collection
POST   /v1/.../collections/{col}/order            → Set entry ordering
```

#### Entries
```
GET    /v1/.../collections/{col}/entries          → List entries
POST   /v1/.../collections/{col}/entries          → Create entry
GET    /v1/.../collections/{col}/entries/{entry}  → Get entry
PATCH  /v1/.../collections/{col}/entries/{entry}  → Update entry
DELETE /v1/.../collections/{col}/entries/{entry}  → Delete entry
GET    /v1/.../collections/{col}/entries/{entry}/contents  → Get entry content
POST   /v1/.../collections/{col}/entries/{entry}/contents  → Save entry content
POST   /v1/.../collections/{col}/entries/order    → Reorder entries
```

#### Navigations
```
GET    /v1/.../navigations                        → List navigations
POST   /v1/.../navigations                        → Create navigation
GET    /v1/.../navigations/{nav}                  → Get navigation with items
PATCH  /v1/.../navigations/{nav}                  → Update navigation
DELETE /v1/.../navigations/{nav}                  → Delete navigation
POST   /v1/.../navigations/{nav}/items            → Add item
DELETE /v1/.../navigations/{nav}/items/{item}     → Remove item
POST   /v1/.../navigations/{nav}/items/sync       → Bulk sync items
```

#### Media
```
GET    /v1/.../media                              → List media
POST   /v1/.../media                              → Upload media
GET    /v1/.../media/{id}                         → Get media details
DELETE /v1/.../media/{id}                         → Delete media
GET    /v1/.../media/{id}/download                → Download file
```

#### Locales
```
GET    /v1/.../locales                            → List environment locales
POST   /v1/.../add-locale                         → Add locale to environment
POST   /v1/.../update-locale                      → Update locale settings
DELETE /v1/.../remove-locale                      → Remove locale
```

---

## Schema Migration Summary

### Tables to RENAME

| Current Name | New Name | Reason |
|--------------|----------|--------|
| `sectionDefinitions` | `section_templates` | Clearer, matches tool naming |
| `collectionDefinitions` | `collection_templates` | Consistency |
| `sectionDefId` (column) | `section_template_id` | Follows rename |
| `elementsStructure` (column) | `fields` | Clearer |
| `templateKey` (column) | `template_file` | Matches production |

### Columns to ADD

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `pages` | `parent_id` | text (FK) | Page hierarchy |
| `pages` | `is_protected` | boolean | Default page flag |
| `page_sections` | `hidden` | boolean | Visibility toggle |
| `page_sections` | `draft` status | enum | Draft state |
| `collection_templates` | `has_slug` | boolean | Entry slug support |
| `collection_templates` | `order_direction` | enum | Entry ordering |
| `navigation_items` | `visible` | boolean | Item visibility |

### Tables to ADD

| Table | Purpose |
|-------|---------|
| `environment_locales` | Junction for locales per environment |

### Tables to DELETE

| Table | Reason |
|-------|--------|
| `siteSettings` | Replace with proper navigation tables |
| `pageSectionImages` | Deprecated (use inline JSON) |

### Tables to KEEP (no changes)

- `teams`
- `sites`
- `environments`
- `locales`
- `pages` (with additions)
- `page_sections` (with additions)
- `page_section_contents`
- `collection_entries` (rename to `entries`?)
- `entry_contents`
- `media`
- `images`
- `image_metadata`
- `image_variants`
- `navigations`
- `navigation_items`
- `sessions`
- `messages`
- `conversation_logs`

---

## Service Changes

### Navigation Service

**Current**: `SiteSettingsService` with JSON navigation
**New**: `NavigationService` using proper tables

```typescript
// server/services/cms/navigation.service.ts
export class NavigationService {
  constructor(private db: DrizzleDB) {}

  async getNavigations(environmentId: string) {
    return this.db.query.navigations.findMany({
      where: eq(navigations.environmentId, environmentId),
      with: { items: { orderBy: (i, { asc }) => [asc(i.sortOrder)] } }
    });
  }

  async getNavigation(id: string) {
    return this.db.query.navigations.findFirst({
      where: eq(navigations.id, id),
      with: { items: { orderBy: (i, { asc }) => [asc(i.sortOrder)] } }
    });
  }

  async addItem(navigationId: string, item: CreateNavItemInput) {
    // Get next sort order
    const existing = await this.db.query.navigationItems.findMany({
      where: eq(navigationItems.navigationId, navigationId)
    });
    const sortOrder = existing.length;

    return this.db.insert(navigationItems).values({
      id: randomUUID(),
      navigationId,
      ...item,
      sortOrder,
      createdAt: new Date()
    });
  }

  async removeItem(itemId: string) {
    return this.db.delete(navigationItems).where(eq(navigationItems.id, itemId));
  }

  async syncItems(navigationId: string, items: NavItemInput[]) {
    // Delete existing, insert new
    await this.db.delete(navigationItems).where(eq(navigationItems.navigationId, navigationId));

    for (let i = 0; i < items.length; i++) {
      await this.db.insert(navigationItems).values({
        id: randomUUID(),
        navigationId,
        ...items[i],
        sortOrder: i,
        createdAt: new Date()
      });
    }
  }
}
```

### Page Service Updates

Add hierarchy support:

```typescript
// Add to PageService
async getPageWithChildren(id: string) {
  return this.db.query.pages.findFirst({
    where: eq(pages.id, id),
    with: {
      children: true,
      pageSections: { with: { sectionTemplate: true, contents: true } }
    }
  });
}

async getPageTree(environmentId: string) {
  // Get all pages, build tree structure
  const allPages = await this.db.query.pages.findMany({
    where: eq(pages.environmentId, environmentId)
  });

  return buildTree(allPages); // parentId → children recursion
}
```

---

## Tool Updates Required

### Navigation Tools

Update to use `NavigationService` instead of `SiteSettingsService`:

```typescript
// BEFORE (wrong)
const siteSettingsService = new SiteSettingsService(ctx.db);
const navItems = await siteSettingsService.getNavigationItems();

// AFTER (correct)
const navService = ctx.services.navigationService;
const navigations = await navService.getNavigations(ctx.environmentId);
```

### Section Template Tools

Rename references:

```typescript
// BEFORE
ctx.services.sectionService.getSectionDefByKey(key)

// AFTER
ctx.services.sectionService.getSectionTemplateByKey(key)
```

---

## Implementation Phases

### Phase 1: Schema Updates (Day 1)
- [ ] Rename `sectionDefinitions` → `section_templates`
- [ ] Rename `collectionDefinitions` → `collection_templates`
- [ ] Add `parent_id`, `is_protected` to pages
- [ ] Add `hidden` to page_sections
- [ ] Add `environment_locales` junction table
- [ ] Update all foreign key references

### Phase 2: Navigation Fix (Day 2)
- [ ] Create `NavigationService`
- [ ] Update navigation tools to use service
- [ ] Remove siteSettings-based navigation
- [ ] Update seed to use navigation tables

### Phase 3: Service Alignment (Day 3)
- [ ] Rename service methods (getSectionDef → getSectionTemplate)
- [ ] Add page hierarchy methods
- [ ] Add entry ordering methods

### Phase 4: Endpoint Alignment (Day 4)
- [ ] Ensure all endpoints match production paths
- [ ] Add missing endpoints (section publish, visibility, order)
- [ ] Add entry ordering endpoints

### Phase 5: Seed & Scripts (Day 5)
- [ ] Update seed.ts with new table names
- [ ] Create navigations with proper tables
- [ ] Add sample page hierarchy
- [ ] Test full flow

---

## Validation Checklist

After implementation, verify:

- [ ] `GET /v1/teams/{team}/sites/{site}/environments/{env}/pages` returns pages
- [ ] Pages can have parent/child relationships
- [ ] Section templates are named correctly
- [ ] Navigation uses proper tables (not siteSettings)
- [ ] Locales are scoped to environments
- [ ] All endpoints match production structure
- [ ] Seed creates valid test data

---

## Files to Modify

```
server/db/schema.ts
  - Rename tables and columns
  - Add new columns
  - Add environment_locales

server/services/cms/
  - section-service.ts → rename methods
  - page-service.ts → add hierarchy
  - navigation.service.ts → NEW (replace site-settings-service for nav)
  - site-settings-service.ts → remove navigation methods

server/tools/
  - all-tools.ts → update service calls
  - site-settings-tools.ts → update navigation tools

server/routes/cms.ts
  - Ensure production-aligned paths
  - Add missing endpoints

scripts/seed.ts
  - Use new table names
  - Create proper navigations
```

---

## Summary

**This refactor prioritizes production alignment over simplification.**

| Aspect | Previous Plan | Updated Plan |
|--------|---------------|--------------|
| Multi-tenant | Remove | **Keep** |
| Endpoint paths | Simplify | **Keep production paths** |
| Navigation | siteSettings JSON | **Proper tables** |
| Page hierarchy | Skip | **Add** |
| Naming | Various | **Align with production** |

The goal is to test real CMS complexity with the agent, enabling smooth migration to production once mature.
