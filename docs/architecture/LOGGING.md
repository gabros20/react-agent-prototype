# Service Logging Guide

## Overview

All services now have comprehensive logging with clear prefixes and status indicators to help you understand what's happening in real-time.

## Log Format

```
[Emoji] [Service] Message → Status (Duration)
```

**Status Emojis:**
- ✅ Success (2xx status codes)
- ⚠️  Warning (4xx status codes)
- ❌ Error (5xx status codes or failures)
- ⚙️  Processing/Active
- 📥 Queued

## Service Prefixes

Each service has a unique prefix for easy filtering:

| Service | Prefix | Description |
|---------|--------|-------------|
| API Server | `[API]` | Express API endpoints |
| Preview Server | `[Preview]` | Template rendering server |
| Worker | `[Worker]` | Background job processor |
| Queue | `[Queue]` | Redis job queue |

## Example Logs

### Starting Services (`pnpm dev`)

```bash
# API Server
✅ [API] Express API server running on http://localhost:8787
   Health: http://localhost:8787/health
   CMS API: http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main
   Agent: http://localhost:8787/v1/agent/stream
   Images: http://localhost:8787/api/images
   Upload: http://localhost:8787/api/upload
   Uploads: http://localhost:8787/uploads/
   Database: file:data/sqlite.db

# Preview Server
✅ [Preview] Preview server running on http://localhost:4000
   Pages: http://localhost:4000/pages/home?locale=en
   Raw: http://localhost:4000/pages/home/raw?locale=en
   Health: http://localhost:4000/health
   Uploads: http://localhost:4000/uploads/
   Templates: ./server/templates
   Database: file:data/sqlite.db

# Worker
🚀 [Worker] Image processing worker started
   Redis: localhost:6379
   Concurrency: 5 jobs
   Rate limit: 10 jobs/minute
✅ [Worker] Redis connected

# Queue
✅ [Queue] Redis connected
```

### HTTP Requests

```bash
# API Requests
✅ [API] POST /api/upload → 201 (342ms)
✅ [API] GET /api/images/search?q=puppy → 200 (45ms)
⚠️  [API] GET /api/images/invalid-id → 404 (12ms)
❌ [API] POST /api/upload → 500 (89ms)

# Preview Requests
✅ [Preview] GET /pages/home → 200 (156ms)
✅ [Preview] GET /pages/about/raw → 200 (78ms)
⚠️  [Preview] GET /pages/nonexistent → 404 (23ms)
```

### Worker Jobs

```bash
# Job Lifecycle
📥 [Queue] Job generate-metadata queued (metadata-12345678)
⚙️  [Worker] Processing generate-metadata for 12345678...
✅ [Worker] generate-metadata completed for 12345678... (2341ms)

📥 [Queue] Job generate-variants queued (variants-12345678)
⚙️  [Worker] Processing generate-variants for 12345678...
✅ [Worker] generate-variants completed for 12345678... (1823ms)

📥 [Queue] Job generate-embeddings queued (embeddings-12345678)
⚙️  [Worker] Processing generate-embeddings for 12345678...
✅ [Worker] generate-embeddings completed for 12345678... (567ms)

# Job Failure
📥 [Queue] Job generate-metadata queued (metadata-87654321)
⚙️  [Worker] Processing generate-metadata for 87654321...
❌ [Worker] generate-metadata failed for 87654321...: OpenRouter API error
❌ [Queue] Job metadata-87654321 failed: OpenRouter API error
```

### Redis Events

```bash
# Connection
✅ [Worker] Redis connected
✅ [Queue] Redis connected

# Errors
❌ [Worker] Redis error: Connection timeout
❌ [Queue] Redis error: ECONNREFUSED

# Disconnect
⚠️  [Worker] Redis connection closed
```

### Worker Shutdown

```bash
# Graceful Shutdown (Ctrl+C)
⚠️  Received SIGINT, shutting down gracefully...
✅ Worker closed successfully
```

## Filtering Logs

Use grep to filter by service:

```bash
# Only worker logs
pnpm dev 2>&1 | grep "\[Worker\]"

# Only errors
pnpm dev 2>&1 | grep "❌"

# Only queue activity
pnpm dev 2>&1 | grep "\[Queue\]"

# Only API requests
pnpm dev 2>&1 | grep "\[API\]"

# Only successful jobs
pnpm dev 2>&1 | grep "✅.*Worker.*completed"
```

## Log Silencing

Some logs are automatically suppressed:

**API Server:**
- Health check requests (`/health`)
- Next.js assets (`/_next/*`)

**Preview Server:**
- Health check requests (`/health`)
- Static assets (`/assets/*`)

## Debugging Scenarios

### Image Upload Not Processing

Look for:
```bash
# 1. Upload received
✅ [API] POST /api/upload → 201

# 2. Jobs queued
📥 [Queue] Job generate-metadata queued
📥 [Queue] Job generate-variants queued

# 3. Worker processing
⚙️  [Worker] Processing generate-metadata for...
⚙️  [Worker] Processing generate-variants for...

# 4. Jobs completed
✅ [Worker] generate-metadata completed for...
✅ [Worker] generate-variants completed for...
```

**If missing:** Worker not running or Redis down.

### API Errors

```bash
❌ [API] POST /api/upload → 500 (89ms)
```

Check worker/API logs for error details.

### Slow Requests

```bash
⚠️  [API] GET /api/images/search → 200 (3456ms)  # Slow!
```

If > 1000ms, investigate:
- Database query performance
- Vector search optimization
- Network latency

### Worker Not Processing

```bash
# Jobs queued but never processed
📥 [Queue] Job generate-metadata queued
# ... no worker logs ...
```

**Solution:** Worker not running. Start with `pnpm worker` or `pnpm dev`.

### Redis Connection Issues

```bash
❌ [Worker] Redis error: ECONNREFUSED
```

**Solution:**
```bash
brew services start redis
redis-cli ping  # Should return PONG
```

## Performance Monitoring

Watch job durations:

```bash
# Fast jobs (< 1s)
✅ [Worker] generate-variants completed for... (823ms)

# Normal jobs (1-3s)
✅ [Worker] generate-metadata completed for... (2341ms)

# Slow jobs (> 3s)
⚠️  [Worker] generate-metadata completed for... (5678ms)  # Investigate!
```

**Slow metadata generation:** OpenRouter API slow or rate limited.

## Production Logging

For production, consider:

1. **Structured Logging:**
   ```typescript
   console.log(JSON.stringify({
     level: 'info',
     service: 'api',
     message: 'Request completed',
     duration: 123,
     status: 200
   }));
   ```

2. **Log Aggregation:**
   - Use tools like Winston, Pino, or Bunyan
   - Send to services like Datadog, Logtail, or CloudWatch

3. **Log Levels:**
   ```typescript
   logger.debug('[API] Detailed debug info');
   logger.info('[API] Request completed');
   logger.warn('[API] Slow request detected');
   logger.error('[API] Request failed');
   ```

## Troubleshooting with Logs

### Problem: "Agent shows pending metadata"

**Check:**
```bash
pnpm dev 2>&1 | grep "Worker"
```

**Expected:**
```bash
✅ [Worker] Redis connected
⚙️  [Worker] Processing generate-metadata for...
✅ [Worker] generate-metadata completed for...
```

**If missing:** Run `pnpm reset:system` and `pnpm dev`.

### Problem: "Upload fails silently"

**Check:**
```bash
pnpm dev 2>&1 | grep "upload"
```

**Look for:**
```bash
❌ [API] POST /api/upload → 500
```

Then check error details in server logs.

### Problem: "Jobs stuck in queue"

**Check:**
```bash
redis-cli LLEN "bull:image-processing:wait"
redis-cli LLEN "bull:image-processing:active"
```

**If non-zero:** Jobs stuck. Run:
```bash
pnpm reset:system
```

## Custom Logging

Add your own logs following the pattern:

```typescript
// server/your-file.ts
console.log(`✅ [YourService] Operation completed successfully`);
console.error(`❌ [YourService] Operation failed:`, error.message);
console.log(`⚙️  [YourService] Processing...`);
```

Keep it consistent:
- Use emoji indicators
- Use service prefix
- Include timing for operations
- Log errors with context
