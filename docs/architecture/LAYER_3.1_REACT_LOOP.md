# Layer 3.1: ReAct Loop & Orchestrator

> The core execution loop that enables multi-step autonomous task completion

## Overview

The ReAct (Reasoning + Acting) pattern is the foundation of our agent system. It enables the LLM to break complex tasks into steps, execute tools, observe results, and iterate until the task is complete.

**Key File:** `server/agent/orchestrator.ts`

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
│                      ReAct Orchestrator                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                    ToolLoopAgent                         │  │
│   │                   (AI SDK v6 Native)                     │  │
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
│   │    Stop Conditions:                                      │  │
│   │    • FINAL_ANSWER detected                               │  │
│   │    • Max steps reached (15)                              │  │
│   │    • Error threshold exceeded                            │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│   ┌───────────┐       ┌───────────┐        ┌───────────┐        │
│   │ Lifecycle │       │   Retry   │        │ Checkpoint│        │
│   │   Hooks   │       │   Logic   │        │   System  │        │
│   │           │       │           │        │           │        │
│   │ prepareStep│      │ Exponential│       │ Every 3   │        │
│   │ onStepFinish│     │ backoff   │        │ steps     │        │
│   └───────────┘       └───────────┘        └───────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Implementation

### ToolLoopAgent Configuration

```typescript
// server/agent/orchestrator.ts
import { ToolLoopAgent } from "ai";

const agent = new ToolLoopAgent({
	// Model configuration
	model: openrouter("openai/gpt-4o-mini"),
	maxOutputTokens: 4096,

	// Tool availability - ALL tools always available
	tools: ALL_TOOLS,

	// Loop control
	maxSteps: 15,

	// Context injection for tools
	experimental_context: agentContext,

	// System prompt (compiled from template)
	system: compiledSystemPrompt,

	// Stop condition
	stopWhen: ({ steps, text }) => {
		// Stop if max steps reached
		if (steps.length >= 15) return true;

		// Stop if FINAL_ANSWER detected
		if (text?.includes("FINAL_ANSWER:")) return true;

		return false;
	},
});
```

### Key Configuration Values

| Parameter         | Value       | Rationale                                                 |
| ----------------- | ----------- | --------------------------------------------------------- |
| `maxSteps`        | 15          | Higher than typical (10) for complex multi-step CMS tasks |
| `maxOutputTokens` | 4096        | Allows detailed reasoning and explanations                |
| `model`           | gpt-4o-mini | Good balance of capability, speed, and cost               |

---

## Lifecycle Hooks

### prepareStep

Called before each step executes:

```typescript
prepareStep: async ({ messages, stepNumber }) => {
	// 1. Memory trimming (prevent token overflow)
	if (messages.length > 20) {
		const systemPrompt = messages[0]; // Keep system prompt
		const recentMessages = messages.slice(-10); // Keep last 10
		return [systemPrompt, ...recentMessages]; // Total: 11 messages
	}

	// 2. Auto-checkpoint every 3 steps
	if (stepNumber % 3 === 0) {
		await sessionService.saveMessages(sessionId, messages);
		logger.info(`Checkpoint saved at step ${stepNumber}`);
	}

	return messages;
};
```

### onStepFinish

Called after each step completes:

```typescript
onStepFinish: async ({ step, stepNumber, usage }) => {
	// 1. Extract entities for working memory
	if (step.toolResults) {
		for (const result of step.toolResults) {
			const entities = entityExtractor.extract(result.toolName, result.result);
			workingContext.addEntities(entities);
		}
	}

	// 2. Stream progress to frontend
	stream.write({
		type: "step-completed",
		stepNumber,
		usage: {
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
		},
	});

	// 3. Log for debugging
	logger.info(`Step ${stepNumber} completed`, {
		toolsCalled: step.toolCalls?.map((tc) => tc.name),
		tokensUsed: usage.totalTokens,
	});
};
```

---

## Stop Conditions

The loop terminates when any condition is met:

### 1. FINAL_ANSWER Detection

The agent signals task completion:

```typescript
// In stopWhen callback
if (text?.includes("FINAL_ANSWER:")) {
	return true; // Stop the loop
}
```

**Prompt Instruction:**

```xml
<instruction>
When the task is complete, respond with:
FINAL_ANSWER: [your response to the user]

Do NOT use FINAL_ANSWER until all requested actions are completed.
</instruction>
```

### 2. Max Steps Reached

Hard limit prevents infinite loops:

```typescript
if (steps.length >= 15) {
	logger.warn("Max steps reached, forcing stop");
	return true;
}
```

### 3. Error Threshold (Implicit)

After multiple failures, the retry logic stops and surfaces the error.

---

## Two Entry Points

### 1. executeAgentWithRetry (Non-Streaming)

For background tasks or when streaming isn't needed:

```typescript
export async function executeAgentWithRetry(messages: CoreMessage[], context: AgentContext): Promise<AgentResult> {
	const agent = createAgent(context);

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const result = await agent.run(messages);
			return result;
		} catch (error) {
			if (!isRetryable(error) || attempt === MAX_RETRIES) {
				throw error;
			}
			await sleep(calculateBackoff(attempt));
		}
	}
}
```

### 2. streamAgentWithApproval (Streaming + HITL)

For interactive use with real-time feedback:

```typescript
export async function* streamAgentWithApproval(messages: CoreMessage[], context: AgentContext): AsyncGenerator<StreamEvent> {
	const agent = createAgent(context);

	for await (const chunk of agent.stream(messages)) {
		// Handle approval requests
		if (chunk.type === "tool-approval-request") {
			yield { type: "approval-required", ...chunk };

			// Wait for user decision
			const approved = await approvalQueue.waitForApproval(chunk.approvalId);

			if (!approved) {
				yield { type: "tool-result", result: { cancelled: true } };
				continue;
			}
		}

		// Forward all other events
		yield chunk;
	}
}
```

---

## Message Flow

### Initial Request

```
┌─────────────────────────────────────────────────────────────────┐
│                      Message Assembly                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. System Prompt (compiled from react.xml)                     │
│     ├── Role definition                                         │
│     ├── Available tools list                                    │
│     ├── Working memory state                                    │
│     └── Instructions & examples                                 │
│                                                                  │
│  2. Conversation History                                        │
│     ├── Previous user messages                                  │
│     ├── Previous assistant responses                            │
│     └── Previous tool calls & results                           │
│                                                                  │
│  3. Current User Message                                        │
│     └── "Create an About page with a hero section"              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      ToolLoopAgent.run()
```

### Per-Step Flow

