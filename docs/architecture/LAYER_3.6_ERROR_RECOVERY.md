# Layer 3.6: Error Recovery (AI SDK 6 Native)

> Native retry logic, error classification, and graceful degradation

## Overview

Error recovery ensures the agent handles failures gracefully. Since the AI SDK 6 migration, **retry logic is handled natively** via `maxRetries`. The SDK provides automatic exponential backoff for transient errors while surfacing non-recoverable errors immediately.

**Key Change**: Custom retry code removed - SDK handles retries natively!

---

## The Problem

AI agents encounter many failure modes:

- **API Failures** - LLM rate limits, timeouts, server errors
- **Tool Failures** - Invalid input, missing resources, constraint violations
- **Logic Failures** - Agent stuck in loops, wrong tool selection
- **External Failures** - Network issues, third-party services down

Without proper handling:
```
User: "Create a contact page"
Agent: *calls LLM*
Error: 429 Too Many Requests
System: *crashes*
User: 😤
```

With AI SDK 6 native retry:
```
User: "Create a contact page"
Agent: *calls LLM*
Error: 429 Too Many Requests
SDK: *waits with backoff, retries automatically*
Agent: Created contact page!
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Error Recovery System                        │
│                      (AI SDK 6 Native)                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               Native SDK Retry (maxRetries: 2)              │ │
│  │                                                             │ │
│  │  Handles automatically:                                     │ │
│  │  • 429 Rate Limits → exponential backoff + retry            │ │
│  │  • 5xx Server Errors → backoff + retry                      │ │
│  │  • Network Timeouts → retry                                 │ │
│  │                                                             │ │
│  │  Does NOT retry:                                            │ │
│  │  • 4xx Client Errors (except 429)                           │ │
│  │  • Validation failures                                      │ │
│  │  • Tool execution errors                                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Prompt-Guided Tool Recovery                    │ │
│  │                                                             │ │
│  │  Agent handles tool errors based on prompt instructions:    │ │
│  │  • Validation → Ask user for missing info                   │ │
│  │  • Not found → Use fuzzy search                             │ │
│  │  • Constraint → Suggest alternative                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Step Limits                               │ │
│  │                                                             │ │
│  │  maxSteps: 15 → prevents infinite loops                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Native SDK Retry

### Configuration

```typescript
// server/agent/cms-agent.ts
return generateText({
  model: openrouter(AGENT_CONFIG.modelId),
  system: systemPrompt,
  messages,
  tools: ALL_TOOLS,
  maxSteps: 15,
  maxRetries: 2,  // Native retry with exponential backoff
  maxTokens: 4096,
  experimental_context: agentContext,
});
```

### Retry Behavior

| Error Type | HTTP Status | SDK Behavior |
|------------|-------------|--------------|
| Rate Limit | 429 | Exponential backoff + retry |
| Server Error | 500, 502, 503 | Backoff + retry |
| Bad Request | 400 | No retry, surface immediately |
| Unauthorized | 401 | No retry, surface immediately |
| Forbidden | 403 | No retry, surface immediately |
| Not Found | 404 | No retry, surface immediately |
| Network Error | - | Retry |
| Timeout | - | Retry |

### Backoff Formula (SDK Internal)

```
delay = baseDelay * 2^attempt + jitter
```

Typical progression:
- Attempt 1: ~1s
- Attempt 2: ~2s
- Attempt 3: Surface error

---

## Migration Changes

### Before (Custom Retry)

```typescript
// OLD: server/agent/orchestrator.ts
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  jitterMax: 500
};

async function executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) throw error;
      if (attempt === RETRY_CONFIG.maxAttempts) throw error;

      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1) +
        Math.random() * RETRY_CONFIG.jitterMax,
        RETRY_CONFIG.maxDelay
      );

      await sleep(delay);
    }
  }
  throw lastError;
}
```

### After (Native SDK)

```typescript
// NEW: Just set maxRetries
return generateText({
  // ...
  maxRetries: 2,  // That's it!
});
```

**Removed code:**
- `executeWithRetry` function
- `isRetryableError` helper
- `calculateBackoff` helper
- Custom retry while loop in `streamAgentWithApproval`

---

## Prompt-Guided Tool Recovery

The agent handles tool-level errors based on prompt instructions. This is unchanged:

### Error Classification in Prompt

```xml
<!-- server/prompts/react.xml -->
<error_handling>
  **ERROR TYPES AND RESPONSES**

  1. VALIDATION ERRORS
     Error: "title is required"
     Action: Ask user for the missing field
     Example: "I need a title for the page. What would you like to call it?"

  2. CONSTRAINT VIOLATIONS
     Error: "slug 'about' already exists"
     Action: Suggest alternative
     Example: "The slug 'about' is taken. How about 'about-us' or 'about-2'?"

  3. NOT FOUND ERRORS
     Error: "page not found"
     Action: Use fuzzy search to find similar
     Example: cms_findResource({ query: "about", type: "page" })

  4. REFERENCE ERRORS
     Error: "invalid page ID format"
     Action: List valid options
     Example: "I couldn't find that page. Here are the available pages: ..."
