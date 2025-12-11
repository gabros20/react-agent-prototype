# Atomic CRUD Tool Architecture Plan

## Status: Draft
## Date: 2025-12-10
## Next Phase: [DATABASE_ENDPOINT_REFACTOR.md](./DATABASE_ENDPOINT_REFACTOR.md)

---

## Executive Summary

Current tool inventory: **45 tools** with significant redundancy and inconsistent patterns. This plan consolidates to **~25 atomic CRUD tools** using:
- Entity-centric naming: `getPage`, `createPost`, `updateSection`
- Parameter-based scope: single/batch/all via params, not separate tools
- Semantic external tool names: `browseImages`, `importImage`
- Three-layer instruction architecture: Rules → Workflows → Hints

---

## Current State Analysis

### Tool Inventory by Entity (45 tools)

| Entity | Current Tools | Redundancy Issues |
|--------|--------------|-------------------|
| **Pages** (6) | cms_getPage, cms_createPage, cms_createPageWithContent, cms_updatePage, cms_deletePage, cms_listPages | `listPages` overlaps `getPage(all)`; composite `createPageWithContent` |
| **Sections** (8) | cms_listSectionTemplates, cms_getSectionFields, cms_addSectionToPage, cms_updateSectionContent, cms_deletePageSection, cms_deletePageSections, cms_getPageSections, cms_getSectionContent | Single vs batch delete; multiple content tools |
| **Images** (7) | cms_findImage, cms_searchImages, cms_listAllImages, cms_addImageToSection, cms_updateSectionImage, cms_replaceImage, cms_deleteImage | Three overlapping get tools; two overlapping update tools |
| **Navigation** (5) | cms_getNavigation, cms_addNavigationItem, cms_updateNavigationItem, cms_removeNavigationItem, cms_toggleNavigationItem | `toggle` = `update` with `visible` |
| **Posts** (7) | cms_createPost, cms_updatePost, cms_publishPost, cms_archivePost, cms_deletePost, cms_listPosts, cms_getPost | `publish`/`archive` = `update` with status |
| **Entries** (2) | cms_getCollectionEntries, cms_getEntryContent | Missing CRUD |
| **External** (9) | pexels_*, unsplash_*, web_* | Duplicated patterns across providers |
| **Core** (3) | tool_search, final_answer, acknowledge | Keep as-is |

---

## Naming Decisions

### Decision 1: Drop `cms_` Prefix

**Before**: `cms_getPage`, `cms_createPost`, `cms_updateSection`
**After**: `getPage`, `createPost`, `updateSection`

**Reasoning**:

| Factor | With `cms_` | Without `cms_` |
|--------|------------|----------------|
| **Context clarity** | Explicit namespace | Agent IS the CMS - context is implicit |
| **Token efficiency** | +4 chars per call | Saves ~4 tokens per tool call |
| **Readability** | `cms_getPage` | `getPage` (cleaner) |
| **Tool discovery** | Search "cms" finds all | Search entity name "page" finds page tools |
| **Conflict risk** | Low - CMS-only agent | Low - prefix other domains if needed |

**Conclusion**: Drop `cms_` for CMS tools. Keep prefixes only for truly different domains:
- CMS: `getPage`, `createPost` (no prefix)
- Web research: `searchWeb` (verb+domain)
- HTTP: `httpGet`, `httpPost` (protocol prefix)

---

### Decision 2: External Image Naming

**Problem**: "Stock photo" is provider-centric. Users say "find me an image" not "search Pexels".

**Options Considered**:

| Option | Search Tool | Download Tool | Pros | Cons |
|--------|-------------|---------------|------|------|
| A | `searchStockPhoto` | `downloadStockPhoto` | Provider-clear | Jargon; "stock" is business term |
| B | `searchExternalImage` | `downloadExternalImage` | Technical accuracy | Verbose; "external" unclear to users |
| C | `browseImages` | `importImage` | User-friendly verbs | Could confuse with local `getImage` |
| D | `findOnlineImage` | `importImage` | Natural language | "Online" redundant for web search |
| E | `searchImageLibrary` | `importImage` | Abstract provider | "Library" suggests local storage |

**Decision**: Option C with disambiguation

```
getImage({ id?, query?, all? })           → Search LOCAL images
browseImages({ query, provider?, ... })   → Search EXTERNAL (Pexels/Unsplash)
importImage({ provider, photoId })        → Download external → local
```

**Why "browse" + "import"**:
- **browse** = looking through a catalog (implies external source)
- **import** = bringing something into the system (clear direction)
- Users say: "browse for images", "import that one"
- Clear distinction from `getImage` (local) vs `browseImages` (external)

---

### Decision 3: Consistent CRUD Verbs

| Operation | Verb | Examples |
|-----------|------|----------|
| Read one/many/all | `get*` | `getPage`, `getPost`, `getImage`, `getSection` |
| Create | `create*` | `createPage`, `createPost`, `createSection` |
| Update | `update*` | `updatePage`, `updatePost`, `updateSection` |
| Delete | `delete*` | `deletePage`, `deletePost`, `deleteSection` |
| Search external | `browse*` / `search*` | `browseImages`, `searchWeb` |
| Import external | `import*` | `importImage` |

