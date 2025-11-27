# Layer 4.1: CMS Services

> Page, Section, and Entry services with CRUD operations and automatic vector indexing

## Overview

The CMS services (PageService, SectionService, EntryService) handle all content management operations. Each service encapsulates CRUD logic for its entity type, automatically indexes content in the vector store for semantic search, and provides granular fetching options to minimize token usage when consumed by the agent.

**Key Responsibilities:**
- CRUD operations for pages, sections, and collection entries
- Slug/key validation with consistent regex patterns
- Automatic vector indexing on create/update
- JSON content parsing and serialization
- Granular fetching with `includeContent` flags

---

## The Problem

Without dedicated services, content management code becomes scattered:

```typescript
// WRONG: Logic mixed in routes
router.post("/pages", async (req, res) => {
  // Validation scattered across routes
  if (!/^[a-z0-9-]+$/.test(req.body.slug)) {
    return res.status(400).json({ error: "Invalid slug" });
  }

  // Direct DB access everywhere
  const page = await db.insert(pages).values({...});

  // Forgot to index for search!

  res.json(page);
});

// WRONG: No deduplication checking
// WRONG: Inconsistent error messages
// WRONG: No vector indexing
```

**Our Solution:**
1. Dedicated service classes with injected dependencies
2. Centralized validation with consistent error messages
3. Automatic vector indexing on all mutations
4. Granular content fetching to reduce token usage

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CMS SERVICES                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   ServiceContainer                       │    │
│  │                                                          │    │
│  │  pageService = new PageService(db, vectorIndex)         │    │
│  │  sectionService = new SectionService(db, vectorIndex)   │    │
│  │  entryService = new EntryService(db, vectorIndex)       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌───────────────────┬───────────────────┬──────────────────┐   │
│  │    PageService    │  SectionService   │   EntryService   │   │
│  ├───────────────────┼───────────────────┼──────────────────┤   │
│  │ createPage()      │ createSectionDef()│ createCollDef()  │   │
│  │ updatePage()      │ updateSectionDef()│ upsertEntry()    │   │
│  │ getPageById()     │ addSectionToPage()│ publishEntry()   │   │
│  │ getPageBySlug()   │ syncPageContents()│ archiveEntry()   │   │
│  │ listPages()       │ getSectionContent()│ getEntryBySlug()│   │
│  │ deletePage()      │ deleteSectionDef()│ deleteEntry()    │   │
│  └────────┬──────────┴────────┬──────────┴────────┬─────────┘   │
│           │                   │                   │              │
│           ▼                   ▼                   ▼              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    VectorIndexService                    │    │
│  │                                                          │    │
│  │  add({ id, type, name, slug, searchableText })          │    │
│  │  update(id, { ... })                                     │    │
│  │  delete(id)                                              │    │
│  │  search(query, type?, limit?)                            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/cms/page-service.ts` | Page CRUD with section relations |
| `server/services/cms/section-service.ts` | Section definitions and page sections |
| `server/services/cms/entry-service.ts` | Collection definitions and entries |
| `server/services/cms/site-settings-service.ts` | Global site configuration |
| `server/services/vector-index.ts` | Semantic search indexing |

---

## Core Implementation

### PageService

```typescript
// server/services/cms/page-service.ts
export class PageService {
  constructor(
    public db: DrizzleDB,
    private vectorIndex: VectorIndexService
  ) {}

  async createPage(input: CreatePageInput) {
    // 1. Validate slug format
    this.validateSlug(input.slug);

    // 2. Check uniqueness
    const existing = await this.db.query.pages.findFirst({
      where: eq(schema.pages.slug, input.slug),
    });
    if (existing) {
      throw new Error(`Page with slug '${input.slug}' already exists`);
    }

    // 3. Create page
    const page = {
      id: randomUUID(),
      siteId: input.siteId,
      environmentId: input.environmentId,
      slug: input.slug,
      name: input.name,
      indexing: input.indexing ?? true,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.pages).values(page);

    // 4. Index for semantic search
    await this.vectorIndex.add({
      id: page.id,
      type: "page",
      name: page.name,
      slug: page.slug,
      searchableText: `${page.name} ${page.slug}`,
      metadata: { siteId: page.siteId },
    });

    return page;
  }

