# Per-Tool Instruction Architecture

Separating tool discovery (short descriptions) from execution guidance (detailed instructions), following AI SDK v6 best practices.

## Key Insight

> **Description = Discovery** (short, 1-2 sentences for tool selection)
> **Instructions = Execution** (detailed protocols, injected into system prompt for active tools)

## Current Problems

| Issue | Current State |
|-------|---------------|
| Domain-based rules | `posts.md` includes 7 tools, even if only 1 discovered |
| Duplicated descriptions | TOOL_INDEX + actual tool definition |
| Bloated injection | Full domain rules even when using single tool |

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ TOOL DEFINITION (in all-tools.ts)                              │
│                                                                │
│ description: SHORT (1-2 sentences)                             │
│ - What the tool does                                           │
│ - When it should be used                                       │
│                                                                │
│ inputSchema: Zod with .describe() for params                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ TOOL_INSTRUCTIONS (in tools/instructions/index.ts)             │
│                                                                │
│ Per-tool protocols:                                            │
│ - BEFORE: prerequisites                                        │
│ - AFTER: follow-up actions                                     │
│ - NEXT: workflow continuation                                  │
│ - GOTCHA: edge cases                                           │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT INJECTION (via prepareStep)                      │
│                                                                │
│ <active-protocols> section:                                    │
│ - Stripped and replaced each step                              │
│ - Contains only discovered/active tool protocols               │
│ - Single system message, no pollution                          │
└────────────────────────────────────────────────────────────────┘
```

## Why Separate?

1. **Token efficiency** - Only inject protocols for active tools, not entire domains
2. **Clean selection** - Model scans short descriptions quickly to pick the right tool
3. **No accumulation** - System prompt protocols replaced each step, not accumulated
4. **Single source of truth** - Description only in tool definition, protocols only in TOOL_INSTRUCTIONS

## Implementation

### 1. Tool Definition (SHORT description)

```typescript
// ✅ GOOD - Clean and focused (1-2 sentences)
export const cmsCreatePost = tool({
  description: 'Create a new blog post as draft. Use when user wants to write blog content.',
  inputSchema: z.object({
    title: z.string().describe('Post title'),
    content: z.string().describe('Markdown content'),
    featuredImage: z.string().optional().describe('Image ID from uploads or pexels'),
    tags: z.array(z.string()).optional().describe('Categorization tags'),
  }),
  execute: async (input, { experimental_context }) => { /* ... */ },
})

// ❌ AVOID - Too much detail in description
export const cmsCreatePost = tool({
  description: `Create blog post as draft.
    WHEN: User wants new blog content
    BEFORE: cms_listPosts (check duplicates)
    AFTER: Ask about cover image, publishing
    NEXT: cms_publishPost, pexels_searchPhotos
    GOTCHA: Creates draft only...`,  // Bloats ALL active tools
})
```

### 2. Per-Tool Instructions (TOOL_INSTRUCTIONS)

```typescript
// server/tools/instructions/index.ts
export const TOOL_INSTRUCTIONS: Record<string, string> = {
  cms_createPost: `BEFORE: Check cms_listPosts for duplicate titles
AFTER: Ask if user wants cover image; ask if ready to publish
NEXT: cms_publishPost, pexels_searchPhotos, cms_updatePost
GOTCHA: Creates draft only. Set both featuredImage AND content.cover for covers.`,

  cms_publishPost: `BEFORE: Post must exist as draft (verify with cms_getPost)
AFTER: Confirm publication, offer to show live URL at /blog/{slug}
NEXT: cms_getPost (show final state)
GOTCHA: Requires confirmation flow - first call returns requiresConfirmation, second with confirmed:true executes.`,

  cms_listPosts: `BEFORE: None
AFTER: Show count and titles to user
NEXT: cms_getPost, cms_createPost
GOTCHA: Returns all posts by default. Use status param to filter.`,

  cms_getPage: `BEFORE: Use cms_listPages if page name unknown
AFTER: If editing, fetch specific sections
NEXT: cms_getPageSections, cms_updatePage
GOTCHA: Default is lightweight (no content). Use includeContent:true only when full content needed.`,

  cms_updateSectionContent: `BEFORE: cms_getSectionFields to know field names
AFTER: Verify update with cms_getSectionContent if needed
NEXT: cms_updateSectionImage (for images)
GOTCHA: MERGES with existing - only send fields you want to change.`,

  pexels_searchPhotos: `BEFORE: None required
AFTER: Show results with previews, ask which to download
NEXT: pexels_downloadPhoto
GOTCHA: Returns Pexels IDs, not local image IDs. Must download before using in CMS.`,

  pexels_downloadPhoto: `BEFORE: pexels_searchPhotos to get photo ID
AFTER: Confirm download, show local image ID
NEXT: cms_updateSectionImage, cms_createPost (with featuredImage)
GOTCHA: Downloads to local storage. Use returned image ID in CMS tools.`,

  // ... all other tools
}
```

### 3. System Prompt Injection (prepareStep)

```typescript
// server/agent/cms-agent.ts
import { TOOL_INSTRUCTIONS } from '../tools/instructions'

