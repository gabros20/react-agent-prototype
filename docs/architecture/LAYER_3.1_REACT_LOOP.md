# Layer 3.1: ReAct Loop (AI SDK 6 ToolLoopAgent)

> The core execution loop using AI SDK 6 `ToolLoopAgent` class with native stop conditions

## Overview

The ReAct (Reasoning + Acting) pattern enables the LLM to break complex tasks into steps, execute tools, observe results, and iterate until complete. The agent uses `ToolLoopAgent` - a module-level singleton with:
- **`callOptionsSchema`** for type-safe runtime options
- **`prepareCall`** for dynamic instruction injection
- **`stopWhen`** conditions (step count + FINAL_ANSWER detection)
- **`prepareStep`** for context window management

**Key Files:**
- `server/agent/cms-agent.ts` - ToolLoopAgent singleton
- `server/agent/system-prompt.ts` - Modular prompt compilation
- `server/routes/agent.ts` - Route handler with stream/generate

---

## The Problem

LLMs cannot execute multi-step tasks in a single call. When asked to "create a page, add an image, and update navigation," a raw LLM can only produce text - it cannot actually perform these actions or verify they succeeded.

**Without ReAct:**

```
User: "Create an About page with a hero image"
LLM: "I would create a page called About..." (just text, no action)
```

**With ReAct:**

```
User: "Create an About page with a hero image"
Agent:
  1. THINK: I need to create a page first
  2. ACT: cms_createPage({title: "About"})
  3. OBSERVE: Page created with id "page-123"
  4. THINK: Now I need to find a suitable image
  5. ACT: cms_searchImages({query: "hero background"})
  6. OBSERVE: Found 3 images, best match is "img-456"
  7. THINK: Now attach the image to the hero section
  8. ACT: cms_updateSectionImage({imageId: "img-456", ...})
  9. OBSERVE: Image attached successfully
  10. THINK: Task complete, inform user
  → FINAL_ANSWER: Created About page with hero image
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   ToolLoopAgent (Module Singleton)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                 cmsAgent.stream() / .generate()          │  │
│   │                                                          │  │
│   │    model: openrouter/gpt-4o-mini                         │  │
│   │    maxOutputTokens: 4096                                 │  │
│   │    callOptionsSchema: Zod schema for type-safe options   │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                     prepareCall()                        │  │
│   │                                                          │  │
│   │    • Dynamic system prompt via getSystemPrompt()         │  │
│   │    • Working memory injection                            │  │
│   │    • experimental_context setup for tools                │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                    EXECUTION LOOP                        │  │
│   │                                                          │  │
│   │    ┌─────────┐    ┌─────────┐    ┌─────────┐             │  │
│   │    │  THINK  │───▶│   ACT   │───▶│ OBSERVE │──┐          │  │
│   │    │         │    │         │    │         │  │          │  │
│   │    │ Reason  │    │ Call    │    │ Process │  │          │  │
│   │    │ about   │    │ tool    │    │ result  │  │          │  │
│   │    │ next    │    │         │    │         │  │          │  │
│   │    └─────────┘    └─────────┘    └─────────┘  │          │  │
│   │         ▲                                     │          │  │
│   │         └─────────────────────────────────────┘          │  │
│   │                                                          │  │
│   │    stopWhen Conditions (OR logic):                       │  │
│   │    • stepCountIs(15) - max steps reached                 │  │
│   │    • hasFinalAnswer() - FINAL_ANSWER: detected           │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│   ┌─────────────┐     ┌────────────┐        ┌───────────┐       │
│   │ prepareStep │     │ Streaming  │        │  Token    │       │
│   │             │     │  Events    │        │  Tracking │       │
│   │ Message     │     │            │        │           │       │
│   │ trimming    │     │ fullStream │        │ usage     │       │
│   │ (>20 msgs)  │     │ chunks     │        │           │       │
│   └─────────────┘     └────────────┘        └───────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Implementation

### CMS Agent Module (ToolLoopAgent Singleton)

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
  db: z.custom<any>(),
  services: z.custom<any>(),
  sessionService: z.custom<any>(),
  vectorIndex: z.custom<any>(),
  logger: z.custom<any>(),
  stream: z.custom<any>().optional(),
});

// Custom stop condition
const hasFinalAnswer = ({ steps }: { steps: any[] }) => {
  const lastStep = steps[steps.length - 1];
  return lastStep?.text?.includes("FINAL_ANSWER:") || false;
};

// Module-level singleton
export const cmsAgent = new ToolLoopAgent({
  model: openrouter.languageModel(AGENT_CONFIG.modelId),
  instructions: "CMS Agent", // Replaced in prepareCall
  tools: ALL_TOOLS,
  callOptionsSchema: AgentCallOptionsSchema,

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

  stopWhen: [stepCountIs(AGENT_CONFIG.maxSteps), hasFinalAnswer],

  prepareStep: async ({ messages }: { messages: any[] }) => {
    if (messages.length > 20) {
      return {
        messages: [messages[0], ...messages.slice(-10)],
      };
    }
    return {};
  },
});
```

