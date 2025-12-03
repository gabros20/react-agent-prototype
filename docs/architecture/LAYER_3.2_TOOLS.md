# Layer 3.2: Tool System

> How tools give the agent capabilities to affect the world

## Overview

Tools are the agent's hands. They transform LLM reasoning into real actions - creating pages, uploading images, updating navigation. Our implementation uses native AI SDK v6 tools with no wrappers or factories.

**Key Files:**

-   `server/tools/all-tools.ts` - Tool registry
-   `server/tools/types.ts` - Type definitions
-   `server/tools/*.ts` - Individual tool implementations

---

## The Problem

LLMs produce text, not actions. Without tools:

-   "Create a page" → Text describing how to create a page
-   With tools:
-   "Create a page" → Actual API call → Real page in database

Tools bridge the gap between language and action.

---

## How Tool Calling Works

This section explains the fundamental mechanics of how an LLM "calling a function" actually results in code execution. Understanding this is crucial for grasping the entire agent system.

### The Key Insight

When we say the agent "calls" `cms_createPage({title: "About"})`, the LLM doesn't execute JavaScript. Instead:

1. **LLM returns structured tool calls** (not just text)
2. **AI SDK intercepts and executes** the actual functions
3. **Results go back to LLM** as observations

### Step 1: LLM Sees Tools as JSON Schema

When creating the agent, tools are registered and converted to JSON schema:

```typescript
// server/agent/orchestrator.ts
return new ToolLoopAgent({
	model: openrouter.languageModel(AGENT_CONFIG.modelId),
	tools: ALL_TOOLS, // All tools available
	// ...
});
```

The AI SDK converts each tool definition to JSON schema for the LLM. The LLM prompt includes something like:

```json
{
	"name": "cms_createPage",
	"description": "Create a new page with optional sections",
	"parameters": {
		"type": "object",
		"properties": {
			"title": { "type": "string", "description": "Page title" },
			"slug": { "type": "string", "description": "URL slug" }
		}
	}
}
```

### Step 2: LLM Returns Tool Calls (Not Just Text)

When the LLM decides to use a tool, it returns a **structured response** with `tool_calls`, not plain text. Modern LLMs (GPT-4, Claude, etc.) support native function calling:

```json
{
	"role": "assistant",
	"content": "I need to create a page first.",
	"tool_calls": [
		{
			"id": "call_abc123",
			"type": "function",
			"function": {
				"name": "cms_createPage",
				"arguments": "{\"title\": \"About\"}"
			}
		}
	]
}
```

> **Critical Distinction:** This is NOT prompt engineering magic. Native function calling is a trained capability of modern LLMs - they're explicitly trained to output structured `tool_calls` in their response format.

### Step 3: AI SDK Intercepts and Executes

The AI SDK framework intercepts the `tool_calls` from the LLM response:

```typescript
// Inside streamText() or ToolLoopAgent.generate()
case "tool-call":
  // 1. Extract tool name and arguments
  const { toolName, input, toolCallId } = chunk;

  // 2. Look up the tool from ALL_TOOLS registry
  const tool = ALL_TOOLS[toolName];

  // 3. Validate input against Zod schema
  const validated = tool.inputSchema.parse(input);

  // 4. Execute the tool's execute() function
  const result = await tool.execute(validated, { experimental_context: context });
```

At this point, **real code runs**:

```typescript
// Inside cms_createPage.execute()
const page = await ctx.services.pageService.createPage(ctx.cmsTarget.siteId, ctx.cmsTarget.environmentId, input);
// → Database INSERT actually happens here!
```

### Step 4: Results Return to LLM

The tool result is appended to the conversation as a `tool` message:

```json
{
	"role": "tool",
	"tool_call_id": "call_abc123",
	"content": "{\"success\": true, \"page\": {\"id\": \"page-123\", \"title\": \"About\"}}"
}
```

The LLM sees this in the next iteration and can reason about it (OBSERVE phase).

### Step 5: Loop Continues

With the tool result in context, the LLM decides what to do next:

