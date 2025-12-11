# Prompt System Refactor Plan

> Streamline prompt format, structure, file format, and folder organization based on research findings.

## Problem Statement

Current state has scattered concerns across multiple formats and locations:

### Current Weaknesses

| Issue | Location | Problem |
|-------|----------|---------|
| **Mixed formats** | `agent.xml`, `.json`, `.ts` | No consistent format - XML for agent, JSON for instructions, TS for tools |
| **Descriptions in code** | `server/tools/atomic/*.ts` | Tool descriptions embedded as strings in TypeScript |
| **Metadata in code** | `server/tools/discovery/tool-index.ts` | 900+ line TS file with phrases, relations, extraction config |
| **Instructions in JSON** | `server/tools/instructions/tool-instructions.json` | Good hot-reload but no type safety, separate from related metadata |
| **Duplicate instructions** | `server/tools/instructions/index.ts` | Static fallback duplicates JSON content |
| **Guidance split** | `server/tools/guidance/tool-guidance.json` | Another JSON file with abbreviated instructions |
| **Prompts buried in code** | `server/agent/system-prompt.ts` | Prompt loading logic mixed with Handlebars processing |
| **Monolithic tool files** | `server/tools/atomic/*.ts` | Multiple tools per file, descriptions + schema + execute mixed |

### Current Directory Structure
```
server/
├── prompts/
│   └── core/
│       └── agent.xml                    # Single agent prompt
├── tools/
│   ├── atomic/                          # Multiple tools per file
│   │   ├── page-tools.ts                # getPage, createPage, updatePage, deletePage
│   │   ├── section-tools.ts             # 5 tools in one file
│   │   └── ...
│   ├── discovery/
│   │   ├── tool-index.ts                # 900+ lines of metadata
│   │   ├── bm25-search.ts
│   │   ├── vector-search.ts
│   │   └── ...
│   ├── instructions/
│   │   ├── tool-instructions.json       # BEFORE/AFTER/NEXT/GOTCHA
│   │   └── index.ts                     # Loader
│   └── guidance/
│       └── tool-guidance.json           # Abbreviated guidance
└── agent/
    ├── cms-agent.ts
    └── system-prompt.ts
```

### Current Tool Metadata Structure (ToolMetadata type)
```typescript
interface ToolMetadata {
  name: string;
  phrases: string[];           // BM25 search phrases
  relatedTools: string[];      // Often used together
  riskLevel: "safe" | "moderate" | "destructive";
  requiresConfirmation: boolean;
  extraction: {                // Working memory extraction
    path: string;              // "items", "$root", etc.
    type: string;              // "page", "post", "image"
    nameField: string;         // "name", "title", "filename"
    idField?: string;
    isArray?: boolean;
  } | null;
}
```

---

## Target Architecture

Based on research conclusions from `PROMPT_FORMAT_RESEARCH.md`:
- **XML shell** for structure with **Markdown inside** for content
- **Prompts as data** in `.md` files with XML shell + Markdown inside
- **Per-tool folder structure** - each tool has its own folder
- **Separation of concerns**: prompt text / metadata / code in separate files
- **TypeScript** only for loading, validation, and type generation

### Target Directory Structure

```
server/
├── prompts/                             # ALL prompt text files
│   ├── agent/
│   │   └── main-agent-prompt.md         # Main agent prompt (XML shell + MD)
│   │
│   ├── tools/                           # Tool guidance prompts (optional, only for gotchas)
│   │   ├── getPage-prompt.md            # Only if tool has non-obvious behavior
│   │   └── ...
│   │
│   ├── workflows/                       # Future: multi-step workflow prompts
│   │   └── (empty for now)
│   │
│   └── _index.ts                        # Prompt loader with hot-reload
│
├── tools/
│   ├── getPage/                         # Per-tool folder
│   │   ├── getPage-metadata.ts          # Phrases, relations, extraction (typed)
│   │   └── getPage-tool.ts              # Schema + execute in one file
│   │
│   ├── createPage/
│   │   ├── createPage-metadata.ts
│   │   └── createPage-tool.ts
│   │
│   ├── updatePage/
│   │   └── ...
│   │
│   ├── deletePage/
│   │   └── ...
│   │
│   ├── toolSearch/                      # Tool search tool (uses services/tool-search)
│   │   ├── toolSearch-metadata.ts
│   │   └── toolSearch-tool.ts
│   │
│   ├── _types/                          # Shared types
│   │   ├── agent-context.ts
│   │   ├── metadata.ts
│   │   └── _index.ts
│   │
│   ├── _loaders/                        # Loading utilities
│   │   ├── prompt-loader.ts             # *-prompt.md loader
│   │   └── tool-assembler.ts            # Merges metadata + tool + prompt
│   │
│   └── _index.ts                        # ALL_TOOLS export
│
└── agent/
    ├── cms-agent.ts                     # Slimmed agent config
    └── system-prompt.ts                 # Uses prompts/_index.ts
```

