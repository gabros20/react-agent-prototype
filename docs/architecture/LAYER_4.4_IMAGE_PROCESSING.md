# Layer 4.4: Image Processing

> Upload pipeline, SHA256 deduplication, async job dispatch, variant generation

## Overview

The Image Processing layer handles the complete lifecycle of uploaded images. It validates and deduplicates uploads via SHA256 hashing, saves files to organized filesystem storage, creates database records, links images to conversations, and dispatches BullMQ jobs for async metadata generation and variant creation.

**Key Responsibilities:**
- SHA256-based deduplication before storage
- Date-based filesystem organization (YYYY/MM/DD)
- Database record creation with conversation linking
- BullMQ job dispatch for async processing
- Variant generation (small/medium/large in WebP/AVIF)
- Thumbnail generation for fast previews

---

## The Problem

Without proper image processing, uploads become chaotic:

```typescript
// WRONG: Duplicate storage
const path1 = `/uploads/${uuid()}.jpg`; // First upload
const path2 = `/uploads/${uuid()}.jpg`; // Same image, different UUID

// WRONG: Flat directory structure
// /uploads/abc.jpg, /uploads/def.jpg... thousands of files in one dir

// WRONG: Blocking metadata generation
const metadata = await analyzeWithAI(buffer); // Blocks request for 5+ seconds

// WRONG: No responsive images
<img src="/uploads/huge-original.jpg"> // 5MB image on mobile

// WRONG: No conversation context
// "Which images did user upload in this session?"
```

**Our Solution:**
1. SHA256 hash for deduplication
2. Date-based directory structure
3. Async BullMQ jobs for heavy processing
4. Responsive variants in modern formats
5. Conversation-image linking table

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   IMAGE PROCESSING PIPELINE                      │
│                                                                  │
│  Upload Request (POST /api/images/upload)                       │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            ImageProcessingService                        │    │
│  │                                                          │    │
│  │  processImage(buffer, filename, sessionId):              │    │
│  │  ├─ 1. Generate SHA256 hash                             │    │
│  │  ├─ 2. Check for duplicate (findDuplicate)              │    │
│  │  │      ├─ Exists: Link to conversation, return early   │    │
│  │  │      └─ New: Continue processing                     │    │
│  │  ├─ 3. Save to storage (ImageStorageService)            │    │
│  │  ├─ 4. Create DB records (transaction)                  │    │
│  │  │      ├─ images table                                 │    │
│  │  │      └─ conversation_images table                    │    │
│  │  ├─ 5. Dispatch BullMQ jobs                             │    │
│  │  │      ├─ generate-metadata job                        │    │
│  │  │      └─ generate-variants job                        │    │
│  │  └─ 6. Return { imageId, isNew, status }               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                         │
│       ┌────────────────┴────────────────┐                       │
│       ▼                                 ▼                       │
│  ┌─────────────┐               ┌─────────────────┐              │
│  │ Filesystem  │               │    BullMQ       │              │
│  │             │               │                 │              │
│  │ /uploads/   │               │ ┌─────────────┐ │              │
│  │  images/    │               │ │ Metadata Job│ │              │
│  │   2025/     │               │ │ → AI analysis│              │
│  │    11/      │               │ │ → Vector idx │              │
│  │     27/     │               │ └─────────────┘ │              │
│  │      original/              │ ┌─────────────┐ │              │
│  │      variants/              │ │ Variants Job│ │              │
│  │                             │ │ → 3 sizes   │ │              │
│  │                             │ │ → WebP/AVIF │ │              │
│  └─────────────┘               │ └─────────────┘ │              │
│                                └─────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/storage/image-processing.service.ts` | Main orchestration service |
| `server/services/storage/image-storage.service.ts` | Filesystem storage operations |
| `server/queues/image-queue.ts` | BullMQ queue definition |
| `server/workers/image.worker.ts` | Async job processing |
| `server/routes/images.ts` | Upload API endpoints |
| `server/utils/hash.ts` | SHA256 generation utility |

---

## Core Implementation

### Main Processing Flow

```typescript
// server/services/storage/image-processing.service.ts
export class ImageProcessingService {
  private storage = imageStorageService;

