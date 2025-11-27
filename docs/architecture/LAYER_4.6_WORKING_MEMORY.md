# Layer 4.6: Working Memory

> Sliding window entity tracking, reference resolution, context serialization

## Overview

The Working Memory system provides short-term memory for the agent across conversation turns. It tracks recently accessed entities (pages, sections, collections, entries) in a sliding window, automatically extracts entities from tool results, and serializes state for session persistence.

**Key Responsibilities:**
- Sliding window entity storage (last 10 entities)
- Entity extraction from tool results
- Type inference from tool names
- Context string generation for system prompt injection
- Session persistence via JSON serialization

---

## The Problem

Without working memory, agents have no context between turns:

```typescript
// WRONG: Agent forgets what it just did
// Turn 1: "Get the homepage"
const page = await getPage("home"); // Returns page data

// Turn 2: "Now update its title"
// Agent: "Which page? I don't know what you're referring to"

// WRONG: No reference resolution
// "Update the title of the page I just created"
// Agent has no idea which page was "just created"

// WRONG: Manual tracking
const recentPages: string[] = [];
recentPages.push(page.id);
// Must be maintained in every tool call
```

**Our Solution:**
1. WorkingContext class with sliding window
2. EntityExtractor for automatic extraction from tool results
3. System prompt injection with formatted context
4. Session serialization/deserialization

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKING MEMORY SYSTEM                        │
│                                                                 │
│  Tool Execution                                                 │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 EntityExtractor                         │    │
│  │                                                         │    │
│  │  extract(toolName, toolResult):                         │    │
│  │  ├─ Pattern 1: Single resource → { id, name, slug }     │    │
│  │  ├─ Pattern 2: Search results → matches[0..2]           │    │
│  │  ├─ Pattern 3: List results → items[0..4]               │    │
│  │  └─ Pattern 4: Paginated → data[0..4]                   │    │
│  │                                                         │    │
│  │  inferType(toolName):                                   │    │
│  │  ├─ cms_getPage → "page"                                │    │
│  │  ├─ cms_getSection → "section"                          │    │
│  │  ├─ cms_listEntries → "entry"                           │    │
│  │  └─ result.type fallback                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                        │
│                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  WorkingContext                         │    │
│  │                                                         │    │
│  │  entities: Entity[] (max 10, sliding window)            │    │
│  │                                                         │    │
│  │  Operations:                                            │    │
│  │  ├─ add(entity)        → push to front, dedupe, prune   │    │
│  │  ├─ addMany(entities)  → batch add                      │    │
│  │  ├─ getRecent(n=5)     → last N entities                │    │
│  │  ├─ toContextString()  → system prompt format           │    │
│  │  ├─ toJSON()           → serialize for storage          │    │
│  │  └─ fromJSON(state)    → deserialize from storage       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                        │
│       ┌────────────────┴────────────────┐                       │
│       ▼                                 ▼                       │
│  System Prompt                    Session Storage               │
│  "[WORKING MEMORY]                sessions.workingContext       │
│   pages:                          (JSON column)                 │
│   - "Home" (uuid-123)                                           │
│   sections:                                                     │
│   - "Hero" (uuid-456)"                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/working-memory/working-context.ts` | WorkingContext class |
| `server/services/working-memory/entity-extractor.ts` | EntityExtractor class |
| `server/services/working-memory/types.ts` | Entity and state type definitions |
| `server/services/working-memory/index.ts` | Module exports |
| `server/services/session-service.ts` | Persistence via save/loadWorkingContext |

---

## Core Implementation

### Entity Type Definition

```typescript
// server/services/working-memory/types.ts
export interface Entity {
  type: string;        // 'page' | 'section' | 'collection' | 'entry' | 'media'
  id: string;          // UUID
  name: string;        // Human-readable name
  slug?: string;       // URL slug (if applicable)
  timestamp: Date;     // When last accessed
}

export interface WorkingContextState {
  entities: Entity[];
}
```

### WorkingContext Sliding Window

```typescript
// server/services/working-memory/working-context.ts
export class WorkingContext {
  private entities: Entity[] = [];
  private readonly MAX_ENTITIES = 10;

  /**
   * Add entity to front of list (most recent first)
   */
  add(entity: Entity): void {
    // Avoid duplicates - if entity exists, move to front
    this.entities = this.entities.filter(e => e.id !== entity.id);

    // Add to front
    this.entities.unshift(entity);

    // Prune old entities (sliding window)
    this.entities = this.entities.slice(0, this.MAX_ENTITIES);
  }

  /**
   * Add multiple entities
   */
  addMany(entities: Entity[]): void {
    entities.forEach(e => this.add(e));
  }

  /**
   * Get recent N entities
   */
  getRecent(count: number = 5): Entity[] {
    return this.entities.slice(0, count);
  }
}
```

### Context String for System Prompt

