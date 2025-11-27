# Layer 5.2: Queue Definition

> BullMQ queue setup, default job options, QueueEvents listeners

## Overview

The Queue is the producer side of the job system. It defines the queue name, default job options (retry policy, job retention), and QueueEvents for monitoring job lifecycle. Jobs are dispatched from the main application (image upload routes) and consumed by workers.

**Key Responsibilities:**
- Define queue with unique name
- Configure default job options
- Set up QueueEvents for lifecycle monitoring
- Export typed job interfaces
- Provide job dispatch entry point

---

## The Problem

Without proper queue definition:

```typescript
// WRONG: No retry policy
await queue.add('process', { imageId });
// Job fails once and is lost forever

// WRONG: Jobs never cleaned up
await queue.add('process', { imageId });
// Redis fills up with completed jobs

// WRONG: No job lifecycle visibility
await queue.add('process', { imageId });
// Can't know when job completes or fails

// WRONG: Untyped job data
await queue.add('process', data);  // What shape is data?
// Runtime errors from wrong data structure
```

**Our Solution:**
1. Default job options with retry and backoff
2. Auto-removal of completed/failed jobs
3. QueueEvents for job lifecycle monitoring
4. TypeScript interfaces for job data

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    QUEUE DEFINITION                            │
│                                                                │
│  Application Code                                              │
│  (Image Upload Route)                                          │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   imageQueue                            │   │
│  │            Queue("image-processing")                    │   │
│  │                                                         │   │
│  │  Default Job Options:                                   │   │
│  │  ├─ attempts: 3                                         │   │
│  │  ├─ backoff: exponential, 2000ms                        │   │
│  │  ├─ removeOnComplete: age 1h, count 1000                │   │
│  │  └─ removeOnFail: age 24h                               │   │
│  │                                                         │   │
│  │  Job Types:                                             │   │
│  │  ├─ generate-metadata                                   │   │
│  │  ├─ generate-variants                                   │   │
│  │  └─ generate-embeddings                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                        │                                       │
│                        ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  QueueEvents                            │   │
│  │         QueueEvents("image-processing")                 │   │
│  │                                                         │   │
│  │  Listeners:                                             │   │
│  │  ├─ added    → 📥 Job queued                            │   │
│  │  └─ failed   → ❌ Job failed                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                        │                                       │
│                        ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Redis                              │   │
│  │                                                         │   │
│  │  bull:image-processing:wait     (waiting jobs)          │   │
│  │  bull:image-processing:active   (processing jobs)       │   │
│  │  bull:image-processing:completed (done jobs)            │   │
│  │  bull:image-processing:failed   (failed jobs)           │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/queues/image-queue.ts` | Queue definition and exports |
| `server/services/storage/image-processing.service.ts` | Job dispatch |

---

## Core Implementation

### Queue Definition

```typescript
// server/queues/image-queue.ts
import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";

const connection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: null,
});

export const imageQueue = new Queue("image-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,  // 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 3600,    // Keep completed jobs for 1 hour
      count: 1000,  // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 24 * 3600,  // Keep failed jobs for 24 hours
    },
  },
});
```

### QueueEvents for Monitoring

```typescript
// Queue events for job lifecycle
const queueEvents = new QueueEvents("image-processing", { connection });

queueEvents.on("added", ({ jobId, name }) => {
  console.log(`📥 [Queue] Job ${name} queued (${jobId})`);
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`❌ [Queue] Job ${jobId} failed:`, failedReason);
});
```

### Typed Job Interfaces

```typescript
export interface GenerateMetadataJob {
  imageId: string;
  filePath: string;
}

export interface GenerateVariantsJob {
  imageId: string;
  filePath: string;
}

export interface GenerateEmbeddingsJob {
  imageId: string;
  metadata: any;
  filePath: string;
}
```

### Job Dispatch Example

```typescript
// server/services/storage/image-processing.service.ts
import { imageQueue } from "../../queues/image-queue";

// After image upload
const { imageQueue } = await import("../../queues/image-queue");

await imageQueue.add(
  "generate-metadata",
  { imageId: result.imageId, filePath: result.storedFile.originalPath },
  { jobId: `metadata-${result.imageId}` }
);

await imageQueue.add(
  "generate-variants",
  { imageId: result.imageId, filePath: result.storedFile.originalPath },
  { jobId: `variants-${result.imageId}` }
);
```

---

## Design Decisions

### Why Default Job Options?

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  ...
}
```

**Reasons:**
1. **Consistency** - All jobs have same retry behavior
2. **DRY** - Don't repeat options on every add()
3. **Overridable** - Can still override per-job
4. **Best practices** - Sensible defaults for image processing

### Why Exponential Backoff?

```typescript
backoff: {
  type: "exponential",
  delay: 2000,  // 2s → 4s → 8s
}
```

