# Dynamic Tool Injection V2: Single Discovery Tool Architecture

> Research conducted December 2025 for react-agent-prototype
> **Version 2**: Simplified from category-based routing to single discovery tool

## Executive Summary

**Problem**: Your CMS agent has TWO layers of token bloat:

1. **Tool definitions**: 45 tools (~9,000 tokens) loaded on every request
2. **System prompt**: 6 workflow modules (~10,000 tokens) loaded on every request

A simple "what's the hero heading" query pays **~19,000 tokens** of overhead—the same as complex multi-tool workflows.

**Solution**: **Single Discovery Tool with Smart Backend**

Instead of pre-classifying queries and loading tool categories, give the agent ONE discovery tool (`tool_search`) and let it decide what it needs.

| Layer              | Before             | After (V2)        | Savings     |
| ------------------ | ------------------ | ----------------- | ----------- |
| Tool definitions   | ~9,000 tokens      | ~300-1,500 tokens | 83-97%      |
| System prompt      | ~10,000 tokens     | ~300-1,500 tokens | 85-97%      |
| **Total overhead** | **~19,000 tokens** | **~600-3,000**    | **84-97%**  |

**Key Innovation**: The agent itself decides whether it needs tools. Classification happens IN the first LLM call via the agent's action choice:

- Agent answers directly → Type A (no tools needed)
- Agent calls `tool_search` → Type B/C (tools needed)

**Why V2 over V1?**

| Aspect | V1 (Category Routing) | V2 (Single Discovery) |
|--------|----------------------|----------------------|
| Classification | Programmatic keywords | LLM-based (first action) |
| Multilingual | Requires keyword lists per language | Native (LLM understands all) |
| Scalability | Add categories as tools grow | No changes needed at 100+ tools |
| Agent cognitive load | N/A (pre-filtered) | Simple binary decision |
| Prompt coupling | Category → Workflow mapping | Discovery → Workflow hints |

---

## Table of Contents

