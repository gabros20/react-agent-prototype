# Layer 3: Agent System

> Native AI SDK 6 ToolLoopAgent, tool registry, working memory, and human-in-the-loop approval

## Overview

The agent layer implements a ReAct (Reasoning + Acting) pattern using **AI SDK v6 `ToolLoopAgent` class**. Since the migration to AI SDK 6 (commit `1e1963e`), the agent uses a centralized module-level singleton with:
- **`ToolLoopAgent`** class with `.stream()` and `.generate()` methods
- **`callOptionsSchema`** for type-safe runtime options via Zod
- **`prepareCall`** hook for dynamic system prompt injection
- **`stopWhen`** conditions (step count + FINAL_ANSWER detection)
- **`prepareStep`** for context window management

**Key Files:**
- `server/agent/cms-agent.ts` - ToolLoopAgent singleton definition
- `server/agent/system-prompt.ts` - Modular prompt compilation
- `server/routes/agent.ts` - Streaming route handler
- `server/prompts/core/` - Base rules XML module
- `server/prompts/workflows/` - Workflow-specific XML modules
- `server/tools/` - Tool definitions

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                          Agent System                             │
│                       (AI SDK v6 Native)                          │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    CMS Agent (Module)                       │  │
│  │                                                             │  │
│  │    model: openrouter/gpt-4o-mini                            │  │
│  │    maxSteps: 15                                             │  │
│  │    maxRetries: 2 (native)                                   │  │
│  │                                                             │  │
│  │    ┌─────────┐    ┌─────────┐    ┌─────────┐                │  │
│  │    │  THINK  │ →  │   ACT   │ →  │ OBSERVE │ → (repeat)     │  │
│  │    │         │    │         │    │         │                │  │
│  │    │ Reason  │    │ Execute │    │ Process │                │  │
│  │    │ about   │    │ tool    │    │ tool    │                │  │
│  │    │ task    │    │ call    │    │ result  │                │  │
│  │    └─────────┘    └─────────┘    └─────────┘                │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     Tool Registry                           │  │
│  │  ┌────────┬────────┬────────┬────────┬────────┬──────────┐  │  │
│  │  │  Page  │Section │ Entry  │ Image  │  Post  │Navigation│  │  │
│  │  │  Tools │ Tools  │ Tools  │ Tools  │ Tools  │  Tools   │  │  │
│  │  └────────┴────────┴────────┴────────┴────────┴──────────┘  │  │
│  │                    45 Total Tools                           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│         ┌────────────────────┼────────────────────┐               │
│         ▼                    ▼                    ▼               │
│  ┌─────────────┐     ┌─────────────┐      ┌─────────────┐         │
│  │   Working   │     │    HITL     │      │  Tokenizer  │         │
│  │   Memory    │     │ Conversational │   │  & Pricing  │         │
│  │             │     │             │      │             │         │
│  │ Entity track│     │ confirmed   │      │ Token count │         │
│  │ Reference   │     │ flag pattern│      │ Cost calc   │         │
│  │ resolution  │     │             │      │             │         │
│  └─────────────┘     └─────────────┘      └─────────────┘         │
└───────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                                    | Purpose                          |
| --------------------------------------- | -------------------------------- |
| `server/agent/cms-agent.ts`             | ToolLoopAgent singleton          |
| `server/agent/system-prompt.ts`         | Modular prompt compilation       |
| `server/routes/agent.ts`                | Stream/generate route handlers   |
| `server/tools/all-tools.ts`             | Tool registry                    |
| `server/tools/*.ts`                     | Individual tool definitions      |
| `server/prompts/core/base-rules.xml`    | Identity, ReAct, working memory  |
| `server/prompts/workflows/*.xml`        | Workflow-specific prompts        |
| `server/services/working-memory/`       | Entity extraction                |
| `lib/tokenizer.ts`                      | Token counting (tiktoken)        |
| `server/services/openrouter-pricing.ts` | Cost calculation                 |

---

## CMS Agent Module

The centralized agent module uses `ToolLoopAgent` - a module-level singleton:

