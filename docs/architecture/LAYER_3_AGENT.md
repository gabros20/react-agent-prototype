# Layer 3: Agent System

> Native AI SDK 6 agent, tool registry, working memory, and human-in-the-loop approval

## Overview

The agent layer implements a ReAct (Reasoning + Acting) pattern using **AI SDK v6 native patterns**. Since the migration to AI SDK 6 (commit `1e1963e`), the agent uses a centralized `cmsAgent` module with `generateText`, native stop conditions, and streamlined context injection via `prepareCall`.

**Key Files:**
- `server/agent/cms-agent.ts` - Centralized agent definition
- `server/agent/system-prompt.ts` - Prompt compilation
- `server/routes/agent.ts` - Streaming route handler
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
│  │                    21 Total Tools                           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│         ┌────────────────────┼────────────────────┐               │
│         ▼                    ▼                    ▼               │
│  ┌─────────────┐     ┌─────────────┐      ┌─────────────┐         │
│  │   Working   │     │    HITL     │      │  Tokenizer  │         │
│  │   Memory    │     │needsApproval│      │  & Pricing  │         │
│  │             │     │             │      │             │         │
│  │ Entity track│     │ Native SDK  │      │ Token count │         │
│  │ Reference   │     │ approval    │      │ Cost calc   │         │
│  │ resolution  │     │ flow        │      │             │         │
│  └─────────────┘     └─────────────┘      └─────────────┘         │
└───────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                                | Purpose                          |
| ----------------------------------- | -------------------------------- |
| `server/agent/cms-agent.ts`         | Centralized agent definition     |
| `server/agent/system-prompt.ts`     | Prompt compilation (extracted)   |
| `server/routes/agent.ts`            | Stream handler with AI SDK UI    |
| `server/tools/all-tools.ts`         | Tool registry                    |
| `server/tools/*.ts`                 | Individual tool definitions      |
| `server/prompts/react.xml`          | System prompt template           |
| `server/services/working-memory/`   | Entity extraction                |
| `lib/tokenizer.ts`                  | Token counting (tiktoken)        |
| `server/services/openrouter-pricing.ts` | Cost calculation             |

---

## CMS Agent Module

The centralized agent module replaces the old orchestrator pattern:

```typescript
// server/agent/cms-agent.ts
import { generateText, tool, type CoreMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { ALL_TOOLS } from '../tools/all-tools';
import { getSystemPrompt } from './system-prompt';
import type { AgentContext } from '../tools/types';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Agent configuration
const AGENT_CONFIG = {
  maxSteps: 15,
  modelId: 'openai/gpt-4o-mini',
  maxRetries: 2,  // Native SDK retry
  maxTokens: 4096,
};

export interface AgentOptions {
  sessionId: string;
  traceId: string;
  workingMemory: string;
  cmsTarget: { siteId: string; environmentId: string };
  db: any;
  services: any;
  sessionService: any;
  vectorIndex: any;
  logger: any;
}

export async function runAgent(
  messages: CoreMessage[],
  options: AgentOptions
) {
  const systemPrompt = getSystemPrompt({
    toolsList: Object.keys(ALL_TOOLS),
    toolCount: Object.keys(ALL_TOOLS).length,
    sessionId: options.sessionId,
    currentDate: new Date().toISOString().split('T')[0],
    workingMemory: options.workingMemory,
  });

  // Create context for tools
  const agentContext: AgentContext = {
    db: options.db,
    services: options.services,
    sessionService: options.sessionService,
    vectorIndex: options.vectorIndex,
    logger: options.logger,
    traceId: options.traceId,
    sessionId: options.sessionId,
    cmsTarget: options.cmsTarget,
  };

  return generateText({
    model: openrouter(AGENT_CONFIG.modelId),
    system: systemPrompt,
    messages,
    tools: ALL_TOOLS,
    maxSteps: AGENT_CONFIG.maxSteps,
    maxRetries: AGENT_CONFIG.maxRetries,
    maxTokens: AGENT_CONFIG.maxTokens,
    experimental_context: agentContext,
  });
}
```

### Key Changes from Migration

| Before (Custom Orchestrator) | After (AI SDK 6 Native) |
|------------------------------|-------------------------|
| Custom while loop + retry | Native `maxRetries: 2` |
| Custom step tracking | Native `maxSteps` |
| Checkpoint every 3 steps | Messages saved at end only |
| `ApprovalQueue` service | Native `needsApproval` on tools |
| `experimental_context` direct | `prepareCall` + typed options |

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

All 21 tools are defined with Zod schemas and `needsApproval` for destructive ops:

```typescript
// server/tools/all-tools.ts
export const ALL_TOOLS = {
  // Page tools
  cms_getPages: tool({
    description: 'List all pages in the site',
    parameters: z.object({
      status: z.enum(['draft', 'published', 'all']).optional(),
    }),
    execute: async ({ status }, { experimental_context }) => {
      const ctx = experimental_context as AgentContext;
      const pages = await ctx.services.pageService.getPages(
        ctx.cmsTarget.siteId,
        ctx.cmsTarget.environmentId,
        status
      );
      return { pages };
    },
  }),

  cms_deletePage: tool({
    description: 'Delete a page permanently',
    parameters: z.object({
      pageId: z.string(),
    }),
    needsApproval: true,  // Native AI SDK 6 HITL
    execute: async ({ pageId }, { experimental_context }) => {
      const ctx = experimental_context as AgentContext;
      await ctx.services.pageService.deletePage(pageId);
      return { success: true };
    },
  }),

  // ... 19 more tools
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

**AI SDK 6 Native Pattern**: Uses `needsApproval: true` on tools:

```typescript
// server/tools/all-tools.ts
cms_deletePage: tool({
  description: 'Delete a page permanently',
  parameters: z.object({
    pageId: z.string(),
  }),
  needsApproval: true,  // SDK pauses execution
  execute: async ({ pageId }, { experimental_context }) => {
    // Only runs after user approves
    const ctx = experimental_context as AgentContext;
    await ctx.services.pageService.deletePage(pageId);
    return { success: true };
  },
}),
```

**Approval Flow:**
1. Tool with `needsApproval: true` is called
2. AI SDK emits `tool-call` event with approval state
3. Frontend shows inline approval card
4. User approves/rejects
5. If approved, tool executes

**Approval Endpoint:**
```typescript
// app/api/agent/approve/route.ts
POST /api/agent/approve
{ approvalId: string, approved: boolean, reason?: string }
```

---

## System Prompt

The prompt is compiled from Handlebars template:

```typescript
// server/agent/system-prompt.ts
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

interface SystemPromptContext {
  toolsList: string[];
  toolCount: number;
  sessionId: string;
  currentDate: string;
  workingMemory?: string;
}

let compiledTemplate: ReturnType<typeof Handlebars.compile> | null = null;

export function getSystemPrompt(context: SystemPromptContext): string {
  if (!compiledTemplate) {
    const promptPath = path.join(__dirname, '../prompts/react.xml');
    const template = fs.readFileSync(promptPath, 'utf-8');
    compiledTemplate = Handlebars.compile(template);
  }

  return compiledTemplate({
    ...context,
    toolsFormatted: context.toolsList.map(t => `- ${t}`).join('\n'),
    workingMemory: context.workingMemory || '',
  });
}
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