---

## Per-Tool File Formats

### 1. {toolName}-metadata.ts - Tool Metadata (Typed)

Location: `server/tools/{toolName}/{toolName}-metadata.ts`

```typescript
// server/tools/getPage/getPage-metadata.ts
import { defineToolMetadata } from '../_types/metadata'

export default defineToolMetadata({
  name: 'getPage',
  description: 'Get page(s). By id, slug, or all. Default lightweight; includeContent for full sections.',

  // BM25 search phrases for discovery
  phrases: [
    'get page',
    'find page',
    'show page',
    'fetch page',
    'read page',
    'page details',
    'page content',
    'page info',
    'view page',
    'list pages',
    'show pages',
    'all pages',
  ],

  // Risk and confirmation
  risk: 'safe',
  requiresConfirmation: false,

  // Related tools (auto-included when this tool is discovered)
  relatedTools: ['getSection', 'updateSection'],

  // Working memory extraction config
  extraction: {
    path: 'items',
    type: 'page',
    nameField: 'name',
    idField: 'id',
    isArray: true,
  },
})
```

### 2. Tool Guidance Prompt (Optional)

Location: `server/prompts/tools/{toolName}-prompt.md`

**Only info the agent can't infer from schema + description.** Bullet points only. Skip entirely for simple tools.

```markdown
<!-- server/prompts/tools/getPage-prompt.md -->

<getPage>
- Default lightweight (no content) - use `getSection` for single section
- `includeContent: true` is expensive, avoid unless needed
</getPage>
```

**Include:**
- Gotchas, common mistakes
- Performance warnings
- Non-obvious workflows

**Skip if:** Schema + description tell the full story

### 3. {toolName}-tool.ts - Schema + Execute

Single file with schema and execute function together:

```typescript
// server/tools/getPage/getPage-tool.ts
import { z } from 'zod'
import type { AgentContext } from '../_types'

// Schema
export const schema = z.object({
  id: z.string().uuid().optional().describe('Get by UUID'),
  slug: z.string().optional().describe('Get by slug'),
  all: z.boolean().optional().describe('Get all pages'),
  parentId: z.string().uuid().optional().describe('Filter by parent page'),
  includeChildren: z.boolean().optional().describe('Include child pages'),
  includeContent: z.boolean().optional().default(false)
    .describe('Include full section content (expensive)'),
  localeCode: z.string().optional().default('en').describe('Locale code'),
}).refine(
  data => data.id || data.slug || data.all || data.parentId,
  { message: 'Provide id, slug, parentId, or set all: true' }
)

export type Input = z.infer<typeof schema>

// Execute
export async function execute(input: Input, ctx: AgentContext) {
  if (input.id) {
    const page = await ctx.services.pageService.getPageById(input.id)
    if (!page) {
      return { success: false, count: 0, items: [], error: `Page not found: ${input.id}` }
    }

    if (input.includeContent) {
      const fullPage = await ctx.services.pageService.getPageBySlug(
        page.slug, true, input.localeCode || 'en'
      )
      return { success: true, count: 1, items: [formatPageFull(fullPage)] }
    }

    return { success: true, count: 1, items: [formatPageLight(page)] }
  }

  if (input.slug) {
    // ... implementation
  }

  if (input.all || input.parentId !== undefined) {
    // ... implementation
  }

  return { success: false, count: 0, items: [], error: 'Invalid input' }
}

// Helpers
function formatPageLight(page: any) { /* ... */ }
function formatPageFull(page: any) { /* ... */ }
```

---

## Agent Prompt Format

Main agent prompt using XML shell + Markdown inside:

```markdown
<!-- server/prompts/agent/main-agent-prompt.md -->

<agent>
  <identity>
    You are an autonomous AI assistant operating on the ReAct pattern.
    You think before acting, act precisely, observe results, and complete thoroughly.
  </identity>

  <reason-and-act>
    1. **THINK** - What does the user need?
       - General knowledge → answer directly
       - CMS data or actions → use tools
    2. **ACT** - One precise tool call with correct parameters
    3. **OBSERVE** - Did this complete the task? Need more actions?
    4. **REPEAT** - Until complete, then call finalAnswer
  </reason-and-act>

  <communication>
    - Generate text AND call tools in the same response - user sees text while tools execute
    - Never mention tool names to user - they see results, not implementation
    - Concise follow-ups: answer only what's asked, don't repeat previous response
  </communication>

  <verification>
    Tool results are facts. Chat history shows past, not present.

    When user questions an outcome:
    1. STOP - do NOT call final_answer yet
    2. CALL verification tool (getPost, getPage, etc.)
    3. OBSERVE fresh result
    4. THEN call final_answer with data from that result

    - **WRONG:** "I will check" (you didn't check!)
    - **RIGHT:** getPost → final_answer: "Yes, status is published"
  </verification>

  <rules>
    - **Language:** English by default, or user-specified. All responses and tool arguments in working language.
    - **References:** "this page" → check WORKING MEMORY for recent entities
    - **Efficiency:** Lightweight fetches by default. `includeContent: true` only when needed.
    - **Errors:** Try alternative approach. Use fuzzy matching tools if exact match fails.
    - **Pages vs Posts:** Never conflate. Pages use page tools, posts use post tools. When unsure, verify first.
    - **Image URLs:** Relative `/uploads/...` only. Never add domain prefix.
    - **Images before use:** Search available images first → if none fit, download from stock → then attach. Verify after update.
  </rules>

  <confirmations>
    When tool has `requiresConfirmation: true` (destructive/risky actions):
    1. Do NOT call the tool directly
    2. Call `finalAnswer` explaining what you're about to do and ask for confirmation
    3. Wait for user approval
    4. After user confirms → call the tool with `confirmed: true`

    Never skip confirmation for destructive actions (delete, bulk update, publish).
  </confirmations>

  <output-format>
    Response is rendered as markdown in chat UI. Choose format based on content type:

    **Plain text** (default for simple responses):
    - Yes/no answers, confirmations, short explanations
    - "Done. Page updated." not "## Result\n\nThe page has been updated successfully."

    **Structured markdown** (when presenting data):
    - Lists: bullet points for 3+ items
    - Tables: comparing multiple items with properties
    - Code blocks: for slugs, IDs, code snippets

    **Rich content** (when visual context helps):
    - Images: `![filename](url)` with description below
    - Links: `[title](url)` for pages/posts

    **Domain-specific formats:**

    *Single entity:*
    > **Page:** Home (`home`)
    > 3 sections, last updated 2024-01-15

    *List of entities:*
    - **Home** (`home`) - 3 sections
    - **About** (`about`) - 2 sections
    - **Contact** (`contact`) - 1 section

    *Images:*
    ![mountain-landscape.jpg](/uploads/images/2024/01/mountain-landscape.jpg)
    Mountain at sunset. Tags: nature, landscape, outdoor

    *Confirmations:*
    Done. Section "hero" updated on page "home".

    *Errors:*
    Not found: page "xyz". Available: home, about, contact.

    **Token efficiency:**
    - Omit filler ("I found..." → just show results)
    - No headers for single-item responses
    - Skip empty fields
  </output-format>

  <examples>
    <example_list_pages>
      User: "What pages exist?"
      → getPage `{ all: true }`
      → Returns: `{ success: true, count: 3, items: [{ id, name, slug, sectionCount }, ...] }`
      → Response:
      - **Home** (`home`)
      - **About** (`about`)
      - **Contact** (`contact`)
    </example_list_pages>

    <example_update_section>
      User: "Change the hero title on home page to Welcome"
      → getPage `{ slug: "home" }` → get pageId
      → getPageSections `{ pageId: "..." }` → find hero pageSectionId
      → updateSectionContent `{ pageSectionId: "...", content: { title: "Welcome" } }`
      → Returns: `{ success: true }`
      → Response: Done. Hero title updated to "Welcome".
    </example_update_section>

    <example_destructive_action>
      User: "Delete the about page"
      → getPage `{ slug: "about" }` → get page ID
      → deletePage `{ ids: ["page-id"] }` (without confirmed)
      → Returns: `{ requiresConfirmation: true, pages: [{ name: "About", slug: "about" }] }`
      → Response: Delete page "About" (`about`)? This cannot be undone.
      User: "Yes"
      → deletePage `{ ids: ["page-id"], confirmed: true }`
      → Returns: `{ success: true, deleted: 1 }`
      → Response: Done. Page "about" deleted.
    </example_destructive_action>

    <example_search_images>
      User: "Find images of mountains"
      → searchImages `{ query: "mountain landscape nature outdoor" }`
      → Returns: `{ success: true, count: 2, images: [{ id, filename, url, description }, ...] }`
      → Response:
      ![hero-mountain.jpg](/uploads/images/2024/01/hero-mountain.jpg)
      Mountain landscape at sunset

      ![alpine-view.jpg](/uploads/images/2024/01/alpine-view.jpg)
      Alpine peaks with snow
    </example_search_images>

    <example_response_style>
      User: "Rename the about page to Our Story"
      → getPage `{ slug: "about" }` → `{ id: "page-123", name: "About", ... }`
      → updatePage `{ id: "page-123", name: "Our Story" }`
      → Returns: `{ success: true, items: [{ id, name, slug }] }`
      BAD: "I have successfully updated the page. The about page now has the name 'Our Story'."
      GOOD: Done. Page "about" renamed to "Our Story".
    </example_response_style>

    <example_not_found>
      User: "Show me the pricing page"
      → getPage `{ slug: "pricing" }`
      → Returns: `{ success: false, count: 0, items: [], error: "Page not found: pricing" }`
      → Response: Page "pricing" not found. Available: home, about, contact.
    </example_not_found>
  </examples>

  <working-memory>
    {{{workingMemory}}}
  </working-memory>

  <current-datetime>{{currentDate}}</current-datetime>

  <tools>
    Check available tools below first. Only use `toolSearch` for capabilities not listed.

    **Searching for tools:**
    - Use keywords not narrative: `list image hero section update attach`
    - Include 8+ specific keywords: entity, action, content type, locale, status
    - If first search fails, iterate with varied keywords until you find the right tool

    **Calling tools:**
    - Follow tool schema exactly
    - Review tool guidance below before calling

    {{{activeProtocols}}}
  </tools>
</agent>
```