  async updatePage(id: string, input: UpdatePageInput) {
    const original = await this.getPageById(id);
    if (!original) {
      throw new Error("Page not found");
    }

    if (input.slug) {
      this.validateSlug(input.slug);
      // Check uniqueness (excluding current)
      const existing = await this.db.query.pages.findFirst({
        where: eq(schema.pages.slug, input.slug),
      });
      if (existing && existing.id !== id) {
        throw new Error(`Page with slug '${input.slug}' already exists`);
      }
    }

    await this.db.update(schema.pages)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schema.pages.id, id));

    // Re-index if name/slug changed
    if (input.name !== original.name || input.slug !== original.slug) {
      await this.vectorIndex.update(id, {
        type: "page",
        name: input.name || original.name,
        slug: input.slug || original.slug,
        searchableText: `${input.name || original.name} ${input.slug || original.slug}`,
        metadata: { siteId: original.siteId },
      });
    }

    return this.getPageById(id);
  }

  async getPageBySlug(slug: string, includeContent = false, localeCode = "en") {
    if (!includeContent) {
      // Lightweight - only metadata and section IDs
      const page = await this.db.query.pages.findFirst({
        where: eq(schema.pages.slug, slug),
        with: {
          pageSections: {
            with: { sectionDefinition: true },
            orderBy: (ps, { asc }) => [asc(ps.sortOrder)],
          },
        },
      });

      if (!page) return null;

      return {
        ...page,
        sectionIds: page.pageSections?.map(ps => ps.id) || [],
        sectionCount: page.pageSections?.length || 0,
      };
    }

    // Full fetch - includes all content
    const page = await this.db.query.pages.findFirst({
      where: eq(schema.pages.slug, slug),
      with: {
        pageSections: {
          with: {
            sectionDefinition: true,
            contents: true,
          },
          orderBy: (ps, { asc }) => [asc(ps.sortOrder)],
        },
      },
    });

    if (!page) return null;

    // Format sections with parsed content
    return {
      ...page,
      pageSections: page.pageSections?.map(ps => {
        const contentRecord = ps.contents?.find(c => c.localeCode === localeCode);
        let parsedContent = {};
        if (contentRecord?.content) {
          try {
            parsedContent = typeof contentRecord.content === "string"
              ? JSON.parse(contentRecord.content)
              : contentRecord.content;
          } catch (error) {
            console.error(`Failed to parse content for section ${ps.id}`);
          }
        }
        return { ...ps, content: parsedContent };
      }),
    };
  }

  async deletePage(id: string) {
    await this.db.delete(schema.pages).where(eq(schema.pages.id, id));
    await this.vectorIndex.delete(id);
  }

  private validateSlug(slug: string): void {
    if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
      throw new Error(
        "Invalid slug format: must be lowercase, alphanumeric with hyphens, 2-64 chars"
      );
    }
  }
}
```

### SectionService

```typescript
// server/services/cms/section-service.ts
export class SectionService {
  constructor(
    private db: DrizzleDB,
    private vectorIndex: VectorIndexService
  ) {}

  async createSectionDef(input: CreateSectionDefInput) {
    this.validateKey(input.key);

    const existing = await this.db.query.sectionDefinitions.findFirst({
      where: eq(schema.sectionDefinitions.key, input.key),
    });
    if (existing) {
      throw new Error(`Section definition with key '${input.key}' already exists`);
    }

    const sectionDef = {
      id: randomUUID(),
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "published",
      elementsStructure: JSON.stringify(input.elementsStructure),
      templateKey: input.templateKey,
      defaultVariant: input.defaultVariant ?? "default",
      cssBundle: input.cssBundle ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.sectionDefinitions).values(sectionDef);

    // Index for search
    await this.vectorIndex.add({
      id: sectionDef.id,
      type: "section_def",
      name: sectionDef.name,
      slug: sectionDef.key,
      searchableText: `${sectionDef.name} ${sectionDef.key} ${sectionDef.description || ""}`,
      metadata: { templateKey: sectionDef.templateKey },
    });

    return sectionDef;
  }

