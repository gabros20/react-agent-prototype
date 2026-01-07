# Session Processor

> **Summary**: The Session Processor runs the core agent loop using AI SDK 6. It handles error retry, doom loop detection, tool name repair, and translates AgentConfig into AI SDK parameters.
>
> **Prerequisites**: [../00-overview.md](../00-overview.md), [../1-subsystems/02-agent-server.md](../1-subsystems/02-agent-server.md)

## Overview

The Session Processor runs the agent loop for **ONE session**. It:
- Translates `AgentConfig` to AI SDK 6 calls
- Handles tool execution with context injection
- Manages retry logic and error handling
- Detects doom loops
- Repairs incorrect tool names

---

## Error Handling Strategy

The agent loop handles errors at three levels:

| Error Type | Behavior | Example |
|------------|----------|---------|
| **Retryable API error** | Retry with backoff (max 3 attempts, 30s max delay) | Network timeout, rate limit (429), server error (5xx) |
| **Non-retryable tool error** | Return error to agent, let it decide next action | Invalid input, resource not found, validation failure |
| **Fatal error** | Abort session, emit `session.error` event | Auth failure, malformed response, abort signal |

### Retry Logic

```typescript
interface RetryConfig {
  maxAttempts: 3;
  maxDelayMs: 30_000;  // Cap delay at 30 seconds
}

async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let attempt = 0;

  while (attempt < config.maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempt++;

      if (!isRetryableError(error) || attempt >= config.maxAttempts) {
        throw error;
      }

      const delay = getRetryDelay(error, config.maxDelayMs);
      await sleep(delay);
    }
  }
}

function getRetryDelay(error: unknown, maxDelay: number): number {
  // 1. Check for retry-after-ms header (milliseconds)
  if (error.headers?.['retry-after-ms']) {
    return Math.min(parseInt(error.headers['retry-after-ms']), maxDelay);
  }

  // 2. Check for retry-after header (seconds)
  if (error.headers?.['retry-after']) {
    return Math.min(parseInt(error.headers['retry-after']) * 1000, maxDelay);
  }

  // 3. Default exponential backoff capped at maxDelay
  return Math.min(1000 * Math.pow(2, attempt), maxDelay);
}

function isRetryableError(error: unknown): boolean {
  return (
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    error.status === 429 ||  // Rate limit
    error.status === 503 ||  // Service unavailable
    error.status === 502 ||  // Bad gateway
    (error.status >= 500 && error.status < 600)
  );
}
```

---

## Doom Loop Detection

A doom loop occurs when the agent repeatedly takes the same ineffective action.

### Detection Criteria

- **Same tool called 3+ times** with **exactly identical parameters** (compared via `JSON.stringify`)
- Comparison is exact - no fuzzy matching

### Permission Modes

```typescript
interface AgentConfig {
  doomLoop: 'ask' | 'deny' | 'allow';
}
```

| Mode | Behavior | Use Case |
|------|----------|----------|
| `'ask'` | Pause and request HITL guidance | Default for most agents |
| `'deny'` | Block the repeated call, return error | Strict agents |
| `'allow'` | Allow the call, log warning | Research agents doing iterative refinement |

### Implementation

```typescript
class DoomLoopDetector {
  private recentCalls: Map<string, { params: string; count: number }[]> = new Map();

  check(sessionId: string, toolName: string, params: unknown): 'allow' | 'blocked' {
    const key = `${sessionId}:${toolName}`;
    const paramsStr = JSON.stringify(params);  // Exact comparison

    const history = this.recentCalls.get(key) || [];
    const matchingCall = history.find(h => h.params === paramsStr);

    if (matchingCall) {
      matchingCall.count++;
      if (matchingCall.count >= 3) {
        return 'blocked';  // Doom loop detected
      }
    } else {
      history.push({ params: paramsStr, count: 1 });
    }

    // Keep only last 5 unique calls per tool
    this.recentCalls.set(key, history.slice(-5));
    return 'allow';
  }

  reset(sessionId: string): void {
    // Clear history when session receives new user input
    for (const key of this.recentCalls.keys()) {
      if (key.startsWith(sessionId)) {
        this.recentCalls.delete(key);
      }
    }
  }
}
```

---

## Tool Name Repair

LLMs occasionally call tools with incorrect casing. Before rejecting, attempt case-insensitive repair:

```typescript
function repairToolName(
  requestedName: string,
  availableTools: Map<string, ToolDefinition>
): string | null {
  // 1. Exact match - return as-is
  if (availableTools.has(requestedName)) {
    return requestedName;
  }

  // 2. Case-insensitive match
  const lowerRequested = requestedName.toLowerCase();
  for (const [name, tool] of availableTools) {
    if (name.toLowerCase() === lowerRequested) {
      return name;  // Return correct casing
    }
  }

  // 3. No match found
  return null;
}

// Usage in SessionProcessor
async function executeTool(call: ToolCall, ctx: ToolContext) {
  const repairedName = repairToolName(call.name, this.availableTools);

  if (!repairedName) {
    return {
      success: false,
      error: `Unknown tool: ${call.name}. Available: ${[...this.availableTools.keys()].join(', ')}`
    };
  }

  const tool = this.availableTools.get(repairedName);
  return await tool.execute(call.arguments, ctx);
}
```

---

## Processor Result Type

```typescript
interface ProcessorResult {
  finalResponse: string;
  artifacts: string[];
  totalTokens: number;
  totalSteps: number;
}
```

---

## AI SDK 6 Integration

The processor translates `AgentConfig` fields to AI SDK 6 parameters:

```typescript
import {
  streamText,
  stepCountIs,
  hasToolCall,
  smoothStream,
  type StopCondition
} from 'ai';

class SessionProcessor {
  async run(
    sessionId: string,
    userMessage: string,
    abortSignal: AbortSignal,
  ): Promise<ProcessorResult> {
    const session = await this.sessionStore.get(sessionId);
    const agent = await this.agentFactory.get(session.agentId, session.cmsType);
    const adapter = await this.adapterRegistry.get(session.cmsType);

    // 1. Check compaction
    if (await this.compaction.shouldCompact(session, agent.model)) {
      await this.compaction.compact(session);
    }

    // 2. Resolve tools
    const tools = await this.resolveTools(agent, adapter, userMessage);

    // 3. Build tool context
    const toolContext: ToolContext = {
      sessionId,
      agentId: session.agentId,
      userId: session.userId,
      cmsType: session.cmsType,
      abortSignal,
      eventBus: this.eventBus,
      orchestrator: this.orchestrator,
      spawningMode: agent.spawning?.mode || 'parallel',
    };

    // 4. Build AI SDK tools with context injection
    const aiSdkTools = this.buildAiSdkTools(tools, toolContext, agent);

    // 5. Build messages
    const systemPrompt = await this.buildSystemPrompt(agent, adapter);
    const messages = [
      ...session.messages,
      { role: 'user' as const, content: userMessage },
    ];

    // 6. Build stop conditions from AgentConfig
    const stopConditions = this.buildStopConditions(agent);

    // 7. Build prepareStep callback from AgentConfig
    const prepareStep = this.buildPrepareStep(agent, tools);

    // 8. Build streaming transform
    const transform = agent.streaming?.smoothStream
      ? smoothStream({
          delayInMs: agent.streaming.delayMs || 15,
          chunking: agent.streaming.chunking || 'word',
        })
      : undefined;

    // 9. Execute with AI SDK 6 streamText
    const result = await streamText({
      model: this.getModel(agent.model.default),
      system: systemPrompt,
      messages,
      tools: aiSdkTools,
      toolChoice: agent.tools.toolChoice || 'auto',

      // Loop control
      stopWhen: stopConditions,
      prepareStep,

      // Model settings
      temperature: agent.model.temperature,
      topP: agent.model.topP,
      maxOutputTokens: agent.model.maxOutputTokens,

      // Streaming
      experimental_transform: transform,

      // Abort
      abortSignal,

      // Callbacks
      onStepFinish: ({ stepType, usage, toolCalls }) => {
        this.eventBus.publish('agent.thinking', {
          sessionId,
          stepType,
          toolCalls: toolCalls?.map(tc => tc.toolName),
        });
      },
    });

    // 10. Consume stream and collect results
    const artifacts: string[] = [];
    let finalResponse = '';

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        finalResponse += part.textDelta;
      }
      if (part.type === 'tool-result' && part.result?.artifacts) {
        artifacts.push(...part.result.artifacts);
      }
    }

    // 11. Get final metrics
    const { steps, usage } = await result;

    // 12. Persist final response
    await this.sessionStore.addMessage(sessionId, {
      role: 'assistant',
      content: finalResponse,
    });

    return {
      finalResponse,
      artifacts,
      totalTokens: usage?.totalTokens || 0,
      totalSteps: steps.length,
    };
  }
}
```

