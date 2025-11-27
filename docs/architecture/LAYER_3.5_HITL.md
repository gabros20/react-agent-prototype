# Layer 3.5: Human-in-the-Loop (HITL)

> Human oversight for dangerous operations through approval flows

## Overview

Human-in-the-Loop ensures users maintain control over dangerous or irreversible operations. Our system implements two patterns: an async approval queue for runtime confirmation, and explicit confirmation flags for destructive operations.

**Key Files:**
- `server/services/approval-queue.ts` - Approval queue implementation
- `server/agent/orchestrator.ts` - HITL integration in stream
- `app/assistant/_stores/approval-store.ts` - Frontend state
- `app/assistant/_components/hitl-modal.tsx` - Approval UI

---

## The Problem

Autonomous agents can be dangerous:

```
User: "Clean up the site"
Agent (without HITL): *deletes all pages* Done!
User: 😱
```

With HITL:

```
User: "Clean up the site"
Agent: I found 5 unused pages. Delete them?
  - About Us (draft)
  - Test Page
  - Old Landing
  [Approve] [Deny]
User: *reviews, clicks Approve*
Agent: Deleted 5 pages.
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Human-in-the-Loop System                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Two Patterns:                                                 │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Pattern 1: APPROVAL QUEUE (Async)                      │   │
│   │                                                         │   │
│   │  Used for: publishPost, archivePost, deleteImage,       │   │
│   │            http_post                                    │   │
│   │                                                         │   │
│   │  Flow:                                                  │   │
│   │  Tool Call → Orchestrator → Emit approval-required      │   │
│   │           → Frontend Modal → User Decision              │   │
│   │           → Response → Continue/Cancel                  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Pattern 2: CONFIRMATION FLAG (Prompt-Based)            │   │
│   │                                                         │   │
│   │  Used for: deletePage, deletePageSection,               │   │
│   │            deletePageSections                           │   │
│   │                                                         │   │
│   │  Flow:                                                  │   │
│   │  Tool({ confirmed: false }) → requiresConfirmation      │   │
│   │           → Agent asks user → User confirms in chat     │   │
│   │           → Tool({ confirmed: true }) → Execute         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pattern 1: Approval Queue

### When Used

Tools marked with `requiresApproval: true` in metadata:

| Tool | Risk | Reason |
|------|------|--------|
| `cms_publishPost` | High | Makes content public |
| `cms_archivePost` | High | Hides published content |
| `cms_deletePost` | High | Permanent deletion |
| `cms_deleteImage` | High | Removes media |
| `http_post` | High | External API write |

### Implementation

#### ApprovalQueue Service

```typescript
// server/services/approval-queue.ts
interface ApprovalRequest {
  id: string;              // Unique approval ID
  toolName: string;        // Which tool
  input: unknown;          // Tool arguments
  message: string;         // User-facing description
  createdAt: number;       // Timestamp
}

interface ApprovalResponse {
  approved: boolean;
  reason?: string;         // Optional denial reason
}

class ApprovalQueue {
  private pendingRequests = new Map<string, ApprovalRequest>();
  private resolvers = new Map<string, (response: ApprovalResponse) => void>();
  private responses = new Map<string, ApprovalResponse>();

  // Create approval request and wait for response
  async requestApproval(request: Omit<ApprovalRequest, 'id' | 'createdAt'>): Promise<ApprovalResponse> {
    const id = nanoid();
    const fullRequest: ApprovalRequest = {
      ...request,
      id,
      createdAt: Date.now()
    };

    this.pendingRequests.set(id, fullRequest);

    // Return promise that resolves when user responds
    return new Promise((resolve) => {
      this.resolvers.set(id, resolve);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          this.resolvers.delete(id);
          resolve({
            approved: false,
            reason: 'Approval request timed out after 5 minutes'
          });
        }
      }, 5 * 60 * 1000);
    });
  }

  // Get pending request (for frontend to display)
  getPendingRequest(id: string): ApprovalRequest | undefined {
    return this.pendingRequests.get(id);
  }

  // Submit user's decision
  respondToApproval(id: string, approved: boolean, reason?: string): void {
    const resolver = this.resolvers.get(id);
    if (resolver) {
      const response: ApprovalResponse = { approved, reason };
      this.responses.set(id, response);
      resolver(response);

      // Cleanup after 1 minute
      setTimeout(() => {
        this.pendingRequests.delete(id);
        this.resolvers.delete(id);
        this.responses.delete(id);
      }, 60 * 1000);
    }
  }

  // Stats for monitoring
  getStats() {
    return {
      pendingCount: this.pendingRequests.size,
      resolversCount: this.resolvers.size,
      responsesCount: this.responses.size
    };
  }
}

