# Layer 2.7: Connection & Configuration

> SQLite connection setup with WAL mode, pragmas, and lifecycle management

## Overview

The database connection uses better-sqlite3 (synchronous SQLite driver) wrapped by Drizzle ORM. Key optimizations include WAL mode for concurrent reads and busy timeout for write contention handling.

**Key Concepts:**
- **better-sqlite3** - Synchronous, high-performance SQLite driver
- **WAL mode** - Write-Ahead Logging for concurrency
- **Pragmas** - SQLite configuration settings
- **Connection lifecycle** - When to open/close

---

## The Problem

Default SQLite configuration has limitations:

```typescript
// Default behavior - locks entire DB during writes
const sqlite = new Database("./data.db");
// Write blocks ALL reads
// Slow concurrent access

// No timeout handling
sqlite.exec("INSERT ...");
// SQLITE_BUSY error if another process is writing

// Connection left open
// Memory leaks, file handle exhaustion
```

**Our Solution:**
1. WAL mode enables concurrent reads during writes
2. Busy timeout waits instead of erroring immediately
3. Explicit connection management for clean shutdown

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   CONNECTION LAYER                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Application                           │    │
│  │                         │                                │    │
│  │                         ▼                                │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │              Drizzle ORM                          │   │    │
│  │  │  Type-safe queries, relations, schema inference  │   │    │
│  │  └────────────────────────┬─────────────────────────┘   │    │
│  │                           │                              │    │
│  │                           ▼                              │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │            better-sqlite3                         │   │    │
│  │  │  Synchronous SQLite driver                       │   │    │
│  │  │  Native bindings, high performance               │   │    │
│  │  └────────────────────────┬─────────────────────────┘   │    │
│  │                           │                              │    │
│  └───────────────────────────┼──────────────────────────────┘    │
│                              │                                    │
│  ┌───────────────────────────┼──────────────────────────────┐    │
│  │                           ▼                               │    │
│  │  ┌──────────────────────────────────────────────────┐    │    │
│  │  │              SQLite Database                      │    │    │
│  │  │                                                   │    │    │
│  │  │  data/sqlite.db     (main database)              │    │    │
│  │  │  data/sqlite.db-wal (write-ahead log)            │    │    │
│  │  │  data/sqlite.db-shm (shared memory index)        │    │    │
│  │  │                                                   │    │    │
│  │  │  Pragmas:                                         │    │    │
│  │  │  • journal_mode = WAL                            │    │    │
│  │  │  • busy_timeout = 5000                           │    │    │
│  │  └──────────────────────────────────────────────────┘    │    │
│  │                         DISK                              │    │
│  └───────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/db/client.ts` | Database connection and export |
| `drizzle.config.ts` | Connection string for migrations |
| `.env` | DATABASE_URL environment variable |

---

## Core Implementation

### Connection Setup

```typescript
// server/db/client.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// Read connection string from environment
const DATABASE_URL = process.env.DATABASE_URL || "file:data/sqlite.db";

// Extract file path from URL format
const dbPath = DATABASE_URL.replace("file:", "");

// Initialize SQLite connection
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrency
sqlite.pragma("journal_mode = WAL");

// Set busy timeout to handle write contention
sqlite.pragma("busy_timeout = 5000");

// Create Drizzle instance with full schema
export const db = drizzle(sqlite, { schema });

// Export type for dependency injection
export type DrizzleDB = typeof db;

// Clean shutdown helper
export function closeDatabase() {
  sqlite.close();
}
```

### Environment Configuration

```bash
# .env
DATABASE_URL=file:data/sqlite.db

# Alternative: absolute path
DATABASE_URL=file:/Users/dev/project/data/sqlite.db

# Test database
DATABASE_URL=file:data/test.db
```

### Usage in Services

```typescript
// server/services/cms/page-service.ts
import { db, type DrizzleDB } from "../../db/client";

class PageService {
  constructor(private db: DrizzleDB) {}

