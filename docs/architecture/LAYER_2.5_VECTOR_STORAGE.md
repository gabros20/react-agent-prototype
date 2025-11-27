# Layer 2.5: Vector Storage (LanceDB)

> Semantic search across pages, sections, collections, and images using embeddings

## Overview

LanceDB provides vector similarity search alongside SQLite's relational queries. Content is embedded using OpenRouter's text-embedding-3-small model (1536 dimensions), enabling natural language queries like "find the hero section about AI" or "images with sunset and mountains."

**Key Capabilities:**
- Semantic search (meaning-based, not just keyword)
- Multi-type index (pages, sections, images in one table)
- Sub-millisecond similarity queries
- No separate vector database server needed (embedded)

---

## The Problem

Traditional search has limitations:

```typescript
// Keyword search - misses semantic matches
SELECT * FROM pages WHERE name LIKE '%AI%';
// Finds "AI Guide" but not "Machine Learning Tutorial"

// Full-text search - better but still keyword-based
SELECT * FROM pages WHERE searchable_text MATCH 'artificial intelligence';
// Misses "deep learning" even though semantically related

// No cross-entity search
// "Find content about mountains" - pages? images? sections?
```

**Our Solution:** Convert text to vectors (embeddings), store in LanceDB, search by similarity. "Sunset mountains" query finds:
- Page titled "Hiking Trails"
- Image described as "golden hour mountain range"
- Section with content about "alpine adventures"

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      VECTOR PIPELINE                             │
│                                                                  │
│  Content Change (Page/Section/Image)                            │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────┐                │
│  │         Build Searchable Text               │                │
│  │                                             │                │
│  │  Page: title + slug + meta.description      │                │
│  │  Image: description + tags + mood + colors  │                │
│  │  Section: definition.name + content summary │                │
│  └─────────────────────┬───────────────────────┘                │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────┐                │
│  │         OpenRouter Embeddings API           │                │
│  │         text-embedding-3-small              │                │
│  │         1536 dimensions                     │                │
│  └─────────────────────┬───────────────────────┘                │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────┐                │
│  │              LanceDB Storage                │                │
│  │                                             │                │
│  │  resource_index table:                      │                │
│  │  ┌─────────────────────────────────────┐   │                │
│  │  │ id | type | name | searchableText  │   │                │
│  │  │ embedding[1536] | metadata | updatedAt│   │                │
│  │  └─────────────────────────────────────┘   │                │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
│  Search Query                                                    │
│       │                                                          │
│       ▼                                                          │
│  Query → Embed → Vector Search → Similarity Scores → Results    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/vector-index.ts` | VectorIndexService class |
| `server/services/service-container.ts` | Initializes vector index |
| `scripts/reindex-vector.ts` | Rebuild entire index |

---

## Core Implementation

### Vector Index Service

```typescript
// server/services/vector-index.ts
import { connect, type Table } from "@lancedb/lancedb";

export interface ResourceDocument {
  id: string;
  type: "page" | "section_def" | "collection" | "entry" | "image";
  name: string;
  slug: string;
  searchableText: string;
  metadata: Record<string, any>;
  embedding: number[];       // 1536 floats
  updatedAt: Date;
}

export class VectorIndexService {
  private db: any;
  private table: Table | null = null;

  constructor(private dbPath: string) {}

  async initialize() {
    this.db = await connect(this.dbPath);

    try {
      this.table = await this.db.openTable("resource_index");
    } catch {
      // Create with dummy record (LanceDB needs initial data)
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

      this.table = await this.db.createTable("resource_index", [dummyRecord]);
      await this.table.delete("id = '__init__'");
    }
  }