prepareStep: async ({ stepNumber, steps, messages }) => {
  const discoveredTools = getAllDiscoveredTools(messages, steps)

  // No tools discovered - just core tools
  if (discoveredTools.length === 0) {
    return { activeTools: ['tool_search', 'final_answer'] }
  }

  // Build instructions for active tools only
  const toolInstructions = discoveredTools
    .map(t => {
      const instruction = TOOL_INSTRUCTIONS[t]
      return instruction ? `## ${t}\n${instruction}` : null
    })
    .filter(Boolean)
    .join('\n\n')

  // Get system prompt content
  const systemMessage = messages[0]
  let baseContent = typeof systemMessage.content === 'string'
    ? systemMessage.content
    : ''

  // Strip any existing <active-protocols> section
  baseContent = baseContent
    .replace(/<active-protocols>[\s\S]*?<\/active-protocols>/g, '')
    .trim()

  // Append fresh protocols for current active tools
  const updatedContent = `${baseContent}

<active-protocols>
${toolInstructions}
</active-protocols>`

  const updatedSystemMessage: CoreMessage = {
    role: 'system',
    content: updatedContent,
  }

  return {
    activeTools: ['tool_search', 'final_answer', ...discoveredTools],
    messages: [updatedSystemMessage, ...messages.slice(1)],
  }
}
```

### 4. Simplified tool_search

```typescript
// server/tools/discovery/tool-search.ts
export const toolSearchTool = tool({
  description: 'Search for CMS tools by capability keywords.',
  inputSchema: z.object({
    query: z.string().describe('Capability keywords (e.g., "create post", "search images")'),
    limit: z.number().optional().default(8),
  }),
  execute: async ({ query, limit = 8 }) => {
    const results = await smartToolSearchWithConfidence(query, limit)

    // Return just tool names - protocols injected via prepareStep
    return {
      tools: results.map(t => t.name),
      message: `Found ${results.length} tools. They are now active.`,
    }
  },
})
```

## File Structure

```
server/
├── tools/
│   ├── instructions/
│   │   └── index.ts              # TOOL_INSTRUCTIONS record
│   ├── discovery/
│   │   ├── tool-search.ts        # Simplified - returns tool names only
│   │   └── tool-index.ts         # Search metadata (NO descriptions)
│   └── all-tools.ts              # Tool definitions with SHORT descriptions
│
├── agent/
│   └── cms-agent.ts              # prepareStep injects <active-protocols>
│
└── prompts/
    └── core/
        └── agent.xml             # Base system prompt (no protocols here)

