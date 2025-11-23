# Image Handling System - Quick Reference

## Overview

AI-powered image management with semantic search, automatic metadata generation, and agent integration.

### Key Features

- 🤖 **AI Metadata Generation** - GPT-4o-mini generates tags, descriptions, categories
- 🔍 **Semantic Search** - Find images by natural language ("sunset photo", "blue product")
- 🎯 **Agent Tools** - 6 tools for finding, attaching, replacing, deleting images
- ♻️ **Deduplication** - SHA256 hash checking prevents duplicate storage
- 📦 **Async Processing** - BullMQ queue handles metadata/variants/embeddings
- 🖼️ **Modern Formats** - WebP/AVIF variants in 3 sizes (640w, 1024w, 1920w)

---

## Architecture

```
┌─────────────────┐
│   User Upload   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  POST /api/upload                   │
│  • Multer validation                │
│  • SHA256 deduplication check       │
│  • Save to filesystem               │
│  • Generate thumbnail (150x150)     │
│  • Create DB record (status=proc)   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  BullMQ Queue (3 jobs)              │
│  ├─ generate-metadata               │
│  ├─ generate-variants               │
│  └─ generate-embeddings             │
└────────┬────────────────────────────┘
         │
         ├──────────────────┬──────────────────┐
         ▼                  ▼                  ▼
    ┌─────────┐       ┌──────────┐      ┌──────────┐
    │GPT-4o   │       │  Sharp   │      │   CLIP   │
    │mini     │       │ (resize) │      │(embed)   │
    └────┬────┘       └────┬─────┘      └────┬─────┘
         │                 │                   │
         ▼                 ▼                   ▼
    ┌─────────────────────────────────────────────┐
    │  Store in DB + LanceDB Vector Index         │
    │  • image_metadata table                     │
    │  • image_variants table                     │
    │  • Vector index for semantic search         │
    └─────────────────────────────────────────────┘
```

---

## API Reference

### Upload Images

```bash
POST /api/upload
Content-Type: multipart/form-data

# Body:
files: [File]           # 1-10 images
sessionId: string       # Required
```

**Response:**
```json
{
  "success": true,
  "message": "Images uploaded successfully. Processing in progress.",
  "images": [
    {
      "id": "img-123",
      "filename": "photo.jpg",
      "status": "processing",
      "isNew": true,
      "url": "/api/images/img-123"
    }
  ]
}
```

---

### Get Image Status

```bash
GET /api/images/:id/status
```

**Response:**
```json
{
  "id": "img-123",
  "status": "completed",
  "processedAt": "2025-11-22T10:30:00Z",
  "error": null
}
```

---

### Get Image Details

```bash
GET /api/images/:id/details
```

**Response:**
```json
{
  "id": "img-123",
  "filename": "img-123.jpg",
  "originalFilename": "photo.jpg",
  "status": "completed",
  "fileSize": 1024000,
  "width": 1920,
  "height": 1080,
  "url": "/uploads/images/2025/11/22/original/img-123.jpg",
  "thumbnailUrl": "/api/images/img-123/thumbnail",
  "uploadedAt": "2025-11-22T10:25:00Z",
  "processedAt": "2025-11-22T10:30:00Z",
  "metadata": {
    "description": "A sunset over the ocean",
    "tags": ["sunset", "ocean", "nature", "orange sky"],
    "categories": ["nature", "landscape"],
    "colors": {
      "dominant": ["orange", "blue", "purple"],
      "palette": ["sunset orange", "ocean blue", "sky purple"]
    },
    "mood": "peaceful",
    "style": "natural photography"
  }
}
```

---

### Search Images

```bash
GET /api/images/search?q=sunset&limit=10
```

**Response:**
```json
{
  "query": "sunset",
  "count": 3,
  "results": [
    {
      "id": "img-123",
      "filename": "sunset.jpg",
      "description": "A sunset over the ocean with orange and purple sky",
      "score": 0.92,
      "metadata": {
        "tags": ["sunset", "ocean"],
        "mood": "peaceful"
      }
    }
  ]
}
```

---

### Find Single Image (for agents)

