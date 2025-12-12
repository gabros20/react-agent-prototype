# Message Store Migration Plan

## Summary

Migrate from legacy `SessionService` message handling to the proper `MessageStore` pattern following OpenCode's architecture. This enables proper compaction tracking with persisted `compactedAt` timestamps.

---

## Current State Analysis

### What Exists But Isn't Connected

1. **Schema exists** (`server/db/schema.ts`):
   - `messageParts` table with `compactedAt`, `tokens`, `sortOrder`
   - `sessions` table with `compactionCount`, `lastCompactionAt`, `currentlyCompacting`
   - `messages` table with `tokens`, `isSummary`, `isCompactionTrigger`

2. **MessageStore service exists** (`server/services/message-store.ts`):
   - `saveRichMessage()` - saves to both `messages` and `messageParts` tables
   - `loadRichMessages()` - loads with parts joined
   - `updatePart()` - updates individual parts (for marking `compactedAt`)
   - `markPartsCompacted()` - bulk compaction marking
   - `getCompactionStats()` - session-level stats

3. **Problem**: Compaction route uses `SessionService.addMessage()` which:
   - Only saves to `messages` table
   - Doesn't populate `messageParts` table
   - Loses `compactedAt` field (replaced with placeholder content)

---

## OpenCode Architecture Reference

### Key Patterns from OpenCode

**1. Message/Part Separation**
- Messages stored at: `storage/message/{sessionID}/{messageID}.json`
- Parts stored at: `storage/part/{messageID}/{partID}.json`
- Clean separation allows updating individual parts without rewriting messages

**2. Part Types (from `MessageV2`)**
```typescript
Part = discriminatedUnion([
  TextPart,       // text content
  ToolPart,       // tool calls with state (pending/running/completed/error)
  StepStartPart,  // step boundaries
  StepFinishPart, // step completion with tokens/cost
  ReasoningPart,  // thinking content
  CompactionPart, // compaction markers
  SnapshotPart,   // git snapshots
  PatchPart,      // file patches
  RetryPart,      // retry tracking
])
```

**3. Tool State with Compaction**
```typescript
ToolStateCompleted = {
  status: "completed",
  input: Record<string, any>,
  output: string,
  title: string,
  metadata: Record<string, any>,
  time: {
    start: number,
    end: number,
    compacted: number | undefined,  // <-- KEY: compactedAt timestamp
  },
}
```

**4. Pruning Flow**
```typescript
// From compaction.ts
async function prune(input: { sessionID: string }) {
  const msgs = await Session.messages({ sessionID: input.sessionID })
  // ... find parts to prune ...
  for (const part of toPrune) {
    if (part.state.status === "completed") {
      part.state.time.compacted = Date.now()  // Mark as compacted
      await Session.updatePart(part)          // Update just the part
    }
  }
}
```

**5. Session Update**
```typescript
// Update individual part without touching message
export const updatePart = fn(MessageV2.Part, async (part) => {
  await Storage.write(["part", part.messageID, part.id], part)
  Bus.publish(MessageV2.Event.PartUpdated, { part })
  return part
})
```

---

## Migration Plan

### Phase 1: Activate MessageStore in Service Container

**File**: `server/services/index.ts`

Add MessageStore to service container:
```typescript
import { MessageStore, createMessageStore } from './message-store';

export interface Services {
  // ... existing
  messageStore: MessageStore;
}

export function createServices(db: DrizzleDB): Services {
  const messageStore = createMessageStore(db);
  // ...
  return {
    // ...
    messageStore,
  };
}
```

### Phase 2: Update Compaction Route

**File**: `server/routes/sessions.ts`