---

## Final Tool Inventory (33 tools)

### Tool Categories

```
┌─────────────────────────────────────────────────────────────┐
│  DEFAULT TOOLS (Always Available)                            │
│  searchTools, acknowledgeRequest, finalAnswer                │
│  Core agent behavior - never filtered out                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  INTERNAL TOOLS (CMS Operations)                             │
│  Pages, Sections, Images, Posts, Navigation, Entries         │
│  Operate on local CMS data                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  EXTERNAL TOOLS (Remote APIs)                                │
│  browseImages, importImage, searchWeb, fetchContent, http*   │
│  Interact with external services                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Default Tools (3)

Always available. Core agent behavior.

| Tool | Description |
|------|-------------|
| `searchTools` | Discover available tools by capability keywords. |
| `acknowledgeRequest` | Signal understanding of user request before executing. |
| `finalAnswer` | Present final answer to user. Completes the task. |

**Lifecycle:**
```
acknowledgeRequest → [internal/external tools] → finalAnswer
```

---

## Internal Tools (24)

### Pages (4 tools)

| Tool | Signature | Description |
|------|-----------|-------------|
| `getPage` | `{ id?, slug?, all?, includeContent? }` | Get single by id/slug, or all. Default lightweight. |
| `createPage` | `{ name, slug, meta?, indexing? }` | Create empty page. Add sections separately. |
| `updatePage` | `{ id, name?, slug?, meta?, indexing? }` | Update page metadata. |
| `deletePage` | `{ ids: string[], confirmed }` | Delete page(s). Cascades to sections. |

**Scope Selection Pattern**:
```typescript
// Single by ID
getPage({ id: "uuid" })

// Single by slug
getPage({ slug: "about" })

// All pages
getPage({ all: true })

// With full content (expensive)
getPage({ slug: "about", includeContent: true })
```

---

### Sections (5 tools)

| Tool | Signature | Description |
|------|-----------|-------------|
| `getSectionTemplate` | `{ id?, key?, all? }` | Get section template(s). Shows available types and fields. |
| `getSection` | `{ pageSectionId?, pageId?, includeContent? }` | Get section(s) on a page. |
| `createSection` | `{ pageId, templateKey, content?, sortOrder? }` | Add section to page. Returns pageSectionId. |
| `updateSection` | `{ pageSectionId, content?, imageId?, imageField? }` | Update content or attach image. Merges with existing. |
| `deleteSection` | `{ ids: string[], confirmed }` | Delete section(s). Always array, even for single. |

**Unified Image Attachment**:
```typescript
// Update text content
updateSection({ pageSectionId: "uuid", content: { title: "New Title" } })

// Attach image to field
updateSection({ pageSectionId: "uuid", imageId: "img-uuid", imageField: "backgroundImage" })

// Both at once
updateSection({
  pageSectionId: "uuid",
  content: { title: "New Title" },
  imageId: "img-uuid",
  imageField: "backgroundImage"
})
```

---

### Images (4 tools)

| Tool | Signature | Description |
|------|-----------|-------------|
| `getImage` | `{ id?, query?, all?, limit?, status? }` | Local images: by ID, semantic search, or list all. |
| `createImage` | `{ buffer, filename, sessionId }` | Upload new image. Returns imageId after processing. |
| `updateImage` | `{ id, description?, tags?, categories? }` | Update image metadata. |
| `deleteImage` | `{ ids: string[], confirmed }` | Delete image(s) permanently. |

**Unified Get Pattern**:
```typescript
// Single by ID
getImage({ id: "uuid" })

// Semantic search (replaces findImage + searchImages)
getImage({ query: "mountain landscape sunset" })

// List all (replaces listAllImages)
getImage({ all: true, limit: 50 })

// Filter by status
getImage({ all: true, status: "completed" })
```

---

### Posts (4 tools)

| Tool | Signature | Description |
|------|-----------|-------------|
| `getPost` | `{ slug?, collectionSlug?, status?, category?, all? }` | Get single or list with filters. |
| `createPost` | `{ collectionSlug, slug, title, content, author?, excerpt? }` | Create draft post. |
| `updatePost` | `{ slug, title?, content?, status?, category?, author? }` | Update post. Set status to publish/archive. |
| `deletePost` | `{ slugs: string[], confirmed }` | Delete post(s) permanently. |

**Status Changes via Update**:
```typescript
// Publish (replaces cms_publishPost)
updatePost({ slug: "my-post", status: "published", confirmed: true })

// Archive (replaces cms_archivePost)
updatePost({ slug: "my-post", status: "archived", confirmed: true })

// Update content
updatePost({ slug: "my-post", content: { body: "Updated..." } })

