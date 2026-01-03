# Layer 3.3: Working Memory

> Entity tracking, discovered tools persistence, and reference resolution

## Overview

Working Memory enables the agent to remember entities and discovered tools across conversation turns. It now has two key responsibilities:

1. **Entity Tracking** - When a user says "delete that page," resolve to actual entity IDs
2. **Discovered Tools Persistence** - Remember tools found via `searchTools` across turns

**Key Files:**

-   `server/memory/working-context/working-context.ts` - Main implementation
-   `server/memory/working-context/entity-extractor.ts` - Entity extraction from tool results
-   `server/memory/working-context/types.ts` - Type definitions

---

## The Problem

LLMs are stateless within a request. Without working memory:

```
User: "Create a page called About Us"
Agent: Created page with ID page-123

User: "Now add a hero section to it"
Agent: Add to which page? I don't know what "it" refers to.
```

Additionally, without tool persistence:

```
User: "Create the page"
Agent: [Discovers createPage tool, creates page]

User: "Now update the title"
Agent: [Must search for tools again - inefficient]
```

With working memory:

```
User: "Create a page called About Us"
Agent: Created page with ID page-123
[Working Memory: page-123 = "About Us", discoveredTools = ["createPage"]]

User: "Now update the title"
Agent: [Already has updatePage tool, resolves "it" → page-123]
       Updating page-123...
```

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        Working Memory                             │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     WorkingContext                          │  │
│  │                                                             │  │
│  │   entities: Map<id, Entity>  ← O(1) lookup, max 10         │  │
│  │   entitiesOrder: string[]    ← Recency tracking            │  │
│  │   discoveredTools: string[]  ← Max 20, persisted           │  │
│  │                                                             │  │
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │
│  │   │  page   │ │ section │ │  image  │ │  post   │          │  │
│  │   │About Us │ │  Hero   │ │mountain │ │ Blog #1 │          │  │
│  │   │page-123 │ │ sec-456 │ │ img-789 │ │post-012 │          │  │
│  │   └─────────┘ └─────────┘ └─────────┘ └─────────┘          │  │
│  │                                                             │  │
│  │   discoveredTools: [createPage, updatePage, createSection] │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Entity Extractor                         │  │
│  │                                                             │  │
│  │   Uses Tool Metadata extraction schemas:                    │  │
│  │   - idPath: "page.id" or "pages[].id"                      │  │
│  │   - namePath: "page.title" or "pages[].title"              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │               Context Message Generation                    │  │
│  │                                                             │  │
│  │   toContextString() for injection as conversation message   │  │
│  │   Memoized via version tracking                            │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Core Implementation

### WorkingContext Class

```typescript
// server/memory/working-context/working-context.ts
export class WorkingContext {
  private entities: Map<string, Entity> = new Map();
  private entitiesOrder: string[] = [];           // Recency order
  private discoveredTools: string[] = [];
  private _version = 0;
  private _cachedContextString: string | null = null;
  private _cachedContextVersion = -1;

  readonly MAX_ENTITIES = 10;
  readonly MAX_DISCOVERED_TOOLS = 20;

  // Add single entity
  addEntity(entity: Entity): void {
    // Remove from current position if exists
    const existing = this.entitiesOrder.indexOf(entity.id);
    if (existing !== -1) {
      this.entitiesOrder.splice(existing, 1);
    }

    // Add to front (most recent)
    this.entitiesOrder.unshift(entity.id);
    this.entities.set(entity.id, { ...entity, timestamp: new Date() });

    // Trim to max
    while (this.entitiesOrder.length > this.MAX_ENTITIES) {
      const removed = this.entitiesOrder.pop()!;
      this.entities.delete(removed);
    }

    this._version++;
  }

  // Add discovered tools
  addDiscoveredTools(tools: string[]): void {
    for (const tool of tools) {
      if (!this.discoveredTools.includes(tool)) {
        this.discoveredTools.push(tool);
      }
    }

    // Trim to max (keep oldest - first discovered)
    if (this.discoveredTools.length > this.MAX_DISCOVERED_TOOLS) {
      this.discoveredTools = this.discoveredTools.slice(0, this.MAX_DISCOVERED_TOOLS);
    }

    this._version++;
  }

  // Memoized context string
  toContextString(): string {
    if (this._cachedContextVersion === this._version && this._cachedContextString) {
      return this._cachedContextString;
    }

    this._cachedContextString = this.buildContextString();
    this._cachedContextVersion = this._version;
    return this._cachedContextString;
  }

  // Get discovered tools for agent options
  getDiscoveredTools(): string[] {
    return [...this.discoveredTools];
  }
}
```