---

## Stop Conditions

Build AI SDK 6 `stopWhen` from AgentConfig:

```typescript
private buildStopConditions(agent: AgentConfig): StopCondition<any>[] {
  const conditions: StopCondition<any>[] = [];

  // Always add maxSteps
  conditions.push(stepCountIs(agent.loop.maxSteps));

  // Add custom stop conditions
  if (agent.loop.stopConditions) {
    for (const cond of agent.loop.stopConditions) {
      if (cond.onToolCall) {
        conditions.push(hasToolCall(cond.onToolCall));
      }
      if (cond.onTextContains) {
        const marker = cond.onTextContains;
        conditions.push(({ steps }) =>
          steps.some(s => s.text?.includes(marker)) ?? false
        );
      }
    }
  }

  return conditions;
}
```

---

## prepareStep Callback

Build per-step behavior modifications:

```typescript
private buildPrepareStep(agent: AgentConfig, tools: Record<string, any>) {
  const behavior = agent.loop.stepBehavior;
  if (!behavior) return undefined;

  return async ({ stepNumber, steps }) => {
    const result: any = {};

    // Restrict tools after N steps
    if (behavior.restrictToolsAfterStep &&
        stepNumber >= behavior.restrictToolsAfterStep.step) {
      result.activeTools = behavior.restrictToolsAfterStep.tools;
    }

    // Switch model after N steps
    if (behavior.switchModelAfterStep &&
        stepNumber >= behavior.switchModelAfterStep.step) {
      result.model = this.getModel(behavior.switchModelAfterStep.model);
    }

    // Change tool choice after N steps
    if (behavior.changeToolChoiceAfterStep &&
        stepNumber >= behavior.changeToolChoiceAfterStep.step) {
      result.toolChoice = behavior.changeToolChoiceAfterStep.toolChoice;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  };
}
```

---

## AgentConfig to AI SDK 6 Mapping

| AgentConfig | AI SDK 6 | Notes |
|-------------|----------|-------|
| `model.default` | `model` | Provider model string |
| `model.temperature` | `temperature` | 0-1 |
| `model.topP` | `topP` | 0-1 |
| `model.maxOutputTokens` | `maxOutputTokens` | Per-response limit |
| `tools.toolChoice` | `toolChoice` | 'auto' \| 'required' \| 'none' |
| `loop.maxSteps` | `stopWhen: stepCountIs(n)` | Primary stop condition |
| `loop.stopConditions.onToolCall` | `stopWhen: hasToolCall(name)` | Stop on tool |
| `loop.stopConditions.onTextContains` | Custom `StopCondition` | Stop on text marker |
| `loop.stepBehavior.restrictToolsAfterStep` | `prepareStep → activeTools` | Dynamic tool filtering |
| `loop.stepBehavior.switchModelAfterStep` | `prepareStep → model` | Dynamic model switching |
| `streaming.smoothStream` | `experimental_transform: smoothStream()` | Smooth streaming |
| `spawning.mode` | Custom execution logic | parallel \| sequential |

---

## Key Design Points

| Aspect | Design Decision |
|--------|-----------------|
| **AI SDK 6 native** | Uses `streamText` with `stopWhen` and `prepareStep` |
| **Config-driven** | All behavior controlled via AgentConfig |
| **Spawning mode** | Parallel (Promise.all) or sequential (for loop) |
| **Stop conditions** | Multiple conditions via array, any triggers stop |
| **Dynamic behavior** | `prepareStep` enables per-step modifications |
| **Streaming** | Optional smooth streaming with configurable chunking |

---

## Related Documents

- → [../1-subsystems/02-agent-server.md](../1-subsystems/02-agent-server.md) - Processor in context
- → [../1-subsystems/03-tool-subsystem.md](../1-subsystems/03-tool-subsystem.md) - Tool resolution
- → [13-event-bus.md](13-event-bus.md) - Events emitted
- ↗ [../4-appendices/appendix-a-schemas.md](../4-appendices/appendix-a-schemas.md) - Full AgentConfig