  async processImage(params: {
    buffer: Buffer;
    filename: string;
    sessionId: string;
    mediaType?: string;
    fixedId?: string;
  }): Promise<ImageProcessingResult> {
    const { buffer, filename, sessionId } = params;

    // 1. Generate SHA256 hash
    const sha256 = generateSHA256(buffer);

    // 2. Check for duplicate
    const duplicate = await db.query.images.findFirst({
      where: eq(images.sha256Hash, sha256),
    });

    if (duplicate) {
      // Link existing image to conversation
      await db.insert(conversationImages).values({
        id: randomUUID(),
        sessionId,
        imageId: duplicate.id,
        uploadedAt: new Date(),
      });

      return {
        imageId: duplicate.id,
        isNew: false,
        status: duplicate.status,
      };
    }

    // 3. Save to storage
    const stored = await this.storage.saveImage(buffer, {
      filename,
      mediaType: params.mediaType || "image/jpeg",
      fixedId: params.fixedId,
    });

    const imageId = stored.id;
    const ext = path.extname(filename);

    // 4. Database transaction
    try {
      await db.transaction((tx) => {
        tx.insert(images).values({
          id: imageId,
          filename: imageId + ext,
          originalFilename: filename,
          mediaType: params.mediaType || "image/jpeg",
          storageType: "filesystem",
          filePath: stored.originalPath,
          cdnUrl: stored.cdnUrl,
          thumbnailData: stored.thumbnailBuffer,
          fileSize: buffer.length,
          width: stored.width,
          height: stored.height,
          sha256Hash: sha256,
          status: "processing",
          uploadedAt: new Date(),
        }).run();

        tx.insert(conversationImages).values({
          id: randomUUID(),
          sessionId,
          imageId,
          uploadedAt: new Date(),
        }).run();
      });
    } catch (error) {
      // Cleanup file if DB insert fails
      await this.storage.deleteImage(stored.originalPath).catch(() => {});
      throw error;
    }

    // 5. Queue async jobs
    const { imageQueue } = await import("../../queues/image-queue");
    await imageQueue.add("generate-metadata", {
      imageId,
      filePath: stored.originalPath,
    }, { jobId: `metadata-${imageId}` });

    await imageQueue.add("generate-variants", {
      imageId,
      filePath: stored.originalPath,
    }, { jobId: `variants-${imageId}` });

    return { imageId, isNew: true, status: "processing" };
  }
}
```

### Filesystem Storage with Date Organization

```typescript
// server/services/storage/image-storage.service.ts
export class ImageStorageService {
  constructor(private config: StorageConfig) {}

