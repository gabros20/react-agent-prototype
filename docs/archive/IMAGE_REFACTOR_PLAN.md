# Image Handling System - Complete Refactor Plan

**Date:** November 22, 2025
**Status:** Planning Phase
**Goal:** Clean, focused implementation without dead code, redundancy, or hacks

---

## 🎯 Key Finding: OpenRouter Already Working!

**GREAT NEWS:** Your system is **already using OpenRouter's unified embeddings API** correctly!

- ✅ Endpoint: `https://openrouter.ai/api/v1/embeddings`
- ✅ Model: `openai/text-embedding-3-small` (1536 dims)
- ✅ Auth: Same `OPENROUTER_API_KEY` as GPT-4o-mini
- ✅ Cost: $0.02 per million tokens (extremely cheap)
- ✅ Context: 8,192 tokens

**What needs fixing:**
- ❌ Remove broken CLIP code (never worked)
- ❌ Delete redundant `embedding-generation.service.ts`
- ❌ Fix the issues flagged in audit (transactions, singletons, etc.)

**Bottom line:** The embedding strategy is perfect. We just need to clean up the mess around it.

---

## Executive Summary

### What's Already Working ✅

**IMPORTANT:** The core embedding infrastructure is **already correctly implemented**!

Current `vector-index.ts` (lines 296-335):
```typescript
private async embed(text: string): Promise<number[]> {
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  });
  const data = await response.json();
  return data.data[0].embedding; // 1536 dimensions
}
```

✅ **OpenRouter embeddings API** - Already using unified platform
✅ **GPT-4o-mini metadata generation** - Excellent quality, cost-effective
✅ **Database schema** - Well-designed, proper relationships
✅ **File storage structure** - Date-based organization works
✅ **Security validation** - Magic bytes, path traversal protection
✅ **BullMQ async processing** - Solid queue architecture
✅ **Agent tools** - Natural language image operations

### What We're Removing (Dead/Broken)
❌ **CLIP image embeddings** - Never worked, incomplete implementation
❌ **Dual embedding system** - Confusing, dimension mismatch
❌ **imageProcessingQueue table** - Redundant, BullMQ already tracks jobs
❌ **CDN placeholder code** - Not implemented, just clutter
❌ **Multiple service instances** - Anti-pattern
❌ **Buffers in Redis** - Memory leak waiting to happen

### New Simplified Architecture

```
User uploads image
    ↓
ImageProcessingService (singleton)
    ↓
├── Save to filesystem (ImageStorageService)
├── Insert DB record (with transaction)
├── Queue metadata job → Worker generates metadata with GPT-4o-mini
├── Queue variants job → Worker generates WebP/AVIF variants
└── Queue embeddings job → Worker generates TEXT embeddings from metadata
    ↓
Search using OpenAI text-embedding-3-small (unified embedding strategy)
```

**Key Principle:** One embedding model (OpenAI via OpenRouter), text-only, from rich GPT-4o-mini metadata.

### Available OpenRouter Embedding Models

**Recommended (Current):**
- `openai/text-embedding-3-small` - **1536 dims**, $0.02/M tokens, 8K context ✅
- Best balance of cost, quality, and compatibility

**Alternatives (if needed):**
- `openai/text-embedding-3-large` - **3072 dims**, higher quality, more expensive
- `qwen/qwen3-embedding-8b` - Lower cost alternative
- `qwen/qwen3-embedding-0.6b` - Fastest, cheapest option

**Note:** Stick with `text-embedding-3-small` - it's perfect for this use case.

---

## Original Requirements Analysis

### Core Features Needed
1. ✅ Upload images in chat
2. ✅ Auto-generate rich metadata (GPT-4o-mini)
3. ✅ Semantic search by natural language
4. ✅ Deduplication by hash
5. ✅ Agent tools for image operations
6. ✅ Responsive image variants

### Features NOT Needed (Over-engineering)
- ❌ Visual CLIP embeddings (metadata text is sufficient)
- ❌ Dual embedding systems
- ❌ CDN integration (can add later if needed)
- ❌ Custom queue tracking table (BullMQ handles this)

---

## Architecture Decisions

### 1. Single Embedding Strategy ✅