-   More tool calls needed? → Return another `tool_calls` response
-   Task complete? → Return text with `FINAL_ANSWER:`

### Visual Summary

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User: "Create About page"                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. LLM Thinks & Returns Structured Response                 │
│                                                             │
│    {                                                        │
│      content: "I'll create a page",                         │
│      tool_calls: [{                                         │
│        name: "cms_createPage",                              │
│        arguments: '{"title": "About"}'                      │
│      }]                                                     │
│    }                                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. AI SDK Intercepts Tool Call                              │
│    - Looks up tool in ALL_TOOLS registry                    │
│    - Validates input via Zod schema                         │
│    - Calls tool.execute(input, context)                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Tool Executes Real Code                                  │
│    await pageService.createPage(...)                        │
│    → Database INSERT                                        │
│    → Returns: { id: "page-123", title: "About" }            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Result Appended to Messages                              │
│    messages.push({                                          │
│      role: "tool",                                          │
│      tool_call_id: "call_abc123",                           │
│      content: '{"success": true, "page": {...}}'            │
│    })                                                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Next LLM Call (Loop Continues)                           │
│    LLM sees tool result, decides next action or stops       │
└─────────────────────────────────────────────────────────────┘
```

### This Pattern Is Universal

Every modern agentic framework works this way:

| Framework     | Approach                                          |
| ------------- | ------------------------------------------------- |
| AI SDK v6     | Native `tool()` function with automatic execution |
| LangChain     | Tools → LLM → Tool execution → Loop               |
| AutoGPT       | Same pattern with custom JSON parsing             |
| Anthropic SDK | `tools` parameter in API calls                    |

The "magic" is that modern LLMs are **trained** to output structured function calls, not just text. The framework's job is to intercept these calls and execute real code.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        Tool System                                │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    ALL_TOOLS Registry                       │  │
│  │                                                             │  │
│  │   45 tools organized by domain:                             │  │
│  │                                                             │  │
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │  │
│  │   │  Pages  │ │Sections │ │ Images  │ │  Posts  │           │  │
│  │   │  (6)    │ │  (8)    │ │  (7)    │ │  (7)    │           │  │
│  │   └─────────┘ └─────────┘ └─────────┘ └─────────┘           │  │
│  │                                                             │  │
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │  │
│  │   │ Entries │ │  Nav    │ │ Search  │ │  Web    │           │  │
│  │   │  (2)    │ │  (5)    │ │  (2)    │ │Research │           │  │
│  │   └─────────┘ └─────────┘ └─────────┘ │  (5)+   │           │  │
│  │                                       └─────────┘           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Tool Anatomy                             │  │
│  │                                                             │  │
│  │   tool({                                                    │  │
│  │     description: "...",     ← LLM reads this                │  │
│  │     inputSchema: z.object(), ← Zod validation               │  │
│  │     execute: async (input, { experimental_context }) => {   │  │
│  │       // Implementation                                     │  │
│  │     }                                                       │  │
│  │   })                                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                 TOOL_METADATA (Separate)                    │  │
│  │                                                             │  │
│  │   {                                                         │  │
│  │     category: 'cms' | 'web' | 'http',                       │  │
│  │     riskLevel: 'safe' | 'moderate' | 'high',                │  │
│  │     requiresApproval: boolean,                              │  │
│  │     tags: string[]                                          │  │
│  │   }                                                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Tool Anatomy

Every tool follows the same structure:

```typescript
import { tool } from "ai";
import { z } from "zod";