```typescript
// server/agent/cms-agent.ts
import { ToolLoopAgent, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { ALL_TOOLS } from "../tools/all-tools";
import { getSystemPrompt } from "./system-prompt";
import type { AgentContext } from "../tools/types";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const AGENT_CONFIG = {
  maxSteps: 15,
  modelId: "openai/gpt-4o-mini",
  maxOutputTokens: 4096,
} as const;

// Type-safe call options via Zod schema
export const AgentCallOptionsSchema = z.object({
  sessionId: z.string(),
  traceId: z.string(),
  workingMemory: z.string().optional(),
  cmsTarget: z.object({
    siteId: z.string(),
    environmentId: z.string(),
  }),
  // Runtime-injected services
  db: z.custom<any>(),
  services: z.custom<any>(),
  sessionService: z.custom<any>(),
  vectorIndex: z.custom<any>(),
  logger: z.custom<any>(),
  stream: z.custom<any>().optional(),
});

export type AgentCallOptions = z.infer<typeof AgentCallOptionsSchema>;

// Custom stop condition: FINAL_ANSWER detection
const hasFinalAnswer = ({ steps }: { steps: any[] }) => {
  const lastStep = steps[steps.length - 1];
  return lastStep?.text?.includes("FINAL_ANSWER:") || false;
};

// Module-level singleton agent
export const cmsAgent = new ToolLoopAgent({
  model: openrouter.languageModel(AGENT_CONFIG.modelId),

  // Placeholder - replaced dynamically in prepareCall
  instructions: "CMS Agent - Instructions will be dynamically generated",

  tools: ALL_TOOLS,
  callOptionsSchema: AgentCallOptionsSchema,

  // Dynamic instruction injection + context setup
  prepareCall: ({ options, ...settings }) => {
    const dynamicInstructions = getSystemPrompt({
      currentDate: new Date().toISOString().split("T")[0],
      workingMemory: options.workingMemory || "",
    });

    return {
      ...settings,
      instructions: dynamicInstructions,
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
      } as AgentContext,
    };
  },

  // Stop conditions (OR logic)
  stopWhen: [stepCountIs(AGENT_CONFIG.maxSteps), hasFinalAnswer],

  // Context window management
  prepareStep: async ({ messages }: { messages: any[] }) => {
    if (messages.length > 20) {
      return {
        messages: [
          messages[0], // Keep system prompt
          ...messages.slice(-10), // Keep last 10
        ],
      };
    }
    return {};
  },
});
```

### Usage in Routes

```typescript
// Streaming
const streamResult = await cmsAgent.stream({
  messages,
  options: agentOptions, // Type-checked via callOptionsSchema
});

// Non-streaming
const result = await cmsAgent.generate({
  messages,
  options: agentOptions,
});
```

### Key Changes from Migration

| Before (Custom Orchestrator) | After (ToolLoopAgent) |
|------------------------------|-------------------------|
| `generateText` function | `ToolLoopAgent` class |
| Custom while loop + retry | SDK handles internally |
| Custom step tracking | `stopWhen` conditions |
| Checkpoint every 3 steps | Messages saved at end only |
| `ApprovalQueue` service | Conversational confirmed flag pattern |
| Untyped options | `callOptionsSchema` with Zod |
| Static system prompt | `prepareCall` dynamic injection |
| Routes 600+ lines | Routes ~100 lines (thin controllers) |
| Business logic in routes | AgentOrchestrator service |

---

## Event Types

| Event               | Description                    |
| ------------------- | ------------------------------ |
| `text-delta`        | Streaming text chunks          |
| `tool-call`         | Tool invocation started        |
| `tool-result`       | Tool execution completed       |
| `tool-call-streaming-start` | Tool call begins (AI SDK 6) |
| `step-start`        | Step boundary                  |
| `step-finish`       | Step completed with usage      |
| `finish`            | Agent completed                |
| `error`             | Execution failed               |

---

## Tool Registry

All 45 tools are defined with Zod schemas. Destructive operations use the `confirmed` flag pattern:

```typescript
// server/tools/all-tools.ts
export const ALL_TOOLS = {
  // Page tools (read)
  cms_getPage: tool({
    description: 'Get a page by slug or ID',
    inputSchema: z.object({
      slug: z.string().optional(),
      id: z.string().optional(),
      includeContent: z.boolean().optional().default(false),
    }),
    execute: async (input, { experimental_context }) => {
      const ctx = experimental_context as AgentContext;
      const page = await ctx.services.pageService.getPageBySlug(input.slug!);
      return { page };
    },
  }),

  // Page tools (destructive) - uses confirmed flag pattern
  cms_deletePage: tool({
    description: 'Delete a page permanently. Requires confirmed: true.',
    inputSchema: z.object({
      slug: z.string().optional(),
      id: z.string().optional(),
      confirmed: z.boolean().optional().describe('Must be true to delete'),
    }),
    execute: async (input, { experimental_context }) => {
      const ctx = experimental_context as AgentContext;

      // First call: return confirmation request
      if (!input.confirmed) {
        return {
          requiresConfirmation: true,
          message: `Are you sure you want to delete this page?`,
        };
      }

      // Second call with confirmed: true
      await ctx.services.pageService.deletePage(input.id!);
      return { success: true };
    },
  }),

  // ... 43 more tools
};
```

