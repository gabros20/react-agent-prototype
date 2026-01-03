# Layer 3.1: ReAct Loop (Three-Phase Tool Lifecycle)

> Dynamic tool discovery with cache-safe architecture using AI SDK 6 ToolLoopAgent

## Overview

The ReAct (Reasoning + Acting) pattern enables the LLM to break complex tasks into steps, execute tools, observe results, and iterate until complete. The agent uses `ToolLoopAgent` - a module-level singleton with a **three-phase tool lifecycle**:

1. **Acknowledgment Phase** (Step 0) - Conversational preflight
2. **Discovery Phase** (Step 1) - Tool search via hybrid BM25+vector
3. **Execution Phase** (Step 2+) - Work with discovered tools

**Key Innovation**: Static system prompt + dynamic tool injection via messages = LLM cache preserved (50-90% cost savings).

**Key Files:**
- `server/agents/main-agent.ts` - ToolLoopAgent with three-phase lifecycle
- `server/agents/system-prompt.ts` - Static prompt loader
- `server/execution/orchestrator.ts` - Thin coordination layer
- `server/memory/tool-search/tool-search-manager.ts` - Tool discovery extraction

---

## The Problem

LLMs cannot execute multi-step tasks in a single call. When asked to "create a page, add an image, and update navigation," a raw LLM can only produce text - it cannot actually perform these actions or verify they succeeded.

**Additional Challenge**: With 36+ tools, loading all tools at once wastes context and tokens. The agent needs to discover relevant tools on-demand.

**With Three-Phase ReAct:**