export const cms_createPage = tool({
	// 1. Description - LLM uses this to decide when to call
	description: "Create a new page with optional sections. Returns the created page with its ID.",

	// 2. Input Schema - Zod validates input before execution
	inputSchema: z.object({
		title: z.string().describe("Page title"),
		slug: z.string().optional().describe("URL slug (auto-generated if omitted)"),
		sections: z.array(SectionSchema).optional().describe("Initial sections to add"),
	}),

	// 3. Execute - The actual implementation
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;

		const page = await ctx.services.pageService.createPage(ctx.cmsTarget.siteId, ctx.cmsTarget.environmentId, input);

		ctx.logger.info(`Created page: ${page.title}`, { pageId: page.id });

		return {
			success: true,
			page: {
				id: page.id,
				title: page.title,
				slug: page.slug,
				status: page.status,
			},
			message: `Created page "${page.title}" with slug "/${page.slug}"`,
		};
	},
});
```

### The Three Parts

| Part          | Purpose                             | LLM Sees?            |
| ------------- | ----------------------------------- | -------------------- |
| `description` | Tells LLM when/why to use this tool | Yes                  |
| `inputSchema` | Validates and documents parameters  | Yes (as JSON schema) |
| `execute`     | Actual implementation               | No (only results)    |

---

## Tool Categories

### CMS - Pages (6 tools)

| Tool                        | Purpose                                | Risk     |
| --------------------------- | -------------------------------------- | -------- |
| `cmsGetPage`                | Get single page (with/without content) | Safe     |
| `cmsCreatePage`             | Create new page                        | Safe     |
| `cmsCreatePageWithContent`  | Create page with sections              | Safe     |
| `cmsUpdatePage`             | Update page metadata                   | Moderate |
| `cmsDeletePage`             | Delete page (requires confirmation)    | High     |
| `cmsListPages`              | List all pages                         | Safe     |

### CMS - Sections (8 tools)

| Tool                       | Purpose                                | Risk     |
| -------------------------- | -------------------------------------- | -------- |
| `cmsListSectionTemplates`  | List available section templates       | Safe     |
| `cmsSectionFields`         | Get section template fields/schema     | Safe     |
| `cmsAddSectionToPage`      | Add section to page                    | Safe     |
| `cmsUpdateSectionContent`  | Update section content (merges)        | Moderate |
| `cmsDeletePageSection`     | Remove single section (confirmation)   | High     |
| `cmsDeletePageSections`    | Remove multiple sections (confirmation)| High     |
| `cmsGetPageSections`       | List sections on a page                | Safe     |
| `cmsGetSectionContent`     | Get specific section content           | Safe     |

### CMS - Images (7 tools)

| Tool                     | Purpose                          | Risk     |
| ------------------------ | -------------------------------- | -------- |
| `findImageTool`          | Find image by description        | Safe     |
| `searchImagesTool`       | Semantic image search            | Safe     |
| `listAllImagesTool`      | List all images in system        | Safe     |
| `addImageToSectionTool`  | Attach image to section          | Moderate |
| `updateSectionImageTool` | Update image in section          | Moderate |
| `replaceImageTool`       | Replace image reference          | Moderate |
| `deleteImageTool`        | Delete image (confirmation)      | High     |

### CMS - Posts (7 tools)

| Tool             | Purpose                          | Risk     |
| ---------------- | -------------------------------- | -------- |
| `cmsCreatePost`  | Create draft post                | Safe     |
| `cmsUpdatePost`  | Update post content              | Moderate |
| `cmsPublishPost` | Publish post (confirmation)      | High     |
| `cmsArchivePost` | Archive post (confirmation)      | High     |
| `cmsDeletePost`  | Delete post (confirmation)       | High     |
| `cmsListPosts`   | List blog posts                  | Safe     |
| `cmsGetPost`     | Get single post                  | Safe     |

### CMS - Navigation (5 tools)

| Tool                       | Purpose            | Risk     |
| -------------------------- | ------------------ | -------- |
| `getNavigationTool`        | Get all nav items  | Safe     |
| `addNavigationItemTool`    | Add nav link       | Safe     |
| `updateNavigationItemTool` | Update nav link    | Moderate |
| `removeNavigationItemTool` | Remove nav item    | High     |
| `toggleNavigationItemTool` | Show/hide nav item | Moderate |

### CMS - Entries (2 tools)

| Tool                     | Purpose                  | Risk |
| ------------------------ | ------------------------ | ---- |
| `cmsGetCollectionEntries`| Get entries by collection| Safe |
| `cmsGetEntryContent`     | Get entry content        | Safe |

### Search (2 tools)

| Tool            | Purpose                   | Risk |
| --------------- | ------------------------- | ---- |
| `searchVector`  | Semantic vector search    | Safe |
| `cmsFindResource` | Fuzzy search for resources| Safe |

### Web Research (3 tools)

| Tool                 | Purpose                    | Risk |
| -------------------- | -------------------------- | ---- |
| `webQuickSearchTool` | Fast web search (snippets) | Safe |
| `webDeepResearchTool`| Comprehensive research     | Safe |
| `webFetchContentTool`| Extract content from URL   | Safe |

### Stock Photos (2 tools)

| Tool                    | Purpose                  | Risk |
| ----------------------- | ------------------------ | ---- |
| `pexelsSearchPhotosTool`| Search Pexels photos     | Safe |
| `pexelsDownloadPhotoTool`| Download and save photo | Safe |

### HTTP (2 tools)

| Tool        | Purpose            | Risk |
| ----------- | ------------------ | ---- |
| `httpGet`   | Fetch from URL     | Safe |
| `httpPost`  | Post to URL        | High |

### Planning (1 tool)

| Tool              | Purpose           | Risk |
| ----------------- | ----------------- | ---- |
| `planAnalyzeTask` | Analyze task plan | Safe |

---

## Context Injection

Tools receive full context via `experimental_context`:

```typescript
interface AgentContext {
	// Database access
	db: DrizzleDB;