```bash
POST /api/images/find
Content-Type: application/json

{
  "description": "puppy photo"
}
```

**Response:**
```json
{
  "success": true,
  "image": {
    "id": "img-456",
    "filename": "puppy.jpg",
    "description": "Golden retriever puppy playing in grass",
    "score": 0.95
  }
}
```

---

### Delete Image

```bash
DELETE /api/images/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Image deleted"
}
```

---

## Agent Tools

### cms_findImage

Find a single image by natural language description.

```javascript
{
  description: "the puppy photo"  // Natural language
}
```

**Use cases:**
- "Find the puppy image"
- "Locate the sunset photo"
- "Get the team photo from last week"

---

### cms_searchImages

Search for multiple images.

```javascript
{
  query: "sunset photos",
  limit: 10  // optional, default 10
}
```

**Use cases:**
- "Show me all product images"
- "Find images with blue backgrounds"
- "List all team photos"

---

### cms_listConversationImages

List images uploaded in current conversation.

```javascript
{
  sessionId: "session-123"
}
```

**Use cases:**
- "What images did I upload?"
- "Show me the images from this chat"
- "List uploaded files"

---

### cms_addImageToSection

Attach image to a page section field.

```javascript
{
  imageId: "img-123",
  pageSectionId: "section-456",
  fieldName: "heroImage"  // or "backgroundImage", "image", etc.
}
```

**Use cases:**
- "Add this to the hero section"
- "Use the puppy photo as background"
- "Set the logo image"

---

### cms_replaceImage

Replace image across all locations.

```javascript
{
  oldImageDescription: "old logo",
  newImageId: "img-789"
}
```

**Use cases:**
- "Replace the old logo with the new one"
- "Update all instances of the team photo"
- "Switch the hero image to the new one"

---

### cms_deleteImage

Delete image (requires confirmation).

```javascript
{
  description: "outdated product photo"
}
```

**Use cases:**
- "Delete the old banner"
- "Remove the outdated screenshot"
- "Delete unused images"

---

## Database Schema

### images

Core image storage table.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| filename | TEXT | Generated filename (UUID + ext) |
| originalFilename | TEXT | User's original filename |
| mediaType | TEXT | MIME type (image/jpeg, etc.) |
| storageType | TEXT | filesystem / cdn / blob |
| filePath | TEXT | Relative path in uploads dir |
| cdnUrl | TEXT | CDN URL (if USE_CDN=true) |
| thumbnailData | BLOB | 150x150 WebP thumbnail |
| fileSize | INTEGER | Size in bytes |
| width | INTEGER | Image width |
| height | INTEGER | Image height |
| sha256Hash | TEXT | SHA256 for deduplication |
| status | TEXT | processing / completed / failed |
| uploadedAt | TIMESTAMP | Upload timestamp |
| processedAt | TIMESTAMP | Completion timestamp |

---

### image_metadata

AI-generated metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| imageId | TEXT | FK to images.id |
| description | TEXT | 1-2 sentence summary |
| detailedDescription | TEXT | 3-4 sentence a11y description |
| tags | JSON | Array of searchable keywords |
| categories | JSON | High-level categories |
| objects | JSON | Array of {name, confidence} |
| colors | JSON | {dominant: [], palette: []} |
| mood | TEXT | Emotional tone |
| style | TEXT | Visual style |
| composition | JSON | {orientation, subject, background} |
| searchableText | TEXT | Concatenated searchable content |
| generatedAt | TIMESTAMP | When metadata was generated |
| model | TEXT | "gpt-4o-mini" |

---

### image_variants

Responsive image variants.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| imageId | TEXT | FK to images.id |
| variantType | TEXT | small / medium / large |
| format | TEXT | webp / avif |
| width | INTEGER | Variant width |
| height | INTEGER | Variant height |
| fileSize | INTEGER | Size in bytes |
| filePath | TEXT | Relative path |

**Variants generated:**
- Small: 640w (webp + avif)
- Medium: 1024w (webp + avif)
- Large: 1920w (webp + avif)

---

## Environment Variables