---

## Tool Assembly & Tool Prompt Injection

### Current Flow (tool-instructions.json)

Currently, tool prompts flow like this:
1. `tool-instructions.json` contains BEFORE/AFTER/NEXT/GOTCHA per tool
2. `getToolInstructions(toolNames)` wraps each in XML tags: `<tool_name>...</tool_name>`
3. `prepareStep` in `cms-agent.ts` calls `getToolInstructions(activeTools)`
4. Result replaces `{{{activeProtocols}}}` in agent prompt's `<tool-usage-instructions>` section

### Target Flow (per-tool .md files)

After refactor, tool prompts flow from `.md` files:
1. `prompts/tools/{toolName}-prompt.md` contains tool-specific prompt (optional)
2. `_loaders/tool-prompt-loader.ts` loads and caches tool prompts
3. `getToolPrompts(toolNames)` returns combined XML-wrapped prompts
4. `prepareStep` injects into `{{{activeProtocols}}}` placeholder

### _loaders/tool-prompt-loader.ts

```typescript
// server/tools/_loaders/tool-prompt-loader.ts
import fs from 'node:fs'
import path from 'node:path'

const isDev = process.env.NODE_ENV !== 'production'
const toolPromptCache = new Map<string, string | null>()

/**
 * Load tool prompt for a tool (hot-reload in dev)
 */
export function loadToolPrompt(toolName: string): string | null {
  // Dev mode: always read fresh from disk
  if (isDev) {
    return readToolPromptFile(toolName)
  }

  // Production: use cache
  if (!toolPromptCache.has(toolName)) {
    toolPromptCache.set(toolName, readToolPromptFile(toolName))
  }
  return toolPromptCache.get(toolName) || null
}

function readToolPromptFile(toolName: string): string | null {
  const promptPath = path.join(
    __dirname, '../../prompts/tools', `${toolName}-prompt.md`
  )

  if (!fs.existsSync(promptPath)) {
    return null  // No prompt for this tool (schema + description are sufficient)
  }

  return fs.readFileSync(promptPath, 'utf-8')
}

/**
 * Get prompts for multiple tools, formatted for system prompt injection
 * Returns XML-wrapped prompts for each tool that has one
 */
export function getToolPrompts(toolNames: string[]): string {
  return toolNames
    .map(name => {
      const prompt = loadToolPrompt(name)
      if (!prompt) return null
      // Prompt file already has <toolName>...</toolName> wrapper
      return prompt.trim()
    })
    .filter(Boolean)
    .join('\n\n')
}
```

### _loaders/tool-assembler.ts

```typescript
// server/tools/_loaders/tool-assembler.ts
import { tool } from 'ai'
import type { ToolMetadata } from '../_types/metadata'

interface ToolFiles {
  metadata: ToolMetadata
  schema: any
  execute: Function
}

export function assembleTool(toolName: string, files: ToolFiles) {
  return tool({
    description: files.metadata.description,
    inputSchema: files.schema,
    execute: async (input, { experimental_context }) => {
      return files.execute(input, experimental_context)
    }
  })
}

// Load all tools from per-tool folders
export async function loadAllTools() {
  const toolFolders = await getToolFolders()
  const tools: Record<string, any> = {}

  for (const folder of toolFolders) {
    const { default: metadata } = await import(`../${folder}/${folder}-metadata`)
    const { schema, execute } = await import(`../${folder}/${folder}-tool`)

    tools[metadata.name] = assembleTool(metadata.name, {
      metadata,
      schema,
      execute,
    })
  }

  return tools
}
```

### Update cms-agent.ts prepareStep

```typescript
// In prepareStep:
import { getToolPrompts } from '../tools/_loaders/tool-prompt-loader'

// Replace getToolInstructions with getToolPrompts
const toolsNeedingPrompts = [...new Set([...coreTools, ...discoveredTools])]
const toolPrompts = getToolPrompts(toolsNeedingPrompts)

// Inject into system prompt
const updatedContent = toolPrompts
  ? currentBaseSystemPrompt.replace(
      /<tool-usage-instructions>[\s\S]*?<\/tool-usage-instructions>/g,
      `<tool-usage-instructions>\n${toolPrompts}\n</tool-usage-instructions>`
    )
  : currentBaseSystemPrompt
```

