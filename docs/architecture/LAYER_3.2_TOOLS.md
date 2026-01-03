# Layer 3.2: Tool System

> Per-tool folder architecture with unified registry and hybrid search discovery

## Overview

Tools are the agent's hands. They transform LLM reasoning into real actions - creating pages, uploading images, updating navigation. Our implementation uses a **per-tool folder structure** where each tool is self-contained with its metadata, schema, and implementation.

**Key Innovation**: Tools are discovered on-demand via `searchTools` using hybrid BM25+vector search, not loaded all at once.

**Key Files:**

-   `server/tools/{toolName}/` - Per-tool folders
-   `server/tools/_registry/tool-registry.ts` - Unified tool registry
-   `server/tools/_types/metadata.ts` - Metadata schema
-   `server/tools/_loaders/tool-assembler.ts` - Tool assembly
-   `server/services/search/tool-search.service.ts` - Hybrid search

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        Tool System                                 │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                 Per-Tool Folder Structure                   │  │
│  │                                                             │  │
│  │   server/tools/{toolName}/                                  │  │
│  │   ├── {toolName}-metadata.ts   # Search phrases, risk       │  │
│  │   ├── {toolName}-tool.ts       # Zod schema + execute       │  │
│  │   └── index.ts                 # Exports + assembly         │  │
│  │                                                             │  │
│  │   36 tools organized this way                               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Tool Registry                            │  │
│  │                                                             │  │
│  │   Singleton initialized at startup                          │  │
│  │   - Loads all metadata from per-tool folders                │  │
│  │   - Builds search corpus (BM25 + vector)                    │  │
│  │   - O(1) sync lookups after init                            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                 Hybrid Search System                        │  │
│  │                                                             │  │
│  │   ┌─────────────┐    ┌─────────────┐                        │  │
│  │   │ BM25 Search │    │   Vector    │                        │  │
│  │   │  (Lexical)  │ +  │   Search    │  → Smart Blend         │  │
│  │   │             │    │ (Semantic)  │                        │  │
│  │   └─────────────┘    └─────────────┘                        │  │
│  │                                                             │  │
│  │   + Related Tools Expansion                                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Per-Tool Folder Structure

Each tool is self-contained in its own folder:

```
server/tools/createPage/
├── createPage-metadata.ts    # Search phrases, related tools, risk level
├── createPage-tool.ts        # Zod schema + execute function
└── index.ts                  # Exports + AI SDK tool assembly
```

### Metadata File

```typescript
// server/tools/createPage/createPage-metadata.ts
import type { ToolMetadata } from '../_types/metadata';

const metadata: ToolMetadata = {
  name: 'createPage',
  description: 'Create a new page in the CMS with optional sections',
  phrases: [
    'create page',
    'new page',
    'add page',
    'make page',
    'create landing page',
    'build page',
  ],
  relatedTools: ['getPage', 'updatePage', 'createSection'],
  riskLevel: 'moderate',
  requiresConfirmation: false,
  extraction: {
    type: 'page',
    idPath: 'page.id',
    namePath: 'page.title',
  },
};

export default metadata;
```

### Tool Implementation File

```typescript
// server/tools/createPage/createPage-tool.ts
import { z } from 'zod';
import type { AgentContext } from '../_types/agent-context';

export const createPageSchema = z.object({
  title: z.string().describe('Page title'),
  slug: z.string().optional().describe('URL slug (auto-generated if omitted)'),
  template: z.string().optional().describe('Page template to use'),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;

export async function createPageExecute(
  input: CreatePageInput,
  ctx: AgentContext
) {
  const { siteId, environmentId } = ctx.cmsTarget;

  const page = await ctx.services.page.create(siteId, environmentId, {
    title: input.title,
    slug: input.slug,
    template: input.template,
  });

  ctx.logger.info(`Created page: ${page.title}`, { pageId: page.id });

  return {
    success: true,
    page: {
      id: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
    },
    message: `Created page "${page.title}" at /${page.slug}`,
  };
}
```

