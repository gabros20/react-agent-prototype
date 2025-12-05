# Dynamic Tool Injection Implementation Plan

> **Status**: Planning Phase
> **Created**: 2025-12-04
> **Based on**: [DYNAMIC_TOOL_INJECTION_V2.md](../research/DYNAMIC_TOOL_INJECTION_V2.md)

---

## Executive Summary: What & Why

### The Problem

The current CMS agent loads **ALL 41 tools (~9,000 tokens)** and **ALL 6 workflow prompts (~10,000 tokens)** on every single request. A simple query like "what's the hero heading?" pays **~19,000 tokens of overhead**—the same cost as complex multi-tool workflows.

### The Solution

Implement a **Single Discovery Tool Architecture** where:

1. Agent starts with ONE tool: `tool_search`
2. Agent's first action IS the classification (call `tool_search` or answer directly)
3. `tool_search` returns relevant tools + rules
4. Discovered tools become available via AI SDK 6's `activeTools`

### Expected Outcomes

| Metric                           | Before             | After              | Improvement       |
| -------------------------------- | ------------------ | ------------------ | ----------------- |
| Token overhead (simple queries)  | ~19,000            | ~500               | **97% reduction** |
| Token overhead (complex queries) | ~19,000            | ~1,800             | **91% reduction** |
| Scalability                      | Limited by context | 100+ tools         | **Unlimited**     |
| Multilingual support             | N/A                | Native (LLM-based) | **Full support**  |

### Key Architecture Decisions

1. **Single `tool_search` tool** - Agent decides what it needs
2. **BM25 + Vector hybrid search** - Fast path for English, semantic for multilingual
3. **Prompt coupling** - Rules delivered WITH discovered tools
4. **AI SDK 6 native** - Uses `activeTools` in `prepareStep` for dynamic tool availability
5. **Modular prompt files** - Each workflow is a separate, versionable file

### Files Changed

| Area             | Files                                               | Change Type                                |
| ---------------- | --------------------------------------------------- | ------------------------------------------ |
| Discovery System | `server/tools/discovery/*` (NEW)                    | Create 6 new files                         |
| Tool Metadata    | `server/tools/tool-index.ts` (NEW)                  | Create tool metadata with search phrases   |
| Prompts          | `server/prompts/core/agent.xml` (NEW)               | Create ~300 token core prompt              |
| Prompts          | `server/prompts/workflows/*.xml`                    | Keep but lazy-load via discovery           |
| Agent            | `server/agent/agent.ts` (renamed from cms-agent.ts) | Major refactor for dynamic tools           |
| Agent            | `server/agent/system-prompt.ts`                     | Refactor to support agent.xml + discovered |
| Services         | `server/services/tool-discovery/*` (NEW)            | Search services                            |
| Background       | `server/services/startup.ts` or similar             | Initialize BM25/vector indexes             |

---

## Phase 0: Preparation & Infrastructure

### 0.1 Dependencies

-   [ ] **0.1.1** Add `wink-bm25-text-search` package for BM25 lexical search

    ```bash
    pnpm add wink-bm25-text-search
    ```

-   [ ] **0.1.2** Add `wink-porter2-stemmer` (optional, for better BM25 matching)

    ```bash
    pnpm add wink-porter2-stemmer
    ```

-   [ ] **0.1.3** Verify AI SDK version supports stable `activeTools` and `prepareStep`
    -   Check `package.json` for `ai` version ≥ 5.0
    -   The codebase already uses `ToolLoopAgent` from AI SDK 6

### 0.2 Directory Structure

-   [ ] **0.2.1** Create discovery module directory structure:

    ```
    server/tools/discovery/
    ├── index.ts              # Exports
    ├── tool-search.ts        # The single discovery tool
    ├── smart-search.ts       # Hybrid BM25/vector search orchestrator
    ├── bm25-search.ts        # BM25 lexical search
    ├── vector-search.ts      # Semantic vector search
    ├── tool-index.ts         # Tool metadata definitions
    └── rules.ts              # Rules loader (reads markdown files)
    ```

-   [ ] **0.2.2** Create prompt and rules files:
    ```
    server/prompts/
    ├── core/
    │   └── agent.xml         # Core agent prompt (~300 tokens)
    └── rules/                # Category-specific rules (plain markdown)
        ├── images.md
        ├── sections.md
        ├── pages.md
        ├── posts.md
        ├── navigation.md
        └── research.md
    ```

---

## Phase 1: Tool Metadata Index

### 1.1 Define Tool Metadata Schema

-   [ ] **1.1.1** Create `server/tools/discovery/types.ts`:

    ```typescript
    export interface ToolMetadata {
    	name: string;
    	description: string;
    	category: ToolCategory;
    	phrases: string[]; // "find image", "create page", etc.
    	relatedTools: string[]; // Often used together
    	riskLevel: "safe" | "moderate" | "destructive";
    	requiresConfirmation: boolean;

    	// Entity extraction schema (used by working memory)
    	// null = no extraction (side effects, external APIs)
    	extraction: ExtractionSchema | null;
    }

    export interface ExtractionSchema {
    	path: string;        // Where to find data: "image", "images", "$root"
    	type: string;        // Entity type: "image", "page", "section", "post"
    	nameField: string;   // Field for display name: "filename", "name", "title"
    	idField?: string;    // Field for ID (default: "id")
    	isArray?: boolean;   // Multiple entities? (default: false)
    }

    export type ToolCategory = "pages" | "sections" | "images" | "posts" | "navigation" | "entries" | "search" | "research" | "pexels" | "http";

    /** Custom extractor function for tools that need special logic */
    export type CustomExtractFn = (result: unknown) => Entity[];

    export interface Entity {
    	type: string;
    	id: string;
    	name: string;
    	timestamp: Date;
    }
    ```

### 1.2 Create Tool Metadata Index

-   [ ] **1.2.1** Create `server/tools/discovery/tool-index.ts` with metadata for all 41 tools:

    **Pages category (6 tools):**

    -   [ ] `cms_getPage` - phrases: ["get page", "find page", "show page", "page details"]
    -   [ ] `cms_createPage` - phrases: ["create page", "new page", "add page"]
    -   [ ] `cms_createPageWithContent` - phrases: ["create page with content", "make page with sections"]
    -   [ ] `cms_updatePage` - phrases: ["update page", "edit page", "change page"]
    -   [ ] `cms_deletePage` - phrases: ["delete page", "remove page"]
    -   [ ] `cms_listPages` - phrases: ["list pages", "show all pages", "what pages exist"]

    **Sections category (8 tools):**

    -   [ ] `cms_listSectionTemplates`
    -   [ ] `cms_getSectionFields`
    -   [ ] `cms_addSectionToPage`
    -   [ ] `cms_updateSectionContent`
    -   [ ] `cms_deletePageSection`
    -   [ ] `cms_deletePageSections`
    -   [ ] `cms_getPageSections`
    -   [ ] `cms_getSectionContent`

    **Images category (7 tools):**

    -   [ ] `cms_findImage`
    -   [ ] `cms_searchImages`
    -   [ ] `cms_listAllImages`
    -   [ ] `cms_addImageToSection`
    -   [ ] `cms_updateSectionImage`
    -   [ ] `cms_replaceImage`
    -   [ ] `cms_deleteImage`

    **Posts category (7 tools):**

    -   [ ] `cms_createPost`
    -   [ ] `cms_updatePost`
    -   [ ] `cms_publishPost`
    -   [ ] `cms_archivePost`
    -   [ ] `cms_deletePost`
    -   [ ] `cms_listPosts`
    -   [ ] `cms_getPost`

    **Navigation category (5 tools):**

    -   [ ] `cms_getNavigation`
    -   [ ] `cms_addNavigationItem`
    -   [ ] `cms_updateNavigationItem`
    -   [ ] `cms_removeNavigationItem`
    -   [ ] `cms_toggleNavigationItem`

    **Other categories (8 tools):**

    -   [ ] `cms_getCollectionEntries` (entries)
    -   [ ] `cms_getEntryContent` (entries)
    -   [ ] `search_vector` (search)
    -   [ ] `cms_findResource` (search)
    -   [ ] `http_get` (http)
    -   [ ] `http_post` (http)
    -   [ ] `web_quickSearch` (research)
    -   [ ] `web_deepResearch` (research)
    -   [ ] `web_fetchContent` (research)
    -   [ ] `pexels_searchPhotos` (pexels)
    -   [ ] `pexels_downloadPhoto` (pexels)
    -   [ ] `plan_analyzeTask` (planning)