  async getPages(siteId: string, envId: string) {
    return this.db.query.pages.findMany({
      where: and(
        eq(pages.siteId, siteId),
        eq(pages.environmentId, envId)
      ),
    });
  }
}

// Usage with singleton
const pageService = new PageService(db);
```

### Graceful Shutdown

```typescript
// server/index.ts
import { closeDatabase } from "./db/client";

// Handle process termination
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  closeDatabase();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Interrupted, closing database...");
  closeDatabase();
  process.exit(0);
});
```

---

## SQLite Pragmas Explained

### WAL Mode (Write-Ahead Logging)

```typescript
sqlite.pragma("journal_mode = WAL");
```

**What it does:**
- Writes go to separate WAL file first
- Readers see consistent snapshot
- Writes don't block reads

**Default behavior (DELETE mode):**
```
Writer → Lock entire DB → Write → Unlock
Readers: BLOCKED during write
```

**WAL mode:**
```
Writer → Write to WAL file → Continue
Readers → Read from main DB (unblocked)
Checkpoint → Merge WAL to main (background)
```

**Benefits:**
- Multiple concurrent readers during writes
- Faster writes (no full DB lock)
- Better crash recovery

**Trade-offs:**
- Extra files (*.db-wal, *.db-shm)
- Slightly more disk usage
- All connections must use same mode

### Busy Timeout

```typescript
sqlite.pragma("busy_timeout = 5000"); // 5 seconds
```

**What it does:**
- When DB is locked, wait up to N milliseconds
- Retries automatically during wait period
- Throws SQLITE_BUSY only after timeout

**Without busy_timeout:**
```typescript
// Immediate error if locked
Error: SQLITE_BUSY: database is locked
```

**With busy_timeout:**
```typescript
// Waits up to 5 seconds for lock release
// Most operations succeed without error
```

### Other Useful Pragmas

```typescript
// Foreign key enforcement (default: OFF in SQLite!)
sqlite.pragma("foreign_keys = ON");

// Synchronous mode (trade durability for speed)
sqlite.pragma("synchronous = NORMAL"); // vs FULL (safer) or OFF (faster)

// Cache size (pages in memory)
sqlite.pragma("cache_size = -64000"); // 64MB

// Memory-mapped I/O
sqlite.pragma("mmap_size = 268435456"); // 256MB
```

---

## Design Decisions

### Why better-sqlite3 over node-sqlite3?

| Aspect | better-sqlite3 | node-sqlite3 |
|--------|----------------|--------------|
| API | Synchronous | Asynchronous |
| Performance | 2-5x faster | Slower |
| Error handling | try/catch | Callbacks |
| Drizzle support | Native | Via adapter |
| Memory | Lower | Higher |

**Decision:** better-sqlite3's synchronous API is simpler and faster for our use case. SQLite operations are fast enough that async overhead isn't worth it.

### Why File-Based URL Format?

```typescript
// Option A: Just path
const db = new Database("data/sqlite.db");

// Option B: URL format (chosen)
DATABASE_URL=file:data/sqlite.db
```

**Reasons:**
1. **Consistency** - Same format as PostgreSQL/MySQL connection strings
2. **Environment vars** - Easy to switch via .env
3. **Docker compatibility** - Mount volumes with different paths
4. **Future-proofing** - Could add query params like `?mode=ro`

### Why Single Connection vs. Pool?

```typescript
// We use single connection
const sqlite = new Database(dbPath);

// NOT a connection pool like PostgreSQL
// const pool = new Pool({ connectionString });
```

**Reasons:**
1. **SQLite design** - Single file, single writer at a time
2. **WAL handles concurrency** - Multiple readers share one connection
3. **better-sqlite3** - Handles internal locking
4. **Simplicity** - No pool configuration or management

### Why Export Type Separately?

```typescript
export const db = drizzle(sqlite, { schema });
export type DrizzleDB = typeof db;
```

**Reasons:**
1. **Dependency injection** - Services receive db as parameter
2. **Testing** - Can mock with same type
3. **Type safety** - Full inference in service methods

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 2.1 (Schema) | Schema passed to drizzle() |
| Layer 2.6 (Migrations) | Same connection string in drizzle.config.ts |
| Layer 4 (Services) | Services import db singleton |
| Layer 1 (Server) | Shutdown handler calls closeDatabase() |

### Service Container Integration

```typescript
// server/services/service-container.ts
import { db, type DrizzleDB } from "../db/client";

