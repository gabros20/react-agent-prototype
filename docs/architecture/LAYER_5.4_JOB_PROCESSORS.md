# Layer 5.4: Job Processors

> Metadata generation, variant creation, embedding indexing implementations

## Overview

Job processors are the functions that execute the actual work for each job type. The image processing pipeline consists of three processors: metadata generation (GPT-4o-mini vision), variant generation (Sharp), and embedding indexing (OpenRouter). Each processor updates progress, chains to the next job, and updates database records.

**Key Responsibilities:**
- Generate AI-powered image metadata
- Create responsive image variants
- Index images for semantic search
- Report progress during processing
- Chain jobs in pipeline sequence

---

## The Problem

Without structured job processors:

```typescript
// WRONG: All processing in one giant function
async function processImage(imageId) {
  // 500 lines of mixed concerns
  // No progress tracking
  // No error isolation
  // No chaining control
}

// WRONG: No progress updates
await generateMetadata(buffer);  // User waits with no feedback

// WRONG: Tight coupling
const metadata = await generateMetadata(buffer);
await generateVariants(imageId, buffer);  // Can't run independently
await generateEmbeddings(metadata);

// WRONG: No fallbacks
const metadata = await generateMetadata(buffer);  // Fails → whole pipeline fails
```

**Our Solution:**
1. Separate processor function per job type
2. Progress updates at each stage
3. Explicit job chaining via queue.add()
4. Fallback metadata on AI failure
5. Continue pipeline even if embeddings fail

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    JOB PROCESSOR PIPELINE                     │
│                                                               │
│  Upload Complete                                              │
│       │                                                       │
│       ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              processMetadata(job)                       │  │
│  │                                                         │  │
│  │  1. Read file from disk          (10%)                  │  │
│  │  2. Generate metadata via GPT-4o (50%)                  │  │
│  │  3. Store in image_metadata      (80%)                  │  │
│  │  4. Queue embeddings job         (100%)                 │  │
│  │                                                         │  │
│  │  Input:  { imageId, filePath }                          │  │
│  │  Output: { description, tags, colors, mood, ... }       │  │
│  └─────────────────────────────────────────────────────────┘  │
│       │                                                       │
│       ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              processVariants(job)                       │  │
│  │                                                         │  │
│  │  1. Read original image          (10%)                  │  │
│  │  2. Generate 6 variants          (60%)                  │  │
│  │     • 640w, 1024w, 1920w                                │  │
│  │     • WebP + AVIF formats                               │  │
│  │  3. Store in image_variants      (100%)                 │  │
│  │                                                         │  │
│  │  Input:  { imageId, filePath }                          │  │
│  │  Output: [{ variantType, format, width, path }, ...]    │  │
│  └─────────────────────────────────────────────────────────┘  │
│       │                                                       │
│       ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │            processEmbeddings(job)                       │  │
│  │                                                         │  │
│  │  1. Get searchableText from metadata   (10%)            │  │
│  │  2. Generate embeddings via OpenRouter (90%)            │  │
│  │  3. Index in LanceDB vector store                       │  │
│  │  4. Update image status to "completed" (100%)           │  │
│  │                                                         │  │
│  │  Input:  { imageId, metadata, filePath }                │  │
│  │  Output: { indexed: true }                              │  │
│  │                                                         │  │
│  │  Note: Embeddings failure doesn't fail the pipeline     │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/workers/image-worker.ts` | Processor function definitions |
| `server/services/ai/metadata-generation.service.ts` | GPT-4o-mini integration |
| `server/services/storage/image-storage.service.ts` | Variant generation |
| `server/services/vector-index.ts` | Embedding storage |

---

## Core Implementation

### Metadata Processor

```typescript
// server/workers/image-worker.ts
async function processMetadata(job: any) {
  const { imageId, filePath } = job.data;

  await job.updateProgress(10);

  // Read file from disk
  const fullPath = path.join(uploadsDir, filePath);
  const buffer = await fs.readFile(fullPath);

  await job.updateProgress(20);

  // Generate metadata with GPT-4o-mini
  const metadata = await generateImageMetadata(buffer);

  await job.updateProgress(50);

  // Store in database
  await db.insert(imageMetadata).values({
    id: randomUUID(),
    imageId,
    description: metadata.description,
    detailedDescription: metadata.detailedDescription,
    tags: JSON.stringify(metadata.tags),
    categories: JSON.stringify(metadata.categories),
    objects: JSON.stringify(metadata.objects),
    colors: JSON.stringify(metadata.colors),
    mood: metadata.mood,
    style: metadata.style,
    composition: JSON.stringify(metadata.composition),
    searchableText: metadata.searchableText,
    generatedAt: new Date(),
    model: "gpt-4o-mini",
  });

  await job.updateProgress(80);

  // Chain to embeddings job
  await imageQueue.add(
    "generate-embeddings",
    { imageId, metadata, filePath },
    { jobId: `embeddings-${imageId}` }
  );

  await job.updateProgress(100);
}
```

