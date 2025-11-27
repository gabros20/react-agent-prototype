# Layer 6.5: HITL UI

> Human-in-the-loop approval modal for dangerous tool operations

## Overview

The HITL (Human-in-the-Loop) UI provides user control over dangerous agent operations. When the agent attempts to call a high-risk tool (delete, publish, etc.), the HITLModal intercepts the request and requires explicit user approval before proceeding.

**Key Responsibilities:**

-   Display approval modal for dangerous tool calls
-   Show tool name, description, and input for review
-   Send approve/reject responses to backend
-   Block agent execution until user responds

---

## The Problem

Without HITL UI:

```typescript
// WRONG: Silent dangerous operations
await deleteAllPages();  // User never knew this happened

// WRONG: No control over destructive actions
await publishPage({ id: "draft-123" });  // Published without consent

// WRONG: Agent runs unchecked
agent.run("delete everything");  // No safeguard

// WRONG: No review opportunity
cms_updatePage({ content: "..." });  // User can't verify before save
```

**Our Solution:**

1. HITLModal triggered by `approval-required` SSE events
2. Modal displays tool details for user review
3. Approve/Reject buttons with clear actions
4. Backend approval endpoint to continue/abort execution
5. 5-minute timeout with automatic rejection

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         HITL UI                                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                      HITLModal                             │  │
│  │                                                            │  │
│  │  Triggers when: approvalStore.pendingApproval !== null     │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  ⚠️ Approval Required                                │  │  │
│  │  │                                                      │  │  │
│  │  │  Tool: cms_deletePage                                │  │  │
│  │  │                                                      │  │  │
│  │  │  Description:                                        │  │  │
│  │  │  Delete page "About Us" permanently                  │  │  │
│  │  │                                                      │  │  │
│  │  │  Input:                                              │  │  │
│  │  │  ┌────────────────────────────────────────────┐      │  │  │
│  │  │  │ { "pageId": "abc123" }                     │      │  │  │
│  │  │  └────────────────────────────────────────────┘      │  │  │
│  │  │                                                      │  │  │
│  │  │  [Reject]                           [Approve]        │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                                       | Purpose                |
| ------------------------------------------ | ---------------------- |
| `app/assistant/_components/hitl-modal.tsx` | Approval modal dialog  |
| `app/assistant/_stores/approval-store.ts`  | Pending approval state |

---

## Core Implementation

### HITL Modal