### Entity Interface

```typescript
interface Entity {
  id: string;
  name: string;
  type: 'page' | 'section' | 'image' | 'post' | 'entry';
  timestamp: Date;
}
```

---

## Entity Extraction

### Metadata-Driven Extraction

Entity extraction now uses the per-tool metadata's `extraction` schema:

```typescript
// server/memory/working-context/entity-extractor.ts
import { ToolRegistry } from '../../tools/_registry/tool-registry';

export function extractEntities(
  toolName: string,
  result: unknown
): Entity[] {
  const metadata = ToolRegistry.getInstance().get(toolName);
  if (!metadata?.extraction) return [];

  const { type, idPath, namePath } = metadata.extraction;

  // Handle array paths like "pages[].id"
  if (idPath.includes('[]')) {
    return extractFromArray(result, type, idPath, namePath);
  }

  // Handle single entity paths like "page.id"
  const id = getPath(result, idPath);
  const name = getPath(result, namePath);

  if (!id || !name) return [];

  return [{
    type,
    id: String(id),
    name: String(name),
    timestamp: new Date(),
  }];
}

function extractFromArray(
  result: unknown,
  type: EntityType,
  idPath: string,
  namePath: string
): Entity[] {
  const basePath = idPath.split('[]')[0].replace(/\.$/, '');
  const idField = idPath.split('[].')[1];
  const nameField = namePath.split('[].')[1];

  const items = getPath(result, basePath) as unknown[];
  if (!Array.isArray(items)) return [];

  return items.slice(0, 3).map(item => ({
    type,
    id: String(getPath(item, idField)),
    name: String(getPath(item, nameField)),
    timestamp: new Date(),
  })).filter(e => e.id && e.name);
}
```

### Extraction Schema Examples

From tool metadata:

```typescript
// Single entity
extraction: {
  type: 'page',
  idPath: 'page.id',
  namePath: 'page.title',
}

// Array of entities
extraction: {
  type: 'page',
  idPath: 'pages[].id',
  namePath: 'pages[].title',
}

// Nested path
extraction: {
  type: 'section',
  idPath: 'result.section.id',
  namePath: 'result.section.heading',
}
```

---

## Discovered Tools Persistence

### Flow Across Turns

```
Turn 1: User asks to create a page
├── Step 1: searchTools("create page")
│   └── Discovers: [createPage, updatePage, getPage]
├── Step 2: createPage(...)
└── Save WorkingContext with discoveredTools

Turn 2: User asks to update the title
├── Load WorkingContext (has discoveredTools)
├── prepareCall receives: options.discoveredTools = [createPage, updatePage, getPage]
├── prepareStep: Tools already available (no search needed)
└── Step 1: updatePage(...) - can execute immediately
```

### Integration with Agent

```typescript
// server/execution/context-coordinator.ts
async prepareContext(options: ResolvedOptions, logger, emitter?) {
  // Load session
  const session = await this.deps.sessionService.load(options.sessionId);

  // Parse working context from session
  const workingContext = WorkingContext.fromJSON(session.workingContext || {});

  // Return context including discovered tools
  return {
    context: {
      messages: session.messages,
      workingMemoryString: workingContext.toContextString(),
      discoveredTools: workingContext.getDiscoveredTools(), // For prepareCall
      // ...
    },
    workingContext,
  };
}
```

---

## Context String Generation

### Output Format

```typescript
toContextString(): string {
  const parts: string[] = [];

  // Group entities by type
  const grouped = this.groupByType();

  for (const [type, entities] of grouped) {
    parts.push(`${type}s:`);
    for (const entity of entities) {
      parts.push(`  - "${entity.name}" (${entity.id})`);
    }
  }

  if (parts.length === 0) {
    return 'No entities tracked yet.';
  }

  return parts.join('\n');
}
```

### Example Output

```
pages:
  - "About Us" (page-123)
  - "Home" (page-456)
sections:
  - "Hero" (sec-789)
images:
  - "hero-bg.jpg" (img-345)
```

### Injection as Conversation Message

Working memory is now injected as a conversation message, not in the system prompt:

```typescript
// server/execution/context-coordinator.ts
function buildContextMessages(workingContext: WorkingContext): ModelMessage[] {
  const contextString = workingContext.toContextString();
  if (!contextString || contextString === 'No entities tracked yet.') {
    return [];
  }

  return [
    {
      role: 'user',
      content: `[WORKING MEMORY]\n${contextString}\n\nUse these entities when I refer to "this page", "that image", etc.`,
    },
    {
      role: 'assistant',
      content: 'I understand. I\'ll use these entities when you refer to them.',
    },
  ];
}
```

---

## Sliding Window (Max 10 Entities)

### Why 10?

| Size | Tradeoff                                                    |
| ---- | ----------------------------------------------------------- |
| 5    | Too few - loses context in multi-step workflows             |
| 10   | Good balance - covers typical page+sections+images workflow |
| 20   | Too many - wastes tokens, rarely needed                     |

### MRU (Most Recently Used) Ordering

Newest entities at front, oldest at back:

```
Initial: []
After createPage("Home"):     [Home]
After createPage("About"):    [About, Home]
After getPage("Home"):        [Home, About]  ← Home moves to front
After 9 more entities:        [E10, E9, ... Home, About]
After 1 more entity:          [E11, E10, ... Home]  ← About dropped
```

---

## Serialization

### Save with Session

```typescript
// In context-coordinator.ts saveSessionData
await this.deps.sessionService.save(sessionId, {
  messages: responseMessages,
  workingContext: workingContext.toJSON(),
});

// WorkingContext.toJSON()
toJSON(): SerializedWorkingContext {
  return {
    entities: Array.from(this.entities.values()),
    entitiesOrder: this.entitiesOrder,
    discoveredTools: this.discoveredTools,
    version: 1,
  };
}
```

### Load from Session

```typescript
// WorkingContext.fromJSON()
static fromJSON(data: SerializedWorkingContext): WorkingContext {
  const ctx = new WorkingContext();

  if (data.entities) {
    for (const entity of data.entities) {
      ctx.entities.set(entity.id, entity);
    }
    ctx.entitiesOrder = data.entitiesOrder || [];
  }

  if (data.discoveredTools) {
    ctx.discoveredTools = data.discoveredTools;
  }

  return ctx;
}
```

---

## Design Decisions

### Why O(1) Map + Order Array?

```typescript
// Map for O(1) lookups by ID
private entities: Map<string, Entity> = new Map();

// Array for O(n) recency operations (n ≤ 10, so fine)
private entitiesOrder: string[] = [];
```

Enables:
- Fast entity lookup by ID
- Efficient recency tracking
- Simple serialization

### Why Discovered Tools in Working Context?

Previously considered:
- Separate `DiscoveredToolsStore` - More complexity
- Session messages parsing - Fragile, expensive
- Module-level state - Not serializable

Current approach:
- Single source of truth
- Persists with session
- Available on next turn via `options.discoveredTools`

### Why Max 20 Discovered Tools?

- Typical CMS workflow uses 5-10 tools
- 20 covers complex multi-domain tasks
- Beyond 20, likely searching inefficiently

---

## Integration Points

| Connects To                                 | How                                    |
| ------------------------------------------- | -------------------------------------- |
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) | Discovered tools passed to prepareCall |
| [3.2 Tools](./LAYER_3.2_TOOLS.md)           | Metadata drives entity extraction      |
| Session Service                             | Serialized with session                |
| Context Coordinator                         | Loaded/saved per request               |

---

## Debugging

### View Current Memory

```typescript
console.log('Entities:', workingContext.getEntities());
console.log('Discovered Tools:', workingContext.getDiscoveredTools());
console.log('Context String:', workingContext.toContextString());
```

### Common Issues

| Issue                    | Cause                        | Solution                        |
| ------------------------ | ---------------------------- | ------------------------------- |
| Entity not extracted     | Missing extraction in metadata| Add extraction schema           |
| Wrong entity resolved    | MRU ordering                 | User should be more specific    |
| Tools not persisted      | Not calling addDiscoveredTools| Check stream processor          |
| Memory reset unexpectedly| New session created          | Check session ID consistency    |

---

## Further Reading

-   [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Tool discovery flow
-   [3.2 Tools](./LAYER_3.2_TOOLS.md) - Extraction schemas in metadata
-   [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - Context injection
