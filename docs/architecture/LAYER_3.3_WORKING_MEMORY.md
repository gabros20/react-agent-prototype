# Layer 3.3: Working Memory

> Entity tracking and reference resolution within conversations

## Overview

Working Memory enables the agent to remember entities mentioned during a conversation. When a user says "delete that page" or "add an image to it," the system resolves these references to actual entity IDs without requiring the user to repeat details.

**Key Files:**
- `server/services/working-memory/working-context.ts` - Main implementation
- `server/services/working-memory/entity-extractor.ts` - Extraction logic
- `server/services/working-memory/types.ts` - Type definitions

---

## The Problem

LLMs are stateless within a request. Without working memory:

```
User: "Create a page called About Us"
Agent: Created page with ID page-123

User: "Now add a hero section to it"
Agent: Add to which page? I don't know what "it" refers to.
```

With working memory:

```
User: "Create a page called About Us"
Agent: Created page with ID page-123
[Working Memory: page-123 = "About Us"]

User: "Now add a hero section to it"
Agent: [Resolves "it" → page-123]
       Adding hero section to page-123...
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Working Memory                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   WorkingContext                            ││
│  │                                                             ││
│  │   entities: Entity[]     ← Max 10, MRU ordered             ││
│  │                                                             ││
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          ││
│  │   │  page   │ │ section │ │  image  │ │  post   │          ││
│  │   │About Us │ │  Hero   │ │mountain │ │ Blog #1 │          ││
│  │   │page-123 │ │ sec-456 │ │ img-789 │ │post-012 │          ││
│  │   └─────────┘ └─────────┘ └─────────┘ └─────────┘          ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Entity Extractor                           ││
│  │                                                             ││
│  │   Tool Result → Infer Type → Extract Entities               ││
│  │                                                             ││
│  │   cms_createPage → 'page' → { id, name, type }             ││
│  │   cms_searchImages → 'image' → [{ id, name, type }, ...]   ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Prompt Injection                           ││
│  │                                                             ││
│  │   [WORKING MEMORY]                                          ││
│  │   pages:                                                    ││
│  │     - "About Us" (page-123)                                 ││
│  │   sections:                                                 ││
│  │     - "Hero" (sec-456)                                      ││
│  │   images:                                                   ││
│  │     - "mountain.jpg" (img-789)                              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Entity

An entity represents something the agent has encountered:

```typescript
interface Entity {
  id: string;           // Unique identifier (e.g., "page-123")
  name: string;         // Human-readable name (e.g., "About Us")
  type: EntityType;     // Category: 'page' | 'section' | 'image' | 'post' | ...
}

type EntityType =
  | 'page'
  | 'section'
  | 'collection'
  | 'entry'
  | 'media'      // Images, files
  | 'image'      // Alias for media
  | 'post'
  | 'task';
```

### WorkingContext

The main class managing entities:

```typescript
class WorkingContext {
  private entities: Entity[] = [];
  private readonly MAX_ENTITIES = 10;

  // Add entities (maintains MRU order, deduplicates)
  addEntities(newEntities: Entity[]): void;

  // Get all entities
  getEntities(): Entity[];

  // Get entities by type
  getEntitiesByType(type: EntityType): Entity[];

  // Format for prompt injection
  toContextString(): string;

  // Serialize for checkpointing
  serialize(): SerializedContext;

