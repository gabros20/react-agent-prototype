# Layer 5.3: Worker Lifecycle

> Worker startup, concurrency control, event handling, graceful shutdown

## Overview

The Worker is the consumer side of the job system. It subscribes to the queue, processes jobs with configurable concurrency and rate limiting, handles job lifecycle events, and implements graceful shutdown for clean process termination.

**Key Responsibilities:**
- Start worker and connect to queue
- Process jobs with concurrency control
- Rate limit job processing
- Handle job lifecycle events (active, completed, failed)
- Implement graceful shutdown

---

## The Problem

Without proper worker lifecycle management:

```typescript
// WRONG: No concurrency limit
const worker = new Worker(queue, handler);
// Could spawn unlimited parallel jobs, OOM crash

// WRONG: No rate limiting
const worker = new Worker(queue, handler);
// Hammers external APIs, gets rate limited or banned

// WRONG: No event handling
const worker = new Worker(queue, handler);
// No visibility into job processing

// WRONG: Hard shutdown
process.exit(0);  // Jobs in progress lost
// Data corruption, incomplete processing
```

**Our Solution:**
1. Concurrency limit (5 parallel jobs)
2. Rate limiter (10 jobs per minute)
3. Event handlers for all lifecycle stages
4. SIGINT/SIGTERM graceful shutdown

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKER LIFECYCLE                              │
│                                                                  │
│  pnpm worker:dev                                                 │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     Worker                               │    │
│  │             Worker("image-processing")                   │    │
│  │                                                          │    │
│  │  Configuration:                                          │    │
│  │  ├─ connection: Redis                                   │    │
│  │  ├─ concurrency: 5                                      │    │
│  │  └─ limiter: 10 jobs / 60s                             │    │
│  │                                                          │    │
│  │  Job Processor:                                          │    │
│  │  ├─ generate-metadata → processMetadata()               │    │
│  │  ├─ generate-variants → processVariants()               │    │
│  │  └─ generate-embeddings → processEmbeddings()           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Event Handlers                          │    │
│  │                                                          │    │
│  │  active    → ⚙️  Processing job...                      │    │
│  │  completed → ✅ Job completed (duration)                │    │
│  │  failed    → ❌ Job failed (error)                      │    │
│  │  error     → ❌ Worker error                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               Graceful Shutdown                          │    │
│  │                                                          │    │
│  │  SIGINT/SIGTERM received                                 │    │
│  │       │                                                  │    │
│  │       ▼                                                  │    │
│  │  await worker.close()                                    │    │
│  │       │                                                  │    │
│  │       ├─ Wait for active jobs to complete               │    │
│  │       ├─ Stop accepting new jobs                        │    │
│  │       └─ Close Redis connection                         │    │
│  │       │                                                  │    │
│  │       ▼                                                  │    │
│  │  process.exit(0)                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/workers/image-worker.ts` | Worker definition and handlers |
| `scripts/start-worker.ts` | Worker entry point script |
| `package.json` | Worker start commands |

---

## Core Implementation

### Worker Definition

```typescript
// server/workers/image-worker.ts
import { Worker } from "bullmq";
import Redis from "ioredis";

const redisConnection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "image-processing",
  async (job) => {
    const { imageId } = job.data;

    try {
      if (job.name === "generate-metadata") {
        await processMetadata(job);
      } else if (job.name === "generate-variants") {
        await processVariants(job);
      } else if (job.name === "generate-embeddings") {
        await processEmbeddings(job);
      }

      return { success: true, imageId };
    } catch (error) {
      // Error handling in Layer 5.5
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60000,  // 10 jobs per minute
    },
  }
);
```

### Event Handlers

```typescript
worker.on("active", (job) => {
  const imageId = job.data.imageId?.substring(0, 8) || "unknown";
  console.log(`⚙️  [Worker] Processing ${job.name} for ${imageId}...`);
});

worker.on("completed", (job) => {
  const duration = job.finishedOn
    ? job.finishedOn - (job.processedOn || job.timestamp)
    : 0;
  console.log(
    `✅ [Worker] ${job.name} completed for ${job.data.imageId?.substring(0, 8)}... (${duration}ms)`
  );
});

worker.on("failed", (job, err) => {
  const imageId = job?.data?.imageId?.substring(0, 8) || "unknown";
  console.error(`❌ [Worker] ${job?.name} failed for ${imageId}...:`, err.message);
});