### 1.3 Validate Metadata with Zod

-   [ ] **1.3.1** Define Zod schema in `server/tools/discovery/types.ts`:

    ```typescript
    import { z } from 'zod';
    import { ALL_TOOLS } from '../all-tools';

    const toolNames = Object.keys(ALL_TOOLS) as [string, ...string[]];

    const ExtractionSchemaZ = z.object({
      path: z.string(),
      type: z.string(),
      nameField: z.string(),
      idField: z.string().optional(),
      isArray: z.boolean().optional(),
    });

    export const ToolMetadataSchema = z.object({
      name: z.enum(toolNames),           // Must be valid tool name
      description: z.string(),
      category: z.enum(['pages', 'sections', ...]),
      phrases: z.array(z.string()),
      relatedTools: z.array(z.enum(toolNames)),
      riskLevel: z.enum(['safe', 'moderate', 'destructive']),
      requiresConfirmation: z.boolean(),
      extraction: ExtractionSchemaZ.nullable(),  // null = no extraction
    });

    export type ToolMetadata = z.infer<typeof ToolMetadataSchema>;
    ```

-   [ ] **1.3.2** Use `Record<ToolName, ToolMetadata>` for TOOL_INDEX:

    ```typescript
    // TypeScript enforces all tools have entries
    type ToolName = keyof typeof ALL_TOOLS;
    export const TOOL_INDEX: Record<ToolName, ToolMetadata> = { ... };
    ```

-   [ ] **1.3.3** Bidirectional validation at startup - fails fast if invalid:
    ```typescript
    // In initialization (server/tools/discovery/index.ts)
    import { CUSTOM_EXTRACTORS } from './custom-extractors';

    export function validateToolIndex(): void {
      const toolNames = Object.keys(ALL_TOOLS);
      const indexNames = Object.keys(TOOL_INDEX);
      const customNames = new Set(Object.keys(CUSTOM_EXTRACTORS));
      const errors: string[] = [];

      // 1. Validate each metadata entry is well-formed
      for (const meta of Object.values(TOOL_INDEX)) {
        ToolMetadataSchema.parse(meta);
      }

      // 2. Check ALL_TOOLS → TOOL_INDEX (every tool has metadata)
      const missingMetadata = toolNames.filter(name => !TOOL_INDEX[name]);
      if (missingMetadata.length > 0) {
        errors.push(`Tools missing metadata: ${missingMetadata.join(', ')}`);
      }

      // 3. Check TOOL_INDEX → ALL_TOOLS (no orphan metadata)
      const orphanMetadata = indexNames.filter(name => !ALL_TOOLS[name]);
      if (orphanMetadata.length > 0) {
        errors.push(`Orphan metadata: ${orphanMetadata.join(', ')}`);
      }

      // 4. Check CUSTOM_EXTRACTORS → ALL_TOOLS (no orphan custom extractors)
      const orphanCustom = [...customNames].filter(name => !ALL_TOOLS[name]);
      if (orphanCustom.length > 0) {
        errors.push(`Orphan custom extractors: ${orphanCustom.join(', ')}`);
      }

      // 5. Check no tool has BOTH extraction schema AND custom extractor
      const duplicates = toolNames.filter(name =>
        TOOL_INDEX[name]?.extraction !== null && customNames.has(name)
      );
      if (duplicates.length > 0) {
        errors.push(`Tools with both schema AND custom extractor: ${duplicates.join(', ')}`);
      }

      if (errors.length > 0) {
        throw new Error(`Tool index validation failed:\n${errors.join('\n')}`);
      }

      console.log(`✓ Tool index validated: ${toolNames.length} tools, ${customNames.size} custom extractors`);
    }
    ```

-   [ ] **1.3.4** Call validation on server startup:
    ```typescript
    // In server/index.ts or service-container.ts initialization
    import { validateToolIndex } from './tools/discovery';
    validateToolIndex(); // Throws if validation fails
    ```

---

## Phase 2: BM25 Search Implementation

### 2.1 BM25 Engine Setup

-   [ ] **2.1.1** Create `server/tools/discovery/bm25-search.ts`:

    -   Import `wink-bm25-text-search`
    -   `initBM25Index(tools: ToolMetadata[])` - called at startup
    -   `bm25Search(query: string, limit: number)` - returns `{ tools, confidence }`
    -   Configure field weights: `{ name: 2, content: 1 }`
    -   Define prep tasks: lowercase, tokenize, filter short tokens

-   [ ] **2.1.2** Create searchable content from tool metadata:

    ```typescript
    const searchableContent = [tool.name, tool.description, ...tool.phrases, tool.category].join(" ");
    ```

-   [ ] **2.1.3** Implement confidence scoring:
    -   Normalize BM25 scores to 0-1 range
    -   High confidence (>0.8) = use BM25 results directly
    -   Low confidence (<0.3) = fall back to vector search

### 2.2 Initialization Integration

-   [ ] **2.2.1** Add BM25 index initialization to server startup:
    -   Load tool metadata
    -   Call `initBM25Index(TOOL_INDEX)`
    -   Log initialization time and index size

---

## Phase 3: Vector Search Implementation

### 3.1 Tool Vector Index

**Decision:** Reuse existing `VectorIndexService` from `server/services/vector-index.ts`.
No code duplication - extend the existing service with tool-specific methods.

-   [ ] **3.1.1** Extend `VectorIndexService` with tool search methods:
    ```typescript
    // Add to server/services/vector-index.ts

    export interface ToolVectorRecord {
      id: string;           // tool name
      name: string;
      category: string;
      description: string;
      searchableText: string;  // name + description + phrases
      embedding: number[];
    }

    export class VectorIndexService {
      // ... existing code ...

      private toolTable: Table | null = null;

      /**
       * Initialize tool vector index (separate table from resources)
       */
      async initToolIndex(tools: ToolMetadata[]): Promise<void> {
        const currentHash = this.computeToolHash(tools);
        const storedHash = await this.getToolHashFromMeta();

        // Skip if hash matches (tools unchanged)
        if (storedHash === currentHash) {
          this.toolTable = await this.db.openTable("tool_index");
          console.log("✓ Tool vector index loaded from cache");
          return;
        }

        // Generate embeddings using existing embed() method
        console.log(`Generating embeddings for ${tools.length} tools...`);
        const records = await Promise.all(
          tools.map(async (tool) => {
            const searchableText = [
              tool.name,
              tool.description,
              ...tool.phrases,
              tool.category
            ].join(' ');

            return {
              id: tool.name,
              name: tool.name,
              category: tool.category,
              description: tool.description,
              searchableText,
              embedding: await this.embed(searchableText),  // Reuse existing method!
            };
          })
        );

        this.toolTable = await this.db.createTable("tool_index", records, { mode: "overwrite" });
        await this.storeToolHash(currentHash);
        console.log(`✓ Tool vector index created (${tools.length} tools)`);
      }

      /**
       * Search tools by semantic similarity
       */
      async searchTools(query: string, limit: number = 5): Promise<ToolSearchResult[]> {
        if (!this.toolTable) {
          throw new Error("Tool index not initialized. Call initToolIndex first.");
        }

        const queryEmbedding = await this.embed(query);  // Reuse existing method!
        const results = await this.toolTable
          .vectorSearch(queryEmbedding)
          .limit(limit)
          .toArray();

        return results.map((r: any) => ({
          name: r.name,
          category: r.category,
          description: r.description,
          score: r._distance ? 1 - r._distance : 0,
        }));
      }

      private computeToolHash(tools: ToolMetadata[]): string {
        const content = JSON.stringify(tools.map(t => ({
          name: t.name, description: t.description, phrases: t.phrases,
        })));
        return createHash('sha256').update(content).digest('hex').slice(0, 16);
      }

      private async getToolHashFromMeta(): Promise<string | null> { /* ... */ }
      private async storeToolHash(hash: string): Promise<void> { /* ... */ }
    }
    ```

