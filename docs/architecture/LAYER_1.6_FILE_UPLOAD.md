# Layer 1.6: File Upload

> Multer configuration, multi-layer validation, rate limiting, and security

## Overview

File uploads are handled through a pipeline of Multer middleware, file validation, and rate limiting. Files are stored in memory, validated at multiple levels (MIME type, magic bytes, filename sanitization), and then passed to the image processing service for storage and async processing.

**Key Responsibilities:**
- Configure Multer for memory storage with size limits
- Validate file types at MIME and binary signature levels
- Sanitize filenames and prevent path traversal
- Rate limit upload requests per IP
- Pass validated files to processing service

---

## The Problem

File uploads without proper validation are security risks:

```typescript
// WRONG: No validation
app.post("/upload", (req, res) => {
  // User can upload any file type
  // No size limits
  // Filename could contain "../../../etc/passwd"
  // No rate limiting - DDoS vector
});

// WRONG: Trust MIME type only
if (file.mimetype === "image/jpeg") {
  // User can spoof MIME type in headers!
}

// WRONG: Trust extension only
if (file.originalname.endsWith(".jpg")) {
  // Attacker renames malware.exe to malware.jpg
}
```

**Our Solution:**
1. Multer validates MIME type at request level
2. `file-type` library checks binary magic bytes
3. Sanitize filename and check for path traversal
4. Rate limit uploads per IP
5. Memory storage prevents file system attacks

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    FILE UPLOAD PIPELINE                       │
│                                                               │
│  POST /api/upload                                             │
│       │                                                       │
│       ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  1. Rate Limiter (uploadLimiter)                        │  │
│  │     - 10 uploads per 15 minutes per IP                  │  │
│  │     - Returns 429 if exceeded                           │  │
│  └─────────────────────┬───────────────────────────────────┘  │
│                        │                                      │
│                        ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  2. Multer Middleware (upload.array)                    │  │
│  │     - Memory storage (no disk write)                    │  │
│  │     - 5MB file size limit                               │  │
│  │     - 10 files max per request                          │  │
│  │     - MIME type filter (jpeg, png, gif, webp, avif)     │  │
│  └─────────────────────┬───────────────────────────────────┘  │
│                        │                                      │
│                        ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  3. Validation Middleware (validateUploadedFiles)       │  │
│  │     - Magic byte verification via file-type library     │  │
│  │     - Filename sanitization                             │  │
│  │     - Path traversal detection                          │  │
│  └─────────────────────┬───────────────────────────────────┘  │
│                        │                                      │
│                        ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  4. Route Handler                                       │  │
│  │     - Extract sessionId                                 │  │
│  │     - Pass to imageProcessingService                    │  │
│  │     - Return upload results                             │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/middleware/upload.ts` | Multer config and validation middleware |
| `server/middleware/rate-limit.ts` | Rate limiting configurations |
| `server/routes/upload.ts` | Upload endpoint handler |
| `server/utils/file-validation.ts` | Binary validation and filename sanitization |
| `server/services/storage/image-processing.service.ts` | Processes uploaded files |

---

## Core Implementation

### Multer Configuration

```typescript
// server/middleware/upload.ts
import multer from "multer";

export const upload = multer({
  // Store in memory - no disk write until validated
  storage: multer.memoryStorage(),

  limits: {
    // 5MB default, configurable via env
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880", 10),
    // Max 10 files per request
    files: parseInt(process.env.MAX_FILES_PER_UPLOAD || "10", 10),
  },

  // First-pass MIME type filter
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/avif",
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error(`File type not allowed: ${file.mimetype}`));
    }

    cb(null, true);
  },
});
```

### Validation Middleware

```typescript
// server/middleware/upload.ts
import { validateImageUpload } from "../utils/file-validation";

export async function validateUploadedFiles(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Check files exist
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  try {
    // Validate each file
    for (const file of req.files) {
      const validation = await validateImageUpload(
        file.buffer,
        file.originalname
      );

      if (!validation.valid) {
        return res.status(400).json({
          error: "File validation failed",
          details: validation.errors,
        });
      }
    }

    next();
  } catch (error) {
    res.status(500).json({ error: "File validation failed" });
  }
}
```

### Binary Validation

```typescript
// server/utils/file-validation.ts
import { fileTypeFromBuffer } from "file-type";
import sanitize from "sanitize-filename";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
];

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "5242880", 10);

