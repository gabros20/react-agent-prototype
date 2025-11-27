# Layer 5.5: Retry & Error Handling

> Exponential backoff, failure detection, status updates, fallback strategies

## Overview

Error handling in the background processing system covers job-level retries with exponential backoff, final failure detection, database status updates, and application-level fallbacks. The system distinguishes between transient failures (retry) and permanent failures (mark failed).

**Key Responsibilities:**
- Configure retry policy with exponential backoff
- Detect final failure after retry exhaustion
- Update image status to "failed"
- Log errors with context
- Provide fallback data on AI failures

---

## The Problem

Without proper error handling:

```typescript
// WRONG: No retries
const metadata = await generateMetadata(buffer);
// Transient network error → permanent failure

// WRONG: Infinite retries
while (true) {
  try {
    await processImage(imageId);
    break;
  } catch { /* retry forever */ }
}
// Never completes on permanent failure

// WRONG: Status never updated
try {
  await processImage(imageId);
} catch {
  console.error("Failed");  // User sees "processing" forever
}

// WRONG: No error context
throw error;  // Can't debug which image, which step
```

**Our Solution:**
1. BullMQ exponential backoff (2s → 4s → 8s)
2. Final failure detection (attemptsMade >= attempts)
3. Database status update to "failed" with error message
4. Structured logging with job context
5. Fallback metadata on AI failures

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING FLOW                           │
│                                                                  │
│  Job Execution                                                   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Try Processing                           │    │
│  │                                                          │    │
│  │  try {                                                   │    │
│  │    await processMetadata(job);                          │    │
│  │    return { success: true };                            │    │
│  │  } catch (error) {                                       │    │
│  │    throw error;  // Let BullMQ handle                   │    │
│  │  }                                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                         │
│              ┌─────────┴─────────┐                              │
│              │                   │                              │
│          Success              Error                             │
│              │                   │                              │
│              ▼                   ▼                              │
│  ┌───────────────────┐  ┌───────────────────────────────────┐  │
│  │    Completed      │  │        BullMQ Retry               │  │
│  │                   │  │                                   │  │
│  │  worker.on(       │  │  Attempt 1 → Wait 2s  → Retry    │  │
│  │    "completed"    │  │  Attempt 2 → Wait 4s  → Retry    │  │
│  │  )                │  │  Attempt 3 → Wait 8s  → Retry    │  │
│  └───────────────────┘  │  Attempt 4 → FINAL FAILURE       │  │
│                         └───────────────────────────────────┘  │
│                                        │                        │
│                                        ▼                        │
│                         ┌───────────────────────────────────┐  │
│                         │      Final Failure Handler        │  │
│                         │                                   │  │
│                         │  if (attemptsMade >= attempts) {  │  │
│                         │    await updateImage({            │  │
│                         │      status: "failed",            │  │
│                         │      error: error.message         │  │
│                         │    });                            │  │
│                         │  }                                │  │
│                         └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/queues/image-queue.ts` | Default retry options |
| `server/workers/image-worker.ts` | Error catching and status updates |
| `server/services/ai/metadata-generation.service.ts` | pRetry and fallback |

---

## Core Implementation

### Queue-Level Retry Configuration

```typescript
// server/queues/image-queue.ts
export const imageQueue = new Queue("image-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,  // Base delay: 2 seconds
    },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600 },
  },
});
```

### Worker-Level Error Handling

```typescript
// server/workers/image-worker.ts
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
      console.error(`Job ${job.id} failed:`, error);

      // Check if this is the final attempt
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        console.error(`Job ${job.id} failed after all retries. Marking image as failed.`);
        await db
          .update(images)
          .set({
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            processedAt: new Date(),
          })
          .where(eq(images.id, imageId));
      }

      throw error;  // Re-throw for BullMQ to handle retry
    }
  },
  { connection: redisConnection, concurrency: 5 }
);
```

### Worker Event Handlers

```typescript
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

### Application-Level Retry (pRetry)

```typescript
// server/services/ai/metadata-generation.service.ts
import pRetry from "p-retry";

export async function generateImageMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
  try {
    const metadata = await pRetry(
      async () => {
        const response = await openai.chat.completions.create({
          model: "openai/gpt-4o-mini",
          messages: [...],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content in OpenRouter response");
        }

        const parsed = JSON.parse(content);

        if (!parsed.description || !parsed.tags) {
          throw new Error("Invalid metadata structure");
        }

        return parsed;
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          console.warn(
            `Metadata generation attempt ${error.attemptNumber} failed. Retrying...`,
            error
          );
        },
      }
    );

    return { ...metadata, searchableText: buildSearchableText(metadata) };
  } catch (error) {
    console.error("Failed to generate metadata with GPT-4o-mini:", error);
    return generateFallbackMetadata();  // Graceful degradation
  }
}
```

### Fallback Metadata

```typescript
function generateFallbackMetadata(): ImageMetadata {
  return {
    description: "Image uploaded successfully. AI metadata generation pending.",
    detailedDescription: "Detailed description will be generated soon.",
    tags: ["unprocessed"],
    categories: ["uncategorized"],
    objects: [],
    colors: {
      dominant: [],
      palette: [],
    },
    mood: "unknown",
    style: "unknown",
    composition: {
      orientation: "landscape",
      subject: "unknown",
      background: "unknown",
    },
    searchableText: "unprocessed uncategorized",
  };
}
```

---

## Design Decisions

### Why Exponential Backoff?

```typescript
backoff: {
  type: "exponential",
  delay: 2000,
}
// Attempt 1: wait 2s
// Attempt 2: wait 4s
// Attempt 3: wait 8s
```