// Update with cover image
updatePost({
  slug: "my-post",
  content: { cover: { url: "/uploads/...", alt: "..." } },
  featuredImage: "/uploads/..."  // Both fields for compatibility
})
```

---

### Navigation (4 tools)

| Tool | Signature | Description |
|------|-----------|-------------|
| `getNavItem` | `{ label?, all? }` | Get one by label or all navigation items. |
| `createNavItem` | `{ label, href, location }` | Add navigation item. Max 5 items. |
| `updateNavItem` | `{ label, newLabel?, href?, location?, visible? }` | Update item. Set visible:false to hide. |
| `deleteNavItem` | `{ labels: string[] }` | Remove navigation item(s). |

**Visibility via Update**:
```typescript
// Toggle visibility (replaces cms_toggleNavigationItem)
updateNavItem({ label: "About", visible: false })

// Change location
updateNavItem({ label: "About", location: "footer" })
```

---

### Entries (3 tools)

| Tool | Signature | Description |
|------|-----------|-------------|
| `getEntry` | `{ id?, collectionId?, all?, includeContent? }` | Get entry or list from collection. |
| `createEntry` | `{ collectionId, slug, title, content }` | Create collection entry. |
| `updateEntry` | `{ id, title?, content?, status? }` | Update entry. |

---

## External Tools (6)

### Image Sourcing (2 tools)

| Tool | Signature | Description |
|------|-----------|-------------|
| `browseImages` | `{ query, provider?, orientation?, color?, limit? }` | Search Pexels/Unsplash. Returns preview URLs and IDs. |
| `importImage` | `{ provider, photoId }` | Download to local system. Returns local imageId and URL. |

**Provider Selection**:
```typescript
// Search any provider (default: both)
browseImages({ query: "modern office workspace" })

// Specific provider
browseImages({ query: "nature", provider: "unsplash" })

// With filters
browseImages({
  query: "team meeting",
  provider: "pexels",
  orientation: "landscape",
  color: "blue"
})

// Import selected photo
importImage({ provider: "pexels", photoId: 12345678 })
```

---

### Web Research (2 tools)

| Tool | Signature | Description |
|------|-----------|-------------|
| `searchWeb` | `{ query, mode, numResults?, topic?, urls? }` | Quick search or deep research. Fetch URLs. |
| `fetchContent` | `{ urls, format? }` | Extract content from URLs. |

**Mode Selection**:
```typescript
// Quick facts (replaces web_quickSearch)
searchWeb({ query: "latest React version", mode: "quick" })

// Deep research (replaces web_deepResearch)
searchWeb({ query: "AI trends 2024", mode: "deep", numResults: 10 })

// Fetch specific URLs (replaces web_fetchContent)
fetchContent({ urls: ["https://..."], format: "markdown" })
```

---

### HTTP (2 tools)

| Tool | Signature | Description |
|------|-----------|-------------|
| `httpGet` | `{ url, headers? }` | GET request to external API. |
| `httpPost` | `{ url, body, headers?, confirmed }` | POST request. Requires confirmation. |

---

## Tool Count Summary

| Category | Subcategory | Old Count | New Count | Change |
|----------|-------------|-----------|-----------|--------|
| **Default** | Core | 3 | 3 | — |
| **Internal** | Pages | 6 | 4 | -2 |
| | Sections | 8 | 5 | -3 |
| | Images | 7 | 4 | -3 |
| | Posts | 7 | 4 | -3 |
| | Navigation | 5 | 4 | -1 |
| | Entries | 2 | 3 | +1 |
| **External** | Image Sourcing | 4 | 2 | -2 |
| | Web Research | 3 | 2 | -1 |
| | HTTP | 2 | 2 | — |
| **Total** | | **47** | **33** | **-14 (30%)** |

### By Category

| Category | Tool Count | Tools |
|----------|------------|-------|
| **Default** | 3 | searchTools, acknowledgeRequest, finalAnswer |
| **Internal** | 24 | Pages (4), Sections (5), Images (4), Posts (4), Nav (4), Entries (3) |
| **External** | 6 | browseImages, importImage, searchWeb, fetchContent, httpGet, httpPost |

---

## Schema Design Patterns

### Pattern 1: Scope Selection

Every `get*` tool supports flexible scope via mutually exclusive params:

```typescript
const getPageSchema = z.object({
  // Scope selection (one of these)
  id: z.string().uuid().optional().describe("Get by UUID"),
  slug: z.string().optional().describe("Get by slug"),
  all: z.boolean().optional().describe("Get all"),

  // Modifiers
  includeContent: z.boolean().optional().default(false),
  limit: z.number().optional(),
}).refine(
  data => data.id || data.slug || data.all,
  { message: "Provide id, slug, or set all: true" }
);
```

### Pattern 2: Unified Response Format

All `get*` tools return consistent structure:

```typescript
interface GetResponse<T> {
  success: boolean;
  count: number;
  items: T[];  // Always array, even for single item
  // Single item accessed as items[0]
}

