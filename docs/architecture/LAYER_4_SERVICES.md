# Layer 4: Services Layer

> Business logic, data access, and cross-cutting concerns

## Overview

The services layer encapsulates all business logic. Services are stateless classes that coordinate between the database, vector store, and other infrastructure. They're accessed via the ServiceContainer singleton.

**Key Changes (AI SDK 6 Migration):**
- ApprovalQueue removed (native `needsApproval` on tools)
- SessionService checkpoint methods removed
- Added tokenizer and pricing services
- Messages saved at end of agent execution only
- NEW: ConversationLogService for debug log persistence
- NEW: WorkerEventsService for real-time job status via Redis pub/sub

**Location:** `server/services/`

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                       Services Layer                              │
│                     (AI SDK 6 Updated)                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                   ServiceContainer                          │  │
│  │              (Singleton DI Registry)                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│         │           │           │           │           │         │
│         ▼           ▼           ▼           ▼           ▼         │
│  ┌───────────┬───────────┬───────────┬───────────┬───────────┐    │
│  │   Page    │  Section  │   Entry   │   Image   │   Post    │    │
│  │  Service  │  Service  │  Service  │  Service  │  Service  │    │
│  └───────────┴───────────┴───────────┴───────────┴───────────┘    │
│         │           │           │           │           │         │
│         ▼           ▼           ▼           ▼           ▼         │
│  ┌───────────┬───────────┬───────────┬───────────┬───────────┐    │
│  │  Session  │  Vector   │   Site    │  Renderer │ Navigation│    │
│  │  Service  │  Index    │ Settings  │  Service  │  Service  │    │
│  └───────────┴───────────┴───────────┴───────────┴───────────┘    │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────────┐│
│  │                    NEW: Utility Services                      ││
│  │  ┌───────────────────┐  ┌─────────────────────────────────┐   ││
│  │  │    Tokenizer      │  │     OpenRouter Pricing          │   ││
│  │  │  (js-tiktoken)    │  │   (Cost Calculation)            │   ││
│  │  └───────────────────┘  └─────────────────────────────────┘   ││
│  │  ┌───────────────────┐  ┌─────────────────────────────────┐   ││
│  │  │  Conversation     │  │     Worker Events               │   ││
│  │  │  Log Service      │  │   (Redis Pub/Sub → SSE)         │   ││
│  │  └───────────────────┘  └─────────────────────────────────┘   ││
│  └───────────────────────────────────────────────────────────────┘│
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Working Memory                           │  │
│  │        (Entity Extraction + Reference Resolution)           │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/service-container.ts` | DI container |
| `server/services/page-service.ts` | Page CRUD + indexing |
| `server/services/section-service.ts` | Section management |
| `server/services/entry-service.ts` | Entry operations |
| `server/services/image-service.ts` | Image CRUD + variants |
| `server/services/post-service.ts` | Blog post management |
| `server/services/session-service.ts` | Chat persistence |
| `server/services/vector-index-service.ts` | Semantic search |
| `server/services/site-settings-service.ts` | Global config |
| `server/services/renderer-service.ts` | Template rendering |
| `server/services/navigation-service.ts` | Menu structure |
| `server/services/working-memory/` | Entity tracking |
| `lib/tokenizer.ts` | Token counting (NEW) |
| `server/services/openrouter-pricing.ts` | Cost calculation (NEW) |
| `server/services/conversation-log-service.ts` | Debug log persistence (NEW) |
| `server/services/worker-events.service.ts` | Redis pub/sub for job events (NEW) |

---

## Service Container

Single access point for all services:

```typescript
// server/services/service-container.ts
class ServiceContainer {
  private static instance: ServiceContainer;

  readonly db: DrizzleDatabase;
  readonly vectorIndex: VectorIndexService;
  readonly pageService: PageService;
  readonly sectionService: SectionService;
  readonly entryService: EntryService;
  readonly imageService: ImageService;
  readonly postService: PostService;
  readonly sessionService: SessionService;
  readonly siteSettingsService: SiteSettingsService;
  readonly navigationService: NavigationService;
  readonly rendererService: RendererService;