export async function validateImageUpload(
  buffer: Buffer,
  originalName: string
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Check MIME type from binary signature (magic bytes)
  const fileType = await fileTypeFromBuffer(buffer);

  if (!fileType || !ALLOWED_IMAGE_TYPES.includes(fileType.mime)) {
    errors.push(
      `Invalid file type: ${fileType?.mime || "unknown"}. ` +
      `Allowed: JPEG, PNG, GIF, WebP, AVIF`
    );
  }

  // Validate file size
  if (buffer.length > MAX_FILE_SIZE) {
    errors.push(
      `File too large: ${buffer.length} bytes ` +
      `(max ${MAX_FILE_SIZE / 1024 / 1024}MB)`
    );
  }

  // Sanitize filename
  const safeName = sanitize(originalName);
  if (safeName !== originalName) {
    errors.push("Filename contains invalid characters");
  }

  // Check for path traversal attempts
  if (
    originalName.includes("..") ||
    originalName.includes("/") ||
    originalName.includes("\\")
  ) {
    errors.push("Filename contains path traversal characters");
  }

  return { valid: errors.length === 0, errors };
}
```

### Rate Limiting

```typescript
// server/middleware/rate-limit.ts
import rateLimit from "express-rate-limit";
import { ApiResponse, ErrorCodes, HttpStatus } from "../types/api-response";

// General API rate limiter: 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,  // RateLimit-* headers
  legacyHeaders: false,   // No X-RateLimit-* headers
  handler: (req, res) => {
    res.status(HttpStatus.TOO_MANY_REQUESTS).json(
      ApiResponse.error(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        "Too many requests from this IP, please try again later"
      )
    );
  },
});

// Upload rate limiter: 10 uploads per 15 minutes (stricter)
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
  handler: (req, res) => {
    res.status(HttpStatus.TOO_MANY_REQUESTS).json(
      ApiResponse.error(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        "Upload limit exceeded. Maximum 10 uploads per 15 minutes."
      )
    );
  },
});

// Search rate limiter: 30 searches per minute
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(HttpStatus.TOO_MANY_REQUESTS).json(
      ApiResponse.error(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        "Search limit exceeded. Maximum 30 searches per minute."
      )
    );
  },
});
```

### Upload Route

```typescript
// server/routes/upload.ts
import express from "express";
import { upload, validateUploadedFiles } from "../middleware/upload";
import { uploadLimiter } from "../middleware/rate-limit";
import imageProcessingService from "../services/storage/image-processing.service";
import { ApiResponse, ErrorCodes, HttpStatus } from "../types/api-response";

const router = express.Router();

router.post(
  "/api/upload",
  uploadLimiter,                    // 1. Rate limit
  upload.array("files", 10),        // 2. Multer parsing
  validateUploadedFiles,            // 3. Binary validation
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const sessionId = (req.body.sessionId || req.query.sessionId) as string;

      if (!sessionId) {
        return res.status(HttpStatus.BAD_REQUEST).json(
          ApiResponse.error(
            ErrorCodes.MISSING_REQUIRED_FIELD,
            "sessionId is required"
          )
        );
      }

      const uploadedImages = [];

      for (const file of files) {
        const result = await imageProcessingService.processImage({
          buffer: file.buffer,
          filename: file.originalname,
          sessionId,
          mediaType: file.mimetype,
        });

        uploadedImages.push({
          id: result.imageId,
          filename: file.originalname,
          status: result.status,
          isNew: result.isNew,
          url: `/api/images/${result.imageId}`,
        });
      }

      res.status(HttpStatus.CREATED).json(
        ApiResponse.success(uploadedImages, {
          requestId: req.headers["x-request-id"] as string,
        })
      );
    } catch (error) {
      console.error("Upload error:", error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
        ApiResponse.error(
          ErrorCodes.UPLOAD_FAILED,
          error instanceof Error ? error.message : "Upload failed"
        )
      );
    }
  }
);

export default router;
```

---

## Security Utilities

### Safe Filename Generation

```typescript
// server/utils/file-validation.ts
import path from "node:path";

export function generateSafeFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const safeExt = ext.replace(/[^a-z0-9]/gi, "");
  const uuid = crypto.randomUUID();

  return `${uuid}${safeExt ? `.${safeExt}` : ""}`;
}
```

### Path Traversal Prevention

```typescript
// server/utils/file-validation.ts
export function securePath(baseDir: string, userPath: string): string {
  const resolved = path.resolve(baseDir, userPath);

  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error("Path traversal attempt detected");
  }

  return resolved;
}
```

---

## Design Decisions

### Why Memory Storage?

```typescript
// Option A: Disk storage
storage: multer.diskStorage({
  destination: './uploads/temp',
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Risk: Path traversal!
  }
});

