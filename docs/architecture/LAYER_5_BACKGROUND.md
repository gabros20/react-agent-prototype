# Layer 5: Background Processing

> Job queues, workers, and async image processing with BullMQ and Redis

## Overview

Background processing handles async tasks that would block the main request cycle. The system uses BullMQ with Redis for reliable job queuing, primarily for image processing (metadata generation, variant creation, embeddings).

**Key Changes (Recent):**
- NEW: WorkerEventsService for real-time job status via Redis pub/sub → SSE
- Worker publishes events, main server subscribes and forwards to clients

**Queue:** `server/queues/`
**Workers:** `server/workers/`
**Events:** `server/services/worker-events.service.ts`
**Redis Port:** 6379

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                   Background Processing                           │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                      Redis                                  │  │
│  │         (Message Broker + Pub/Sub for Events)               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│         │                       │                                 │
│         │ BullMQ Jobs           │ worker:events pub/sub           │
│         ▼                       ▼                                 │
│  ┌────────────────────┐  ┌──────────────────────────────────┐     │
│  │   BullMQ Queue     │  │    Worker Events (NEW)           │     │
│  │                    │  │                                  │     │
│  │  image-processing: │  │  Publisher (in worker)           │     │
│  │  • generate-meta   │  │  ├─ jobQueued()                  │     │
│  │  • generate-vars   │  │  ├─ jobActive()                  │     │
│  │  • generate-embed  │  │  ├─ jobProgress()                │     │
│  │                    │  │  ├─ jobCompleted()               │     │
│  │  5 concurrent      │  │  └─ jobFailed()                  │     │
│  │  10/min rate       │  │                                  │     │
│  │  3 retries         │  │  Subscriber (in main server)     │     │
│  └────────────────────┘  │  └─ on('event') → writeSSE()     │     │
│         │                └──────────────────────────────────┘     │
│         ▼                       │                                 │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │                   Image Worker                          │      │
│  │                                                         │      │
│  │  ┌───────────┐   ┌───────────┐   ┌──────────────┐       │      │
│  │  │  Metadata │ → │  Variants │ → │ Embeddings   │       │      │
│  │  │   (AI)    │   │  (Sharp)  │   │ (OpenRouter) │       │      │
│  │  └───────────┘   └───────────┘   └──────────────┘       │      │
│  │                                                         │      │
│  │  Updates: images.status, image_variants, vector store   │      │
│  │  Emits: worker events to Redis pub/sub                  │      │
│  └─────────────────────────────────────────────────────────┘      │
│                                  │                                │
│                                  ▼                                │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │                  Main Server                            │      │
│  │                                                         │      │
│  │  WorkerEventSubscriber → SSE stream → Browser           │      │
│  └─────────────────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/queues/image-queue.ts` | Queue definition |
| `server/workers/image-worker.ts` | Job processor |
| `scripts/start-worker.ts` | Worker entry point |
| `server/services/worker-events.service.ts` | Redis pub/sub for events (NEW) |

---

## Queue Configuration

```typescript
// server/queues/image-queue.ts
import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";
import { getPublisher } from "../services/worker-events.service";

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
    removeOnComplete: { age: 3600, count: 1000 },  // Keep 1 hour or 1000 jobs
    removeOnFail: { age: 24 * 3600 },              // Keep 24 hours
  },
});

// QueueEvents for job lifecycle (publishes to SSE)
const queueEvents = new QueueEvents("image-processing", { connection });

queueEvents.on("added", async ({ jobId, name }) => {
  const waitingCount = await imageQueue.getWaitingCount();
  const job = await imageQueue.getJob(jobId);
  await getPublisher().jobQueued(jobId, name, job?.data?.imageId, waitingCount);
});
```

---

## Job Types

### Image Processing Pipeline

When an image is uploaded, jobs are queued:

```typescript
// After upload - start with metadata generation
await imageQueue.add('generate-metadata', {
  imageId: image.id,
  filePath: image.filePath
});

// Variants can be queued separately (not chained)
await imageQueue.add('generate-variants', {
  imageId: image.id,
  filePath: image.filePath
});

// Metadata job chains → Embeddings automatically
```

### Job Chain

```
generate-metadata → generate-embeddings → mark "completed"
generate-variants (parallel, independent)
```

### Job Definitions

| Job Type | Input | Output | Duration |
|----------|-------|--------|----------|
| `generate-metadata` | imageId, filePath | description, tags, colors, mood, categories, composition | ~2-5s |
| `generate-variants` | imageId, filePath | 3 sizes × 2 formats = 6 WebP/AVIF variants | ~3-10s |
| `generate-embeddings` | imageId, metadata, filePath | vector embedding via OpenRouter | ~1-2s |

---

## Worker Implementation

```typescript
// server/workers/image-worker.ts
import { Worker, Job } from "bullmq";
import { getPublisher, WorkerEventPublisher } from "../services/worker-events.service";

let eventPublisher: WorkerEventPublisher;

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
      // Mark image as failed on final retry
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        await db.update(images).set({ status: "failed", error: error.message });
      }
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: { max: 10, duration: 60000 }  // 10 jobs per minute
  }
);

