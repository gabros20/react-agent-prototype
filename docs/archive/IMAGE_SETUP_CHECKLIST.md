# Image Handling Setup Checklist

Complete this checklist to set up and verify the image handling system.

## Prerequisites

### 1. Redis Installation

- [ ] **Install Redis**
  ```bash
  # macOS (Homebrew)
  brew install redis

  # Or use Docker
  docker run -d --name redis -p 6379:6379 redis:latest
  ```

- [ ] **Start Redis**
  ```bash
  # macOS (Homebrew)
  brew services start redis

  # Or start manually
  redis-server
  ```

- [ ] **Verify Redis is running**
  ```bash
  redis-cli ping
  # Should return: PONG
  ```

---

### 2. OpenRouter API Key

- [ ] **Verify OpenRouter API key exists**
  - The system uses your existing OpenRouter API key
  - Check that `OPENROUTER_API_KEY` is set in `.env`

- [ ] **Verify key is loaded**
  ```bash
  grep OPENROUTER_API_KEY .env
  # Should show: OPENROUTER_API_KEY=sk-or-v1-...
  ```

**Note**: The image metadata generation uses GPT-4o-mini via OpenRouter, so you don't need a separate OpenAI API key.

---

### 3. Environment Variables

- [ ] **Update .env file with all required variables**
  ```env
  # Storage
  UPLOADS_DIR=./uploads
  BASE_URL=http://localhost:3000
  USE_CDN=false

  # Upload limits
  MAX_FILE_SIZE=5242880  # 5MB
  MAX_FILES_PER_UPLOAD=10

  # Redis
  REDIS_HOST=localhost
  REDIS_PORT=6379

  # OpenRouter (uses existing key)
  OPENROUTER_API_KEY=sk-or-v1-...
  ```

---

## Database Setup

### 4. Database Migration

- [ ] **Verify schema includes image tables**
  ```bash
  # Check if migration exists
  ls server/db/migrations/*giant_man.sql
  # Should show: 0000_nasty_giant_man.sql
  ```

- [ ] **Apply migration (if not already applied)**
  ```bash
  pnpm db:push
  ```

- [ ] **Verify tables exist**
  ```bash
  pnpm db:studio
  # Check for these tables:
  # - images
  # - image_metadata
  # - image_variants
  # - conversation_images
  # - page_section_images
  # - image_processing_queue
  ```

---

### 5. Seed Database

- [ ] **Run seed script to add gallery section**
  ```bash
  pnpm seed
  ```

- [ ] **Verify gallery section exists**
  ```bash
  pnpm db:studio
  # Check section_definitions table
  # Should see: hero, feature, cta, gallery
  ```

---

## Installation Verification

### 6. Dependencies

- [ ] **Verify all image-related packages are installed**
  ```bash
  # Check package.json for:
  # - sharp
  # - multer
  # - sanitize-filename
  # - file-type
  # - bullmq
  # - ioredis
  # - p-retry
  # - @xenova/transformers
  # - openai

  pnpm install  # If anything missing
  ```

---

### 7. File Structure

- [ ] **Verify all files were created**
  ```bash
  # Services
  ls server/services/storage/image-processing.service.ts

  # Queues & Workers
  ls server/queues/image-queue.ts
  ls server/workers/image-worker.ts

  # Routes
  ls server/middleware/upload.ts
  ls server/routes/upload.ts
  ls server/routes/images.ts

  # Tools
  ls server/tools/image-tools.ts

  # Scripts
  ls scripts/start-worker.ts
  ```

---

## System Testing

### 8. Start Services

- [ ] **Start all services (includes worker)**
  ```bash
  pnpm dev
  # Wait for:
  # - "✅ Express API server running on http://localhost:8787"
  # - "🚀 Image processing worker started"
  ```

- [ ] **Or start worker separately (if needed)**
  ```bash
  pnpm dev:worker
  # Wait for: "🚀 Image processing worker started"
  ```

---

### 9. Manual Upload Test

- [ ] **Test upload via curl**
  ```bash
  # Create test image (or use your own)
  curl -o test.jpg https://via.placeholder.com/500

  # Upload
  curl -X POST http://localhost:8787/api/upload \
    -F "files=@test.jpg" \
    -F "sessionId=test-123"

  # Should return JSON with: {"success": true, "images": [...]}
  # Copy the image ID from response
  ```

- [ ] **Check processing status**
  ```bash
  # Replace {imageId} with actual ID from upload response
  curl http://localhost:8787/api/images/{imageId}/status

  # Should show: {"status": "processing"} or {"status": "completed"}
  ```

- [ ] **Wait for processing to complete (5-10 seconds)**
  ```bash
  # Watch worker logs (running with pnpm dev)
  # Should see:
  # - "✅ Job ... (generate-metadata) completed successfully"
  # - "✅ Job ... (generate-variants) completed successfully"
  # - "✅ Job ... (generate-embeddings) completed successfully"
  ```

---

### 10. Verify Generated Data