### GPT-4o-mini Vision Call

```typescript
// server/services/ai/metadata-generation.service.ts
export async function generateImageMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
  const base64Image = imageBuffer.toString("base64");
  const mimeType = detectImageMimeType(imageBuffer);

  const response = await openai.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this image and provide detailed metadata in JSON format.

Focus on:
1. A clear, descriptive summary (1-2 sentences)
2. A detailed description (3-4 sentences for accessibility)
3. Specific, searchable tags and keywords (8-12 tags)
4. High-level categories (2-4 categories)
5. Identified objects with confidence scores (0.0-1.0)
6. Dominant colors and color palette
7. Overall mood and visual style
8. Composition details (orientation, main subject, background)

Return ONLY valid JSON matching this structure:
{
  "description": "string",
  "detailedDescription": "string",
  "tags": ["string"],
  "categories": ["string"],
  "objects": [{"name": "string", "confidence": 0.0-1.0}],
  "colors": {"dominant": ["string"], "palette": ["string"]},
  "mood": "string",
  "style": "string",
  "composition": {
    "orientation": "landscape|portrait|square",
    "subject": "string",
    "background": "string"
  }
}`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "low",  // 85 tokens - cost optimization
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const parsed = JSON.parse(response.choices[0].message.content);

  // Create searchable text
  const searchableText = [
    parsed.description,
    parsed.detailedDescription || "",
    ...(parsed.tags || []),
    ...(parsed.categories || []),
    ...(parsed.objects || []).map((o) => o.name),
  ].join(" ").toLowerCase();

  return { ...parsed, searchableText };
}
```

### Variants Processor

```typescript
async function processVariants(job: any) {
  const { imageId, filePath } = job.data;

  await job.updateProgress(10);

  const variants = await imageStorageService.generateVariants(imageId, filePath);

  await job.updateProgress(60);

  // Store variants in database
  for (const variant of variants) {
    await db.insert(imageVariants).values({
      id: randomUUID(),
      imageId,
      variantType: variant.variantType,
      format: variant.format,
      width: variant.width,
      height: variant.height,
      fileSize: variant.fileSize,
      filePath: variant.filePath,
      createdAt: new Date(),
    });
  }

  await job.updateProgress(100);
}
```

### Embeddings Processor

```typescript
async function processEmbeddings(job: any) {
  const { imageId, metadata, filePath } = job.data;

  await job.updateProgress(10);

  try {
    const { default: vectorIndex } = await import("../services/vector-index");

    await job.updateProgress(30);

    // Add to vector index (generates embeddings internally)
    await vectorIndex.add({
      id: imageId,
      type: "image",
      name: path.basename(filePath || "image"),
      slug: path.basename(filePath || "image"),
      searchableText: metadata.searchableText,
      metadata: {
        description: metadata.description,
        tags: metadata.tags,
        categories: metadata.categories,
        colors: metadata.colors.dominant || [],
        mood: metadata.mood,
        style: metadata.style,
      },
    });

    await job.updateProgress(90);
  } catch (error) {
    console.error(`Failed to generate embeddings for ${imageId}:`, error);
    // Continue - image is still usable without embeddings
  }

  // Always update status to completed
  await db
    .update(images)
    .set({
      status: "completed",
      processedAt: new Date(),
    })
    .where(eq(images.id, imageId));

  await job.updateProgress(100);
}
```

---

## Design Decisions

### Why Separate Metadata and Variants Jobs?

```typescript
// Dispatched in parallel from processImage
await imageQueue.add("generate-metadata", { ... });
await imageQueue.add("generate-variants", { ... });
```

**Reasons:**
1. **Independence** - Variants don't need metadata
2. **Parallelism** - Can run concurrently
3. **Isolation** - Metadata failure doesn't block variants
4. **Different resources** - AI vs Sharp processing

### Why Chain Embeddings from Metadata?

```typescript
// In processMetadata
await imageQueue.add("generate-embeddings", { imageId, metadata, filePath });
```

**Reasons:**
1. **Dependency** - Embeddings need metadata.searchableText
2. **Sequencing** - Must complete metadata first
3. **Data passing** - Metadata flows to embeddings job
4. **Pipeline clarity** - Explicit dependency graph

### Why detail: "low" for Vision?

```typescript
image_url: {
  url: `data:${mimeType};base64,${base64Image}`,
  detail: "low",  // 85 tokens vs 1105+ for high
}
```

**Reasons:**
1. **Cost** - 85 tokens vs 1105+ tokens
2. **Speed** - Faster processing
3. **Sufficient** - Good enough for tags/colors/mood
4. **Metadata focus** - Not detailed analysis

### Why Continue on Embeddings Failure?

```typescript
try {
  await vectorIndex.add({ ... });
} catch (error) {
  console.error("Failed to generate embeddings:", error);
  // Continue - don't throw
}