### Tool Prompt Format

Each tool prompt file is self-contained with XML wrapper:

```markdown
<!-- server/prompts/tools/cms_createPost-prompt.md -->

<cms_createPost>
BEFORE: cms_listPosts to check for duplicate titles
AFTER: Ask if user wants cover image; ask if ready to publish
NEXT: pexels_searchPhotos (cover image), cms_publishPost
GOTCHA: Creates DRAFT only. Set BOTH featuredImage AND content.cover for covers.
</cms_createPost>
```

**Note:** Only create tool prompt files for tools with non-obvious behavior. Most tools only need schema + description.

---

## Implementation Phases

### Phase 1: Prompt Format Migration

**Goal:** Move agent prompt to `.md` with hot-reload

1. Create `server/prompts/agent/main-agent-prompt.md`
2. Create `server/prompts/tools/` (for tool guidance prompts)
3. Create `server/prompts/workflows/` (empty, future)
4. Create `server/prompts/_index.ts` (loader)
5. Update `server/agent/system-prompt.ts`
6. Delete `server/prompts/core/agent.xml`

**Files:**
```
server/prompts/
├── agent/
│   └── main-agent-prompt.md     # NEW
├── tools/                       # NEW (tool guidance prompts)
├── workflows/                   # NEW (empty)
└── _index.ts                    # NEW
```

---

### Phase 2: Tool Infrastructure Setup

**Goal:** Create shared infrastructure for per-tool structure

1. Create `server/tools/_types/` with shared types
2. Create `server/tools/_loaders/` with assembler
3. Create `server/services/tool-search/` with search implementations (see Phase 2)

**Files:**
```
server/tools/
├── _types/
│   ├── agent-context.ts         # NEW (move from types.ts)
│   ├── metadata.ts              # NEW (ToolMetadata schema + defineToolMetadata helper)
│   └── _index.ts                # NEW
└── _loaders/
    ├── prompt-loader.ts         # NEW (generic prompt file loader)
    ├── tool-prompt-loader.ts    # NEW (tool prompts → activeProtocols injection)
    └── tool-assembler.ts        # NEW (merge metadata + schema + execute)

server/services/tool-search/     # See Phase 2 for full structure
├── bm25-search.ts               # MOVE from tools/discovery/
├── vector-search.ts             # MOVE from tools/discovery/
└── ...
```

---

### Phase 3: Migrate First Tool Group (Pages)

**Goal:** Convert page tools to per-tool structure

1. Create `server/tools/getPage/` folder
2. Extract metadata from `tool-index.ts` → `getPage-metadata.ts`
3. Extract schema + execute from `page-tools.ts` → `getPage-tool.ts`
4. (Optional) Create `prompts/tools/getPage-prompt.md` if gotchas exist
5. Repeat for createPage, updatePage, deletePage

**Files per tool:**
```
server/tools/getPage/
├── getPage-metadata.ts         # NEW (typed)
└── getPage-tool.ts             # NEW (schema + execute)

server/prompts/tools/
└── getPage-prompt.md           # Optional (only if gotchas)
```

---

### Phase 4: Migrate Remaining Tools

**Goal:** Convert all tools to per-tool structure

Tools to migrate (24 total):
- **Sections:** getSectionTemplate, getSection, createSection, updateSection, deleteSection
- **Posts:** getPost, createPost, updatePost, deletePost
- **Images:** getImage, updateImage, deleteImage
- **Navigation:** getNavItem, createNavItem, updateNavItem, deleteNavItem
- **Entries:** getEntry, createEntry, updateEntry, deleteEntry
- **Core:** toolSearch, finalAnswer, acknowledge
- **Web:** webQuickSearch, webDeepSearch, webFetchContent
- **Stock:** pexelsSearch, pexelsDownload, unsplashSearch, unsplashDownload

---

### Phase 5: Cleanup

**Goal:** Remove old scattered files

1. Delete `server/tools/atomic/` (migrated)
2. Delete `server/tools/discovery/tool-index.ts` (migrated)
3. Delete `server/tools/instructions/` (migrated)
4. Delete `server/tools/guidance/` (migrated)
5. Delete `server/tools/all-tools.ts` (replaced by `_index.ts`)
6. Update `server/agent/cms-agent.ts` imports

---

## Migration Checklist Per Tool

For each tool:

- [ ] Create `server/tools/{toolName}/`
- [ ] Create `{toolName}-metadata.ts` from `tool-index.ts`
- [ ] Create `{toolName}-tool.ts` (schema + execute) from `atomic/*.ts`
- [ ] (Optional) Create `prompts/tools/{toolName}-prompt.md` if gotchas
- [ ] Add to `_index.ts`
- [ ] Test: `pnpm dev` → use tool
- [ ] Remove from old location