-   [ ] **3.1.2** Create thin wrapper in `server/tools/discovery/vector-search.ts`:
    ```typescript
    import type { VectorIndexService } from '../../services/vector-index';
    import type { ToolMetadata, ToolSearchResult } from './types';

    // Wrapper that uses injected VectorIndexService
    export class ToolVectorSearch {
      constructor(private vectorIndex: VectorIndexService) {}

      async initialize(tools: ToolMetadata[]): Promise<void> {
        await this.vectorIndex.initToolIndex(tools);
      }

      async search(query: string, limit: number): Promise<ToolSearchResult[]> {
        return this.vectorIndex.searchTools(query, limit);
      }
    }

    // Factory for use in service container
    export function createToolVectorSearch(vectorIndex: VectorIndexService): ToolVectorSearch {
      return new ToolVectorSearch(vectorIndex);
    }
    ```

-   [ ] **3.1.3** Initialize in `ServiceContainer`:
    ```typescript
    // In service-container.ts
    async initialize() {
      // ... existing init ...

      // Initialize tool vector index
      const toolMetadata = Object.values(TOOL_INDEX);
      await this.vectorIndex.initToolIndex(toolMetadata);
    }
    ```

**Benefits of reusing `VectorIndexService`:**
- No code duplication (embedding logic in one place)
- Same LanceDB connection
- Consistent error handling
- Already tested and working

### 3.2 Hybrid Search Orchestrator

-   [ ] **3.2.1** Create `server/tools/discovery/smart-search.ts`:

    ```typescript
    export async function smartToolSearch(query: string, limit: number = 5): Promise<ToolSearchResult[]> {
    	// 1. Try BM25 first
    	const bm25Results = bm25Search(query, limit);

    	if (bm25Results.confidence > 0.8) {
    		return bm25Results.tools;
    	}

    	// 2. Vector search for multilingual/semantic
    	const vectorResults = await vectorToolSearch(query, limit);

    	// 3. Blend if partial BM25 matches
    	if (bm25Results.confidence > 0.3) {
    		return mergeAndRank(bm25Results.tools, vectorResults, limit);
    	}

    	return vectorResults;
    }
    ```

-   [ ] **3.2.2** Implement `mergeAndRank`:
    -   Deduplicate by tool name
    -   Combine scores (weighted average or max)
    -   Sort by combined score
    -   Limit to requested count

---

## Phase 4: Rules System

### 4.1 Why Rules?

**Problem:** Discovering tools isn't enough. The agent needs to know HOW to use them:

| Without Rules                                    | With Rules                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| Returns `cms_searchImages`                       | Returns `cms_searchImages` + "Scores closer to 0 = better match" |
| Agent might skip search and download from Pexels | Agent knows to check existing images first                       |
| Agent doesn't know field naming                  | Agent knows to call `cms_getSectionFields` first                 |

**Solution:** When `tool_search` finds tools, it also returns rules based on the tools' categories.

```
User: "add mountain image to hero"
          ↓
tool_search({ query: "add image to section" })
          ↓
Backend finds: cms_searchImages, cms_updateSectionImage (category: images)
          ↓
Returns: {
  tools: [{ name: "cms_searchImages", ... }, { name: "cms_updateSectionImage", ... }],
  rules: "**Images:** Search existing first. Scores closer to 0 = better..."
}
```

### 4.2 Rules File Format

Rules live in markdown files - plain text, easy to edit. No XML parsing needed.

-   [ ] **4.2.1** Create rules directory structure:

    ```
    server/prompts/rules/
    ├── images.md
    ├── sections.md
    ├── pages.md
    ├── posts.md
    ├── navigation.md
    ├── research.md
    ├── entries.md      # Collection entries
    ├── search.md       # Vector/resource search
    ├── pexels.md       # Stock photo downloads
    └── http.md         # HTTP requests
    ```

-   [ ] **4.2.2** Create rule files (example `images.md`):

    ```markdown
    **Images:**
    - Search existing images BEFORE downloading from Pexels
    - Semantic scores: closer to 0 = better match
    - Get field name via cms_getSectionFields before cms_updateSectionImage
    - Image URLs are local: /uploads/images/...
    ```

-   [ ] **4.2.3** Condense existing workflow XML into rule files:

    | Source XML                         | Target Rule File           | Tokens |
    | ---------------------------------- | -------------------------- | ------ |
    | `cms-pages.xml` (~800 tokens)      | `pages.md` + `sections.md` | ~200   |
    | `cms-images.xml` (~1500 tokens)    | `images.md`                | ~150   |
    | `cms-posts.xml` (~600 tokens)      | `posts.md`                 | ~100   |
    | `cms-navigation.xml` (~400 tokens) | `navigation.md`            | ~80    |
    | `web-research.xml` (~500 tokens)   | `research.md`              | ~100   |

-   [ ] **4.2.4** Create minimal rules for remaining categories:

    ```markdown
    <!-- entries.md -->
    **Entries:**
    - Use cms_getCollectionEntries to list items in a collection
    - Use cms_getEntryContent for full entry details

    <!-- search.md -->
    **Search:**
    - search_vector for semantic content search
    - cms_findResource for finding pages/sections/images by name

    <!-- pexels.md -->
    **Pexels:**
    - ALWAYS search existing images first before downloading
    - pexels_searchPhotos returns previews, pexels_downloadPhoto saves locally
    - Downloaded images go to /uploads/images/

    <!-- http.md -->
    **HTTP:**
    - http_get/http_post for external API calls
    - Respect rate limits and handle errors gracefully
    ```

### 4.3 Rules Loader

-   [ ] **4.3.1** Create `server/tools/discovery/rules.ts`:

    ```typescript
    import { readFileSync, readdirSync } from "fs";
    import { join } from "path";
    import type { ToolCategory } from "./types";

    const RULES_DIR = join(__dirname, "../../prompts/rules");

    // Load and cache rules at startup
    const RULES: Record<string, string> = {};

    function loadRules(): void {
    	const files = readdirSync(RULES_DIR).filter((f) => f.endsWith(".md"));
    	for (const file of files) {
    		const category = file.replace(".md", "");
    		RULES[category] = readFileSync(join(RULES_DIR, file), "utf-8").trim();
    	}
    }

    // Initialize on module load
    loadRules();

    export function extractCategories(tools: ToolSearchResult[]): ToolCategory[] {
    	return [...new Set(tools.map((t) => t.category))];
    }

    export function getRules(categories: ToolCategory[]): string {
    	return categories
    		.map((cat) => RULES[cat])
    		.filter(Boolean)
    		.join("\n\n");
    }
    ```