</error_handling>
```

### Agent Recovery Examples

**Validation Error:**
```
Tool Result: { error: "title is required", errorCode: "VALIDATION_FAILED" }

Agent THINK: Validation error - missing title. Need to ask user.

Agent Response: "I need a title for the new page. What would you like to call it?"
```

**Constraint Violation:**
```
Tool Result: { error: "slug 'about' already exists", errorCode: "CONFLICT" }

Agent THINK: Slug conflict. Suggest alternatives.

Agent Response: "The URL 'about' is already taken. Would you prefer:
- about-us
- about-company
- our-story"
```

---

## Step Limits

### Max Steps Protection

```typescript
maxSteps: 15,  // Prevents infinite loops
```

When max steps reached:
1. SDK stops the loop
2. Returns whatever partial result exists
3. Agent text explains where it stopped

### Prompt Guidance for Stuck Detection

```xml
<stuck_detection>
  **SIGNS YOU'RE STUCK:**
  - Same error occurring repeatedly
  - Calling same tool with same arguments
  - Making no progress toward the goal

  **RECOVERY:**
  1. Stop and analyze what's not working
  2. Try a completely different approach
  3. Ask user for clarification
  4. If truly stuck, admit it:
     "I'm having trouble completing this task because [reason].
      Could you try rephrasing your request?"
</stuck_detection>
```

---

## Graceful Degradation

### Partial Results

Tools should return partial success when possible:

```typescript
export const cms_createPageWithSections = tool({
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    const results = {
      page: null,
      sections: [],
      errors: []
    };

    // Try to create page
    try {
      results.page = await ctx.services.pageService.createPage(input);
    } catch (error) {
      results.errors.push({ operation: 'createPage', error: error.message });
      return results;  // Can't continue without page
    }

    // Try to add each section (continue on failure)
    for (const section of input.sections || []) {
      try {
        const added = await ctx.services.sectionService.addToPage(
          results.page.id,
          section
        );
        results.sections.push(added);
      } catch (error) {
        results.errors.push({
          operation: 'addSection',
          section: section.type,
          error: error.message
        });
        // Continue with remaining sections
      }
    }

    return results;
  }
});
```

### Error Logging

```typescript
// In route handler, log errors for debugging
const result = await runAgent(messages, options).catch(error => {
  logger.error('Agent execution failed', {
    error: error.message,
    sessionId,
    traceId,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
  throw error;
});
```

---

## Removed Patterns

### Checkpoint Recovery (Removed)

The old checkpoint system was dead code:

```typescript
// REMOVED - checkpoint was never used
async function recoverSession(sessionId: string) {
  const checkpoint = await sessionService.loadCheckpoint(sessionId);
  if (checkpoint) {
    workingContext.restore(checkpoint.workingMemory);
  }
}
```

**Why removed:**
- CMS agent completes in seconds
- Checkpoint column was always null
- Messages saved at end is sufficient

### Custom Error Classification (Simplified)

```typescript
// REMOVED - SDK handles this internally
function isRetryableError(error: unknown): boolean {
  if (error instanceof APICallError) {
    if (error.statusCode === 429) return true;
    if (error.statusCode >= 500) return true;
    if (error.statusCode >= 400 && error.statusCode < 500) return false;
  }
  return true;
}
```

---

## Design Decisions

### Why Native Retry?

| Approach | Tradeoff |
|----------|----------|
| Custom retry | More control, more code to maintain |
| Native `maxRetries` | Less code, SDK-maintained, well-tested |

We chose native because:
1. SDK handles edge cases we'd miss
2. Exponential backoff built-in
3. Less code to maintain
4. Consistent with AI SDK patterns

### Why maxRetries: 2?

- **1 retry** - Might miss transient issues
- **2 retries** - Catches most transients (SDK default)
- **3+ retries** - Delays user response too long

### Why Keep Prompt-Guided Recovery?

Agent-level recovery is more flexible than code:
- Can adapt to context
- Can ask clarifying questions
- Can suggest alternatives
- Learns from examples in prompt

---

## Monitoring Recommendations

### Metrics to Track

- Error rate by type (429, 5xx, tool errors)
- Retry frequency
- Time to recovery
- Max steps reached frequency

### Alerts

- Error rate > 10% in 5 minutes
- Multiple 429s in succession (API key issue)
- Frequent max steps reached (prompt issue)

---

## Integration Points

| Connects To | How |
|-------------|-----|
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) | `maxRetries` in generateText |
| [3.2 Tools](./LAYER_3.2_TOOLS.md) | Tools return structured errors |
| [3.4 Prompts](./LAYER_3.4_PROMPTS.md) | Recovery guidance in prompt |
| [3.7 Streaming](./LAYER_3.7_STREAMING.md) | Error events streamed |

---

## Further Reading

- [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Where retry is configured
- [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - Error handling guidance
- [AI SDK Error Handling](https://ai-sdk.dev/docs/ai-sdk-core/error-handling) - Official docs