---

## File Mapping

### Files to Create

| New Location | Source |
|--------------|--------|
| `prompts/agent/main-agent-prompt.md` | `prompts/core/agent.xml` |
| `prompts/tools/{toolName}-prompt.md` | `tools/instructions/*.json` (optional, only gotchas) |
| `prompts/workflows/` | (empty, future) |
| `prompts/_index.ts` | New loader |
| `tools/_types/agent-context.ts` | `tools/types.ts` |
| `tools/_types/metadata.ts` | `tools/discovery/types.ts` |
| `tools/_loaders/prompt-loader.ts` | New |
| `tools/_loaders/tool-assembler.ts` | New |
| `services/tool-search/*.ts` | `tools/discovery/*.ts` (see Phase 2) |
| `tools/{toolName}/{toolName}-metadata.ts` | `tools/discovery/tool-index.ts` |
| `tools/{toolName}/{toolName}-tool.ts` | `tools/atomic/*.ts` (schema + execute) |

### Files to Delete

| Old Location | Reason |
|--------------|--------|
| `prompts/core/agent.xml` | Replaced by `.md` |
| `tools/atomic/*.ts` | Split to per-tool folders |
| `tools/discovery/tool-index.ts` | Split to `metadata.ts` files |
| `tools/instructions/tool-instructions.json` | Split to `prompts/tools/*-prompt.md` files |
| `tools/instructions/index.ts` | Replaced by loader |
| `tools/guidance/tool-guidance.json` | Merged into prompt files |
| `tools/all-tools.ts` | Replaced by `_index.ts` |

---

## Dependencies

No new dependencies required.

Already have: `handlebars`, `zod` (used for prompt templates and schema validation)

---

## Success Criteria

1. **Per-tool folders** - Each tool self-contained with all its files
2. **Single source of truth** - No duplication across files
3. **Hot-reload** - Edit `.yaml` or `.md` → instant update
4. **Type safety** - TypeScript validation of metadata
5. **VS Code support** - Syntax highlighting for all formats
6. **Auditable** - `git log server/tools/getPage/` shows all changes to that tool
7. **Discoverable** - Easy to find tool's metadata, guidance, and implementation

---

## Testing Checkpoints

After each phase:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm reset:data` succeeds
- [ ] Agent can discover tools via `toolSearch`
- [ ] Tool guidance injects into system prompt
- [ ] Hot-reload works in dev mode
- [ ] All migrated tools function correctly

---

## Open Questions

1. **Legacy aliases (cms_*)?**
   - Keep in separate `_aliases.ts` file that maps old → new names
   - Or drop them entirely (breaking change)

2. **Naming convention for folders?**
   - camelCase: `getPage/`, `createSection/`
   - kebab-case: `get-page/`, `create-section/`
   - **Recommendation:** camelCase (matches tool names)

3. **Schema and execute in same file?**
   - Separate: cleaner separation, matches other files
   - Combined: less files, schema closely tied to execute
   - **Recommendation:** Separate (consistent pattern)

---

## Phase 2: Tool Search Service Architecture

> Move search logic from `server/tools/discovery/` to `server/services/tool-search/` and expose via API endpoints. The `toolSearch` tool will consume the service.

### Problem: Current Architecture

The discovery system is tightly coupled to tools:

```
server/tools/discovery/          ← Discovery logic in tools folder
├── index.ts                     ← Exports init + search functions
├── tool-index.ts                ← 900+ line metadata registry
├── tool-search.ts               ← The toolSearch AI SDK tool
├── smart-search.ts              ← Hybrid search orchestrator
├── bm25-search.ts               ← BM25 lexical search
├── vector-search.ts             ← Semantic vector search
└── types.ts                     ← Shared types
```

**Issues:**
1. **Mixed concerns** - `toolSearch` tool and search services in same folder
2. **Direct imports** - `toolSearchTool` imports `smartToolSearchWithConfidence` directly
3. **Module-level state** - BM25/vector indexes stored as module variables
4. **Init at startup** - `server/index.ts` calls `initBM25Index()` and `initToolVectorIndex()`
5. **Not reusable** - Other parts of the system can't access discovery via API

### Target Architecture

```
server/
├── services/
│   └── tool-search/                 ← NEW: Search as a service
│       ├── index.ts                 ← ToolSearchService class
│       ├── tool-search.service.ts
│       ├── bm25-search.ts           ← MOVE from tools/discovery/
│       ├── vector-search.ts         ← MOVE from tools/discovery/
│       ├── smart-search.ts          ← MOVE from tools/discovery/
│       ├── tool-registry.ts         ← MOVE from tools/discovery/tool-index.ts
│       └── types.ts
│
├── routes/
│   └── tools.ts                     ← NEW: Tool discovery API endpoints
│
└── tools/
    ├── toolSearch/                  ← The AI SDK tool
    │   ├── toolSearch-metadata.ts
    │   └── toolSearch-tool.ts       ← Calls API endpoint, not direct import
    │
    └── discovery/                   ← DELETE after migration