	// All services
	services: {
		pageService: PageService;
		sectionService: SectionService;
		entryService: EntryService;
		imageService: ImageService;
		postService: PostService;
		navigationService: NavigationService;
		siteSettingsService: SiteSettingsService;
	};

	// Vector search
	vectorIndex: VectorIndexService;

	// Logging (streams to frontend)
	logger: {
		info: (msg: string, meta?: object) => void;
		warn: (msg: string, meta?: object) => void;
		error: (msg: string, meta?: object) => void;
	};

	// SSE streaming
	stream?: {
		write: (event: StreamEvent) => void;
	};

	// Identifiers
	traceId: string;
	sessionId: string;

	// Multi-tenant targeting
	cmsTarget?: {
		siteId: string;
		environmentId: string;
	};
}
```

### Access Pattern

```typescript
execute: async (input, { experimental_context }) => {
	// Type assertion (AI SDK uses unknown type)
	const ctx = experimental_context as AgentContext;

	// Access services
	const page = await ctx.services.pageService.getPage(input.pageId);

	// Log (streams to frontend)
	ctx.logger.info("Fetched page", { pageId: input.pageId });

	// Access database directly if needed
	const result = await ctx.db.query.pages.findMany();

	return { page };
};
```

---

## Tool Metadata

Metadata is stored separately from tool definitions:

```typescript
// server/tools/types.ts
export const TOOL_METADATA: Record<string, ToolMeta> = {
	cmsCreatePage: {
		category: "cms",
		riskLevel: "safe",
		tags: ["page", "create", "content"],
	},

	cmsDeletePage: {
		category: "cms",
		riskLevel: "high",
		// Uses confirmed flag pattern (conversational HITL)
		tags: ["page", "delete", "destructive"],
	},

	deleteImageTool: {
		category: "cms",
		riskLevel: "high",
		// Uses confirmed flag pattern (conversational HITL)
		tags: ["image", "delete", "destructive"],
	},

	httpPost: {
		category: "http",
		riskLevel: "high",
		tags: ["http", "external", "write"],
	},
};
```

### Risk Levels

| Level      | Description                      | Handling                                |
| ---------- | -------------------------------- | --------------------------------------- |
| `safe`     | Read-only or creates new content | Execute immediately                     |
| `moderate` | Updates existing content         | Execute with logging                    |
| `high`     | Deletes or external writes       | Requires confirmed flag (conversational)|

---

## Confirmation Pattern

All destructive operations use the **Conversational Confirmed Flag Pattern**:

Used for: `cmsDeletePage`, `cmsDeletePageSection`, `cmsDeletePost`, `deleteImageTool`, etc.

```typescript
export const cmsDeletePage = tool({
	description: "Delete a page permanently. Requires confirmed: true.",
	inputSchema: z.object({
		slug: z.string().optional(),
		id: z.string().optional(),
		confirmed: z.boolean().optional().describe("Must be true to actually delete"),
	}),
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;

		// First call: confirmed flag missing or false
		if (!input.confirmed) {
			const page = await ctx.services.pageService.getPage(input);
			return {
				requiresConfirmation: true,
				message: `Are you sure you want to delete page "${page.name}"? This cannot be undone.`,
				page: { id: page.id, slug: page.slug, name: page.name },
			};
		}

		// Second call: confirmed: true
		await ctx.services.pageService.deletePage(input.id!);
		return { success: true, message: "Page deleted successfully." };
	},
});
```

**Flow:**

1. User: "Delete the about page"
2. Agent calls `cmsDeletePage({ slug: "about" })` (no confirmed flag)
3. Tool returns `{ requiresConfirmation: true, message: "Are you sure..." }`
4. Agent presents confirmation to user in chat
5. User responds "yes" or "no"
6. If yes, agent calls `cmsDeletePage({ slug: "about", confirmed: true })`
7. Page is deleted

**Key Benefits:**
- No modal/popup needed - confirmation happens in natural conversation
- No separate approval endpoint
- Agent can provide context about what will be deleted
- User can ask follow-up questions before confirming

See [Layer 3.5 HITL](./LAYER_3.5_HITL.md) for full details.

---

## Granular Content Fetching

A key pattern encoded in our tools and prompt:

### The Problem

Fetching full page content wastes tokens:

```typescript
// Bad: 2000+ tokens for one field lookup
cms_getPage({ slug: "about", includeContent: true });
// Returns ALL sections, ALL content
```

### The Solution: Two-Tier Strategy

```typescript
// Good: ~500 tokens for targeted lookup
// Step 1: Get page structure (lightweight)
cms_getPage({ slug: "about" });
// Returns: { id, title, slug, sections: [{id: "s1"}, {id: "s2"}] }

