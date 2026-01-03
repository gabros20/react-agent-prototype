# Layer 3: Agent System

> Dynamic tool injection with cache-safe architecture, AI SDK 6 ToolLoopAgent, hybrid tool search, and provider-anchored compaction

## Overview

The agent layer implements a ReAct (Reasoning + Acting) pattern using **AI SDK v6 `ToolLoopAgent` class** with a **cache-safe dynamic tool injection** architecture. The key innovation is maintaining a **static system prompt** while injecting dynamic content (working memory, tool guidance) as **conversation messages**.

**Architecture Highlights:**

-   **Static System Prompt**: Never changes during execution (preserves LLM cache)
-   **Dynamic Tool Injection**: Tools discovered on-demand via `searchTools`
-   **Hybrid Search**: BM25 (lexical) + vector (semantic) for tool discovery
-   **Provider-Anchored Compaction**: Uses provider tokens as source of truth
-   **Cache Benefits**: 50-90% cost reduction via LLM prefix caching

**Key Files:**

-   `server/agents/main-agent.ts` - ToolLoopAgent singleton definition
-   `server/agents/system-prompt.ts` - Static prompt loader
-   `server/execution/orchestrator.ts` - Thin coordination layer
-   `server/memory/` - Tool search, working context, compaction
-   `server/tools/_registry/` - Unified tool registry
-   `server/services/search/` - Hybrid tool search services
-   `server/prompts/messages/` - Tool guidance message factories

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           Agent System                                     │
│                    (Cache-Safe Dynamic Tool Injection)                     │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    CMS Agent (ToolLoopAgent)                        │  │
│  │                                                                     │  │
│  │    STATIC System Prompt (never changes - cache preserved)          │  │
│  │    Dynamic Tool Activation (via prepareStep)                       │  │
│  │                                                                     │  │
│  │    ┌──────────┐    ┌──────────┐    ┌──────────┐                    │  │
│  │    │  STEP 0  │ →  │  STEP 1  │ →  │ STEP 2+  │                    │  │
│  │    │          │    │          │    │          │                    │  │
│  │    │ Ack      │    │ Search   │    │ Execute  │                    │  │
│  │    │ Request  │    │ Tools    │    │ Discovered│                   │  │
│  │    │          │    │          │    │ Tools    │                    │  │
│  │    └──────────┘    └──────────┘    └──────────┘                    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                              │                                            │
│                              ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     Tool Search System                              │  │
│  │                                                                     │  │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │  │
│  │  │ BM25 Search │    │   Vector    │    │   Smart     │             │  │
│  │  │  (Lexical)  │ +  │   Search    │ →  │   Blend     │             │  │
│  │  │             │    │ (Semantic)  │    │             │             │  │
│  │  └─────────────┘    └─────────────┘    └─────────────┘             │  │
│  │                                               │                     │  │
│  │                                               ▼                     │  │
│  │  ┌─────────────────────────────────────────────────────────────┐   │  │
│  │  │                   Tool Registry (32 Tools)                  │   │  │
│  │  │  ┌────────┬────────┬────────┬────────┬────────┬──────────┐  │   │  │
│  │  │  │  Page  │Section │ Entry  │ Image  │  Post  │Navigation│  │   │  │
│  │  │  │  Tools │ Tools  │ Tools  │ Tools  │ Tools  │  Tools   │  │   │  │
│  │  │  └────────┴────────┴────────┴────────┴────────┴──────────┘  │   │  │
│  │  └─────────────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                              │                                            │
│         ┌────────────────────┼────────────────────┐                       │
│         ▼                    ▼                    ▼                       │
│  ┌─────────────┐     ┌─────────────┐      ┌─────────────┐                 │
│  │   Working   │     │   Memory    │      │ Compaction  │                 │
│  │   Context   │     │  Management │      │   Service   │                 │
│  │             │     │             │      │             │                 │
│  │ Entity track│     │ Tool search │      │ Provider-   │                 │
│  │ Discovered  │     │ state mgmt  │      │ anchored    │                 │
│  │ tools       │     │             │      │             │                 │
│  └─────────────┘     └─────────────┘      └─────────────┘                 │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                                             | Purpose                                   |
| ------------------------------------------------ | ----------------------------------------- |
| `server/agents/main-agent.ts`                    | ToolLoopAgent singleton with dynamic tools|
| `server/agents/system-prompt.ts`                 | Static system prompt loader               |
| `server/execution/orchestrator.ts`               | Thin coordination layer (~150 lines)      |
| `server/execution/context-coordinator.ts`        | Context preparation & compaction          |
| `server/execution/stream-processor.ts`           | Stream handling & entity extraction       |
| `server/memory/tool-search/tool-search-manager.ts`| Tool discovery lifecycle                 |
| `server/memory/tool-search/tool-search-state.ts` | Immutable tool search state              |
| `server/memory/working-context/working-context.ts`| Entity tracking & discovered tools       |
| `server/memory/compaction/compaction-service.ts` | LLM-based conversation summarization     |
| `server/memory/compaction/tool-pruner.ts`        | Tool output pruning                      |
| `server/memory/compaction/token-service.ts`      | Provider token management                |
| `server/tools/_registry/tool-registry.ts`        | Unified tool metadata registry           |
| `server/services/search/tool-search.service.ts`  | Hybrid search facade                     |
| `server/services/search/smart-search.ts`         | BM25 + vector blending                   |
| `server/prompts/messages/tool-guidance-messages.ts`| Tool guidance as conversation messages |