### Tool Categories

| Category       | Count | Tools                                                                                           | Purpose                |
| -------------- | ----- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| Page           | 6     | getPage, createPage, createPageWithContent, updatePage, deletePage, listPages                   | Page CRUD              |
| Section        | 8     | listSectionTemplates, getSectionFields, addSectionToPage, updateSectionContent, deletePageSection, deletePageSections, getPageSections, getSectionContent | Section management |
| Entry          | 2     | getCollectionEntries, getEntryContent                                                           | Collection entries     |
| Search         | 2     | searchVector, findResource                                                                      | Semantic search        |
| Image          | 7     | findImage, searchImages, listAllImages, addImageToSection, updateSectionImage, replaceImage, deleteImage | Media management |
| Navigation     | 5     | getNavigation, addNavigationItem, updateNavigationItem, removeNavigationItem, toggleNavigationItem | Menu structure |
| Post           | 7     | createPost, updatePost, publishPost, archivePost, deletePost, listPosts, getPost                | Blog content           |
| HTTP           | 2     | httpGet, httpPost                                                                               | External APIs          |
| Planning       | 1     | planAnalyzeTask                                                                                 | Task analysis          |
| Web Research   | 3     | webQuickSearch, webDeepResearch, webFetchContent                                                | Exa AI research        |
| Stock Photos   | 2     | pexelsSearchPhotos, pexelsDownloadPhoto                                                         | Pexels integration     |

---

## Agent Context

Tools receive context via `experimental_context`:

```typescript
interface AgentContext {
  // Database
  db: DrizzleDB;

  // Services
  services: {
    pageService: PageService;
    sectionService: SectionService;
    entryService: EntryService;
    imageService: ImageService;
    postService: PostService;
    navigationService: NavigationService;
    siteSettingsService: SiteSettingsService;
  };

  // Session & Vector
  sessionService: SessionService;
  vectorIndex: VectorIndexService;

  // Logging
  logger: {
    info: (msg: string, meta?: object) => void;
    warn: (msg: string, meta?: object) => void;
    error: (msg: string, meta?: object) => void;
  };

  // Identity
  traceId: string;
  sessionId: string;

  // Multi-tenant targeting
  cmsTarget: {
    siteId: string;
    environmentId: string;
  };
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
  type: 'page' | 'section' | 'image' | 'post';
  id: string;
  name: string;
  lastMentioned: number; // step number
}
```

**Entity Extraction:**
After each tool result, entities are extracted and stored:

```typescript
// After createPage returns { page: { id: 'abc', title: 'Home' } }
workingContext.add({
  type: 'page',
  id: 'abc',
  name: 'Home',
});
```

**Reference Resolution:**
When user says "delete that page", the system resolves "that page" → page ID.

---

## Human-in-the-Loop (HITL)

**Conversational Confirmed Flag Pattern**: Destructive tools require explicit confirmation via the `confirmed` parameter:

```typescript
// server/tools/all-tools.ts
cms_deletePage: tool({
  description: 'Delete a page permanently. Requires confirmed: true.',
  inputSchema: z.object({
    slug: z.string().optional(),
    id: z.string().optional(),
    confirmed: z.boolean().optional().describe('Must be true to delete'),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;

    // First call without confirmed: return confirmation request
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to delete page "${page.name}"?`,
        page: { id: page.id, slug: page.slug, name: page.name },
      };
    }

    // Second call with confirmed: true - execute deletion
    await ctx.services.pageService.deletePage(input.id!);
    return { success: true, message: 'Page deleted successfully.' };
  },
}),
```

**Confirmation Flow:**
1. User requests deletion (e.g., "delete the about page")
2. Tool called without `confirmed` flag
3. Tool returns `{ requiresConfirmation: true, message: "..." }`
4. Agent presents confirmation message to user in chat
5. User confirms ("yes") or cancels ("no")
6. If confirmed, tool called again with `confirmed: true`

**No Modal/Endpoint Needed**: The confirmation happens conversationally in the chat, not via a separate approval endpoint. See [3.5 HITL](./LAYER_3.5_HITL.md) for full details.

---

## System Prompt

The prompt is compiled from modular XML files using Handlebars:

```typescript
// server/agent/system-prompt.ts
import Handlebars from "handlebars";
import fs from "node:fs";
import path from "node:path";

export interface SystemPromptContext {
  currentDate: string;
  workingMemory?: string;
}