1. [The Architecture](#1-the-architecture)
2. [Why This Works](#2-why-this-works)
3. [The Single Discovery Tool](#3-the-single-discovery-tool)
4. [Smart Backend](#4-smart-backend)
5. [Tool Index Design](#5-tool-index-design)
6. [Prompt Coupling](#6-prompt-coupling)
7. [Implementation Guide](#7-implementation-guide)
8. [Token Analysis](#8-token-analysis)
9. [Scaling Considerations](#9-scaling-considerations)
10. [Migration from V1](#10-migration-from-v1)
11. [Sources](#11-sources)

---

## 1. The Architecture

### The Core Insight

**Classification happens IN the first LLM call, not before it.**

The agent receives a minimal context and makes a binary decision:

1. Can I answer without CMS tools? → Respond directly (Type A)
2. Do I need tools? → Call `tool_search` (Type B/C)

The agent's first action IS the classification.

```
┌─────────────────────────────────────────────────────────────────┐
│                   User Query (Any Language)                      │
│            "Znajdź zdjęcie bohatera" (Polish)                    │
│            "Erstelle eine About-Seite" (German)                  │
│            "Create about page with hero" (English)               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FIRST LLM CALL                                │
│     Agent receives:                                              │
│     • tool_search (single discovery tool)                        │
│     • Minimal core prompt (~300 tokens)                          │
│                                                                  │
│     Agent's binary decision:                                     │
│     ─────────────────────────────────────────────────────────   │
│                                                                  │
│     "Can I answer without CMS tools?"                            │
│                                                                  │
│         YES → Respond directly (Type A)                          │
│         NO  → tool_search({ query: "what I need" })              │
│                                                                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
      ┌───────────────┐               ┌───────────────────────────┐
      │   TYPE A      │               │   TOOL DISCOVERY          │
      │   ─────────   │               │   ───────────────         │
      │               │               │                           │
      │   No tools    │               │   tool_search({query})    │
      │   LLM answers │               │                           │
      │   from prompt │               │   Backend handles HOW:    │
      │               │               │   • Try keyword first     │
      │   ~300 tokens │               │   • Fall back to vector   │
      │   0 round     │               │                           │
      │   trips       │               │   Returns:                │
      │               │               │   • Tools (1-10)          │
      └───────────────┘               │   • Workflow hints        │
                                      │                           │
                                      │   Agent may search again  │
                                      │   if needed               │
                                      └───────────────────────────┘
```

### Type A/B/C Are Emergent, Not Enforced

The three types emerge from agent behavior, not from different tools or pre-classification:

| Type | What Happens | Result |
|------|--------------|--------|
| **A** | Agent answers directly | No discovery, ~300 tokens |
| **B** | Agent calls `tool_search` once with focused query | 1-3 tools, ~600 tokens |
| **C** | Agent calls `tool_search` multiple times | 5-10 tools, ~1,500 tokens |

The agent doesn't "classify" - it just works. Simple tasks naturally use fewer searches.

---

## 2. Why This Works

### 2.1 LLM-Based Classification (Multilingual)

The agent understands semantics in any language:

- "Znajdź zdjęcie bohatera" (Polish: "Find the hero image") → Simple, needs image tools
- "Erstelle eine About-Seite mit Hero-Bereich und Bergbild" (German) → Complex, needs page + section + image tools

No keyword lists to maintain per language.

### 2.2 Zero Extra Round Trips for Classification

The first LLM response includes the classification decision AS the tool call:

- Calls `tool_search` = needs tools
- Calls nothing / responds directly = doesn't need tools

One LLM call = understanding + classification + first action.

### 2.3 Natural Scaling

Query complexity determines result breadth:

```typescript
// Simple query → focused results
tool_search({ query: "find image" })
// Returns: cms_searchImages, cms_findImage (2 tools)

// Complex query → broader results
tool_search({ query: "create page with sections and images" })
// Returns: cms_createPage, cms_addSectionToPage, cms_searchImages, ... (6+ tools)
```

### 2.4 Self-Correcting

If first search doesn't return enough tools, agent searches again:

```
Agent: tool_search({ query: "create page" })
System: Returns page creation tools
Agent: Creates page
Agent: tool_search({ query: "add image to section" })
System: Returns image tools
Agent: Adds image
```

---

## 3. The Single Discovery Tool

### 3.1 Tool Definition

```typescript
// server/tools/discovery/tool-search.ts

import { tool } from "ai";
import { z } from "zod";
import { smartToolSearch } from "./smart-search";
import { getWorkflowPromptsForCategories, extractCategories } from "./workflow-coupling";

export const toolSearchTool = tool({
  description: `Search for CMS tools you need. Describe the capability.
Returns tools you can then call, plus guidance on how to use them.
Search again if you need additional capabilities.

Examples:
- "find image" → image search tools
- "create page add section" → page and section tools
- "update navigation menu" → navigation tools`,

  inputSchema: z.object({
    query: z.string().describe("What do you need to do?"),
    limit: z.number().default(5).describe("Max tools to return"),
  }),

  execute: async ({ query, limit }) => {
    // Backend decides mechanism (keyword vs vector)
    const results = await smartToolSearch(query, limit);

    // Extract categories for workflow coupling
    const categories = extractCategories(results);

    return {
      tools: results.map(t => ({
        name: t.name,
        description: t.description,
        hint: t.usageHint,
      })),
      // COUPLED: Workflow prompts for discovered categories
      workflowGuidance: getWorkflowPromptsForCategories(categories),
      instruction: "These tools are now available. Search again if you need more.",
    };
  },
});
```

### 3.2 Minimal System Prompt

The agent starts with almost nothing - just enough to know how to discover tools:

```xml
<!-- server/prompts/core/minimal-agent.xml (~300 tokens) -->
<agent>

<identity>
You are a CMS agent with tool discovery capabilities.
</identity>

<tool-discovery>
Use **tool_search** to find tools you need:
- Describe what you want to do in natural language
- You'll receive relevant tools + usage guidance
- Search again if you need more capabilities

If you can answer without CMS tools, respond directly.
</tool-discovery>

<react-pattern>
Think → Search for tools if needed → Act → Observe → Repeat
When complete: FINAL_ANSWER: [your response]
</react-pattern>

<working-memory>
{{{workingMemory}}}
</working-memory>

<context>
Current date: {{currentDate}}
</context>

</agent>
```

**~300 tokens** vs. ~10,000 tokens in V1. Workflow guidance comes FROM the search results.

---

## 4. Smart Backend

The agent doesn't know or care HOW tools are found. The backend optimizes:

### 4.1 Hybrid Search Strategy

The smart backend uses a **two-tier search** that optimizes for speed when possible while ensuring multilingual support:

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Query                                │
│         "find hero image" OR "znajdź zdjęcie bohatera"          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BM25 LEXICAL SEARCH                           │
│                      (< 1ms, in-memory)                          │
├─────────────────────────────────────────────────────────────────┤
│  "find hero image" → tokens match → confidence 0.85 → ✓ USE     │
│  "znajdź zdjęcie"  → no token match → confidence 0.0 → FALLBACK │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │ confidence > 0.8?     │
                    └───────────┬───────────┘
              YES ──────────────┴────────────── NO
               │                                │
               ▼                                ▼
┌───────────────────────┐       ┌───────────────────────────────┐
│   RETURN BM25 RESULTS │       │   VECTOR SEARCH (MULTILINGUAL) │
│   Fast path (~1ms)    │       │   (~50-100ms, API call)        │
│   English queries     │       │   "znajdź" ≈ "find" embedding  │
└───────────────────────┘       └───────────────────────────────┘
```

**Why this order?**
- **BM25 first**: Fast (<1ms), no API call, great for English queries
- **Vector fallback**: Handles multilingual, semantic understanding, but slower (~50-100ms embedding API)
- **Blending**: If BM25 has partial matches, combine with vector for best results

```typescript
// server/tools/discovery/smart-search.ts

interface ToolSearchResult {
  name: string;
  description: string;
  category: string;
  usageHint: string;
  score: number;
}

export async function smartToolSearch(
  query: string,
  limit: number = 5
): Promise<ToolSearchResult[]> {

  // Step 1: Try BM25 lexical search (fast, but English-only effectively)
  const bm25Results = bm25Search(query, limit);

  if (bm25Results.confidence > 0.8) {
    // High confidence = tokens matched well = same language as tool docs
    // Fast path: skip vector search entirely
    return bm25Results.tools.slice(0, limit);
  }

  // Step 2: Vector search (multilingual, semantic understanding)
  // This handles: non-English queries, paraphrases, conceptual matches
  const vectorResults = await vectorSearch(query, limit);

  // Step 3: Blend if BM25 had partial matches
  if (bm25Results.confidence > 0.3 && bm25Results.tools.length > 0) {
    // Some lexical overlap - blend both result sets
    return mergeAndRank(bm25Results.tools, vectorResults, limit);
  }

  // Pure vector results (multilingual query or no lexical match)
  return vectorResults;
}
```

### 4.2 BM25 Lexical Search (Fast Path - Same Language Only)

For lexical matching, we use **BM25** (Best Matching 25) - a probabilistic ranking function that:

- Scores tools based on **term frequency** with saturation (extra repeats help less)
- Normalizes for **document length** (longer descriptions aren't unfairly favored)
- Weights terms by **inverse document frequency** (rare terms like "pexels" rank higher than common ones like "get")

This allows natural language queries like "find hero image" to match tools containing those terms, ranked by relevance.

> **⚠️ Limitation: BM25 is NOT multilingual.**
>
> BM25 matches **tokens/words lexically**. If tools are documented in English but the user queries in Polish ("znajdź zdjęcie bohatera"), BM25 won't find matches because the tokens don't overlap.
>
> **Multilingual queries automatically fall back to vector search** (see 4.3), where embedding models like `text-embedding-3-small` understand that "znajdź zdjęcie" ≈ "find image" semantically.
>
> The confidence threshold handles this gracefully:
> - English query → BM25 high confidence → fast path ✓
> - Polish query → BM25 low/zero confidence → vector fallback ✓

```typescript
// server/tools/discovery/bm25-search.ts

import BM25 from "wink-bm25-text-search";

interface ToolDocument {
  name: string;
  description: string;
  category: string;
  hypotheticalQueries: string[];
  usageHint: string;
}

// BM25 search engine instance
let bm25Engine: ReturnType<typeof BM25> | null = null;
let toolDocuments: Map<string, ToolDocument> = new Map();

/**
 * Initialize BM25 index with tool metadata
 * Called once at startup
 */
export function initBM25Index(tools: ToolDocument[]) {
  bm25Engine = BM25();

  // Configure BM25 parameters
  // k1: term frequency saturation (1.2-2.0 typical)
  // b: document length normalization (0.75 typical)
  bm25Engine.defineConfig({ fldWeights: { name: 2, content: 1 } });

  // Define pipeline: tokenize → lowercase → remove stop words → stem
  bm25Engine.definePrepTasks([
    (text: string) => text.toLowerCase(),
    (text: string) => text.split(/\W+/).filter(t => t.length > 1),
    // Optional: add stemming with wink-porter2-stemmer
  ]);

  // Index each tool
  for (const tool of tools) {
    // Create rich searchable content from all tool metadata
    const searchableContent = [
      tool.name,
      tool.description,
      ...tool.hypotheticalQueries,
      tool.usageHint,
      tool.category,
    ].join(" ");

    bm25Engine.addDoc({ name: tool.name, content: searchableContent }, tool.name);
    toolDocuments.set(tool.name, tool);
  }

  // Consolidate index for searching
  bm25Engine.consolidate();
}

interface BM25SearchResult {
  tools: ToolSearchResult[];
  confidence: number;
}

/**
 * Natural language BM25 search
 * Query like "find hero image" is tokenized and scored against tool index
 */
export function bm25Search(query: string, limit: number = 5): BM25SearchResult {
  if (!bm25Engine) {
    throw new Error("BM25 index not initialized. Call initBM25Index first.");
  }

  // BM25 search returns ranked results: [{ ref: toolName, score: number }, ...]
  const results = bm25Engine.search(query, limit);

  if (results.length === 0) {
    return { tools: [], confidence: 0 };
  }

  // Map results to full tool metadata
  const tools: ToolSearchResult[] = results.map((result: { ref: string; score: number }) => {
    const tool = toolDocuments.get(result.ref)!;
    return {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      usageHint: tool.usageHint,
      score: result.score,
    };
  });

  // Confidence based on top score (BM25 scores vary, normalize roughly)
  // Scores > 5 are typically strong matches
  const topScore = results[0]?.score || 0;
  const confidence = Math.min(topScore / 10, 1); // Normalize to 0-1

  return { tools, confidence };
}
```

**Why BM25 over simple substring matching?**

| Query | Substring Match | BM25 |
|-------|-----------------|------|
| "find hero image" | Only matches if exact phrase exists | Matches tools with "find", "hero", OR "image", ranked by relevance |
| "upload photo" | Misses tools with "image" | Matches "image" tools (semantic overlap via hypotheticalQueries) |
| "pexels stock" | Matches if "pexels" substring found | "pexels" ranked higher (rare term = high IDF) |

**BM25 Scoring Formula (simplified):**

```
score(D, Q) = Σ IDF(qi) × (f(qi, D) × (k1 + 1)) / (f(qi, D) + k1 × (1 - b + b × |D|/avgDL))

Where:
- IDF(qi) = inverse document frequency of query term (rare terms score higher)
- f(qi, D) = frequency of term in document
- k1 = term frequency saturation parameter (typically 1.2-2.0)
- b = document length normalization (typically 0.75)
- |D| = document length
- avgDL = average document length in corpus
```

**Library options:**
- `wink-bm25-text-search` - Lightweight, pure JS, ~10KB
- `search-index` - Full-featured, supports persistence
- `elasticlunr` - Lunr.js with BM25 scoring

For 45-100 tools, `wink-bm25-text-search` is ideal - fast initialization, instant search, no external dependencies.

### 4.3 Vector Search (Semantic Path)

For complex or ambiguous queries, semantic search:

```typescript
// server/tools/discovery/vector-search.ts

import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

// Initialize with tool embeddings (computed at startup)
let toolIndex: VectorIndex;

export async function initToolIndex(tools: ToolMetadata[]) {
  toolIndex = new VectorIndex();

  for (const tool of tools) {
    // Create rich embedding text
    const embeddingText = [
      tool.name,
      tool.description,
      ...tool.hypotheticalQueries,
      tool.category,
    ].join(" ");

    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: embeddingText,
    });

    await toolIndex.add({
      id: tool.name,
      embedding,
      metadata: tool,
    });
  }
}

export async function vectorSearch(
  query: string,
  limit: number
): Promise<ToolSearchResult[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: query,
  });

  const results = await toolIndex.search(embedding, limit);

  return results.map(r => ({
    ...r.metadata,
    score: r.score,
  }));
}
```

---

## 5. Tool Index Design

### 5.1 Tool Metadata Structure

Each tool has rich metadata for better discovery:

```typescript
// server/tools/discovery/tool-index.ts

interface ToolMetadata {
  name: string;
  description: string;
  category: "pages" | "sections" | "images" | "posts" | "navigation" | "research" | "pexels" | "entries";

  // Rich metadata for better search
  hypotheticalQueries: string[];  // "create a new page", "add page to site"
  usageHint: string;              // "Returns page ID. Use with cms_addSectionToPage"
  relatedTools: string[];         // Tools often used together

  // Pre-computed embedding (optional, for vector search)
  embedding?: number[];
}

export const TOOL_INDEX: ToolMetadata[] = [
  // Pages
  {
    name: "cms_createPage",
    description: "Create a new CMS page with title and slug",
    category: "pages",
    hypotheticalQueries: [
      "create a new page",
      "add page to site",
      "make a new page",
      "I need a new page",
    ],
    usageHint: "Returns pageId. Follow with cms_addSectionToPage to add content.",
    relatedTools: ["cms_addSectionToPage", "cms_updatePage"],
  },
  {
    name: "cms_getPage",
    description: "Get page details by slug or ID",
    category: "pages",
    hypotheticalQueries: [
      "get page",
      "find page",
      "show page",
      "page details",
      "what's on the page",
    ],
    usageHint: "Use includeContent: true for full section content.",
    relatedTools: ["cms_listPages", "cms_getPageSections"],
  },

  // Sections
  {
    name: "cms_addSectionToPage",
    description: "Add a section template to a page",
    category: "sections",
    hypotheticalQueries: [
      "add section to page",
      "add hero section",
      "add content block",
      "put section on page",
    ],
    usageHint: "Need pageId + sectionDefId. Use cms_getSectionFields to see required fields.",
    relatedTools: ["cms_getSectionFields", "cms_updateSectionContent"],
  },

  // Images
  {
    name: "cms_searchImages",
    description: "Semantic search for images by description",
    category: "images",
    hypotheticalQueries: [
      "find image",
      "search image",
      "look for photo",
      "image of",
      "picture of",
    ],
    usageHint: "Semantic search. Scores closer to 0 = better match. Returns imageId.",
    relatedTools: ["cms_updateSectionImage", "cms_findImage"],
  },
  {
    name: "cms_updateSectionImage",
    description: "Attach an image to a section's image field",
    category: "images",
    hypotheticalQueries: [
      "add image to section",
      "attach image",
      "set section image",
      "update image",
    ],
    usageHint: "Need imageId, pageSectionId, and imageField name (get from cms_getSectionFields).",
    relatedTools: ["cms_searchImages", "cms_getSectionFields"],
  },

  // ... more tools
];
```

### 5.2 Category Extraction

For workflow prompt coupling:

```typescript
// server/tools/discovery/workflow-coupling.ts

export function extractCategories(tools: ToolSearchResult[]): string[] {
  const categories = new Set<string>();

  for (const tool of tools) {
    categories.add(tool.category);
  }

  return Array.from(categories);
}
```

---

## 6. Prompt Coupling

### 6.1 The Key Innovation

When `tool_search` returns tools, it also returns relevant workflow guidance:

```typescript
// The tool returns both tools AND workflow hints
{
  tools: [
    { name: "cms_searchImages", hint: "Scores closer to 0 = better" },
    { name: "cms_updateSectionImage", hint: "Need imageId + pageSectionId" },
  ],
  workflowGuidance: `
**Image Workflow:**
1. ALWAYS check existing images first (cms_searchImages)
2. Only download from Pexels if no match exists
3. Image URLs are LOCAL paths: /uploads/images/...
4. Get section field name via cms_getSectionFields before updating
  `,
}
```

### 6.2 Workflow Hints by Category

```typescript
// server/tools/discovery/workflow-hints.ts

const WORKFLOW_HINTS: Record<string, string> = {
  pages: `
**Page Workflow:**
- Use cms_findResource for fuzzy page lookup
- After creating page, offer to add sections
- includeContent: true for full content, false for just IDs
`,

  sections: `
**Section Workflow:**
1. Check existing sections with cms_getPageSections BEFORE adding
2. Get field schema with cms_getSectionFields
3. cms_updateSectionContent MERGES (doesn't replace) content
4. Link format: { href: "/path", type: "url" | "page" }
`,

  images: `
**Image Workflow:**
1. ALWAYS check existing with cms_searchImages first
2. Semantic scores: closer to 0 = better match
3. Only download from Pexels if no existing match
4. Image URLs are LOCAL: /uploads/images/...
5. Get section field name before cms_updateSectionImage
`,

  posts: `
**Post Workflow:**
- Posts have status: draft → published → archived
- cms_publishPost requires confirmation
- Use cms_listPosts with status filter
`,

  navigation: `
**Navigation Workflow:**
- Locations: "header" or "footer"
- Link types: "url" (external) or "page" (internal)
- Check navigation exists before adding items
`,

  research: `
**Research Workflow:**
- webQuickSearchTool for simple lookups
- webDeepResearchTool for comprehensive research
- Always cite sources in response
`,
};

export function getWorkflowPromptsForCategories(categories: string[]): string {
  const hints = categories
    .filter(cat => WORKFLOW_HINTS[cat])
    .map(cat => WORKFLOW_HINTS[cat])
    .join("\n");

  return hints || "No specific workflow guidance for these tools.";
}
```

### 6.3 Why Coupling Matters

| Without Coupling | With Coupling |
|------------------|---------------|
| Agent gets tools, no context | Agent gets tools + how to use them |
| "Here's cms_searchImages" | "Use cms_searchImages. Scores closer to 0 = better." |
| May misuse tool | Follows best practices |
| Needs full prompt pre-loaded | Minimal prompt, guidance on-demand |

---

## 7. Implementation Guide

### 7.1 File Structure

```
server/
├── tools/
│   ├── discovery/
│   │   ├── tool-search.ts      # The single discovery tool
│   │   ├── smart-search.ts     # Hybrid keyword/vector search
│   │   ├── keyword-search.ts   # Fast keyword matching
│   │   ├── vector-search.ts    # Semantic vector search
│   │   ├── tool-index.ts       # Tool metadata index
│   │   └── workflow-coupling.ts # Workflow hints by category
│   └── all-tools.ts            # Updated to export only tool_search initially
├── prompts/
│   └── core/
│       └── minimal-agent.xml   # ~300 token minimal prompt
└── agent/
    └── cms-agent.ts            # Updated agent configuration
```

### 7.2 Agent Configuration

```typescript
// server/agent/cms-agent.ts

import { ToolLoopAgent, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { toolSearchTool } from "../tools/discovery/tool-search";
import { ALL_CMS_TOOLS } from "../tools/all-tools";
import { getMinimalSystemPrompt } from "./minimal-prompt";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const AGENT_CONFIG = {
  maxSteps: 15,
  modelId: "openai/gpt-4o-mini",
  maxOutputTokens: 4096,
} as const;

export const AgentCallOptionsSchema = z.object({
  sessionId: z.string(),
  traceId: z.string(),
  workingMemory: z.string().optional(),
  cmsTarget: z.object({
    siteId: z.string(),
    environmentId: z.string(),
  }),
  db: z.custom<any>(),
  services: z.custom<any>(),
  sessionService: z.custom<any>(),
  vectorIndex: z.custom<any>(),
  logger: z.custom<any>(),
  stream: z.custom<any>().optional(),
});

const hasFinalAnswer = ({ steps }: { steps: any[] }) => {
  const lastStep = steps[steps.length - 1];
  return lastStep?.text?.includes("FINAL_ANSWER:") || false;
};

// Track discovered tools per session
const discoveredToolsCache = new Map<string, Set<string>>();

export const cmsAgent = new ToolLoopAgent({
  model: openrouter.languageModel(AGENT_CONFIG.modelId),
  instructions: "Dynamic - see prepareCall",
  tools: {
    tool_search: toolSearchTool,
    ...ALL_CMS_TOOLS, // All tools registered, filtered via activeTools
  },
  callOptionsSchema: AgentCallOptionsSchema,

  prepareCall: ({ options, ...settings }) => {
    // Start with minimal prompt + only tool_search
    const minimalPrompt = getMinimalSystemPrompt({
      currentDate: new Date().toISOString().split("T")[0],
      workingMemory: options.workingMemory || "",
    });

    // Initialize discovered tools cache for this session
    if (!discoveredToolsCache.has(options.sessionId)) {
      discoveredToolsCache.set(options.sessionId, new Set());
    }

    return {
      ...settings,
      instructions: minimalPrompt,
      activeTools: ["tool_search"], // Only discovery tool initially
      maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
      experimental_context: {
        db: options.db,
        services: options.services,
        sessionService: options.sessionService,
        vectorIndex: options.vectorIndex,
        logger: options.logger,
        stream: options.stream,
        traceId: options.traceId,
        sessionId: options.sessionId,
        cmsTarget: options.cmsTarget,
        // Function to make discovered tools available
        enableTools: (toolNames: string[]) => {
          const cache = discoveredToolsCache.get(options.sessionId)!;
          toolNames.forEach(t => cache.add(t));
        },
      },
    };
  },

  prepareStep: async ({ stepNumber, steps, options }) => {
    // Get tools discovered via tool_search
    const discoveredTools = discoveredToolsCache.get(options.sessionId) || new Set();

    // Check if last step was a tool_search
    const lastStep = steps[steps.length - 1];
    if (lastStep?.toolCalls?.some(tc => tc.toolName === "tool_search")) {
      // Get newly discovered tools from the result
      const searchResult = lastStep.toolResults?.find(
        tr => tr.toolName === "tool_search"
      );
      if (searchResult?.result?.tools) {
        const newTools = searchResult.result.tools.map(t => t.name);
        newTools.forEach(t => discoveredTools.add(t));
      }
    }

    // Make discovered tools available for next step
    return {
      activeTools: ["tool_search", ...Array.from(discoveredTools)],
    };
  },

  stopWhen: [stepCountIs(AGENT_CONFIG.maxSteps), hasFinalAnswer],
});
```

### 7.3 Minimal System Prompt

```typescript
// server/agent/minimal-prompt.ts

import Handlebars from "handlebars";

const MINIMAL_TEMPLATE = `<agent>

<identity>
You are a CMS agent with tool discovery capabilities.
</identity>

<tool-discovery>
Use **tool_search** to find tools you need:
- Describe what you want to do in natural language
- You'll receive relevant tools + usage guidance
- Search again if you need more capabilities

If you can answer without CMS tools, respond directly.
</tool-discovery>

<react-pattern>
Think → Search for tools if needed → Act → Observe → Repeat
When complete: FINAL_ANSWER: [your response]
</react-pattern>

<working-memory>
{{{workingMemory}}}
</working-memory>

<context>
Current date: {{currentDate}}
</context>

</agent>`;

const compiledTemplate = Handlebars.compile(MINIMAL_TEMPLATE);

export interface MinimalPromptContext {
  currentDate: string;
  workingMemory?: string;
}

export function getMinimalSystemPrompt(context: MinimalPromptContext): string {
  return compiledTemplate({
    ...context,
    workingMemory: context.workingMemory || "",
  });
}
```

---

## 8. Token Analysis

### 8.1 Before vs After Comparison

| Scenario | V1 (All Tools) | V2 Type A | V2 Type B | V2 Type C |
|----------|----------------|-----------|-----------|-----------|
| System prompt | ~10,000 | ~300 | ~300 + hints | ~300 + hints |
| Tool definitions | ~9,000 | ~200 | ~600 | ~1,500 |
| **Total overhead** | **~19,000** | **~500** | **~900** | **~1,800** |
| **Savings** | baseline | **97%** | **95%** | **91%** |

### 8.2 Per-Request Breakdown

**Type A: "What is a CMS section?"**
```
Initial: ~300 (minimal prompt) + ~200 (tool_search def) = 500 tokens
Agent answers directly without calling tool_search
Total: ~500 tokens
```

**Type B: "Find the hero image"**
```
Initial: ~500 tokens
tool_search({ query: "find image" }) → 2 tools + hints (~400 tokens)
Total: ~900 tokens
```

**Type C: "Create about page with hero section and mountain image"**
```
Initial: ~500 tokens
tool_search({ query: "create page" }) → 3 tools + hints (~500 tokens)
tool_search({ query: "add section image" }) → 4 tools + hints (~600 tokens)
Total: ~1,600 tokens
```

### 8.3 Cost Comparison (10k requests/day, GPT-4o-mini)

| Scenario Distribution | V1 Cost | V2 Cost | Monthly Savings |
|-----------------------|---------|---------|-----------------|
| 60% Type A, 30% Type B, 10% Type C | $40.50 | $4.50 | **$36/month** |
| 30% Type A, 50% Type B, 20% Type C | $40.50 | $7.50 | **$33/month** |
| 10% Type A, 40% Type B, 50% Type C | $40.50 | $12.00 | **$28.50/month** |

---

## 9. Scaling Considerations

### 9.1 Why This Scales to 100+ Tools

| Tool Count | What Changes | Agent Experience |
|------------|--------------|------------------|
| 45 (current) | Mostly keyword search | `tool_search` → tools |
| 100 | Balanced keyword/vector | `tool_search` → tools |
| 200 | More vector search | `tool_search` → tools |
| 500+ | Pure vector + query decomposition | `tool_search` → tools |

**The agent's interface never changes.** Only the backend adapts.

### 9.2 Backend Scaling Strategy

```typescript
// As tool count grows, backend strategy shifts

async function smartToolSearch(query: string, toolCount: number) {
  if (toolCount < 100) {
    // Keyword-first strategy (fast, simple)
    const keyword = keywordSearch(query);
    if (keyword.confidence > 0.7) return keyword.tools;
    return vectorSearch(query);
  }

  if (toolCount < 500) {
    // Balanced strategy
    const [keyword, vector] = await Promise.all([
      keywordSearch(query),
      vectorSearch(query),
    ]);
    return mergeAndRank(keyword.tools, vector);
  }

  // 500+ tools: Vector-first with query decomposition
  const subQueries = decomposeQuery(query);
  const results = await Promise.all(
    subQueries.map(q => vectorSearch(q))
  );
  return mergeAndRank(...results);
}
```

### 9.3 Future Enhancements (When Needed)

1. **Tool2Vec Embeddings**: Train embeddings on actual usage patterns (need query logs first)
2. **Query Decomposition**: Break complex queries into sub-queries for better retrieval
3. **Tool Relationships**: Graph-based discovery for "tools used together"
4. **Confidence Scoring**: Return confidence with results, let agent decide to search more

---

## 10. Migration from V1

### 10.1 Gradual Migration Path

**Phase 1: Add Discovery Tool (Non-Breaking)**
1. Create `server/tools/discovery/` directory
2. Implement `tool_search` tool
3. Add to existing tools (doesn't affect current behavior)

**Phase 2: Implement Smart Backend**
1. Create `tool-index.ts` with all tool metadata
2. Implement keyword search
3. Implement vector search (optional, can start with keyword-only)
4. Test discovery accuracy

**Phase 3: Switch Agent to Discovery Mode**
1. Create `minimal-agent.xml` prompt
2. Update `prepareCall` to start with only `tool_search`
3. Update `prepareStep` to enable discovered tools
4. A/B test against V1

**Phase 4: Remove V1 Code**
1. Remove category-based routing
2. Remove full prompt loading
3. Monitor and tune

### 10.2 Rollback Strategy

Keep V1 code behind a feature flag:

```typescript
const USE_V2_DISCOVERY = process.env.USE_V2_DISCOVERY === "true";

prepareCall: ({ options, ...settings }) => {
  if (USE_V2_DISCOVERY) {
    return v2PrepareCall({ options, ...settings });
  }
  return v1PrepareCall({ options, ...settings });
}
```

### 10.3 Testing Strategy

```typescript
// Test discovery accuracy
describe("tool_search", () => {
  const testCases = [
    { query: "find hero image", expectedTools: ["cms_searchImages", "cms_findImage"] },
    { query: "create page with sections", expectedTools: ["cms_createPage", "cms_addSectionToPage"] },
    { query: "Znajdź zdjęcie" /* Polish */, expectedTools: ["cms_searchImages"] },
  ];

  for (const { query, expectedTools } of testCases) {
    it(`returns correct tools for: ${query}`, async () => {
      const result = await toolSearchTool.execute({ query, limit: 5 });
      const returnedNames = result.tools.map(t => t.name);

      for (const expected of expectedTools) {
        expect(returnedNames).toContain(expected);
      }
    });
  }
});
```

---

## 11. Sources

### Research Papers

1. **"Less is More: Optimizing Function Calling for LLM Execution on Edge Devices"** (Nov 2024)
   - https://arxiv.org/abs/2411.15399
   - Key finding: Fewer tools = better accuracy + 70% latency reduction

2. **Tool2Vec: "Efficient and Scalable Estimation of Tool Representations in Vector Space"** (Sept 2024)
   - https://arxiv.org/abs/2409.02141
   - Usage-based embeddings outperform description-based

3. **Tool-to-Agent Retrieval** (Nov 2025)
   - https://arxiv.org/abs/2511.01854
   - Graph-based tool discovery for 1000+ tools

### Engineering Resources

4. **Anthropic Tool Search Tool** (Nov 2025)
   - https://www.anthropic.com/engineering/advanced-tool-use
   - Deferred tool loading pattern (inspiration for this architecture)

5. **Context Rot: Impact of Input Tokens** (2025)
   - https://research.trychroma.com/context-rot
   - Why less context = better performance

### AI SDK Documentation

6. **Vercel AI SDK v6 - activeTools**
   - Native tool filtering support

7. **Vercel AI SDK v6 - prepareStep**
   - Per-step tool modification

---

## Conclusion

V2's single discovery tool architecture provides:

1. **Massive token reduction**: 84-97% savings vs loading all tools
2. **Native multilingual support**: LLM understands any language
3. **Infinite scalability**: Backend adapts, agent interface never changes
4. **Simpler agent logic**: One binary decision (need tools or not?)
5. **Coupled guidance**: Tools + workflow hints delivered together
6. **Self-correcting**: Agent searches again if needed

The key insight: **Let the agent decide what it needs.** Don't pre-classify. The agent's first action IS the classification.

**Start with keyword search → Add vector search when needed → Scale to 1000+ tools without changing agent code.**