// Worker events → SSE via eventPublisher
worker.on("active", async (job) => {
  await eventPublisher?.jobActive(job.id!, job.name, job.data.imageId, job.attemptsMade + 1, 3);
});

worker.on("completed", async (job) => {
  const duration = job.finishedOn ? job.finishedOn - (job.processedOn || job.timestamp) : 0;
  await eventPublisher?.jobCompleted(job.id!, job.name, job.data.imageId, duration);
});

worker.on("failed", async (job, err) => {
  await eventPublisher?.jobFailed(job?.id!, job?.name!, job?.data?.imageId, err.message, job?.attemptsMade, 3);
});
```

### Job Chaining (in processMetadata)

```typescript
async function processMetadata(job: Job) {
  // ... generate metadata with GPT-4o-mini ...

  // Store in imageMetadata table
  await db.insert(imageMetadata).values({
    imageId,
    description: metadata.description,
    detailedDescription: metadata.detailedDescription,
    tags: JSON.stringify(metadata.tags),
    categories: JSON.stringify(metadata.categories),
    // ... more fields
  });

  // Chain to embeddings job (NOT variants - those are separate)
  await imageQueue.add("generate-embeddings", {
    imageId,
    metadata,
    filePath,
  });
}
```

---

## Job Processors

### Metadata Generation

Uses GPT-4o-mini to analyze images via `generateImageMetadata()` service:

```typescript
// server/workers/image-worker.ts
async function processMetadata(job: Job) {
  const { imageId, filePath } = job.data;

  await job.updateProgress(10);
  await publishProgress(job, 10);

  // Read file and generate metadata with GPT-4o-mini
  const buffer = await fs.readFile(path.join(uploadsDir, filePath));
  const metadata = await generateImageMetadata(buffer);

  await job.updateProgress(50);

  // Store in imageMetadata table (upsert)
  await db.insert(imageMetadata).values({
    id: randomUUID(),
    imageId,
    description: metadata.description,
    detailedDescription: metadata.detailedDescription,
    tags: JSON.stringify(metadata.tags),
    categories: JSON.stringify(metadata.categories),
    objects: JSON.stringify(metadata.objects),
    colors: JSON.stringify(metadata.colors),
    mood: metadata.mood,
    style: metadata.style,
    composition: JSON.stringify(metadata.composition),
    searchableText: metadata.searchableText,
    generatedAt: new Date(),
    model: "gpt-4o-mini",
  }).onConflictDoUpdate({
    target: imageMetadata.imageId,
    set: { /* ... update fields ... */ }
  });

  // Chain to embeddings job
  await imageQueue.add("generate-embeddings", { imageId, metadata, filePath });

  await job.updateProgress(100);
}
```

### Variant Generation

Uses `imageStorageService.generateVariants()` for responsive image sizes:

```typescript
// server/workers/image-worker.ts
async function processVariants(job: Job) {
  const { imageId, filePath } = job.data;

  await job.updateProgress(10);
  await publishProgress(job, 10);

  // Generate variants via storage service (WebP + AVIF in 3 sizes)
  const variants = await imageStorageService.generateVariants(imageId, filePath);

  await job.updateProgress(60);

  // Store variants in database
  for (const variant of variants) {
    await db.insert(imageVariants).values({
      id: randomUUID(),
      imageId,
      variantType: variant.variantType,  // sm, md, lg
      format: variant.format,             // webp, avif
      width: variant.width,
      height: variant.height,
      fileSize: variant.fileSize,
      filePath: variant.filePath,
      createdAt: new Date(),
    });
  }

  await job.updateProgress(100);
}
```

**Variant Sizes:**
| Type | Width | Format |
|------|-------|--------|
| sm | 640px | WebP, AVIF |
| md | 1024px | WebP, AVIF |
| lg | 1920px | WebP, AVIF |

### Embedding Generation

Uses `VectorIndexService` to generate and store embeddings via OpenRouter:

```typescript
// server/workers/image-worker.ts
async function processEmbeddings(job: Job) {
  const { imageId, metadata, filePath } = job.data;

  await job.updateProgress(10);

  // Get or initialize vector index for worker process
  const vi = await getVectorIndex();

  await job.updateProgress(30);

  // Add to vector index - generates embeddings from searchableText
  await vi.add({
    id: imageId,
    type: "image",
    name: path.basename(filePath || "image"),
    slug: path.basename(filePath || "image"),
    searchableText: metadata.searchableText,
    metadata: {
      description: metadata.description,
      tags: metadata.tags,
      categories: metadata.categories,
      colors: metadata.colors.dominant || [],
      mood: metadata.mood,
      style: metadata.style,
    },
  });

  await job.updateProgress(90);

  // Mark image as completed
  await db.update(images).set({
    status: "completed",
    processedAt: new Date(),
  }).where(eq(images.id, imageId));

  await job.updateProgress(100);
}
```

**Note:** Embeddings are generated using OpenRouter API (configured in VectorIndexService).

---

## Status Tracking

Images progress through status states:

```
pending → processing → completed
                    ↘ failed