```
Step N:
┌─────────────────────────────────────────────────────────────────┐
│ 1. prepareStep()                                                 │
│    ├── Trim messages if > 20                                    │
│    └── Save checkpoint if step % 3 === 0                        │
├─────────────────────────────────────────────────────────────────┤
│ 2. LLM Call                                                      │
│    ├── Send: system + history + user message                    │
│    └── Receive: text and/or tool calls                          │
├─────────────────────────────────────────────────────────────────┤
│ 3. Tool Execution (if tool calls present)                        │
│    ├── For each tool call:                                      │
│    │   ├── Validate input against Zod schema                    │
│    │   ├── Execute tool with AgentContext                       │
│    │   └── Collect result                                       │
│    └── Append tool results to messages                          │
├─────────────────────────────────────────────────────────────────┤
│ 4. onStepFinish()                                                │
│    ├── Extract entities from tool results                       │
│    ├── Update working memory                                    │
│    └── Stream step-completed event                              │
├─────────────────────────────────────────────────────────────────┤
│ 5. stopWhen() Check                                              │
│    ├── FINAL_ANSWER in text? → Stop                             │
│    ├── Max steps reached? → Stop                                │
│    └── Otherwise → Continue to Step N+1                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Memory Management

### Why Trimming Matters

Without trimming, long conversations cause:

-   Token limit exceeded errors
-   Slow response times
-   Increased costs

### Trimming Strategy

```typescript
// Keep system prompt + last 10 messages
if (messages.length > 20) {
	const systemPrompt = messages[0];
	const recentMessages = messages.slice(-10);
	return [systemPrompt, ...recentMessages];
}
```

**Preserved:**

-   System prompt (always index 0)
-   Last 10 messages (most recent context)

**Dropped:**

-   Middle messages (old context)
-   Old tool calls/results

**Result:** Maximum 11 messages (manageable token count)

---

## Automatic Checkpointing

Checkpoints enable recovery from failures:

```typescript
// Every 3 steps, save state
if (stepNumber % 3 === 0) {
	await sessionService.saveMessages(sessionId, messages);
}
```

**What's Saved:**

-   Full message history
-   Current step number
-   Working memory state (serialized)

**Recovery:**

```typescript
// On session resume
const checkpoint = await sessionService.loadCheckpoint(sessionId);
if (checkpoint) {
	messages = checkpoint.messages;
	workingMemory.restore(checkpoint.workingMemory);
}
```

---

## Integration Points

| Connects To                                         | How                                 |
| --------------------------------------------------- | ----------------------------------- |
| [3.2 Tools](./LAYER_3.2_TOOLS.md)                   | Executes tool calls from LLM        |
| [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) | Updates entities after tool results |
| [3.4 Prompts](./LAYER_3.4_PROMPTS.md)               | Receives compiled system prompt     |
| [3.5 HITL](./LAYER_3.5_HITL.md)                     | Pauses for approval when needed     |
| [3.6 Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md) | Retry logic wraps execution         |
| [3.7 Streaming](./LAYER_3.7_STREAMING.md)           | Emits events for frontend           |

---

## Key Design Decisions

### Why All Tools Always Available?

We don't filter tools based on context because:

1. **Simplicity** - No complex tool selection logic
2. **Flexibility** - Agent can pivot if initial approach fails
3. **LLM Capability** - Modern LLMs handle large tool sets well
4. **Prompt Guidance** - Instructions guide appropriate tool selection

### Why 15 Max Steps?

-   **10 steps** - Too few for complex CMS workflows (page + sections + images + nav)
-   **15 steps** - Handles most real-world tasks
-   **20+ steps** - Diminishing returns, risk of loops

### Why Checkpoint Every 3 Steps?

-   **Every step** - Too much I/O overhead
-   **Every 3 steps** - Good balance of safety vs performance
-   **Every 5+ steps** - Too much work lost on failure

---

## Patterns NOT Used

For clarity, we explicitly don't use:

| Pattern             | Reason                                  |
| ------------------- | --------------------------------------- |
| Plan-then-execute   | Adds latency, reduces flexibility       |
| Tool filtering      | LLM handles full tool set well          |
| Multi-agent routing | Single agent sufficient for CMS domain  |
| Parallel tool calls | Sequential is simpler, more predictable |

---

## Debugging Tips

### Enable Verbose Logging

```typescript
const agent = new ToolLoopAgent({
	// ... config
	onStepFinish: async ({ step, stepNumber }) => {
		console.log(`=== Step ${stepNumber} ===`);
		console.log("Text:", step.text);
		console.log("Tool calls:", step.toolCalls);
		console.log("Tool results:", step.toolResults);
	},
});
```

### Common Issues

| Issue                    | Cause                       | Solution                  |
| ------------------------ | --------------------------- | ------------------------- |
| Agent loops indefinitely | Missing FINAL_ANSWER        | Check prompt instructions |
| Agent stops too early    | FINAL_ANSWER in wrong place | Adjust stop condition     |
| Token limit exceeded     | Long conversation           | Verify trimming works     |
| Tools not called         | Prompt unclear              | Add examples to prompt    |

---

## Further Reading

-   [3.2 Tools](./LAYER_3.2_TOOLS.md) - How tools are structured and executed
-   [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - System prompt composition
-   [3.6 Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md) - Retry logic details