class ServiceContainer {
  readonly db: DrizzleDB;
  readonly pageService: PageService;
  readonly sectionService: SectionService;

  constructor() {
    this.db = db; // Singleton connection
    this.pageService = new PageService(this.db);
    this.sectionService = new SectionService(this.db);
  }
}
```

---

## Common Issues / Debugging

### SQLITE_BUSY Error

```
Error: SQLITE_BUSY: database is locked
```

**Causes:**
1. Another process has write lock
2. Long-running transaction blocking
3. busy_timeout too short

**Debug:**

```bash
# Check what's using the database
lsof data/sqlite.db

# Check for lingering connections
fuser data/sqlite.db
```

**Fix:** Increase busy_timeout or find blocking process:

```typescript
sqlite.pragma("busy_timeout = 10000"); // 10 seconds
```

### WAL Files Growing Large

```bash
ls -la data/
# sqlite.db     50MB
# sqlite.db-wal 500MB  # Too big!
```

**Cause:** WAL not checkpointing (merging to main DB).

**Fix:** Force checkpoint:

```typescript
sqlite.pragma("wal_checkpoint(TRUNCATE)");
```

Or configure automatic checkpointing:

```typescript
sqlite.pragma("wal_autocheckpoint = 1000"); // Every 1000 pages
```

### Database File Not Found

```
Error: SQLITE_CANTOPEN: unable to open database file
```

**Causes:**
1. Directory doesn't exist
2. Wrong path in DATABASE_URL
3. Permission issues

**Fix:** Ensure directory exists:

```typescript
import fs from "fs";
import path from "path";

const dbPath = DATABASE_URL.replace("file:", "");
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
```

### Foreign Keys Not Enforced

```typescript
// Delete parent, children remain orphaned
await db.delete(sites).where(eq(sites.id, siteId));
// Pages still exist! FK should have cascaded
```

**Cause:** Foreign keys disabled by default in SQLite.

**Fix:** Enable in pragma:

```typescript
sqlite.pragma("foreign_keys = ON");
```

**Note:** Must be set BEFORE any queries, on each connection.

### Connection Leaked in Tests

```
Error: Too many open file handles
Warning: Database connection not closed
```

**Cause:** Tests don't clean up connections.

**Fix:** Close in test teardown:

```typescript
// test/setup.ts
import { closeDatabase } from "../server/db/client";

afterAll(() => {
  closeDatabase();
});
```

---

## Performance Tuning

### Read-Heavy Workloads

```typescript
// Increase cache for frequently accessed data
sqlite.pragma("cache_size = -128000"); // 128MB

// Enable memory-mapped I/O
sqlite.pragma("mmap_size = 536870912"); // 512MB
```

### Write-Heavy Workloads

```typescript
// Reduce durability for speed (data loss risk on crash)
sqlite.pragma("synchronous = OFF");

// Larger WAL for fewer checkpoints
sqlite.pragma("wal_autocheckpoint = 10000"); // Every 10000 pages
```

### Production Recommendations

```typescript
// Balanced settings
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");  // vs FULL
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("cache_size = -64000");   // 64MB
sqlite.pragma("foreign_keys = ON");
```

---

## Further Reading

- [Layer 2.1: Drizzle ORM](./LAYER_2.1_DRIZZLE_ORM.md) - Schema and queries
- [Layer 2.6: Migrations](./LAYER_2.6_MIGRATIONS.md) - Schema evolution
- [Layer 1: Server Core](./LAYER_1_SERVER_CORE.md) - Shutdown handling
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [SQLite Pragma Reference](https://www.sqlite.org/pragma.html)