**DECISION:** Use OpenRouter's unified embeddings API with `openai/text-embedding-3-small`

**Rationale:**
- ✅ **Already implemented correctly** - Using `https://openrouter.ai/api/v1/embeddings`
- ✅ **Unified platform** - Same API key as GPT-4o-mini (OPENROUTER_API_KEY)
- ✅ **Cost-effective** - $0.02 per million tokens (extremely cheap)
- ✅ **1536 dimensions** - Industry standard, perfect for LanceDB
- ✅ **8,192 token context** - Handles long metadata descriptions
- ✅ **No additional setup** - Already configured and working
- ✅ **Rich metadata** - GPT-4o-mini provides excellent search quality
- ❌ **No visual embeddings needed** - Text from AI is sufficient

**Example:**
```typescript
// Image: puppy.jpg
// GPT-4o-mini generates:
{
  description: "Golden retriever puppy playing in green grass",
  tags: ["puppy", "golden retriever", "dog", "grass", "outdoor", "playful"],
  objects: [
    { name: "dog", confidence: 0.98 },
    { name: "grass", confidence: 0.95 }
  ],
  colors: { dominant: ["golden", "green"] }
}

// Searchable text: "Golden retriever puppy playing in green grass puppy golden retriever dog grass outdoor playful dog grass"

// Embedded via OpenRouter:
const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'openai/text-embedding-3-small',
    input: searchableText
  })
});
// Returns: 1536-dimensional vector

// Search query: "find the dog photo" → High similarity match ✅
```

### 2. Transaction-Based Operations ✅

**DECISION:** Wrap all multi-table operations in database transactions

**Before (Current - Broken):**
```typescript
await db.insert(images).values({...}); // Operation 1
await db.insert(conversationImages).values({...}); // Operation 2 - might fail!
// Result: Orphaned image record
```

**After (Refactored):**
```typescript
await db.transaction(async (tx) => {
  await tx.insert(images).values({...});
  await tx.insert(conversationImages).values({...});
  // All or nothing
});
```

### 3. Singleton Services ✅

**DECISION:** Export singleton instances, no `new` in routes

**Before (Current - Anti-pattern):**
```typescript
// routes/upload.ts
const processingService = new ImageProcessingService();

// routes/images.ts
const processingService = new ImageProcessingService();

// tools/image-tools.ts
const processingService = new ImageProcessingService();
```

**After (Refactored):**
```typescript
// services/image-processing.service.ts
export default new ImageProcessingService();

// Everywhere else:
import imageProcessingService from '../services/image-processing.service';
```

### 4. Path-Only in Queue Jobs ✅

**DECISION:** Never store buffers in Redis, only file paths

**Before (Current - Memory Leak):**
```typescript
await imageQueue.add('generate-metadata', {
  imageId,
  buffer: imageBuffer // Storing 5MB in Redis!
});
```

**After (Refactored):**
```typescript
await imageQueue.add('generate-metadata', {
  imageId,
  filePath: '/images/2025/11/22/original/abc.jpg'
});

// Worker reads file:
const buffer = await fs.readFile(path.join(uploadsDir, job.data.filePath));
```

### 5. Simplified Error Handling ✅

**DECISION:** Let transactions handle race conditions, add proper status tracking

**Before (Current - Hack):**
```typescript
try {
  await db.insert(images).values({...});
} catch (error) {
  if (error.message.includes("UNIQUE constraint")) {
    // Catch race condition, clean up file
  }
}
```

**After (Refactored):**
```typescript
await db.transaction(async (tx) => {
  // Check with row lock
  const existing = await tx.query.images.findFirst({
    where: eq(images.sha256Hash, sha256),
    for: 'update'
  });

  if (existing) {
    return { imageId: existing.id, isNew: false };
  }

  await tx.insert(images).values({...});
  return { imageId, isNew: true };
});
```

---

## Refactored Database Schema

### Tables to KEEP

**1. images** - Core table ✅
```sql
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  storage_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  cdn_url TEXT,
  thumbnail_data BLOB,  -- Keep for now, optimize later
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  sha256_hash TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  error TEXT,
  uploaded_at INTEGER NOT NULL,
  processed_at INTEGER
);

CREATE INDEX idx_images_status ON images(status);
CREATE INDEX idx_images_sha256 ON images(sha256_hash);
```