// Step 2: Get specific section content
cms_getSectionContent({ pageSectionId: "s1" });
// Returns: { heading: "About Us", content: "..." }
```

### When to Use Each

| Scenario                   | Approach             | Tokens |
| -------------------------- | -------------------- | ------ |
| "What's the hero heading?" | Granular (2-3 tools) | ~500   |
| "Show me all page content" | Full fetch (1 tool)  | ~2000  |
| "Update one field"         | Granular             | ~500   |
| "Export entire page"       | Full fetch           | ~2000  |

This is enforced via prompt instructions, not code.

---

## Tool Result Structure

Consistent result format aids entity extraction:

```typescript
// Single resource
return {
  success: true,
  page: { id, title, slug, status },
  message: "Created page 'About Us'"
};

// List of resources
return {
  success: true,
  pages: [{ id, title, slug }, ...],
  total: 15,
  message: "Found 15 pages"
};

// Search results
return {
  success: true,
  matches: [
    { id, title, score: 0.85 },
    ...
  ],
  message: "Found 3 matching pages"
};

// Error
return {
  success: false,
  error: "Page not found",
  errorCode: "NOT_FOUND"
};
```

### Entity Extraction

Working memory extracts entities from these structures:

-   `page` → adds to page entities
-   `pages[]` → adds first 3 to page entities
-   `matches[]` → adds matches as entities
-   `image`, `post`, `section` → respective entity types

See [Layer 3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md).

---

## Tool Composition

Higher-level tools can compose lower-level operations:

```typescript
export const cms_createPageWithContent = tool({
	description: "Create a page with sections in one call",
	inputSchema: z.object({
		title: z.string(),
		slug: z.string().optional(),
		sections: z.array(SectionInputSchema),
	}),
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;

		// 1. Create the page
		const page = await ctx.services.pageService.createPage(ctx.cmsTarget.siteId, ctx.cmsTarget.environmentId, {
			title: input.title,
			slug: input.slug,
		});

		// 2. Add each section
		const addedSections = [];
		for (const section of input.sections || []) {
			const added = await ctx.services.sectionService.addToPage(page.id, section.definitionId, section.content);
			addedSections.push(added);
		}

		return {
			success: true,
			page: { ...page, sections: addedSections },
			message: `Created page "${page.title}" with ${addedSections.length} sections`,
		};
	},
});
```

---

## Zod Schema Patterns

### Basic Types

```typescript
z.object({
	title: z.string(),
	slug: z.string().optional(),
	status: z.enum(["draft", "published"]).default("draft"),
	order: z.number().int().positive().optional(),
});
```

### With Descriptions (Important!)

```typescript
z.object({
	query: z.string().describe("Search query - natural language description of what to find"),
	limit: z.number().default(5).describe("Maximum results to return (1-20)"),
});
```

### Complex Nested Structures

```typescript
const SectionContentSchema = z.object({
	heading: z.string().optional(),
	subheading: z.string().optional(),
	content: z.string().optional(),
	image: z
		.object({
			url: z.string(),
			alt: z.string(),
		})
		.optional(),
	cta: z
		.object({
			text: z.string(),
			url: z.string(),
		})
		.optional(),
});
```

---

## Design Decisions

### Why No Tool Factories/Registries?

```typescript
// We DON'T do this:
const pageTools = createToolGroup('page', pageService);