  async saveImage(
    file: Buffer,
    metadata: { filename: string; mediaType: string; fixedId?: string }
  ): Promise<SaveImageResult> {
    const id = metadata.fixedId || randomUUID();
    const ext = path.extname(metadata.filename);
    const date = new Date();

    // Date-based path: YYYY/MM/DD
    const datePath = `${date.getFullYear()}/${
      String(date.getMonth() + 1).padStart(2, "0")
    }/${String(date.getDate()).padStart(2, "0")}`;

    // Create directory structure
    const originalDir = path.join(
      this.config.uploadsDir,
      "images",
      datePath,
      "original"
    );
    const variantDir = path.join(
      this.config.uploadsDir,
      "images",
      datePath,
      "variants"
    );

    await fs.mkdir(originalDir, { recursive: true });
    await fs.mkdir(variantDir, { recursive: true });

    // Get dimensions
    const imageMetadata = await sharp(file).metadata();
    const width = imageMetadata.width || 0;
    const height = imageMetadata.height || 0;

    // Save original
    const originalPath = path.join(originalDir, `${id}${ext}`);
    await fs.writeFile(originalPath, file);

    // Generate thumbnail (150x150 WebP)
    const thumbnailBuffer = await sharp(file)
      .resize(150, 150, { fit: "cover" })
      .webp({ quality: 70 })
      .toBuffer();

    const thumbnailPath = path.join(variantDir, `${id}_thumbnail.webp`);
    await fs.writeFile(thumbnailPath, thumbnailBuffer);

    return {
      id,
      originalPath: originalPath.replace(this.config.uploadsDir + "/", ""),
      thumbnailPath: thumbnailPath.replace(this.config.uploadsDir + "/", ""),
      thumbnailBuffer,
      width,
      height,
    };
  }
}
```

### Variant Generation

```typescript
async generateVariants(
  imageId: string,
  originalPath: string
): Promise<VariantResult[]> {
  const variants = [
    { name: "small", width: 640, quality: 80 },
    { name: "medium", width: 1024, quality: 85 },
    { name: "large", width: 1920, quality: 90 },
  ];

  const formats = ["webp", "avif"];
  const results: VariantResult[] = [];

  const fullPath = path.join(this.config.uploadsDir, originalPath);

  for (const variant of variants) {
    for (const format of formats) {
      const outputPath = fullPath
        .replace("/original/", "/variants/")
        .replace(/\.[^.]+$/, `_${variant.name}.${format}`);

      let pipeline = sharp(fullPath).resize(variant.width, null, {
        withoutEnlargement: true,
      });

      if (format === "webp") {
        pipeline = pipeline.webp({ quality: variant.quality });
      } else if (format === "avif") {
        pipeline = pipeline.avif({ quality: variant.quality });
      }

      await pipeline.toFile(outputPath);

      const stats = await fs.stat(outputPath);
      const metadata = await sharp(outputPath).metadata();

      results.push({
        variantType: variant.name,
        format,
        width: metadata.width || variant.width,
        height: metadata.height || 0,
        fileSize: stats.size,
        filePath: outputPath.replace(this.config.uploadsDir + "/", ""),
      });
    }
  }

  return results;
}
```

### Image Deletion with Cleanup

```typescript
async deleteImage(imageId: string): Promise<void> {
  const image = await db.query.images.findFirst({
    where: eq(images.id, imageId),
  });

  if (!image) {
    throw new Error(`Image not found: ${imageId}`);
  }

  // Delete from filesystem
  if (image.filePath) {
    await this.storage.deleteImage(image.filePath);
  }

  // Delete from vector index
  try {
    const { default: vectorIndex } = await import("../vector-index");
    await vectorIndex.deleteImage(imageId);
  } catch (error) {
    console.warn("Failed to delete from vector index:", error);
  }

  // Database delete cascades to metadata, variants, conversation_images
  await db.delete(images).where(eq(images.id, imageId));
}
```

---

## Design Decisions

### Why SHA256 Deduplication?

```typescript
const sha256 = generateSHA256(buffer);
const duplicate = await db.query.images.findFirst({
  where: eq(images.sha256Hash, sha256),
});
```

**Reasons:**
1. **Storage efficiency** - Same image uploaded twice uses one copy
2. **Fast lookup** - SHA256 is indexed for O(1) checks
3. **Conversation linking** - Multiple sessions can reference same image
4. **Deterministic** - Same content always produces same hash

### Why Date-Based Directory Structure?

```
/uploads/images/2025/11/27/original/abc.jpg
/uploads/images/2025/11/27/variants/abc_small.webp
```

**Reasons:**
1. **Filesystem limits** - Avoids thousands of files in one directory
2. **Natural archival** - Easy to find/backup by date
3. **Predictable paths** - Date + ID = full path
4. **Cleanup friendly** - Delete old months wholesale

### Why Async Job Dispatch?

```typescript
await imageQueue.add("generate-metadata", { imageId, filePath });
await imageQueue.add("generate-variants", { imageId, filePath });
```

**Reasons:**
1. **Fast response** - Upload returns immediately
2. **Heavy processing** - AI metadata takes 5+ seconds
3. **Retry logic** - Jobs retry on failure automatically
4. **Parallelization** - Worker processes multiple images

### Why Thumbnail in BLOB?

```typescript
thumbnailData: stored.thumbnailBuffer, // In DB
```

**Reasons:**
1. **Fast access** - No filesystem read for small preview
2. **Single query** - Get image info + thumbnail together
3. **150x150** - Tiny size (~5KB WebP)
4. **Fallback** - Works even if filesystem unavailable

### Why WebP + AVIF Formats?

```typescript
const formats = ["webp", "avif"];
```

**Reasons:**
1. **Size reduction** - 30-50% smaller than JPEG
2. **Browser support** - WebP: 97%+, AVIF: growing
3. **Quality** - Better compression at same visual quality
4. **Responsive** - `<picture>` element can select best format

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1.6 (File Upload) | Multer middleware validates, passes buffer |
| Layer 4.3 (Vector Index) | Worker calls addImage after metadata generation |
| Layer 5 (Background) | BullMQ jobs for async processing |
| Layer 3.2 (Tools) | Agent tools call getImageWithDetails, searchImages |

### Upload Route Integration

```typescript
// server/routes/images.ts
router.post("/upload", upload.array("images", 10), async (req, res) => {
  const sessionId = req.body.sessionId || req.headers["x-session-id"];
  const results = [];

  for (const file of req.files) {
    const result = await imageProcessingService.processImage({
      buffer: file.buffer,
      filename: file.originalname,
      sessionId,
      mediaType: file.mimetype,
    });
    results.push(result);
  }

  res.json({ images: results });
});
```

### Worker Job Processing

```typescript
// server/workers/image.worker.ts
imageQueue.process("generate-metadata", async (job) => {
  const { imageId, filePath } = job.data;

  // Generate AI metadata
  const metadata = await metadataService.generateMetadata(filePath);

  // Store in database
  await db.insert(imageMetadata).values({
    imageId,
    description: metadata.description,
    tags: JSON.stringify(metadata.tags),
    // ... other fields
  });

  // Index in vector store
  await vectorIndex.addImage({
    id: imageId,
    filename: metadata.filename,
    searchableText: metadata.searchableText,
    textEmbedding: await embed(metadata.searchableText),
    metadata: { tags: metadata.tags, colors: metadata.colors },
  });

  // Update status
  await db.update(images)
    .set({ status: "completed", processedAt: new Date() })
    .where(eq(images.id, imageId));
});
```

---

## Common Issues / Debugging

### Duplicate Not Detected

```
// Same image uploaded twice, both stored
```

**Cause:** Hash computed differently (e.g., metadata stripped).

**Debug:**

```typescript
const hash1 = generateSHA256(buffer1);
const hash2 = generateSHA256(buffer2);
console.log("Hash match:", hash1 === hash2);
```

**Fix:** Ensure identical buffers are compared.

### Processing Stuck in "processing" Status

```typescript
const status = await getImageStatus(imageId);
// status = "processing" forever
```

**Cause:** Worker not running or job failed.

**Debug:**

```bash
# Check Redis queue
redis-cli LLEN bull:image-queue:waiting
redis-cli LLEN bull:image-queue:failed