```
User: "Create an About page with a hero image"
Agent:
  Step 0: ACKNOWLEDGE → "I'll create an About page with a hero image for you"
  Step 1: SEARCH → searchTools("create page add image")
          → Discovers: createPage, createSection, importImage
  Step 2: ACT → createPage({title: "About"})
  Step 3: OBSERVE → Page created with id "page-123"
  Step 4: ACT → searchTools("find hero image")
          → Discovers: browseImages, getImage
  Step 5: ACT → browseImages({query: "hero background"})
  ...
  Step N: COMPLETE → finalAnswer("Created About page with hero image")
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   ToolLoopAgent (Cache-Safe Architecture)               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                 STATIC System Prompt                             │  │
│   │                                                                  │  │
│   │    Never changes during execution → LLM cache preserved          │  │
│   │    OpenAI: 50% discount | Anthropic: 90% discount                │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │              THREE-PHASE TOOL LIFECYCLE                          │  │
│   │                                                                  │  │
│   │   ┌────────────┐    ┌────────────┐    ┌────────────┐             │  │
│   │   │  STEP 0    │    │  STEP 1    │    │  STEP 2+   │             │  │
│   │   │            │    │            │    │            │             │  │
│   │   │ Acknowledge│ →  │  Discover  │ →  │  Execute   │             │  │
│   │   │ Request    │    │  Tools     │    │  Actions   │             │  │
│   │   │            │    │            │    │            │             │  │
│   │   │ FORCED:    │    │ AVAILABLE: │    │ AVAILABLE: │             │  │
│   │   │ acknowledge│    │ searchTools│    │ Core +     │             │  │
│   │   │ Request    │    │ finalAnswer│    │ Discovered │             │  │
│   │   │            │    │ acknowledge│    │            │             │  │
│   │   └────────────┘    └────────────┘    └────────────┘             │  │
│   │                                                                  │  │
│   │   Tool Guidance: Injected as MESSAGES (not system prompt)        │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                     STOP CONDITIONS                              │  │
│   │                                                                  │  │
│   │    stopWhen: [                                                   │  │
│   │      stepCountIs(15),           // Max steps                     │  │
│   │      hasToolCall("finalAnswer") // Explicit completion           │  │
│   │    ]                                                             │  │
│   └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Implementation

### Three-Phase prepareStep Logic

```typescript
// server/agents/main-agent.ts
prepareStep: async ({ stepNumber, steps, messages }) => {
  type ToolName = keyof typeof ALL_TOOLS;

  // Extract tools from searchTools results in current steps
  const fromCurrentSteps = toolSearchManager.extractFromSteps(steps);

  // Combine: persisted (previous turns) + current step discoveries
  const discoveredTools = [...new Set([
    ...persistedDiscoveredTools,
    ...fromCurrentSteps
  ])] as ToolName[];

  // Find NEW tools (not seen before in this turn)
  const newlyDiscovered = fromCurrentSteps.filter(
    tool => !toolsWithGuidanceInjected.has(tool)
  );

  // Inject tool guidance as MESSAGES (preserves cache)
  let updatedMessages = [...messages];
  if (newlyDiscovered.length > 0 && stepNumber > 0) {
    const guidanceMessages = createToolGuidanceMessages(
      newlyDiscovered,
      [...toolsWithGuidanceInjected]
    );
    updatedMessages = [...updatedMessages, ...guidanceMessages];

    // Mark tools as having guidance
    newlyDiscovered.forEach(tool => toolsWithGuidanceInjected.add(tool));
  }

  // PHASE 1: Acknowledgment (Step 0)
  // Force acknowledgeRequest for conversational preflight
  if (stepNumber === 0) {
    return {
      activeTools: [...CORE_TOOLS] as ToolName[],
      toolChoice: { type: "tool", toolName: "acknowledgeRequest" },
      messages: updatedMessages,
    };
  }

  // PHASE 2: Discovery (Step 1, no tools yet)
  // Agent uses searchTools to find capabilities
  if (stepNumber === 1 && discoveredTools.length === 0) {
    return {
      activeTools: [...CORE_TOOLS] as ToolName[],
      toolChoice: "auto",
      messages: updatedMessages,
    };
  }

  // PHASE 3: Execution (tools discovered)
  // All discovered tools + core tools available
  const activeTools = [...new Set([...CORE_TOOLS, ...discoveredTools])] as ToolName[];
  return {
    activeTools,
    toolChoice: "auto",
    messages: updatedMessages,
  };
},
```

### Core Tools

```typescript
const CORE_TOOLS = ['searchTools', 'finalAnswer', 'acknowledgeRequest'];
```

| Tool               | Purpose                                  | Phase      |
| ------------------ | ---------------------------------------- | ---------- |
| `acknowledgeRequest`| Conversational preflight response       | Step 0     |
| `searchTools`       | Discover relevant tools via hybrid search| Step 1+    |
| `finalAnswer`       | Signal task completion                   | Any step   |

---

## Module-Level State

```typescript
// WARNING: AI SDK limitation - prepareStep doesn't receive context
// Module-level state overwritten per-request in prepareCall

/** Discovered tools from previous turns (loaded from WorkingContext) */
let persistedDiscoveredTools: string[] = [];

/** Tools that have had guidance injected this turn */
let toolsWithGuidanceInjected: Set<string> = new Set();

/** Callback for SSE emission */
let onInstructionsInjectedCallback: ((data) => void) | null = null;
```

**Why Module-Level?**
- `prepareStep` doesn't receive `experimental_context`
- Each request overwrites state via `prepareCall`
- Single-process Node.js handles requests sequentially
- Future: AsyncLocalStorage for multi-instance safety

---

## Tool Discovery Flow

### searchTools Integration

```typescript
// Tool search result structure
interface SearchToolsResult {
  tools?: string[];      // Discovered tool names
  message?: string;      // Search summary
}