**2. image_metadata** - AI-generated data ✅
```sql
CREATE TABLE image_metadata (
  id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL UNIQUE REFERENCES images(id) ON DELETE CASCADE,
  description TEXT,
  detailed_description TEXT,
  tags TEXT, -- JSON array
  categories TEXT, -- JSON array
  objects TEXT, -- JSON array of {name, confidence}
  colors TEXT, -- JSON {dominant: [], palette: []}
  mood TEXT,
  style TEXT,
  composition TEXT, -- JSON {orientation, subject, background}
  searchable_text TEXT NOT NULL,
  alt_text TEXT,
  caption TEXT,
  generated_at INTEGER,
  model TEXT
);

CREATE INDEX idx_metadata_image ON image_metadata(image_id);
```

**3. image_variants** - Responsive formats ✅
```sql
CREATE TABLE image_variants (
  id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL, -- small, medium, large
  format TEXT NOT NULL, -- webp, avif
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  file_size INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  cdn_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_variants_image ON image_variants(image_id);
CREATE INDEX idx_variants_type ON image_variants(image_id, variant_type);
```

**4. conversation_images** - Link to chat sessions ✅
```sql
CREATE TABLE conversation_images (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  message_id TEXT,
  uploaded_at INTEGER NOT NULL,
  order_index INTEGER
);

CREATE INDEX idx_conv_images_session ON conversation_images(session_id);
CREATE INDEX idx_conv_images_image ON conversation_images(image_id);
```

**5. page_section_images** - Link to CMS sections ✅
```sql
CREATE TABLE page_section_images (
  id TEXT PRIMARY KEY,
  page_section_id TEXT NOT NULL REFERENCES page_sections(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  sort_order INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX idx_section_images_section ON page_section_images(page_section_id);
CREATE INDEX idx_section_images_image ON page_section_images(image_id);
```

### Tables to REMOVE

**❌ image_processing_queue** - Completely redundant
```sql
-- DELETE THIS TABLE
-- BullMQ already tracks all job state in Redis
-- This just duplicates functionality and adds complexity
DROP TABLE IF EXISTS image_processing_queue;
```

---

## Refactored Service Architecture

### File Structure (Cleaned Up)

```
server/
├── services/
│   ├── image-processing.service.ts    ✅ Main orchestrator (singleton)
│   ├── image-storage.service.ts       ✅ Filesystem ops (singleton)
│   ├── metadata-generation.service.ts ✅ GPT-4o-mini (stateless)
│   ├── embedding-generation.service.ts ❌ DELETE (redundant)
│   └── vector-index.ts                 ✅ Keep, simplify embeddings
├── workers/
│   └── image-worker.ts                 ✅ BullMQ worker (refactored)
├── queues/
│   └── image-queue.ts                  ✅ Queue setup (simplified)
├── routes/
│   ├── upload.ts                       ✅ Upload endpoint (use singleton)
│   └── images.ts                       ✅ Image APIs (use singleton)
├── tools/
│   └── image-tools.ts                  ✅ Agent tools (use singleton)
├── middleware/
│   └── upload.ts                       ✅ Multer + validation
└── utils/
    ├── hash.ts                         ✅ SHA256 generation
    └── file-validation.ts              ✅ Security validation
```

### Service Responsibilities (Clarified)

**ImageProcessingService** (Main Orchestrator)
- Deduplication check
- Save to storage
- Database transaction for image + conversation link
- Queue async jobs
- Get image details
- Delete images (cascade to all systems)

**ImageStorageService** (Filesystem Operations)
- Save files to date-based directories
- Generate thumbnails
- Generate responsive variants (WebP, AVIF)
- Delete files and variants
- Clean path handling

**MetadataGenerationService** (AI Analysis)
- Send image to GPT-4o-mini
- Parse structured JSON response
- Retry logic with exponential backoff
- Fallback metadata on failure

**VectorIndexService** (Search)
- Generate embeddings with OpenAI text-embedding-3-small
- Add/update/delete image records
- Vector similarity search
- Single best match finder

---

## Refactored Code Structure

### 1. ImageProcessingService (Singleton)

