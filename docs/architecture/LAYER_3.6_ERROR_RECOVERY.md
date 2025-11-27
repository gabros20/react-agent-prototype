# Layer 3.6: Error Recovery

> Retry strategies, graceful degradation, and failure handling

## Overview

Error recovery ensures the agent handles failures gracefully without crashing or leaving the system in an inconsistent state. Our implementation uses exponential backoff with jitter, intelligent error classification, and prompt-guided recovery strategies.

**Key Files:**
- `server/agent/orchestrator.ts` - Retry logic
- `server/prompts/components/error-handling.md` - Prompt guidance
- `server/prompts/react.xml` - Error handling section

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

With error recovery:
```
User: "Create a contact page"
Agent: *calls LLM*
Error: 429 Too Many Requests
System: *waits 2 seconds, retries*
Agent: Created contact page!
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Error Recovery System                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  API-Level Retry                            │ │
│  │                                                             │ │
│  │  Handles: LLM API errors                                    │ │
│  │                                                             │ │
│  │  ┌─────────────────────────────────────────────────────┐    │ │
│  │  │  Exponential Backoff with Jitter                    │    │ │
│  │  │                                                     │    │ │
│  │  │  Attempt 1: fail → wait 1s + jitter                 │    │ │
│  │  │  Attempt 2: fail → wait 2s + jitter                 │    │ │
│  │  │  Attempt 3: fail → wait 4s + jitter                 │    │ │
│  │  │  Attempt 4: surface error                           │    │ │
│  │  └─────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Error Classification                       │ │
│  │                                                             │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐     │ │
│  │  │  Retryable   │ │Non-Retryable │ │   User Error     │     │ │
│  │  │              │ │              │ │                  │     │ │
│  │  │ 429, 5xx,    │ │ 400, 401,    │ │ Validation,      │     │ │
│  │  │ timeout,     │ │ 403, 404     │ │ not found,       │     │ │
│  │  │ network      │ │              │ │ constraint       │     │ │
│  │  └──────────────┘ └──────────────┘ └──────────────────┘     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Prompt-Guided Recovery                       │ │
│  │                                                             │ │
│  │  Agent interprets errors and recovers:                      │ │
│  │  - Validation → Ask user for missing info                   │ │
│  │  - Not found → Use fuzzy search                             │ │
│  │  - Constraint → Suggest alternative                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Stuck Detection                           │ │
│  │                                                             │ │
│  │  - Same tool called with same args 2+ times                 │ │
│  │  - Max steps (15) reached                                   │ │
│  │  - 5+ total failures in session                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## API-Level Retry

### Exponential Backoff with Jitter

```typescript
// server/agent/orchestrator.ts
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000,      // 1 second
  maxDelay: 10000,      // 10 seconds
  jitterMax: 500        // 0-500ms random jitter
};

async function executeWithRetry<T>(
  fn: () => Promise<T>,
  context: { logger: Logger }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === RETRY_CONFIG.maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * RETRY_CONFIG.jitterMax;
      const delay = Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelay);

      context.logger.warn(`Retry attempt ${attempt}/${RETRY_CONFIG.maxAttempts}`, {
        error: error.message,
        nextRetryIn: `${Math.round(delay)}ms`
      });

      await sleep(delay);
    }
  }

  throw lastError;
}
```

### Delay Progression

| Attempt | Base Delay | With Jitter (example) |
|---------|------------|----------------------|
| 1 | 1000ms | 1000-1500ms |
| 2 | 2000ms | 2000-2500ms |
| 3 | 4000ms | 4000-4500ms |
| 4 | (surface error) | - |

### Why Jitter?

Prevents "thundering herd" when multiple requests fail simultaneously:

```
Without jitter (all retry at same time):
  Request 1: fail → wait 1s → retry
  Request 2: fail → wait 1s → retry  ← Both hit API at same time
  Request 3: fail → wait 1s → retry

With jitter (spread out):
  Request 1: fail → wait 1.2s → retry
  Request 2: fail → wait 1.4s → retry  ← Distributed load
  Request 3: fail → wait 1.1s → retry