export const approvalQueue = new ApprovalQueue();
```

#### Orchestrator Integration

```typescript
// server/agent/orchestrator.ts
export async function* streamAgentWithApproval(
  messages: CoreMessage[],
  context: AgentContext
): AsyncGenerator<StreamEvent> {
  const agent = createAgent(context);

  for await (const chunk of agent.stream(messages)) {
    // Check if tool requires approval
    if (chunk.type === 'tool-call') {
      const metadata = TOOL_METADATA[chunk.toolName];

      if (metadata?.requiresApproval) {
        // Emit approval-required event to frontend
        const approvalId = nanoid();
        yield {
          type: 'approval-required',
          approvalId,
          toolName: chunk.toolName,
          input: chunk.input,
          message: formatApprovalMessage(chunk.toolName, chunk.input)
        };

        // Wait for user response
        const response = await approvalQueue.requestApproval({
          toolName: chunk.toolName,
          input: chunk.input,
          message: formatApprovalMessage(chunk.toolName, chunk.input)
        });

        if (!response.approved) {
          // Skip tool execution, emit cancellation
          yield {
            type: 'tool-result',
            toolName: chunk.toolName,
            result: {
              success: false,
              cancelled: true,
              reason: response.reason || 'User denied approval'
            }
          };
          continue;  // Skip to next iteration
        }

        // User approved - continue with normal execution
      }
    }

    // Forward event to frontend
    yield chunk;
  }
}

function formatApprovalMessage(toolName: string, input: unknown): string {
  switch (toolName) {
    case 'cms_publishPost':
      return `Publish post "${input.slug}" to make it publicly visible?`;
    case 'cms_archivePost':
      return `Archive post "${input.slug}"? It will be hidden from the public.`;
    case 'cms_deletePost':
      return `Permanently delete post "${input.slug}"? This cannot be undone.`;
    case 'cms_deleteImage':
      return `Delete image? This cannot be undone.`;
    case 'http_post':
      return `Send POST request to ${input.url}?`;
    default:
      return `Execute ${toolName}?`;
  }
}
```

#### Frontend Components

**Approval Store:**
```typescript
// app/assistant/_stores/approval-store.ts
interface ApprovalState {
  pendingApproval: {
    approvalId: string;
    toolName: string;
    input: unknown;
    message: string;
  } | null;

  setPendingApproval: (approval: ApprovalState['pendingApproval']) => void;
  clearPendingApproval: () => void;
  submitApproval: (approvalId: string, approved: boolean, reason?: string) => Promise<void>;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  pendingApproval: null,

  setPendingApproval: (approval) => set({ pendingApproval: approval }),

  clearPendingApproval: () => set({ pendingApproval: null }),