**Reasons:**
1. **Transient failures** - Network blips resolve quickly
2. **Rate limits** - Give APIs time to reset
3. **Not too aggressive** - 2s base is reasonable
4. **Not too slow** - Still completes in ~14s total

### Why 3 Attempts Default?

```typescript
attempts: 3
```

**Reasons:**
1. **Industry standard** - Common default
2. **Transient coverage** - Most transient failures resolve
3. **Not wasteful** - Don't retry permanent failures too much
4. **Reasonable timeout** - ~14s total max wait

### Why Check attemptsMade in Worker?

```typescript
if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
  // Final failure handling
}
```

**Reasons:**
1. **Final failure detection** - Know when retries exhausted
2. **Status update timing** - Update before BullMQ moves to failed
3. **Error message capture** - Store error in database
4. **User visibility** - Image shows "failed" not "processing"

### Why Two-Level Retry (pRetry + BullMQ)?

```typescript
// Level 1: pRetry for API calls
await pRetry(() => openai.create(...), { retries: 3 });

// Level 2: BullMQ for job-level
defaultJobOptions: { attempts: 3 }
```

**Reasons:**
1. **Different scope** - API retry vs. job retry
2. **Granularity** - Fast retry for API, slower for jobs
3. **Fallback timing** - Return fallback before job fails
4. **Total attempts** - 3 × 3 = 9 attempts before final failure

### Why Fallback Instead of Failure?

```typescript
catch (error) {
  return generateFallbackMetadata();  // Don't throw
}
```

**Reasons:**
1. **User experience** - Image uploaded, some metadata available
2. **Pipeline continues** - Variants and embeddings can proceed
3. **Later retry** - Can regenerate metadata later
4. **Visibility** - "unprocessed" tag shows state

### Why Store Error Message?

```typescript
error: error instanceof Error ? error.message : "Unknown error"
```

**Reasons:**
1. **Debugging** - Know why it failed
2. **Support** - Answer user questions
3. **Monitoring** - Aggregate error patterns
4. **Retry decision** - Decide if manual retry worthwhile

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 5.2 (Queue) | Retry options defined on queue |
| Layer 5.3 (Worker) | Worker catches and re-throws |
| Layer 5.4 (Processors) | Processors throw on failure |
| Layer 2 (Database) | Status updated on final failure |

### Retry Timeline

```
t=0     Job starts (attempt 1)
t=0.5   Error thrown
        → BullMQ schedules retry
t=2.5   Job retries (attempt 2)
t=3     Error thrown
        → BullMQ schedules retry
t=7     Job retries (attempt 3)
t=7.5   Error thrown
        → Final failure detected
        → Image status → "failed"
        → Job moved to failed queue
```

### Status State Machine

```
         ┌──────────────┐
         │   pending    │  (initial)
         └──────────────┘
                │
                ▼
         ┌──────────────┐
         │  processing  │  (job started)
         └──────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  completed   │  │    failed    │
└──────────────┘  └──────────────┘
```

---

## Common Issues / Debugging

### Image Stuck in "processing"

```sql
SELECT * FROM images WHERE status = 'processing'
  AND uploadedAt < datetime('now', '-1 hour');
```

**Cause:** Worker crashed before status update.

**Fix:** Manual status update or re-queue:

```typescript
await db.update(images)
  .set({ status: "failed", error: "Worker crash - manual recovery" })
  .where(eq(images.id, imageId));
```

### All Retries Exhausted But No Error

```
// Status is "processing", not "failed"
```

**Cause:** Status update failed or was skipped.

**Debug:**

```typescript
// Check job in failed queue
const failed = await imageQueue.getFailed();
const job = failed.find(j => j.data.imageId === imageId);
console.log("Failure reason:", job?.failedReason);
```

### Exponential Backoff Too Slow

```
// Takes 14+ seconds to fail completely
```

**Fix:** Reduce delay or attempts:

```typescript
backoff: {
  type: "exponential",
  delay: 1000,  // 1s instead of 2s
}
// or
attempts: 2  // 2 instead of 3
```

### Rate Limit Errors Still Occurring

```
Error: 429 Too Many Requests
```

**Cause:** Backoff not long enough for API limits.

**Fix:** Increase base delay:

```typescript
backoff: {
  type: "exponential",
  delay: 5000,  // 5s base → 10s → 20s
}
```

### Fallback Metadata Not Triggering

```
// Error thrown instead of fallback
```

**Cause:** Error in fallback function or thrown after pRetry.

**Debug:**

```typescript
try {
  return await pRetry(() => generateMetadata(buffer), { retries: 3 });
} catch (error) {
  console.error("Using fallback:", error);  // Add logging
  return generateFallbackMetadata();
}
```

### Memory Leak from Failed Jobs

```
// Redis memory growing
```

**Cause:** removeOnFail not configured or too long.

**Fix:**

```typescript
removeOnFail: {
  age: 86400,  // 24 hours
  count: 100,  // Max 100 failed jobs
}
```

---

## Further Reading

- [Layer 5.2: Queue Definition](./LAYER_5.2_QUEUE_DEFINITION.md) - Retry configuration
- [Layer 5.3: Worker Lifecycle](./LAYER_5.3_WORKER_LIFECYCLE.md) - Error events
- [Layer 5.4: Job Processors](./LAYER_5.4_JOB_PROCESSORS.md) - Where errors occur
- [BullMQ Retry Docs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [pRetry Documentation](https://github.com/sindresorhus/p-retry)
