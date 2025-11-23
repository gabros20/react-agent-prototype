# Troubleshooting Guide

## Common Issues

### Issue: Agent Shows "AI metadata generation pending" for All Images

**Symptoms:**
```
agent: "Show me all images in the system"
- Description: Image uploaded successfully. AI metadata generation pending.
- Tags: unprocessed
- Categories: uncategorized
```

**Root Cause:**
The server cached old images from before the database was reseeded. The agent queries stale data.

**Solution:**
```bash
pnpm reset:system
pnpm dev
```

**Why it happens:**
1. Server starts and loads images into memory
2. Database is reseeded with `pnpm seed` (clears old data)
3. Server still has OLD images cached
4. New images exist in DB, but server doesn't see them

**Prevention:**
- Always run `pnpm reset:system` after reseeding the database
- Don't reseed while `pnpm dev` is running

---

### Issue: Images Missing Metadata After Upload

**Symptoms:**
- Images uploaded successfully
- Status shows "completed"
- But metadata shows "pending" or "unprocessed"

**Root Cause:**
Worker not running or crashed during processing.

**Diagnosis:**
```bash
# Check images
pnpm check:images

# Expected output with problem:
⚠️  3 images missing metadata
   Worker may not be running: pnpm worker
```

**Solution:**
```bash
# Check if worker is in pnpm dev
pnpm dev  # Starts all services including worker

# OR run worker separately
pnpm worker
```

**Verify:**
Wait 5-10 seconds after upload, then run:
```bash
pnpm check:images
```

Should show:
```
✅ All images have metadata
```

---

### Issue: Worker Hangs or Won't Stop

**Symptoms:**
- Ctrl+C doesn't kill worker
- Process keeps running
- Jobs stuck in "active" state

**Solution:**
```bash
# Hard kill all processes
pkill -f "tsx watch"
pkill -f "pnpm worker"

# Clear Redis queue
redis-cli FLUSHALL

# Restart fresh
pnpm dev
```

**Prevention:**
Worker now has graceful shutdown (SIGINT, SIGTERM). If still hangs:
```bash
pnpm reset:system
```

---

### Issue: Duplicate Images in Database

**Symptoms:**
```bash
pnpm check:images
# Shows more images than expected
```

**Root Cause:**
Multiple seed runs without clearing database.

**Solution:**
```bash
# Clear and reseed
pnpm db:push  # Applies schema (clears data)
pnpm seed     # Seed CMS data
pnpm seed:images  # Seed images

# Reset all services
pnpm reset:system
pnpm dev
```

---

### Issue: Redis Not Running

**Symptoms:**
```
❌ Redis is NOT running
Worker crashes immediately
```

**Solution:**
```bash
# Start Redis
brew services start redis

# Verify
redis-cli ping  # Should return PONG

# Restart system
pnpm reset:system
pnpm dev
```

---

### Issue: Database Locked Errors

**Symptoms:**
```
Error: database is locked
SQLITE_BUSY: database is locked
```

**Root Cause:**
Multiple processes accessing SQLite simultaneously, or WAL files not checkpointed.

**Solution:**
```bash
# Stop all processes
pnpm reset:system

# Checkpoint WAL manually
sqlite3 data/sqlite.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Restart
pnpm dev
```

**Prevention:**
SQLite uses WAL mode for better concurrency, but:
- Don't run multiple `pnpm dev` instances
- Don't reseed while server is running

---

## Quick Reference Commands

```bash
# Check system health
pnpm check:images           # Verify images have metadata
pnpm reset:system           # Clear all caches, stop processes

# Development workflow
pnpm dev                    # Start all services (recommended)
pnpm worker                 # Start worker only (if needed)

# Database management
pnpm db:push                # Apply schema (CLEARS DATA!)
pnpm seed                   # Seed CMS data
pnpm seed:images            # Seed sample images

# Debugging
redis-cli --scan --pattern "*"  # List all Redis keys
sqlite3 data/sqlite.db          # Open database
pnpm typecheck                  # Check TypeScript errors
```

---

## Complete Reset Procedure

When everything breaks:

```bash
# 1. Stop everything
pnpm reset:system

# 2. Clear and reseed database
pnpm db:push
pnpm seed
pnpm seed:images

# 3. Verify
pnpm check:images

# 4. Start development
pnpm dev

# 5. Test
# Go to http://localhost:3000/assistant
# Ask: "Show me all images in the system"
```

Expected result:
```
3 images with full descriptions, tags, and categories
No "pending" or "unprocessed" messages
```

---

## Understanding the System

### Image Upload Flow

1. **Upload** → Image saved to `uploads/` directory
2. **Database** → Record created with `status: "processing"`
3. **Jobs Queued** (via Redis/BullMQ):
   - `generate-variants` - Create WebP/AVIF versions
   - `generate-metadata` - AI analysis with GPT-4o-mini
   - `generate-embeddings` - Vector embeddings for search
4. **Worker Processes** → Jobs execute (5-10 seconds)
5. **Complete** → Status changed to `completed`, metadata populated

### Why Jobs Fail

- **Worker not running** → Jobs queued but never processed
- **OpenRouter API error** → Metadata generation fails, uses fallback
- **File deleted** → Worker can't read image from disk
- **Redis down** → Jobs can't be queued
- **Process killed mid-job** → Job marked as failed, needs retry

### Checking Job Status

```bash
# List all jobs in Redis
redis-cli --scan --pattern "bull:image-processing:*"

# Count failed jobs
redis-cli LLEN "bull:image-processing:failed"

# Clear all jobs
redis-cli FLUSHALL
```

---

## Prevention Best Practices

1. **Always use `pnpm dev`** - Starts all services together
2. **Don't reseed while running** - Stop services first
3. **Use `pnpm reset:system`** - After any major changes
4. **Check worker logs** - If images missing metadata
5. **Monitor Redis** - Ensure it's always running
6. **Graceful shutdown** - Ctrl+C once, wait for "Worker closed"

---

## Getting Help

If none of these solutions work:

1. Run diagnostic:
```bash
pnpm check:images
```

2. Check logs:
```bash
# Worker logs (from pnpm dev output)
# Look for:
✅ Job metadata-XXX completed successfully
❌ Job metadata-XXX failed
```

3. Provide:
- Output of `pnpm check:images`
- Worker logs
- Error messages
- What you were doing when it broke
