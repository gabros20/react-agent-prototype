# Layer 3: Agent System

> ReAct loop, tool registry, working memory, and human-in-the-loop approval

## Overview

The agent layer implements a ReAct (Reasoning + Acting) pattern using AI SDK v6. The agent thinks, executes tools, observes results, and repeats until the task is complete. It includes working memory for entity tracking and HITL for sensitive operations.

**Orchestrator:** `server/agent/orchestrator.ts`
**Tools:** `server/tools/`
**Prompts:** `server/prompts/react.xml`

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                          Agent System                             │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                       ReAct Loop                            │  │
│  │                                                             │  │
│  │    ┌─────────┐    ┌─────────┐    ┌─────────┐                │  │
│  │    │  THINK  │ →  │   ACT   │ →  │ OBSERVE │ → (repeat)     │  │
│  │    │         │    │         │    │         │                │  │
│  │    │ Reason  │    │ Execute │    │ Process │                │  │
│  │    │ about   │    │ tool    │    │ tool    │                │  │
│  │    │ task    │    │ call    │    │ result  │                │  │
│  │    └─────────┘    └─────────┘    └─────────┘                │  │
│  │                                                             │  │
│  │    Max Steps: 15 • Retry: 3x with backoff                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     Tool Registry                           │  │
│  │  ┌────────┬────────┬────────┬────────┬────────┬──────────┐  │  │
│  │  │  Page  │Section │ Entry  │ Image  │  Post  │Navigation│  │  │
│  │  │  Tools │ Tools  │ Tools  │ Tools  │ Tools  │  Tools   │  │  │
│  │  └────────┴────────┴────────┴────────┴────────┴──────────┘  │  │
│  │                    21 Total Tools                           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│         ┌────────────────────┼────────────────────┐               │
│         ▼                    ▼                    ▼               │
│  ┌─────────────┐     ┌─────────────┐      ┌─────────────┐         │
│  │   Working   │     │    HITL     │      │   Session   │         │
│  │   Memory    │     │  Approval   │      │  Checkpts   │         │
│  │             │     │             │      │             │         │
│  │ Entity track│     │ Pause for   │      │ Save state  │         │
│  │ Reference   │     │ user confirm│      │ every 3     │         │
│  │ resolution  │     │ on delete   │      │ steps       │         │
│  └─────────────┘     └─────────────┘      └─────────────┘         │
└───────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                                | Purpose                     |
| ----------------------------------- | --------------------------- |
| `server/agent/orchestrator.ts`      | ReAct loop implementation   |
| `server/tools/all-tools.ts`         | Tool registry               |
| `server/tools/*.ts`                 | Individual tool definitions |
| `server/prompts/react.xml`          | System prompt template      |
| `server/services/working-memory/`   | Entity extraction           |
| `server/services/approval-queue.ts` | HITL coordination           |

---

## ReAct Loop

The orchestrator implements Think→Act→Observe cycles:

```typescript
// server/agent/orchestrator.ts
export async function* streamAgentWithApproval(messages: Message[], context: AgentContext): AsyncGenerator<AgentEvent> {
	const agent = new ToolLoopAgent({
		model: openrouter("gpt-4o-mini"),
		tools: ALL_TOOLS,
		maxSteps: 15,
		experimental_context: context,
		system: await compilePrompt(context),
	});

	for await (const event of agent.run(messages)) {
		// Handle different event types
		if (event.type === "tool-call") {
			// Check if approval needed
			if (requiresApproval(event.toolName, event.args)) {
				yield { type: "approval-required", ...event };
				const approved = await waitForApproval(event.id);
				if (!approved) continue;
			}
		}
		yield event;
	}
}
```

### Event Types

| Event               | Description               |
| ------------------- | ------------------------- |
| `text-delta`        | Streaming text chunks     |
| `tool-call`         | Tool invocation started   |
| `tool-result`       | Tool execution completed  |
| `approval-required` | Waiting for user approval |
| `finish`            | Agent completed           |
| `error`             | Execution failed          |

---

## Tool Registry

All 21 tools are defined with Zod schemas and execute functions:

```typescript
// server/tools/all-tools.ts
export const ALL_TOOLS = {
	// Page tools
	getPages: tool({
		description: "List all pages in the site",
		parameters: z.object({
			status: z.enum(["draft", "published", "all"]).optional(),
		}),
		execute: async ({ status }, { experimental_context: ctx }) => {
			const pages = await ctx.pageService.getPages(ctx.siteId, ctx.envId, status);
			return { pages };
		},
	}),

	createPage: tool({
		description: "Create a new page",
		parameters: z.object({
			title: z.string(),
			slug: z.string().optional(),
			sections: z.array(SectionSchema).optional(),
		}),
		execute: async (args, { experimental_context: ctx }) => {
			const page = await ctx.pageService.createPage(ctx.siteId, ctx.envId, args);
			return { page, message: `Created page: ${page.title}` };
		},
	}),

	deletePage: tool({
		description: "Delete a page (requires approval)",
		parameters: z.object({ pageId: z.string() }),
		requiresApproval: true, // Triggers HITL
		execute: async ({ pageId }, { experimental_context: ctx }) => {
			await ctx.pageService.deletePage(pageId);
			return { success: true };
		},
	}),

	// ... 18 more tools
};
```