worker.on("error", (err) => {
  console.error("❌ [Worker] Worker error:", err.message);
});
```

### Startup Logging

```typescript
console.log("🚀 [Worker] Image processing worker started");
console.log(`   Redis: ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`);
console.log(`   Concurrency: 5 jobs`);
console.log(`   Rate limit: 10 jobs/minute`);
```

### Graceful Shutdown

```typescript
const shutdown = async (signal: string) => {
  console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
  try {
    await worker.close();
    console.log("✅ Worker closed successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
```

### Package.json Scripts

```json
{
  "scripts": {
    "worker:dev": "tsx watch server/workers/image-worker.ts",
    "worker:start": "tsx server/workers/image-worker.ts",
    "dev:worker": "tsx watch server/workers/image-worker.ts"
  }
}
```

---

## Design Decisions

### Why Concurrency: 5?

```typescript
concurrency: 5
```

**Reasons:**
1. **Memory management** - Sharp image processing is memory-intensive
2. **CPU utilization** - Balance across available cores
3. **API fairness** - Don't overwhelm OpenRouter/GPT-4
4. **Tunable** - Can adjust based on server capacity

### Why Rate Limiter: 10/minute?

```typescript
limiter: {
  max: 10,
  duration: 60000,
}
```

**Reasons:**
1. **API rate limits** - OpenRouter has limits
2. **Cost control** - GPT-4 calls have cost
3. **Burst protection** - Large upload batches don't overwhelm
4. **Predictable load** - Steady processing rate

### Why worker.close() in Shutdown?

```typescript
await worker.close();
```

**Behavior:**
1. Stops accepting new jobs
2. Waits for active jobs to complete
3. Closes Redis connection
4. Returns when fully stopped

**Reasons:**
1. **Data integrity** - In-progress jobs complete
2. **Clean state** - No orphaned jobs
3. **Resource cleanup** - Connections closed
4. **Process manager friendly** - Works with Docker, PM2

### Why Separate Event for Each Lifecycle?

```typescript
worker.on("active", ...);
worker.on("completed", ...);
worker.on("failed", ...);
```

**Reasons:**
1. **Observability** - See exact job state
2. **Metrics** - Can track duration, success rate
3. **Debugging** - Know where jobs are
4. **Alerting** - Hook monitoring into events

### Why Duration Calculation?

```typescript
const duration = job.finishedOn
  ? job.finishedOn - (job.processedOn || job.timestamp)
  : 0;
```

**Reasons:**
1. **Performance tracking** - Know how long jobs take
2. **SLA monitoring** - Alert on slow jobs
3. **Capacity planning** - Predict throughput
4. **Debugging** - Identify bottlenecks

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 5.1 (Redis) | Worker maintains its own Redis connection |
| Layer 5.2 (Queue) | Worker consumes from imageQueue |
| Layer 5.4 (Processors) | Worker dispatches to processor functions |
| Layer 5.5 (Retry) | Worker catches errors for retry logic |

### Progress Reporting

```typescript
async function processMetadata(job: any) {
  await job.updateProgress(10);  // 10% - started

  const buffer = await fs.readFile(fullPath);
  await job.updateProgress(20);  // 20% - file read

  const metadata = await generateImageMetadata(buffer);
  await job.updateProgress(50);  // 50% - AI complete

  await db.insert(imageMetadata).values({ ... });
  await job.updateProgress(80);  // 80% - DB saved

  await imageQueue.add("generate-embeddings", { ... });
  await job.updateProgress(100);  // 100% - done
}
```

### Job Chaining

```typescript
// In processMetadata - chain to embeddings
await imageQueue.add("generate-embeddings", {
  imageId,
  metadata,
  filePath,
}, { jobId: `embeddings-${imageId}` });
```

---

## Common Issues / Debugging

### Worker Not Starting

```
Error: Cannot find module 'bullmq'
```

**Fix:** Install dependencies:

```bash
pnpm install bullmq ioredis
```

### Jobs Stuck in Active

```
// Jobs show "active" but never complete
```

**Cause:** Worker crashed mid-job.

**Debug:**

```bash
# Check active jobs
redis-cli LLEN "bull:image-processing:active"

# Worker may have crashed - restart it
pnpm worker:dev
```

### Too Many Active Jobs

```
// More active jobs than concurrency limit
```

**Cause:** Multiple workers running.

**Debug:**

```bash
# Check for duplicate processes
ps aux | grep image-worker

# Kill duplicates
pkill -f "image-worker"
```

### Rate Limit Exceeded Errors

```
// External API returns 429 Too Many Requests
```

**Fix:** Lower limiter settings:

```typescript
limiter: {
  max: 5,       // Reduce from 10
  duration: 60000,
}
```

### Graceful Shutdown Timeout

```
// worker.close() hangs
```

**Cause:** Long-running job won't finish.

**Fix:** Add timeout:

```typescript
const shutdown = async (signal: string) => {
  const timeout = setTimeout(() => {
    console.error("Force shutdown after timeout");
    process.exit(1);
  }, 30000);  // 30 second timeout

  await worker.close();
  clearTimeout(timeout);
  process.exit(0);
};
```

### Worker Crash Loop

```
// Worker starts, crashes, restarts, crashes...
```

**Cause:** Unhandled error in job processor.

**Debug:**

```typescript
worker.on("error", (err) => {
  console.error("Worker error:", err.stack);  // Full stack trace
});
```

**Fix:** Add try-catch in processor (see Layer 5.5).

---

## Further Reading

- [Layer 5.2: Queue Definition](./LAYER_5.2_QUEUE_DEFINITION.md) - Queue setup
- [Layer 5.4: Job Processors](./LAYER_5.4_JOB_PROCESSORS.md) - Processing logic
- [Layer 5.5: Retry & Error](./LAYER_5.5_RETRY_AND_ERROR.md) - Error handling
- [BullMQ Worker Docs](https://docs.bullmq.io/guide/workers)
- [BullMQ Rate Limiting](https://docs.bullmq.io/guide/rate-limiting)