  private constructor() {
    this.db = createDatabase();
    this.vectorIndex = new VectorIndexService();
    this.pageService = new PageService(this.db, this.vectorIndex);
    this.sectionService = new SectionService(this.db);
    // ... other services
  }

  static getInstance(): ServiceContainer {
    if (!this.instance) {
      this.instance = new ServiceContainer();
    }
    return this.instance;
  }
}
```

---

## NEW: Tokenizer Service

Token counting for cost estimation:

```typescript
// lib/tokenizer.ts
import { encodingForModel, type TiktokenModel } from 'js-tiktoken';

// Cache encodings to avoid re-initialization
const encodingCache = new Map<string, ReturnType<typeof encodingForModel>>();

function getEncoding(model: string) {
  if (!encodingCache.has(model)) {
    try {
      encodingCache.set(model, encodingForModel(model as TiktokenModel));
    } catch {
      // Fall back to gpt-4o for unknown models
      encodingCache.set(model, encodingForModel('gpt-4o'));
    }
  }
  return encodingCache.get(model)!;
}

export function countTokens(text: string, model = 'gpt-4o'): number {
  const encoding = getEncoding(model);
  return encoding.encode(text).length;
}

export function countMessageTokens(
  messages: Array<{ role: string; content: string }>,
  model = 'gpt-4o'
): number {
  const encoding = getEncoding(model);

  let total = 0;
  for (const msg of messages) {
    // Each message has overhead: ~4 tokens for role + delimiters
    total += 4;
    total += encoding.encode(msg.content).length;
  }
  // Add 3 for assistant reply priming
  total += 3;

  return total;
}
```

**Usage:**

```typescript
import { countTokens, countMessageTokens } from '@/lib/tokenizer';

const promptTokens = countTokens(systemPrompt);
const messageTokens = countMessageTokens(messages);
const totalInput = promptTokens + messageTokens;
```

---

## NEW: OpenRouter Pricing Service

Cost calculation for model usage:

```typescript
// server/services/openrouter-pricing.ts

// Pricing per 1M tokens (updated periodically)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-4o': { input: 5.00, output: 15.00 },
  'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'google/gemini-pro': { input: 0.50, output: 1.50 },
  // Default fallback
  'default': { input: 1.00, output: 2.00 },
};

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const inputCost = (inputTokens * pricing.input) / 1_000_000;
  const outputCost = (outputTokens * pricing.output) / 1_000_000;
  return inputCost + outputCost;
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(4)}¢`;
  }
  return `$${cost.toFixed(4)}`;
}

export function getModelPricing(model: string) {
  return MODEL_PRICING[model] || MODEL_PRICING['default'];
}
```

**Usage in Agent Route:**

```typescript
// server/routes/agent.ts
import { calculateCost, formatCost } from '../services/openrouter-pricing';

// After agent completes
const { usage } = result;
const cost = calculateCost(
  usage.promptTokens,
  usage.completionTokens,
  AGENT_CONFIG.modelId
);

// Emit to frontend
writeSSE('usage', {
  promptTokens: usage.promptTokens,
  completionTokens: usage.completionTokens,
  totalTokens: usage.totalTokens,
  estimatedCost: cost,
  formattedCost: formatCost(cost),
});
```

---

## NEW: Conversation Log Service

Persists debug trace entries and metrics for each conversation exchange:

```typescript
// server/services/conversation-log-service.ts

export interface ConversationLog {
  id: string;
  sessionId: string;
  conversationIndex: number;
  userPrompt: string;
  startedAt: Date;
  completedAt: Date | null;
  metrics: ConversationMetrics | null;
  modelInfo: ModelInfo | null;
  entries: TraceEntryData[] | null;  // All trace entries for this exchange
}

export interface ConversationMetrics {
  totalDuration: number;
  toolCallCount: number;
  stepCount: number;
  tokens: { input: number; output: number };
  cost: number;
  errorCount: number;
}

export class ConversationLogService {
  constructor(private db: DrizzleDB) {}

  // Save after agent completes (called from route handler)
  async saveConversationLog(input: CreateConversationLogInput): Promise<ConversationLog>;

  // Get all logs for a session (for debug panel history)
  async getSessionLogs(sessionId: string): Promise<ConversationLog[]>;

  // Aggregated stats for session summary
  async getSessionStats(sessionId: string): Promise<{
    totalConversations: number;
    totalDuration: number;
    totalToolCalls: number;
    totalSteps: number;
    totalTokens: { input: number; output: number };
    totalCost: number;
    totalErrors: number;
  }>;

  // Delete all logs when clearing session history
  async deleteSessionLogs(sessionId: string): Promise<void>;
}
```

**Usage:**

```typescript
// In agent route, after agent completes
const conversationLogService = new ConversationLogService(db);

await conversationLogService.saveConversationLog({
  sessionId,
  userPrompt: inputMessage,
  entries: collectedTraceEntries,
  metrics: {
    totalDuration: Date.now() - startTime,
    toolCallCount,
    stepCount,
    tokens: { input: promptTokens, output: completionTokens },
    cost: calculateCost(promptTokens, completionTokens, modelId),
    errorCount,
  },
  modelInfo: { modelId, pricing: getModelPricing(modelId) },
  startedAt: new Date(startTime),
  completedAt: new Date(),
});
```

---

## NEW: Worker Events Service

Redis pub/sub for real-time worker job status updates via SSE:

```typescript
// server/services/worker-events.service.ts

// Event types matching trace-store
export type WorkerEventType =
  | "job-queued"    // Job added to queue
  | "job-active"    // Worker started processing
  | "job-progress"  // Progress update (0-100)
  | "job-completed" // Job finished successfully
  | "job-failed";   // Job failed with error

export interface WorkerEvent {
  type: WorkerEventType;
  jobId: string;
  jobName: string;  // generate-metadata, generate-variants, generate-embeddings
  imageId: string;
  timestamp: number;
  progress?: number;   // 0-100 for job-progress
  duration?: number;   // ms for job-completed
  error?: string;      // for job-failed
  queueSize?: number;
  attempt?: number;
  maxAttempts?: number;
}

// Publisher - Used by worker process
export class WorkerEventPublisher {
  async publish(event: WorkerEvent): Promise<void>;

  // Convenience methods
  async jobQueued(jobId: string, jobName: string, imageId: string, queueSize?: number): Promise<void>;
  async jobActive(jobId: string, jobName: string, imageId: string): Promise<void>;
  async jobProgress(jobId: string, jobName: string, imageId: string, progress: number): Promise<void>;
  async jobCompleted(jobId: string, jobName: string, imageId: string, duration: number): Promise<void>;
  async jobFailed(jobId: string, jobName: string, imageId: string, error: string): Promise<void>;
}

// Subscriber - Used by main server to forward to SSE
export class WorkerEventSubscriber extends EventEmitter {
  async subscribe(): Promise<void>;
  on(event: 'event', listener: (e: WorkerEvent) => void): this;
}

// Singleton accessors
export function getPublisher(): WorkerEventPublisher;
export function getSubscriber(): WorkerEventSubscriber;
```

**Architecture:**

```
┌─────────────────┐    Redis Pub/Sub    ┌─────────────────┐
│  Worker Process │ ──────────────────▶ │   Main Server   │
│   (BullMQ)      │   worker:events     │   (Express)     │
│                 │                     │                 │
│  Publisher      │                     │  Subscriber     │
│  ─────────      │                     │  ──────────     │
│  jobQueued()    │                     │  on('event')    │
│  jobActive()    │                     │       │         │
│  jobProgress()  │                     │       ▼         │
│  jobCompleted() │                     │  SSE stream     │──▶ Browser
│  jobFailed()    │                     │  writeSSE()     │
└─────────────────┘                     └─────────────────┘
```