// Example responses
{ success: true, count: 1, items: [{ id: "...", name: "About", slug: "about" }] }
{ success: true, count: 5, items: [{ ... }, { ... }, ...] }
{ success: true, count: 0, items: [] }
```

### Pattern 3: Confirmation for Destructive Operations

```typescript
const deleteSchema = z.object({
  ids: z.array(z.string()).describe("IDs to delete (always array, even for single)"),
  confirmed: z.boolean().optional().describe(
    "Required for deletion. First call returns preview; set true to execute."
  ),
});

// First call: returns what will be deleted
deletePost({ slugs: ["my-post"] })
// → { requiresConfirmation: true, message: "Delete 1 post?", items: [{...}] }

// Batch delete preview
deletePost({ slugs: ["post-1", "post-2"] })
// → { requiresConfirmation: true, message: "Delete 2 posts?", items: [{...}, {...}] }

// Confirmed call: executes deletion
deletePost({ slugs: ["my-post"], confirmed: true })
// → { success: true, deleted: [{ slug: "my-post", title: "My Post" }] }
```

### Pattern 4: Merged Update Operations

`update*` tools handle multiple update types via optional params:

```typescript
const updateSectionSchema = z.object({
  pageSectionId: z.string().describe("Section to update"),

  // Content update (merges with existing)
  content: z.record(z.string(), z.any()).optional(),

  // Image attachment (convenience)
  imageId: z.string().optional().describe("Image to attach"),
  imageField: z.string().optional().describe("Field name (e.g., backgroundImage)"),
}).refine(
  data => data.content || (data.imageId && data.imageField),
  { message: "Provide content, or imageId + imageField" }
);
```

---

## Tool Descriptions

### Formula
```
<verb> <entity>. <scope options>. <key behavior>. <returns>.
```

### Examples

**Before (verbose, overlapping)**:
```
cms_findImage: "Find an image by natural language description. Use when user mentions an image or asks to find/delete/modify a specific image."

cms_searchImages: "Search for images using semantic similarity. IMPORTANT: Expand short queries with descriptive keywords (e.g., 'AI' → 'artificial intelligence robot technology')..."