  // Restore from checkpoint
  static restore(data: SerializedContext): WorkingContext;
}
```

---

## Sliding Window (Max 10 Entities)

Working memory uses a fixed-size window to prevent unbounded growth:

```typescript
addEntities(newEntities: Entity[]): void {
  for (const entity of newEntities) {
    // Check for existing entity with same ID
    const existingIndex = this.entities.findIndex(e => e.id === entity.id);

    if (existingIndex !== -1) {
      // Remove from current position (will re-add at front)
      this.entities.splice(existingIndex, 1);
    }

    // Add to front (most recent)
    this.entities.unshift(entity);

    // Trim to max size
    if (this.entities.length > this.MAX_ENTITIES) {
      this.entities.pop();  // Remove oldest
    }
  }
}
```

### Why 10?

| Size | Tradeoff |
|------|----------|
| 5 | Too few - loses context in multi-step workflows |
| 10 | Good balance - covers typical page+sections+images workflow |
| 20 | Too many - wastes tokens, rarely needed |

### MRU (Most Recently Used) Ordering

Newest entities at front, oldest at back:

```
Initial: []
After cms_createPage("Home"):    [Home]
After cms_createPage("About"):   [About, Home]
After cms_getPage("Home"):       [Home, About]  ← Home moves to front
After 9 more entities:           [E10, E9, ... Home, About]
After 1 more entity:             [E11, E10, ... Home]  ← About dropped
```

---

## Entity Extraction

### Automatic Type Inference

The extractor infers entity type from tool name:

```typescript
// server/services/working-memory/entity-extractor.ts
function inferTypeFromToolName(toolName: string): EntityType | null {
  if (toolName.includes('Page')) return 'page';
  if (toolName.includes('Section')) return 'section';
  if (toolName.includes('Image')) return 'image';
  if (toolName.includes('Post')) return 'post';
  if (toolName.includes('Entry')) return 'entry';
  if (toolName.includes('Collection')) return 'collection';
  return null;
}
```

### Extraction Patterns

Different result structures are handled:

```typescript
function extract(toolName: string, result: unknown): Entity[] {
  const type = inferTypeFromToolName(toolName);
  if (!type) return [];

  const entities: Entity[] = [];

  // Pattern 1: Single resource (e.g., { page: { id, title } })
  if (result[type]) {
    const resource = result[type];
    if (resource.id) {
      entities.push({
        id: resource.id,
        name: resource.title || resource.name || resource.slug || resource.filename,
        type
      });
    }
  }

  // Pattern 2: Plural array (e.g., { pages: [...] })
  const pluralKey = type + 's';
  if (Array.isArray(result[pluralKey])) {
    const items = result[pluralKey].slice(0, 3);  // Max 3 from lists
    for (const item of items) {
      if (item.id) {
        entities.push({
          id: item.id,
          name: item.title || item.name || item.slug || item.filename,
          type
        });
      }
    }
  }

  // Pattern 3: Matches array (e.g., { matches: [...] })
  if (Array.isArray(result.matches)) {
    const items = result.matches.slice(0, 3);
    for (const item of items) {
      if (item.id) {
        entities.push({
          id: item.id,
          name: item.title || item.name || item.slug,
          type
        });
      }
    }
  }

  return entities;
}
```

### Extraction Examples

**Single Page Created:**
```typescript
// Tool: cms_createPage
// Result: { success: true, page: { id: "page-123", title: "About Us", slug: "about" } }
// Extracted: [{ id: "page-123", name: "About Us", type: "page" }]
```

**Multiple Images Found:**
```typescript
// Tool: cms_searchImages
// Result: { matches: [{ id: "img-1", filename: "hero.jpg" }, { id: "img-2", filename: "bg.jpg" }, ...] }
// Extracted: [{ id: "img-1", name: "hero.jpg", type: "image" }, { id: "img-2", name: "bg.jpg", type: "image" }, { id: "img-3", ... }]
// Note: Only first 3 extracted to avoid flooding memory
```

**Section Content Retrieved:**
```typescript
// Tool: cms_getSectionContent
// Result: { section: { id: "sec-456", heading: "Welcome" } }
// Extracted: [{ id: "sec-456", name: "Welcome", type: "section" }]
```

---

## Prompt Injection

Working memory is injected into the system prompt:

### toContextString() Output

```typescript
toContextString(): string {
  if (this.entities.length === 0) {
    return '[WORKING MEMORY]\nNo entities tracked yet.';
  }

  // Group by type
  const grouped = new Map<EntityType, Entity[]>();
  for (const entity of this.entities) {
    const list = grouped.get(entity.type) || [];
    list.push(entity);
    grouped.set(entity.type, list);
  }

  // Format output
  let output = '[WORKING MEMORY]\n';
  for (const [type, entities] of grouped) {
    output += `${type}s:\n`;
    for (const entity of entities) {
      output += `  - "${entity.name}" (${entity.id})\n`;
    }
  }

  return output;
}
```

### Example Output

```
[WORKING MEMORY]
pages:
  - "About Us" (page-123)
  - "Home" (page-456)
sections:
  - "Hero" (sec-789)
  - "Features" (sec-012)
images:
  - "hero-bg.jpg" (img-345)
posts:
  - "Welcome Post" (post-678)
```

### Injection Point

In the system prompt template:

```xml
<!-- server/prompts/react.xml -->
<agent>
  <!-- ... other sections ... -->

  {{{workingMemory}}}

  <instructions>
    When the user refers to "this page", "that image", "it", etc.,
    check WORKING MEMORY for the most recent entity of the appropriate type.
  </instructions>
</agent>
```

---

## Reference Resolution

### How the Agent Uses Working Memory

The prompt instructs the agent to resolve references:

```xml
<reference_resolution>
  When the user says:
  - "this page" / "that page" / "the page" → Use most recent page from WORKING MEMORY
  - "this section" / "it" (after section operation) → Use most recent section
  - "the image" / "that image" → Use most recent image

  Example:
  User: "Add a hero section to it"
  Working Memory shows: pages: - "About Us" (page-123)
  Agent: I'll add a hero section to page-123 (About Us)
</reference_resolution>
```

### Resolution Flow

```
User: "Add an image to it"
                │
                ▼