```typescript
/**
 * Format working memory as context string for system prompt injection
 */
toContextString(): string {
  if (this.entities.length === 0) return '';

  // Group by type for readability
  const grouped: Record<string, Entity[]> = {};
  for (const entity of this.entities) {
    if (!grouped[entity.type]) grouped[entity.type] = [];
    grouped[entity.type].push(entity);
  }

  const lines: string[] = ['[WORKING MEMORY]'];
  for (const [type, items] of Object.entries(grouped)) {
    const plural = type.endsWith('s') ? type : `${type}s`;
    lines.push(`${plural}:`);
    for (const item of items.slice(0, 3)) { // Max 3 per type
      lines.push(`  - "${item.name}" (${item.id})`);
    }
  }

  return lines.join('\n');
}
```

**Output Example:**

```
[WORKING MEMORY]
pages:
  - "Home" (550e8400-e29b-41d4-a716-446655440000)
  - "About" (6ba7b810-9dad-11d1-80b4-00c04fd430c8)
sections:
  - "Hero Section" (7c9e6679-7425-40de-944b-e07fc1f90ae7)
entries:
  - "Welcome Post" (f47ac10b-58cc-4372-a567-0e02b2c3d479)
```

### JSON Serialization

```typescript
/**
 * Serialize to JSON for database storage
 */
toJSON(): WorkingContextState {
  return { entities: this.entities };
}

/**
 * Deserialize from JSON
 */
static fromJSON(state: WorkingContextState): WorkingContext {
  const context = new WorkingContext();
  context.entities = state.entities.map(e => ({
    ...e,
    timestamp: new Date(e.timestamp)  // Restore Date object
  }));
  return context;
}

/**
 * Clear all entities
 */
clear(): void {
  this.entities = [];
}

/**
 * Get total entity count
 */
size(): number {
  return this.entities.length;
}
```

### Entity Extractor

```typescript
// server/services/working-memory/entity-extractor.ts
export class EntityExtractor {
  /**
   * Extract entities from any tool result
   */
  extract(toolName: string, toolResult: any): Entity[] {
    if (!toolResult) return [];

    const entities: Entity[] = [];
    const type = this.inferType(toolName, toolResult);

    // Pattern 1: Single resource (cms_getPage, etc.)
    if (toolResult.id && (toolResult.name || toolResult.slug || toolResult.title)) {
      entities.push(this.createEntity(type, toolResult));
    }

    // Pattern 2: Search results (cms_findResource)
    if (toolResult.matches && Array.isArray(toolResult.matches)) {
      for (const match of toolResult.matches.slice(0, 3)) {
        entities.push(this.createEntity(match.type || type, match));
      }
    }

    // Pattern 3: List results (cms_listPages, etc.)
    if (Array.isArray(toolResult)) {
      for (const item of toolResult.slice(0, 5)) {
        if (item?.id && (item.name || item.slug || item.title || item.sectionKey)) {
          entities.push(this.createEntity(type, item));
        }
      }
    }

    // Pattern 4: Paginated results
    if (toolResult.data && Array.isArray(toolResult.data)) {
      for (const item of toolResult.data.slice(0, 5)) {
        if (item?.id && (item.name || item.slug || item.title)) {
          entities.push(this.createEntity(type, item));
        }
      }
    }

    return entities;
  }
}
```

### Type Inference from Tool Names

```typescript
/**
 * Infer entity type from tool name and result structure
 */
private inferType(toolName: string, result: any): string {
  // Check result for explicit type first
  if (result?.type) {
    return result.type.toLowerCase();
  }

  // Parse tool name pattern: cms_getPage → page
  const match = toolName.match(/cms_(get|find|list|create|update|delete)([A-Z]\w+)/);
  if (match) {
    const extracted = match[2].toLowerCase();

    // Handle special cases
    if (extracted.includes('section')) return 'section';
    if (extracted.includes('page')) return 'page';
    if (extracted.includes('collection')) return 'collection';
    if (extracted.includes('entry') || extracted.includes('entries')) return 'entry';
    if (extracted.includes('media')) return 'media';

    return extracted;
  }

  return 'resource';
}

/**
 * Create entity from data
 */
private createEntity(type: string, data: any): Entity {
  // Determine name from available fields
  let name = data.name || data.title || data.slug;

  // For sections, use sectionKey or sectionName
  if (type === 'section' || type === 'pagesection') {
    name = data.sectionName || data.sectionKey || data.name || data.key || 'Unnamed Section';
  }

  // Fallback
  if (!name) {
    name = `Unnamed ${type}`;
  }

  return {
    type: type === 'pagesection' ? 'section' : type,
    id: data.id,
    name,
    slug: data.slug,
    timestamp: new Date()
  };
}
```

---

## Design Decisions

### Why Sliding Window (MAX=10)?

```typescript
private readonly MAX_ENTITIES = 10;
this.entities = this.entities.slice(0, this.MAX_ENTITIES);
```