cms_listAllImages: "List all images in the entire system (not just current conversation). Use when user asks 'show me all images'..."
```

**After (unified, concise)**:
```
getImage: "Get local image(s). By id, by query (semantic search), or all. Returns array. Expand short queries for better matches."
```

### All Descriptions

| Tool | Description |
|------|-------------|
| `getPage` | Get page(s). By id, slug, or all. Default lightweight; includeContent for full sections. |
| `createPage` | Create empty page. Add sections with createSection. |
| `updatePage` | Update page metadata. Use updateSection for content. |
| `deletePage` | Delete page(s) and all sections. Array param. Requires confirmed. |
| `getSectionTemplate` | Get section template(s). Shows fields and structure. |
| `getSection` | Get section(s) on page. By pageSectionId or pageId. |
| `createSection` | Add section to page. Returns pageSectionId for updates. |
| `updateSection` | Update section content or attach image. Merges with existing. |
| `deleteSection` | Delete section(s). Array param. Requires confirmed. |
| `getImage` | Get local image(s). By id, query (semantic), or all. |
| `createImage` | Upload image. Returns imageId after processing. |
| `updateImage` | Update image metadata (description, tags). |
| `deleteImage` | Delete image(s). Array param. Requires confirmed. |
| `browseImages` | Search Pexels/Unsplash. Returns previews. Use importImage to download. |
| `importImage` | Download external photo to local. Returns local imageId and URL. |
| `getPost` | Get post(s). By slug, or all with filters (status, category). |
| `createPost` | Create draft post. Use updatePost to publish. |
| `updatePost` | Update post. Set status: published/archived to change state. |
| `deletePost` | Delete post(s). Array param. Requires confirmed. |
| `getNavItem` | Get navigation item(s). By label or all. |
| `createNavItem` | Add navigation item. Location: header/footer/both. |
| `updateNavItem` | Update nav item. Set visible: false to hide. |
| `deleteNavItem` | Remove navigation item(s). Array param. |
| `getEntry` | Get collection entry(s). By id or collectionId. |
| `createEntry` | Create collection entry. |
| `updateEntry` | Update entry content or status. |
| `searchWeb` | Web search. mode: quick (facts) or deep (research with AI answer). |
| `fetchContent` | Extract content from URLs. Returns markdown/text. |
| `httpGet` | HTTP GET to external API. |
| `httpPost` | HTTP POST to external API. Requires confirmed. |
| `searchTools` | Find tools by capability keywords. |
| `acknowledgeRequest` | Signal understanding before executing. |
| `finalAnswer` | Present final answer to user. |

---

## Migration Mapping

| Old Tool | New Tool | Change |
|----------|----------|--------|
| cms_getPage | getPage | Drop prefix; add `all` param |
| cms_listPages | getPage | Merged: `all: true` |
| cms_createPage | createPage | Drop prefix |
| cms_createPageWithContent | REMOVED | Use workflow: createPage → createSection → updateSection |
| cms_updatePage | updatePage | Drop prefix |
| cms_deletePage | deletePage | Drop prefix |
| cms_listSectionTemplates | getSectionTemplate | Renamed; `all: true` |
| cms_getSectionFields | getSectionTemplate | Merged: by id/key |
| cms_getPageSections | getSection | Renamed; by pageId |
| cms_getSectionContent | getSection | Merged: `includeContent: true` |
| cms_addSectionToPage | createSection | Renamed |
| cms_updateSectionContent | updateSection | Merged with image update |
| cms_updateSectionImage | updateSection | Merged: `imageId` + `imageField` params |
| cms_addImageToSection | updateSection | Merged (deprecated) |
| cms_deletePageSection | deleteSection | Unified single/batch |
| cms_deletePageSections | deleteSection | Merged: `pageSectionIds` array |
| cms_findImage | getImage | Merged: `query` param |
| cms_searchImages | getImage | Merged: `query` + `limit` |
| cms_listAllImages | getImage | Merged: `all: true` |
| cms_replaceImage | REMOVED | Manual workflow: getImage → updateSection |
| cms_deleteImage | deleteImage | Drop prefix |
| cms_getNavigation | getNavItem | Renamed; `all: true` default |
| cms_addNavigationItem | createNavItem | Renamed |
| cms_updateNavigationItem | updateNavItem | Renamed |
| cms_removeNavigationItem | deleteNavItem | Renamed |
| cms_toggleNavigationItem | updateNavItem | Merged: `visible` param |
| cms_createPost | createPost | Drop prefix |
| cms_updatePost | updatePost | Drop prefix; add `status` for publish/archive |
| cms_publishPost | updatePost | Merged: `status: 'published'` |
| cms_archivePost | updatePost | Merged: `status: 'archived'` |
| cms_deletePost | deletePost | Drop prefix |
| cms_listPosts | getPost | Merged: `all: true` + filters |
| cms_getPost | getPost | Drop prefix |
| cms_getCollectionEntries | getEntry | Renamed |
| cms_getEntryContent | getEntry | Merged: `includeContent: true` |
| pexels_searchPhotos | browseImages | Unified: `provider: 'pexels'` |
| pexels_downloadPhoto | importImage | Unified: `provider: 'pexels'` |
| unsplash_searchPhotos | browseImages | Unified: `provider: 'unsplash'` |
| unsplash_downloadPhoto | importImage | Unified: `provider: 'unsplash'` |
| web_quickSearch | searchWeb | Merged: `mode: 'quick'` |
| web_deepResearch | searchWeb | Merged: `mode: 'deep'` |
| web_fetchContent | fetchContent | Renamed |
| http_get | httpGet | Renamed (camelCase) |
| http_post | httpPost | Renamed (camelCase) |
| search_vector | REMOVED | Merged into getPage/getSection with query |
| cms_findResource | REMOVED | Use specific get* tools |
| plan_analyzeTask | REMOVED | Low usage; LLM plans naturally |
| tool_search | searchTools | Renamed |
| final_answer | finalAnswer | camelCase |
| acknowledge | acknowledgeRequest | More explicit |

---

## Part 2: Guidance Architecture

### What AI SDK 6 Already Provides

Each tool definition gives the LLM:

```typescript
export const createPost = tool({
  description: "Create blog post as draft. Use updatePost to publish.",
  inputSchema: z.object({
    collectionSlug: z.string().describe('Collection slug (e.g., "blog")'),
    slug: z.string().describe('URL-friendly post slug'),
    title: z.string().describe("Post title"),
    content: z.object({
      body: z.string().describe("Post body (markdown)"),
      cover: z.object({ url: z.string(), alt: z.string() }).optional(),
    }),
  }),
});
```

**LLM receives:**
- Tool name
- Description (what it does)
- Parameter schema with `.describe()` (what to pass)

This is **baseline knowledge**.

---

### What We Inject Extra: Guidance

**Guidance** = Non-obvious behaviors, gotchas, edge cases that the LLM CANNOT know from description + schema alone.

| Info Type | Example | In description/schema? |
|-----------|---------|------------------------|
| What tool does | "Create blog post" | ✅ Yes |
| What params mean | "Post slug" | ✅ Yes |
| What to call next | "Use updatePost to publish" | ✅ Yes (description) |
| **Non-obvious behavior** | "Set BOTH featuredImage AND content.cover" | ❌ **NO - GOTCHA** |
| **Common mistake** | "Use pageSectionId, not templateId" | ❌ **NO - GOTCHA** |
| **Edge case** | "imageField must exactly match schema" | ❌ **NO - GOTCHA** |

**Guidance contains ONLY what description + schema don't tell you.**

---

### Current Problem: BEFORE/AFTER/NEXT/GOTCHA is Verbose

```xml
<!-- Current format: ~100 tokens per tool -->
<cms_createPost>
BEFORE: cms_listPosts to check for duplicate titles
AFTER: Ask if user wants cover image; ask if ready to publish
NEXT: pexels_searchPhotos (cover image), cms_publishPost
GOTCHA: Creates DRAFT only. Set BOTH featuredImage AND content.cover for covers.
</cms_createPost>
```

**Problems:**
- BEFORE: LLM can reason about prerequisites
- AFTER: LLM knows to communicate results
- NEXT: LLM can figure out sequences from tool descriptions
- Only GOTCHA is truly non-obvious info

---

### New Format: Guidance Only

```xml
<!-- New format: ~20 tokens per tool -->
<createPost>
For covers, set BOTH `featuredImage` AND `content.cover`. Substantial posts: 500+ words.
</createPost>
```

**Same injection mechanism. Same XML structure. Just the gotchas.**

---

### Two-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: RULES (Always in agent.xml, ~200 tokens)          │
│  Invariant constraints - images, entities, efficiency        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: GUIDANCE (Per Active Tool, ~20 tokens each)       │
│  Gotchas, non-obvious behaviors, edge cases                  │
└─────────────────────────────────────────────────────────────┘
```

