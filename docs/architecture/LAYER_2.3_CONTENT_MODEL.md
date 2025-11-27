# Layer 2.3: Content Model Architecture

> Page-Section-Content tri-level structure with localization and flexible JSON content

## Overview

The content model separates **structure** (what sections exist on a page) from **content** (what's inside each section) and **definitions** (what fields a section type has). This enables:

- Reusable section templates across pages
- Per-locale content without duplicating structure
- Flexible JSON content that doesn't require schema migrations
- Order-preserving section arrangements

**Key Tables:**
- `sectionDefinitions` - Template blueprints (hero, feature, cta)
- `pages` - Page metadata and slug
- `pageSections` - Junction: which sections on which page, in what order
- `pageSectionContents` - Localized content for each section instance

---

## The Problem

Traditional CMS approaches have limitations:

**Approach 1: Fixed page schema**
```typescript
// Every page has same fields - inflexible
const pages = { title, heroImage, heroText, feature1, feature2, ... }
// Adding new section type = schema migration
```

**Approach 2: Free-form JSON**
```typescript
// Page content is unstructured blob - no validation
const pages = { content: JSON.stringify({ anything: goes }) }
// No way to enforce required fields or structure
```

**Our Solution:** Three-level architecture:
1. **Definitions** define allowed fields (schema)
2. **Sections** provide structure (which definitions, what order)
3. **Contents** hold actual values (per locale)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    DEFINITION LAYER (Global)                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  sectionDefinitions                      │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │    │
│  │  │  hero   │  │ feature │  │   cta   │  │ gallery │      │    │
│  │  │ schema  │  │ schema  │  │ schema  │  │ schema  │      │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │    │
│  └──────────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────────┤
│                    STRUCTURE LAYER (Per Page)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Page: "home" (slug)                                       │  │
│  │                                                            │  │
│  │  pageSections (ordered):                                   │  │
│  │  ┌───────────────────────────────────────────────────────┐ │  │
│  │  │ order=0 │ sectionDefId → hero    │ status=published   │ │  │
│  │  │ order=1 │ sectionDefId → feature │ status=published   │ │  │
│  │  │ order=2 │ sectionDefId → cta     │ status=unpublished │ │  │
│  │  └───────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│                    CONTENT LAYER (Per Locale)                    │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  pageSectionContents:                                     │   │
│  │                                                           │   │
│  │  Section[0] (hero):                                       │   │
│  │  ├─ locale=en: { title: "Welcome", subtitle: "..." }      │   │
│  │  └─ locale=de: { title: "Willkommen", subtitle: "..." }   │   │
│  │                                                           │   │
│  │  Section[1] (feature):                                    │   │
│  │  ├─ locale=en: { heading: "Features", items: [...] }      │   │
│  │  └─ locale=de: { heading: "Funktionen", items: [...] }    │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/db/schema.ts` | Table definitions (lines 60-175) |
| `server/services/cms/page-service.ts` | Page CRUD with sections |
| `server/services/cms/section-service.ts` | Section management |
| `scripts/seed.ts` | Example page creation (lines 500-750) |

---

## Core Implementation

### Section Definitions (Templates)

```typescript
// server/db/schema.ts
export const sectionDefinitions = sqliteTable("section_definitions", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),        // "hero", "feature", "cta"
  name: text("name").notNull(),               // "Hero Section"
  description: text("description"),
  status: text("status", { enum: ["published", "unpublished"] })
    .notNull()
    .default("published"),

  // JSON schema defining allowed fields
  elementsStructure: text("elements_structure", { mode: "json" }).notNull(),

  templateKey: text("template_key").notNull(), // Nunjucks template name
  defaultVariant: text("default_variant").notNull().default("default"),
  cssBundle: text("css_bundle"),               // Optional CSS path

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

**Elements Structure Example:**

```json
{
  "version": 1,
  "rows": [
    {
      "id": "row-1",
      "slots": [
        {
          "key": "title",
          "type": "text",
          "label": "Title",
          "dataRules": { "required": true }
        },
        {
          "key": "subtitle",
          "type": "text",
          "label": "Subtitle"
        },
        {
          "key": "image",
          "type": "image",
          "label": "Hero Image"
        },
        {
          "key": "ctaText",
          "type": "text",
          "label": "CTA Button Text"
        },
        {
          "key": "ctaLink",
          "type": "link",
          "label": "CTA Link",
          "dataRules": { "linkTargets": ["url", "page"] }
        }
      ]
    }
  ]
}
```

### Pages (Metadata)

```typescript
export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  environmentId: text("environment_id")
    .notNull()
    .references(() => environments.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),      // URL path segment
  name: text("name").notNull(),               // Display name
  indexing: integer("indexing", { mode: "boolean" }).notNull().default(true),
  meta: text("meta", { mode: "json" }),       // SEO metadata
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

### Page Sections (Junction + Order)

```typescript
export const pageSections = sqliteTable("page_sections", {
  id: text("id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  sectionDefId: text("section_def_id")
    .notNull()
    .references(() => sectionDefinitions.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull(), // 0, 1, 2, ...
  status: text("status", { enum: ["published", "unpublished"] })
    .notNull()
    .default("published"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

### Page Section Contents (Localized)

```typescript
export const pageSectionContents = sqliteTable("page_section_contents", {
  id: text("id").primaryKey(),
  pageSectionId: text("page_section_id")
    .notNull()
    .references(() => pageSections.id, { onDelete: "cascade" }),
  localeCode: text("locale_code")
    .notNull()
    .references(() => locales.code, { onDelete: "cascade" }),
  content: text("content", { mode: "json" }).notNull(), // Actual field values
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

**Content Example:**

```json
{
  "title": "Welcome to Our CMS",
  "subtitle": "AI-powered content management",
  "image": {
    "url": "/uploads/images/2025/11/23/original/hero.jpg",
    "alt": "Hero background"
  },
  "ctaText": "Get Started",
  "ctaLink": { "type": "url", "href": "/pages/contact?locale=en" }
}
```

### Relations for Query API

```typescript
export const pageSectionsRelations = relations(pageSections, ({ one, many }) => ({
  page: one(pages, {
    fields: [pageSections.pageId],
    references: [pages.id]
  }),
  sectionDefinition: one(sectionDefinitions, {
    fields: [pageSections.sectionDefId],
    references: [sectionDefinitions.id],
  }),
  contents: many(pageSectionContents),
}));

export const pageSectionContentsRelations = relations(pageSectionContents, ({ one }) => ({
  pageSection: one(pageSections, {
    fields: [pageSectionContents.pageSectionId],
    references: [pageSections.id],
  }),
  locale: one(locales, {
    fields: [pageSectionContents.localeCode],
    references: [locales.code],
  }),
}));
```

---

## Query Patterns

### Fetch Page with All Sections (Single Locale)

```typescript
// server/services/cms/page-service.ts
async getPageWithSections(pageId: string, locale: string = "en") {
  const page = await db.query.pages.findFirst({
    where: eq(pages.id, pageId),
    with: {
      pageSections: {
        with: {
          sectionDefinition: true,
          contents: {
            where: eq(pageSectionContents.localeCode, locale),
          },
        },
        orderBy: (sections, { asc }) => [asc(sections.sortOrder)],
      },
    },
  });

  return page;
}
```

**Result Shape:**

```typescript
{
  id: "page-uuid",
  slug: "home",
  name: "Homepage",
  pageSections: [
    {
      id: "section-uuid-1",
      sortOrder: 0,
      sectionDefinition: { key: "hero", name: "Hero Section", ... },
      contents: [
        { localeCode: "en", content: { title: "Welcome", ... } }
      ]
    },
    {
      id: "section-uuid-2",
      sortOrder: 1,
      sectionDefinition: { key: "feature", ... },
      contents: [...]
    }
  ]
}
```

### Create Page with Sections

```typescript
async createPage(
  siteId: string,
  envId: string,
  data: { name: string; slug: string; sections?: SectionInput[] }
) {
  return db.transaction(async (tx) => {
    // 1. Create page
    const [page] = await tx.insert(pages).values({
      id: randomUUID(),
      siteId,
      environmentId: envId,
      slug: data.slug,
      name: data.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // 2. Create sections with content
    if (data.sections) {
      for (let i = 0; i < data.sections.length; i++) {
        const section = data.sections[i];

        // Create page_section
        const [pageSection] = await tx.insert(pageSections).values({
          id: randomUUID(),
          pageId: page.id,
          sectionDefId: section.definitionId,
          sortOrder: i,
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();

        // Create content for each locale
        await tx.insert(pageSectionContents).values({
          id: randomUUID(),
          pageSectionId: pageSection.id,
          localeCode: section.locale || "en",
          content: section.content,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return page;
  });
}
```

### Reorder Sections

```typescript
async reorderSections(pageId: string, sectionIds: string[]) {
  return db.transaction(async (tx) => {
    for (let i = 0; i < sectionIds.length; i++) {
      await tx.update(pageSections)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(pageSections.id, sectionIds[i]));
    }
  });
}
```

---

## Collections (Blog/Entries)

The same pattern applies to collections (blog posts, products, etc.):

```typescript
// Definition
export const collectionDefinitions = sqliteTable("collection_definitions", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),      // "blog", "products"
  name: text("name").notNull(),
  elementsStructure: text("elements_structure", { mode: "json" }).notNull(),
  // ...
});

// Entry (like a page)
export const collectionEntries = sqliteTable("collection_entries", {
  id: text("id").primaryKey(),
  collectionId: text("collection_id")
    .references(() => collectionDefinitions.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  status: text("status", { enum: ["draft", "published", "archived"] }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  author: text("author"),
  excerpt: text("excerpt"),
  featuredImage: text("featured_image"),
  category: text("category"),
  // ...
});

// Localized content
export const entryContents = sqliteTable("entry_contents", {
  id: text("id").primaryKey(),
  entryId: text("entry_id")
    .references(() => collectionEntries.id, { onDelete: "cascade" }),
  localeCode: text("locale_code")
    .references(() => locales.code, { onDelete: "cascade" }),
  content: text("content", { mode: "json" }).notNull(),
  // ...
});
```

---

## Design Decisions

### Why JSON Content vs. Normalized Tables?

**Option A: Normalized (rejected)**
```sql
CREATE TABLE section_field_values (
  section_id TEXT,
  field_key TEXT,
  field_value TEXT
);
-- Querying a section = N queries for N fields
```

**Option B: JSON blob (chosen)**
```sql
CREATE TABLE page_section_contents (
  content TEXT -- JSON: {"title": "...", "image": {...}}
);
-- Querying a section = 1 query, parse JSON
```

**Reasons:**
1. **Read performance** - Single row fetch vs. many joins
2. **Flexibility** - Add fields without migration
3. **Atomicity** - Update entire content in one operation
4. **Trade-off** - Can't efficiently query "all sections where title contains X"

### Why Separate Structure from Content?

Having `pageSections` separate from `pageSectionContents`:

1. **Localization** - Same structure, different content per locale
2. **Status** - Hide/show section without touching content
3. **Ordering** - Change order without duplicating content

### Why RESTRICT on Section Definitions?

```typescript
.references(() => sectionDefinitions.id, { onDelete: "restrict" })
```

If a section definition (hero template) is in use, you can't delete it:
- Prevents orphaned sections with no template
- Forces explicit migration: remove sections first, then definition

### Why sortOrder Integer vs. Linked List?

**Option A: Linked list**
```typescript
nextSectionId: text("next_section_id") // Each points to next
```

**Option B: Integer order (chosen)**
```typescript
sortOrder: integer("sort_order") // 0, 1, 2, 3, ...
```

**Reasons:**
1. **Simplicity** - No complex pointer management
2. **Bulk reorder** - Update all at once with indices
3. **Gap-tolerance** - Order 0, 5, 10 still works

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 2.2 (Hierarchy) | Pages scoped to site/environment |
| Layer 2.4 (Images) | Content JSON references image URLs |
| Layer 4 (Services) | PageService, SectionService wrap queries |
| Layer 7 (Rendering) | Templates use sectionDefinition.templateKey |

### Rendering Flow

```
Request: GET /pages/home?locale=en
    │
    ▼
PageService.getPageWithSections("home", "en")
    │
    ▼
For each pageSection:
    │
    ├─ Get sectionDefinition.templateKey → "hero"
    ├─ Get content[locale=en] → { title: "Welcome", ... }
    │
    ▼
Nunjucks renders:
    templates/sections/hero.njk + content
```

---

## Common Issues / Debugging

### Section Content Empty

```typescript
const page = await getPageWithSections(pageId, "en");
page.pageSections[0].contents; // []
```

**Causes:**
1. No content row for that locale
2. Wrong locale code (case-sensitive: "en" vs "EN")

**Debug:**

```typescript
const allContents = await db.select()
  .from(pageSectionContents)
  .where(eq(pageSectionContents.pageSectionId, sectionId));
console.log('Available locales:', allContents.map(c => c.localeCode));
```

### Section Order Wrong

```typescript
// Sections appear in wrong order
page.pageSections // [feature, hero, cta] instead of [hero, feature, cta]
```

**Cause:** Query missing `orderBy`:

```typescript
// WRONG
pageSections: true

// RIGHT
pageSections: {
  orderBy: (sections, { asc }) => [asc(sections.sortOrder)],
}
```

### Can't Delete Section Definition

```
Error: FOREIGN KEY constraint failed (RESTRICT)
```

**Cause:** Sections still reference this definition.

**Fix:** Delete referencing sections first:

```typescript
// Find and delete dependent sections
await db.delete(pageSections)
  .where(eq(pageSections.sectionDefId, definitionId));

// Now safe to delete definition
await db.delete(sectionDefinitions)
  .where(eq(sectionDefinitions.id, definitionId));
```

### JSON Content Type Errors

```typescript
// TypeScript doesn't know content shape
const title = section.contents[0].content.title;
// Error: Property 'title' does not exist on type 'unknown'
```

**Fix:** Type assertion or interface:

```typescript
interface HeroContent {
  title: string;
  subtitle?: string;
  image?: { url: string; alt?: string };
}

const content = section.contents[0].content as HeroContent;
content.title; // ✅ string
```

---

## Further Reading

- [Layer 2.1: Drizzle ORM](./LAYER_2.1_DRIZZLE_ORM.md) - Schema patterns
- [Layer 2.2: Entity Hierarchy](./LAYER_2.2_ENTITY_HIERARCHY.md) - Ownership model
- [Layer 2.4: Image Storage](./LAYER_2.4_IMAGE_STORAGE.md) - Image content pattern
- [Layer 7: Rendering](./LAYER_7_RENDERING.md) - How content becomes HTML
- [Layer 4: Services](./LAYER_4_SERVICES.md) - PageService, SectionService