- [ ] **Check metadata was generated**
  ```bash
  curl http://localhost:8787/api/images/{imageId}/details

  # Should include:
  # - metadata.description
  # - metadata.tags
  # - metadata.categories
  # - metadata.colors
  ```

- [ ] **Check thumbnail was created**
  ```bash
  curl http://localhost:8787/api/images/{imageId}/thumbnail -o thumb.webp
  open thumb.webp  # macOS

  # Should be a 150x150 WebP image
  ```

- [ ] **Check variants were created**
  ```bash
  pnpm db:studio
  # Check image_variants table
  # Should have 6 entries (3 sizes × 2 formats)
  ```

---

### 11. Test Search

- [ ] **Test semantic search**
  ```bash
  curl "http://localhost:8787/api/images/search?q=placeholder"

  # Should return JSON with results array
  # Each result has: id, filename, description, score
  ```

- [ ] **Test find endpoint (for agents)**
  ```bash
  curl -X POST http://localhost:8787/api/images/find \
    -H "Content-Type: application/json" \
    -d '{"description": "test image"}'

  # Should return single best match
  ```

---

### 12. Test Agent Tools

- [ ] **Verify tools are registered**
  ```bash
  # Check server logs when starting
  # Should see tools in AVAILABLE TOOLS count

  # Or check directly:
  grep "cms_findImage\|cms_searchImages" server/tools/all-tools.ts
  ```

- [ ] **Test via agent (if agent is running)**
  ```
  User message: "What images did I upload?"

  Agent should:
  1. Call cms_listConversationImages
  2. Return list of uploaded images
  ```

---

## Redis Monitoring

### 13. Monitor Job Queue

- [ ] **Check Redis keys**
  ```bash
  redis-cli
  > KEYS bull:image-processing:*

  # Should show keys like:
  # - bull:image-processing:waiting
  # - bull:image-processing:active
  # - bull:image-processing:completed
  ```

- [ ] **Check queue lengths**
  ```bash
  redis-cli
  > LLEN bull:image-processing:waiting
  > LLEN bull:image-processing:active
  > LLEN bull:image-processing:completed

  # Active should be 0 when idle
  # Completed should increase as jobs finish
  ```

---

## Performance Testing

### 14. Load Test (Optional)

- [ ] **Upload multiple images**
  ```bash
  # Upload 10 images concurrently
  for i in {1..10}; do
    curl -X POST http://localhost:8787/api/upload \
      -F "files=@test.jpg" \
      -F "sessionId=load-test-$i" &
  done
  wait

  # Watch worker process them
  # Should handle 5 concurrently (based on worker config)
  ```

- [ ] **Verify rate limiting**
  ```bash
  # Worker should limit to 10 jobs/min
  # Check worker logs for rate limiting messages
  ```

---

## Troubleshooting Checklist

### 15. Common Issues

- [ ] **Redis connection refused**
  - Check: `redis-cli ping`
  - Fix: `brew services start redis`

- [ ] **Worker not processing jobs**
  - Check: Worker is running (included in `pnpm dev` or run `pnpm dev:worker`)
  - Check: Redis is running
  - Check: Worker logs for errors

- [ ] **OpenRouter rate limit errors**
  - Check: Worker rate limiting (10/min)
  - Check: OpenRouter account has credits
  - Check: OPENROUTER_API_KEY is valid

- [ ] **CLIP model download slow**
  - Normal on first run (~500MB download)
  - Subsequent runs use cached model
  - Check: `~/.cache/huggingface/`

- [ ] **Search returns no results**
  - Check: Embeddings job completed
  - Check: `pnpm db:studio` → image_metadata table
  - Check: LanceDB index has data

---

## Cleanup (Optional)

### 16. Clean Test Data

- [ ] **Remove test uploads**
  ```bash
  rm -rf uploads/images/2025/
  ```

- [ ] **Clear database**
  ```bash
  pnpm db:push  # Recreate schema
  pnpm seed     # Re-seed data
  ```

- [ ] **Clear Redis**
  ```bash
  redis-cli FLUSHALL
  ```

---

## Sign-Off

### 17. Final Verification

- [ ] ✅ Redis is running and accessible
- [ ] ✅ OpenRouter API key is configured
- [ ] ✅ Database tables exist
- [ ] ✅ Worker is processing jobs
- [ ] ✅ Upload endpoint works
- [ ] ✅ Metadata is generated
- [ ] ✅ Embeddings are created
- [ ] ✅ Search returns results
- [ ] ✅ Agent tools are registered

---

**Setup Complete!** 🎉

Your image handling system is ready to use.

**Next steps:**
- Test with the agent via chat
- Upload real images
- Try semantic search queries
- Integrate with your CMS workflow

**Support:**
- Check `docs/IMAGE_HANDLING_README.md` for API reference
- Check `docs/IMAGE_HANDLING_IMPLEMENTATION.md` for architecture
- Run `scripts/test-image-upload.sh` for automated testing