**Workflows are NOT injected** - they're developer documentation. LLM sequences tools based on understanding each tool's description + guidance.

---

### Layer 1: Rules (in agent.xml)

Always-active constraints. Lives in `<operational>` section of agent.xml.

```xml
<rules>
  <images>
    - URLs: Relative /uploads/... only. Never add domain.
    - Source first: getImage before browseImages → importImage.
    - Render: Use exact `url` field from tool response.
  </images>

  <entities>
    - Pages ≠ Posts: Use correct tool family.
    - Resolve IDs: get* before create/update/delete.
    - Confirm destructive: delete* needs confirmed: true.
  </entities>

  <efficiency>
    - Lightweight default: includeContent only when editing.
    - Fresh state: Fetch before reporting success.
    - Merge semantics: update* merges; send only changes.
  </efficiency>

  <external>
    - Attribution: Credit photographer for imported images.
    - Local URLs: importImage returns /uploads/... Use that.
  </external>
</rules>
```

---

### Layer 2: Guidance (Per Active Tool)

**File:** `server/tools/guidance/tool-guidance.json`

```json
{
  "getPage": "Lightweight by default. `includeContent: true` only when editing sections.",
  "createPage": "Returns `pageId`. Sections added separately with createSection.",
  "getSectionTemplate": "Returns schema. Use `key` as `templateKey` in createSection.",
  "createSection": "Returns `pageSectionId` - use for updates, NOT templateId.",
  "updateSection": "`imageField` must match schema exactly: `backgroundImage`, `image`, `cover`. Content merges.",
  "getImage": "Expand short queries: 'AI' → 'artificial intelligence technology'.",
  "browseImages": "Specific queries: 'monstera leaf close-up' not 'plant'.",
  "importImage": "Returns local `/uploads/...` URL. Credit photographer.",
  "updatePost": "For covers, set BOTH `featuredImage` AND `content.cover`.",
  "deletePost": "Permanent. Consider `status: 'archived'` instead."
}
```

**Injection:** When tool is active → inject its guidance line.

---

### System Prompt Integration

```xml
<agent>
  <!-- identity, react, communication, truth-model - unchanged -->

  <operational>
    <!-- Rules live here - always present -->
  </operational>

  <tool-calling-rules>
    ALWAYS follow the tool call schema exactly.
    NEVER refer to tool names when speaking to user.
  </tool-calling-rules>

  <tool-guidance>
    {{{activeGuidance}}}
  </tool-guidance>
</agent>
```

**Rendered when `getPage`, `createSection`, `updateSection` are active:**

```xml
<tool-guidance>
  <getPage>
  Lightweight by default. `includeContent: true` only when editing sections.
  </getPage>

  <createSection>
  Returns `pageSectionId` - use for updates, NOT templateId.
  </createSection>

  <updateSection>
  `imageField` must match schema exactly: `backgroundImage`, `image`, `cover`. Content merges.
  </updateSection>
</tool-guidance>
```

---

### What About Workflows?

**Workflows are developer documentation, NOT LLM injection.**

Why?
1. LLM can sequence tools if it understands each one (description + guidance)
2. Injecting workflows burns tokens on reasoning LLM can do itself
3. Tool descriptions can hint at next steps ("Use updatePost to publish")
4. Guidance catches gotchas that would derail the sequence

**Workflows live in:** `docs/workflows/*.md` for developer reference only.

---

### Token Comparison

| Format | Tokens per tool | 8 active tools |
|--------|-----------------|----------------|
| BEFORE/AFTER/NEXT/GOTCHA | ~100 | ~800 |
| Guidance only | ~20 | ~160 |
| **Savings** | | **~80%** |

---

### File Structure

```
server/
├── prompts/core/
│   └── agent.xml              # System prompt with rules
└── tools/guidance/
    └── tool-guidance.json     # Per-tool guidance
```

```
docs/
└── workflows/                 # Developer reference (NOT injected)
    ├── create-landing-page.md
    ├── publish-post.md
    └── ...
```

---

## Implementation Phases

### Phase 1: Merge Get/List Tools (High Impact, Low Effort)
- `cms_listPages` + `cms_getPage` → `getPage`
- `cms_listPosts` + `cms_getPost` → `getPost`
- `cms_findImage` + `cms_searchImages` + `cms_listAllImages` → `getImage`