# Check worker logs
pnpm worker:dev
```

**Fix:** Restart worker, check failed jobs, fix errors.

### Filesystem Permission Error

```
Error: EACCES: permission denied, mkdir '/uploads/images/...'
```

**Cause:** Process doesn't have write permission.

**Fix:**

```bash
chmod 755 ./uploads
chown -R $USER ./uploads
```

### Variant Generation Fails

```
Error: Input file is missing
```

**Cause:** Original file deleted before variants generated.

**Debug:**

```typescript
const fullPath = path.join(config.uploadsDir, originalPath);
const exists = await fs.access(fullPath).then(() => true).catch(() => false);
console.log("Original exists:", exists);
```

**Fix:** Ensure variants job runs before any deletion.

### Large File Upload Timeout

```
// Request times out during upload
```

**Cause:** File too large for default timeout.

**Fix:** Increase limits:

```typescript
// Multer
limits: { fileSize: 10 * 1024 * 1024 } // 10MB

// Express
app.use(express.json({ limit: '10mb' }));
```

---

## Further Reading

- [Layer 1.6: File Upload](./LAYER_1.6_FILE_UPLOAD.md) - Multer validation
- [Layer 4.3: Vector Index](./LAYER_4.3_VECTOR_INDEX.md) - Image semantic search
- [Layer 5: Background Processing](./LAYER_5_BACKGROUND.md) - BullMQ workers
- [Layer 2.4: Image Storage](./LAYER_2.4_IMAGE_STORAGE.md) - Database schema
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