### Index File (Assembly)

```typescript
// server/tools/createPage/index.ts
import { tool } from 'ai';
import { createPageSchema, createPageExecute } from './createPage-tool';
import metadata from './createPage-metadata';
import type { AgentContext } from '../_types/agent-context';

export const createPage = tool({
  description: metadata.description,
  inputSchema: createPageSchema,
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    return createPageExecute(input, ctx);
  },
});

export { metadata };
```

---

## Tool Metadata Schema

```typescript
// server/tools/_types/metadata.ts
export interface ToolMetadata {
  /** Tool name (matches folder name) */
  name: string;

  /** Description shown to LLM */
  description: string;

  /** Search phrases for BM25 matching */
  phrases: string[];

  /** Related tools for auto-expansion */
  relatedTools: string[];

  /** Risk level for UI indicators */
  riskLevel: 'safe' | 'moderate' | 'destructive';

  /** Whether confirmation is required */
  requiresConfirmation: boolean;

  /** Entity extraction configuration */
  extraction: ExtractionSchema | null;
}

export interface ExtractionSchema {
  type: 'page' | 'section' | 'image' | 'post' | 'entry';
  idPath: string;           // e.g., 'page.id' or 'items[].id'
  namePath: string;         // e.g., 'page.title'
  customIdField?: string;   // For non-standard ID fields
}
```

---

## Tool Registry

### Singleton Pattern

```typescript
// server/tools/_registry/tool-registry.ts
export class ToolRegistry {
  private static instance: ToolRegistry;
  private readonly toolMap: Map<string, ToolMetadata> = new Map();
  private _initialized = false;

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /** Initialize at startup - loads all tool metadata */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    const toolFolders = this.getToolFolders();

    // Load all metadata in parallel
    const results = await Promise.all(
      toolFolders.map(folder => this.loadMetadata(folder))
    );

    for (const metadata of results) {
      if (metadata) {
        this.toolMap.set(metadata.name, metadata);
      }
    }

    // Pre-compute search corpus
    this.searchCorpusCache = this.buildSearchCorpus();

    this._initialized = true;
  }

  /** O(1) sync lookups after init */
  get(name: string): ToolMetadata | undefined {
    return this.toolMap.get(name);
  }

  getAll(): ToolMetadata[] {
    return Array.from(this.toolMap.values());
  }

  getSearchCorpus(): SearchCorpusEntry[] {
    return this.searchCorpusCache!;
  }
}
```

### Usage

```typescript
// At startup (once)
await ToolRegistry.getInstance().initialize();

// Anywhere after (O(1) sync)
const metadata = ToolRegistry.getInstance().get('createPage');
const corpus = ToolRegistry.getInstance().getSearchCorpus();
```

---

## Tool Categories

### Core Tools (Always Available)

| Tool               | Purpose                              |
| ------------------ | ------------------------------------ |
| `searchTools`      | Discover tools via hybrid search     |
| `finalAnswer`      | Complete response to user            |
| `acknowledgeRequest`| Conversational preflight            |

### CMS - Pages (4 tools)

| Tool         | Risk        | Purpose                    |
| ------------ | ----------- | -------------------------- |
| `getPage`    | Safe        | Get page by ID or slug     |
| `createPage` | Moderate    | Create new page            |
| `updatePage` | Moderate    | Update page metadata       |
| `deletePage` | Destructive | Delete page (confirmation) |

### CMS - Sections (5 tools)

| Tool                 | Risk        | Purpose                      |
| -------------------- | ----------- | ---------------------------- |
| `getSection`         | Safe        | Get section content          |
| `createSection`      | Safe        | Add section to page          |
| `updateSection`      | Moderate    | Update section content       |
| `deleteSection`      | Destructive | Remove section (confirmation)|
| `getSectionTemplate` | Safe        | List available templates     |