### Phase 2: Merge Workflow Variants (Medium Impact, Low Effort)
- `cms_publishPost` + `cms_archivePost` → `updatePost` with status
- `cms_toggleNavigationItem` → `updateNavItem` with visible
- `cms_updateSectionContent` + `cms_updateSectionImage` → `updateSection`

### Phase 3: Unify External Tools (Medium Impact, Medium Effort)
- `pexels_*` + `unsplash_*` → `browseImages` + `importImage`
- `web_*` → `searchWeb` + `fetchContent`

### Phase 4: Remove Composites (Low Impact, Low Effort)
- Remove `cms_createPageWithContent` (document in docs/workflows/)
- Remove `cms_replaceImage` (document in docs/workflows/)
- Remove `search_vector`, `cms_findResource` (use specific tools)

### Phase 5: Guidance Migration
- Extract GOTCHA content → `tool-guidance.json`
- Remove BEFORE/AFTER/NEXT (redundant)
- Rename `<tool-usage-instructions>` → `<tool-guidance>` in agent.xml
- Move workflows to `docs/workflows/` as developer reference

---

## Design Decisions

1. **Image upload naming: `createImage`**
   - Consistent CRUD naming across all entities
   - `get`, `create`, `update`, `delete` pattern

2. **Batch operations: Delete only (array-first)**

   Based on current REST patterns and use cases:

   | Operation | Batch? | Rationale |
   |-----------|--------|-----------|
   | **Create** | ❌ Single | Complex payload per entity; partial failure semantics unclear; current endpoints are single-resource |
   | **Read (get)** | ⚠️ Single + all | Use `id`/`slug` for one, `all: true` for list; no "get these 5 specific IDs" use case |
   | **Update** | ❌ Single | Different fields per entity; context-heavy; current endpoints are single-resource |
   | **Delete** | ✅ Array | Common bulk cleanup; simple IDs only; clear semantics |

   **Delete pattern:**
   - `deleteSection({ ids: ["uuid"] })` for single
   - `deleteSection({ ids: ["uuid1", "uuid2"] })` for batch
   - Single code path, no type unions or branching
   - Plural param name (`ids` not `id`) signals "accepts multiple"
   - Follows array-first pattern (GraphQL, modern APIs)

   **CRU pattern:**
   - `createPage({ name, slug })` - single entity
   - `getPage({ slug: "about" })` - single by identifier
   - `getPage({ all: true })` - list all
   - `updatePage({ slug: "about", updates: {...} })` - single entity

3. **`finalAnswer` must verify before presenting**
   - Always fetch fresh state before claiming success
   - Adds slight latency but ensures accuracy
   - Prevents "I updated X" when X actually failed

---

## Part 3: Production Alignment Review

After cross-referencing with [DATABASE_ENDPOINT_REFACTOR.md](./DATABASE_ENDPOINT_REFACTOR.md), the following updates ensure tools can handle production-aligned database operations.

### Key Production Patterns to Support

| Pattern | Production Feature | Tool Impact |
|---------|-------------------|-------------|
| **Multi-navigation** | Multiple menus (header, footer, sidebar) | Add `navigationId` to nav item tools |
| **Page hierarchy** | Nested pages via `parentId` | Add `parentId` to page tools |
| **Section state** | `status` + `hidden` fields | Add to section tools |
| **Entry deletion** | Full CRUD on entries | Add `deleteEntry` tool |
| **Morphic nav targets** | Items point to pages/entries/media/urls | Add `targetType`, `targetId` to nav tools |

### Updated Tool Signatures

#### Pages (4 tools - updated signatures)

```typescript
getPage({
  id?: string,
  slug?: string,
  parentId?: string,        // NEW: Get children of this page
  includeChildren?: boolean, // NEW: Include child pages in response
  all?: boolean,
  includeContent?: boolean
})

createPage({
  name: string,
  slug: string,
  parentId?: string,        // NEW: Create as child of this page
  isProtected?: boolean,    // NEW: Mark as protected/default page
  meta?: object,
  indexing?: boolean
})

updatePage({
  id: string,
  name?: string,
  slug?: string,
  parentId?: string,        // NEW: Move to different parent (or null for root)
  isProtected?: boolean,    // NEW: Change protection status
  meta?: object,
  indexing?: boolean
})

deletePage({ ids: string[], confirmed: boolean })  // Unchanged
```

#### Sections (5 tools - updated signatures)

```typescript
getSectionTemplate({ id?, key?, all? })  // Unchanged

getSection({ pageSectionId?, pageId?, includeContent? })  // Unchanged

createSection({
  pageId: string,
  templateKey: string,
  content?: object,
  sortOrder?: number,
  status?: 'published' | 'unpublished' | 'draft',  // NEW
  hidden?: boolean                                   // NEW
})

updateSection({
  pageSectionId: string,
  content?: object,
  imageId?: string,
  imageField?: string,
  status?: 'published' | 'unpublished' | 'draft',  // NEW
  hidden?: boolean,                                 // NEW
  sortOrder?: number                                // NEW: For reordering
})

deleteSection({ ids: string[], confirmed: boolean })  // Unchanged
```