---

## Three-Phase Tool Lifecycle

The agent uses a **discovery-based tool lifecycle** where tools are found on-demand:

### Phase 1: Acknowledgment (Step 0)

```typescript
// Force acknowledgeRequest tool
if (stepNumber === 0) {
  return {
    activeTools: [...CORE_TOOLS],
    toolChoice: { type: "tool", toolName: "acknowledgeRequest" },
  };
}
```

Agent acknowledges the user's request before taking action.

### Phase 2: Discovery (Step 1)

```typescript
// Agent can use searchTools to find capabilities
if (stepNumber === 1 && discoveredTools.length === 0) {
  return {
    activeTools: [...CORE_TOOLS], // searchTools, finalAnswer, acknowledgeRequest
    toolChoice: "auto",
  };
}
```

Agent uses `searchTools` to discover relevant capabilities.

### Phase 3: Execution (Step 2+)

```typescript
// All discovered tools available
const activeTools = [...new Set([...CORE_TOOLS, ...discoveredTools])];
return { activeTools, toolChoice: "auto" };
```

Agent executes with discovered tools.

---

## Core Tools (Always Available)

| Tool               | Purpose                              |
| ------------------ | ------------------------------------ |
| `searchTools`      | Discover tools via hybrid search     |
| `finalAnswer`      | Complete response to user            |
| `acknowledgeRequest`| Conversational preflight (step 0)   |

---

## Dynamic Tool Injection

### The Problem

Traditional approach: Inject tool prompts into system prompt
```xml
<tool-usage-instructions>{{{activeProtocols}}}</tool-usage-instructions>
```

**Issue**: System prompt changes every step → **LLM cache invalidated** → **High costs**

### The Solution: Message-Based Injection

Tool guidance injected as **conversation messages** (user-assistant pairs):

```typescript
// server/prompts/messages/tool-guidance-messages.ts
export function createToolGuidanceMessages(
  newTools: string[],
  existingTools: string[]
): ModelMessage[] {
  return [
    {
      role: "user",
      content: `[TOOL GUIDANCE] New tools now available: ${newTools.join(", ")}

Here are the usage guidelines:
${toolGuidance}`,
    },
    {
      role: "assistant",
      content: `I understand. I now have access to: ${newTools.join(", ")}.`,
    },
  ];
}
```

**Benefits**:
-   System prompt stays **STATIC** → LLM prefix caching preserved
-   OpenAI: 50% discount on cached prefix
-   Anthropic: 90% discount on cached prefix
-   Dynamic content appears naturally in conversation

---

## CMS Agent Module

The agent uses a module-level singleton with AI SDK 6's ToolLoopAgent:

```typescript
// server/agents/main-agent.ts
import { ToolLoopAgent, stepCountIs, hasToolCall } from "ai";

export const AGENT_CONFIG = {
  maxSteps: 15,
  modelId: "openai/gpt-4o-mini",
  maxOutputTokens: 4096,
} as const;

const CORE_TOOLS = ['searchTools', 'finalAnswer', 'acknowledgeRequest'];

export const cmsAgent = new ToolLoopAgent({
  model: openrouter.languageModel(AGENT_CONFIG.modelId),

  // STATIC instructions - never changes (preserves LLM cache)
  instructions: getStaticSystemPrompt(),

  tools: ALL_TOOLS,
  callOptionsSchema: AgentCallOptionsSchema,

  // Per-request initialization
  prepareCall: ({ options, ...settings }) => {
    // Store discovered tools from previous turns
    persistedDiscoveredTools = options.discoveredTools || [];

    // Reset guidance tracking
    toolsWithGuidanceInjected = new Set([...CORE_TOOLS, ...persistedDiscoveredTools]);

    return {
      ...settings,
      instructions: getStaticSystemPrompt(), // Static - no dynamic content
      activeTools: [...CORE_TOOLS],
      experimental_context: { /* services */ } as AgentContext,
    };
  },

  // Native stop conditions (OR logic)
  stopWhen: [stepCountIs(AGENT_CONFIG.maxSteps), hasToolCall("finalAnswer")],

  // Dynamic tool availability
  prepareStep: async ({ stepNumber, steps, messages }) => {
    // Extract tools from searchTools results
    const fromCurrentSteps = toolSearchManager.extractFromSteps(steps);
    const discoveredTools = [...new Set([...persistedDiscoveredTools, ...fromCurrentSteps])];

    // Find NEW tools (not seen before)
    const newlyDiscovered = fromCurrentSteps.filter(
      tool => !toolsWithGuidanceInjected.has(tool)
    );

    // Inject guidance as MESSAGES (not instructions)
    let updatedMessages = [...messages];
    if (newlyDiscovered.length > 0) {
      const guidanceMessages = createToolGuidanceMessages(newlyDiscovered, [...]);
      updatedMessages = [...updatedMessages, ...guidanceMessages];
    }

    // Phase-based tool availability
    if (stepNumber === 0) {
      return { activeTools: CORE_TOOLS, toolChoice: { type: "tool", toolName: "acknowledgeRequest" } };
    }
    if (stepNumber === 1 && discoveredTools.length === 0) {
      return { activeTools: CORE_TOOLS };
    }
    return { activeTools: [...CORE_TOOLS, ...discoveredTools], messages: updatedMessages };
  },
});
```

### Module-Level State (AI SDK Limitation)

```typescript
// WARNING: Not thread-safe (AI SDK limitation)
let persistedDiscoveredTools: string[] = [];
let toolsWithGuidanceInjected: Set<string> = new Set();
```

**Why module-level?** `prepareStep` doesn't receive `experimental_context`, forcing module-level storage. Each request overwrites via `prepareCall`.

---

## Tool Search System

### Hybrid Search Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Smart Search Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Query: "create a new page"                                    │
│              │                                                  │
│              ▼                                                  │
│   ┌─────────────────────┐    ┌─────────────────────┐           │
│   │    BM25 Search      │    │   Vector Search     │           │
│   │    (Fast, Exact)    │    │   (Semantic)        │           │
│   │                     │    │                     │           │
│   │  Score: 0.85        │    │  Score: 0.72        │           │
│   │  "createPage"       │    │  "createPage"       │           │
│   │  "updatePage"       │    │  "createPost"       │           │
│   └─────────────────────┘    └─────────────────────┘           │
│              │                         │                        │
│              └────────────┬────────────┘                        │
│                           ▼                                     │
│              ┌─────────────────────┐                           │
│              │   Confidence Check   │                           │
│              │                      │                           │
│              │  BM25 > 0.7? Use BM25│                           │
│              │  BM25 < 0.3? Use Vec │                           │
│              │  Else: Blend both    │                           │
│              └─────────────────────┘                           │
│                           │                                     │
│                           ▼                                     │
│              ┌─────────────────────┐                           │
│              │  Related Tools      │                           │
│              │  Expansion          │                           │
│              │  (max 3, discounted)│                           │
│              └─────────────────────┘                           │
│                           │                                     │
│                           ▼                                     │
│              Result: [createPage, updatePage, getPage]          │
└─────────────────────────────────────────────────────────────────┘
```

### Search Service

```typescript
// server/services/search/tool-search.service.ts
class ToolSearchService {
  async search(query: string, limit: number = 8): Promise<SmartSearchResult>;
  getTool(name: string): ToolMetadata;
  listTools(): ToolMetadata[];
}
```

### Smart Blending Strategy

```typescript
// server/services/search/smart-search.ts
function smartBlend(bm25: SearchResult[], vector: SearchResult[]): SearchResult[] {
  // High BM25 confidence (>0.7) → Use BM25 only
  // Low BM25 confidence (<0.3) → Fall back to vector
  // Medium confidence → Reciprocal rank fusion
}
```

---

## Tool Registry

### Per-Tool Folder Structure

Each tool is self-contained:

```
server/tools/{toolName}/
├── {toolName}-metadata.ts    # Search phrases, risk level, extraction
├── {toolName}-tool.ts        # Zod schema + execute function
└── index.ts                  # Exports + AI SDK tool assembly
```

### Metadata Schema

```typescript
// server/tools/_types/metadata.ts
interface ToolMetadata {
  name: string;
  description: string;
  phrases: string[];              // BM25 search phrases
  relatedTools: string[];         // Auto-expansion
  riskLevel: "safe" | "moderate" | "destructive";
  requiresConfirmation: boolean;
  extraction: ExtractionSchema | null;  // Entity extraction
}
```

### Example Tool Metadata

```typescript
// server/tools/createPage/createPage-metadata.ts
export default {
  name: "createPage",
  description: "Create a new page in the CMS",
  phrases: ["create page", "new page", "add page", "make page"],
  relatedTools: ["getPage", "updatePage", "createSection"],
  riskLevel: "moderate",
  requiresConfirmation: false,
  extraction: {
    type: "page",
    idPath: "page.id",
    namePath: "page.title",
  },
};
```

### Registry Initialization

```typescript
// At startup (once)
await ToolRegistry.getInstance().initialize();

