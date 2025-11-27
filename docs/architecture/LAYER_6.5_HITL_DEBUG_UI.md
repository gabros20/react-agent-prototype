# Layer 6.5: HITL & Debug UI

> Human-in-the-loop approval modal, execution logging, debug pane filtering

## Overview

The HITL (Human-in-the-Loop) and Debug UI provides visibility into agent execution and control over dangerous operations. The HITLModal intercepts approval requests for high-risk tools, while the DebugPane shows real-time execution logs with filtering and expandable details.

**Key Responsibilities:**
- Display approval modal for dangerous tool calls
- Send approve/reject responses to backend
- Show execution logs in real-time
- Filter logs by type (tool-call, error, etc.)
- Display expandable input/output details

---

## The Problem

Without HITL and debug UI:

```typescript
// WRONG: Silent dangerous operations
await deleteAllPages();  // User never knew this happened

// WRONG: No execution visibility
agent.run(prompt);  // Black box - what's happening?

// WRONG: No error feedback
catch (error) { console.log(error); }  // User doesn't see errors

// WRONG: No control over destructive actions
// Agent can delete, publish, modify without user consent
```

**Our Solution:**
1. HITLModal triggered by `approval-required` SSE events
2. Backend approval endpoint to continue/abort execution
3. DebugPane with real-time log streaming
4. Log filtering by type
5. Collapsible details for inputs/outputs

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    HITL & DEBUG UI                               │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    HITLModal                               │  │
│  │                                                            │  │
│  │  Triggers when: approvalStore.pendingApproval !== null    │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  ⚠️ Approval Required                               │  │  │
│  │  │                                                     │  │  │
│  │  │  Tool: cms_deletePage                               │  │  │
│  │  │                                                     │  │  │
│  │  │  Description:                                       │  │  │
│  │  │  Delete page "About Us" permanently                 │  │  │
│  │  │                                                     │  │  │
│  │  │  Input:                                             │  │  │
│  │  │  ┌───────────────────────────────────────────┐     │  │  │
│  │  │  │ { "pageId": "abc123" }                    │     │  │  │
│  │  │  └───────────────────────────────────────────┘     │  │  │
│  │  │                                                     │  │  │
│  │  │  [Reject]                          [Approve]       │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    DebugPane                               │  │
│  │                                                            │  │
│  │  Header:                                                   │  │
│  │  [🖥️ Execution Log]  [Filter: All ▼]  [Clear]             │  │
│  │  42 events                                                │  │
│  │                                                            │  │
│  │  Log Entries:                                             │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ [tool-call]  cms_listPages        10:32:15  [▼]    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ [tool-result] cms_listPages       10:32:16  [▼]    │  │  │
│  │  │                                                     │  │  │
│  │  │ Input: { "pageId": "..." }                         │  │  │
│  │  │ Output: [{ title: "Home" }, ...]                   │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ [error]  Rate limit exceeded      10:32:20         │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/assistant/_components/hitl-modal.tsx` | Approval modal dialog |
| `app/assistant/_components/debug-pane.tsx` | Execution log viewer |
| `app/assistant/_stores/approval-store.ts` | Pending approval state |
| `app/assistant/_stores/log-store.ts` | Log entries, filtering |

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: true,
          reason: 'User approved via modal'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send approval');
      }

      setPendingApproval(null);
    } catch (error) {
      console.error('Error approving:', error);
      alert('Failed to send approval');
    }
  };

  const handleReject = async () => {
    if (!pendingApproval) return;

    const approvalId = pendingApproval.approvalId || pendingApproval.stepId;

    try {
      const response = await fetch(`/api/agent/approval/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: false,
          reason: 'User rejected via modal'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send rejection');
      }

      setPendingApproval(null);
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Failed to send rejection');
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
          <Button onClick={handleApprove}>
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Debug Pane