  submitApproval: async (approvalId, approved, reason) => {
    await fetch('/api/agent/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId, approved, reason })
    });
    set({ pendingApproval: null });
  }
}));
```

**Approval Modal:**
```tsx
// app/assistant/_components/hitl-modal.tsx
export function HITLModal() {
  const { pendingApproval, submitApproval, clearPendingApproval } = useApprovalStore();

  if (!pendingApproval) return null;

  return (
    <Dialog open onOpenChange={() => clearPendingApproval()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmation Required</DialogTitle>
          <DialogDescription>
            The agent wants to perform an action that requires your approval.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm font-medium mb-2">Action:</p>
          <p className="text-sm text-gray-600">{pendingApproval.message}</p>

          {pendingApproval.input && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Details:</p>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(pendingApproval.input, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => submitApproval(pendingApproval.approvalId, false, 'User cancelled')}
          >
            Deny
          </Button>
          <Button
            variant="destructive"
            onClick={() => submitApproval(pendingApproval.approvalId, true)}
          >
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent     │     │ Orchestrator│     │  Frontend   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ calls tool        │                   │
       │──────────────────▶│                   │
       │                   │                   │
       │                   │ check metadata    │
       │                   │ requiresApproval? │
       │                   │                   │
       │                   │ emit SSE:         │
       │                   │ approval-required │
       │                   │──────────────────▶│
       │                   │                   │
       │                   │                   │ show modal
       │                   │                   │
       │                   │                   │ user clicks
       │                   │                   │ [Approve]
       │                   │                   │
       │                   │ POST /approve     │
       │                   │◀──────────────────│
       │                   │                   │
       │                   │ resolve promise   │
       │                   │                   │
       │ execute tool      │                   │
       │◀──────────────────│                   │
       │                   │                   │
       │ return result     │                   │
       │──────────────────▶│                   │
       │                   │                   │
       │                   │ emit SSE:         │
       │                   │ tool-result       │
       │                   │──────────────────▶│
       │                   │                   │
```

---

## Pattern 2: Confirmation Flag

### When Used

Tools with `confirmed` parameter:

| Tool | Risk | Reason |
|------|------|--------|
| `cms_deletePage` | High | Removes page and sections |
| `cms_deletePageSection` | High | Removes section |
| `cms_deletePageSections` | High | Bulk section removal |

### Implementation

#### Tool Definition

```typescript
// server/tools/page-tools.ts
export const cms_deletePage = tool({
  description: 'Delete a page and all its sections. Requires explicit confirmation.',
  inputSchema: z.object({
    pageId: z.string().describe('ID of the page to delete'),
    confirmed: z.boolean()
      .default(false)
      .describe('Must be true to actually delete. First call without this to get confirmation prompt.')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;

    // First call: Return confirmation request
    if (!input.confirmed) {
      const page = await ctx.services.pageService.getPage(input.pageId);
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to delete "${page.title}"? This will permanently remove the page and all its sections. This action cannot be undone.`,
        pageId: input.pageId,
        pageTitle: page.title,
        sectionCount: page.sections?.length || 0
      };
    }

    // Second call: Execute deletion
    await ctx.services.pageService.deletePage(input.pageId);

    return {
      success: true,
      message: `Page deleted successfully.`
    };
  }
});
```

#### Prompt Instructions

```xml
<!-- In react.xml -->
<destructive_operations>
  **THREE-STEP WORKFLOW**

  For tools with `confirmed` parameter (deletePage, deletePageSection):

  1. FIRST CALL (without confirmed: true)
     cms_deletePage({ pageId: "page-123" })
     → Returns: { requiresConfirmation: true, message: "..." }

  2. STOP AND ASK USER
     Tell the user what will happen.
     DO NOT proceed until they explicitly confirm.
     Wait for their response.

  3. SECOND CALL (with confirmed: true)
     Only after user says yes/confirm/proceed:
     cms_deletePage({ pageId: "page-123", confirmed: true })
     → Returns: { success: true }

  **IMPORTANT:**
  - NEVER call with confirmed: true on first attempt
  - NEVER interpret silence as confirmation
  - NEVER auto-confirm based on previous context

  **CONFIRMATION WORDS:**
  YES: yes, y, yeah, ok, okay, sure, proceed, go ahead, confirm, do it
  NO: no, n, nope, cancel, stop, abort, don't, nevermind
</destructive_operations>
```

### Flow Example

```
User: "Delete the about page"

Agent (internal):
  THINK: User wants to delete a page. Check working memory.
         Memory: pages: - "About Us" (page-123)
         This is destructive. Need to confirm first.

  ACT: cms_deletePage({ pageId: "page-123" })

  OBSERVE: {
    requiresConfirmation: true,
    message: "Are you sure you want to delete 'About Us'?...",
    pageTitle: "About Us",
    sectionCount: 3
  }

  THINK: Got confirmation requirement. Must ask user.

FINAL_ANSWER: This will permanently delete the "About Us" page
along with its 3 sections. This cannot be undone.

Are you sure you want to proceed?

---

User: "yes"

Agent (internal):
  THINK: User confirmed deletion. Proceed.

  ACT: cms_deletePage({ pageId: "page-123", confirmed: true })

  OBSERVE: { success: true, message: "Page deleted successfully." }

FINAL_ANSWER: Done! The About Us page has been deleted.
```

---

## Comparison: When to Use Which

| Aspect | Approval Queue | Confirmation Flag |
|--------|----------------|-------------------|
| **UI** | Modal popup | Chat conversation |
| **Blocking** | Blocks tool execution | Blocks agent (asks in chat) |
| **User Experience** | Interrupt-based | Conversational |
| **Implementation** | Service + Frontend | Tool logic + Prompt |
| **Best For** | Critical operations | Destructive with context |

### Guidelines

**Use Approval Queue when:**
- Operation affects external systems (http_post)
- State change is significant (publish)
- User needs to see details in modal

**Use Confirmation Flag when:**
- Operation is destructive (delete)
- Agent should explain context
- Natural conversation flow preferred

---

## Timeout Handling

### Approval Queue Timeout

```typescript
// Default: 5 minutes
setTimeout(() => {
  if (this.pendingRequests.has(id)) {
    resolve({
      approved: false,
      reason: 'Approval request timed out after 5 minutes'
    });
  }
}, 5 * 60 * 1000);
```

**What happens:**
1. Request created
2. 5 minutes pass with no response
3. Promise resolves with `approved: false`
4. Tool result: `{ cancelled: true, reason: "timed out" }`
5. Agent informs user

### Cleanup

```typescript
// After response, cleanup after 1 minute
setTimeout(() => {
  this.pendingRequests.delete(id);
  this.resolvers.delete(id);
  this.responses.delete(id);
}, 60 * 1000);
```

---

## Security Considerations

### Never Auto-Approve

```typescript
// BAD: Don't do this
if (userSaidYesBefore) {
  return { approved: true };
}

// GOOD: Always require explicit approval
const response = await approvalQueue.requestApproval(request);
```

### Validate Approval IDs

```typescript
respondToApproval(id: string, approved: boolean): void {
  const resolver = this.resolvers.get(id);
  if (!resolver) {
    throw new Error('Invalid or expired approval ID');
  }
  // ...
}
```

### Don't Leak Sensitive Data

```typescript
// BAD: Exposing internal IDs
message: `Delete image ${imageRecord.internalPath}?`

// GOOD: User-friendly description
message: `Delete image "${imageRecord.filename}"?`
```

---

## Testing HITL

### Manual Testing

1. Ask agent to delete a page
2. Verify confirmation dialog appears (flag-based) or modal shows (queue-based)
3. Deny - verify operation cancelled
4. Approve - verify operation executes

### Unit Testing

```typescript
describe('ApprovalQueue', () => {
  it('resolves with approved:true when user approves', async () => {
    const queue = new ApprovalQueue();

    // Start approval request
    const promise = queue.requestApproval({
      toolName: 'cms_deletePost',
      input: { slug: 'test' },
      message: 'Delete test post?'
    });

    // Simulate user approval
    const pendingId = Array.from(queue['pendingRequests'].keys())[0];
    queue.respondToApproval(pendingId, true);

    const result = await promise;
    expect(result.approved).toBe(true);
  });

  it('times out after 5 minutes', async () => {
    jest.useFakeTimers();
    const queue = new ApprovalQueue();

    const promise = queue.requestApproval({
      toolName: 'cms_deletePost',
      input: { slug: 'test' },
      message: 'Delete?'
    });

    // Fast-forward 5 minutes
    jest.advanceTimersByTime(5 * 60 * 1000);

    const result = await promise;
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('timed out');
  });
});
```

---

## Integration Points

| Connects To | How |
|-------------|-----|
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) | streamAgentWithApproval handles queue |
| [3.2 Tools](./LAYER_3.2_TOOLS.md) | Tool metadata defines requiresApproval |
| [3.4 Prompts](./LAYER_3.4_PROMPTS.md) | Confirmation workflow instructions |
| [3.7 Streaming](./LAYER_3.7_STREAMING.md) | approval-required SSE event |
| Frontend | Modal component, approval store |

---

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Modal doesn't appear | SSE event not parsed | Check event type handling |
| Approval times out immediately | Clock skew or early cleanup | Check timeout values |
| Agent proceeds without confirmation | Prompt not followed | Add more examples to prompt |
| Duplicate approvals | Race condition | Use unique approval IDs |

---

## Further Reading

- [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Orchestrator integration
- [3.2 Tools](./LAYER_3.2_TOOLS.md) - Tool metadata
- [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - Confirmation instructions
- [3.7 Streaming](./LAYER_3.7_STREAMING.md) - SSE events