-   [ ] **4.3.2** Add hot-reload in development (optional):
    ```typescript
    if (process.env.NODE_ENV === "development") {
    	watch(RULES_DIR, () => loadRules());
    }
    ```

---

## Phase 5: Discovery Tool Implementation

### 5.1 The tool_search Tool

-   [ ] **5.1.1** Create `server/tools/discovery/tool-search.ts`:

    ```typescript
    // Output schema for type-safe results (AI SDK 6 feature)
    const ToolSearchOutputSchema = z.object({
      tools: z.array(z.object({
        name: z.string(),
        description: z.string(),
      })),
      rules: z.string(),
      instruction: z.string(),
    });

    export const toolSearchTool = tool({
      description: `Search for CMS tools you need. Describe the capability.
    Returns tools you can then call, plus rules on how to use them.
    Search again if you need additional capabilities.

    Examples:
    - "find image" → image search tools
    - "create page add section" → page and section tools
    - "update navigation menu" → navigation tools`,

      inputSchema: z.object({
        query: z.string().describe("What do you need to do?"),
        limit: z.number().default(5).describe("Max tools to return"),
      }),

      // AI SDK 6: outputSchema validates tool results and enables type inference
      outputSchema: ToolSearchOutputSchema,

      execute: async ({ query, limit }) => {
        const results = await smartToolSearch(query, limit);

        // Auto-include related tools
        const allTools = expandWithRelatedTools(results, limit);
        const categories = extractCategories(allTools);

        return {
          tools: allTools.map((t) => ({
            name: t.name,
            description: t.description,
          })),
          rules: getRules(categories),
          instruction: "These tools are now available. Search again if you need more.",
        };
      },
    });
    ```

-   [ ] **5.1.2** Implement `expandWithRelatedTools` helper:

    ```typescript
    // In smart-search.ts or utils.ts
    export function expandWithRelatedTools(
      results: ToolSearchResult[],
      limit: number
    ): ToolSearchResult[] {
      const toolSet = new Map<string, ToolSearchResult>();

      // Add primary results first
      for (const tool of results) {
        toolSet.set(tool.name, tool);
      }

      // Add related tools (up to limit)
      for (const tool of results) {
        if (toolSet.size >= limit) break;

        for (const relatedName of tool.relatedTools || []) {
          if (toolSet.size >= limit) break;
          if (!toolSet.has(relatedName)) {
            const related = TOOL_INDEX[relatedName];
            if (related) {
              toolSet.set(relatedName, related);
            }
          }
        }
      }

      return Array.from(toolSet.values());
    }
    ```

-   [ ] **5.1.3** Handle empty results with fallback:

    ```typescript
    execute: async ({ query, limit }) => {
      const results = await smartToolSearch(query, limit);

      // Fallback if no results found
      if (results.length === 0) {
        return {
          tools: [],
          rules: "",
          instruction: `No tools found for "${query}". Try:
    - More specific terms: "create page", "find image", "update section"
    - Different phrasing: what action do you want to perform?
    - If you can answer without tools, respond directly.`,
        };
      }

      // ... rest of logic
    };
    ```

### 5.2 Tool Registration

-   [ ] **5.2.1** Update `server/tools/all-tools.ts`:

    -   Keep all existing tools
    -   Add `tool_search` to exports
    -   Create `DISCOVERY_TOOLS` for initial tools
    -   Create `CMS_TOOLS` for discoverable tools

-   [ ] **5.2.2** Export structure:

    ```typescript
    export const DISCOVERY_TOOLS = {
    	tool_search: toolSearchTool,
    };

    export const CMS_TOOLS = {
    	cms_getPage: cmsGetPage,
    	// ... all 40+ CMS tools
    };

    export const ALL_TOOLS = {
    	...DISCOVERY_TOOLS,
    	...CMS_TOOLS,
    };
    ```

---

## Phase 6: Core Prompt System

### 6.1 Rename and Extend Agent Prompt

**Important:** Don't rewrite `base-rules.xml` - it's already well written. Just rename and extend.

-   [ ] **6.1.1** Rename file: `server/prompts/core/base-rules.xml` → `server/prompts/core/agent.xml`

-   [ ] **6.1.2** Change top-level XML tag: `<base-rules>` → `<agent>`

-   [ ] **6.1.3** Add tool discovery section to the bottom (before closing `</agent>`):

    ```xml
    <!-- Add this section to bottom of existing content -->

    <tool-discovery>
    Use **tool_search** to find tools you need:
    - Describe what you want to do in natural language
    - You'll receive relevant tools + usage rules
    - Search again if you need more capabilities

    If you can answer without CMS tools, respond directly.
    </tool-discovery>
    ```

-   [ ] **6.1.4** Keep all existing content intact:
    -   `<identity>` - already well written
    -   `<react-pattern>` - already defines Think → Act → Observe
    -   `<reasoning-rules>` - keep as-is
    -   `<confirmation-pattern>` - keep as-is
    -   `<content-fetching>` - keep as-is
    -   `<reference-resolution>` - keep as-is
    -   `<working-memory>` - already has Handlebars template
    -   `<context>` - already has currentDate
    -   `<core-example>` - keep as-is

### 6.2 Update System Prompt Generator

-   [ ] **6.2.1** Refactor `server/agent/system-prompt.ts`:

    ```typescript
    // New exports:
    export function getAgentSystemPrompt(context): string; // New minimal
    export function getFullSystemPrompt(context): string; // Original (legacy)

    // Agent uses only agent.xml (~300 tokens)
    // Full uses all modules (for fallback/testing)
    ```

-   [ ] **6.2.2** Add Handlebars compilation for agent.xml template

---

## Phase 7: Agent Integration

### 7.1 Rename and Update Agent

-   [ ] **7.1.1** Rename `server/agent/cms-agent.ts` → `server/agent/agent.ts`
    -   Update all imports (orchestrator.ts, routes, etc.)
    -   Rename export `cmsAgent` → `agent`

-   [ ] **7.1.2** Modify `server/agent/agent.ts` prepareCall:
    ```typescript
    prepareCall: ({ options, ...settings }) => {
      const agentPrompt = getAgentSystemPrompt({
        currentDate: new Date().toISOString().split("T")[0],
        workingMemory: options.workingMemory || "",
      });

      return {
        ...settings,
        instructions: agentPrompt,
        // Start with only tool_search - others added dynamically via prepareStep
        activeTools: ["tool_search"],
        experimental_context: {
          db: options.db,
          services: options.services,
          // ... rest of context
        } as AgentContext,
      };
    },
    ```

### 7.2 Dynamic Tool Availability (AI SDK 6 Pattern)

**Key insight:** Use working memory as the persistence layer for discovered/used tools.
- Working memory already persists across turns and is injected into system prompt
- `steps` contains tool_search results from CURRENT multi-step execution
- `stepNumber` enables phased tool availability (discovery → execution)
- **Hybrid approach:** Previous turns from working memory + current turn from steps