```

---

## Error Classification

### Retryable Errors

```typescript
function isRetryableError(error: unknown): boolean {
  if (error instanceof APICallError) {
    const status = error.statusCode;

    // Rate limit - definitely retry
    if (status === 429) return true;

    // Server errors - retry (might be transient)
    if (status >= 500) return true;

    // Client errors (except rate limit) - don't retry
    if (status >= 400 && status < 500) return false;
  }

  // Network errors - retry
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Timeout - retry
  if (error.name === 'TimeoutError') {
    return true;
  }

  // Unknown errors - retry (might be transient)
  return true;
}
```

### Error Types

| Category | HTTP Status | Retry? | Reason |
|----------|-------------|--------|--------|
| Rate Limit | 429 | Yes | Wait and retry works |
| Server Error | 500, 502, 503 | Yes | Often transient |
| Bad Request | 400 | No | Input won't change |
| Unauthorized | 401 | No | Needs credential fix |
| Forbidden | 403 | No | Permission issue |
| Not Found | 404 | No | Resource doesn't exist |
| Network Error | - | Yes | Connection might recover |
| Timeout | - | Yes | Server might respond |

---

## Prompt-Guided Recovery

The agent handles tool-level errors based on prompt instructions:

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

  5. TRANSIENT ERRORS
     Error: "timeout", "rate limit"
     Action: Wait handled automatically. If persists, inform user.

  **RETRY RULES:**
  - DO retry after correcting validation error
  - DO retry with alternate value for constraints
  - DON'T retry same error 2+ times
  - DON'T retry after user denied approval
  - DON'T retry if tool doesn't exist
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

**Not Found:**
```
Tool Result: { error: "page 'abut' not found", errorCode: "NOT_FOUND" }

Agent THINK: Typo likely. Use fuzzy search.

Agent ACT: cms_findResource({ query: "abut", type: "page" })

Agent OBSERVE: { matches: [{ name: "About Us", slug: "about", score: 0.9 }] }

Agent Response: "I couldn't find 'abut'. Did you mean the 'About Us' page?"
```

---

## Stuck Detection

### Same Tool Same Args

```typescript
// Track recent tool calls
const recentCalls: Map<string, number> = new Map();

function detectStuck(toolName: string, args: unknown): boolean {
  const key = `${toolName}:${JSON.stringify(args)}`;
  const count = (recentCalls.get(key) || 0) + 1;
  recentCalls.set(key, count);

  if (count >= 2) {
    logger.warn('Stuck detection: Same tool called twice with same args', {
      toolName,
      args,
      count
    });
    return true;
  }

  return false;
}
```

### Max Steps Limit

```typescript
// In orchestrator
const MAX_STEPS = 15;

stopWhen: ({ steps }) => {
  if (steps.length >= MAX_STEPS) {
    logger.warn('Max steps reached', { steps: steps.length });
    return true;
  }
  return false;
}
```

### Failure Threshold

```typescript
let sessionFailures = 0;
const MAX_SESSION_FAILURES = 5;

onToolError: (error) => {
  sessionFailures++;

  if (sessionFailures >= MAX_SESSION_FAILURES) {
    logger.error('Session failure threshold reached', {
      failures: sessionFailures
    });
    // Surface to user, suggest starting fresh
  }
}
```

### Prompt Guidance for Stuck

```xml
<stuck_detection>
  **SIGNS YOU'RE STUCK:**
  - Same error occurring repeatedly
  - Calling same tool with same arguments
  - Making no progress toward the goal
  - Circular reasoning (A needs B, B needs A)

  **RECOVERY:**
  1. Stop and analyze what's not working
  2. Try a completely different approach
  3. Ask user for clarification
  4. If truly stuck, admit it:
     "I'm having trouble completing this task because [reason].
      Could you try rephrasing your request or providing more details?"