#### Navigation (4 tools - updated signatures)

Production has multiple navigations per environment. Tools must be scoped:

```typescript
getNavItem({
  id?: string,
  navigationId?: string,    // NEW: Scope to specific navigation (required if not getting by id)
  label?: string,
  all?: boolean
})

createNavItem({
  navigationId: string,     // NEW: Required - which navigation to add to
  label: string,
  targetType: 'page' | 'entry' | 'media' | 'url' | 'placeholder',  // NEW: Morphic targeting
  targetId?: string,        // NEW: UUID of page/entry/media (if targetType != url/placeholder)
  url?: string,             // For external URLs
  parentId?: string,        // NEW: For nested menus
  sortOrder?: number
})

updateNavItem({
  id: string,               // Changed: Use id, not label
  label?: string,
  targetType?: 'page' | 'entry' | 'media' | 'url' | 'placeholder',  // NEW
  targetId?: string,        // NEW
  url?: string,
  parentId?: string,        // NEW
  visible?: boolean,
  sortOrder?: number        // NEW
})

deleteNavItem({ ids: string[] })  // Changed: Use ids array, not labels
```

**Note**: Navigation CRUD (create/delete entire navigations) is an admin setup task, not agent task. Agent works with items within existing navigations.

#### Entries (4 tools - one new)

```typescript
getEntry({
  id?: string,
  slug?: string,            // NEW: Get by slug
  collectionId?: string,
  all?: boolean,
  includeContent?: boolean,
  status?: 'draft' | 'published' | 'archived'  // NEW: Filter by status
})

createEntry({
  collectionId: string,
  slug: string,
  title: string,
  content?: object,
  status?: 'draft' | 'published'  // NEW: Initial status
})

updateEntry({
  id: string,
  slug?: string,            // NEW: Update slug
  title?: string,
  content?: object,
  status?: 'draft' | 'published' | 'archived'
})

deleteEntry({               // NEW TOOL
  ids: string[],
  confirmed: boolean
})
```

### Tools NOT Added (Admin Tasks)

These operations are handled during setup, not by agent:

| Operation | Why Not a Tool |
|-----------|---------------|
| `createNavigation` / `deleteNavigation` | Site setup - navigations rarely change |
| `createCollection` / `deleteCollection` | Schema setup - collections are predefined |
| `addLocale` / `removeLocale` | Site setup - locales configured once |
| `reorderSections` (bulk) | Use `updateSection` with `sortOrder` |
| `reorderEntries` (bulk) | Use `updateEntry` with ordering field |

### Final Tool Count

| Category | Tools | Change |
|----------|-------|--------|
| Default | 3 | — |
| Pages | 4 | Signatures updated |
| Sections | 5 | Signatures updated |
| Images | 4 | — |
| Posts | 4 | — |
| Navigation | 4 | Signatures updated |
| Entries | 4 | +1 (deleteEntry) |
| External | 6 | — |
| **TOTAL** | **34** | +1 |

### Validation: Can Tools Handle All Operations?

| Production Endpoint | Tool | Notes |
|---------------------|------|-------|
| `GET /pages` | `getPage({ all: true })` | ✅ |
| `GET /pages/:page` | `getPage({ slug })` | ✅ |
| `POST /pages` | `createPage()` | ✅ With parentId |
| `PATCH /pages/:page` | `updatePage()` | ✅ With parentId |
| `DELETE /pages/:page` | `deletePage()` | ✅ |
| `GET /pages/:page/sections` | `getSection({ pageId })` | ✅ |
| `POST /pages/:page/sections` | `createSection()` | ✅ |
| `DELETE /pages/:page/sections/:section` | `deleteSection()` | ✅ |
| `POST /pages/:page/sections/:section/publish` | `updateSection({ status: 'published' })` | ✅ |
| `POST /pages/:page/sections/:section/visibility` | `updateSection({ hidden })` | ✅ |
| `POST /pages/:page/sections/order` | `updateSection({ sortOrder })` | ✅ (per section) |
| `GET /navigations/:nav` | `getNavItem({ navigationId, all: true })` | ✅ |
| `POST /navigations/:nav/items` | `createNavItem({ navigationId })` | ✅ |
| `DELETE /navigations/:nav/items/:item` | `deleteNavItem({ ids })` | ✅ |
| `GET /collections/:col/entries` | `getEntry({ collectionId, all: true })` | ✅ |
| `POST /collections/:col/entries` | `createEntry({ collectionId })` | ✅ |
| `DELETE /collections/:col/entries/:entry` | `deleteEntry({ ids })` | ✅ NEW |
| `GET /media` | `getImage({ all: true })` | ✅ |
| `POST /media` | `createImage()` | ✅ |
| `DELETE /media/:id` | `deleteImage()` | ✅ |

**Result**: All core CMS operations covered with 34 tools.
