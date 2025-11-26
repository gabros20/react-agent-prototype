# Layer 4: Services Layer

> Business logic, data access, and cross-cutting concerns

## Overview

The services layer encapsulates all business logic. Services are stateless classes that coordinate between the database, vector store, and other infrastructure. They're accessed via the ServiceContainer singleton.

**Location:** `server/services/`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Services Layer                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   ServiceContainer                          ││
│  │              (Singleton DI Registry)                        ││
│  └─────────────────────────────────────────────────────────────┘│
│         │           │           │           │           │       │
│         ▼           ▼           ▼           ▼           ▼       │
│  ┌───────────┬───────────┬───────────┬───────────┬───────────┐ │
│  │   Page    │  Section  │   Entry   │   Image   │   Post    │ │
│  │  Service  │  Service  │  Service  │  Service  │  Service  │ │
│  └───────────┴───────────┴───────────┴───────────┴───────────┘ │
│         │           │           │           │           │       │
│         ▼           ▼           ▼           ▼           ▼       │
│  ┌───────────┬───────────┬───────────┬───────────┬───────────┐ │
│  │  Session  │  Vector   │   Site    │  Renderer │  Approval │ │
│  │  Service  │  Index    │ Settings  │  Service  │   Queue   │ │
│  └───────────┴───────────┴───────────┴───────────┴───────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Working Memory                           ││
│  │        (Entity Extraction + Reference Resolution)           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
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
| `server/services/approval-queue.ts` | HITL coordination |
| `server/services/working-memory/` | Entity tracking |

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

      // Create sections if provided
      if (data.sections) {
        for (const section of data.sections) {
          await this.sectionService.createEntry(page.id, section);
        }
      }

      return page;
    });

    // Index for semantic search
    await this.vectorIndex.indexPage(page);

    return page;
  }

  async updatePage(pageId: string, data: UpdatePageInput) {
    const [updated] = await this.db
      .update(pages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pages.id, pageId))
      .returning();

    await this.vectorIndex.reindexPage(updated);
    return updated;
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
    // Check for duplicate via hash
    const hash = await hashFile(file.path);
    const existing = await this.findByHash(hash);
    if (existing) return existing;

    // Store original
    const datePath = format(new Date(), 'yyyy/MM/dd');
    const destPath = `uploads/${datePath}/original/${file.filename}`;
    await fs.move(file.path, destPath);

    // Create record
    const [image] = await this.db
      .insert(images)
      .values({
        id: nanoid(),
        siteId,
        filename: file.originalname,
        originalPath: destPath,
        mimeType: file.mimetype,
        size: file.size,
        hash,
        status: 'pending'
      })
      .returning();

    // Queue background processing
    await imageQueue.add('process-image', { imageId: image.id });

    return image;
  }

  async search(query: string, limit = 10) {
    // Semantic search via embeddings
    return this.vectorIndex.searchImages(query, limit);
  }

  async getVariants(imageId: string) {
    return this.db
      .select()
      .from(imageVariants)
      .where(eq(imageVariants.imageId, imageId));
  }
}
```

### SessionService

Persists chat history and checkpoints:

```typescript
class SessionService {
  async createSession(title?: string) {
    const [session] = await this.db
      .insert(sessions)
      .values({ id: nanoid(), title })
      .returning();
    return session;
  }

  async getMessages(sessionId: string) {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.createdAt);
  }

  async saveMessages(sessionId: string, newMessages: Message[]) {
    await this.db.insert(messages).values(
      newMessages.map(m => ({
        id: nanoid(),
        sessionId,
        role: m.role,
        content: m.content,
        createdAt: new Date()
      }))
    );
  }

  async saveCheckpoint(sessionId: string, state: CheckpointState) {
    await this.db
      .update(sessions)
      .set({
        checkpoint: JSON.stringify(state),
        updatedAt: new Date()
      })
      .where(eq(sessions.id, sessionId));
  }

  async loadCheckpoint(sessionId: string): Promise<CheckpointState | null> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    return session?.checkpoint ? JSON.parse(session.checkpoint) : null;
  }
}
```

### VectorIndexService

Manages LanceDB for semantic search:

```typescript
class VectorIndexService {
  private db: LanceDB;