// Anywhere after (O(1) sync)
const tool = ToolRegistry.getInstance().get('createPage');
const corpus = ToolRegistry.getInstance().getSearchCorpus();
```

---

## Working Memory

### Entity Tracking

```typescript
// server/memory/working-context/working-context.ts
class WorkingContext {
  private entities: Map<string, Entity>;      // O(1) lookup
  private entitiesOrder: string[];            // Recency order
  private discoveredTools: string[];          // Persisted across turns

  readonly MAX_ENTITIES = 10;
  readonly MAX_DISCOVERED_TOOLS = 20;

  addEntity(entity: Entity): void;
  getEntity(id: string): Entity | undefined;
  toContextString(): string;                  // Memoized serialization
}

interface Entity {
  type: "page" | "section" | "image" | "post";
  id: string;
  name: string;
  timestamp: Date;
}
```

### Entity Extraction

```typescript
// server/memory/working-context/entity-extractor.ts
function extractEntities(toolName: string, result: unknown): Entity[] {
  const metadata = ToolRegistry.getInstance().get(toolName);
  if (!metadata?.extraction) return [];

  // Use metadata's extraction schema
  // Supports nested paths, arrays, custom ID fields
}
```

---

## Compaction System

### Provider-Anchored Token Management

```typescript
// server/memory/compaction/token-service.ts
interface ProviderTokens {
  input: number;   // From OpenRouter API
  output: number;  // From OpenRouter API
}

function isOverflowFromProviderTokens(
  tokens: ProviderTokens,
  limits: ModelLimits,
  threshold = 0.5
): boolean {
  const used = tokens.input + tokens.output;
  const usable = limits.contextLimit - limits.maxOutput;
  return used > usable * threshold;
}
```

### Two-Stage Compaction

**Stage 1: Tool Output Pruning**

```typescript
// server/memory/compaction/tool-pruner.ts
// Prunes old tool outputs while preserving tool call information
// - Protects recent 40K tokens of tool outputs
// - Minimum 20K tokens to trigger pruning
// - Marks pruned outputs with `compactedAt` timestamp
```

**Stage 2: Conversation Summary**

```typescript
// server/memory/compaction/compaction-service.ts
// If overflow persists after pruning:
// - Uses fast model (gpt-4o-mini) to generate summary
// - Creates user-assistant compaction pair:
//   User: "What have we accomplished so far?"
//   Assistant: [LLM-generated summary]
// - Keeps recent N turns (default: 2)
```

### Compaction Configuration

```typescript
const DEFAULT_COMPACTION_CONFIG = {
  pruneMinimum: 20_000,     // Min tokens to save for pruning
  pruneProtect: 40_000,     // Protect recent outputs
  outputReserve: 4_096,     // Reserve for model output
  minTurnsToKeep: 2,        // Always keep 2 recent turns
};
```

---

## Execution Flow

### Orchestrator Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentOrchestrator                        │
│                    (Thin Coordinator)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │  ContextCoordinator │    │   StreamProcessor   │        │
│  │                     │    │                     │        │
│  │  - Session loading  │    │  - Stream handling  │        │
│  │  - Context prep     │    │  - Entity extract   │        │
│  │  - Compaction       │    │  - Event emission   │        │
│  │  - Message convert  │    │                     │        │
│  └─────────────────────┘    └─────────────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────┐       │
│  │                 SSEEventEmitter                  │       │
│  │           (Typed event emission to client)       │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Stream Execution Flow

```typescript
// server/execution/orchestrator.ts
async *executeStream(options, writeSSE) {
  // 1. Resolve options (session, model, etc.)
  const resolved = await contextCoordinator.resolveOptions(options);

  // 2. Prepare context (load history, check compaction)
  const { context, workingContext } = await contextCoordinator.prepareContext(resolved);

  // 3. Emit context events (system prompt, model info, etc.)
  await this.emitContextEvents(resolved, context, emitter);

  // 4. Build agent options with discovered tools
  const agentOptions = this.buildAgentOptions(resolved, context, logger, emitter);

  // 5. Execute agent
  const streamResult = await cmsAgent.stream({ messages: context.messages, options: agentOptions });

  // 6. Process stream (entity extraction, event emission)
  const result = await streamProcessor.processStream(streamResult, workingContext, emitter);

  // 7. Save session data
  await contextCoordinator.saveSessionData(...);

  emitter.emitDone();
}
```

---

## Agent Context

Tools receive context via `experimental_context`:

```typescript
// server/tools/_types/agent-context.ts
interface AgentContext {
  // Database
  db: DrizzleDB;

