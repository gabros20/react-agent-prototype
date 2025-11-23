# Image Handling System - Current Implementation

**Status:** ✅ PRODUCTION READY
**Last Updated:** 2025-11-23
**System:** Text-based semantic search with OpenRouter embeddings
**Architecture:** Inline JSON pattern for section images ([details](./IMAGE_ARCHITECTURE.md))

---

## Overview

AI-powered image management system with automatic metadata generation and semantic search capabilities using OpenRouter's unified API.

**Section Images:** Uses **inline JSON pattern** - image data stored directly in `page_section_contents.content` as `{url, alt}` objects. See [IMAGE_ARCHITECTURE.md](./IMAGE_ARCHITECTURE.md) for details.

### Core Features ✅

- 🤖 **AI Metadata Generation** - GPT-4o-mini with vision generates rich, structured metadata
- 🔍 **Semantic Search** - Natural language image search using OpenRouter text embeddings
- 🎯 **Agent Integration** - 6 specialized tools for natural language image operations
- ♻️ **Deduplication** - SHA256 hash checking prevents duplicate storage
- 📦 **Async Processing** - BullMQ queue handles metadata, variants, and embedding generation
- 🖼️ **Responsive Variants** - WebP/AVIF formats in 3 sizes (640w, 1024w, 1920w)
- 🔒 **Security** - Magic byte validation, path traversal protection, sanitization

---

## Architecture

### System Flow

```
User Upload (POST /api/upload)
    ↓
Multer Validation (MIME, size, security)
    ↓
SHA256 Hash Generation
    ↓
Deduplication Check (database lookup)
    ├─ DUPLICATE FOUND → Link to session, return existing image
    └─ NEW IMAGE → Continue processing
        ↓
Save to Filesystem (date-based: /uploads/images/YYYY/MM/DD/)
    ↓
Generate Thumbnail (150x150 WebP BLOB)
    ↓
Insert Database Record (status: processing)
    ↓
Queue 3 Async Jobs (BullMQ + Redis)
        ├─ generate-metadata → GPT-4o-mini
        ├─ generate-variants → Sharp (WebP/AVIF)
        └─ generate-embeddings → OpenRouter text-embedding-3-small
            ↓
Store Results (DB + LanceDB Vector Index)
    ↓
Update Status (status: completed)
```

### Embedding Strategy

**IMPORTANT:** System uses **TEXT-ONLY embeddings** from metadata, not visual embeddings.

```typescript
// 1. GPT-4o-mini generates rich metadata from image
const metadata = {
  description: "Golden retriever puppy playing in green grass",
  tags: ["puppy", "dog", "golden retriever", "grass", "outdoor"],
  categories: ["animals", "pets"],
  objects: [{name: "dog", confidence: 0.98}],
  colors: {dominant: ["golden", "green"]},
  mood: "playful",
  style: "natural photography"
}

// 2. Create searchable text from metadata
const searchableText = `${description} ${tags.join(' ')} ${categories.join(' ')}`

// 3. Generate embedding via OpenRouter
const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
  headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` },
  body: JSON.stringify({
    model: 'openai/text-embedding-3-small',
    input: searchableText
  })
})

// 4. Store 1536-dimensional vector in LanceDB
const embedding = response.data[0].embedding // [0.123, -0.456, ...]
```

**Why text-only?**
- ✅ Rich metadata from GPT-4o-mini provides excellent search quality
- ✅ Unified embedding model (OpenRouter) for both images and text queries
- ✅ No additional infrastructure (CLIP would require ~500MB model download)
- ✅ Lower cost ($0.02/M tokens vs visual embedding services)
- ✅ Consistent results across image and text search

---

## API Reference

### Upload Images

```bash
POST /api/upload
Content-Type: multipart/form-data

# Request
files: File[]           # 1-10 images (max 5MB each)
sessionId: string       # Required (UUID)

# Response (201 Created)
{
  "success": true,
  "data": [
    {
      "id": "img-abc123",
      "filename": "photo.jpg",
      "status": "processing",
      "isNew": true,
      "url": "/api/images/img-abc123"
    }
  ],
  "meta": {
    "timestamp": 1732277400000,
    "requestId": "req-xyz"
  }
}
```

### Access Uploaded Images

```bash
GET /uploads/images/YYYY/MM/DD/original/:filename.jpg
# Static file serving - returns image file