```typescript
// app/assistant/_components/hitl-modal.tsx
export function HITLModal() {
  const { pendingApproval, setPendingApproval } = useApprovalStore();

  const handleApprove = async () => {
    if (!pendingApproval) return;

    const approvalId = pendingApproval.approvalId || pendingApproval.stepId;

    try {
      const response = await fetch(`/api/agent/approval/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved: true,
          reason: "User approved via modal",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send approval");
      }

      setPendingApproval(null);
    } catch (error) {
      console.error("Error approving:", error);
      alert("Failed to send approval");
    }
  };

  const handleReject = async () => {
    if (!pendingApproval) return;

    const approvalId = pendingApproval.approvalId || pendingApproval.stepId;

    try {
      const response = await fetch(`/api/agent/approval/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved: false,
          reason: "User rejected via modal",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send rejection");
      }

      setPendingApproval(null);
    } catch (error) {
      console.error("Error rejecting:", error);
      alert("Failed to send rejection");
    }
  };

  return (
    <Dialog open={!!pendingApproval} onOpenChange={() => setPendingApproval(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Approval Required
          </DialogTitle>
          <DialogDescription>
            The agent wants to perform a high-risk operation.
          </DialogDescription>
        </DialogHeader>

        {pendingApproval && (
          <div className="space-y-4">
            <div>
              <p className="font-medium text-sm mb-1">Tool:</p>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {pendingApproval.toolName}
              </code>
            </div>

            <div>
              <p className="font-medium text-sm mb-1">Description:</p>
              <p className="text-sm text-muted-foreground">
                {pendingApproval.description}
              </p>
            </div>

            <div>
              <p className="font-medium text-sm mb-1">Input:</p>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
                {JSON.stringify(pendingApproval.input, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleReject}>
            Reject
          </Button>
          <Button onClick={handleApprove}>Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Approval Store

```typescript
// app/assistant/_stores/approval-store.ts
interface PendingApproval {
  approvalId?: string;
  stepId?: string;
  toolName: string;
  description: string;
  input: unknown;
}

interface ApprovalState {
  pendingApproval: PendingApproval | null;
  setPendingApproval: (approval: PendingApproval | null) => void;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  pendingApproval: null,
  setPendingApproval: (approval) => set({ pendingApproval: approval }),
}));
```

### SSE Event Handling

```typescript
// app/assistant/_hooks/use-agent.ts
case 'approval-required': {
  const { approvalId, toolName, input, description } = data;

  useApprovalStore.getState().setPendingApproval({
    approvalId,
    toolName,
    description,
    input,
  });
  break;
}
```

---

## Design Decisions

### Why Modal for Approvals (Not Inline)?

```typescript
<Dialog open={!!pendingApproval}>
```

**Reasons:**

1. **Blocking UX** - User must respond before agent continues
2. **High visibility** - Can't miss the request
3. **Focus attention** - Review the operation carefully
4. **Clear action** - Approve or reject, nothing else

### Why Send Approval via API (Not SSE)?

```typescript
await fetch(`/api/agent/approval/${approvalId}`, {
  method: "POST",
  body: JSON.stringify({ approved, reason }),
});
```

**Reasons:**

1. **Reliable delivery** - HTTP POST is more reliable than upstream messages
2. **Backend control** - Server orchestrates the approval queue
3. **Audit trail** - Can log approvals in backend
4. **Timeout handling** - Backend manages 5-minute timeout

### Why Separate Approval Store?

```typescript
const { pendingApproval, setPendingApproval } = useApprovalStore();
```

**Reasons:**

1. **Single responsibility** - Only approval state
2. **Clean triggers** - Modal opens when pendingApproval !== null
3. **Isolation** - Approval state separate from agent state
4. **Easy testing** - Mock store independently

---

## Approval Flow

```
Backend: approval-required event
        │
        ▼
useAgent: setPendingApproval({...})
        │
        ▼
HITLModal: Dialog opens, shows details
        │
        ├─── [Approve] ─────────────────────┐
        │                                    │
        └─── [Reject] ─────┐                │
                           │                │
                           ▼                ▼
                POST /api/agent/approval/:id
                { approved: false/true }
                           │
                           ▼
                Backend: resolves promise
                Agent: continues or aborts
```

---

## Confirmation Flag vs HITL Approval

Two distinct patterns exist for user confirmation:

### 1. HITL Approval (This Layer)

- Tool marked with `needsApproval: true` in metadata
- AI SDK emits `approval-required` event
- **SSE stream pauses** waiting for approval
- User approves/rejects via modal
- Stream resumes or terminates

### 2. Confirmation Flag Pattern (In-Band)

- Tool returns `{requiresConfirmation: true, message: "..."}`
- Agent shows message and waits for user response
- User responds "yes" → Agent calls tool again with `confirmed: true`
- **Does NOT pause SSE stream** - handled conversationally

---

## Integration Points

| Connects To                  | How                                |
| ---------------------------- | ---------------------------------- |
| Layer 6.1 (State Management) | approval-store                     |
| Layer 6.2 (SSE Streaming)    | approval-required event            |
| Layer 3.5 (Backend HITL)     | Approval endpoint resolves promise |
| Layer 4.7 (Approval Queue)   | Backend queue management           |

---

## Common Issues / Debugging

### Modal Not Showing

```
// approval-required event received but no modal
```

**Cause:** pendingApproval not set or modal not mounted.

**Debug:**

```typescript
// In useAgent
console.log('Setting approval:', data);
useApprovalStore.getState().setPendingApproval({...});

// Check state
console.log('Approval state:', useApprovalStore.getState());
```

### Approval Timeout

```
// Modal shows but agent times out
```

**Cause:** User took too long (5-minute backend timeout).

**Fix:** Backend handles this - agent receives rejection.

### Approval Response Not Sent

```
// Click approve but agent doesn't continue
```

**Cause:** API request failed or wrong approvalId.

**Debug:**

```typescript
console.log('Sending approval for:', approvalId);
const response = await fetch(`/api/agent/approval/${approvalId}`, ...);
console.log('Response:', response.status);
```

### Modal Closes Unexpectedly

```
// Modal disappears before user action
```

**Cause:** setPendingApproval(null) called elsewhere.

**Debug:**

```typescript
// Search for all setPendingApproval calls
// Ensure only approve/reject handlers clear it
```

---

## Further Reading

-   [Layer 3.5: Backend HITL](./LAYER_3.5_HITL.md) - Server-side approval queue
-   [Layer 4.7: Approval Queue](./LAYER_4.7_APPROVAL_QUEUE.md) - Queue implementation
-   [Layer 6.1: State Management](./LAYER_6.1_STATE_MANAGEMENT.md) - approval-store
-   [Layer 6.2: SSE Streaming](./LAYER_6.2_SSE_STREAMING.md) - Event dispatching
-   [Layer 6.6: Trace Observability](./LAYER_6.6_TRACE_OBSERVABILITY.md) - Debug panel (separate)
-   [shadcn/ui Dialog](https://ui.shadcn.com/docs/components/dialog)