### Key Configuration Values

| Parameter         | Value         | Rationale                                                 |
| ----------------- | ------------- | --------------------------------------------------------- |
| `maxSteps`        | 15            | Higher than typical (10) for complex multi-step CMS tasks |
| `maxOutputTokens` | 4096          | Allows detailed reasoning and explanations                |
| `model`           | gpt-4o-mini   | Good balance of capability, speed, and cost               |
| `stopWhen`        | OR conditions | Step limit OR FINAL_ANSWER detection                      |

---

## Changes from Pre-Migration

### Before (Custom Orchestrator)

```typescript
// OLD: server/agent/orchestrator.ts - DELETED
class CustomOrchestrator {
  async execute(messages, context) {
    // Custom while loop
    while (steps < maxSteps) {
      const result = await this.llmCall(messages);
      if (result.toolCalls) {
        for (const call of result.toolCalls) {
          const output = await this.executeTool(call);
          messages.push(toolResultMessage(output));
        }
      }
      // Custom checkpoint every 3 steps
      if (steps % 3 === 0) {
        await this.checkpoint(messages);
      }
    }
  }
}

// Custom retry wrapper
async function executeWithRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt === maxRetries) throw error;
      await sleep(calculateBackoff(attempt));
    }
  }
}
```

### After (ToolLoopAgent Singleton)

```typescript
// NEW: server/agent/cms-agent.ts
export const cmsAgent = new ToolLoopAgent({
  model: openrouter.languageModel(AGENT_CONFIG.modelId),
  tools: ALL_TOOLS,
  callOptionsSchema: AgentCallOptionsSchema,
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions: getSystemPrompt({ workingMemory: options.workingMemory }),
    experimental_context: buildContext(options),
  }),
  stopWhen: [stepCountIs(15), hasFinalAnswer],
  prepareStep: async ({ messages }) => trimMessages(messages),
});

// Usage in routes
const streamResult = await cmsAgent.stream({ messages, options });
const result = await cmsAgent.generate({ messages, options });
```

### Migration Summary

| Feature | Before | After |
|---------|--------|-------|
| Loop control | Custom while loop | `ToolLoopAgent` class |
| Retry logic | Custom `executeWithRetry` | SDK handles internally |
| Stop conditions | Custom logic | `stopWhen` array with conditions |
| Checkpointing | Every 3 steps | End of execution only |
| HITL | Custom `ApprovalQueue` | Confirmed flag pattern |
| Entry points | Multiple functions | `.stream()` / `.generate()` |
| Options typing | Untyped | `callOptionsSchema` with Zod |
| Instructions | Static at construction | Dynamic via `prepareCall` |

---

## Stop Conditions

The `stopWhen` array defines conditions (OR logic):

```typescript
stopWhen: [
  stepCountIs(AGENT_CONFIG.maxSteps),  // Step limit
  hasFinalAnswer,                       // FINAL_ANSWER: detection
],
```

### Custom Stop Condition

```typescript
const hasFinalAnswer = ({ steps }: { steps: any[] }) => {
  const lastStep = steps[steps.length - 1];
  return lastStep?.text?.includes("FINAL_ANSWER:") || false;
};
```

### Prompt-Guided Completion

The agent is instructed to signal completion:

```xml
<!-- core/base-rules.xml -->
<react-pattern>
**COMPLETION:**
When the task is fully complete, prefix your final response with FINAL_ANSWER:

Do NOT use FINAL_ANSWER until ALL requested actions are completed and verified.
</react-pattern>
```

The loop stops when:
1. **FINAL_ANSWER detected** - LLM explicitly signals completion
2. **Max steps reached** - `stepCountIs(15)` limit hit
3. **No more tool calls** - LLM responds without calling tools (implicit)

---

## Streaming Events

When using `.stream()`, process chunks via `fullStream`:

```typescript
// server/routes/agent.ts
const streamResult = await cmsAgent.stream({ messages, options });

for await (const chunk of streamResult.fullStream) {
  switch (chunk.type) {
    case "text-delta":
      writeSSE("text-delta", { delta: chunk.text });
      break;

    case "tool-call":
      writeSSE("tool-call", {
        toolName: chunk.toolName,
        toolCallId: chunk.toolCallId,
        args: chunk.input,
      });
      break;

    case "tool-result":
      // Extract entities to working memory
      const entities = extractor.extract(chunk.toolName, chunk.output);
      workingContext.addMany(entities);

      writeSSE("tool-result", {
        toolCallId: chunk.toolCallId,
        toolName: chunk.toolName,
        result: chunk.output,
      });
      break;

    case "start-step":
      writeSSE("step-start", { stepNumber: ++currentStep });
      break;

    case "finish-step":
      writeSSE("step-finish", {
        stepNumber: currentStep,
        duration: Date.now() - stepStartTime,
        usage: chunk.usage,
      });
      break;

    case "finish":
      writeSSE("finish", {
        finishReason: chunk.finishReason,
        usage: chunk.totalUsage,
      });
      break;
  }
}
```

### After Stream Completion

```typescript
// Get response messages for persistence
const responseData = await streamResult.response;

await sessionService.saveMessages(sessionId, [
  ...previousMessages,
  { role: "user", content: prompt },
  ...responseData.messages,
]);
```

---

## Message Flow

### Initial Request

```
┌─────────────────────────────────────────────────────────────────┐
│                      Message Assembly                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. System Prompt (compiled from modular XML)                   │
│     ├── core/base-rules.xml (identity, ReAct pattern)           │
│     ├── workflows/cms-pages.xml                                 │
│     ├── workflows/cms-images.xml                                │
│     ├── workflows/cms-posts.xml                                 │
│     ├── workflows/cms-navigation.xml                            │
│     ├── workflows/web-research.xml                              │
│     └── Working memory state ({{{workingMemory}}})              │
│                                                                 │
│  2. Conversation History                                        │
│     ├── Previous user messages                                  │
│     ├── Previous assistant responses                            │
│     └── Previous tool calls & results                           │
│                                                                 │
│  3. Current User Message                                        │
│     └── "Create an About page with a hero section"              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      cmsAgent.stream({...})
```

### Per-Step Flow (SDK Internal)

```
Step N (handled by SDK):
┌─────────────────────────────────────────────────────────────────┐
│ 1. LLM Call                                                     │
│    ├── Send: system + history + user message                    │
│    └── Receive: text and/or tool calls                          │
├─────────────────────────────────────────────────────────────────┤
│ 2. Tool Execution (if tool calls present)                       │
│    ├── For each tool call:                                      │
│    │   ├── Validate input against Zod schema                    │
│    │   ├── Execute tool with experimental_context               │
│    │   └── Collect result                                       │
│    └── Append tool results to messages                          │
├─────────────────────────────────────────────────────────────────┤
│ 3. Continue Check                                               │
│    ├── More tool calls? → Continue to Step N+1                  │
│    ├── Max steps reached? → Stop                                │
│    └── No more calls? → Stop and return                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Memory Management

### SDK Handles Context Window

The SDK manages message history. For very long conversations, implement trimming in the route:

```typescript
// server/routes/agent.ts
let messages = await sessionService.loadMessages(sessionId);

// Trim if too long
if (messages.length > 20) {
  messages = messages.slice(-10);  // Keep last 10
}

// Add new user message
messages.push({ role: 'user', content: prompt });