# Example
GET /uploads/images/2025/11/22/original/967f1d05-bebb-446a-b228-4147df3c30ee.jpg
# Returns: JPEG image (Content-Type: image/jpeg)

# Available on both servers:
# - API Server: http://localhost:8787/uploads/...
# - Preview Server: http://localhost:4000/uploads/...
```

**Image variants:**
```bash
GET /uploads/images/2025/11/22/640w/:filename.webp   # 640px wide
GET /uploads/images/2025/11/22/1024w/:filename.webp  # 1024px wide
GET /uploads/images/2025/11/22/1920w/:filename.avif  # 1920px wide
```

### Get Image Status

```bash
GET /api/images/:id/status

# Response (200 OK)
{
  "success": true,
  "data": {
    "id": "img-abc123",
    "status": "completed",  # processing | completed | failed
    "processedAt": "2025-11-22T10:30:00Z",
    "error": null
  }
}
```

### Get Image Details

```bash
GET /api/images/:id/details

# Response (200 OK)
{
  "success": true,
  "data": {
    "id": "img-abc123",
    "filename": "img-abc123.jpg",
    "originalFilename": "photo.jpg",
    "status": "completed",
    "fileSize": 1024000,
    "width": 1920,
    "height": 1080,
    "url": "/uploads/images/2025/11/22/original/img-abc123.jpg",
    "thumbnailUrl": "/api/images/img-abc123/thumbnail",
    "uploadedAt": "2025-11-22T10:25:00Z",
    "processedAt": "2025-11-22T10:30:00Z",
    "metadata": {
      "description": "A sunset over the ocean",
      "tags": ["sunset", "ocean", "nature"],
      "categories": ["nature", "landscape"],
      "colors": {
        "dominant": ["orange", "blue"],
        "palette": ["sunset orange", "ocean blue"]
      },
      "mood": "peaceful",
      "style": "natural photography"
    }
  }
}
```

### Search Images

```bash
GET /api/images/search?q=sunset&limit=10&page=1

