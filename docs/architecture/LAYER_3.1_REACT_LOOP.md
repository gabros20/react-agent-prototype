# Layer 3.1: ReAct Loop (AI SDK 6 Native)

> The core execution loop using native AI SDK 6 `generateText` with `maxSteps`

## Overview

The ReAct (Reasoning + Acting) pattern enables the LLM to break complex tasks into steps, execute tools, observe results, and iterate until complete. Since the AI SDK 6 migration, the loop uses native `generateText` with `maxSteps` instead of custom orchestration.

**Key Files:**
- `server/agent/cms-agent.ts` - Agent module
- `server/agent/system-prompt.ts` - Prompt compilation
- `server/routes/agent.ts` - Route handler

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
│                      AI SDK 6 Agent Loop                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                    generateText()                        │  │
│   │                   (AI SDK v6 Native)                     │  │
│   │                                                          │  │
│   │    maxSteps: 15                                          │  │
│   │    maxRetries: 2 (native exponential backoff)            │  │
│   │    maxTokens: 4096                                       │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                    EXECUTION LOOP                        │  │
│   │                  (SDK-managed internally)                │  │
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
│   │    Stop Conditions (Native):                             │  │
│   │    • No more tool calls                                  │  │
│   │    • Max steps reached (15)                              │  │
│   │    • maxRetries exceeded                                 │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│   ┌─────────────┐     ┌────────────┐        ┌───────────┐       │
│   │ Callbacks   │     │   Native   │        │  Token    │       │
│   │             │     │   Retry    │        │  Tracking │       │
│   │ onStepFinish│     │            │        │           │       │
│   │ onFinish    │     │ maxRetries │        │ usage     │       │
│   └─────────────┘     └────────────┘        └───────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Implementation

### CMS Agent Module

```typescript
// server/agent/cms-agent.ts
import { generateText, type CoreMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { ALL_TOOLS } from '../tools/all-tools';
import { getSystemPrompt } from './system-prompt';
import type { AgentContext } from '../tools/types';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const AGENT_CONFIG = {
  maxSteps: 15,
  modelId: 'openai/gpt-4o-mini',
  maxRetries: 2,
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

### Key Configuration Values

| Parameter    | Value         | Rationale                                                 |
| ------------ | ------------- | --------------------------------------------------------- |
| `maxSteps`   | 15            | Higher than typical (10) for complex multi-step CMS tasks |
| `maxTokens`  | 4096          | Allows detailed reasoning and explanations                |
| `maxRetries` | 2             | Native SDK default, exponential backoff for 429/5xx       |
| `model`      | gpt-4o-mini   | Good balance of capability, speed, and cost               |

---

## Changes from Pre-Migration

### Before (Custom Orchestrator)

```typescript
// OLD: server/agent/orchestrator.ts
const agent = new ToolLoopAgent({
  model: openrouter('gpt-4o-mini'),
  tools: ALL_TOOLS,
  maxSteps: 15,
  experimental_context: context,
  system: compiledSystemPrompt,
  stopWhen: ({ steps, text }) => {
    if (steps.length >= 15) return true;
    if (text?.includes('FINAL_ANSWER:')) return true;
    return false;
  },
});

// Custom retry loop
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    const result = await agent.run(messages);
    return result;
  } catch (error) {
    if (!isRetryable(error) || attempt === MAX_RETRIES) throw error;
    await sleep(calculateBackoff(attempt));
  }
}
```

### After (AI SDK 6 Native)

```typescript
// NEW: server/agent/cms-agent.ts
return generateText({
  model: openrouter(AGENT_CONFIG.modelId),
  system: systemPrompt,
  messages,
  tools: ALL_TOOLS,
  maxSteps: AGENT_CONFIG.maxSteps,
  maxRetries: AGENT_CONFIG.maxRetries,  // Native retry!
  maxTokens: AGENT_CONFIG.maxTokens,
  experimental_context: agentContext,
});
```

### Migration Summary

| Feature | Before | After |
|---------|--------|-------|
| Loop control | Custom `ToolLoopAgent` | Native `generateText` with `maxSteps` |
| Retry logic | Custom `executeWithRetry` | Native `maxRetries: 2` |
| Stop conditions | Custom `stopWhen` callback | SDK stops when no more tool calls |
| Checkpointing | Every 3 steps | End of execution only |
| HITL | Custom `ApprovalQueue` | Native `needsApproval` on tools |
| Entry points | `executeAgentWithRetry`, `streamAgentWithApproval` | Single `runAgent` function |

---

## Stop Conditions

The SDK stops the loop when:

1. **No more tool calls** - LLM responds without calling tools
2. **Max steps reached** - `maxSteps: 15` limit hit
3. **Max retries exceeded** - After `maxRetries: 2` failed attempts

### Prompt-Guided Completion

The agent is instructed to signal completion clearly:

```xml
<instruction>
When the task is complete, provide a clear summary to the user.
If you need to perform multiple actions, execute them one by one.
Always verify each action succeeded before proceeding.
</instruction>
```

**Note**: The `FINAL_ANSWER:` pattern is no longer required - the SDK naturally stops when the LLM stops calling tools.

---

## Callbacks

### onStepFinish (If Needed)

For telemetry or entity extraction, use the result's steps:

```typescript
const result = await runAgent(messages, options);

// Process steps after completion
for (const step of result.steps) {
  if (step.toolResults) {
    for (const toolResult of step.toolResults) {
      const entities = entityExtractor.extract(
        toolResult.toolName,
        toolResult.result
      );
      workingContext.addMany(entities);
    }
  }
}
```

### onFinish (Streaming)

When streaming, use `onFinish` in `streamText`:

```typescript
const result = streamText({
  // ...config
  onFinish: async ({ usage, text, finishReason }) => {
    // Save messages
    await sessionService.saveMessages(sessionId, [
      ...previousMessages,
      { role: 'user', content: prompt },
      { role: 'assistant', content: text },
    ]);

    // Track usage
    logger.info('Agent completed', {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      finishReason,
    });
  },
});
```

---

## Message Flow

### Initial Request

```
┌─────────────────────────────────────────────────────────────────┐
│                      Message Assembly                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. System Prompt (compiled from react.xml)                     │
│     ├── Role definition                                         │
│     ├── Available tools list                                    │
│     ├── Working memory state                                    │
│     └── Instructions & examples                                 │
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
                      generateText({...})
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

| Connects To                                         | How                                 |
| --------------------------------------------------- | ----------------------------------- |
| [3.2 Tools](./LAYER_3.2_TOOLS.md)                   | SDK executes tools from `ALL_TOOLS` |
| [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) | Extract entities from result.steps  |
| [3.4 Prompts](./LAYER_3.4_PROMPTS.md)               | System prompt passed to generateText |
| [3.5 HITL](./LAYER_3.5_HITL.md)                     | Native `needsApproval` on tools     |
| [3.6 Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md) | Native `maxRetries` handles errors  |
| [3.7 Streaming](./LAYER_3.7_STREAMING.md)           | Use `streamText` for real-time      |

---

## Key Design Decisions

### Why generateText over ToolLoopAgent?

AI SDK 6 made `generateText` with `maxSteps` the preferred pattern:

1. **Simpler** - No custom agent class needed
2. **Native retry** - Built-in exponential backoff
3. **Better typing** - Full TypeScript inference
4. **SDK-maintained** - Bug fixes and improvements from Vercel

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