  async addSectionToPage(input: AddSectionToPageInput) {
    // Verify page exists
    const page = await this.db.query.pages.findFirst({
      where: eq(schema.pages.id, input.pageId),
    });
    if (!page) {
      throw new Error(`Page with id '${input.pageId}' not found`);
    }

    // Verify section definition exists
    const sectionDef = await this.db.query.sectionDefinitions.findFirst({
      where: eq(schema.sectionDefinitions.id, input.sectionDefId),
    });
    if (!sectionDef) {
      throw new Error(`Section definition with id '${input.sectionDefId}' not found`);
    }

    // Auto-determine sort order
    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const existingSections = await this.db.query.pageSections.findMany({
        where: eq(schema.pageSections.pageId, input.pageId),
      });
      sortOrder = existingSections.length;
    }

    const pageSectionId = randomUUID();
    const pageSection = {
      id: pageSectionId,
      pageId: input.pageId,
      sectionDefId: input.sectionDefId,
      sortOrder,
      status: input.status ?? "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.pageSections).values(pageSection);

    // Create empty content for default locale
    await this.db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId,
      localeCode: 'en',
      content: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return pageSection;
  }

  async syncPageContents(input: SyncPageContentsInput) {
    // Verify page section exists
    const pageSection = await this.db.query.pageSections.findFirst({
      where: eq(schema.pageSections.id, input.pageSectionId),
    });
    if (!pageSection) {
      throw new Error(`Page section with id '${input.pageSectionId}' not found`);
    }

    // Normalize link fields (string → object)
    const normalizedContent = this.normalizeLinksInContent(input.content);

    // Upsert content
    const existing = await this.db.query.pageSectionContents.findFirst({
      where: (psc, { and, eq }) =>
        and(
          eq(psc.pageSectionId, input.pageSectionId),
          eq(psc.localeCode, input.localeCode)
        ),
    });

    if (existing) {
      await this.db.update(schema.pageSectionContents)
        .set({
          content: JSON.stringify(normalizedContent),
          updatedAt: new Date(),
        })
        .where(eq(schema.pageSectionContents.id, existing.id));
      return { ...existing, content: normalizedContent };
    } else {
      const newContent = {
        id: randomUUID(),
        pageSectionId: input.pageSectionId,
        localeCode: input.localeCode,
        content: JSON.stringify(normalizedContent),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.db.insert(schema.pageSectionContents).values(newContent);
      return newContent;
    }
  }

  private normalizeLinksInContent(content: Record<string, any>) {
    const normalized = { ...content };
    for (const key in normalized) {
      const value = normalized[key];
      // Convert string links to object format
      if ((key.endsWith("Link") || key.endsWith("Href")) && typeof value === "string") {
        normalized[key] = { href: value, type: "url" };
      }
    }
    return normalized;
  }
}
```

### EntryService

```typescript
// server/services/cms/entry-service.ts
export class EntryService {
  constructor(
    private db: DrizzleDB,
    private vectorIndex: VectorIndexService
  ) {}