# Response (200 OK)
{
  "success": true,
  "data": [
    {
      "id": "img-abc123",
      "filename": "sunset.jpg",
      "description": "A sunset over the ocean with orange sky",
      "score": 0.92,  # Similarity score (0-1)
      "metadata": {
        "tags": ["sunset", "ocean"],
        "mood": "peaceful"
      }
    }
  ],
  "meta": {
    "timestamp": 1732277400000,
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 23,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

### Delete Image

```bash
DELETE /api/images/:id

# Response (200 OK)
{
  "success": true,
  "data": {
    "success": true,
    "message": "Image deleted"
  }
}
```

---

## Agent Tools

### cms_findImage

Find single best matching image by description.

```javascript
{
  description: "the puppy photo"
}

// Returns
{
  success: true,
  image: {
    id: "img-abc123",
    filename: "puppy.jpg",
    description: "Golden retriever puppy...",
    score: 0.95
  }
}
```

### cms_searchImages

Search for multiple images.

```javascript
{
  query: "sunset photos",
  limit: 10  // optional, default 10
}

// Returns
{
  success: true,
  count: 3,
  images: [...]
}
```

### cms_listConversationImages

List images uploaded in current session.

```javascript
{
  sessionId: "session-abc"
}

// Returns
{
  success: true,
  count: 2,
  images: [...]
}
```

### cms_listAllImages

List all images in the entire system (not session-scoped).

```javascript
{
  limit: 50,      // optional, default 50
  status: "completed"  // optional: completed | processing | failed
}

// Returns
{
  success: true,
  images: [...]
}
```

### cms_addImageToSection

Add uploaded image to section content (inline JSON pattern).

```javascript
{
  imageId: "img-abc123",
  pageSectionId: "section-xyz",
  fieldName: "image",      // Field name in content JSON
  localeCode: "en"         // optional, default "en"
}

// Updates section content:
// { ...existingContent, image: { url: "/uploads/...", alt: "..." } }
```

### cms_updateSectionImage

Update existing section image field (same as addImageToSection).

```javascript
{
  pageSectionId: "section-xyz",
  imageField: "image",
  imageId: "img-abc123",
  localeCode: "en"
}

// Result
{
  success: true,
  message: "Updated image with puppy.jpg",
  imageUrl: "/uploads/images/.../uuid.jpg",
  altText: "AI-generated description"
}
```

### cms_replaceImage

Replace image across all sections (searches content JSON recursively).

```javascript
{
  oldImageDescription: "old logo",
  newImageId: "img-new456"
}

// Searches all page_section_contents, finds matching image URLs, replaces them
// Returns
{
  success: true,
  message: "Replaced old-logo.jpg with new-logo.jpg in 3 location(s)",
  replacementCount: 3
}
```

### cms_deleteImage

Delete image (requires confirmation).

```javascript
{
  description: "outdated banner"
}
```

---

## Database Schema

### images

Core image storage.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| filename | TEXT | Generated filename (UUID.ext) |
| originalFilename | TEXT | User's original filename |
| mediaType | TEXT | MIME type (image/jpeg, etc.) |
| storageType | TEXT | 'filesystem' |
| filePath | TEXT | Relative path |
| cdnUrl | TEXT | NULL (not implemented) |
| thumbnailData | BLOB | 150x150 WebP thumbnail |
| fileSize | INTEGER | Bytes |
| width | INTEGER | Pixels |
| height | INTEGER | Pixels |
| sha256Hash | TEXT | For deduplication (unique) |
| status | TEXT | processing/completed/failed |
| error | TEXT | Error message if failed |
| uploadedAt | TIMESTAMP | Upload time |
| processedAt | TIMESTAMP | Completion time |

**Indexes:**
- `idx_images_status` ON `status`
- `idx_images_sha256` ON `sha256Hash`

### image_metadata

AI-generated metadata from GPT-4o-mini.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| imageId | TEXT | FK to images.id (unique) |
| description | TEXT | 1-2 sentence summary |
| detailedDescription | TEXT | 3-4 sentence a11y description |
| tags | JSON | Array of keywords |
| categories | JSON | High-level categories |
| objects | JSON | [{name, confidence}] |
| colors | JSON | {dominant[], palette[]} |
| mood | TEXT | Emotional tone |
| style | TEXT | Visual style |
| composition | JSON | {orientation, subject, background} |
| searchableText | TEXT | Concatenated search content |
| altText | TEXT | Optional alt text override |
| caption | TEXT | Optional caption |
| generatedAt | TIMESTAMP | Generation time |
| model | TEXT | "gpt-4o-mini" |

**Indexes:**
- `idx_metadata_image` ON `imageId`

### image_variants

Responsive image variants.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| imageId | TEXT | FK to images.id |
| variantType | TEXT | small/medium/large |
| format | TEXT | webp/avif |
| width | INTEGER | Pixels |
| height | INTEGER | Pixels |
| fileSize | INTEGER | Bytes |
| filePath | TEXT | Relative path |
| cdnUrl | TEXT | NULL (not implemented) |
| createdAt | TIMESTAMP | Creation time |

**Variants:**
- Small: 640w (webp + avif)
- Medium: 1024w (webp + avif)
- Large: 1920w (webp + avif)

**Indexes:**
- `idx_variants_image` ON `imageId`
- `idx_variants_type` ON `(imageId, variantType)`

### conversation_images

Link images to chat sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| sessionId | TEXT | FK to sessions.id |
| imageId | TEXT | FK to images.id |
| messageId | TEXT | Optional message reference |
| uploadedAt | TIMESTAMP | Upload time |
| orderIndex | INTEGER | Display order |

**Indexes:**
- `idx_conv_images_session` ON `sessionId`
- `idx_conv_images_image` ON `imageId`

### page_section_images

Link images to CMS sections.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| pageSectionId | TEXT | FK to page_sections.id |
| imageId | TEXT | FK to images.id |
| fieldName | TEXT | Field name (e.g., "heroImage") |
| sortOrder | INTEGER | Display order for arrays |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update time |

**Indexes:**
- `idx_section_images_section` ON `pageSectionId`
- `idx_section_images_image` ON `imageId`

---

## Configuration

### Environment Variables

```env
# Storage
UPLOADS_DIR=./uploads
BASE_URL=http://localhost:3000

# Upload limits
MAX_FILE_SIZE=5242880  # 5MB
MAX_FILES_PER_UPLOAD=10

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenRouter API (for both GPT-4o-mini and embeddings)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_HEADERS={"HTTP-Referer":"http://localhost:3000","X-Title":"ReAct CMS Agent"}

# Embedding Model (optional, defaults shown)
EMBEDDING_MODEL=openai/text-embedding-3-small  # 1536 dims, $0.02/M tokens

# Vector Database
VECTOR_DB_PATH=./vector_index  # LanceDB storage path

# Processing
METADATA_GENERATION_CONCURRENCY=5
METADATA_GENERATION_RATE_LIMIT=10  # jobs per minute
```

### Required Services

**Redis** (for BullMQ job queue):
```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Docker
docker run -d --name redis -p 6379:6379 redis:latest

# Verify
redis-cli ping  # Should return PONG
```

**No CLIP model needed** - System uses OpenRouter's cloud-based embeddings API.

---

## Development

### Start Services

```bash
# Development (auto-reload)
pnpm dev           # Starts server + worker

# Production
pnpm start         # Server only
pnpm worker        # Worker only (separate process)
```

### Test Upload

```bash
curl -X POST http://localhost:8787/api/upload \
  -F "files=@test.jpg" \
  -F "sessionId=test-123"
```

### Search Images

```bash
curl "http://localhost:8787/api/images/search?q=sunset&limit=5"
```

### Monitor Jobs

```bash
redis-cli
> KEYS bull:image-processing:*
> LLEN bull:image-processing:waiting
> LLEN bull:image-processing:active
> LLEN bull:image-processing:completed
```

---

## Performance

### Cost Analysis (per 10,000 images)

| Service | Usage | Cost |
|---------|-------|------|
| GPT-4o-mini metadata | 10K × 300 tokens × $0.60/M | $1.80 |
| Text embeddings | 10K × 100 tokens × $0.02/M | $0.02 |
| **Total** | | **$1.82** |

### Processing Time

- Upload & validation: < 100ms
- GPT-4o-mini metadata: 1-2s
- Variant generation (Sharp): 500ms-1s
- Embedding generation: 200ms (API call)
- **Total**: ~2-4s per image (async, non-blocking)

### Storage Usage

- Original: Variable (user upload)
- Thumbnail: ~10KB (150x150 WebP BLOB)
- Variants: 6 files × ~50-200KB = ~300-1200KB
- **Total**: ~500KB-1500KB per image with all variants

---

## Security

### Upload Validation

- ✅ Magic byte MIME type verification (not just extension)
- ✅ File size limits (configurable, default 5MB)
- ✅ Filename sanitization (prevents path traversal)
- ✅ Allowed types: JPEG, PNG, GIF, WebP, AVIF only
- ✅ Buffer validation before processing

### Storage Security

- ✅ UUID-based filenames (prevents guessing)
- ✅ Date-based directory structure
- ✅ SHA256 deduplication
- ✅ Secure path resolution (no `../` attacks)
- ✅ Isolated upload directory

### API Security

- ✅ Rate limiting on upload endpoint
- ✅ Session-based access control
- ✅ Parameterized database queries (SQL injection protection)
- ✅ Input validation with Zod schemas

---

## Troubleshooting

### Worker Not Processing Jobs

**Check Redis connection:**
```bash
redis-cli ping  # Should return PONG
```

**Check worker is running:**
```bash
# Look for this in logs:
🚀 Image processing worker started
```

**Check job queue:**
```bash
redis-cli LLEN bull:image-processing:waiting
# If > 0 but worker not processing, restart worker
```

### Search Returns No Results

**Verify image status:**
```bash
curl http://localhost:8787/api/images/{imageId}/status
# Should show status: "completed"
```

**Check vector index:**
```bash
# In vector-index.ts debug mode
const results = await this.table?.query()
  .where("type = 'image'")
  .toArray();
console.log('Images in index:', results?.length);
```

### OpenRouter API Errors

**Rate limit exceeded:**
- Worker has built-in rate limiting (10 jobs/min)
- Check OpenRouter dashboard for usage
- Increase delay between jobs if needed

**Invalid API key:**
```bash
echo $OPENROUTER_API_KEY  # Should start with sk-or-v1-
```

---

## Architecture Decisions

### Why Text-Only Embeddings?

**Decision:** Use `openai/text-embedding-3-small` on GPT-4o-mini metadata, not visual embeddings.

**Rationale:**
1. ✅ **Rich metadata** - GPT-4o-mini provides detailed, accurate descriptions
2. ✅ **Unified platform** - Same API key as metadata generation (OpenRouter)
3. ✅ **Cost-effective** - $0.02/M tokens (extremely cheap)
4. ✅ **No infrastructure** - No model downloads, no GPU needed
5. ✅ **Excellent search quality** - Semantic search works great with text embeddings
6. ✅ **Consistent dimensions** - 1536 dims matches LanceDB schema
7. ❌ **CLIP removed** - Never worked properly, added complexity

**Example:**
```
Image: puppy.jpg
↓
GPT-4o-mini: "Golden retriever puppy playing in green grass"
↓
Embedding: [0.123, -0.456, ...] (1536 dims)
↓
Search: "find dog photo" → High similarity match ✅
```

### Why No `imageProcessingQueue` Table?

**Decision:** Removed redundant database table, BullMQ handles all job tracking in Redis.

**Rationale:**
1. ✅ **DRY principle** - BullMQ already tracks job state comprehensively
2. ✅ **Reduced complexity** - One source of truth (Redis)
3. ✅ **Better performance** - No dual writes to DB + Redis
4. ✅ **Automatic cleanup** - BullMQ removes old jobs automatically
5. ❌ **Table was redundant** - Duplicated BullMQ's internal tracking

### Why Singleton Services?

**Decision:** Export singleton instances, never `new` in routes/tools.

**Rationale:**
1. ✅ **Shared state** - LanceDB connections, Sharp instances
2. ✅ **Better performance** - No repeated initialization
3. ✅ **Predictable behavior** - Same instance everywhere
4. ✅ **Easier testing** - Mock once, applies everywhere

---

## File Structure

```
server/
├── db/
│   ├── schema.ts                            # 5 image tables (no queue table)
│   └── migrations/
│       ├── 0000_*.sql                       # Initial schema
│       ├── 0001_*.sql                       # Remove queue table
│       └── 0002_*.sql                       # Current schema
├── services/
│   ├── storage/
│   │   ├── image-storage.service.ts         # ✅ Filesystem operations
│   │   └── image-processing.service.ts      # ✅ Main orchestrator
│   ├── ai/
│   │   └── metadata-generation.service.ts   # ✅ GPT-4o-mini metadata
│   └── vector-index.ts                      # ✅ OpenRouter embeddings + search
├── workers/
│   └── image-worker.ts                      # ✅ BullMQ job processor
├── queues/
│   └── image-queue.ts                       # ✅ Job queue setup
├── middleware/
│   ├── upload.ts                            # ✅ Multer + validation
│   └── rate-limit.ts                        # ✅ Rate limiting
├── routes/
│   ├── upload.ts                            # ✅ POST /api/upload
│   └── images.ts                            # ✅ Search, status, details
├── tools/
│   └── image-tools.ts                       # ✅ 6 agent tools
└── utils/
    ├── hash.ts                              # ✅ SHA256 generation
    └── file-validation.ts                   # ✅ Security validation

uploads/
└── images/
    └── YYYY/MM/DD/
        ├── original/                        # Original files
        └── variants/                        # WebP/AVIF variants
```

---

## Recent Changes (2025-11-22)

### Major Refactor Complete ✅

1. **Removed CLIP embeddings**
   - Deleted `embedding-generation.service.ts`
   - Removed all CLIP-related code from worker
   - Simplified vector index to use OpenRouter only

2. **Removed `imageProcessingQueue` table**
   - Migration removes table and relations
   - BullMQ handles all job tracking in Redis
   - Cleaner schema, less redundancy

3. **Standardized API responses**
   - All routes use `ApiResponse<T>` format
   - Consistent error handling
   - Pagination support for search

4. **No backward compatibility**
   - Clean refactor, this is a prototype
   - Direct data in responses
   - HttpStatus and ErrorCodes constants

5. **Verified all integrations**
   - ✅ Server routes updated
   - ✅ Database schema clean
   - ✅ Worker using correct APIs
   - ✅ Tools using correct vector index methods
   - ✅ Zero TypeScript errors

---

## Next Steps (Optional Enhancements)

### Not Required for Core Functionality

1. **CDN Integration**
   - S3 / Cloudflare R2 upload
   - CDN URL generation
   - Automatic failover

2. **Chat UI Components**
   - AI Elements file upload
   - Drag-and-drop interface
   - Progress indicators

3. **Nunjucks Templates**
   - Responsive image macro
   - `<picture>` elements with srcset
   - WebP/AVIF fallback

4. **Advanced Features**
   - Image editing (crop, resize, filters)
   - Face detection
   - OCR for text extraction
   - Object detection with bounding boxes

---

**Documentation Current as of:** 2025-11-22
**System Status:** Production Ready ✅