### CMS - Images (6 tools)

| Tool           | Risk        | Purpose                       |
| -------------- | ----------- | ----------------------------- |
| `getImage`     | Safe        | Get image metadata            |
| `createImage`  | Safe        | Upload new image              |
| `updateImage`  | Moderate    | Update image metadata         |
| `deleteImage`  | Destructive | Delete image (confirmation)   |
| `importImage`  | Safe        | Import from URL               |
| `browseImages` | Safe        | Semantic image search         |

### CMS - Posts (4 tools)

| Tool         | Risk        | Purpose                    |
| ------------ | ----------- | -------------------------- |
| `getPost`    | Safe        | Get post by ID or slug     |
| `createPost` | Safe        | Create draft post          |
| `updatePost` | Moderate    | Update post content        |
| `deletePost` | Destructive | Delete post (confirmation) |

### CMS - Navigation (4 tools)

| Tool            | Risk        | Purpose                      |
| --------------- | ----------- | ---------------------------- |
| `getNavItem`    | Safe        | Get navigation item          |
| `createNavItem` | Safe        | Add navigation link          |
| `updateNavItem` | Moderate    | Update navigation            |
| `deleteNavItem` | Destructive | Remove item (confirmation)   |

### CMS - Entries (4 tools)

| Tool          | Risk     | Purpose                  |
| ------------- | -------- | ------------------------ |
| `getEntry`    | Safe     | Get collection entry     |
| `createEntry` | Safe     | Create entry             |
| `updateEntry` | Moderate | Update entry             |
| `deleteEntry` | Destructive | Delete entry (confirmation)|

### External Tools (3 tools)

| Tool           | Risk | Purpose                    |
| -------------- | ---- | -------------------------- |
| `searchWeb`    | Safe | Web search via Tavily      |
| `fetchContent` | Safe | Fetch URL content          |

---

## Hybrid Search System

### Search Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  searchTools("create page")                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. BM25 Search (Fast, Exact)                              │
│      - Matches phrases: "create page", "new page"           │
│      - Score: 0.85 for createPage                           │
│                                                             │
│   2. Vector Search (Semantic)                               │
│      - Embeds query, finds similar tools                    │
│      - Score: 0.72 for createPage                           │
│                                                             │
│   3. Confidence-Based Blending                              │
│      - BM25 > 0.7? Use BM25 only                            │
│      - BM25 < 0.3? Fall back to vector                      │
│      - Else: Reciprocal rank fusion                         │
│                                                             │
│   4. Related Tools Expansion                                │
│      - createPage.relatedTools: [getPage, updatePage, ...]  │
│      - Add up to 3 related tools (discounted score)         │
│                                                             │
│   Result: [createPage, getPage, updatePage, createSection]  │
└─────────────────────────────────────────────────────────────┘
```

### Search Service

```typescript
// server/services/search/tool-search.service.ts
export class ToolSearchService {
  private bm25: BM25Search;
  private vector: VectorSearch;

  async search(query: string, limit: number = 8): Promise<SmartSearchResult> {
    // Run both searches
    const bm25Results = this.bm25.search(query, limit);
    const vectorResults = await this.vector.search(query, limit);

    // Smart blend based on confidence
    const blended = smartBlend(bm25Results, vectorResults);

    // Expand with related tools
    const expanded = this.expandWithRelated(blended, limit);

    return {
      tools: expanded.map(r => r.name),
      scores: expanded.map(r => r.score),
      method: this.determineMethod(bm25Results, vectorResults),
    };
  }
}
```

### Smart Blending

```typescript
// server/services/search/smart-search.ts
export function smartBlend(
  bm25: SearchResult[],
  vector: SearchResult[]
): SearchResult[] {
  const topBM25Score = bm25[0]?.score || 0;

  // High confidence in BM25 → use it alone
  if (topBM25Score > 0.7) {
    return bm25;
  }

  // Low confidence → fall back to vector
  if (topBM25Score < 0.3) {
    return vector;
  }

  // Medium confidence → reciprocal rank fusion
  return reciprocalRankFusion(bm25, vector);
}
```

---

## Context Injection

Tools receive full context via `experimental_context`:

```typescript
// server/tools/_types/agent-context.ts
export interface AgentContext {
  // Database
  db: DrizzleDB;

