# Layer 5: Background Processing

> Job queues, workers, and async image processing with BullMQ and Redis

## Overview

Background processing handles async tasks that would block the main request cycle. The system uses BullMQ with Redis for reliable job queuing, primarily for image processing (metadata generation, variant creation, embeddings).

**Queue:** `server/queues/`
**Workers:** `server/workers/`
**Redis Port:** 6379

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Background Processing                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      Redis                                  ││
│  │               (Message Broker)                              ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    BullMQ Queue                             ││
│  │                                                             ││
│  │   ┌─────────────────────────────────────────────────────┐  ││
│  │   │              image-processing                       │  ││
│  │   │                                                     │  ││
│  │   │  Jobs:                                              │  ││
│  │   │  • generate-metadata (GPT-4o-mini)                  │  ││
│  │   │  • generate-variants (Sharp: webp, avif)            │  ││
│  │   │  • generate-embeddings (OpenRouter)                 │  ││
│  │   │                                                     │  ││
│  │   │  Config: 5 concurrent, 10/min rate, 3 retries      │  ││
│  │   └─────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Image Worker                              ││
│  │                                                             ││
│  │  ┌───────────┐   ┌───────────┐   ┌───────────┐             ││
│  │  │  Metadata │ → │  Variants │ → │ Embeddings │             ││
│  │  │   (AI)    │   │  (Sharp)  │   │ (OpenRouter)│            ││
│  │  └───────────┘   └───────────┘   └───────────┘             ││
│  │                                                             ││
│  │  Updates: images.status, image_variants, vector store      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/queues/image-queue.ts` | Queue definition |
| `server/workers/image-worker.ts` | Job processor |
| `scripts/start-worker.ts` | Worker entry point |

---

## Queue Configuration

```typescript
// server/queues/image-queue.ts
import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
};

export const imageQueue = new Queue('image-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: { age: 3600 },      // Keep 1 hour
    removeOnFail: { age: 86400 }          // Keep 24 hours
  }
});
```

---

## Job Types

### Image Processing Pipeline

When an image is uploaded, jobs are queued in sequence:

```typescript
// After upload
await imageQueue.add('generate-metadata', {
  imageId: image.id,
  path: image.originalPath
});

// Worker chains next jobs after each completes
```

### Job Definitions

| Job Type | Input | Output | Duration |
|----------|-------|--------|----------|
| `generate-metadata` | imageId, path | description, tags, colors, mood | ~2-5s |
| `generate-variants` | imageId, path | 3 sizes × 2 formats = 6 variants | ~3-10s |
| `generate-embeddings` | imageId, metadata | vector embedding | ~1-2s |

---

## Worker Implementation

```typescript
// server/workers/image-worker.ts
import { Worker } from 'bullmq';
import sharp from 'sharp';

const worker = new Worker(
  'image-processing',
  async (job) => {
    const { imageId } = job.data;

    switch (job.name) {
      case 'generate-metadata':
        return await generateMetadata(job.data);

      case 'generate-variants':
        return await generateVariants(job.data);

      case 'generate-embeddings':
        return await generateEmbeddings(job.data);
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60000  // 10 jobs per minute
    }
  }
);

worker.on('completed', async (job, result) => {
  console.log(`Job ${job.name} completed for image ${job.data.imageId}`);

  // Chain next job
  if (job.name === 'generate-metadata') {
    await imageQueue.add('generate-variants', {
      imageId: job.data.imageId,
      path: job.data.path,
      metadata: result
    });
  } else if (job.name === 'generate-variants') {
    await imageQueue.add('generate-embeddings', {
      imageId: job.data.imageId,
      metadata: job.data.metadata
    });
  } else if (job.name === 'generate-embeddings') {
    // Final step - mark complete
    await updateImageStatus(job.data.imageId, 'completed');
  }
});

worker.on('failed', async (job, error) => {
  console.error(`Job ${job.name} failed:`, error);

  if (job.attemptsMade >= job.opts.attempts) {
    await updateImageStatus(job.data.imageId, 'failed');
  }
});
```

---

## Job Processors

### Metadata Generation

Uses GPT-4o-mini to analyze images:

```typescript
async function generateMetadata(data: { imageId: string; path: string }) {
  const imageBuffer = await fs.readFile(data.path);
  const base64 = imageBuffer.toString('base64');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` }
          },
          {
            type: 'text',
            text: 'Analyze this image. Return JSON: { description, tags[], category, dominantColors[], mood }'
          }
        ]
      }
    ]
  });

  const metadata = JSON.parse(response.choices[0].message.content);

  await db
    .update(images)
    .set({ metadata, status: 'processing' })
    .where(eq(images.id, data.imageId));

  return metadata;
}
```

### Variant Generation

Creates responsive image sizes:

```typescript
const VARIANTS = [
  { width: 640, suffix: 'sm' },
  { width: 1024, suffix: 'md' },
  { width: 1920, suffix: 'lg' }
];

const FORMATS = ['webp', 'avif'];

async function generateVariants(data: { imageId: string; path: string }) {
  const image = sharp(data.path);
  const variants = [];

  for (const size of VARIANTS) {
    for (const format of FORMATS) {
      const outputPath = data.path
        .replace('/original/', '/variants/')
        .replace(/\.[^.]+$/, `-${size.suffix}.${format}`);

      await image
        .resize(size.width, null, { withoutEnlargement: true })
        .toFormat(format, { quality: 80 })
        .toFile(outputPath);

      const stats = await fs.stat(outputPath);

      variants.push({
        id: nanoid(),
        imageId: data.imageId,
        width: size.width,
        format,
        path: outputPath,
        size: stats.size
      });
    }
  }

  await db.insert(imageVariants).values(variants);
  return variants;
}
```

### Embedding Generation

Creates vector embeddings for semantic search:

```typescript
async function generateEmbeddings(data: { imageId: string; metadata: ImageMetadata }) {
  const text = [
    data.metadata.description,
    ...data.metadata.tags,
    data.metadata.category,
    data.metadata.mood
  ].join(' ');

  const embedding = await generateEmbedding(text);

  await vectorIndex.indexImage(data.imageId, text, embedding);

  return { indexed: true };
}
```

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
    delay: 1000  // 1s, 2s, 4s
  }
}
```

| Attempt | Delay |
|---------|-------|
| 1 | 1 second |
| 2 | 2 seconds |
| 3 | 4 seconds |

After 3 failures, image marked as `failed`.

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

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1 (Server) | Job dispatch from routes |
| Layer 2 (Database) | Update image records |
| Layer 4 (Services) | VectorIndexService for embeddings |

---

## Deep Dive Topics

- Queue scaling strategies
- Job priority levels
- Dead letter queues
- Redis persistence
- Distributed worker deployment
- Rate limit tuning