**Reasons:**
1. **Bounded growth** - Memory doesn't grow unbounded
2. **Relevance** - Old entities fade naturally
3. **Token efficiency** - System prompt stays small
4. **Recent focus** - Agent focuses on current work

### Why Move to Front on Duplicate?

```typescript
this.entities = this.entities.filter(e => e.id !== entity.id);
this.entities.unshift(entity);
```

**Reasons:**
1. **Access pattern** - Recently used = most relevant
2. **No duplicates** - Same entity only appears once
3. **Timestamp update** - Re-access updates timestamp
4. **LRU-like behavior** - Least recently used falls off

### Why Group by Type in Context String?

```typescript
const grouped: Record<string, Entity[]> = {};
for (const entity of this.entities) {
  if (!grouped[entity.type]) grouped[entity.type] = [];
  grouped[entity.type].push(entity);
}
```

**Reasons:**
1. **Readability** - Agent sees pages together, sections together
2. **Reference clarity** - "the page" vs "the section"
3. **Compact format** - No repeated type labels
4. **Scan-friendly** - Find entities by type quickly

### Why Extract Only Top N from Lists?

```typescript
for (const match of toolResult.matches.slice(0, 3)) { ... }
for (const item of toolResult.slice(0, 5)) { ... }
```

**Reasons:**
1. **Relevance** - First results usually most relevant
2. **Memory limits** - Don't fill window with one query
3. **Performance** - Less extraction work
4. **Context balance** - Leave room for other operations

### Why Infer Type from Tool Names?

```typescript
const match = toolName.match(/cms_(get|find|list|create|update|delete)([A-Z]\w+)/);
```

**Reasons:**
1. **Convention-based** - Tool names follow pattern
2. **No explicit type needed** - Reduces tool output size
3. **Fallback to result.type** - Works when explicit
4. **Universal** - Works for any CMS resource

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 3.1 (ReAct Loop) | Extracts entities after tool execution |
| Layer 3.4 (Prompts) | toContextString() injected in system prompt |
| Layer 4.2 (Sessions) | saveWorkingContext/loadWorkingContext |
| Layer 3.8 (Context) | AgentContext carries WorkingContext |

### Agent Tool Execution Integration

```typescript
// server/agent/orchestrator.ts
async executeStep(toolCall: ToolCall, context: AgentContext) {
  const result = await executeTool(toolCall, context);

  // Extract entities from result
  const extractor = new EntityExtractor();
  const entities = extractor.extract(toolCall.name, result);

  // Add to working context
  context.workingContext.addMany(entities);

  return result;
}
```

### System Prompt Injection

```typescript
// server/prompts/system.hbs
{{#if workingContext}}
{{{workingContext}}}
{{/if}}

// Rendered as:
// [WORKING MEMORY]
// pages:
//   - "Home" (uuid-123)
```

### Session Persistence

```typescript
// After agent execution
await sessionService.saveWorkingContext(sessionId, workingContext);

// On session load
const workingContext = await sessionService.loadWorkingContext(sessionId);
```

---

## Common Issues / Debugging

### Entities Not Extracted

```typescript
const entities = extractor.extract("customTool", result);
// entities = []
```

**Cause:** Result structure doesn't match patterns.

**Debug:**

```typescript
console.log("Result structure:", JSON.stringify(result, null, 2));
console.log("Has id:", !!result?.id);
console.log("Has name/slug/title:", result?.name || result?.slug || result?.title);
```

**Fix:** Ensure result includes `id` and one of `name`, `slug`, or `title`.

### Type Inferred Incorrectly

```typescript
// Tool: "cms_getPageSections" → type: "pagesection" (wrong)
```

**Cause:** Special case not handled.

**Fix:** The extractor normalizes `pagesection` → `section`:

```typescript
type: type === 'pagesection' ? 'section' : type
```

### Working Context Lost After Reload

```
// Entities empty after page refresh
```

**Cause:** Context not saved to session.

**Fix:** Save after agent execution:

```typescript
// MUST save after agent completes
await sessionService.saveWorkingContext(sessionId, context.workingContext);
```

### Context String Empty

```typescript
const str = workingContext.toContextString();
// str = ""
```

**Cause:** No entities added.

**Debug:**

```typescript
console.log("Entity count:", workingContext.size());
console.log("Entities:", JSON.stringify(workingContext.toJSON()));
```

### Timestamp Becomes String After Restore

```typescript
const restored = WorkingContext.fromJSON(state);
// entity.timestamp is string, not Date
```

**Fix:** Already handled in fromJSON:

```typescript
timestamp: new Date(e.timestamp)  // Restores Date object
```

---

## Further Reading

- [Layer 3.1: ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Where extraction occurs
- [Layer 3.4: Prompts](./LAYER_3.4_PROMPTS.md) - System prompt injection
- [Layer 4.2: Session Management](./LAYER_4.2_SESSION_MANAGEMENT.md) - Persistence
- [Layer 3.8: Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) - AgentContext structure