  // All services
  services: Services;

  // Vector search
  vectorIndex: VectorIndexService;

  // Logging (streams to frontend)
  logger: AgentLogger;

  // SSE streaming
  stream?: StreamWriter;

  // Identifiers
  traceId: string;
  sessionId: string;

  // Multi-tenant targeting
  cmsTarget: {
    siteId: string;
    environmentId: string;
  };
}
```

### Access Pattern

```typescript
execute: async (input, { experimental_context }) => {
  const ctx = experimental_context as AgentContext;

  // Access services
  const page = await ctx.services.page.get(input.pageId);

  // Log (streams to frontend)
  ctx.logger.info('Fetched page', { pageId: input.pageId });

  return { page };
},
```

---

## Tool Prompts

Per-tool guidance files for complex tools:

```
server/prompts/tools/
├── createSection-prompt.xml
├── createPost-prompt.xml
├── updateSection-prompt.xml
├── deletePost-prompt.xml
├── importImage-prompt.xml
├── searchTools-prompt.xml
└── finalAnswer-prompt.xml
```

### Example Tool Prompt

```xml
<!-- server/prompts/tools/createSection-prompt.xml -->
<tool-prompt name="createSection">
  <clarification>
    - "add another section" = CREATE new section
    - "change the heading" = UPDATE existing section
    - "move the section up" = UPDATE section order
  </clarification>

  <best-practices>
    - Always specify section template (hero, feature, cta, etc.)
    - Provide content matching template schema
    - Position defaults to end of page
  </best-practices>
</tool-prompt>
```

### Injection via ToolPromptInjector

```typescript
// server/prompts/_builder/tool-prompt-injector.ts
export class ToolPromptInjector {
  private tools: string[] = [];

  addTools(tools: string[]): void {
    this.tools.push(...tools);
  }

  build(): string {
    const prompts: string[] = [];

    for (const tool of this.tools) {
      const promptPath = path.join(PROMPTS_DIR, `${tool}-prompt.xml`);
      if (fs.existsSync(promptPath)) {
        prompts.push(fs.readFileSync(promptPath, 'utf-8'));
      }
    }

    return prompts.join('\n\n');
  }
}
```

---

## Confirmation Pattern

Destructive tools use the **Confirmed Flag Pattern**:

```typescript
// server/tools/deletePage/deletePage-tool.ts
export const deletePageSchema = z.object({
  id: z.string().describe('Page ID to delete'),
  confirmed: z.boolean().optional().describe('Must be true to delete'),
});