```

```typescript
async function updateImageStatus(imageId: string, status: ImageStatus) {
  await db
    .update(images)
    .set({ status, updatedAt: new Date() })
    .where(eq(images.id, imageId));
}
```

---

## Retry Logic

Failed jobs retry with exponential backoff:

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000  // 2s, 4s, 8s
  }
}
```

| Attempt | Delay |
|---------|-------|
| 1 | 2 seconds |
| 2 | 4 seconds |
| 3 | 8 seconds |

After 3 failures, image marked as `failed` with error message stored.

---

## Progress Throttling

Progress events are throttled to avoid flooding the SSE stream:

```typescript
// Only publish every 500ms or at key milestones
const isMilestone = [10, 50, 90, 100].includes(progress);
if (isMilestone || now - lastPublish > 500) {
  await eventPublisher.jobProgress(jobId, jobName, imageId, progress);
}
```

This ensures the debug panel gets meaningful updates without overwhelming the connection.

---

## Worker Lifecycle

### Start Worker

```bash
pnpm dev:worker
# or
pnpm worker:start
```

```typescript
// scripts/start-worker.ts
import { worker } from '../server/workers/image-worker';

console.log('Image worker started');

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
```

### Dev Mode (Hot Reload)

```bash
tsx watch scripts/start-worker.ts
```

---

## Queue Monitoring

Check queue status:

```typescript
const waiting = await imageQueue.getWaiting();
const active = await imageQueue.getActive();
const completed = await imageQueue.getCompleted();
const failed = await imageQueue.getFailed();

console.log({
  waiting: waiting.length,
  active: active.length,
  completed: completed.length,
  failed: failed.length
});
```

---

## Redis Commands

```bash
# Check Redis running
redis-cli ping

# View queue keys
redis-cli keys "bull:*"

# Queue stats
redis-cli llen "bull:image-processing:wait"
redis-cli llen "bull:image-processing:active"
```

---

## Error Handling

```typescript
worker.on('failed', async (job, error) => {
  // Log for debugging
  console.error(`Job failed: ${job.name}`, {
    imageId: job.data.imageId,
    attempt: job.attemptsMade,
    error: error.message
  });

  // Notify on final failure
  if (job.attemptsMade >= job.opts.attempts) {
    await notifyAdmins({
      type: 'image-processing-failed',
      imageId: job.data.imageId,
      error: error.message
    });
  }
});
```

---

## Worker Events SSE (NEW)

Real-time job status updates via Redis pub/sub → SSE:

### Event Types

| Event | When | Payload |
|-------|------|---------|
| `job-queued` | Job added to queue | `{ jobId, jobName, imageId, queueSize }` |
| `job-active` | Worker started processing | `{ jobId, jobName, imageId, attempt, maxAttempts }` |
| `job-progress` | Progress update | `{ jobId, jobName, imageId, progress }` |
| `job-completed` | Job finished successfully | `{ jobId, jobName, imageId, duration }` |
| `job-failed` | Job failed | `{ jobId, jobName, imageId, error, attempt }` |

### Publisher (Worker Side)

```typescript
// server/workers/image-worker.ts
import { getPublisher } from '../services/worker-events.service';

const publisher = getPublisher();

worker.on('active', async (job) => {
  await publisher.jobActive(job.id!, job.name, job.data.imageId);
});

worker.on('progress', async (job, progress) => {
  await publisher.jobProgress(job.id!, job.name, job.data.imageId, progress);
});

worker.on('completed', async (job, result) => {
  await publisher.jobCompleted(job.id!, job.name, job.data.imageId, result.duration);
});

worker.on('failed', async (job, error) => {
  await publisher.jobFailed(job.id!, job.name, job.data.imageId, error.message);
});
```

### Subscriber (Main Server)

```typescript
// In agent route or dedicated SSE endpoint
import { getSubscriber } from '../services/worker-events.service';

const subscriber = getSubscriber();
await subscriber.subscribe();

subscriber.on('event', (event) => {
  // Forward to connected SSE client
  writeSSE('worker-event', event);
});
```

### Frontend Integration

The trace-store processes worker events as trace entries:

```typescript
// app/assistant/_stores/trace-store.ts
case 'job-queued':
case 'job-active':
case 'job-progress':
case 'job-completed':
case 'job-failed':
  addEntry({
    type: event.type,
    level: event.type === 'job-failed' ? 'error' : 'info',
    summary: `${event.jobName}: ${event.type}`,
    jobId: event.jobId,
    jobProgress: event.progress,
  });
```

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1 (Server) | Job dispatch from routes |
| Layer 2 (Database) | Update image records |
| Layer 4 (Services) | VectorIndexService for embeddings |
| Layer 4 (Services) | WorkerEventsService for SSE (NEW) |
| Layer 3.7 (Streaming) | worker-event SSE type (NEW) |
| Layer 6 (Client) | Trace store processes job events (NEW) |

---

## Deep Dive Topics

- Queue scaling strategies
- Job priority levels
- Dead letter queues
- Redis persistence
- Distributed worker deployment
- Rate limit tuning