```

### ToolSearchService Class

```typescript
// server/services/tool-search/tool-search.service.ts

import type { ToolMetadata, ToolSearchResult, SmartSearchResult } from "./types";
import { TOOL_REGISTRY } from "./tool-registry";
import { initBM25Index, bm25Search, isBM25Initialized } from "./bm25-search";
import { initToolVectorIndex, vectorSearch, isVectorInitialized } from "./vector-search";
import { smartToolSearchWithConfidence, expandWithRelatedTools } from "./smart-search";

export class ToolSearchService {
  private initialized = false;

  /**
   * Initialize search indexes (call once at server startup)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize BM25 (synchronous, fast)
    initBM25Index(Object.values(TOOL_REGISTRY));

    // Initialize vector search (async, generates embeddings)
    await initToolVectorIndex(Object.values(TOOL_REGISTRY));

    this.initialized = true;
    console.log("✓ ToolSearchService initialized");
  }

  /**
   * Search for tools by query (hybrid BM25 + vector)
   */
  async search(
    query: string,
    limit: number = 8,
    options: { expandRelated?: boolean; forceVector?: boolean } = {}
  ): Promise<SmartSearchResult> {
    return smartToolSearchWithConfidence(query, limit, options);
  }

  /**
   * Get tool metadata by name
   */
  getTool(name: string): ToolMetadata | undefined {
    return TOOL_REGISTRY[name];
  }

  /**
   * List all available tools
   */
  listTools(): ToolMetadata[] {
    return Object.values(TOOL_REGISTRY);
  }

  /**
   * Get related tools for a given tool
   */
  getRelatedTools(toolName: string): string[] {
    const tool = TOOL_REGISTRY[toolName];
    return tool?.relatedTools || [];
  }

  /**
   * Check initialization status
   */
  getStatus(): { bm25: boolean; vector: boolean } {
    return {
      bm25: isBM25Initialized(),
      vector: isVectorInitialized(),
    };
  }
}
```

### API Routes

```typescript
// server/routes/tools.ts

import { Router } from "express";
import type { ServiceContainer } from "../services/service-container";

export function createToolRoutes(services: ServiceContainer) {
  const router = Router();

  /**
   * POST /v1/tools/search
   * Search for tools by query (hybrid BM25 + vector)
   */
  router.post("/search", async (req, res) => {
    const { query, limit = 8, expandRelated = true, forceVector = false } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required" });
    }

    const result = await services.toolSearch.search(query, limit, {
      expandRelated,
      forceVector,
    });

    res.json(result);
  });

  /**
   * GET /v1/tools
   * List all available tools
   */
  router.get("/", async (_req, res) => {
    const tools = services.toolSearch.listTools();
    res.json({ tools, count: tools.length });
  });

  /**
   * GET /v1/tools/:name
   * Get tool metadata by name
   */
  router.get("/:name", async (req, res) => {
    const tool = services.toolSearch.getTool(req.params.name);

    if (!tool) {
      return res.status(404).json({ error: `Tool not found: ${req.params.name}` });
    }

    res.json(tool);
  });

  /**
   * GET /v1/tools/status
   * Get discovery service status
   */
  router.get("/status", async (_req, res) => {
    const status = services.toolSearch.getStatus();
    res.json(status);
  });

  return router;
}
```

### Update ServiceContainer

```typescript
// server/services/service-container.ts

import { ToolSearchService } from "./tool-search";

export class ServiceContainer {
  // ... existing services ...
  readonly toolSearch: ToolSearchService;

  private constructor(db: DrizzleDB) {
    // ... existing initialization ...
    this.toolSearch = new ToolSearchService();
  }

  static async initialize(db: DrizzleDB): Promise<ServiceContainer> {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer(db);
      await ServiceContainer.instance.vectorIndex.initialize();
      await ServiceContainer.instance.toolSearch.initialize();  // NEW
    }
    return ServiceContainer.instance;
  }
}
```

### Update server/index.ts

```typescript
// server/index.ts

// REMOVE these imports:
// import { validateToolIndex, initBM25Index, initToolVectorIndex } from "./tools/discovery";

import { createToolRoutes } from "./routes/tools";  // NEW

async function startServer() {
  // REMOVE:
  // validateToolIndex();
  // initBM25Index();
  // initToolVectorIndex().catch(...);

  // Services now handle initialization (including tool discovery)
  const services = await ServiceContainer.initialize(db);

  // Routes
  app.use("/v1/tools", createToolRoutes(services));  // NEW
  // ... other routes ...
}
```

### Update toolSearch Tool

```typescript
// server/tools/toolSearch/toolSearch-tool.ts