Replace old approach with MessageStore:
```typescript
// POST /v1/sessions/:id/compact
router.post("/:id/compact", async (req, res, next) => {
  const input = compactContextSchema.parse(req.body);
  const messageStore = services.messageStore;

  // Load as RichMessage array (preserves structure)
  const richMessages = await messageStore.loadRichMessages(req.params.id);

  if (richMessages.length === 0) {
    return res.json(ApiResponse.success({ compacted: false, reason: "No messages" }));
  }

  // Convert to ModelMessage for AI SDK
  const modelMessages = richMessagesToModel(richMessages);

  // Run compaction
  const { messages: compactedRich, result } = await prepareContext(
    modelMessages,
    { sessionId: req.params.id, modelId: input.modelId, force: input.force }
  );

  // If compaction happened, update parts in-place (not recreate)
  if (result.wasPruned) {
    // Find which parts were pruned and mark them
    for (const msg of compactedRich) {
      if (msg.role === "tool") {
        for (const part of msg.parts) {
          if (part.compactedAt) {
            await messageStore.updatePart(part.id, { compactedAt: part.compactedAt });
          }
        }
      }
    }

    // Update session compaction tracking
    await updateSessionCompactionStats(req.params.id);
  }

  // If full compaction (summary), save new message
  if (result.wasCompacted && compactedRich.some(m => m.isSummary)) {
    const summaryMsg = compactedRich.find(m => m.isSummary);
    if (summaryMsg) {
      await messageStore.saveRichMessage(summaryMsg);
    }
  }

  res.json(ApiResponse.success({ ... }));
});
```

### Phase 3: Unified Message Save Flow

**Key Change**: All message saves go through MessageStore

**File**: `server/execution/orchestrator.ts` (or wherever messages are saved after agent execution)

```typescript
// After agent step completes
async function saveStepResult(sessionId: string, stepResult: StepResult) {
  const messageStore = services.messageStore;

  // Convert AI SDK message to RichMessage
  const richMessage = modelMessageToRich(stepResult.message, sessionId);

  // Save with parts
  await messageStore.saveRichMessage(richMessage);
}
```

### Phase 4: Update Frontend API Response

**File**: `server/routes/sessions.ts`

Update `getSessionById` to include parts:
```typescript
router.get("/:id", async (req, res, next) => {
  const session = await services.sessionService.getSessionById(req.params.id);

  // Also load parts for each message
  const messagesWithParts = await Promise.all(
    session.messages.map(async (msg) => {
      const parts = await db.query.messageParts.findMany({
        where: eq(schema.messageParts.messageId, msg.id),
        orderBy: asc(schema.messageParts.sortOrder),
      });
      return { ...msg, parts };
    })
  );

  res.json(ApiResponse.success({
    ...session,
    messages: messagesWithParts,
  }));
});
```

### Phase 5: Update Chat History Panel

**File**: `app/assistant/_components/enhanced-debug/chat-history-panel.tsx`

Update to use actual `compactedAt` from parts:
```typescript
// In PartView component
const isCompacted = part.compactedAt !== undefined && part.compactedAt !== null;
// No longer need placeholder detection as fallback
```

---

## Implementation Order

1. **Add MessageStore to Services** - Wire up to dependency injection
2. **Create migration for existing data** - Populate `messageParts` from existing `messages.content`
3. **Update compaction route** - Use MessageStore for loading/saving
4. **Update agent orchestrator** - Save new messages via MessageStore
5. **Update API responses** - Include parts in session/message endpoints
6. **Update frontend** - Use `compactedAt` field directly
7. **Update context-stats route** - Use MessageStore for accurate counts
8. **Add session compaction tracking** - Increment `compactionCount`, set `lastCompactionAt`

---

## Data Migration Script

Create `scripts/migrate-message-parts.ts`:
```typescript
// For each existing message:
// 1. Parse content JSON
// 2. Create messageParts records
// 3. Preserve timestamps
```

---

## Testing Checklist

- [ ] New messages populate `messageParts` table
- [ ] Compaction updates `compactedAt` on parts
- [ ] `loadRichMessages` returns complete structure
- [ ] Session `compactionCount` increments correctly
- [ ] Frontend shows compacted state correctly
- [ ] Context stats reflect accurate compacted counts
- [ ] Existing sessions still load (backward compatible)

---

## Breaking Changes

- API response for sessions will include `parts` array on each message
- Frontend must handle both old (no parts) and new (with parts) formats during migration

---

## Files to Modify

| File | Changes |
|------|---------|
| `server/services/index.ts` | Add MessageStore to container |
| `server/routes/sessions.ts` | Use MessageStore in routes |
| `server/execution/orchestrator.ts` | Save via MessageStore |
| `app/assistant/_components/enhanced-debug/chat-history-panel.tsx` | Use `compactedAt` field |
| `lib/api/sessions.ts` | Update types for parts |

---

## Notes

- This aligns with OpenCode's pattern of separate message/part storage
- Enables in-place part updates (for compaction) without message recreation
- Preserves full audit trail of what was compacted and when
- Better token tracking at part level