### Tool Categories

| Category   | Tools                                                                             | Purpose            |
| ---------- | --------------------------------------------------------------------------------- | ------------------ |
| Page       | getPages, getPage, createPage, updatePage, deletePage                             | Page CRUD          |
| Section    | getSectionDefinitions, getSectionEntries, updateSection                           | Section management |
| Entry      | createEntry, updateEntry, deleteEntry                                             | Content entries    |
| Image      | findImage, searchImages, listImages, addImageToSection, replaceImage, deleteImage | Media management   |
| Post       | getPosts, createPost, updatePost, publishPost, archivePost, deletePost            | Blog content       |
| Navigation | getNavigation, updateNavigation                                                   | Menu structure     |
| Site       | getSiteSettings, updateSiteSettings                                               | Global config      |

---

## Agent Context

Tools receive context via `experimental_context`:

```typescript
interface AgentContext {
	// Identity
	siteId: string;
	environmentId: string;
	sessionId: string;

	// Services (from ServiceContainer)
	pageService: PageService;
	sectionService: SectionService;
	entryService: EntryService;
	imageService: ImageService;
	postService: PostService;
	sessionService: SessionService;

	// State
	workingMemory: WorkingMemoryState;
	approvalQueue: ApprovalQueue;
}
```

---

## Working Memory

Tracks entities mentioned across conversation turns:

```typescript
// server/services/working-memory/index.ts
interface WorkingMemoryState {
	entities: Map<string, Entity>;
	references: Map<string, string>; // "the page" → pageId
}

interface Entity {
	type: "page" | "section" | "image" | "post";
	id: string;
	name: string;
	lastMentioned: number; // step number
}
```

**Entity Extraction:**
After each tool result, entities are extracted and stored:

```typescript
// After createPage returns { page: { id: 'abc', title: 'Home' } }
workingMemory.entities.set("abc", {
	type: "page",
	id: "abc",
	name: "Home",
	lastMentioned: 5,
});
workingMemory.references.set("the home page", "abc");
workingMemory.references.set("that page", "abc");
```

**Reference Resolution:**
When user says "delete that page", the system resolves "that page" → page ID.

---

## Human-in-the-Loop (HITL)

Dangerous operations require user approval:

```typescript
// Tools marked with requiresApproval: true
const APPROVAL_REQUIRED = ['deletePage', 'deletePost', 'deleteImage'];

// In orchestrator
if (APPROVAL_REQUIRED.includes(toolName)) {
  const approvalId = nanoid();
  yield {
    type: 'approval-required',
    approvalId,
    toolName,
    args,
    message: `Delete page "${args.pageId}"?`
  };

  // Wait for user response
  const approved = await approvalQueue.waitForApproval(approvalId);
  if (!approved) {
    yield { type: 'tool-result', result: { cancelled: true } };
    continue;
  }
}
```

**Client Side:**
The frontend shows a modal, user clicks approve/deny, response sent back.

---

## System Prompt

The prompt is compiled from Handlebars template:

```xml
<!-- server/prompts/react.xml -->
<system>
  <role>You are a CMS assistant for {{siteName}}.</role>

  <tools>
    {{#each tools}}
    - {{name}}: {{description}}
    {{/each}}
  </tools>

  <working_memory>
    {{#if entities}}
    Known entities:
    {{#each entities}}
    - {{type}}: {{name}} (id: {{id}})
    {{/each}}
    {{/if}}
  </working_memory>

  <instructions>
    - Use tools to fulfill user requests
    - Confirm destructive actions before proceeding
    - Reference known entities by name or ID
  </instructions>
</system>
```

---

## Retry Logic

Failed tool calls retry with exponential backoff:

```typescript
const RETRY_CONFIG = {
	maxAttempts: 3,
	baseDelay: 1000,
	maxDelay: 10000,
};

async function executeWithRetry(tool, args) {
	for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
		try {
			return await tool.execute(args);
		} catch (error) {
			if (attempt === RETRY_CONFIG.maxAttempts) throw error;
			const delay = Math.min(RETRY_CONFIG.baseDelay * 2 ** attempt, RETRY_CONFIG.maxDelay);
			await sleep(delay);
		}
	}
}
```

---

## Session Checkpoints

State is saved every 3 steps:

```typescript
let stepCount = 0;
for await (const event of agent.run(messages)) {
	stepCount++;
	if (stepCount % 3 === 0) {
		await sessionService.saveCheckpoint(sessionId, {
			messages: agent.messages,
			workingMemory: workingMemory.serialize(),
		});
	}
	yield event;
}
```

Enables resuming from interruptions.

---

## Integration Points

| Connects To        | How                       |
| ------------------ | ------------------------- |
| Layer 1 (Server)   | `/v1/agent/stream` route  |
| Layer 2 (Database) | Via services in context   |
| Layer 4 (Services) | Tools call services       |
| Layer 6 (Client)   | SSE events rendered in UI |

---

## Deep Dive Topics

-   Tool design patterns
-   Working memory optimization
-   Multi-turn conversation handling
-   Approval queue implementation
-   Step limit tuning
-   Error recovery strategies