  // Services
  services: Services;

  // Vector search
  vectorIndex: VectorIndexService;

  // Logging
  logger: AgentLogger;

  // Optional stream writer
  stream?: StreamWriter;

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

## Tool Categories

| Category     | Count | Tools                                                          | Purpose            |
| ------------ | ----- | -------------------------------------------------------------- | ------------------ |
| Page         | 4     | getPage, createPage, updatePage, deletePage                    | Page CRUD          |
| Section      | 5     | getSection, createSection, updateSection, deleteSection, getSectionTemplate | Section management |
| Entry        | 4     | getEntry, createEntry, updateEntry, deleteEntry                | Collection entries |
| Image        | 6     | getImage, createImage, updateImage, deleteImage, importImage, browseImages | Media management   |
| Post         | 4     | getPost, createPost, updatePost, deletePost                    | Blog content       |
| Navigation   | 4     | getNavItem, createNavItem, updateNavItem, deleteNavItem        | Menu structure     |
| Search       | 2     | searchTools, searchWeb                                         | Discovery & web    |
| Utility      | 3     | finalAnswer, acknowledgeRequest, fetchContent                  | Meta tools         |

---

## Human-in-the-Loop (HITL)

**Conversational Confirmed Flag Pattern**: Destructive tools require explicit confirmation:

```typescript
// Example tool with confirmation
cms_deletePage: tool({
  description: 'Delete a page permanently. Requires confirmed: true.',
  inputSchema: z.object({
    id: z.string(),
    confirmed: z.boolean().optional(),
  }),
  execute: async (input, { experimental_context }) => {
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Delete page "${page.name}"?`,
      };
    }
    await ctx.services.page.delete(input.id);
    return { success: true };
  },
}),
```

**Flow**:
1. User requests deletion
2. Tool called without `confirmed`
3. Returns `{ requiresConfirmation: true, message: "..." }`
4. Agent asks user for confirmation in chat
5. User confirms → tool called with `confirmed: true`

---

## Event Types

| Event                       | Description                          |
| --------------------------- | ------------------------------------ |
| `text-delta`                | Streaming text chunks                |
| `tool-call`                 | Tool invocation started              |
| `tool-result`               | Tool execution completed             |
| `step-start`                | Step boundary                        |
| `step-finish`               | Step completed with usage            |
| `instructions-injected`     | Tool guidance injected (new)         |
| `compaction-triggered`      | Compaction started (new)             |
| `compaction-complete`       | Compaction finished (new)            |
| `finish`                    | Agent completed                      |
| `error`                     | Execution failed                     |

---

## Integration Points

| Connects To         | How                                |
| ------------------- | ---------------------------------- |
| Layer 1 (Server)    | `/api/agent/stream` route          |
| Layer 2 (Database)  | Via services in AgentContext       |
| Layer 4 (Services)  | Tools call services, search        |
| Layer 5 (Background)| Image processing via queues        |
| Layer 6 (Client)    | SSE stream events                  |

---

## Deep Dive Topics

-   [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Three-phase tool lifecycle
-   [3.2 Tools](./LAYER_3.2_TOOLS.md) - Per-tool folder structure
-   [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) - Entity & tool tracking
-   [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - Static system prompt architecture
-   [3.5 HITL](./LAYER_3.5_HITL.md) - Confirmed flag pattern
-   [3.6 Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md) - Retry and repair
-   [3.7 Streaming](./LAYER_3.7_STREAMING.md) - SSE event types
-   [3.8 Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) - AgentContext pattern
