# Layer 2.4: Image & Media Storage

> AI-powered image management with SHA256 deduplication, responsive variants, and inline JSON references

## Overview

The image system stores uploaded files on the filesystem while tracking metadata in SQLite. Key features:

- **SHA256 deduplication** - Same image uploaded twice = one file
- **AI-generated metadata** - GPT-4o-mini extracts descriptions, tags, colors, mood
- **Responsive variants** - Auto-generated WebP/AVIF in multiple sizes (640w, 1024w, 1920w)
- **Inline JSON storage** - Section images stored as `{url, alt}` objects, not junction tables

**Key Tables:**
- `images` - Core image record (file path, hash, status)
- `imageMetadata` - AI-generated descriptions, tags, categories (1:1 with images)
- `imageVariants` - Responsive sizes and formats (1:N with images)

---

## The Problem

Traditional image handling has several pain points:

```typescript
// Problem 1: Duplicate uploads waste storage
upload("logo.png") // 500KB
upload("logo.png") // Another 500KB - same file!

// Problem 2: No searchability
// "Find me an image of a mountain sunset"
// ... manually browse through hundreds of files

// Problem 3: Performance
<img src="/original/4000x3000.jpg"> // 5MB on mobile

// Problem 4: Complex relationships
// Join table for each image field? Nightmare.
```