</stuck_detection>
```

---

## Graceful Degradation

### Partial Results

When some operations succeed but others fail:

```typescript
// Tool implementation pattern
export const cms_createPageWithSections = tool({
  // ...
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

### User-Facing Messages

```typescript
// Format partial results for user
function formatPartialResult(results: PartialResult): string {
  let message = '';

  if (results.page) {
    message += `✓ Created page "${results.page.title}"\n`;
  }

  for (const section of results.sections) {
    message += `✓ Added ${section.type} section\n`;
  }

  if (results.errors.length > 0) {
    message += `\n⚠ Some operations failed:\n`;
    for (const error of results.errors) {
      message += `  - ${error.operation}: ${error.error}\n`;
    }
  }

  return message;
}
```

---

## Checkpoint Recovery

When agent crashes mid-operation:

```typescript
// On session resume
async function recoverSession(sessionId: string): Promise<void> {
  const checkpoint = await sessionService.loadCheckpoint(sessionId);

  if (checkpoint) {
    logger.info('Recovering from checkpoint', {
      sessionId,
      stepNumber: checkpoint.stepNumber,
      messageCount: checkpoint.messages.length
    });

    // Restore working memory
    workingContext.restore(checkpoint.workingMemory);

    // Inform user
    return {
      recovered: true,
      message: 'Resumed from where we left off.',
      lastStep: checkpoint.stepNumber
    };
  }
}
```

---

## Logging for Debugging

### Structured Error Logs

```typescript
logger.error('Tool execution failed', {
  toolName,
  input: sanitizeInput(input),  // Remove sensitive data
  error: {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  },
  context: {
    sessionId,
    traceId,
    stepNumber,
    attempt
  }
});
```

### Error Correlation

```typescript
// All errors include traceId for correlation
{
  traceId: "abc-123",
  timestamp: "2025-01-15T10:30:00Z",
  level: "error",
  message: "Tool execution failed",
  toolName: "cms_createPage",
  error: "slug already exists"
}
```

---

## Design Decisions

### Why 3 Retry Attempts?

| Attempts | Tradeoff |
|----------|----------|
| 1 | No retry - too fragile |
| 2 | Minimal - might miss transient |
| 3 | Good balance - catches most transients |
| 5+ | Excessive - delays user too long |

### Why Max 10 Second Delay?

- Beyond 10s, user thinks system is hung
- Most transient issues resolve in <10s
- If not resolved by then, likely needs intervention

### Why Prompt-Guided Recovery?

Agent-level recovery is more flexible than code:
- Can adapt to context
- Can ask clarifying questions
- Can suggest alternatives
- Learns from examples in prompt

---

## Common Error Patterns

### Rate Limiting

```typescript
// Error: 429 Too Many Requests
// Automatic: exponential backoff
// If persistent: inform user, suggest waiting
```

### Network Timeout

```typescript
// Error: TimeoutError
// Automatic: retry with backoff
// If persistent: check connectivity, suggest refresh
```

### Invalid Input

```typescript
// Error: { errorCode: "VALIDATION_FAILED" }
// Agent: identifies missing/invalid field
// Agent: asks user to provide correct value
```

### Resource Conflict

```typescript
// Error: { errorCode: "CONFLICT", message: "slug exists" }
// Agent: suggests alternative slug
// Agent: asks user preference
```

---

## Integration Points

| Connects To | How |
|-------------|-----|
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) | Retry wraps agent execution |
| [3.2 Tools](./LAYER_3.2_TOOLS.md) | Tools return structured errors |
| [3.4 Prompts](./LAYER_3.4_PROMPTS.md) | Recovery guidance in prompt |
| [3.7 Streaming](./LAYER_3.7_STREAMING.md) | Error events streamed |
| Session Service | Checkpoint for recovery |

---

## Monitoring Recommendations

### Metrics to Track

- Retry rate by error type
- Time to recovery
- Session failure rate
- Stuck detection frequency

### Alerts

- Retry rate > 10% in 5 minutes
- Multiple sessions stuck simultaneously
- Error rate spike

---

## Further Reading

- [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Where retry is implemented
- [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - Error handling guidance
- [3.7 Streaming](./LAYER_3.7_STREAMING.md) - Error event types