const result = await runAgent(messages, options);
```

---

## Message Persistence

Messages saved at end of execution only (no mid-step checkpointing):

```typescript
// server/routes/agent.ts
const result = await runAgent(messages, options);

// Save complete conversation
await sessionService.saveMessages(sessionId, [
  ...previousMessages,
  { role: 'user', content: prompt },
  ...result.responseMessages,
]);
```

**Note**: Checkpoint system removed - it was dead code never actually used.

---

## Native Retry Logic

AI SDK 6 handles retries automatically:

```typescript
maxRetries: 2,  // Default
```

**Retry Behavior:**
- **429 (Rate Limit)** → Exponential backoff, retry
- **5xx (Server Error)** → Retry with backoff
- **4xx (Client Error)** → No retry, surface immediately

No custom retry code needed!

---

## Integration Points

| Connects To                                         | How                                   |
| --------------------------------------------------- | ------------------------------------- |
| [3.2 Tools](./LAYER_3.2_TOOLS.md)                   | SDK executes tools from `ALL_TOOLS`   |
| [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) | Extract entities from tool-result     |
| [3.4 Prompts](./LAYER_3.4_PROMPTS.md)               | `prepareCall` injects dynamic prompt  |
| [3.5 HITL](./LAYER_3.5_HITL.md)                     | Confirmed flag pattern on tools       |
| [3.6 Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md) | SDK handles retry internally          |
| [3.7 Streaming](./LAYER_3.7_STREAMING.md)           | `.stream()` method for real-time SSE  |

---

## Key Design Decisions

### Why ToolLoopAgent Class?

1. **Module-level singleton** - Single agent instance across all requests
2. **Type-safe options** - `callOptionsSchema` validates runtime options
3. **Dynamic injection** - `prepareCall` injects context at runtime
4. **Custom stop conditions** - `stopWhen` array with composable conditions
5. **Memory management** - `prepareStep` trims long conversations

### Why All Tools Always Available?

1. **Simplicity** - No complex tool selection logic
2. **Flexibility** - Agent can pivot if initial approach fails
3. **LLM Capability** - Modern LLMs handle large tool sets well
4. **Prompt Guidance** - Instructions guide appropriate tool selection

### Why 15 Max Steps?

- **10 steps** - Too few for complex CMS workflows
- **15 steps** - Handles most real-world tasks
- **20+ steps** - Diminishing returns, risk of loops

### Why No Mid-Step Checkpointing?

- CMS agent completes in seconds, not minutes
- Messages saved at end is sufficient
- Reduces I/O overhead
- Original checkpoint code was never used (dead code)

### Why prepareCall for Instructions?

The `instructions` field in the constructor is a placeholder because:
1. **Working memory changes per call** - Different entities in context
2. **Date changes** - Current date injected dynamically
3. **Module-level singleton** - Can't have per-call constructor args

---

## Debugging Tips

### View Step Details

```typescript
const result = await runAgent(messages, options);

console.log('=== Agent Result ===');
console.log('Steps:', result.steps.length);
console.log('Final text:', result.text);

for (const step of result.steps) {
  console.log('Step:', {
    toolCalls: step.toolCalls?.map(tc => tc.toolName),
    toolResults: step.toolResults?.map(tr => tr.toolName),
  });
}

console.log('Usage:', result.usage);
```

### Common Issues

| Issue                    | Cause                       | Solution                         |
| ------------------------ | --------------------------- | -------------------------------- |
| Agent loops indefinitely | Too many tool calls         | Check maxSteps is set            |
| Agent stops too early    | LLM not calling tools       | Improve prompt with examples     |
| Token limit exceeded     | Long conversation history   | Implement message trimming       |
| Tools not called         | Prompt unclear              | Add explicit tool usage examples |
| 429 errors               | Rate limited                | SDK handles with maxRetries      |

---

## Further Reading

- [3.2 Tools](./LAYER_3.2_TOOLS.md) - How tools are structured and executed
- [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - System prompt composition
- [3.5 HITL](./LAYER_3.5_HITL.md) - Native approval flow
- [AI SDK 6 Agents](https://ai-sdk.dev/docs/agents/building-agents) - Official docs