```typescript
// server/services/image-processing.service.ts
import { ImageStorageService } from './image-storage.service';
import { db } from '../db/client';
import { images, conversationImages } from '../db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { generateSHA256 } from '../utils/hash';
import { imageQueue } from '../queues/image-queue';
import path from 'path';

class ImageProcessingService {
  constructor(
    private storage = new ImageStorageService(),
    private uploadsDir = process.env.UPLOADS_DIR || './uploads'
  ) {}

  /**
   * Main entry: process uploaded image with deduplication
   */
  async processImage(params: {
    buffer: Buffer;
    filename: string;
    sessionId: string;
    mediaType?: string;
  }): Promise<{ imageId: string; isNew: boolean; status: string }> {
    const sha256 = generateSHA256(params.buffer);

    // Transaction: check duplicate + insert
    const result = await db.transaction(async (tx) => {
      // Check for duplicate with row lock
      const existing = await tx.query.images.findFirst({
        where: eq(images.sha256Hash, sha256)
      });

      if (existing) {
        // Link to conversation
        await tx.insert(conversationImages).values({
          id: randomUUID(),
          sessionId: params.sessionId,
          imageId: existing.id,
          uploadedAt: new Date()
        });

        return { imageId: existing.id, isNew: false };
      }

      // Save to storage
      const stored = await this.storage.saveImage(params.buffer, {
        filename: params.filename,
        mediaType: params.mediaType || 'image/jpeg'
      });

      const imageId = stored.id;
      const ext = path.extname(params.filename);

      // Insert image record
      await tx.insert(images).values({
        id: imageId,
        filename: imageId + ext,
        originalFilename: params.filename,
        mediaType: params.mediaType || 'image/jpeg',
        storageType: 'filesystem',
        filePath: stored.originalPath,
        cdnUrl: null,
        thumbnailData: stored.thumbnailBuffer,
        fileSize: params.buffer.length,
        width: stored.width,
        height: stored.height,
        sha256Hash: sha256,
        status: 'processing',
        uploadedAt: new Date()
      });

      // Link to conversation
      await tx.insert(conversationImages).values({
        id: randomUUID(),
        sessionId: params.sessionId,
        imageId,
        uploadedAt: new Date()
      });

      return { imageId, isNew: true };
    });

    // Queue async jobs (outside transaction)
    if (result.isNew) {
      const image = await db.query.images.findFirst({
        where: eq(images.id, result.imageId)
      });

      if (image) {
        await imageQueue.add('generate-metadata', {
          imageId: result.imageId,
          filePath: image.filePath
        }, { jobId: `metadata-${result.imageId}` });

        await imageQueue.add('generate-variants', {
          imageId: result.imageId,
          filePath: image.filePath
        }, { jobId: `variants-${result.imageId}` });
      }
    }

    return {
      imageId: result.imageId,
      isNew: result.isNew,
      status: result.isNew ? 'processing' : 'completed'
    };
  }

  async getImageWithDetails(imageId: string) {
    // Implementation...
  }

  async getImageStatus(imageId: string) {
    // Implementation...
  }

  async deleteImage(imageId: string) {
    // Implementation...
  }

  async getConversationImages(sessionId: string) {
    // Implementation...
  }
}

// Export singleton
export default new ImageProcessingService();
```

### 2. VectorIndexService (Simplified)