  // ... methods below
}
```

### Adding Documents

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

### Searching

```typescript
async search(query: string, type?: string, limit = 3): Promise<SearchResult[]> {
  if (!this.table) await this.initialize();

  // Embed the search query
  const queryEmbedding = await this.embed(query);

  // Vector similarity search
  let results = await this.table
    ?.vectorSearch(queryEmbedding)
    .limit(limit * 2)  // Fetch extra for filtering
    .toArray();

  // Filter by type if specified
  if (type) {
    results = results.filter((r: any) => r.type === type);
  }

  // Convert distance to similarity score
  return results.slice(0, limit).map((r: any) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    slug: r.slug,
    similarity: r._distance ? 1 - r._distance : 0,
  }));
}
```

### Embedding Generation

```typescript
private async embed(text: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, 8000), // Truncate for safety
    }),
  });

  const data = await response.json();
  return data.data[0].embedding; // 1536-dimensional vector
}
```

### Image-Specific Search

```typescript
async searchImages(
  query: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ results: ImageSearchResult[]; total: number }> {
  if (!this.table) await this.initialize();

  const queryEmbedding = await this.embed(query);

  const results = await this.table
    ?.vectorSearch(queryEmbedding)
    .where("type = 'image'")  // Filter to images only
    .limit((options.limit || 10) + (options.offset || 0) + 100)
    .toArray();

  return {
    results: results.slice(options.offset, options.offset + options.limit).map((r: any) => ({
      id: r.id,
      filename: r.name,
      description: r.searchableText.split(" ").slice(0, 20).join(" "),
      score: r._distance ? 1 - r._distance : 0,
      metadata: JSON.parse(r.metadataJson || "{}"),
    })),
    total: results.length,
  };
}
```

---

## Index Content Patterns

### Page Indexing

```typescript
// When page is created/updated
await vectorIndex.add({
  id: page.id,
  type: "page",
  name: page.name,
  slug: page.slug,
  searchableText: `${page.name} ${page.slug} ${page.meta?.description || ""}`,
  metadata: { siteId: page.siteId, environmentId: page.environmentId },
});
```

### Image Indexing

```typescript
// After AI metadata generation
await vectorIndex.addImage({
  id: image.id,
  type: "image",
  filename: image.filename,
  description: metadata.description,
  searchableText: [
    metadata.description,
    metadata.detailedDescription,
    metadata.tags?.join(" "),
    metadata.mood,
    metadata.style,
    metadata.colors?.dominant?.join(" "),
  ].filter(Boolean).join(" "),
  textEmbedding: embedding,
  metadata: {
    tags: metadata.tags,
    categories: metadata.categories,
    colors: metadata.colors?.dominant,
    mood: metadata.mood,
    style: metadata.style,
  },
});
```

### Section Definition Indexing

```typescript
// Index section templates for "find sections about X"
await vectorIndex.add({
  id: definition.id,
  type: "section_def",
  name: definition.name,
  slug: definition.key,
  searchableText: `${definition.name} ${definition.description}`,
  metadata: { templateKey: definition.templateKey },
});
```

---

## Design Decisions

### Why LanceDB over Pinecone/Weaviate?

| Aspect | LanceDB | Pinecone | Weaviate |
|--------|---------|----------|----------|
| Deployment | Embedded (no server) | Cloud only | Self-hosted or cloud |
| Cost | Free | Pay per query | Free/paid |
| Setup | npm install | API key + account | Docker or cloud |
| Performance | Fast (local) | Fast (remote) | Variable |
| Persistence | Local files | Managed | Managed |

**Decision:** LanceDB's embedded nature matches our SQLite approach. Zero infrastructure.

### Why Single Table for All Types?

```typescript
// Option A: Separate tables per type
page_embeddings, image_embeddings, section_embeddings

// Option B: Single table with type field (chosen)
resource_index: { id, type, embedding, ... }
```

**Reasons:**
1. **Cross-type search** - "Find anything about mountains"
2. **Simpler API** - One search method, filter by type
3. **Consistent schema** - All resources have name, slug, searchableText
4. **Trade-off** - Type-specific metadata goes in JSON

### Why OpenRouter for Embeddings?

```typescript
// Direct OpenAI
fetch("https://api.openai.com/v1/embeddings")

// Via OpenRouter (chosen)
fetch("https://openrouter.ai/api/v1/embeddings")
```

**Reasons:**
1. **Same API key** - Already using OpenRouter for LLM
2. **Model flexibility** - Can switch embedding models easily
3. **Rate limit pooling** - OpenRouter handles provider limits
4. **Cost tracking** - Single billing dashboard

### Why 1536 Dimensions?

text-embedding-3-small produces 1536-dimensional vectors:
- **Accuracy** - Good balance of semantic capture
- **Storage** - ~6KB per vector (manageable)
- **Speed** - Fast similarity computation
- **Alternative** - text-embedding-3-large is 3072 dims (more accurate, more storage)

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 2.4 (Images) | Images indexed after AI metadata generation |
| Layer 4 (Services) | Services call vectorIndex on CRUD operations |
| Layer 5 (Background) | Worker indexes images after processing |
| Layer 3 (Agent) | Tools use search for semantic queries |

### Service Integration

```typescript
// server/services/cms/page-service.ts
async createPage(siteId: string, envId: string, data: NewPage) {
  const page = await db.insert(pages).values({...}).returning();

  // Index for search
  await this.vectorIndex.add({
    id: page.id,
    type: "page",
    name: page.name,
    slug: page.slug,
    searchableText: `${page.name} ${page.slug}`,
    metadata: { siteId, environmentId: envId },
  });

  return page;
}

