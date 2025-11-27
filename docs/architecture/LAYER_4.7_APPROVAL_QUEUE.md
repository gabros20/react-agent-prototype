# Layer 4.7: Approval Queue

> In-memory HITL request/response queue, promise-based blocking, timeout handling

## Overview

The ApprovalQueue provides Human-in-the-Loop (HITL) coordination for dangerous tool operations. When a tool requires approval, the queue creates a pending request, blocks server execution via promises, waits for frontend response, and resumes execution with the user's decision.

**Key Responsibilities:**
- Create approval requests for dangerous operations
- Block agent execution until user responds
- Timeout handling (5-minute auto-reject)
- Expose pending requests to frontend
- Cleanup after response or timeout

---

## The Problem

Without an approval queue, dangerous operations execute automatically:

```typescript
// WRONG: No oversight
const result = await deletePage("home"); // Deletes immediately!
// User never consented to this destructive action

// WRONG: Async callback hell
deletePage("home", (userApproved) => {
  if (userApproved) { ... }
});
// Agent can't wait synchronously

// WRONG: Polling-based
while (!checkApproval(approvalId)) {
  await sleep(1000);
}
// Wastes resources, imprecise timing

// WRONG: Memory leak on timeout
pendingApprovals.set(id, promise);
// Never cleaned up if user closes browser
```

**Our Solution:**
1. Promise-based blocking with resolvers
2. 5-minute timeout with auto-rejection
3. Singleton queue accessible globally
4. Automatic cleanup after response

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPROVAL QUEUE FLOW                           │
│                                                                  │
│  Agent Execution                                                 │
│       │                                                          │
│       ▼                                                          │
│  Tool needs approval (cms_deletePage)                           │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   ApprovalQueue                          │    │
│  │                                                          │    │
│  │  pendingRequests: Map<approvalId, ApprovalRequest>      │    │
│  │  resolvers: Map<approvalId, (response) => void>         │    │
│  │  responses: Map<approvalId, ApprovalResponse>           │    │
│  │                                                          │    │
│  │  requestApproval(request):                               │    │
│  │  ├─ 1. Store request in pendingRequests                 │    │
│  │  ├─ 2. Create promise with resolver                     │    │
│  │  ├─ 3. Store resolver in resolvers map                  │    │
│  │  ├─ 4. Set 5-minute timeout                             │    │
│  │  └─ 5. Return Promise.race(response, timeout)           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                         │
│      BLOCKED  ◀────────┴────────▶  WAITING                      │
│    (Server waits)            (Frontend polls)                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Frontend                              │    │
│  │                                                          │    │
│  │  1. Receive approval_required SSE event                 │    │
│  │  2. Show confirmation dialog                            │    │
│  │  3. User clicks Approve/Reject                          │    │
│  │  4. POST /v1/approvals/:id/respond                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              respondToApproval(id, approved)             │    │
│  │                                                          │    │
│  │  1. Get resolver from map                               │    │
│  │  2. Create ApprovalResponse                             │    │
│  │  3. Store response in responses map                     │    │
│  │  4. Call resolver(response)  ◀─── UNBLOCKS SERVER       │    │
│  │  5. Schedule cleanup (1 minute)                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  Agent resumes with { approved: true/false }                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/approval-queue.ts` | ApprovalQueue singleton class |
| `server/routes/approvals.ts` | Approval REST endpoints |
| `server/agent/orchestrator.ts` | Calls requestApproval for dangerous tools |
| `app/assistant/_hooks/useAgentStream.ts` | Handles approval_required events |

---

## Core Implementation

### Types

```typescript
// server/services/approval-queue.ts
interface ApprovalRequest {
  approvalId: string;
  toolName: string;
  input: any;
  description?: string;
  timestamp: Date;
}

interface ApprovalResponse {
  approved: boolean;
  reason?: string;
  timestamp: Date;
}

type ApprovalResolver = (response: ApprovalResponse) => void;
```

### Request Approval with Promise Blocking

```typescript
class ApprovalQueue {
  private pendingRequests = new Map<string, ApprovalRequest>();
  private resolvers = new Map<string, ApprovalResolver>();
  private responses = new Map<string, ApprovalResponse>();