// Modular prompt structure
const PROMPT_MODULES = [
  "core/base-rules.xml",       // Identity, ReAct loop, confirmations
  "workflows/cms-pages.xml",   // Page and section management
  "workflows/cms-images.xml",  // Image handling and display
  "workflows/cms-posts.xml",   // Blog post management
  "workflows/cms-navigation.xml", // Navigation management
  "workflows/web-research.xml",   // Exa AI web research
] as const;

let compiledTemplate: ReturnType<typeof Handlebars.compile> | null = null;

function loadPromptModules(): string {
  const promptsDir = path.join(__dirname, "../prompts");

  const modules = PROMPT_MODULES.map((modulePath) => {
    const fullPath = path.join(promptsDir, modulePath);
    try {
      return fs.readFileSync(fullPath, "utf-8");
    } catch (error) {
      console.warn(`Warning: Could not load prompt module: ${modulePath}`);
      return "";
    }
  }).filter(Boolean);

  // Compose into single agent prompt
  return `<agent>\n${modules.join("\n\n")}\n</agent>`;
}

export function getSystemPrompt(context: SystemPromptContext): string {
  if (!compiledTemplate) {
    const template = loadPromptModules();
    compiledTemplate = Handlebars.compile(template);
  }

  return compiledTemplate({
    ...context,
    workingMemory: context.workingMemory || "",
  });
}
```

### Prompt Module Structure

```
server/prompts/
├── core/
│   └── base-rules.xml       # Identity, ReAct pattern, working memory
└── workflows/
    ├── cms-pages.xml        # Page/section CRUD patterns
    ├── cms-images.xml       # Image search and display rules
    ├── cms-posts.xml        # Blog post management
    ├── cms-navigation.xml   # Navigation editing
    └── web-research.xml     # Exa AI research patterns
```

### Working Memory Injection

The `{{{workingMemory}}}` Handlebars triple-stash injects entity context:

```xml
<!-- core/base-rules.xml -->
<working-memory>
{{{workingMemory}}}
</working-memory>
```

---

## Token & Cost Tracking

New in AI SDK 6 migration - token counting and cost calculation:

```typescript
// lib/tokenizer.ts
import { encodingForModel } from 'js-tiktoken';

export function countTokens(text: string, model = 'gpt-4o-mini'): number {
  const encoding = encodingForModel(model as any);
  return encoding.encode(text).length;
}

// server/services/openrouter-pricing.ts
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  return (
    (inputTokens * pricing.input) / 1_000_000 +
    (outputTokens * pricing.output) / 1_000_000
  );
}
```

**Usage in Route:**
```typescript
// After generateText completes
const { usage } = result;
const cost = calculateCost(usage.promptTokens, usage.completionTokens, model);

// Emit to frontend
writeSSE('usage', {
  promptTokens: usage.promptTokens,
  completionTokens: usage.completionTokens,
  totalTokens: usage.totalTokens,
  estimatedCost: cost,
});
```

---

## Native Retry Logic

AI SDK 6 handles retries natively:

```typescript
const result = await generateText({
  // ...
  maxRetries: 2,  // Default: 2, handles 429/5xx automatically
});
```

**Retry Behavior:**
- Rate limits (429) → automatic exponential backoff
- Server errors (5xx) → retry with backoff
- Client errors (4xx except 429) → no retry, surface immediately

---

## Message Persistence

Messages saved at end of agent execution (no mid-step checkpointing):

```typescript
// server/routes/agent.ts
const result = await runAgent(messages, options);

// Save after completion
await sessionService.saveMessages(sessionId, [
  ...previousMessages,
  { role: 'user', content: prompt },
  ...result.responseMessages,
]);
```

**Note**: Checkpoint system removed in AI SDK 6 migration (was dead code).

---

## Integration Points

| Connects To        | How                              |
| ------------------ | -------------------------------- |
| Layer 1 (Server)   | `/api/agent` route               |
| Layer 2 (Database) | Via services in context          |
| Layer 4 (Services) | Tools call services              |
| Layer 6 (Client)   | AI SDK UI stream protocol        |

---

## Deep Dive Topics

- [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Loop implementation details
- [3.2 Tools](./LAYER_3.2_TOOLS.md) - Tool anatomy and patterns
- [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) - Entity tracking
- [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - Prompt structure
- [3.5 HITL](./LAYER_3.5_HITL.md) - Approval flow
- [3.6 Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md) - Retry and degradation
- [3.7 Streaming](./LAYER_3.7_STREAMING.md) - SSE events
- [3.8 Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) - How tools get services