// We DO this:
export const cms_getPage = tool({ ... });
export const cms_createPage = tool({ ... });
```

**Reasons:**

1. **Explicit is better** - Each tool is clearly defined
2. **No magic** - Easy to understand and debug
3. **AI SDK native** - No custom abstractions
4. **Type safety** - Full TypeScript inference

### Why No Middleware/Wrappers?

```typescript
// We DON'T do this:
const wrappedTool = withLogging(withRetry(withValidation(baseTool)));

// We DO this:
// Logging, retry, validation handled at orchestrator level
```

**Reasons:**

1. **Single responsibility** - Tools do one thing
2. **Orchestrator handles cross-cutting** - Retry, logging centralized
3. **Simpler testing** - Tools are pure functions

### Why 45 Tools?

More tools = more capabilities. LLMs handle large tool sets well with good descriptions.

**Alternative considered:** Fewer, more general tools
**Problem:** Harder for LLM to use correctly, more ambiguous

---

## Integration Points

| Connects To                                         | How                              |
| --------------------------------------------------- | -------------------------------- |
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md)         | Orchestrator executes tool calls |
| [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) | Results → entity extraction      |
| [3.5 HITL](./LAYER_3.5_HITL.md)                     | High-risk tools require approval |
| [3.8 Context](./LAYER_3.8_CONTEXT_INJECTION.md)     | Tools receive AgentContext       |
| Layer 4 Services                                    | Tools call service methods       |

---

## Adding a New Tool

1. **Define the tool:**

```typescript
// server/tools/my-tools.ts
export const cms_myNewTool = tool({
  description: 'Clear description of what this does',
  inputSchema: z.object({
    param1: z.string().describe('What this param is for'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    // Implementation
    return { success: true, result: ... };
  }
});
```

2. **Add to registry:**

```typescript
// server/tools/all-tools.ts
import { cms_myNewTool } from "./my-tools";

export const ALL_TOOLS = {
	// ... existing tools
	cms_myNewTool,
};
```

3. **Add metadata:**

```typescript
// server/tools/types.ts
export const TOOL_METADATA = {
	// ... existing metadata
	cms_myNewTool: {
		category: "cms",
		riskLevel: "safe",
		requiresApproval: false,
		tags: ["my", "new", "tool"],
	},
};
```

4. **Update prompt if needed** - Add examples or guidance in `react.xml`

---

## Further Reading

-   [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - How tools are executed
-   [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) - Entity extraction from results
-   [3.5 HITL](./LAYER_3.5_HITL.md) - Approval patterns
-   [3.8 Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) - AgentContext details