  async indexPage(page: Page) {
    const content = `${page.title} ${page.description || ''} ${extractText(page.sections)}`;
    const embedding = await generateEmbedding(content);

    await this.db.add('page_embeddings', {
      id: page.id,
      pageId: page.id,
      content,
      vector: embedding
    });
  }

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

  async indexImage(image: Image, metadata: ImageMetadata) {
    const content = `${image.filename} ${metadata.description} ${metadata.tags.join(' ')}`;
    const embedding = await generateEmbedding(content);

    await this.db.add('image_embeddings', {
      id: image.id,
      imageId: image.id,
      content,
      vector: embedding
    });
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

### SiteSettingsService

Global configuration storage:

```typescript
class SiteSettingsService {
  async get(siteId: string, key: string) {
    const [setting] = await this.db
      .select()
      .from(siteSettings)
      .where(
        and(eq(siteSettings.siteId, siteId), eq(siteSettings.key, key))
      );
    return setting?.value;
  }

  async set(siteId: string, key: string, value: unknown) {
    await this.db
      .insert(siteSettings)
      .values({ siteId, key, value: JSON.stringify(value) })
      .onConflictDoUpdate({
        target: [siteSettings.siteId, siteSettings.key],
        set: { value: JSON.stringify(value) }
      });
  }

  async getAll(siteId: string) {
    const settings = await this.db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.siteId, siteId));

    return Object.fromEntries(
      settings.map(s => [s.key, JSON.parse(s.value)])
    );
  }
}
```

---

## Working Memory

In-memory entity tracking across agent steps:

```typescript
// server/services/working-memory/index.ts
class WorkingMemoryService {
  private entities = new Map<string, Entity>();
  private references = new Map<string, string>();

  extractEntities(toolResult: unknown, stepNumber: number) {
    // Extract page entities
    if (toolResult.page) {
      this.entities.set(toolResult.page.id, {
        type: 'page',
        id: toolResult.page.id,
        name: toolResult.page.title,
        lastMentioned: stepNumber
      });
      this.references.set('the page', toolResult.page.id);
      this.references.set('that page', toolResult.page.id);
    }

    // Extract image entities
    if (toolResult.image) {
      this.entities.set(toolResult.image.id, {
        type: 'image',
        id: toolResult.image.id,
        name: toolResult.image.filename,
        lastMentioned: stepNumber
      });
    }

    // ... other entity types
  }

  resolveReference(reference: string): string | null {
    return this.references.get(reference.toLowerCase()) || null;
  }

  getRecentEntities(count = 5): Entity[] {
    return Array.from(this.entities.values())
      .sort((a, b) => b.lastMentioned - a.lastMentioned)
      .slice(0, count);
  }

  serialize(): SerializedMemory {
    return {
      entities: Array.from(this.entities.entries()),
      references: Array.from(this.references.entries())
    };
  }
}
```

---

## Approval Queue

Coordinates HITL approval flow:

```typescript
class ApprovalQueue {
  private pending = new Map<string, PendingApproval>();
  private resolvers = new Map<string, (approved: boolean) => void>();

  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    const id = nanoid();
    this.pending.set(id, {
      id,
      toolName: request.toolName,
      args: request.args,
      message: request.message,
      createdAt: Date.now()
    });

    return new Promise((resolve) => {
      this.resolvers.set(id, resolve);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          this.resolvers.delete(id);
          resolve(false);
        }
      }, 5 * 60 * 1000);
    });
  }

  submitResponse(approvalId: string, approved: boolean) {
    const resolver = this.resolvers.get(approvalId);
    if (resolver) {
      resolver(approved);
      this.pending.delete(approvalId);
      this.resolvers.delete(approvalId);
    }
  }

  getPending(): PendingApproval[] {
    return Array.from(this.pending.values());
  }
}
```

---

## Service Patterns

### Transaction Handling

```typescript
// Wrap multi-step operations in transactions
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

// Usage
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

---

## Deep Dive Topics

- Service composition patterns
- Caching strategies
- Batch operations
- Event-driven updates
- Service testing strategies
