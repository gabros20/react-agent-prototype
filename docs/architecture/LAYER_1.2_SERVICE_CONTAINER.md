# Layer 1.2: Service Container

> Singleton dependency injection pattern for service initialization and access

## Overview

The ServiceContainer implements a simple but effective dependency injection pattern. All services are initialized once at startup and accessed via a singleton. This ensures:

- Single database connection shared across all services
- Services can depend on each other without circular imports
- Consistent access pattern throughout the codebase
- Clean initialization and disposal lifecycle

**Pattern:** Singleton with async initialization
**Access:** `ServiceContainer.get()` after `initialize()`

---

## The Problem

Without centralized DI, service management becomes chaotic:

```typescript
// Problem 1: Multiple database connections
const pageService = new PageService(new Database());
const sectionService = new SectionService(new Database());
// Two connections! Wasteful and inconsistent.

// Problem 2: Circular dependencies
// page-service.ts
import { SectionService } from './section-service';
// section-service.ts
import { PageService } from './page-service';
// Error: Cannot resolve circular dependency

// Problem 3: Inconsistent access
// Some files: import { pageService } from './services'
// Other files: const pageService = new PageService(db);
// Which instance is being used?
```

**Our Solution:**
1. Single ServiceContainer holds all services
2. Initialized once with shared database
3. Accessed via static `get()` method anywhere in codebase
4. Async `initialize()` handles services that need setup

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    SERVICE CONTAINER                           │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Static Instance                         │  │
│  │                                                          │  │
│  │  ServiceContainer.instance (singleton)                   │  │
│  │       │                                                  │  │
│  │       ▼                                                  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              Instance Properties                   │  │  │
│  │  │                                                    │  │  │
│  │  │  readonly db: DrizzleDB                            │  │  │
│  │  │  readonly vectorIndex: VectorIndexService          │  │  │
│  │  │  readonly pageService: PageService                 │  │  │
│  │  │  readonly sectionService: SectionService           │  │  │
│  │  │  readonly entryService: EntryService               │  │  │
│  │  │  readonly sessionService: SessionService           │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  Static Methods:                                         │  │
│  │  ├─ initialize(db) → Promise<ServiceContainer>           │  │
│  │  └─ get() → ServiceContainer                             │  │
│  │                                                          │  │
│  │  Instance Methods:                                       │  │
│  │  └─ dispose() → Promise<void>                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Access Pattern:                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  // At startup (once)                                    │  │
│  │  const services = await ServiceContainer.initialize(db); │  │
│  │                                                          │  │
│  │  // Anywhere else                                        │  │
│  │  const services = ServiceContainer.get();                │  │
│  │  await services.pageService.createPage(...);             │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/service-container.ts` | Container implementation |
| `server/index.ts` | Initialization call |
| `server/routes/*.ts` | Service consumption |

---

## Core Implementation

### Service Container Class

```typescript
// server/services/service-container.ts
import type { DrizzleDB } from "../db/client";
import { EntryService } from "./cms/entry-service";
import { PageService } from "./cms/page-service";
import { SectionService } from "./cms/section-service";
import { SessionService } from "./session-service";
import { VectorIndexService } from "./vector-index";

export class ServiceContainer {
  // Singleton instance
  private static instance: ServiceContainer;

  // Readonly service properties
  readonly db: DrizzleDB;
  readonly vectorIndex: VectorIndexService;
  readonly pageService: PageService;
  readonly sectionService: SectionService;
  readonly entryService: EntryService;
  readonly sessionService: SessionService;

  // Private constructor - use initialize() instead
  private constructor(db: DrizzleDB) {
    this.db = db;

    // Initialize vector index first (others may depend on it)
    this.vectorIndex = new VectorIndexService(
      process.env.LANCEDB_DIR || "data/lancedb"
    );

    // Initialize CMS services with shared dependencies
    this.pageService = new PageService(db, this.vectorIndex);
    this.sectionService = new SectionService(db, this.vectorIndex);
    this.entryService = new EntryService(db, this.vectorIndex);

    // Initialize session service
    this.sessionService = new SessionService(db);
  }

  // Async initialization (call once at startup)
  static async initialize(db: DrizzleDB): Promise<ServiceContainer> {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer(db);
      // Async init for services that need it
      await ServiceContainer.instance.vectorIndex.initialize();
    }
    return ServiceContainer.instance;
  }

  // Synchronous access (call anywhere after initialize)
  static get(): ServiceContainer {
    if (!ServiceContainer.instance) {
      throw new Error(
        "ServiceContainer not initialized. Call initialize() first."
      );
    }
    return ServiceContainer.instance;
  }

  // Cleanup on shutdown
  async dispose(): Promise<void> {
    await this.vectorIndex.close();
  }
}
```

### Usage at Startup

```typescript
// server/index.ts
import { db } from "./db/client";
import { ServiceContainer } from "./services/service-container";

async function startServer() {
  // Initialize container with database
  const services = await ServiceContainer.initialize(db);
  console.log("✓ Services initialized");

  // Pass to route factories
  app.use("/v1/agent", createAgentRoutes(services));
  app.use("/v1/sessions", createSessionRoutes(services));
  // ...
}
```

### Usage in Routes

```typescript
// server/routes/cms.ts
import type { ServiceContainer } from "../services/service-container";

export function createCMSRoutes(services: ServiceContainer) {
  const router = express.Router();

  router.get("/pages", async (req, res, next) => {
    try {
      // Access services directly
      const pages = await services.pageService.listPages();
      res.json(ApiResponse.success(pages));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

### Usage Anywhere Else

```typescript
// Any file after server startup
import { ServiceContainer } from "../services/service-container";

async function someFunction() {
  const services = ServiceContainer.get();
  const page = await services.pageService.getPageById(pageId);
}
```

---

## Service Dependencies

Services are initialized with their dependencies:

```typescript
// VectorIndex: no dependencies
this.vectorIndex = new VectorIndexService(lancedbPath);

// CMS Services: depend on db and vectorIndex
this.pageService = new PageService(db, this.vectorIndex);
this.sectionService = new SectionService(db, this.vectorIndex);
this.entryService = new EntryService(db, this.vectorIndex);

// Session Service: depends only on db
this.sessionService = new SessionService(db);
```

**Dependency Graph:**

```
                    db (DrizzleDB)
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
  VectorIndex      SessionService    (shared)
        │                                 │
        ├─────────────────────────────────┤
        │                │                │
        ▼                ▼                ▼
  PageService    SectionService    EntryService
```

---

## Design Decisions

### Why Singleton Pattern?

```typescript
// Option A: Module-level singleton (common in JS)
export const pageService = new PageService(db);

// Option B: Class singleton (chosen)
class ServiceContainer {
  private static instance: ServiceContainer;
  static get() { return this.instance; }
}
```

**Reasons:**
1. **Explicit lifecycle** - `initialize()` and `dispose()` methods
2. **Testability** - Can reset instance in tests
3. **Type safety** - Container type enforces what's available
4. **Grouping** - All services accessed from one place

### Why Async Initialize + Sync Get?

```typescript
// Async: First-time setup
static async initialize(db): Promise<ServiceContainer>

// Sync: Subsequent access
static get(): ServiceContainer
```

**Reasons:**
1. **Async init** - VectorIndex needs async connection
2. **Sync get** - No need to await every access
3. **Fail fast** - `get()` throws if not initialized
4. **Single init** - Only first call does async work

### Why Pass Services to Route Factories?

```typescript
// Option A: Routes access global singleton
router.get("/pages", async (req, res) => {
  const services = ServiceContainer.get(); // Inside handler
});

// Option B: Inject via factory (chosen)
export function createCMSRoutes(services: ServiceContainer) {
  router.get("/pages", async (req, res) => {
    await services.pageService.listPages(); // Already have it
  });
}
```

**Reasons:**
1. **Testability** - Can inject mock services
2. **Explicit dependencies** - Route factory signature shows what it needs
3. **No hidden globals** - Services visible in function signature
4. **IDE support** - Better autocomplete

### Why Private Constructor?

```typescript
private constructor(db: DrizzleDB) {
  // ...
}
```

**Reasons:**
1. **Prevent direct instantiation** - Must use `initialize()`
2. **Enforce singleton** - Can't accidentally create multiple
3. **Async setup** - Constructor can't be async, init can

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1.1 (Bootstrap) | `initialize()` called at startup |
| Layer 2.7 (DB Connection) | `db` passed to constructor |
| Layer 2.5 (Vector Storage) | VectorIndexService created internally |
| Layer 4 (Services) | All services instantiated here |
| Layer 3.8 (Agent Context) | Services exposed to agent tools |

### Agent Context Integration

```typescript
// server/routes/agent.ts
const context: AgentContext = {
  db: services.db,
  vectorIndex: services.vectorIndex,
  services,  // Full container for tools
  sessionService: services.sessionService,
  // ...
};
```

---

## Common Issues / Debugging

### "ServiceContainer not initialized"

```
Error: ServiceContainer not initialized. Call initialize() first.
```

**Cause:** `get()` called before `initialize()`.

**Fix:** Ensure startup completes before accessing:

```typescript
// WRONG: Accessing at module load time
const services = ServiceContainer.get(); // Throws!

// RIGHT: Access after startup
async function startServer() {
  await ServiceContainer.initialize(db);
  // Now get() works anywhere
}
```

### Services Undefined After Init

```typescript
const services = await ServiceContainer.initialize(db);
console.log(services.pageService); // undefined???
```

**Cause:** Constructor error prevented service creation.

**Debug:** Check constructor for errors:

```typescript
private constructor(db: DrizzleDB) {
  try {
    this.vectorIndex = new VectorIndexService(path);
    console.log("VectorIndex created");
  } catch (e) {
    console.error("VectorIndex failed:", e);
    throw e;
  }
  // ...
}
```

### Multiple Initialization Calls

```typescript
// File A
await ServiceContainer.initialize(db1);

// File B (later)
await ServiceContainer.initialize(db2); // Ignored!
```

**Behavior:** Second call is a no-op, returns existing instance.

**Why:** Singleton pattern - only first call creates instance:

```typescript
static async initialize(db: DrizzleDB) {
  if (!ServiceContainer.instance) {  // Only if not exists
    ServiceContainer.instance = new ServiceContainer(db);
  }
  return ServiceContainer.instance;
}
```

### Memory Leak on Shutdown

```
Warning: Possible EventEmitter memory leak detected
```

**Cause:** `dispose()` not called on shutdown.

**Fix:** Call dispose in shutdown handler:

```typescript
process.on("SIGTERM", async () => {
  await ServiceContainer.get().dispose();
  process.exit(0);
});
```

### Testing with Mock Services

```typescript
// test/setup.ts
import { ServiceContainer } from "../server/services/service-container";

// Reset singleton between tests
beforeEach(() => {
  // @ts-ignore - accessing private for testing
  ServiceContainer.instance = undefined;
});

// Initialize with test database
beforeAll(async () => {
  const testDb = createTestDatabase();
  await ServiceContainer.initialize(testDb);
});
```

---

## Extending the Container

To add a new service:

```typescript
// 1. Add property
export class ServiceContainer {
  readonly newService: NewService;

  private constructor(db: DrizzleDB) {
    // 2. Initialize in constructor
    this.newService = new NewService(db, this.vectorIndex);
  }
}

// 3. Use in routes
export function createRoutes(services: ServiceContainer) {
  router.get("/new", async (req, res) => {
    await services.newService.doSomething();
  });
}
```

---

## Further Reading

- [Layer 1.1: Express Bootstrap](./LAYER_1.1_EXPRESS_BOOTSTRAP.md) - When container is initialized
- [Layer 4: Services](./LAYER_4_SERVICES.md) - Service implementation details
- [Layer 3.8: Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) - How agent uses services
- [Dependency Injection Patterns](https://martinfowler.com/articles/injection.html)