```typescript
// server/services/vector-index.ts
import { connect } from '@lancedb/lancedb';

export class VectorIndexService {
  // ... existing code ...

  /**
   * Unified embedding generation using OpenAI
   */
  private async embed(text: string): Promise<number[]> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = 'openai/text-embedding-3-small'; // Fixed model

    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
        'X-Title': 'ReAct CMS Agent'
      },
      body: JSON.stringify({
        model,
        input: text.slice(0, 8000)
      })
    });

    const data = await response.json();
    return data.data[0].embedding; // 1536 dimensions
  }

  /**
   * Add image to vector index (text embeddings only)
   */
  async addImage(data: {
    id: string;
    filename: string;
    searchableText: string;
    metadata: Record<string, any>;
  }): Promise<void> {
    if (!this.table) await this.initialize();

    // Generate embedding from searchable text
    const embedding = await this.embed(data.searchableText);

    const record = {
      id: data.id,
      type: 'image',
      name: data.filename,
      slug: data.filename,
      searchableText: data.searchableText,
      metadataJson: JSON.stringify(data.metadata),
      embedding, // 1536-dim OpenAI embedding
      updatedAt: Date.now()
    };

    await this.table?.add([record]);
  }

  /**
   * Search images by natural language
   */
  async searchImages(query: string, limit = 10): Promise<any[]> {
    if (!this.table) await this.initialize();

    // Generate query embedding (same model)
    const queryEmbedding = await this.embed(query);

    const results = await this.table
      ?.vectorSearch(queryEmbedding)
      .where("type = 'image'")
      .limit(limit)
      .toArray();

    return results?.map((r: any) => ({
      id: r.id,
      filename: r.name,
      description: r.searchableText.split(' ').slice(0, 20).join(' '),
      score: r._distance ? 1 - r._distance : 0,
      metadata: JSON.parse(r.metadataJson || '{}')
    })) || [];
  }

  // ... rest of methods ...
}

export default new VectorIndexService(
  process.env.LANCEDB_DIR || './data/lancedb'
);
```

### 3. Worker (Simplified)

```typescript
// server/workers/image-worker.ts
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../db/client';
import { images, imageMetadata, imageVariants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { generateImageMetadata } from '../services/metadata-generation.service';
import ImageStorageService from '../services/image-storage.service';
import vectorIndex from '../services/vector-index';

const uploadsDir = process.env.UPLOADS_DIR || './uploads';

const worker = new Worker(
  'image-processing',
  async (job) => {
    const { imageId } = job.data;

    if (job.name === 'generate-metadata') {
      await processMetadata(job);
    } else if (job.name === 'generate-variants') {
      await processVariants(job);
    } else if (job.name === 'generate-embeddings') {
      await processEmbeddings(job);
    }

    return { success: true, imageId };
  },
  {
    connection: new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: null
    }),
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60000
    }
  }
);

async function processMetadata(job: any) {
  const { imageId, filePath } = job.data;

  // Read file from disk (not from Redis!)
  const buffer = await fs.readFile(path.join(uploadsDir, filePath));

  // Generate metadata
  const metadata = await generateImageMetadata(buffer);

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
    model: 'gpt-4o-mini'
  });

  // Queue embeddings job
  await imageQueue.add('generate-embeddings', {
    imageId,
    searchableText: metadata.searchableText,
    metadata: {
      tags: metadata.tags,
      categories: metadata.categories,
      colors: metadata.colors.dominant || [],
      mood: metadata.mood,
      style: metadata.style
    }
  }, { jobId: `embeddings-${imageId}` });
}

async function processVariants(job: any) {
  const { imageId, filePath } = job.data;

  const variants = await ImageStorageService.generateVariants(imageId, filePath);

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
      createdAt: new Date()
    });
  }
}

async function processEmbeddings(job: any) {
  const { imageId, searchableText, metadata } = job.data;

  // Add to vector index (generates embeddings internally)
  await vectorIndex.addImage({
    id: imageId,
    filename: (await db.query.images.findFirst({
      where: eq(images.id, imageId)
    }))?.filename || 'unknown',
    searchableText,
    metadata
  });

  // Mark image as completed
  await db.update(images)
    .set({
      status: 'completed',
      processedAt: new Date()
    })
    .where(eq(images.id, imageId));
}

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} (${job.name}) completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

console.log('🚀 Image processing worker started');
```

---

## Migration Plan

### Phase 1: Cleanup (Week 1)

**Day 1-2: Remove Dead Code**
- [ ] Delete `embedding-generation.service.ts`
- [ ] Remove `imageProcessingQueue` table from schema
- [ ] Remove CDN placeholder code
- [ ] Remove CLIP dependencies from package.json
- [ ] Update imports across codebase

**Day 3-4: Fix Critical Issues**
- [ ] Add database transactions to `processImage()`
- [ ] Remove buffers from queue jobs
- [ ] Convert to singleton pattern
- [ ] Fix path handling consistency

**Day 5: Testing & Verification**
- [ ] Test upload → metadata → search flow
- [ ] Verify no orphaned records
- [ ] Check memory usage (no buffer leaks)
- [ ] Validate vector search quality