-   [ ] **7.2.1** Implement `prepareStep` for dynamic tool availability:
    ```typescript
    prepareStep: async ({ stepNumber, steps, messages }) => {
      // Hybrid: previous turns from working memory + current turn from steps
      // Working memory is in the system message (messages[0])
      const workingMemoryTools = extractToolsFromWorkingMemory(messages[0]);
      const currentStepTools = extractToolsFromSteps(steps);
      const discoveredTools = [...new Set([...workingMemoryTools, ...currentStepTools])];

      // Phase 1: Discovery (step 0, no tools yet)
      // IMPORTANT: Use 'auto' - agent decides whether to call tool_search or answer directly
      // This enables Type A queries ("What is a CMS?") to get direct answers without tool calls
      if (stepNumber === 0 && discoveredTools.length === 0) {
        return {
          activeTools: ['tool_search'],
          toolChoice: 'auto',  // Agent classifies: needs tools? → tool_search, else → answer
        };
      }

      // Phase 2: Execution (tools discovered)
      // All discovered tools available, plus tool_search for additional discovery
      return {
        activeTools: ['tool_search', ...discoveredTools],
        toolChoice: 'auto',
        // Message trimming for long conversations
        messages: messages.length > 20
          ? [messages[0], ...messages.slice(-10)]
          : undefined,
      };
    },
    ```

    **Why `toolChoice: 'auto'` not `{ type: 'tool', toolName: 'tool_search' }`?**

    | Query Type | With 'auto' | With forced tool_search |
    |------------|-------------|-------------------------|
    | "What is a CMS section?" | Direct answer ✅ | Unnecessary tool call ❌ |
    | "Update the hero image" | Calls tool_search ✅ | Calls tool_search ✅ |
    | "Hello" | Direct response ✅ | Wastes tokens ❌ |

-   [ ] **7.2.2** Create helper functions in `server/tools/discovery/utils.ts`:
    ```typescript
    import type { ModelMessage, StepResult } from 'ai';

    /**
     * Extract discovered tools from working memory in system message.
     * Working memory contains tools from PREVIOUS conversation turns.
     */
    export function extractToolsFromWorkingMemory(systemMessage: ModelMessage): string[] {
      if (systemMessage.role !== 'system') return [];

      // Working memory is embedded in system prompt as structured text
      // Parse the <working-memory> section for discoveredTools
      const content = typeof systemMessage.content === 'string'
        ? systemMessage.content
        : '';

      // Match discoveredTools array in working memory
      const match = content.match(/discoveredTools:\s*\[([^\]]*)\]/);
      if (!match) return [];

      return match[1]
        .split(',')
        .map(s => s.trim().replace(/['"]/g, ''))
        .filter(Boolean);
    }

    /**
     * Extract discovered tools from current execution steps.
     * Steps contain tool_search results from CURRENT multi-step execution.
     */
    export function extractToolsFromSteps(steps: StepResult[]): string[] {
      const tools = new Set<string>();

      for (const step of steps) {
        const searchResults = step.toolResults?.filter(
          tr => tr.toolName === 'tool_search'
        );
        searchResults?.forEach(sr => {
          const result = sr.result as { tools?: { name: string }[] };
          result?.tools?.forEach(t => tools.add(t.name));
        });
      }

      return Array.from(tools);
    }

    /**
     * Extract used tools from current execution steps.
     * Tracks which tools were actually called (not just discovered).
     */
    export function extractUsedToolsFromSteps(steps: StepResult[]): string[] {
      const tools = new Set<string>();

      for (const step of steps) {
        step.toolCalls?.forEach(tc => {
          if (tc.toolName !== 'tool_search') {
            tools.add(tc.toolName);
          }
        });
      }

      return Array.from(tools);
    }
    ```

-   [ ] **7.2.3** Alternative: Forced discovery (NOT recommended for our use case)
    ```typescript
    // ⚠️ This pattern FORCES tool_search on every new conversation
    // Only use if you NEVER want direct answers without tool discovery
    // NOT recommended - breaks Type A query optimization

    prepareStep: async ({ stepNumber, steps, messages }) => {
      const discovered = extractDiscoveredTools(messages, steps);

      // Step 0: Force discovery - agent CANNOT answer directly
      if (stepNumber === 0 && discovered.length === 0) {
        return {
          activeTools: ['tool_search'],
          toolChoice: { type: 'tool', toolName: 'tool_search' },  // ❌ Breaks classification
        };
      }

      return {
        activeTools: ['tool_search', ...discovered],
        toolChoice: 'auto',
      };
    }
    ```

    **When forced discovery makes sense:**
    - Chatbots that ALWAYS need to search a knowledge base
    - Workflows where every query requires tool use
    - NOT our CMS agent (we want direct answers for simple questions)

### 7.3 Working Memory Tool Tracking

Working memory already persists across turns. Extend it to track discovered and used tools.

-   [ ] **7.3.1** Update working memory schema in `server/services/working-memory/types.ts`:
    ```typescript
    export interface WorkingMemory {
      // Existing fields
      entities: Entity[];
      summary?: string;

      // NEW: Tool tracking
      discoveredTools: string[];        // Tools returned by tool_search
      usedTools: ToolUsageRecord[];     // Tools actually called
    }

    export interface ToolUsageRecord {
      name: string;
      count: number;
      lastUsed: string;  // ISO timestamp
    }
    ```

-   [ ] **7.3.2** Update working memory template in `server/prompts/core/agent.xml`:
    ```xml
    <working-memory>
    {{#if workingMemory}}
    ## Session Context
    {{#if workingMemory.entities}}
    **Entities:** {{#each workingMemory.entities}}{{this.type}}: {{this.name}}{{#unless @last}}, {{/unless}}{{/each}}
    {{/if}}
    {{#if workingMemory.discoveredTools}}
    **Available Tools:** discoveredTools: [{{#each workingMemory.discoveredTools}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]
    {{/if}}
    {{#if workingMemory.usedTools}}
    **Recently Used:** {{#each workingMemory.usedTools}}{{this.name}} ({{this.count}}x){{#unless @last}}, {{/unless}}{{/each}}
    {{/if}}
    {{/if}}
    </working-memory>
    ```

-   [ ] **7.3.3** Update working memory at end of turn in orchestrator:
    ```typescript
    // In server/services/agent/orchestrator.ts - after agent execution completes
    async updateWorkingMemoryWithTools(
      sessionId: string,
      steps: StepResult[]
    ): Promise<void> {
      const currentMemory = await this.workingMemoryService.get(sessionId);

      // Extract tools from this turn
      const newDiscovered = extractToolsFromSteps(steps);
      const newUsed = extractUsedToolsFromSteps(steps);

      // Merge with existing (dedupe discovered, increment used counts)
      const discoveredTools = [...new Set([
        ...(currentMemory.discoveredTools || []),
        ...newDiscovered
      ])];

      const usedTools = mergeUsedTools(
        currentMemory.usedTools || [],
        newUsed
      );

      await this.workingMemoryService.update(sessionId, {
        ...currentMemory,
        discoveredTools,
        usedTools,
      });
    }

    function mergeUsedTools(
      existing: ToolUsageRecord[],
      newTools: string[]
    ): ToolUsageRecord[] {
      const map = new Map(existing.map(t => [t.name, t]));
      const now = new Date().toISOString();

      for (const name of newTools) {
        const record = map.get(name);
        if (record) {
          record.count += 1;
          record.lastUsed = now;
        } else {
          map.set(name, { name, count: 1, lastUsed: now });
        }
      }

      return Array.from(map.values());
    }
    ```

-   [ ] **7.3.4** Wire up in orchestrator's `executeStream`/`executeGenerate`:
    ```typescript
    // After agent.run() completes
    const result = await agent.run({ ... });

    // Update working memory with tool state
    await this.updateWorkingMemoryWithTools(sessionId, result.steps);

    return result;
    ```

### 7.4 Benefits of Working Memory Approach