  async upsertEntry(input: UpsertEntryInput) {
    this.validateSlug(input.slug);

    // Verify collection exists
    const collection = await this.db.query.collectionDefinitions.findFirst({
      where: eq(schema.collectionDefinitions.id, input.collectionId),
    });
    if (!collection) {
      throw new Error(`Collection with id '${input.collectionId}' not found`);
    }

    // Check if entry exists
    let entry = await this.db.query.collectionEntries.findFirst({
      where: eq(schema.collectionEntries.slug, input.slug),
    });

    const isNew = !entry;

    if (!entry) {
      // Create new entry
      entry = {
        id: randomUUID(),
        collectionId: input.collectionId,
        slug: input.slug,
        title: input.title,
        status: "draft",
        author: input.author ?? null,
        excerpt: input.excerpt ?? null,
        featuredImage: input.featuredImage ?? null,
        category: input.category ?? null,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.db.insert(schema.collectionEntries).values(entry);
    } else {
      // Update existing
      await this.db.update(schema.collectionEntries)
        .set({
          title: input.title,
          author: input.author,
          excerpt: input.excerpt,
          featuredImage: input.featuredImage,
          category: input.category,
          updatedAt: new Date(),
        })
        .where(eq(schema.collectionEntries.id, entry.id));
    }

    // Upsert content
    const existingContent = await this.db.query.entryContents.findFirst({
      where: (ec, { and, eq }) =>
        and(eq(ec.entryId, entry.id), eq(ec.localeCode, input.localeCode)),
    });

    if (existingContent) {
      await this.db.update(schema.entryContents)
        .set({
          content: JSON.stringify(input.content),
          updatedAt: new Date(),
        })
        .where(eq(schema.entryContents.id, existingContent.id));
    } else {
      await this.db.insert(schema.entryContents).values({
        id: randomUUID(),
        entryId: entry.id,
        localeCode: input.localeCode,
        content: JSON.stringify(input.content),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Index only on create
    if (isNew) {
      await this.vectorIndex.add({
        id: entry.id,
        type: "entry",
        name: entry.title,
        slug: entry.slug,
        searchableText: `${entry.title} ${entry.slug}`,
        metadata: { collectionId: entry.collectionId },
      });
    }

    return entry;
  }

  async publishEntry(id: string) {
    const entry = await this.db.query.collectionEntries.findFirst({
      where: eq(schema.collectionEntries.id, id),
    });
    if (!entry) {
      throw new Error(`Entry with id '${id}' not found`);
    }

    const updateData = {
      status: "published",
      updatedAt: new Date(),
      publishedAt: entry.publishedAt || new Date(), // Set only if not already set
    };

    await this.db.update(schema.collectionEntries)
      .set(updateData)
      .where(eq(schema.collectionEntries.id, id));

    return this.getEntryById(id);
  }

  async getEntryBySlug(slug: string, localeCode = 'en') {
    const entry = await this.db.query.collectionEntries.findFirst({
      where: eq(schema.collectionEntries.slug, slug),
      with: {
        contents: {
          where: eq(schema.entryContents.localeCode, localeCode),
        },
        collection: true,
      },
    });

    if (!entry) return null;

    // Parse content
    const contentRecord = entry.contents?.[0];
    let parsedContent = {};
    if (contentRecord?.content) {
      try {
        parsedContent = typeof contentRecord.content === 'string'
          ? JSON.parse(contentRecord.content)
          : contentRecord.content;
      } catch (error) {
        console.error(`Failed to parse content for entry ${entry.id}`);
      }
    }

    return { ...entry, content: parsedContent };
  }
}
```

---

## Design Decisions

### Why Constructor Injection?

```typescript
// Option A: Service accesses global db
class PageService {
  async createPage(input) {
    await globalDb.insert(pages).values(...);
  }
}

// Option B: Constructor injection (chosen)
class PageService {
  constructor(public db: DrizzleDB, private vectorIndex: VectorIndexService) {}

  async createPage(input) {
    await this.db.insert(pages).values(...);
  }
}
```

**Reasons:**
1. **Testability** - Can inject mock DB for testing
2. **Explicit dependencies** - Clear what service needs
3. **No hidden globals** - Dependencies visible in constructor
4. **VectorIndex coordination** - Same instance across services

### Why Automatic Vector Indexing?

```typescript
// After every create/update
await this.vectorIndex.add({
  id: page.id,
  type: "page",
  name: page.name,
  slug: page.slug,
  searchableText: `${page.name} ${page.slug}`,
  metadata: { siteId: page.siteId },
});
```

**Reasons:**
1. **Semantic search** - Agent can find pages by natural language
2. **No separate step** - Can't forget to index
3. **Consistency** - DB and vector store always in sync
4. **Type filtering** - Search by entity type

### Why Granular Fetching?

```typescript
// Lightweight fetch (default)
const page = await getPageBySlug("home", false);
// Returns: { id, name, slug, sectionIds, sectionCount }

// Full fetch (when needed)
const page = await getPageBySlug("home", true);
// Returns: { id, name, slug, pageSections: [{ content: {...} }] }
```

**Reasons:**
1. **Token efficiency** - Agent doesn't need full content for listing
2. **Two-phase fetching** - List first, fetch details on demand
3. **Performance** - Avoid loading JSON blobs when not needed

### Why Link Normalization?

```typescript
// Input: string
{ ctaLink: "/about" }

// Normalized: object
{ ctaLink: { href: "/about", type: "url" } }
```

**Reasons:**
1. **Template consistency** - Templates expect object format
2. **Extensibility** - Can add link type, target, etc.
3. **Agent-friendly** - Agent can pass simple strings

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1.2 (Container) | Instantiated in ServiceContainer |
| Layer 2.1 (Drizzle) | All DB operations via Drizzle ORM |
| Layer 4.3 (Vector Index) | Auto-index on mutations |
| Layer 3.2 (Tools) | Tools call service methods |
| Layer 1.5 (Routes) | Routes delegate to services |

### Tool Integration Example

```typescript
// server/tools/page-tools.ts
export const createPageTool = createTool({
  name: "create_page",
  description: "Create a new page",
  parameters: z.object({
    name: z.string(),
    slug: z.string(),
  }),
  execute: async (input, context) => {
    const page = await context.services.pageService.createPage({
      ...input,
      siteId: context.cmsTarget.siteId,
      environmentId: context.cmsTarget.environmentId,
    });
    return { success: true, page };
  },
});
```

---

## Common Issues / Debugging

### Slug Already Exists

```
Error: Page with slug 'home' already exists
```

**Cause:** Attempting to create duplicate slug.

**Fix:** Use different slug or update existing:

```typescript
// Check first
const existing = await pageService.getPageBySlug("home");
if (existing) {
  await pageService.updatePage(existing.id, { name: "New Name" });
} else {
  await pageService.createPage({ slug: "home", name: "Home" });
}
```

### Invalid Slug Format

```
Error: Invalid slug format: must be lowercase, alphanumeric with hyphens, 2-64 chars
```

**Cause:** Slug contains invalid characters.

**Valid Examples:**
- `home` ✓
- `about-us` ✓
- `blog-post-123` ✓

**Invalid Examples:**
- `Home` ✗ (uppercase)
- `about us` ✗ (space)
- `a` ✗ (too short)

### Content Not Found for Locale

```json
{
  "content": {},
  "message": "No content found for this locale"
}
```

**Cause:** Content not synced for requested locale.

**Fix:** Sync content first:

```typescript
await sectionService.syncPageContents({
  pageSectionId: "...",
  localeCode: "en",
  content: { heading: "Hello" },
});
```

### Vector Index Out of Sync

```
// Page exists in DB but not found by semantic search
```

**Cause:** Page created before vector indexing was added, or indexing failed.

**Fix:** Re-index manually:

```typescript
const page = await pageService.getPageById(id);
await vectorIndex.add({
  id: page.id,
  type: "page",
  name: page.name,
  slug: page.slug,
  searchableText: `${page.name} ${page.slug}`,
  metadata: { siteId: page.siteId },
});
```

---

## Further Reading

- [Layer 1.2: Service Container](./LAYER_1.2_SERVICE_CONTAINER.md) - How services are initialized
- [Layer 2.3: Content Model](./LAYER_2.3_CONTENT_MODEL.md) - Page-Section-Content architecture
- [Layer 4.3: Vector Index](./LAYER_4.3_VECTOR_INDEX.md) - Semantic search details
- [Layer 3.2: Tools](./LAYER_3.2_TOOLS.md) - How agent uses services
