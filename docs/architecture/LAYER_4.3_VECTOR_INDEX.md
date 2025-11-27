# Layer 4.3: Vector Index

> LanceDB semantic search, OpenRouter embeddings, unified resource indexing

## Overview

The VectorIndexService provides semantic search capabilities across all CMS resources. It uses LanceDB for vector storage and OpenRouter's text-embedding-3-small model for generating embeddings. Resources (pages, sections, collections, entries, images) are indexed into a unified schema enabling natural language queries like "find pages about pricing" or "images with blue sky".

**Key Responsibilities:**
- Generate embeddings via OpenRouter API
- Store vectors in LanceDB with resource metadata
- Provide semantic search across resource types
- Support image-specific search with rich metadata
- Handle index lifecycle (add, update, delete)

---

## The Problem

Without semantic search, finding content is limited to exact matches:

```typescript
// WRONG: Exact match only
const pages = await db.query.pages.findMany({
  where: like(pages.title, `%${query}%`),
});
// "pricing plans" won't find "subscription options"

// WRONG: No cross-type search
// Have to search pages, then sections, then entries separately

// WRONG: No relevance ranking
// Results come back in arbitrary order

// WRONG: No semantic understanding
// "blue ocean" won't find "beach sunset" images
```

**Our Solution:**
1. Unified ResourceDocument schema for all types
2. OpenRouter embeddings capture semantic meaning
3. LanceDB vector search with similarity ranking
4. Distance-to-similarity conversion for intuitive scores

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VECTOR INDEX SERVICE                         │
│                                                                 │
│  CMS Services                     Image Processing              │
│  ├─ PageService.create()         ├─ processImage()              │
│  ├─ SectionService.create()      └─ generates metadata          │
│  └─ EntryService.upsert()                │                      │
│           │                              │                      │
│           ▼                              ▼                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 VectorIndexService                      │    │
│  │                                                         │    │
│  │  Resource Operations:          Image Operations:        │    │
│  │  ├─ add(doc)                  ├─ addImage(data)         │    │
│  │  ├─ update(id, doc)           ├─ searchImages(query)    │    │
│  │  ├─ delete(id)                ├─ findImageByDescription │    │
│  │  ├─ search(query, type?)      └─ deleteImage(id)        │    │
│  │  └─ exists(id)                                          │    │
│  │                                                         │    │
│  │  Embedding:                                             │    │
│  │  └─ embed(text) → OpenRouter API → 1536-dim vector      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                        │
│                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      LanceDB                            │    │
│  │                                                         │    │
│  │  resource_index table:                                  │    │
│  │  ├─ id (string)            ├─ searchableText (string)   │    │
│  │  ├─ type (enum)            ├─ metadataJson (string)     │    │
│  │  ├─ name (string)          ├─ embedding (float[1536])   │    │
│  │  ├─ slug (string)          └─ updatedAt (timestamp)     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/vector-index.ts` | VectorIndexService class and singleton |
| `server/services/cms/page-service.ts` | Calls vectorIndex.add() on page create |
| `server/services/cms/section-service.ts` | Indexes section definitions |
| `server/services/cms/entry-service.ts` | Indexes collection entries |
| `server/workers/image.worker.ts` | Calls addImage() after metadata generation |

---

## Core Implementation

### Schema Definitions

```typescript
// server/services/vector-index.ts
export interface ResourceDocument {
  id: string;
  type: "page" | "section_def" | "collection" | "entry" | "image";
  name: string;
  slug: string;
  searchableText: string;
  metadata: Record<string, any>;
  embedding: number[];
  updatedAt: Date;
}

export interface SearchResult {
  id: string;
  type: string;
  name: string;
  slug: string;
  similarity: number;  // 0-1, higher = more relevant
}

export interface ImageVectorRecord {
  id: string;
  type: "image";
  filename: string;
  description: string;
  searchableText: string;
  textEmbedding: number[];
  imageEmbedding?: number[];
  metadata: {
    tags: string[];
    categories: string[];
    colors: string[];
    mood: string;
    style: string;
  };
}
```

### Initialization with Lazy Table Creation

```typescript
export class VectorIndexService {
  private db: any;
  private table: Table | null = null;

  constructor(private dbPath: string) {}