| Aspect | External Cache | Message Parsing | Working Memory (New) |
|--------|----------------|-----------------|---------------------|
| Session cleanup | Manual cleanup required | N/A | Automatic (tied to session) |
| Memory leaks | Possible | None | None |
| Cross-turn persistence | Requires sync | Re-parse every step | Native (already persisted) |
| Tracks used tools | No | Complex to implement | Simple increment |
| Future recommendations | No | No | Yes (usage patterns) |
| Debugging | External state | Parse conversation | Visible in working memory |
| Performance | O(1) lookup | O(n) parsing | O(1) + initial parse |

**Bonus: Usage patterns enable future optimizations:**
- Tools used together → suggest as related tools
- Frequently used tools → prioritize in search
- Unused discovered tools → improve search relevance

### 7.5 Schema-Driven Entity Extraction

**Problem:** The current pattern-based entity extraction guesses result shapes and achieves only ~60% reliability.

**Solution:** Extraction schemas are now part of `TOOL_INDEX` (defined in Phase 1). No separate registry needed.

-   [ ] **7.5.1** Working memory types in `server/services/working-memory/types.ts`:
    ```typescript
    // Import Entity from discovery types (single source of truth)
    import type { Entity } from '../../tools/discovery/types';
    export type { Entity };

    export interface ToolUsageRecord {
      name: string;
      count: number;
      lastUsed: string;       // ISO timestamp
      lastResult: 'success' | 'error';
    }

    export interface WorkingMemoryState {
      entities: Entity[];
      discoveredTools: string[];
      usedTools: ToolUsageRecord[];
      summary?: string;
    }
    ```

-   [ ] **7.5.2** Custom extractors in `server/tools/discovery/custom-extractors.ts`:
    ```typescript
    import type { Entity, CustomExtractFn } from './types';

    /**
     * Extract entities from cms_findResource results.
     * Handles dynamic types - each match declares its own type.
     */
    export function extractFromFindResource(result: unknown): Entity[] {
      const matches = (result as Record<string, unknown>)?.matches;
      if (!Array.isArray(matches)) return [];

      return matches.slice(0, 5).map(m => {
        const match = m as Record<string, unknown>;
        if (!match.id || !match.name) return null;
        return {
          type: String(match.type ?? 'resource').toLowerCase(),
          id: String(match.id),
          name: String(match.name),
          timestamp: new Date(),
        };
      }).filter((e): e is Entity => e !== null);
    }

    /**
     * Extract entities from search_vector results.
     */
    export function extractFromVectorSearch(result: unknown): Entity[] {
      const results = (result as Record<string, unknown>)?.results;
      if (!Array.isArray(results)) return [];

      return results.slice(0, 5).map(r => {
        const item = r as Record<string, unknown>;
        if (!item.id || !item.name) return null;
        return {
          type: String(item.type ?? 'resource').toLowerCase(),
          id: String(item.id),
          name: String(item.name),
          timestamp: new Date(),
        };
      }).filter((e): e is Entity => e !== null);
    }

    /**
     * Custom extractors for tools needing special logic.
     * These tools have extraction: null in TOOL_INDEX.
     */
    export const CUSTOM_EXTRACTORS: Record<string, CustomExtractFn> = {
      'cms_findResource': extractFromFindResource,
      'search_vector': extractFromVectorSearch,
    };
    ```

-   [ ] **7.5.3** Create schema-based extractor in `server/services/working-memory/schema-extractor.ts`:
    ```typescript
    import { TOOL_INDEX } from '../../tools/discovery/tool-index';
    import { CUSTOM_EXTRACTORS } from '../../tools/discovery/custom-extractors';
    import type { Entity, ExtractionSchema } from '../../tools/discovery/types';

    export class SchemaBasedExtractor {
      /**
       * Extract entities from a tool result.
       * Priority: 1) Custom extractor, 2) Schema from TOOL_INDEX, 3) Skip
       */
      extract(toolName: string, result: unknown): Entity[] {
        // 1. Check custom extractor first
        const customFn = CUSTOM_EXTRACTORS[toolName];
        if (customFn) {
          try {
            return customFn(result);
          } catch (error) {
            console.warn(`[SchemaExtractor] Custom extractor failed for ${toolName}:`, error);
            return [];
          }
        }

        // 2. Get extraction schema from TOOL_INDEX
        const meta = TOOL_INDEX[toolName];
        if (!meta) {
          console.warn(`[SchemaExtractor] Unknown tool: ${toolName}`);
          return [];
        }
        if (!meta.extraction) {
          return [];  // No extraction for this tool
        }

        try {
          return this.extractWithSchema(result, meta.extraction);
        } catch (error) {
          console.warn(`[SchemaExtractor] Extraction failed for ${toolName}:`, error);
          return [];
        }
      }

      private extractWithSchema(result: unknown, schema: ExtractionSchema): Entity[] {
        const data = this.resolvePath(result, schema.path);
        if (!data) return [];

        const items = schema.isArray
          ? (Array.isArray(data) ? data : [])
          : [data];

        return items
          .slice(0, 5)
          .map(item => this.createEntity(item, schema))
          .filter((e): e is Entity => e !== null);
      }

      private resolvePath(result: unknown, path: string): unknown {
        if (path === '$root') return result;
        if (typeof result !== 'object' || result === null) return null;
        return (result as Record<string, unknown>)[path];
      }

      private createEntity(item: unknown, schema: ExtractionSchema): Entity | null {
        if (typeof item !== 'object' || item === null) return null;

        const record = item as Record<string, unknown>;
        const id = record[schema.idField || 'id'];
        const name = record[schema.nameField];

        if (!id || !name) return null;

        return {
          type: schema.type,
          id: String(id),
          name: String(name),
          timestamp: new Date(),
        };
      }
    }

    export const schemaExtractor = new SchemaBasedExtractor();
    ```

**Note:** Extraction validation is handled by `validateToolIndex()` in Phase 1.3.3 - no separate validation needed.

-   [ ] **7.5.4** Integrate schema extractor in working memory service:
    ```typescript
    // In server/services/working-memory/service.ts
    import { schemaExtractor } from './schema-extractor';

    export class WorkingMemoryService {
      /**
       * Process tool results and extract entities using schema-based extraction.
       * Called after each tool execution in the orchestrator.
       */
      async processToolResult(
        sessionId: string,
        toolName: string,
        result: unknown,
        success: boolean
      ): Promise<void> {
        const memory = await this.get(sessionId);

        // 1. Extract entities using schema
        const newEntities = schemaExtractor.extract(toolName, result);

        // 2. Merge with existing entities (sliding window, max 10)
        const mergedEntities = this.mergeEntities(memory.entities, newEntities);

        // 3. Update tool usage tracking (from Phase 7.3)
        const usedTools = this.updateToolUsage(
          memory.usedTools,
          toolName,
          success ? 'success' : 'error'
        );

        await this.update(sessionId, {
          ...memory,
          entities: mergedEntities,
          usedTools,
        });
      }

      private mergeEntities(existing: Entity[], newEntities: Entity[]): Entity[] {
        // Dedupe by type+id, keep newest, limit to 10
        const map = new Map<string, Entity>();

        for (const e of [...existing, ...newEntities]) {
          const key = `${e.type}:${e.id}`;
          const current = map.get(key);
          if (!current || e.timestamp > current.timestamp) {
            map.set(key, e);
          }
        }

        return Array.from(map.values())
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 10);
      }

      private updateToolUsage(
        existing: ToolUsageRecord[],
        toolName: string,
        result: 'success' | 'error'
      ): ToolUsageRecord[] {
        if (toolName === 'tool_search') return existing;  // Don't track discovery tool

        const map = new Map(existing.map(t => [t.name, t]));
        const now = new Date().toISOString();
        const record = map.get(toolName);

        if (record) {
          record.count += 1;
          record.lastUsed = now;
          record.lastResult = result;
        } else {
          map.set(toolName, { name: toolName, count: 1, lastUsed: now, lastResult: result });
        }

        return Array.from(map.values());
      }
    }
    ```