export async function deletePageExecute(
  input: DeletePageInput,
  ctx: AgentContext
) {
  // First call: request confirmation
  if (!input.confirmed) {
    const page = await ctx.services.page.get(input.id);
    return {
      requiresConfirmation: true,
      message: `Delete page "${page.title}"? This cannot be undone.`,
      page: { id: page.id, title: page.title },
    };
  }

  // Second call with confirmed: true
  await ctx.services.page.delete(input.id);
  return {
    success: true,
    message: 'Page deleted successfully.',
  };
}
```

**Flow:**
1. User: "Delete the about page"
2. Agent calls `deletePage({ id: "..." })`
3. Tool returns `{ requiresConfirmation: true }`
4. Agent asks user: "Delete 'About Us'? This cannot be undone."
5. User: "yes"
6. Agent calls `deletePage({ id: "...", confirmed: true })`
7. Page deleted

---

## Entity Extraction

Tool results are scanned for entities to add to working memory:

```typescript
// server/memory/working-context/entity-extractor.ts
export function extractEntities(
  toolName: string,
  result: unknown
): Entity[] {
  const metadata = ToolRegistry.getInstance().get(toolName);
  if (!metadata?.extraction) return [];

  const { type, idPath, namePath } = metadata.extraction;

  // Extract using dot-path notation
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
```

### Extraction Schema Examples

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
```

---

## Adding a New Tool

### 1. Create Tool Folder

```bash
mkdir server/tools/myNewTool
```

### 2. Create Metadata File

```typescript
// server/tools/myNewTool/myNewTool-metadata.ts
import type { ToolMetadata } from '../_types/metadata';

const metadata: ToolMetadata = {
  name: 'myNewTool',
  description: 'Description for LLM',
  phrases: ['search phrase 1', 'search phrase 2'],
  relatedTools: ['relatedTool1', 'relatedTool2'],
  riskLevel: 'safe',
  requiresConfirmation: false,
  extraction: null,  // or extraction schema
};

export default metadata;
```

### 3. Create Tool Implementation

```typescript
// server/tools/myNewTool/myNewTool-tool.ts
import { z } from 'zod';
import type { AgentContext } from '../_types/agent-context';

export const myNewToolSchema = z.object({
  param1: z.string().describe('Parameter description'),
});

export type MyNewToolInput = z.infer<typeof myNewToolSchema>;

export async function myNewToolExecute(
  input: MyNewToolInput,
  ctx: AgentContext
) {
  // Implementation
  return { success: true };
}
```

### 4. Create Index File

```typescript
// server/tools/myNewTool/index.ts
import { tool } from 'ai';
import { myNewToolSchema, myNewToolExecute } from './myNewTool-tool';
import metadata from './myNewTool-metadata';
import type { AgentContext } from '../_types/agent-context';

export const myNewTool = tool({
  description: metadata.description,
  inputSchema: myNewToolSchema,
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    return myNewToolExecute(input, ctx);
  },
});

export { metadata };
```

### 5. Add to ALL_TOOLS

```typescript
// server/tools/_index.ts
import { myNewTool } from './myNewTool';

export const ALL_TOOLS = {
  // ... existing tools
  myNewTool,
};
```

### 6. (Optional) Add Tool Prompt

```xml
<!-- server/prompts/tools/myNewTool-prompt.xml -->
<tool-prompt name="myNewTool">
  <usage>When to use this tool...</usage>
</tool-prompt>
```

---

## Design Decisions

### Why Per-Tool Folders?

1. **Self-contained** - Each tool has everything it needs
2. **Discoverable** - Registry auto-discovers tools
3. **Maintainable** - Changes isolated to one folder
4. **Searchable** - Metadata enables hybrid search

### Why Unified Registry?

1. **Single source of truth** - No duplicate metadata
2. **Fast lookups** - O(1) after initialization
3. **Search corpus** - Pre-computed for BM25/vector

### Why Hybrid Search?

1. **BM25** - Fast, exact phrase matching
2. **Vector** - Semantic understanding
3. **Combined** - Best of both worlds

### Why Related Tools Expansion?

When user searches "create page", they likely need:
- `createPage` (exact match)
- `getPage` (to check if exists)
- `createSection` (to add content)

Related tools provide complete capability sets.

---

## Integration Points

| Connects To                                         | How                              |
| --------------------------------------------------- | -------------------------------- |
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md)         | prepareStep activates tools      |
| [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) | Entity extraction from results   |
| [3.5 HITL](./LAYER_3.5_HITL.md)                     | Confirmed flag pattern           |
| [3.8 Context](./LAYER_3.8_CONTEXT_INJECTION.md)     | AgentContext injection           |
| Layer 4 Services                                    | Tools call service methods       |

---

## Further Reading

- [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Three-phase tool lifecycle
- [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) - Entity extraction
- [3.5 HITL](./LAYER_3.5_HITL.md) - Confirmation patterns
- [3.8 Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) - AgentContext details