  /**
   * Create approval request and wait for response
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    console.log('[ApprovalQueue] Creating approval request:', {
      approvalId: request.approvalId,
      toolName: request.toolName,
    });

    this.pendingRequests.set(request.approvalId, request);

    // Create promise that resolves when user responds
    const responsePromise = new Promise<ApprovalResponse>((resolve) => {
      this.resolvers.set(request.approvalId, resolve);
    });

    // Timeout after 5 minutes
    const timeoutPromise = new Promise<ApprovalResponse>((resolve) => {
      setTimeout(() => {
        console.log('[ApprovalQueue] Approval timed out:', request.approvalId);
        resolve({
          approved: false,
          reason: 'Approval request timed out (5 minutes)',
          timestamp: new Date(),
        });
        this.cleanup(request.approvalId);
      }, 5 * 60 * 1000);
    });

    // Race between user response and timeout
    const result = await Promise.race([responsePromise, timeoutPromise]);

    console.log('[ApprovalQueue] Approval resolved:', {
      approvalId: request.approvalId,
      approved: result.approved,
    });

    return result;
  }
}
```

### Respond to Approval

```typescript
/**
 * Submit approval response (from frontend)
 */
async respondToApproval(
  approvalId: string,
  approved: boolean,
  reason?: string
) {
  console.log('[ApprovalQueue] Responding to approval:', {
    approvalId,
    approved,
    hasResolver: this.resolvers.has(approvalId),
  });

  const resolver = this.resolvers.get(approvalId);

  if (!resolver) {
    const pendingIds = Array.from(this.resolvers.keys());
    throw new Error(
      `No pending approval request for ID: ${approvalId}. ` +
      `Pending IDs: ${pendingIds.join(', ') || 'none'}. ` +
      `This might happen if the approval timed out (5 min).`
    );
  }

  const response: ApprovalResponse = {
    approved,
    reason,
    timestamp: new Date(),
  };

  // Store response
  this.responses.set(approvalId, response);

  // Resolve promise (unblocks server execution)
  resolver(response);

  // Cleanup after 1 minute
  setTimeout(() => {
    this.cleanup(approvalId);
  }, 60 * 1000);

  return response;
}
```

### Query Methods

```typescript
/**
 * Get pending request (for frontend to display)
 */
getPendingRequest(approvalId: string): ApprovalRequest | undefined {
  return this.pendingRequests.get(approvalId);
}

/**
 * Get all pending requests
 */
getAllPendingRequests(): ApprovalRequest[] {
  return Array.from(this.pendingRequests.values());
}

/**
 * Check if approval is pending
 */
isPending(approvalId: string): boolean {
  return this.resolvers.has(approvalId);
}

/**
 * Get queue stats (for monitoring)
 */
getStats() {
  return {
    pendingCount: this.pendingRequests.size,
    resolversCount: this.resolvers.size,
    responsesCount: this.responses.size,
  };
}
```

### Cleanup

```typescript
/**
 * Cleanup request data
 */
private cleanup(approvalId: string) {
  this.pendingRequests.delete(approvalId);
  this.resolvers.delete(approvalId);
  this.responses.delete(approvalId);
}
```

### Singleton Export

```typescript
// Singleton instance
export const approvalQueue = new ApprovalQueue();
```

---

## Design Decisions

### Why Promise-Based Blocking?

```typescript
const responsePromise = new Promise((resolve) => {
  this.resolvers.set(request.approvalId, resolve);
});
const result = await Promise.race([responsePromise, timeoutPromise]);
```

**Reasons:**
1. **Synchronous feel** - Agent code reads linearly
2. **No polling** - Efficient, event-driven
3. **Easy timeout** - Promise.race handles it cleanly
4. **Proper async/await** - Works with ReAct loop

### Why 5-Minute Timeout?

```typescript
setTimeout(() => {
  resolve({ approved: false, reason: 'Approval request timed out' });
}, 5 * 60 * 1000);
```

**Reasons:**
1. **Prevent hangs** - Server doesn't wait forever
2. **Resource cleanup** - Maps don't grow unbounded
3. **User expectation** - Reasonable review time
4. **Safe default** - Rejection on timeout = safe

### Why Store Three Maps?

```typescript
private pendingRequests = new Map<string, ApprovalRequest>();
private resolvers = new Map<string, ApprovalResolver>();
private responses = new Map<string, ApprovalResponse>();
```

**Reasons:**
1. **pendingRequests** - Frontend can fetch details
2. **resolvers** - Unblock execution on response
3. **responses** - Audit trail, debugging

### Why Singleton Pattern?

```typescript
export const approvalQueue = new ApprovalQueue();
```

**Reasons:**
1. **Global access** - Agent and routes share same queue
2. **State persistence** - Maps survive across requests
3. **Simple import** - `import { approvalQueue } from '...'`

### Why Delayed Cleanup?

```typescript
setTimeout(() => {
  this.cleanup(approvalId);
}, 60 * 1000);  // 1 minute after response
```

**Reasons:**
1. **Race condition safety** - Response might still be read
2. **Debugging** - Can inspect recent responses
3. **Frontend polling** - Late polls don't fail

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 3.1 (ReAct Loop) | Orchestrator calls requestApproval |
| Layer 3.5 (HITL) | Determines which tools need approval |
| Layer 3.7 (Streaming) | Sends approval_required SSE event |
| Layer 6 (Client) | Frontend handles approval UI |

### Agent Orchestrator Integration

```typescript
// server/agent/orchestrator.ts
async executeTool(toolCall: ToolCall, context: AgentContext) {
  const tool = registry.get(toolCall.name);

  if (tool.requiresApproval) {
    const approvalId = randomUUID();

    // Send SSE event to frontend
    context.stream.write(`event: approval_required\n`);
    context.stream.write(`data: ${JSON.stringify({
      approvalId,
      toolName: toolCall.name,
      input: toolCall.input,
      description: `Delete page "${toolCall.input.slug}"`,
    })}\n\n`);

    // Block until user responds (or timeout)
    const response = await approvalQueue.requestApproval({
      approvalId,
      toolName: toolCall.name,
      input: toolCall.input,
      timestamp: new Date(),
    });

    if (!response.approved) {
      return { error: `Operation rejected: ${response.reason}` };
    }
  }

  // Execute tool
  return await tool.execute(toolCall.input, context);
}
```

### Approval Routes

```typescript
// server/routes/approvals.ts
router.post('/:approvalId/respond', async (req, res) => {
  const { approvalId } = req.params;
  const { approved, reason } = req.body;

  try {
    const response = await approvalQueue.respondToApproval(
      approvalId,
      approved,
      reason
    );
    res.json({ success: true, response });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/pending', (req, res) => {
  const pending = approvalQueue.getAllPendingRequests();
  res.json({ pending });
});
```

---

## Common Issues / Debugging

### "No pending approval request" Error

```
Error: No pending approval request for ID: abc-123
```

**Causes:**
1. Approval already timed out (5 minutes passed)
2. Approval ID mismatch between frontend/backend
3. Server restarted (in-memory queue lost)

**Debug:**

```typescript
console.log('Queue stats:', approvalQueue.getStats());
console.log('Pending IDs:', approvalQueue.getAllPendingRequests().map(r => r.approvalId));
```

### Approval Stuck Forever

```
// Agent never continues after approval request
```

**Cause:** Frontend never sent response.

**Debug:**

```typescript
// Check if request exists
const pending = approvalQueue.getPendingRequest(approvalId);
console.log('Request pending:', !!pending);

// Check if resolver exists
const isPending = approvalQueue.isPending(approvalId);
console.log('Resolver exists:', isPending);
```

**Fix:** Timeout will auto-reject after 5 minutes.

### Memory Leak from Many Pending Requests

```
// Queue grows unbounded
```

**Cause:** Requests created but never resolved.

**Debug:**

```typescript
const stats = approvalQueue.getStats();
console.log('Pending count:', stats.pendingCount);
console.log('Resolvers count:', stats.resolversCount);
```

**Fix:** Timeout cleanup handles this automatically.

### Race Condition: Double Response

```
// User clicks approve twice rapidly
```

**Prevention:** First response removes resolver, second call throws error.

```typescript
const resolver = this.resolvers.get(approvalId);
if (!resolver) {
  throw new Error('No pending approval request');
}
// Resolver only exists once
```

### Server Restart Loses Pending Approvals

```
// After restart, all pending approvals gone
```

**Cause:** In-memory queue, not persisted.

**Current behavior:** Expected - users must re-trigger operations.

**Potential fix:** Persist to database (not currently implemented).

---

## Further Reading

- [Layer 3.5: Human-in-the-Loop](./LAYER_3.5_HITL.md) - HITL patterns
- [Layer 3.7: Streaming](./LAYER_3.7_STREAMING.md) - SSE events
- [Layer 3.1: ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Agent execution
- [Layer 6: Client](./LAYER_6_CLIENT.md) - Frontend approval UI