```typescript
// app/assistant/_components/debug-pane.tsx
const LOG_TYPE_COLORS: Record<LogEntry["type"], string> = {
  "tool-call": "bg-blue-500",
  "tool-result": "bg-green-500",
  "step-complete": "bg-purple-500",
  "error": "bg-red-500",
  "info": "bg-gray-500",
  "system": "bg-yellow-500",
};

export function DebugPane() {
  const { logs, filterType, setFilterType, clearLogs } = useLogStore();

  const filteredLogs = filterType === "all"
    ? logs
    : logs.filter((log) => log.type === filterType);

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex-none p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Execution Log</h2>
              <p className="text-sm text-muted-foreground">
                {filteredLogs.length} events
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">All</option>
              <option value="tool-call">Tool Calls</option>
              <option value="tool-result">Results</option>
              <option value="step-complete">Steps</option>
              <option value="error">Errors</option>
              <option value="info">Info</option>
              <option value="system">System</option>
            </select>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No log entries yet</p>
                <p className="text-xs mt-1">Logs appear during agent execution</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <LogEntryItem key={log.id} log={log} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function LogEntryItem({ log }: { log: LogEntry }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild disabled={!(log.input || log.output)}>
        <div className="flex items-start gap-2 p-3 border rounded-lg hover:bg-card/50">
          <Badge className={LOG_TYPE_COLORS[log.type]}>
            {log.type}
          </Badge>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {log.toolName && (
                <span className="font-mono text-sm">{log.toolName}</span>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
            {log.message && (
              <p className="text-sm text-muted-foreground mt-1">{log.message}</p>
            )}
          </div>
          {(log.input || log.output) && (
            <ChevronDown className={`h-4 w-4 ${isOpen ? "rotate-180" : ""}`} />
          )}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-3">
        {log.input && (
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Input:</p>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">
              {JSON.stringify(log.input, null, 2)}
            </pre>
          </div>
        )}
        {log.output && (
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Output:</p>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">
              {JSON.stringify(log.output, null, 2)}
            </pre>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
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
  method: 'POST',
  body: JSON.stringify({ approved, reason })
});
```

**Reasons:**
1. **Reliable delivery** - HTTP POST is more reliable than upstream messages
2. **Backend control** - Server orchestrates the approval queue
3. **Audit trail** - Can log approvals in backend
4. **Timeout handling** - Backend manages 5-minute timeout

### Why Color-Coded Log Types?

```typescript
const LOG_TYPE_COLORS = {
  "tool-call": "bg-blue-500",
  "tool-result": "bg-green-500",
  "error": "bg-red-500",
  // ...
};
```

**Reasons:**
1. **Quick scanning** - Identify log types at a glance
2. **Error visibility** - Red errors stand out
3. **Flow tracking** - Blue calls → green results
4. **Consistent UX** - Same colors throughout app

### Why Collapsible Details?

```typescript
<Collapsible open={isOpen}>
  <CollapsibleTrigger>Summary</CollapsibleTrigger>
  <CollapsibleContent>Input/Output JSON</CollapsibleContent>
</Collapsible>
```

**Reasons:**
1. **Reduce noise** - Most logs don't need details
2. **On-demand detail** - Expand when debugging
3. **Performance** - Don't render large JSON until needed
4. **Scrollable** - Details don't overflow

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 6.1 (State Management) | approval-store, log-store |
| Layer 6.2 (SSE Streaming) | Events populate stores |
| Layer 3.5 (Backend HITL) | Approval endpoint resolves promise |
| Layer 4.7 (Approval Queue) | Backend queue management |

### Approval Flow

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

### Log Event Types

| Event | Badge | Source |
|-------|-------|--------|
| `tool-call` | Blue | Agent calling a tool |
| `tool-result` | Green | Tool execution complete |
| `step-complete` | Purple | Agent step finished |
| `error` | Red | Error occurred |
| `info` | Gray | General information |
| `system` | Yellow | System events (approval, etc.) |

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

### Logs Not Appearing

```
// DebugPane empty during execution
```

**Cause:** addLog not called or wrong store import.

**Debug:**

```typescript
// In useAgent
console.log('Adding log:', log);
addLog(log);

// Check store directly
console.log('Logs:', useLogStore.getState().logs);
```

### JSON Display Truncated

```
// Large input/output cut off
```

**Fix:** max-h classes allow scroll:

```typescript
<pre className="max-h-48 overflow-y-auto">
  {JSON.stringify(log.input, null, 2)}
</pre>
```

### Filter Not Working

```
// Filter selected but wrong logs shown
```

**Cause:** filterType not matching log.type values.

**Debug:**

```typescript
console.log('Filter:', filterType);
console.log('Log types:', logs.map(l => l.type));
```

---

## Further Reading

- [Layer 3.5: Backend HITL](./LAYER_3.5_HITL.md) - Server-side approval queue
- [Layer 4.7: Approval Queue](./LAYER_4.7_APPROVAL_QUEUE.md) - Queue implementation
- [Layer 6.1: State Management](./LAYER_6.1_STATE_MANAGEMENT.md) - approval-store, log-store
- [Layer 6.2: SSE Streaming](./LAYER_6.2_SSE_STREAMING.md) - Event dispatching
- [shadcn/ui Dialog](https://ui.shadcn.com/docs/components/dialog)
- [shadcn/ui Collapsible](https://ui.shadcn.com/docs/components/collapsible)