┌─────────────────────────────────────────┐
│ Agent checks WORKING MEMORY:            │
│   pages:                                │
│     - "About Us" (page-123)             │
│   sections:                             │
│     - "Hero" (sec-456)                  │
│   images:                               │
│     - "mountain.jpg" (img-789)          │
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ Context: Last operation was on section  │
│ "it" likely refers to sec-456           │
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ Agent calls:                            │
│ cms_updateSectionImage({                │
│   pageSectionId: "sec-456",             │
│   imageId: "img-789"                    │
│ })                                      │
└─────────────────────────────────────────┘
```

---

## Lifecycle Integration

### When Entities Are Added

Entities are extracted after each tool result in `onStepFinish`:

```typescript
// In orchestrator.ts
onStepFinish: async ({ step }) => {
  if (step.toolResults) {
    for (const result of step.toolResults) {
      const entities = entityExtractor.extract(
        result.toolName,
        result.result
      );
      workingContext.addEntities(entities);
    }
  }
}
```

### When Working Memory Is Injected

Before each LLM call, the system prompt is compiled with current memory:

```typescript
// In orchestrator.ts
const compiledPrompt = compilePrompt({
  // ... other context
  workingMemory: workingContext.toContextString()
});
```

### Checkpointing

Working memory is saved with session checkpoints:

```typescript
// Saving
await sessionService.saveCheckpoint(sessionId, {
  messages: currentMessages,
  workingMemory: workingContext.serialize()
});

// Restoring
const checkpoint = await sessionService.loadCheckpoint(sessionId);
if (checkpoint?.workingMemory) {
  workingContext = WorkingContext.restore(checkpoint.workingMemory);
}
```

### Serialization Format

```typescript
interface SerializedContext {
  entities: Array<{
    id: string;
    name: string;
    type: EntityType;
  }>;
  version: number;  // For future migrations
}
```

---

## Design Decisions

### Why In-Memory Only?

Working memory is session-scoped and ephemeral:

| Storage | Tradeoff |
|---------|----------|
| In-memory | Fast, simple, lost on restart |
| Redis | Persistent, adds complexity |
| Database | Persistent, slower, overkill |

**Our choice:** In-memory with checkpoint serialization. Speed matters for every LLM call, and checkpoints handle persistence.

### Why No Explicit Reference Map?

Some systems maintain:
```typescript
references: Map<string, string>  // "the page" → "page-123"
```

**We don't because:**
1. LLM handles natural language resolution well
2. Avoids maintaining fragile mappings
3. Works across languages without translation
4. MRU ordering provides implicit "most recent" resolution

### Why Extract Only 3 from Lists?

When `cms_searchImages` returns 10 matches, we only extract 3:

```typescript
const items = result.matches.slice(0, 3);
```

**Reasons:**
1. Prevents flooding memory with one operation
2. Top results are usually most relevant
3. User can search again if needed
4. Preserves memory for diverse entity types

---

## Edge Cases

### Duplicate Entities

Same entity from different operations:

```typescript
// Operation 1: Get page
cms_getPage({ slug: "about" })
// Memory: [{ id: "page-123", name: "About Us", type: "page" }]

// Operation 2: Update same page
cms_updatePage({ pageId: "page-123", title: "About Our Team" })
// Memory: [{ id: "page-123", name: "About Our Team", type: "page" }]
// Entity moved to front, name updated
```

### Ambiguous References

When multiple entities of same type exist:

```
Memory:
  pages:
    - "About Us" (page-123)      ← Most recent
    - "Contact" (page-456)
    - "Home" (page-789)

User: "Delete that page"
```

**Resolution:** Most recent (About Us) unless user specifies otherwise.

**Prompt guidance:**
```xml
<ambiguity>
If multiple entities of the same type exist and the reference is ambiguous:
1. Default to the most recent (first in list)
2. If uncertain, ask the user: "Which page - About Us or Contact?"
</ambiguity>
```

### No Matching Entity

```
Memory: (empty or no pages)

User: "Update that page"
```

**Agent behavior:** Ask for clarification or search for pages.

---

## Integration Points

| Connects To | How |
|-------------|-----|
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) | onStepFinish extracts entities |
| [3.2 Tools](./LAYER_3.2_TOOLS.md) | Tool results → entity extraction |
| [3.4 Prompts](./LAYER_3.4_PROMPTS.md) | Memory injected into system prompt |
| Session Service | Serialized in checkpoints |

---

## Debugging

### View Current Memory

```typescript
// In tool or orchestrator
console.log('Working Memory:', workingContext.toContextString());
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Entity not found | Extraction failed | Check tool result structure |
| Wrong entity resolved | MRU ordering | Have user be more specific |
| Memory empty | No extractions succeeded | Verify entity extractor patterns |
| Memory full of same type | Many operations on one type | Expected behavior, uses MRU |

---

## Further Reading

- [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - When extraction happens
- [3.2 Tools](./LAYER_3.2_TOOLS.md) - Tool result structures
- [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - How memory is injected
