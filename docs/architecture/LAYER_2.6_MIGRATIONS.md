# Layer 2.6: Migrations & Seeding

> Schema evolution with Drizzle Kit and reproducible demo data

## Overview

Database schema changes are managed through Drizzle Kit migrations - SQL files that transform the schema incrementally. Seed scripts populate the database with demo data for development and testing.

**Key Concepts:**
- **Migrations** - Schema changes as versioned SQL files
- **Push** - Apply schema directly (dev) or via migrations (prod)
- **Seeding** - TypeScript scripts to populate test data
- **Reset** - Scripts to clean and rebuild from scratch

---

## The Problem

Database schema changes are error-prone:

```typescript
// Manual schema changes
ALTER TABLE pages ADD COLUMN status TEXT;
// Did everyone on the team run this?
// What about production?
// What if it conflicts with existing data?

// No seed data
// New developer joins: "How do I get test data?"
// Manual SQL inserts or screenshots of other environments
```

**Our Solution:**
1. Drizzle Kit generates migrations from schema.ts changes
2. Migrations tracked in git, applied in order
3. Seed scripts create complete demo environment
4. Reset scripts for clean slate

---

## Architecture

```
┌────────────────────────────────────────────────────┐
│                     MIGRATION WORKFLOW             │
│                                                    │
│  Developer changes schema.ts                       │
│       │                                            │
│       ▼                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │  pnpm db:generate                           │   │
│  │                                             │   │
│  │  Drizzle Kit compares:                      │   │
│  │  schema.ts ←→ last migration                │   │
│  │                                             │   │
│  │  Generates: 0006_xxx.sql                    │   │
│  └─────────────────────┬───────────────────────┘   │
│                        │                           │
│                        ▼                           │
│  ┌─────────────────────────────────────────────┐   │
│  │  pnpm db:push                               │   │
│  │                                             │   │
│  │  Applies migration to sqlite.db             │   │
│  │  Records in _drizzle_migrations             │   │
│  └─────────────────────────────────────────────┘   │
│                                                    │
├────────────────────────────────────────────────────┤
│                      SEEDING WORKFLOW              │
│                                                    │
│  pnpm seed                                         │
│       │                                            │
│       ▼                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │  scripts/seed.ts                            │   │
│  │                                             │   │
│  │  Creates hierarchy:                         │   │
│  │  Team → Site → Environment → Pages/Posts    │   │
│  │                                             │   │
│  │  Outputs IDs for reference                  │   │
│  └─────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `drizzle.config.ts` | Drizzle Kit configuration |
| `server/db/migrations/*.sql` | Migration SQL files |
| `scripts/seed.ts` | Main seed script (~1300 lines) |
| `scripts/seed-images.ts` | Download sample images |
| `scripts/reset-complete.ts` | Full system reset |
| `scripts/reset-data-only.ts` | Keep schema, clear data |

---

## Core Implementation

### Drizzle Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/db/schema.ts",      // Source of truth
  out: "./server/db/migrations",         // Generated SQL files
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "file:data/sqlite.db",
  },
});
```

### Migration Commands

```bash
# Generate migration from schema changes
pnpm db:generate
# Creates: server/db/migrations/0006_xxx.sql

# Apply pending migrations
pnpm db:push
# Runs all unapplied migrations

# View schema in browser
pnpm db:studio
# Opens Drizzle Studio at localhost:4983
```

### Migration File Structure

```
server/db/migrations/
├── 0000_nasty_giant_man.sql      # Initial schema (all tables)
├── 0001_certain_zaladane.sql     # Added post fields
├── 0002_whole_scarlet_spider.sql # Image metadata changes
├── 0003_fancy_timeslip.sql       # Site settings table
├── 0004_outgoing_mother_askani.sql # Navigation updates
├── 0005_cute_black_bolt.sql      # Page section images
└── meta/
    ├── _journal.json             # Migration history
    └── 0000_snapshot.json        # Schema snapshots
```

### Example Migration

```sql
-- 0003_fancy_timeslip.sql
CREATE TABLE `site_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_settings_key_unique` ON `site_settings` (`key`);
```

### Seed Script Structure

```typescript
// scripts/seed.ts
import { randomUUID } from "node:crypto";
import { db } from "../server/db/client";
import * as schema from "../server/db/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // 1. Create team (top-level tenant)
    const teamId = randomUUID();
    await db.insert(schema.teams).values({
      id: teamId,
      name: "dev-team",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Create site
    const siteId = randomUUID();
    const envId = randomUUID();
    await db.insert(schema.sites).values({
      id: siteId,
      teamId,
      name: "local-site",
      domain: "localhost:4000",
      defaultEnvironmentId: envId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Create environment
    await db.insert(schema.environments).values({
      id: envId,
      siteId,
      name: "main",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 4. Create locales
    await db.insert(schema.locales).values([
      { code: "en", name: "English", status: "active", createdAt: new Date() },
      { code: "de", name: "German", status: "inactive", createdAt: new Date() },
    ]);

    // 5. Create section definitions
    const heroSectionId = randomUUID();
    await db.insert(schema.sectionDefinitions).values({
      id: heroSectionId,
      key: "hero",
      name: "Hero Section",
      elementsStructure: JSON.stringify({
        version: 1,
        rows: [
          {
            slots: [
              { key: "title", type: "text", dataRules: { required: true } },
              { key: "subtitle", type: "text" },
              { key: "image", type: "image" },
            ],
          },
        ],
      }),
      templateKey: "hero",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 6. Create pages with sections
    const homePageId = randomUUID();
    await db.insert(schema.pages).values({
      id: homePageId,
      siteId,
      environmentId: envId,
      slug: "home",
      name: "Homepage",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Add hero section to home page
    const heroPageSectionId = randomUUID();
    await db.insert(schema.pageSections).values({
      id: heroPageSectionId,
      pageId: homePageId,
      sectionDefId: heroSectionId,
      sortOrder: 0,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Add hero content (English)
    await db.insert(schema.pageSectionContents).values({
      id: randomUUID(),
      pageSectionId: heroPageSectionId,
      localeCode: "en",
      content: JSON.stringify({
        title: "Welcome to Our CMS",
        subtitle: "AI-powered content management",
        image: { url: "/placeholder.jpg", alt: "Hero background" },
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // ... more seed data ...

    console.log("✅ Seed completed!");
    console.log(`   Team ID: ${teamId}`);
    console.log(`   Site ID: ${siteId}`);
    console.log(`   Home Page: http://localhost:4000/pages/home?locale=en`);

  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
```

### Reset Scripts

**Full Reset (schema + data + files):**

```typescript
// scripts/reset-complete.ts
async function resetComplete() {
  console.log("🧹 Full system reset...");

  // 1. Delete database file
  const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "data/sqlite.db";
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    fs.unlinkSync(dbPath + "-wal");  // WAL file
    fs.unlinkSync(dbPath + "-shm");  // Shared memory
  }

  // 2. Delete uploads
  if (fs.existsSync("uploads")) {
    fs.rmSync("uploads", { recursive: true });
  }

  // 3. Delete vector index
  if (fs.existsSync("vector_index")) {
    fs.rmSync("vector_index", { recursive: true });
  }

  // 4. Recreate directories
  fs.mkdirSync("data", { recursive: true });
  fs.mkdirSync("uploads/images", { recursive: true });

  // 5. Run migrations
  execSync("pnpm db:push");

  // 6. Run seed
  execSync("pnpm seed");

  console.log("✅ Reset complete!");
}
```

**Data-Only Reset (keep schema):**

```typescript
// scripts/reset-data-only.ts
async function resetDataOnly() {
  console.log("🧹 Clearing data (keeping schema)...");

  // Delete in correct order (respect FKs)
  await db.delete(schema.pageSectionContents);
  await db.delete(schema.pageSections);
  await db.delete(schema.pages);
  await db.delete(schema.sectionDefinitions);
  // ... etc

  // Re-seed
  execSync("pnpm seed");
}
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:reset": "tsx scripts/reset-complete.ts",
    "seed": "tsx scripts/seed.ts",
    "seed:images": "tsx scripts/seed-images.ts",
    "reset:complete": "tsx scripts/reset-complete.ts",
    "reset:data": "tsx scripts/reset-data-only.ts"
  }
}
```

---

## Design Decisions

### Why SQL Migrations over Push-Only?

```bash
# Option A: Direct push (dev-only approach)
pnpm db:push
# Modifies DB directly, no history

# Option B: Generate + Push (chosen for tracking)
pnpm db:generate  # Creates .sql file
pnpm db:push      # Applies it
```

**Reasons:**
1. **History** - SQL files show exactly what changed
2. **Code review** - Migrations go through PR review
3. **Reproducibility** - Same migrations in all environments
4. **Rollback reference** - Know what to undo

### Why TypeScript Seeds over SQL?

```sql
-- Option A: SQL seed file
INSERT INTO teams (id, name, created_at) VALUES ('uuid', 'team', 123456);
-- Hardcoded IDs, no logic, verbose
```

```typescript
// Option B: TypeScript seed (chosen)
const teamId = randomUUID();
await db.insert(teams).values({
  id: teamId,
  name: "dev-team",
  createdAt: new Date(),
});
// Dynamic IDs, reusable logic, type-safe
```

**Reasons:**
1. **Dynamic IDs** - Fresh UUIDs each run
2. **Logic** - Loops, conditionals, functions
3. **Type safety** - Compiler catches schema mismatches
4. **Maintainability** - Easier to read and modify

### Why Multiple Reset Scripts?

| Script | Use Case |
|--------|----------|
| `reset:complete` | New developer setup, major schema changes |
| `reset:data` | Clear test data, keep schema for debugging |
| `seed` | Add data to existing database |
| `seed:images` | Only download sample images |

**Reasons:**
1. **Speed** - Full reset takes longer (downloads images)
2. **Debugging** - Sometimes need fresh data, not fresh schema
3. **CI/CD** - Different scripts for different environments

### Why Seed Outputs IDs?

```typescript
console.log(`   Team ID: ${teamId}`);
console.log(`   Site ID: ${siteId}`);
console.log(`   Homepage: http://localhost:4000/pages/home?locale=en`);
```

**Reasons:**
1. **Quick reference** - Copy/paste for API testing
2. **Verification** - Confirm seed succeeded
3. **Documentation** - Developers know what was created

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 2.1 (Schema) | Migrations generated from schema.ts changes |
| Layer 2.7 (Connection) | Seeds use same db client |
| Layer 2.5 (Vector) | Reset clears vector index too |
| CI/CD | Migrations run in deployment pipeline |

### CI/CD Integration

```yaml
# .github/workflows/deploy.yml
- name: Run migrations
  run: pnpm db:push

- name: Seed database (staging only)
  if: github.ref == 'refs/heads/staging'
  run: pnpm seed
```

---

## Common Issues / Debugging

### Migration Conflicts

```
Error: Migration 0005 already applied but file changed
```

**Cause:** Someone modified an already-applied migration.

**Fix:** Never edit applied migrations. Create new migration for changes:

```bash
# WRONG: Edit 0005_xxx.sql

# RIGHT: Make schema change, generate new migration
pnpm db:generate  # Creates 0006_xxx.sql
```

### Foreign Key Constraint on Seed

```
Error: FOREIGN KEY constraint failed
```

**Cause:** Inserting child before parent.

**Fix:** Ensure correct order in seed:

```typescript
// WRONG order
await db.insert(pages).values({ siteId: "nonexistent" });

// RIGHT order
const site = await db.insert(sites).values({...}).returning();
await db.insert(pages).values({ siteId: site[0].id });
```

### Seed Fails on Existing Data

```
Error: UNIQUE constraint failed: pages.slug
```

**Cause:** Running seed on non-empty database.

**Fix:** Clear data first or use reset script:

```bash
# Clear and re-seed
pnpm reset:data

# Or full reset
pnpm reset:complete
```

### Missing Migration Files

```
Error: Cannot find migration 0004_xxx.sql
```

**Cause:** Migration file not committed or .gitignore issue.

**Fix:** Ensure migrations/ folder is tracked:

```gitignore
# .gitignore - DON'T ignore migrations
!server/db/migrations/
```

### Schema Drift

```
Error: Column 'new_field' doesn't exist
```

**Cause:** Code expects column that migration hasn't added.

**Fix:** Run pending migrations:

```bash
pnpm db:push

# Or check what's pending
pnpm db:generate --dry-run
```

---

## Best Practices

### 1. Always Generate Before Push

```bash
# Check what migration will be created
pnpm db:generate

# Review the .sql file
cat server/db/migrations/0006_xxx.sql

# Then apply
pnpm db:push
```

### 2. Atomic Migrations

Keep migrations focused:

```sql
-- GOOD: Single purpose
ALTER TABLE pages ADD COLUMN status TEXT DEFAULT 'draft';

-- BAD: Too many changes
ALTER TABLE pages ADD COLUMN status TEXT;
ALTER TABLE posts ADD COLUMN category TEXT;
CREATE TABLE comments (...);
```

### 3. Seed Idempotency

Check before inserting:

```typescript
// Check if already seeded
const existing = await db.select().from(teams).limit(1);
if (existing.length > 0) {
  console.log("Database already seeded, skipping...");
  return;
}
```

### 4. Document Seed Data

```typescript
// Add comments explaining what's created
console.log("\n📊 Seed Summary:");
console.log("   - 1 Team (dev-team)");
console.log("   - 1 Site (local-site)");
console.log("   - 3 Pages (home, about, contact)");
console.log("   - 3 Blog posts (2 published, 1 draft)");
console.log("   - 7 Section definitions");
```

---

## Further Reading

- [Layer 2.1: Drizzle ORM](./LAYER_2.1_DRIZZLE_ORM.md) - Schema definitions
- [Layer 2.2: Entity Hierarchy](./LAYER_2.2_ENTITY_HIERARCHY.md) - Seed order follows hierarchy
- [Layer 2.7: Connection](./LAYER_2.7_CONNECTION.md) - Database setup
- [Drizzle Kit Docs](https://orm.drizzle.team/kit-docs/overview)
