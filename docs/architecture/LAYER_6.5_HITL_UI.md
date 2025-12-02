# Layer 6.5: HITL UI - Trace Observability

> Debug panel and trace visualization for agent execution

## Overview

The HITL (Human-in-the-Loop) system uses a **conversational confirmation pattern** rather than modal popups. Destructive operations are handled entirely through chat conversation - the agent asks for confirmation and the user responds in the chat. The frontend's role is to visualize this in the debug/trace panel.

**Key Responsibilities:**

- Display confirmation-required events in trace panel
- Show tool execution flow with confirmation states
- Provide visibility into agent reasoning during confirmations
- No modal UI - confirmations are conversational

---

## Architecture Change: From Modals to Conversation

### Previous Architecture (Deprecated)

```
// OLD: Modal-based approval - NO LONGER USED
approval-required SSE event → approval-store → HITLModal → POST /approve
```

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              HITL: Conversational Confirmation                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Tool returns { requiresConfirmation: true }                 │
│                    │                                            │
│                    ▼                                            │
│  2. Agent displays confirmation message in chat                 │
│                    │                                            │
│                    ▼                                            │
│  3. User responds "yes" or "no" in chat                        │
│                    │                                            │
│                    ▼                                            │
│  4. Agent calls tool with confirmed: true (or cancels)         │
│                                                                 │
│  Trace Panel shows: confirmation-required entry                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Trace Entry Types for Confirmations

The trace store tracks confirmation-related events among 20+ entry types:

```typescript
// app/assistant/_stores/trace-store.ts
export type TraceEntryType =
  | "trace-start" | "trace-complete"
  | "system-prompt" | "user-prompt" | "llm-response" | "text-streaming"
  | "tools-available" | "model-info"
  | "tool-call" | "tool-error" | "confirmation-required"  // <-- confirmation
  | "step-start" | "step-complete"
  | "job-queued" | "job-progress" | "job-complete" | "job-failed"
  | "working-memory-update" | "memory-trimmed" | "session-loaded"
  | "retry-attempt" | "checkpoint-saved" | "system-log" | "error";
```

### Confirmation Detection

```typescript
// app/assistant/_hooks/use-agent.ts
case 'tool-result': {
  const result = data.result || {};
  const requiresConfirmation = result.requiresConfirmation === true;

  if (requiresConfirmation) {
    // Log as special trace entry type
    addEntry({
      traceId: currentTraceId,
      timestamp: Date.now(),
      type: 'confirmation-required',
      level: 'warn',
      toolName: data.toolName,
      toolCallId,
      summary: `${data.toolName}: Confirmation required`,
      output: result,
    });
  } else {
    // Normal tool result - update existing entry
    completeEntry(toolCallId, result, undefined);
  }
}
```

---

## Trace Panel Visualization

### Entry Type Colors

```typescript
// app/assistant/_stores/trace-store.ts
export const ENTRY_TYPE_COLORS: Record<TraceEntryType, string> = {
  "tool-call": "bg-amber-500",
  "confirmation-required": "bg-orange-400", // Highlighted for attention
  // ... other colors
};

export const ENTRY_TYPE_LABELS: Record<TraceEntryType, string> = {
  "tool-call": "Tool",
  "confirmation-required": "Confirm?",
  // ... other labels
};
```

### Trace Entry Display

When a confirmation is required, the trace panel shows:

```
┌─────────────────────────────────────────────────────────┐
│ [10:30:15.234] [Tool] cms_deletePage                    │
│   Input: { slug: "about" }                              │
│   Duration: 45ms                                        │
├─────────────────────────────────────────────────────────┤
│ [10:30:15.280] [Confirm?] cms_deletePage                │
│   ⚠️ Confirmation required                              │
│   Output: {                                             │
│     requiresConfirmation: true,                         │
│     message: "Are you sure you want to delete...",      │
│     page: { id: "...", slug: "about", name: "About" }   │
│   }                                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/assistant/_stores/trace-store.ts` | Trace entries including confirmation-required type |
| `app/assistant/_hooks/use-agent.ts` | SSE parsing and confirmation detection |
| `app/assistant/_components/debug-pane.tsx` | Trace visualization |

### Removed Files

The following files were removed as part of the modal-to-conversation migration:

- ~~`app/assistant/_components/hitl-modal.tsx`~~ - Modal no longer used
- ~~`app/assistant/_stores/approval-store.ts`~~ - Approval state no longer needed
- ~~`app/assistant/_components/approval-card.tsx`~~ - Inline card removed

---

## User Flow: Confirmation in Chat

### Example Interaction

```
┌─────────────────────────────────────────────────────────┐
│                      Chat Pane                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User: Delete the about page                            │
│                                                         │
│  Agent: This will permanently delete the "About Us"     │
│         page along with all 3 sections. This cannot     │
│         be undone.                                      │
│                                                         │
│         Are you sure you want to proceed?               │
│                                                         │
│  User: yes                                              │
│                                                         │
│  Agent: Done! The About Us page has been deleted.       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Corresponding Trace

```
┌─────────────────────────────────────────────────────────┐
│                     Debug Panel                          │
├─────────────────────────────────────────────────────────┤
│ [10:30:15.100] [Prompt] User message sent               │
│ [10:30:15.234] [Tool] cms_deletePage                    │
│ [10:30:15.280] [Confirm?] Confirmation required         │
│ [10:30:15.300] [Response] Agent asks for confirmation   │
│ [10:30:18.500] [Prompt] User confirms "yes"             │
│ [10:30:18.650] [Tool] cms_deletePage (confirmed)        │
│ [10:30:18.900] [Tool] ✓ Page deleted                    │
│ [10:30:19.000] [Response] Agent confirms deletion       │
└─────────────────────────────────────────────────────────┘
```

---

## Why Conversational Over Modal?

| Aspect | Modal Approach | Conversational (Current) |
|--------|----------------|--------------------------|
| User Experience | Interrupting, jarring | Natural flow |
| Context | Isolated modal | Full conversation context |
| Implementation | Complex (approval queue, endpoints, stores) | Simple (tool logic) |
| Backend | Requires SDK-specific features | Works with any backend |
| Multi-step | Awkward | Natural ("delete these 3 pages?") |

### Benefits of Conversational Approach

1. **Natural UX** - User stays in chat flow
2. **Agent Can Explain** - Agent provides context about consequences
3. **Questions Welcome** - User can ask "what sections will be deleted?" before confirming
4. **Simple Architecture** - No approval queue, no extra endpoints, no frontend stores
5. **Backend Agnostic** - Works with Express, doesn't need SDK approval features

---

## Integration Points

| Connects To | How |
|-------------|-----|
| [Layer 3.5: HITL](./LAYER_3.5_HITL.md) | Tool confirmation pattern |
| [Layer 6.1: State Management](./LAYER_6.1_STATE_MANAGEMENT.md) | trace-store (no approval-store) |
| [Layer 6.2: SSE Streaming](./LAYER_6.2_SSE_STREAMING.md) | tool-result event parsing |
| [Layer 6.6: Trace Observability](./LAYER_6.6_TRACE_OBSERVABILITY.md) | Debug panel display |

---

## Common Issues / Debugging

### Confirmation Not Showing in Trace

```
// Tool result has requiresConfirmation but no trace entry
```

**Cause:** Detection logic not triggered.

**Debug:**
```typescript
case 'tool-result': {
  console.log('Tool result:', data.result);
  const requiresConfirmation = data.result?.requiresConfirmation === true;
  console.log('Requires confirmation:', requiresConfirmation);
}
```

### Agent Skips Confirmation

**Cause:** Prompt instructions not followed.

**Fix:** Check `server/prompts/core/base-rules.xml` for proper `<confirmation-pattern>` section with examples.

### User Says "Yes" But Nothing Happens

**Cause:** Agent didn't recognize confirmation word.

**Fix:** Ensure prompt includes confirmation word list: yes, y, yeah, ok, proceed, etc.

---

## Further Reading

- [Layer 3.5: Backend HITL](./LAYER_3.5_HITL.md) - Confirmation flag pattern
- [Layer 6.1: State Management](./LAYER_6.1_STATE_MANAGEMENT.md) - trace-store
- [Layer 6.2: SSE Streaming](./LAYER_6.2_SSE_STREAMING.md) - Event parsing
- [Layer 6.6: Trace Observability](./LAYER_6.6_TRACE_OBSERVABILITY.md) - Debug panel