**Reasons:**
1. **Rate limit friendly** - Longer waits reduce API pressure
2. **Transient failures** - Many failures are temporary
3. **Not too aggressive** - 2s base isn't too slow
4. **Industry standard** - Common pattern for job retries

### Why removeOnComplete with Age AND Count?

```typescript
removeOnComplete: {
  age: 3600,    // 1 hour
  count: 1000,  // max 1000
}
```

**Reasons:**
1. **Memory management** - Redis doesn't grow unbounded
2. **Debug window** - 1 hour to inspect completed jobs
3. **Burst protection** - Count limit handles processing spikes
4. **Balance** - Keep recent jobs but not all history

### Why Keep Failed Jobs Longer (24h)?

```typescript
removeOnFail: {
  age: 24 * 3600,  // 24 hours
}
```

**Reasons:**
1. **Debugging** - More time to investigate failures
2. **Alerting** - Can set up monitoring on failed queue
3. **Manual retry** - Admin can manually retry failed jobs
4. **Different importance** - Failures need more attention

### Why Explicit Job IDs?

```typescript
await imageQueue.add(
  "generate-metadata",
  { imageId },
  { jobId: `metadata-${imageId}` }
);
```

**Reasons:**
1. **Idempotency** - Same image won't queue duplicate jobs
2. **Debugging** - Easy to find job by image ID
3. **Deduplication** - BullMQ rejects duplicate job IDs
4. **Tracing** - Link job back to image record

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 5.1 (Redis) | Uses Redis connection for queue storage |
| Layer 5.3 (Worker) | Worker consumes jobs from this queue |
| Layer 4.4 (Image Processing) | Service dispatches jobs after upload |
| Layer 1.5 (Routes) | Upload route triggers job dispatch |

### Job Dispatch Flow

```typescript
// 1. Upload completes
const result = await imageProcessingService.processImage({ buffer, filename, sessionId });

// 2. Jobs dispatched (in processImage)
await imageQueue.add("generate-metadata", { imageId, filePath });
await imageQueue.add("generate-variants", { imageId, filePath });

// 3. QueueEvents logs
// 📥 [Queue] Job generate-metadata queued (metadata-abc123)
// 📥 [Queue] Job generate-variants queued (variants-abc123)

// 4. Worker picks up jobs (Layer 5.3)
```

### Queue Inspection

```typescript
// Get queue stats
const counts = await imageQueue.getJobCounts();
console.log(counts);
// { waiting: 5, active: 2, completed: 100, failed: 3 }

// Get specific job
const job = await imageQueue.getJob("metadata-abc123");
console.log(job.data, job.progress, job.failedReason);

// Pause/resume queue
await imageQueue.pause();
await imageQueue.resume();

// Clean old jobs
await imageQueue.clean(0, 1000, "completed");  // Remove all completed
```

---

## Common Issues / Debugging

### Duplicate Job IDs

```
Error: Job with id metadata-abc123 already exists
```

**Cause:** Same image uploaded twice quickly.

**Fix:** This is expected behavior - deduplication working.

### Jobs Not Being Processed

```
// Jobs in 'waiting' but never move to 'active'
```

**Cause:** Worker not running.

**Debug:**

```bash
# Check queue stats
redis-cli LLEN "bull:image-processing:wait"

# Start worker
pnpm worker:dev
```

### Job Options Not Applied

```typescript
await queue.add("job", data);  // No options - uses defaults

await queue.add("job", data, {
  attempts: 1,  // Overrides default
});
```

**Behavior:** Per-job options override defaults.

### QueueEvents Not Firing

```
// No logs from queueEvents
```

**Cause:** QueueEvents needs its own connection.

**Fix:** Ensure QueueEvents uses same connection config:

```typescript
const queueEvents = new QueueEvents("image-processing", {
  connection,  // Same config, not same instance
});
```

### Redis Keys Growing

```bash
redis-cli DBSIZE  # Shows many keys
redis-cli keys "bull:*" | wc -l
```

**Cause:** removeOnComplete/removeOnFail not working.

**Debug:**

```typescript
// Check job options
const job = await queue.getJob(jobId);
console.log(job.opts);  // Should show removal options
```

**Fix:** Verify defaultJobOptions are set correctly.

---

## Further Reading

- [Layer 5.1: Redis Connection](./LAYER_5.1_REDIS_CONNECTION.md) - Connection setup
- [Layer 5.3: Worker Lifecycle](./LAYER_5.3_WORKER_LIFECYCLE.md) - Job consumption
- [Layer 4.4: Image Processing](./LAYER_4.4_IMAGE_PROCESSING.md) - Job dispatch
- [BullMQ Queue Docs](https://docs.bullmq.io/guide/queues)
- [BullMQ Job Options](https://docs.bullmq.io/guide/jobs/options)