### Phase 2: Architecture Improvements (Week 2)

**Day 1-2: Standardize APIs**
- [ ] Create `ApiResponse<T>` type
- [ ] Apply to all endpoints
- [ ] Add pagination to search
- [ ] Consistent error formats

**Day 3-4: Add Missing Features**
- [ ] Rate limiting on upload
- [ ] Structured logging (Winston)
- [ ] Correlation IDs
- [ ] Database indexes

**Day 5: Documentation**
- [ ] Update README
- [ ] API documentation
- [ ] Architecture diagrams
- [ ] Deployment guide

### Phase 3: Testing & Hardening (Week 3)

**Day 1-3: Write Tests**
- [ ] Unit tests for services
- [ ] Integration tests for API
- [ ] E2E tests for workflows
- [ ] Load testing

**Day 4-5: Security Audit**
- [ ] Parameterized queries
- [ ] Input validation
- [ ] Rate limiting
- [ ] Penetration testing

---

## Implementation Checklist

### Core Services

- [ ] **ImageProcessingService**
  - [ ] Refactor to singleton
  - [ ] Add transaction support
  - [ ] Remove buffer passing
  - [ ] Clean error handling

- [ ] **ImageStorageService**
  - [ ] Keep current implementation
  - [ ] Verify path handling works
  - [ ] Add parallel variant generation

- [ ] **MetadataGenerationService**
  - [ ] Keep current implementation
  - [ ] Add MIME type detection
  - [ ] Verify retry logic

- [ ] **VectorIndexService**
  - [ ] Remove CLIP code
  - [ ] Unify on OpenAI embeddings
  - [ ] Simplify addImage method
  - [ ] Fix SQL injection risk

### Database

- [ ] **Schema Migration**
  - [ ] Drop imageProcessingQueue table
  - [ ] Add missing indexes
  - [ ] Update relations

- [ ] **Transaction Support**
  - [ ] Wrap multi-table inserts
  - [ ] Add row locking where needed
  - [ ] Test rollback scenarios

### Worker & Queue

- [ ] **image-worker.ts**
  - [ ] Read files from disk
  - [ ] Remove redundant queue tracking
  - [ ] Simplify job handlers
  - [ ] Better error logging

- [ ] **image-queue.ts**
  - [ ] Keep current config
  - [ ] Update job interfaces
  - [ ] Remove buffer types

### Routes & Tools

- [ ] **upload.ts**
  - [ ] Use singleton service
  - [ ] Add rate limiting
  - [ ] Standardize responses

- [ ] **images.ts**
  - [ ] Use singleton service
  - [ ] Add pagination
  - [ ] Standardize responses

- [ ] **image-tools.ts**
  - [ ] Use singleton service
  - [ ] Fix TypeScript types
  - [ ] Remove @ts-expect-error

### Testing

- [ ] **Unit Tests**
  - [ ] File validation
  - [ ] Metadata generation
  - [ ] Deduplication logic

- [ ] **Integration Tests**
  - [ ] Upload flow
  - [ ] Search accuracy
  - [ ] Transaction rollback

- [ ] **E2E Tests**
  - [ ] Agent workflows
  - [ ] Multi-user scenarios
  - [ ] Error recovery

---

## Success Metrics

### Before Refactor
- ❌ 7 critical issues
- ❌ 5 major issues
- ❌ ~1067 LOC with dead code
- ❌ 0% test coverage
- ❌ Memory leaks (buffers in Redis)
- ❌ Data integrity issues (no transactions)

### After Refactor
- ✅ 0 critical issues
- ✅ 0 major issues
- ✅ ~800 LOC (clean, focused)
- ✅ 80%+ test coverage
- ✅ No memory leaks
- ✅ ACID compliance

---

## Timeline

**Week 1:** Cleanup & Critical Fixes
**Week 2:** Architecture Improvements
**Week 3:** Testing & Hardening
**Week 4:** Documentation & Deployment

**Total:** 4 weeks to production-ready

---

## Next Steps

1. **Get approval on this plan**
2. **Create feature branch: `refactor/image-system`**
3. **Start with Phase 1, Day 1-2: Remove dead code**
4. **Test each change incrementally**
5. **Merge when all tests pass**

Ready to start refactoring? Let's build this right.