```env
# Storage
UPLOADS_DIR=./uploads
BASE_URL=http://localhost:3000
USE_CDN=false
CDN_URL=

# Upload limits
MAX_FILE_SIZE=5242880  # 5MB default
MAX_FILES_PER_UPLOAD=10

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenRouter (for metadata via GPT-4o-mini)
OPENROUTER_API_KEY=sk-or-v1-...

# Processing
METADATA_GENERATION_CONCURRENCY=5
METADATA_GENERATION_RATE_LIMIT=10  # per minute
```

---

## Development Commands

### Start the worker

```bash
# Included in pnpm dev (recommended)
pnpm dev

# Or start individually
pnpm dev:worker  # Development with auto-reload
pnpm worker      # Production
```

### Test upload

```bash
curl -X POST http://localhost:8787/api/upload \
  -F "files=@test.jpg" \
  -F "sessionId=test-123"
```

### Search images

```bash
curl "http://localhost:8787/api/images/search?q=sunset"
```

### Check Redis

```bash
redis-cli ping  # Should return PONG
redis-cli keys "*"  # List all keys
```

### Monitor jobs

```bash
redis-cli
> KEYS bull:image-processing:*
> LLEN bull:image-processing:waiting
> LLEN bull:image-processing:active
> LLEN bull:image-processing:completed
```

---

## Troubleshooting

### Worker not processing jobs

**Check Redis:**
```bash
redis-cli ping
```

**Check worker logs:**
```bash
pnpm tsx scripts/start-worker.ts
# Should see: "🚀 Image processing worker started"
```

---

### CLIP model downloading

First run downloads ~500MB model:
```
Loading CLIP model (Xenova/clip-vit-base-patch32)...
Downloading...
CLIP model loaded successfully
```

Subsequent runs use cached model (fast).

---

### OpenRouter rate limits

Worker has built-in rate limiting (10 jobs/min).

The system uses your existing OpenRouter API key for GPT-4o-mini vision calls.
Check OpenRouter dashboard for usage and rate limits.

---

### Search returns no results

**Verify embeddings were generated:**
```bash
curl http://localhost:8787/api/images/{imageId}/status
# status should be "completed"
```

**Check vector index:**
```javascript
// In vector-index.ts
const results = await this.table
  ?.query()
  .where("type = 'image'")
  .limit(10)
  .toArray();

console.log('Images in index:', results.length);
```

---

## Performance

### Cost Analysis (per 10,000 images)

| Service | Cost |
|---------|------|
| GPT-4o-mini metadata | $2.00 |
| CLIP embeddings | $0.00 (local) |
| Storage (50-100MB) | Infrastructure |
| **Total** | **~$2.00** |

### Processing Time

- Upload: < 100ms
- Metadata generation: 1-2s
- Variants generation: 500ms-1s
- Embeddings: 200ms-500ms
- **Total**: 2-4s per image (async)

### Storage Usage

- Original: Variable (depends on upload)
- Thumbnail: ~10KB (150x150 WebP)
- Variants: ~50KB-200KB per image (6 variants)
- **Average**: ~100KB total per image (with variants)

---

## Security

### Upload Validation

- ✅ MIME type verification from binary signature
- ✅ File size limits (default 5MB)
- ✅ Filename sanitization
- ✅ Path traversal prevention
- ✅ Allowed types: JPEG, PNG, GIF, WebP, AVIF

### Storage Security

- ✅ UUID-based filenames (prevents guessing)
- ✅ Date-based directory structure
- ✅ SHA256 deduplication
- ✅ Secure path resolution

---

## Next Steps

### Optional Enhancements

1. **Chat UI Integration** (Phase 6-7)
   - AI Elements file upload component
   - Multimodal message support
   - Drag-and-drop interface

2. **Nunjucks Templates** (Phase 9)
   - Responsive image macro
   - `<picture>` elements with srcset
   - Automatic WebP/AVIF fallback

3. **CDN Integration**
   - S3 / Cloudflare R2 upload
   - CDN URL generation
   - Automatic failover

4. **Advanced Features**
   - Image editing (crop, resize, filters)
   - Face detection
   - Object detection with bounding boxes
   - OCR for text extraction

---

**Documentation Last Updated:** 2025-11-22