// ToolSearchManager extracts tools from step results
extractFromSteps(steps: StepResult[]): string[] {
  const tools = new Set<string>();

  for (const step of steps) {
    const searchResults = step.toolResults?.filter(
      tr => tr.toolName === 'searchTools'
    );

    searchResults?.forEach(sr => {
      const output = sr.output as SearchToolsResult;
      output?.tools?.forEach(toolName => tools.add(toolName));
    });
  }

  return Array.from(tools);
}
```

### Tool Guidance Injection (Cache-Safe)

```typescript
// server/prompts/messages/tool-guidance-messages.ts
export function createToolGuidanceMessages(
  newTools: string[],
  existingTools: string[]
): ModelMessage[] {
  const injector = new ToolPromptInjector();
  injector.addTools(newTools);
  const toolGuidance = injector.build();

  return [
    {
      role: "user",
      content: `[TOOL GUIDANCE] New tools now available: ${newTools.join(", ")}

Here are the usage guidelines:

${toolGuidance}

Please follow these guidelines when using these tools.`,
    },
    {
      role: "assistant",
      content: `I understand. I now have access to: ${newTools.join(", ")}. I'll follow the provided guidelines.`,
    },
  ];
}
```

**Why Messages Instead of System Prompt?**
- System prompt changes → LLM cache invalidated → expensive
- Messages append to conversation → system prompt unchanged → cache hit
- Same guidance effect, massive cost savings

---

## Stop Conditions

```typescript
stopWhen: [
  stepCountIs(AGENT_CONFIG.maxSteps),  // 15 steps max
  hasToolCall("finalAnswer"),           // Explicit completion
],
```

### The finalAnswer Tool

```typescript
// The agent calls finalAnswer to complete the task
export const finalAnswer = tool({
  description: "Complete the task with a final response to the user",
  inputSchema: z.object({
    response: z.string().describe("The final response to show the user"),
    summary: z.string().optional().describe("Brief summary of what was accomplished"),
  }),
  execute: async (input) => {
    return {
      success: true,
      response: input.response,
      summary: input.summary,
    };
  },
});
```

The loop stops when:
1. **finalAnswer called** - Agent explicitly signals completion
2. **Max steps reached** - `stepCountIs(15)` limit hit

---

## Execution Flow

### Stream Execution

```typescript
// server/execution/orchestrator.ts
async *executeStream(options, writeSSE) {
  // 1. Resolve options and prepare context
  const resolved = await contextCoordinator.resolveOptions(options);
  const { context, workingContext } = await contextCoordinator.prepareContext(resolved);

  // 2. Build agent options with discovered tools from previous turns
  const agentOptions = {
    sessionId: resolved.sessionId,
    traceId: resolved.traceId,
    modelId: resolved.modelId,
    discoveredTools: context.discoveredTools,  // From WorkingContext
    // ... services
  };

  // 3. Execute agent
  const streamResult = await cmsAgent.stream({
    messages: context.messages,
    options: agentOptions,
  });

  // 4. Process stream
  const result = await streamProcessor.processStream(
    streamResult,
    workingContext,
    logger,
    emitter
  );

  // 5. Save session data (with discovered tools persisted)
  await contextCoordinator.saveSessionData(...);
}
```

### Stream Events

```typescript
for await (const chunk of streamResult.fullStream) {
  switch (chunk.type) {
    case "text-delta":
      emitter.emitTextDelta(chunk.text);
      break;

    case "tool-call":
      emitter.emitToolCall(chunk.toolName, chunk.toolCallId, chunk.input);
      break;

    case "tool-result":
      // Extract entities for working memory
      const entities = extractor.extract(chunk.toolName, chunk.output);
      workingContext.addEntities(entities);

      // Track discovered tools
      if (chunk.toolName === 'searchTools') {
        const tools = chunk.output.tools || [];
        workingContext.addDiscoveredTools(tools);
      }

      emitter.emitToolResult(chunk.toolCallId, chunk.toolName, chunk.output);
      break;

    case "step-finish":
      emitter.emitStepFinish(chunk.stepNumber, chunk.usage);
      break;

    case "finish":
      emitter.emitFinish(chunk.finishReason, chunk.totalUsage);
      break;
  }
}
```

---

## Configuration

```typescript
export const AGENT_CONFIG = {
  maxSteps: 15,              // Higher for complex CMS tasks
  modelId: "openai/gpt-4o-mini",
  maxOutputTokens: 4096,
} as const;
```

| Parameter         | Value         | Rationale                                     |
| ----------------- | ------------- | --------------------------------------------- |
| `maxSteps`        | 15            | Complex CMS workflows need multiple steps     |
| `maxOutputTokens` | 4096          | Detailed reasoning and explanations           |
| `model`           | gpt-4o-mini   | Good balance of capability, speed, cost       |

---

## Message Persistence

Messages and discovered tools saved after execution:

```typescript
// Save session data with working context
await contextCoordinator.saveSessionData(
  sessionId,
  previousMessages,
  prompt,
  responseMessages,
  workingContext,    // Contains discoveredTools
  logger,
  displayTexts,
  usage              // Provider tokens for compaction decisions
);
```

The `WorkingContext` persists:
- Entities (pages, sections, images)
- Discovered tools (for next turn's `persistedDiscoveredTools`)

---

## Error Handling

### experimental_repairToolCall

```typescript
experimental_repairToolCall: async ({ toolCall, error }) => {
  // Don't repair unknown tools
  if (NoSuchToolError.isInstance(error)) {
    console.warn(`Unknown tool: ${toolCall.toolName}`);
    return null;
  }

  // Log invalid input, let model retry naturally
  if (InvalidToolInputError.isInstance(error)) {
    console.warn(`Invalid input for ${toolCall.toolName}:`, error.message);
    return null;
  }

  return null;
},
```

### Native Retry Logic

AI SDK 6 handles retries automatically:
- **429 (Rate Limit)** → Exponential backoff
- **5xx (Server Error)** → Retry with backoff
- **4xx (Client Error)** → No retry, surface immediately

---

## Key Design Decisions

### Why Three Phases?

1. **Step 0 (Acknowledge)** - Creates natural conversation flow, user sees immediate response
2. **Step 1 (Discovery)** - Agent only gets tools it needs, reduces context waste
3. **Step 2+ (Execution)** - Work with minimal, relevant toolset

### Why Static System Prompt?

All LLM providers use prefix-based caching:
- Changing system prompt = cache invalidated
- Static prompt = 50-90% cost reduction
- Dynamic content moved to conversation messages

### Why Tool Guidance as Messages?

```xml
<!-- OLD: In system prompt (breaks cache) -->
<tool-usage-instructions>{{{activeProtocols}}}</tool-usage-instructions>