// Option B: Memory storage (chosen)
storage: multer.memoryStorage()
```

**Reasons:**
1. **Security** - File never touches disk until validated
2. **Control** - Can inspect buffer before any disk operation
3. **Simplicity** - No temp file cleanup needed
4. **Flexibility** - Can hash for deduplication before saving
5. **Trade-off** - Uses more memory, limited by file size cap

### Why Multi-Layer Validation?

```
Request → Multer MIME → Binary Magic Bytes → Filename Sanitize
```

**Reasons:**
1. **Defense in depth** - Multiple checks catch different attacks
2. **Multer filter** - Quick reject of obviously wrong types
3. **Magic bytes** - Can't be spoofed like MIME headers
4. **Filename** - Prevents path traversal and shell injection

### Why Stricter Rate Limits for Uploads?

```typescript
// General: 100 req/15min
export const generalLimiter = rateLimit({ max: 100, ... });

// Upload: 10 req/15min (10x stricter)
export const uploadLimiter = rateLimit({ max: 10, ... });
```

**Reasons:**
1. **Resource intensive** - Uploads use more server resources
2. **Storage costs** - Each upload consumes disk space
3. **Processing** - Triggers image processing jobs
4. **Abuse prevention** - Uploading is common DDoS vector

### Why sessionId Required?

```typescript
if (!sessionId) {
  return res.status(400).json(
    ApiResponse.error("sessionId is required")
  );
}
```

**Reasons:**
1. **Tracking** - Associate images with chat sessions
2. **Cleanup** - Can delete orphaned images by session
3. **Display** - Show images in correct conversation
4. **Agent context** - Agent knows which images belong to current task

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1.3 (Middleware) | Multer, rate limit in middleware chain |
| Layer 1.4 (Error Handler) | Multer errors caught by error middleware |
| Layer 5.1 (Job Queue) | processImage() queues background job |
| Layer 2.4 (Image Storage) | Images stored with SHA256 dedup |
| Layer 6 (Client) | Frontend posts to /api/upload |

### Processing Flow After Upload

```
Upload Route → imageProcessingService.processImage()
                    │
                    ▼
              ┌─────────────────────────────────────┐
              │  1. Generate SHA256 hash            │
              │  2. Check for duplicate             │
              │  3. Store original file             │
              │  4. Queue metadata job              │
              │  5. Queue variant job               │
              │  6. Return immediate response       │
              └─────────────────────────────────────┘
```

---

## Common Issues / Debugging

### File Too Large Error

```
MulterError: File too large
```

**Cause:** File exceeds `MAX_FILE_SIZE` limit.

**Fix:** Increase limit or inform user:

```bash
# .env
MAX_FILE_SIZE=10485760  # 10MB
```

### Rate Limit Hit

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Upload limit exceeded. Maximum 10 uploads per 15 minutes."
  }
}
```

**Cause:** User exceeded upload quota.

**Debug:** Check `RateLimit-*` response headers:

```
RateLimit-Limit: 10
RateLimit-Remaining: 0
RateLimit-Reset: 1700000000
```

### Invalid File Type (Magic Bytes)

```json
{
  "error": "File validation failed",
  "details": ["Invalid file type: application/pdf. Allowed: JPEG, PNG, GIF, WebP, AVIF"]
}
```

**Cause:** User renamed non-image file with image extension.

**Why:** Binary magic bytes don't match any allowed image format.

### Path Traversal Blocked

```json
{
  "error": "File validation failed",
  "details": ["Filename contains path traversal characters"]
}
```

**Cause:** Filename contains `../` or similar.

**Fix:** Client should sanitize filenames before upload.

### Missing sessionId

```json
{
  "success": false,
  "error": {
    "code": "MISSING_REQUIRED_FIELD",
    "message": "sessionId is required"
  }
}
```

**Cause:** Request missing sessionId parameter.

**Fix:** Include in body or query:

```typescript
// FormData
formData.append("sessionId", sessionId);

// Or query string
fetch(`/api/upload?sessionId=${sessionId}`, { body: formData });
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_FILE_SIZE` | `5242880` | Max file size in bytes (5MB) |
| `MAX_FILES_PER_UPLOAD` | `10` | Max files per request |
| `UPLOADS_DIR` | `./uploads` | Base upload directory |

---

## Further Reading

- [Layer 1.3: Middleware](./LAYER_1.3_MIDDLEWARE.md) - Middleware ordering
- [Layer 2.4: Image Storage](./LAYER_2.4_IMAGE_STORAGE.md) - Storage patterns
- [Layer 5: Background Processing](./LAYER_5_BACKGROUND.md) - Image processing jobs
- [Multer Documentation](https://github.com/expressjs/multer)
- [file-type Library](https://github.com/sindresorhus/file-type)
- [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