-   [ ] **7.5.5** Wire up in orchestrator with silent failure detection:
    ```typescript
    // In server/services/agent/orchestrator.ts

    export class AgentOrchestrator {
      async *executeStream(options: ExecuteOptions): AsyncGenerator<StreamEvent> {
        let toolResultCount = 0;
        let processedCount = 0;

        for await (const event of stream) {
          if (event.type === 'tool-result') {
            toolResultCount++;
            try {
              await this.workingMemoryService.processToolResult(
                sessionId,
                event.toolName,
                event.result,
                event.success ?? true
              );
              processedCount++;
            } catch (error) {
              // Log but don't fail the stream - extraction is non-critical
              console.error(`[Orchestrator] Entity extraction failed for ${event.toolName}:`, error);
            }
          }
          yield event;
        }

        // Silent failure detection: warn if extraction was skipped
        if (toolResultCount > 0 && processedCount === 0) {
          console.warn(
            `[Orchestrator] WARNING: ${toolResultCount} tool results received but 0 processed. ` +
            `Entity extraction may be broken.`
          );
        }

        // Log extraction stats for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Orchestrator] Processed ${processedCount}/${toolResultCount} tool results`);
        }
      }
    }
    ```

-   [ ] **7.5.6** Add extraction health check endpoint (optional):
    ```typescript
    // In server/routes/health.ts
    import { TOOL_INDEX } from '../tools/discovery/tool-index';
    import { CUSTOM_EXTRACTORS } from '../tools/discovery/custom-extractors';
    import { schemaExtractor } from '../services/working-memory/schema-extractor';

    router.get('/health/extraction', async (req, res) => {
      try {
        // Test extraction with a known tool/result pair
        const testResult = schemaExtractor.extract('cms_getPage', {
          id: 'test-id',
          name: 'Test Page',
          slug: 'test',
        });

        const healthy = testResult.length === 1 &&
          testResult[0].type === 'page' &&
          testResult[0].id === 'test-id';

        const toolsWithExtraction = Object.values(TOOL_INDEX).filter(m => m.extraction).length;

        res.json({
          status: healthy ? 'ok' : 'degraded',
          toolsWithExtraction,
          customExtractors: Object.keys(CUSTOM_EXTRACTORS).length,
        });
      } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
      }
    });
    ```

### 7.6 Benefits of Schema-Driven Extraction

| Aspect | Pattern-Based (Current) | Schema-Driven (New) |
|--------|------------------------|---------------------|
| Reliability | ~60% | ~98% |
| New tool support | Guess → test → fix | Add one line to registry |
| Type safety | None (any casting) | Full TypeScript inference |
| Debugging | "Why didn't it extract?" | Check schema registry |
| Maintenance | Update regexes/conditionals | Update schema entry |
| Error handling | Silent failures | Logged warnings with tool name |

**Schema-driven extraction also enables:**
- Automatic validation that all tools have extraction rules (CI check)
- IDE autocomplete for schema fields
- Easy testing: mock tool name + result → assert entities
- Clear documentation of what each tool returns

---

## Phase 8: Testing & Validation

### 8.1 Unit Tests

-   [ ] **8.1.1** Test BM25 search:

    -   English queries return expected tools
    -   Non-English queries return low confidence
    -   Edge cases: empty query, very long query

-   [ ] **8.1.2** Test vector search:

    -   Semantic similarity works
    -   Multilingual queries find correct tools
    -   Score normalization

-   [ ] **8.1.3** Test hybrid search:

    -   BM25 high confidence → BM25 results only
    -   BM25 low confidence → vector results
    -   Partial match → blended results

-   [ ] **8.1.4** Test rules:
    -   Correct categories extracted from tools
    -   Correct rules returned for categories
    -   Multiple categories combined

### 8.2 Integration Tests

-   [ ] **8.2.1** Test full discovery flow:

    -   User sends message
    -   Agent calls tool_search
    -   Tools become available
    -   Agent uses discovered tools
    -   Task completes

-   [ ] **8.2.2** Test Type A (no tools):

    -   "What is a CMS section?" → direct answer
    -   No tool_search call
    -   Minimal token usage

-   [ ] **8.2.3** Test Type B (simple):

    -   "Find the hero image" → tool_search → cms_searchImages
    -   One discovery round
    -   Moderate token usage

-   [ ] **8.2.4** Test Type C (complex):
    -   "Create about page with hero and image"
    -   Multiple tool_search calls
    -   Multi-step execution

-   [ ] **8.2.5** Test working memory tool tracking:
    -   Turn 1: "Find hero image" → discoveredTools: ["cms_searchImages"]
    -   Turn 2: "Update the hero" → discoveredTools persists from working memory
    -   Verify usedTools counts increment correctly
    -   Verify cross-turn tool availability without re-discovery

-   [ ] **8.2.6** Test working memory persistence:
    -   New session starts with empty discoveredTools
    -   Tools persist within session across multiple turns
    -   Session cleanup removes tool state

-   [ ] **8.2.7** Test schema-driven entity extraction:
    -   `cms_getPage` returns entity with type "page"
    -   `cms_searchImages` returns array of image entities
    -   Unknown tools log warning and return empty array
    -   Null-schema tools (side effects) return empty array
    -   Invalid results (missing id/name) are filtered out
    -   Custom extractors take priority over schema
    -   `cms_findResource` uses custom extractor, returns dynamic types per match
    -   `search_vector` uses custom extractor, handles mixed result types

-   [ ] **8.2.8** Test entity merging and sliding window:
    -   Duplicate entities (same type+id) keep newest timestamp
    -   Window limited to 10 entities
    -   Oldest entities evicted when over limit

-   [ ] **8.2.9** Test tool index validation (includes extraction):
    -   `validateToolIndex()` passes with complete TOOL_INDEX
    -   Throws on missing tool metadata
    -   Throws on orphan custom extractor
    -   Throws on duplicate (both extraction schema AND custom for same tool)

-   [ ] **8.2.10** Test silent failure detection:
    -   Orchestrator logs warning when `toolResultCount > 0` and `processedCount === 0`
    -   Individual extraction errors logged but don't fail stream
    -   Health check endpoint returns correct status

### 8.3 Token Usage Validation

-   [ ] **8.3.1** Create token counting test harness:

    -   Measure tokens for Type A/B/C scenarios
    -   Compare with current baseline
    -   Validate savings match expected

-   [ ] **8.3.2** Add metrics to trace logging:
    -   Track tool_search call count
    -   Track discovered tool count
    -   Track rules tokens

---

## Phase 9: Cleanup & Documentation

### 9.1 Monitoring

-   [ ] **9.1.1** Add observability metrics:

    -   Tool discovery latency (BM25 vs vector)
    -   Tool discovery hit rate (found relevant tools)
    -   Token usage per request type

-   [ ] **9.1.2** Add trace entries for discovery:
    -   `tool_discovery_start`
    -   `tool_discovery_result`
    -   `tools_enabled`

### 9.2 Documentation

-   [ ] **9.2.1** Update architecture docs:

    -   `LAYER_3_AGENT.md` - new discovery flow
    -   `LAYER_3.2_TOOLS.md` - tool metadata, discovery

-   [ ] **9.2.2** Update prompt documentation:

    -   Document agent.xml structure
    -   Document rules system

-   [ ] **9.2.3** Create runbook:
    -   How to add new tools (with metadata)
    -   How to update rules
    -   Troubleshooting discovery issues

### 9.3 Cleanup

-   [ ] **9.3.1** Remove old full-prompt code path from system-prompt.ts
-   [ ] **9.3.2** Merge TOOL_METADATA into TOOL_INDEX (single source of truth)

---

## Dependencies Between Phases

| Phase                | Depends On                  | Can Run In Parallel With     |
| -------------------- | --------------------------- | ---------------------------- |
| 0: Dependencies      | -                           | -                            |
| 1: Tool Metadata     | 0                           | -                            |
| 2: BM25 Search       | 1                           | -                            |
| 3: Vector Search     | 1                           | 2 (independent search impl)  |
| 4: Rules System      | 1                           | 2, 3 (just needs categories) |
| 5: Discovery Tool    | 2, 4 (needs search + rules) | 3 (vector is optional)       |
| 6: Prompts           | 0                           | 1, 2, 3, 4, 5 (independent)  |
| 7: Agent Integration | 5, 6                        | -                            |
| 8: Testing           | 7                           | -                            |
| 9: Cleanup           | 8                           | -                            |

**Critical Path (MVP)**: 0 → 1 → 2 → 4 → 5 → 6 → 7 → 8

**Deferred (add after MVP works)**:

-   Phase 3 (Vector Search) - only needed for multilingual
-   Phase 9 (Cleanup) - polish after validation

---

## Quick Reference: Key Files to Create/Modify

### New Files

**Discovery Module (10 files)**

```
server/tools/discovery/types.ts               # ToolMetadata, ExtractionSchema, Entity, CustomExtractFn
server/tools/discovery/tool-index.ts          # TOOL_INDEX with extraction schemas
server/tools/discovery/custom-extractors.ts   # CUSTOM_EXTRACTORS for dynamic-type tools
server/tools/discovery/bm25-search.ts
server/tools/discovery/vector-search.ts
server/tools/discovery/smart-search.ts
server/tools/discovery/rules.ts
server/tools/discovery/tool-search.ts
server/tools/discovery/utils.ts               # extractToolsFromWorkingMemory, extractToolsFromSteps
server/tools/discovery/index.ts
```

**Working Memory (1 file)**

```
server/services/working-memory/schema-extractor.ts   # SchemaBasedExtractor (reads from TOOL_INDEX)
```

**Prompts & Rules (11 files)**

```
server/prompts/core/agent.xml
server/prompts/rules/images.md
server/prompts/rules/sections.md
server/prompts/rules/pages.md
server/prompts/rules/posts.md
server/prompts/rules/navigation.md
server/prompts/rules/research.md
server/prompts/rules/entries.md
server/prompts/rules/search.md
server/prompts/rules/pexels.md
server/prompts/rules/http.md
```

### Modified Files (8)

```
server/tools/all-tools.ts                      # Add tool_search, restructure exports
server/agent/cms-agent.ts → agent.ts           # Rename + major refactor for dynamic tools
server/agent/system-prompt.ts                  # Add getAgentSystemPrompt
server/services/service-container.ts           # Initialize indexes, call validateToolIndex()
server/services/working-memory/types.ts        # WorkingMemoryState, ToolUsageRecord (imports Entity from discovery)
server/services/working-memory/service.ts      # Add processToolResult(), mergeEntities(), updateToolUsage()
server/services/agent/orchestrator.ts          # Silent failure detection + extraction stats logging
server/services/vector-index.ts                # Add initToolIndex, searchTools methods
+ update imports in routes, etc.
```

---

## Estimated Effort

| Phase                              | Effort     | Complexity                                       |
| ---------------------------------- | ---------- | ------------------------------------------------ |
| 0: Deps                            | 0.5 hr     | Low                                              |
| 1: Metadata + Extraction Schemas   | 3-4 hr     | Medium (41 tools with extraction schemas)        |
| 2: BM25                            | 2 hr       | Medium                                           |
| 3: Vector                          | 3 hr       | Medium-High                                      |
| 4: Rules                           | 2 hr       | Low (create markdown files + loader)             |
| 5: Discovery Tool                  | 1 hr       | Low                                              |
| 6: Prompts                         | 1 hr       | Low                                              |
| 7.1-7.4: Agent + Tool Tracking     | 3 hr       | Medium (working memory integration)              |
| 7.5-7.6: Schema Extractor          | 2 hr       | Low (reads from TOOL_INDEX, simple extractor)    |
| 8: Testing                         | 4 hr       | Medium                                           |
| 9: Cleanup                         | 1 hr       | Low                                              |
| **Total**                          | **~23 hr** |                                                  |

**MVP (Phases 0-2, 4-8)**: ~18 hours (excludes Phase 3 Vector Search and Phase 9 Cleanup)

---

## Appendix: AI SDK 6 Features Used

This implementation leverages the following AI SDK 6 capabilities:

### Core Features

| Feature | Usage | Documentation |
|---------|-------|---------------|
| `ToolLoopAgent` | Main agent class with tool loop management | [tool-loop-agent](https://v6.ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent) |
| `callOptionsSchema` | Type-safe runtime options (sessionId, services) | [configuring-call-options](https://v6.ai-sdk.dev/docs/agents/configuring-call-options) |
| `prepareCall` | Dynamic instructions, model selection, context injection | [configuring-call-options](https://v6.ai-sdk.dev/docs/agents/configuring-call-options) |
| `prepareStep` | Per-step tool availability via `activeTools` | [loop-control](https://v6.ai-sdk.dev/docs/agents/loop-control) |
| `activeTools` | Dynamic tool filtering per step | [loop-control](https://v6.ai-sdk.dev/docs/agents/loop-control) |
| `toolChoice` | `'auto'` - let agent classify (tool_search vs direct answer) | [loop-control](https://v6.ai-sdk.dev/docs/agents/loop-control) |
| `stopWhen` | Custom stop conditions | [loop-control](https://v6.ai-sdk.dev/docs/agents/loop-control) |
| `experimental_context` | Pass services to tool execute functions | [tools-and-tool-calling](https://v6.ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) |

### Tool Features

| Feature | Usage | Documentation |
|---------|-------|---------------|
| `tool()` | Define tools with type-safe schemas | [tool](https://v6.ai-sdk.dev/docs/reference/ai-sdk-core/tool) |
| `inputSchema` | Zod schema for tool inputs | [tool](https://v6.ai-sdk.dev/docs/reference/ai-sdk-core/tool) |
| `outputSchema` | Validate tool_search results | [tool](https://v6.ai-sdk.dev/docs/reference/ai-sdk-core/tool) |

### Embeddings (NOT using AI SDK)

Vector search uses **existing OpenRouter direct API pattern** from `VectorIndexService` for consistency.
AI SDK's `embed()` not used because `createOpenRouter` provider may not support `textEmbeddingModel()`.

### Key Patterns

1. **Working memory tool persistence**: Discovered/used tools stored in working memory across turns
2. **Hybrid discovery**: Previous turns from working memory + current turn from `steps`
3. **Phased execution**: Step 0 = discovery phase, Steps 1+ = execution phase
4. **Dynamic tool injection**: `activeTools` changes per step based on discovery results
5. **Context injection**: Services passed via `experimental_context` to tools
6. **Agent classification**: `toolChoice: 'auto'` lets agent decide tool_search vs direct answer
7. **Usage tracking**: `usedTools` records which tools were actually called (enables future optimizations)

### AI SDK 6 Import Summary

```typescript
import {
  ToolLoopAgent,
  tool,
  stepCountIs,
  NoSuchToolError,
  InvalidToolInputError,
} from 'ai';
import type {
  ModelMessage,
  StepResult,
  ToolExecutionOptions,
} from 'ai';
```