**Usage in Worker:**

```typescript
// server/worker/image-worker.ts
import { getPublisher } from '../services/worker-events.service';

const publisher = getPublisher();

// In job processor
await publisher.jobActive(job.id!, job.name, imageId);

// During processing
await publisher.jobProgress(job.id!, job.name, imageId, 50);

// On completion
await publisher.jobCompleted(job.id!, job.name, imageId, duration);
```

**Usage in SSE Route:**

```typescript
// server/routes/agent.ts
import { getSubscriber } from '../services/worker-events.service';

const subscriber = getSubscriber();
await subscriber.subscribe();

subscriber.on('event', (event) => {
  // Forward to connected SSE client
  writeSSE('worker-event', event);
});
```

---

## Core Services

### PageService

Manages pages with automatic vector indexing:

```typescript
class PageService {
  constructor(
    private db: DrizzleDatabase,
    private vectorIndex: VectorIndexService
  ) {}

  async getPages(siteId: string, envId: string, status?: string) {
    return this.db
      .select()
      .from(pages)
      .where(
        and(
          eq(pages.siteId, siteId),
          eq(pages.environmentId, envId),
          status ? eq(pages.status, status) : undefined
        )
      );
  }

  async createPage(siteId: string, envId: string, data: CreatePageInput) {
    const page = await this.db.transaction(async (tx) => {
      const [page] = await tx
        .insert(pages)
        .values({
          id: nanoid(),
          siteId,
          environmentId: envId,
          title: data.title,
          slug: data.slug || slugify(data.title),
          status: 'draft'
        })
        .returning();

      if (data.sections) {
        for (const section of data.sections) {
          await this.sectionService.createEntry(page.id, section);
        }
      }

      return page;
    });

    await this.vectorIndex.indexPage(page);
    return page;
  }

  async deletePage(pageId: string) {
    await this.db.delete(pages).where(eq(pages.id, pageId));
    await this.vectorIndex.removePage(pageId);
  }
}
```

### ImageService

Handles image lifecycle with variant generation:

```typescript
class ImageService {
  async upload(file: Express.Multer.File, siteId: string) {
    const hash = await hashFile(file.path);
    const existing = await this.findByHash(hash);
    if (existing) return existing;

    const datePath = format(new Date(), 'yyyy/MM/dd');
    const destPath = `uploads/${datePath}/original/${file.filename}`;
    await fs.move(file.path, destPath);

    const [image] = await this.db
      .insert(images)
      .values({
        id: nanoid(),
        siteId,
        filename: file.originalname,
        originalPath: destPath,
        hash,
        status: 'pending'
      })
      .returning();

    await imageQueue.add('process-image', { imageId: image.id });
    return image;
  }

  async search(query: string, limit = 10) {
    return this.vectorIndex.searchImages(query, limit);
  }
}
```

### SessionService

Persists chat history (checkpoint methods removed):

```typescript
class SessionService {
  async createSession(title?: string) {
    const [session] = await this.db
      .insert(sessions)
      .values({ id: nanoid(), title })
      .returning();
    return session;
  }

  async loadMessages(sessionId: string): Promise<ModelMessage[]> {
    const session = await this.getSessionById(sessionId);
    return session.messages.map((msg) => ({
      role: msg.role,
      content: JSON.parse(msg.content)
    }));
  }

  async saveMessages(sessionId: string, messages: ModelMessage[]) {
    // Auto-create session if needed
    await this.ensureSession(sessionId);

    // Clear and re-insert
    await this.db.delete(schema.messages)
      .where(eq(schema.messages.sessionId, sessionId));

    for (const msg of messages) {
      await this.addMessage(sessionId, msg);
    }
  }

  // REMOVED: saveCheckpoint, loadCheckpoint, clearCheckpoint
  // Checkpoints were dead code - messages saved at end is sufficient
}
```