// Always mark completed
await db.update(images).set({ status: "completed" });
```

**Reasons:**
1. **Graceful degradation** - Image still usable
2. **Search fallback** - Can search by filename/tags
3. **User expectation** - Upload succeeded
4. **Retry later** - Can regenerate embeddings

### Why Store JSON Strings?

```typescript
tags: JSON.stringify(metadata.tags),
colors: JSON.stringify(metadata.colors),
```

**Reasons:**
1. **SQLite compatibility** - No native JSON column
2. **Simple parsing** - JSON.parse() on read
3. **Flexible schema** - Add fields without migration
4. **Queryable** - Can use JSON functions if needed

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 5.2 (Queue) | Jobs dispatched via imageQueue.add() |
| Layer 5.3 (Worker) | Worker calls processor functions |
| Layer 4.3 (Vector Index) | Embeddings stored in LanceDB |
| Layer 4.4 (Image Processing) | Variants via ImageStorageService |
| External (OpenRouter) | GPT-4o-mini and embeddings API |

### Metadata Schema

```typescript
export interface ImageMetadata {
  description: string;
  detailedDescription?: string;
  tags: string[];
  categories: string[];
  objects: Array<{ name: string; confidence: number }>;
  colors: {
    dominant: string[];
    palette: string[];
  };
  mood: string;
  style: string;
  composition: {
    orientation: "landscape" | "portrait" | "square";
    subject: string;
    background: string;
  };
  searchableText: string;
}
```

---

## Common Issues / Debugging

### Metadata Generation Timeout

```
Error: Request timeout after 30s
```

**Cause:** GPT-4o-mini taking too long.

**Fix:** Use pRetry with retries:

```typescript
const metadata = await pRetry(
  () => generateImageMetadata(buffer),
  { retries: 3 }
);
```

### Invalid JSON from GPT-4o

```
SyntaxError: Unexpected token in JSON
```

**Cause:** Model didn't return valid JSON.

**Fix:** Use `response_format: { type: "json_object" }`:

```typescript
await openai.chat.completions.create({
  ...options,
  response_format: { type: "json_object" },
});
```

### Variants Not Created

```
// image_variants table empty
```

**Debug:**

```typescript
const fullPath = path.join(uploadsDir, filePath);
console.log("Path exists:", await fs.access(fullPath).then(() => true).catch(() => false));
```

**Cause:** Original file missing or wrong path.

### Embeddings All Zero

```
// Vector search returns nothing
```

**Cause:** OpenRouter embedding call failed silently.

**Debug:**

```typescript
// In processEmbeddings
console.log("searchableText:", metadata.searchableText);
console.log("vectorIndex.add result:", result);
```

### Progress Not Updating

```
// job.progress stays at 0
```

**Cause:** updateProgress not called or job completed too fast.

**Fix:** Ensure await on updateProgress:

```typescript
await job.updateProgress(50);  // Must await
```

### File Not Found

```
Error: ENOENT: no such file or directory
```

**Cause:** Original file deleted before processing.

**Fix:** Ensure file exists:

```typescript
const fullPath = path.join(uploadsDir, filePath);
try {
  await fs.access(fullPath);
} catch {
  throw new Error(`Original file missing: ${filePath}`);
}
```

---

## Further Reading

- [Layer 5.3: Worker Lifecycle](./LAYER_5.3_WORKER_LIFECYCLE.md) - Worker setup
- [Layer 5.5: Retry & Error](./LAYER_5.5_RETRY_AND_ERROR.md) - Error handling
- [Layer 4.3: Vector Index](./LAYER_4.3_VECTOR_INDEX.md) - Embedding storage
- [Layer 4.4: Image Processing](./LAYER_4.4_IMAGE_PROCESSING.md) - Upload pipeline
- [OpenRouter Vision Docs](https://openrouter.ai/docs)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