async deletePage(pageId: string) {
  await db.delete(pages).where(eq(pages.id, pageId));

  // Remove from index
  await this.vectorIndex.delete(pageId);
}
```

### Agent Tool Usage

```typescript
// In agent tools
const results = await ctx.services.vectorIndex.search(
  "hero section for marketing",
  "section_def",
  5
);
// Returns: [{ id, type: "section_def", name: "Hero Section", similarity: 0.87 }, ...]

const images = await ctx.services.vectorIndex.searchImages(
  "sunset over ocean",
  { limit: 3 }
);
// Returns: [{ id, filename, description, score: 0.92, metadata }, ...]
```

---

## Common Issues / Debugging

### Search Returns No Results

```typescript
const results = await vectorIndex.search("test query");
// results: []
```

**Causes:**
1. Index is empty
2. No content matches (all similarity below threshold)
3. Wrong type filter

**Debug:**

```typescript
// Check if index has data
const all = await vectorIndex.table?.query().limit(10).toArray();
console.log('Index entries:', all?.length);

// Search without type filter
const results = await vectorIndex.search("test", undefined, 10);
console.log('Results:', results);
```

### Embedding API Errors

```
Error: OpenRouter API error: 429 - Rate limit exceeded
```

**Causes:**
1. Too many embedding requests
2. API key issues

**Fix:**
- Batch indexing operations
- Implement retry with backoff
- Check API key balance

### Stale Index Data

```typescript
// Page updated but search returns old data
```

**Cause:** Index not updated on content change.

**Fix:** Ensure index operations in service layer:

```typescript
async updatePage(pageId: string, data: Partial<Page>) {
  const page = await db.update(pages).set(data).where(...).returning();

  // Re-index with new content
  await this.vectorIndex.update(pageId, {
    type: "page",
    name: page.name,
    slug: page.slug,
    searchableText: `${page.name} ${page.slug}`,
    metadata: {...},
  });
}
```

### Vector Dimension Mismatch

```
Error: Vector dimension mismatch: expected 1536, got 768
```

**Cause:** Switched embedding model with different dimensions.

**Fix:** Reindex everything with consistent model:

```bash
# Clear and rebuild index
rm -rf vector_index/
pnpm reindex:vector
```

### Low Similarity Scores

```typescript
// All results have similarity < 0.5
const results = await vectorIndex.search("very specific query");
// [{ similarity: 0.32 }, { similarity: 0.28 }, ...]
```

**Causes:**
1. Content doesn't match query semantically
2. Searchable text too short/generic
3. Query too specific for indexed content

**Improve:** Enrich searchableText:

```typescript
// Before: Just title
searchableText: page.name

// After: Include more context
searchableText: `${page.name} ${page.slug} ${page.meta?.description} ${sectionTitles.join(" ")}`
```

---

## Reindexing

Full reindex script for recovery or model changes:

```typescript
// scripts/reindex-vector.ts
async function reindex() {
  const vectorIndex = new VectorIndexService("./vector_index");
  await vectorIndex.initialize();

  // Clear existing
  await vectorIndex.table?.delete("id IS NOT NULL");

  // Reindex pages
  const allPages = await db.select().from(pages);
  for (const page of allPages) {
    await vectorIndex.add({
      id: page.id,
      type: "page",
      name: page.name,
      slug: page.slug,
      searchableText: `${page.name} ${page.slug}`,
      metadata: {},
    });
  }

  // Reindex images with metadata
  const allImages = await db.select()
    .from(images)
    .leftJoin(imageMetadata, eq(images.id, imageMetadata.imageId))
    .where(eq(images.status, "completed"));

  for (const { images: img, image_metadata: meta } of allImages) {
    if (meta) {
      await vectorIndex.addImage({...});
    }
  }

  console.log("✅ Reindex complete");
}
```

---

## Further Reading

- [Layer 2.4: Image Storage](./LAYER_2.4_IMAGE_STORAGE.md) - Image metadata for indexing
- [Layer 5: Background Processing](./LAYER_5_BACKGROUND.md) - When images are indexed
- [Layer 3.2: Tools](./LAYER_3.2_TOOLS.md) - Search tools for agent
- [LanceDB Documentation](https://lancedb.github.io/lancedb/)
- [OpenRouter Embeddings](https://openrouter.ai/docs#embeddings)