DELETE:
├── prompts/rules/*.md            # 13 domain rule files
└── tools/discovery/rules.ts      # Domain rule loading
```

## TOOL_INDEX Simplification

```typescript
// BEFORE (redundant description)
cms_createPost: {
  name: "cms_createPost",
  description: "Create blog post with title, content, tags...",  // Duplicates tool
  category: "posts",
  phrases: [...],
}

// AFTER (search metadata only)
cms_createPost: {
  name: "cms_createPost",
  category: "posts",
  phrases: ["create post", "new post", "write post", "blog post"],
  relatedTools: ["cms_publishPost", "cms_listPosts"],
  riskLevel: "moderate",
  requiresConfirmation: false,
}
```

## How It Works

**Step 0 (Discovery):**
```
Agent: tool_search("create blog post")
Result: { tools: ["cms_createPost", "cms_listPosts"] }
```

**Step 1+ (Execution):**
```
prepareStep detects: discoveredTools = ["cms_createPost", "cms_listPosts"]

System prompt becomes:
<agent>
  ... base prompt ...
</agent>

<active-protocols>
## cms_createPost
BEFORE: Check cms_listPosts for duplicate titles
AFTER: Ask if user wants cover image; ask if ready to publish
NEXT: cms_publishPost, pexels_searchPhotos
GOTCHA: Creates draft only...

## cms_listPosts
BEFORE: None
AFTER: Show count and titles to user
NEXT: cms_getPost, cms_createPost
GOTCHA: Returns all posts by default...
</active-protocols>
```

**Each step:** Old `<active-protocols>` stripped, fresh one appended based on current active tools.

## Token Comparison

| Approach | What's Injected | Tokens |
|----------|-----------------|--------|
| Current (domain rules) | All 7 post tools when 1 needed | ~400 |
| Per-tool (this plan) | Only 2 active tools | ~120 |

**~3x reduction** in protocol injection overhead.

## Migration Plan

### Phase 1: Create TOOL_INSTRUCTIONS ✅
- [x] Create `server/tools/instructions/index.ts`
- [x] Extract protocols from domain rules into per-tool format
- [x] Cover all ~45 tools

### Phase 2: Update prepareStep ✅
- [x] Import TOOL_INSTRUCTIONS
- [x] Add `<active-protocols>` strip/replace logic
- [x] Test injection works correctly

### Phase 3: Simplify tool_search ✅
- [x] Remove `getRules()` call
- [x] Return just tool names
- [x] Remove `rules` and `instruction` from output

### Phase 4: Shorten Tool Descriptions ✅
- [x] Audit all tools in `all-tools.ts`
- [x] Reduce descriptions to 1-2 sentences
- [x] Move detailed guidance to TOOL_INSTRUCTIONS

### Phase 5: Clean Up TOOL_INDEX ✅
- [x] Remove `description` field from all entries
- [x] Keep only search metadata (phrases, relatedTools, etc.)

### Phase 6: Delete Domain Rules ✅
- [x] `rm server/prompts/rules/*.md`
- [x] `rm server/tools/discovery/rules.ts`
- [x] Update imports in `discovery/index.ts`

### Phase 7: Test ✅
- [x] Verify tool selection works with short descriptions
- [x] Verify protocols appear in system prompt
- [x] Test post creation workflow (tested with monstera plant post)

## Implementation Status: COMPLETE (2024-12-08)

## System Prompt Template

```xml
<!-- server/prompts/core/agent.xml -->
<agent>
<identity>You are a CMS assistant.</identity>

<pattern>
THINK → ACT → OBSERVE → REPEAT

THINK: What does user need?
ACT: Discover tools with tool_search, then execute.
OBSERVE: Read results. Follow protocols in <active-protocols>.
REPEAT: Until complete, then final_answer.
</pattern>

<discovery>
Use tool_search to find capabilities by describing what you need.
Once tools are active, their protocols appear in <active-protocols>.
Follow BEFORE/AFTER/NEXT/GOTCHA for each tool you use.
</discovery>

<confirmation>
When tool returns requiresConfirmation:true:
1. Ask user via final_answer
2. Wait for response
3. Call tool with confirmed:true
</confirmation>

<working-memory>
{{{workingMemory}}}
</working-memory>
</agent>

<!-- <active-protocols> injected by prepareStep -->
```

## Benefits

1. **Token efficient** - Only inject protocols for active tools
2. **Clean selection** - Short descriptions help model pick tools quickly
3. **No pollution** - System prompt protocols replaced each step, never accumulated
4. **Single source of truth** - Description in tool, protocols in TOOL_INSTRUCTIONS
5. **Per-tool granularity** - Change one tool's protocol without affecting others
6. **AI SDK best practice** - Short descriptions for selection, detailed protocols for execution

## References

- AI SDK v6: "Keep tool descriptions clean & short (1-2 sentences)"
- AI SDK v6: "Business rules & workflows → System prompt or dynamic messages"
- Google ADK: "Dense, relevant context beats massive, noisy context"