### VectorIndexService

Manages LanceDB for semantic search:

```typescript
class VectorIndexService {
  private db: LanceDB;

  async searchPages(query: string, limit = 5) {
    const queryVector = await generateEmbedding(query);
    const results = await this.db
      .query('page_embeddings')
      .nearestTo(queryVector)
      .limit(limit)
      .execute();

    return results.map(r => ({
      pageId: r.pageId,
      score: r._distance,
      content: r.content
    }));
  }

  async searchImages(query: string, limit = 10) {
    const queryVector = await generateEmbedding(query);
    return this.db
      .query('image_embeddings')
      .nearestTo(queryVector)
      .limit(limit)
      .execute();
  }
}
```

---

## Working Memory

In-memory entity tracking across agent steps:

```typescript
// server/services/working-memory/index.ts
class WorkingContext {
  private entities = new Map<string, Entity>();

  add(entity: Entity) {
    this.entities.set(entity.id, entity);
    // Keep only last 10 entities (sliding window)
    if (this.entities.size > 10) {
      const oldest = [...this.entities.entries()]
        .sort((a, b) => a[1].stepNumber - b[1].stepNumber)[0];
      this.entities.delete(oldest[0]);
    }
  }

  toContextString(): string {
    if (this.entities.size === 0) return '';

    const lines = ['[WORKING MEMORY]'];
    for (const entity of this.entities.values()) {
      lines.push(`- ${entity.type}: "${entity.name}" (id: ${entity.id})`);
    }
    return lines.join('\n');
  }

  toJSON(): SerializedContext {
    return {
      entities: Array.from(this.entities.entries())
    };
  }

  static fromJSON(data: SerializedContext): WorkingContext {
    const ctx = new WorkingContext();
    for (const [id, entity] of data.entities) {
      ctx.entities.set(id, entity);
    }
    return ctx;
  }
}
```

---

## Removed: Approval Queue

**Replaced by native `needsApproval` on tools.**

The old ApprovalQueue class is no longer needed:

```typescript
// REMOVED: server/services/approval-queue.ts
// Native AI SDK 6 pattern:
// - Tools have `needsApproval: true`
// - SDK pauses execution
// - Frontend handles approval via /api/agent/approve endpoint
```

---

## Service Patterns

### Transaction Handling

```typescript
async createPageWithSections(data: CreatePageInput) {
  return this.db.transaction(async (tx) => {
    const [page] = await tx.insert(pages).values(pageData).returning();

    for (const section of data.sections) {
      await tx.insert(sectionEntries).values({
        pageId: page.id,
        ...section
      });
    }

    return page;
  });
}
```

### Error Handling

```typescript
class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 500
  ) {
    super(message);
  }
}

async getPage(pageId: string) {
  const page = await this.db.select().from(pages).where(eq(pages.id, pageId));
  if (!page) {
    throw new ServiceError('Page not found', 'PAGE_NOT_FOUND', 404);
  }
  return page;
}
```

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1 (Server) | ServiceContainer |
| Layer 2 (Database) | Drizzle queries |
| Layer 3 (Agent) | Tools call services |
| Layer 5 (Background) | Job dispatch |
| Layer 6 (Client) | Usage/cost displayed |

---

## Deep Dive Topics

- [4.1 CMS Services](./LAYER_4.1_CMS_SERVICES.md) - Page/Section/Entry details
- [4.2 Session Management](./LAYER_4.2_SESSION_MANAGEMENT.md) - Chat persistence
- [4.3 Vector Index](./LAYER_4.3_VECTOR_INDEX.md) - Semantic search
- [4.4 Image Processing](./LAYER_4.4_IMAGE_PROCESSING.md) - Upload pipeline
- [4.5 Renderer](./LAYER_4.5_RENDERER.md) - Template rendering
- [4.6 Working Memory](./LAYER_4.6_WORKING_MEMORY.md) - Entity tracking