  async initialize() {
    this.db = await connect(this.dbPath);

    try {
      this.table = await this.db.openTable("resource_index");
      console.log("✓ Vector index opened");
    } catch {
      // Table doesn't exist - create with dummy record
      // LanceDB requires at least one record to infer schema
      const dummyRecord = {
        id: "__init__",
        type: "page",
        name: "__init__",
        slug: "__init__",
        searchableText: "__init__",
        metadataJson: "{}",
        embedding: new Array(1536).fill(0),
        updatedAt: Date.now(),
      };

      this.table = await this.db.createTable("resource_index", [dummyRecord], {
        mode: "create",
      });

      // Delete the dummy record
      await this.table?.delete("id = '__init__'");
      console.log("✓ Vector index table created");
    }
  }
}
```

### Adding Documents with Embedding Generation

```typescript
async add(doc: Omit<ResourceDocument, "embedding" | "updatedAt">) {
  if (!this.table) await this.initialize();

  // Generate embedding via OpenRouter
  const embedding = await this.embed(doc.searchableText);

  const record = {
    id: doc.id,
    type: doc.type,
    name: doc.name,
    slug: doc.slug,
    searchableText: doc.searchableText,
    metadataJson: JSON.stringify(doc.metadata),
    embedding,
    updatedAt: Date.now(),
  };

  await this.table?.add([record]);
}
```

### Semantic Search with Distance Conversion

```typescript
async search(query: string, type?: string, limit = 3): Promise<SearchResult[]> {
  if (!this.table) await this.initialize();

  // Generate query embedding
  const queryEmbedding = await this.embed(query);

  // Vector similarity search
  let results = await this.table
    ?.vectorSearch(queryEmbedding)
    .limit(limit * 2)  // Fetch extra for filtering
    .toArray();

  if (!results) return [];

  // Filter by type if specified
  if (type) {
    results = results.filter((r: any) => r.type === type);
  }

  // Return top results with similarity scores
  return results.slice(0, limit).map((r: any) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    slug: r.slug,
    similarity: r._distance ? 1 - r._distance : 0,  // Distance → similarity
  }));
}
```

### Update via Delete + Re-Add

```typescript
async update(
  id: string,
  doc: Partial<Omit<ResourceDocument, "id" | "embedding" | "updatedAt">>
) {
  if (!this.table) await this.initialize();

  // Delete old record
  await this.delete(id);

  // Generate searchable text if not provided
  let searchableText = doc.searchableText;
  if (!searchableText && (doc.name || doc.slug)) {
    searchableText = `${doc.name || ""} ${doc.slug || ""}`.trim();
  }

  if (!searchableText) {
    console.warn(`No searchable text for update of ${id}`);
    return;
  }

  // Re-add with new embedding
  const embedding = await this.embed(searchableText);

  const record = {
    id,
    type: doc.type!,
    name: doc.name!,
    slug: doc.slug!,
    searchableText: searchableText!,
    metadataJson: JSON.stringify(doc.metadata || {}),
    embedding,
    updatedAt: Date.now(),
  };

  await this.table?.add([record]);
}
```

### Image-Specific Search

```typescript
async searchImages(
  query: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ results: ImageSearchResult[]; total: number }> {
  if (!this.table) await this.initialize();

  const limit = options.limit || 10;
  const offset = options.offset || 0;

  try {
    const queryEmbedding = await this.embed(query);

    // Filter to images only
    const results = await this.table
      ?.vectorSearch(queryEmbedding)
      .where("type = 'image'")
      .limit(limit + offset + 100)  // Extra for pagination
      .toArray();

    if (!results || results.length === 0) {
      return { results: [], total: 0 };
    }

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      results: paginatedResults.map((r: any) => ({
        id: r.id,
        filename: r.name,
        description: r.searchableText.split(" ").slice(0, 20).join(" "),
        score: r._distance ? 1 - r._distance : 0,
        metadata: r.metadataJson ? JSON.parse(r.metadataJson) : {},
      })),
      total: results.length,
    };
  } catch (error) {
    console.error("Image search error:", error);
    return { results: [], total: 0 };
  }
}
```

### OpenRouter Embedding Generation

```typescript
private async embed(text: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "ReAct CMS Agent",
      },
      body: JSON.stringify({
        model,
        input: text.slice(0, 8000),  // Truncate for safety
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error: any) {
    console.error("Embedding error:", error.message);
    // Return zero vector as fallback
    return new Array(1536).fill(0);
  }
}
```

---

## Design Decisions

### Why LanceDB?

```typescript
// LanceDB provides:
this.db = await connect(this.dbPath);
this.table?.vectorSearch(queryEmbedding).limit(10).toArray();
```

**Reasons:**
1. **Embedded** - No external server, runs in-process
2. **File-based** - Persists to disk automatically
3. **Fast** - Optimized for vector similarity search
4. **Simple API** - Native JS/TS support

### Why Unified ResourceDocument?

```typescript
type: "page" | "section_def" | "collection" | "entry" | "image"
```

**Reasons:**
1. **Single table** - One search covers all resource types
2. **Type filtering** - Filter by type when needed
3. **Consistent schema** - Same fields across all resources
4. **Simpler queries** - No joins or multi-table searches

### Why Delete + Re-Add for Updates?

```typescript
async update(id, doc) {
  await this.delete(id);
  // ... generate new embedding
  await this.table?.add([record]);
}
```

**Reasons:**
1. **LanceDB limitation** - No native update support
2. **Embedding regeneration** - Content changes require new vector
3. **Atomic** - Delete + add is effectively atomic
4. **Simple** - No complex merge logic needed

### Why Distance-to-Similarity Conversion?

```typescript
similarity: r._distance ? 1 - r._distance : 0
```

**Reasons:**
1. **Intuitive** - Higher = better (vs. lower distance = better)
2. **Normalized** - 0-1 range for easy thresholds
3. **Consistent** - Same scale regardless of vector dimension

### Why Zero Vector Fallback?

```typescript
catch (error) {
  return new Array(1536).fill(0);  // Fallback
}
```

**Reasons:**
1. **Graceful degradation** - System continues if OpenRouter fails
2. **Searchable** - Zero vector still stored and queryable
3. **Retry opportunity** - Can regenerate later if needed

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 4.1 (CMS Services) | Services call add/update/delete on mutations |
| Layer 4.4 (Image Processing) | Worker calls addImage after metadata generation |
| Layer 3.2 (Tools) | Search tools call search/searchImages |
| Layer 1.2 (Container) | Singleton instantiated in ServiceContainer |

### CMS Service Integration

```typescript
// server/services/cms/page-service.ts
async createPage(input: CreatePageInput) {
  // ... create page in SQLite

  // Index for semantic search
  await this.vectorIndex.add({
    id: page.id,
    type: "page",
    name: page.title,
    slug: page.slug,
    searchableText: `${page.title} ${page.description || ""}`,
    metadata: { status: page.status },
  });

  return page;
}
```

### Agent Tool Integration

```typescript
// server/tools/search-tool.ts
export const searchTool = tool({
  description: "Search CMS resources by natural language",
  parameters: z.object({
    query: z.string(),
    type: z.enum(["page", "entry", "section_def"]).optional(),
  }),
  execute: async ({ query, type }, { context }) => {
    const results = await context.vectorIndex.search(query, type);
    return results;
  },
});
```

---

## Common Issues / Debugging

### Embedding Generation Fails

```
Error: OPENROUTER_API_KEY not configured
```

**Cause:** Missing or invalid API key.

**Fix:** Set environment variable:

```bash
export OPENROUTER_API_KEY="sk-or-..."
```

### Search Returns No Results

```typescript
const results = await vectorIndex.search("pricing");
// results = []
```

**Cause:** Table empty or no matching content.

**Debug:**

```typescript
// Check table has data
const all = await this.table?.query().limit(10).toArray();
console.log("Records in index:", all?.length);