<!-- NEW: As conversation messages (preserves cache) -->
[USER] [TOOL GUIDANCE] New tools: createPage, updatePage...
[ASSISTANT] I understand. I now have access to...
```

Same effect, dramatically lower cost.

### Why Module-Level State?

AI SDK limitation: `prepareStep` doesn't receive `experimental_context`. Module-level state with per-request overwrite is the cleanest workaround.

---

## Integration Points

| Connects To                                         | How                               |
| --------------------------------------------------- | --------------------------------- |
| [3.2 Tools](./LAYER_3.2_TOOLS.md)                   | Per-tool folder structure         |
| [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) | Entity + discovered tool tracking |
| [3.4 Prompts](./LAYER_3.4_PROMPTS.md)               | Static system prompt              |
| [3.7 Streaming](./LAYER_3.7_STREAMING.md)           | SSE events during execution       |
| Layer 4 Services                                    | Tool search service               |

---

## Debugging Tips

### View Discovery Flow

```typescript
// Log in prepareStep shows tool discovery
console.log(`[prepareStep] Step ${stepNumber} | Tools: ` +
  `persisted=${persistedDiscoveredTools.length}, ` +
  `current=${fromCurrentSteps.length}, ` +
  `new=${newlyDiscovered.length}, ` +
  `total=${discoveredTools.length}`
);
```

### Common Issues

| Issue                     | Cause                          | Solution                          |
| ------------------------- | ------------------------------ | --------------------------------- |
| No tools discovered       | searchTools not called         | Check Step 1 logic                |
| Tools not available       | Not in activeTools array       | Check prepareStep returns         |
| Guidance not showing      | Messages not updated           | Check guidanceMessages injection  |
| Agent loops on discovery  | searchTools called repeatedly  | Check tool availability by step   |

---

## Further Reading

- [3.2 Tools](./LAYER_3.2_TOOLS.md) - Per-tool folder structure
- [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) - Entity tracking
- [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - Static system prompt
- [3.7 Streaming](./LAYER_3.7_STREAMING.md) - SSE events
- [AI SDK 6 Agents](https://ai-sdk.dev/docs/agents) - Official docs