import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../_types";

// Schema
export const schema = z.object({
  query: z
    .string()
    .describe("6-8 ACTION keywords covering all task needs (e.g. 'create post publish pexels search download')"),
  limit: z.number().optional().default(8).describe("Max tools (default: 8)"),
});

// Execute - uses service via context, not direct import
export async function execute(
  { query, limit = 8 }: z.infer<typeof schema>,
  ctx: AgentContext
) {
  console.log(`[tool_search] Query: "${query}", limit: ${limit}`);

  // Use service from context
  const { tools, confidence, source } = await ctx.services.toolSearch.search(
    query,
    limit,
    { expandRelated: true }
  );

  console.log(`[tool_search] Found ${tools.length} tools (confidence: ${confidence.toFixed(2)}, source: ${source})`);

  if (tools.length === 0 || confidence < 0.2) {
    return {
      tools: [],
      message: `No tools found for "${query}". Try: "create post", "list pages", "pexels photos", "update section".`,
    };
  }

  return {
    tools: tools.map((t) => t.name),
    message: `Found ${tools.length} tools. They are now active. Check <tool-usage-instructions> for usage instructions.`,
  };
}
```

### Migration Steps

#### Step 1: Create Service Structure
```
mkdir -p server/services/tool-search
```

#### Step 2: Move Files
```bash
# Move search implementations
cp server/tools/discovery/bm25-search.ts server/services/tool-search/
cp server/tools/discovery/vector-search.ts server/services/tool-search/
cp server/tools/discovery/smart-search.ts server/services/tool-search/
cp server/tools/discovery/types.ts server/services/tool-search/

# Rename tool-index.ts → tool-registry.ts
cp server/tools/discovery/tool-index.ts server/services/tool-search/tool-registry.ts
```

#### Step 3: Create Service Class
- Create `server/services/tool-search/tool-search.service.ts`
- Create `server/services/tool-search/index.ts` (exports)

#### Step 4: Create API Routes
- Create `server/routes/tools.ts`
- Register in `server/index.ts`

#### Step 5: Update ServiceContainer
- Add `toolSearch: ToolSearchService`
- Initialize in `initialize()` method

#### Step 6: Update server/index.ts
- Remove direct `initBM25Index()` / `initToolVectorIndex()` calls
- Remove imports from `./tools/discovery`
- Add tool routes

#### Step 7: Update toolSearch Tool
- Create `server/tools/toolSearch/` folder
- Move tool to use service via `ctx.services.toolSearch`

#### Step 8: Cleanup
- Delete `server/tools/discovery/` folder

### Files Changed Summary

| Action | File |
|--------|------|
| CREATE | `server/services/tool-search/index.ts` |
| CREATE | `server/services/tool-search/tool-search.service.ts` |
| MOVE | `server/tools/discovery/bm25-search.ts` → `server/services/tool-search/` |
| MOVE | `server/tools/discovery/vector-search.ts` → `server/services/tool-search/` |
| MOVE | `server/tools/discovery/smart-search.ts` → `server/services/tool-search/` |
| MOVE | `server/tools/discovery/tool-index.ts` → `server/services/tool-search/tool-registry.ts` |
| MOVE | `server/tools/discovery/types.ts` → `server/services/tool-search/` |
| CREATE | `server/routes/tools.ts` |
| UPDATE | `server/services/service-container.ts` |
| UPDATE | `server/index.ts` |
| CREATE | `server/tools/toolSearch/toolSearch-metadata.ts` |
| CREATE | `server/tools/toolSearch/toolSearch-tool.ts` |
| DELETE | `server/tools/discovery/` (after migration) |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/tools/search` | Search tools by query |
| GET | `/v1/tools` | List all tools |
| GET | `/v1/tools/:name` | Get tool by name |
| GET | `/v1/tools/status` | Get service status |

### Benefits

1. **Service pattern** - Discovery follows same pattern as other services
2. **API access** - Other systems can discover tools via HTTP
3. **Context injection** - No more direct imports, uses `ctx.services`
4. **Single initialization** - ServiceContainer handles all startup
5. **Testable** - Service can be mocked in tests
6. **Clean tool folder** - `tools/` only contains tool definitions, not infrastructure

### Testing

After migration:
- [ ] `GET /v1/tools` returns all tools
- [ ] `POST /v1/tools/search` with `{ query: "create page" }` returns page tools
- [ ] `GET /v1/tools/getPage` returns getPage metadata
- [ ] `GET /v1/tools/status` shows `{ bm25: true, vector: true }`
- [ ] Agent's `tool_search` works via new service
- [ ] BM25 search works (lexical matches)
- [ ] Vector search works (semantic matches)
- [ ] Related tools expansion works