// Check specific resource indexed
const exists = await vectorIndex.exists(pageId);
console.log("Page indexed:", exists);
```

### Zero Similarity Scores

```typescript
// results[0].similarity = 0
```

**Cause:** Embedding generation failed, zero vector stored.

**Debug:**

```typescript
// Check embedding was generated
const record = await this.table
  ?.query()
  .where(`id = '${id}'`)
  .toArray();
console.log("Embedding sum:", record?.[0]?.embedding?.reduce((a, b) => a + b, 0));
// Should be non-zero
```

**Fix:** Re-index the resource:

```typescript
await vectorIndex.update(pageId, {
  type: "page",
  name: page.title,
  slug: page.slug,
  searchableText: `${page.title} ${page.description}`,
  metadata: {},
});
```

### LanceDB Table Creation Error

```
Error: Cannot create table - already exists
```

**Cause:** Race condition during initialization.

**Fix:** Check if table exists first:

```typescript
async initialize() {
  try {
    this.table = await this.db.openTable("resource_index");
  } catch {
    // Only create if doesn't exist
    this.table = await this.db.createTable(...);
  }
}
```

### Stale Index After Direct DB Updates

```
// Manual SQL update, but vector index out of sync
```

**Cause:** Bypassed service layer, index not updated.

**Fix:** Always use service methods, or manually sync:

```typescript
// After direct update
await vectorIndex.update(pageId, {
  type: "page",
  name: newTitle,
  slug: page.slug,
  searchableText: `${newTitle} ${newDescription}`,
  metadata: {},
});
```

---

## Further Reading

- [Layer 4.1: CMS Services](./LAYER_4.1_CMS_SERVICES.md) - Services that call vector index
- [Layer 4.4: Image Processing](./LAYER_4.4_IMAGE_PROCESSING.md) - Image-specific indexing
- [Layer 3.2: Tools](./LAYER_3.2_TOOLS.md) - Search tools using vector index
- [LanceDB Documentation](https://lancedb.github.io/lancedb/)
- [OpenRouter Embeddings](https://openrouter.ai/docs#embeddings)