**Our Solution:**
1. Hash-based dedup at upload time
2. AI metadata enables semantic search
3. Auto-generate responsive variants
4. Store image references as inline JSON in content

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      IMAGE UPLOAD FLOW                           │
│                                                                  │
│  Upload Request                                                  │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐                                            │
│  │  Calculate Hash │ SHA256 of file bytes                       │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────┐                    │
│  │     Hash exists in DB?                   │                    │
│  │     ├─ YES: Return existing image        │                    │
│  │     └─ NO: Continue upload               │                    │
│  └─────────────────────┬───────────────────┘                    │
│                        │                                         │
│           ┌────────────┴────────────┐                           │
│           ▼                         ▼                            │
│  ┌─────────────────┐    ┌─────────────────────┐                 │
│  │  Save to Disk   │    │  Insert DB Record   │                 │
│  │  /uploads/YYYY  │    │  status: processing │                 │
│  │  /MM/DD/orig/   │    │                     │                 │
│  └─────────────────┘    └──────────┬──────────┘                 │
│                                    │                             │
│                        Queue BullMQ Job                          │
│                                    │                             │
│           ┌────────────────────────┴────────────────┐           │
│           ▼                         ▼               ▼            │
│  ┌─────────────────┐    ┌─────────────────┐ ┌────────────────┐  │
│  │ Generate        │    │ AI Metadata     │ │ Vector Index   │  │
│  │ Variants        │    │ (GPT-4o-mini)   │ │ (LanceDB)      │  │
│  │ WebP/AVIF       │    │ desc,tags,mood  │ │ embeddings     │  │
│  └─────────────────┘    └─────────────────┘ └────────────────┘  │
│                                    │                             │
│                        status: completed                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/db/schema.ts` | Image tables (lines 200-335) |
| `server/routes/images.ts` | Upload endpoint |
| `server/workers/image-worker.ts` | Async processing |
| `server/services/storage/image-processing.service.ts` | Variant generation |

---

## Core Implementation

### Images Table

```typescript
// server/db/schema.ts
export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),           // Generated unique name
  originalFilename: text("original_filename").notNull(), // User's filename
  mediaType: text("media_type").notNull(),        // "image/jpeg", etc.

  // Storage
  storageType: text("storage_type", {
    enum: ["filesystem", "cdn", "blob"]
  }).notNull().default("filesystem"),
  filePath: text("file_path"),                    // /uploads/2025/11/23/original/uuid.jpg
  cdnUrl: text("cdn_url"),                        // Future: Cloudflare R2, S3, etc.

  // Fast thumbnail for UI
  thumbnailData: blob("thumbnail_data", { mode: "buffer" }),

  // Technical
  fileSize: integer("file_size").notNull(),       // Bytes
  width: integer("width"),
  height: integer("height"),

  // Deduplication
  md5Hash: text("md5_hash"),                      // Legacy/quick check
  sha256Hash: text("sha256_hash").unique(),       // Primary dedup key

  // Processing status
  status: text("status", {
    enum: ["processing", "completed", "failed"]
  }).notNull().default("processing"),
  error: text("error"),                           // Error message if failed

  // Timestamps
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull(),
  processedAt: integer("processed_at", { mode: "timestamp" }),
});
```

### Image Metadata (AI-Generated)

```typescript
export const imageMetadata = sqliteTable("image_metadata", {
  id: text("id").primaryKey(),
  imageId: text("image_id")
    .notNull()
    .references(() => images.id, { onDelete: "cascade" })
    .unique(),                                    // 1:1 relationship

  // AI descriptions
  description: text("description"),               // "A golden retriever puppy..."
  detailedDescription: text("detailed_description"),

  // Searchable attributes
  tags: text("tags", { mode: "json" }),           // ["dog", "puppy", "golden"]
  categories: text("categories", { mode: "json" }), // ["animals", "pets"]
  objects: text("objects", { mode: "json" }),     // [{name: "dog", confidence: 0.98}]

  // Visual properties
  colors: text("colors", { mode: "json" }),       // {dominant: ["#FFD700"], palette: [...]}
  mood: text("mood"),                             // "cheerful", "serene", "dramatic"
  style: text("style"),                           // "photography", "illustration"
  composition: text("composition", { mode: "json" }), // {orientation: "landscape", ...}

  // Search optimization
  searchableText: text("searchable_text"),        // Concatenated for FTS

  // User-editable
  altText: text("alt_text"),
  caption: text("caption"),

  // External source tracking
  source: text("source"),                         // "unsplash:abc123", "pexels:456"

  generatedAt: integer("generated_at", { mode: "timestamp" }),
  model: text("model"),                           // "gpt-4o-mini"
});
```

### Image Variants (Responsive)

```typescript
export const imageVariants = sqliteTable("image_variants", {
  id: text("id").primaryKey(),
  imageId: text("image_id")
    .notNull()
    .references(() => images.id, { onDelete: "cascade" }),

  variantType: text("variant_type", {
    enum: ["thumbnail", "small", "medium", "large", "original"]
  }).notNull(),

  format: text("format", {
    enum: ["jpeg", "png", "webp", "avif"]
  }).notNull(),

  width: integer("width").notNull(),
  height: integer("height").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  cdnUrl: text("cdn_url"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

**Generated Variants:**

| Type | Width | Formats | Use Case |
|------|-------|---------|----------|
| thumbnail | 150 | webp | Admin UI, lists |
| small | 640 | webp, avif | Mobile |
| medium | 1024 | webp, avif | Tablet |
| large | 1920 | webp, avif | Desktop |
| original | - | original | Download |

### Relations

```typescript
export const imagesRelations = relations(images, ({ one, many }) => ({
  metadata: one(imageMetadata, {
    fields: [images.id],
    references: [imageMetadata.imageId],
  }),
  variants: many(imageVariants),
  conversationImages: many(conversationImages),
  pageSectionImages: many(pageSectionImages),
}));
```

---

## Content Integration Pattern

### Inline JSON (Recommended)

Images in section content are stored as simple JSON objects:

```typescript
// page_section_contents.content
{
  "title": "Welcome",
  "heroImage": {
    "url": "/uploads/images/2025/11/23/original/7f27cf0e.jpg",
    "alt": "Mountain landscape at sunset"
  },
  "ctaText": "Get Started"
}
```

**Advantages:**
1. Single query fetches everything
2. No joins required
3. Image URL directly usable in templates
4. Easy to update (replace entire content)

### Junction Table (Gallery Only)

For galleries with multiple ordered images, use the junction table:

```typescript
// server/db/schema.ts
export const pageSectionImages = sqliteTable("page_section_images", {
  id: text("id").primaryKey(),
  pageSectionId: text("page_section_id")
    .notNull()
    .references(() => pageSections.id, { onDelete: "cascade" }),
  imageId: text("image_id")
    .notNull()
    .references(() => images.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(),  // "gallery", "carousel"
  sortOrder: integer("sort_order"),         // For ordering
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

**When to use each:**

| Scenario | Pattern |
|----------|---------|
| Hero background image | Inline JSON |
| Feature icon | Inline JSON |
| Single cover image | Inline JSON |
| Image gallery (12+ images) | Junction table |
| Carousel with ordering | Junction table |

---

## Deduplication Flow

```typescript
// server/routes/images.ts
async function handleUpload(file: Express.Multer.File) {
  // 1. Calculate hash
  const hash = crypto.createHash('sha256')
    .update(file.buffer)
    .digest('hex');

  // 2. Check for existing
  const existing = await db.select()
    .from(images)
    .where(eq(images.sha256Hash, hash))
    .limit(1);

  if (existing.length > 0) {
    // Return existing image - no new upload
    return existing[0];
  }

  // 3. New image - save and process
  const imageId = randomUUID();
  const datePath = format(new Date(), 'yyyy/MM/dd');
  const filePath = `uploads/images/${datePath}/original/${imageId}${ext}`;

  await fs.writeFile(filePath, file.buffer);

  const [image] = await db.insert(images).values({
    id: imageId,
    filename: `${imageId}${ext}`,
    originalFilename: file.originalname,
    sha256Hash: hash,
    filePath,
    status: 'processing',
    // ...
  }).returning();

  // 4. Queue async processing
  await imageQueue.add('process', { imageId });

  return image;
}
```

---

## Design Decisions

### Why SHA256 over MD5?

| Hash | Security | Speed | Collision Risk |
|------|----------|-------|----------------|
| MD5 | Broken | Fast | Possible |
| SHA256 | Secure | Slower | Negligible |

**Decision:** SHA256 for primary dedup. MD5 kept for legacy/quick comparison.

### Why Filesystem over Database BLOBs?

```typescript
// Option A: Store in SQLite BLOB (rejected)
imageData: blob("image_data") // 5MB per image in DB

// Option B: Filesystem with path reference (chosen)
filePath: text("file_path")   // Just the path
```

**Reasons:**
1. **SQLite performance** - Large BLOBs slow down all queries
2. **Backup flexibility** - Can backup files separately from DB
3. **CDN-ready** - Path can become CDN URL later
4. **Trade-off** - Two things to backup (DB + uploads/)

### Why Separate imageMetadata Table?

```typescript
// Could be columns on images table
images: { description, tags, colors, ... } // Many nullable columns

// Instead, separate table
images: { core fields }
imageMetadata: { AI-generated fields } // 1:1 relation
```

**Reasons:**
1. **Async generation** - Metadata added after upload completes
2. **Clean separation** - Technical vs. semantic data
3. **Optional** - Not all images need AI analysis
4. **Regeneration** - Easy to re-run AI without touching core record

### Why Inline JSON for Single Images?

```typescript
// Option A: Junction table for every image field
hero_images, feature_icons, cta_backgrounds // Many tables

// Option B: Inline JSON (chosen)
content: { heroImage: { url, alt } }
```

**Reasons:**
1. **Simplicity** - One query, no joins
2. **Performance** - No N+1 for image fields
3. **Atomic updates** - Replace content blob entirely
4. **Template-friendly** - Direct access: `{{ content.heroImage.url }}`

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 2.3 (Content) | Image URLs in pageSectionContents.content JSON |
| Layer 2.5 (Vector) | Image embeddings for semantic search |
| Layer 5 (Background) | BullMQ processes uploads async |
| Layer 3 (Agent) | Tools: cms_findImage, cms_searchImages, cms_attachImage |

### Agent Tool Usage

```typescript
// Find image by description
const result = await cms_findImage({
  description: "sunset over mountains"
});
// Returns: { id, filename, url, score: 0.87 }

// Attach to section
await cms_attachImage({
  sectionId: "section-uuid",
  imageDescription: "sunset over mountains",
  fieldName: "heroImage"
});
// Updates section content with { heroImage: { url, alt } }
```

---

## Common Issues / Debugging

### Image Stuck in "processing" Status

```typescript
const image = await db.select().from(images).where(eq(images.id, id));
// status: "processing" forever
```

**Causes:**
1. Worker not running (`pnpm dev:worker`)
2. Redis not running (`pnpm start:redis`)
3. Job failed but status not updated

**Debug:**

```bash
# Check worker status
pnpm ps

# Check Redis queue
redis-cli LLEN bull:image-processing:wait
redis-cli LLEN bull:image-processing:failed

# Check worker logs
tail -f logs/worker.log
```

### Duplicate Upload Not Detected

```typescript
// Same file uploaded, but created new record
```

**Causes:**
1. Hash calculation different (file modified)
2. SHA256 constraint not applied (migration issue)

**Debug:**

```typescript
// Compare hashes manually
const hash1 = crypto.createHash('sha256').update(file1).digest('hex');
const hash2 = crypto.createHash('sha256').update(file2).digest('hex');
console.log('Same?', hash1 === hash2);
```

### Variants Not Generated

```typescript
const variants = await db.select().from(imageVariants)
  .where(eq(imageVariants.imageId, imageId));
// variants: []
```

**Causes:**
1. Processing failed (check image.error)
2. Sharp library issue
3. Source image corrupted

**Debug:**

```typescript
// Check for error
const image = await db.select().from(images).where(eq(images.id, id));
console.log('Status:', image.status, 'Error:', image.error);
```

### Image URL 404

```
GET /uploads/images/2025/11/23/original/uuid.jpg 404
```

**Causes:**
1. File not actually saved
2. Wrong path in database
3. Static file serving not configured

**Debug:**

```bash
# Check file exists
ls -la uploads/images/2025/11/23/original/

# Check DB path
sqlite3 data/sqlite.db "SELECT file_path FROM images WHERE id='uuid'"
```

---

## Further Reading

- [Layer 2.3: Content Model](./LAYER_2.3_CONTENT_MODEL.md) - How images fit in content
- [Layer 2.5: Vector Storage](./LAYER_2.5_VECTOR_STORAGE.md) - Image semantic search
- [Layer 5: Background Processing](./LAYER_5_BACKGROUND.md) - Image worker details
- [Layer 3.2: Tools](./LAYER_3.2_TOOLS.md) - Image agent tools
