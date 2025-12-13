# Tool Discovery Lifecycle Plan

## Problem Statement

The current tool discovery system has several issues:

1. **Discovered tools are not persisted**: `WorkingContext.addDiscoveredTools()` exists but is never called
2. **Tools lost between turns**: Module-level state is cleared each request
3. **After compaction, tools vanish**: No mechanism to restore or rediscover
4. **Summary mentions tools that aren't active**: Agent sees tool names but can't use them
5. **Token bloat risk**: Accumulating tool guidance across long sessions

## Proposed Solution: Clean Slate After Compaction

### Core Principle

> Tools are discovered per-task, not accumulated forever. After compaction, start fresh.

### Key Design Decisions

| Aspect                               | Decision              | Rationale                                 |
| ------------------------------------ | --------------------- | ----------------------------------------- |
| Persist tools to DB?                 | Yes, during turn      | Survive between turns before compaction   |
| Keep tools after compaction?         | No, clear them        | Fresh start, no token bloat               |
| Mention tools in summary?            | No, describe outcomes | Agent doesn't need tool names to continue |
| Re-inject guidance after compaction? | No                    | Agent rediscovers via searchTools         |

---

## Implementation Plan

### Phase 1: Persist Discovered Tools to DB

**Goal**: Tools discovered via `searchTools` are saved to session and survive between turns.

#### 1.1 Update Stream Processor to Save Discovered Tools

**File**: `server/execution/stream-processor.ts`

```typescript
// In processStream(), after handling tool-result for searchTools:

case 'tool-result':
  // ... existing code ...

  // NEW: Persist discovered tools from searchTools
  if (chunk.toolName === 'searchTools' && chunk.output) {
    const searchResult = chunk.output as { tools?: string[] };
    if (searchResult.tools?.length) {
      workingContext.addDiscoveredTools(searchResult.tools);
    }
  }

  // Extract entities for working memory
  this.extractEntities(chunk.toolName, chunk.output, workingContext);
  break;
```

#### 1.2 Verify WorkingContext Serialization

**File**: `server/memory/working-context/working-context.ts`

Already implemented correctly:

-   `toJSON()` includes `discoveredTools`
-   `fromJSON()` restores `discoveredTools`

No changes needed.

#### 1.3 Verify Session Service Persistence

**File**: `server/services/session-service.ts`

Trace the save/load path to confirm `workingContext` is properly serialized.

```typescript
// saveWorkingContext should call workingContext.toJSON()
// loadWorkingContext should call WorkingContext.fromJSON()
```

---

### Phase 2: Update Compaction to Clear Tools

**Goal**: After compaction, discovered tools are cleared for a fresh start.

#### 2.1 Clear WorkingContext After Compaction

**File**: `server/execution/context-coordinator.ts`

```typescript
// In prepareContext(), after compaction completes:

if (result.wasCompacted) {
	// Full reset - summary has all context in prose form
	workingContext.clear();

	// Save the cleared state
	await this.deps.sessionService.saveWorkingContext(options.sessionId, workingContext);

	logger.info("Cleared working context after compaction", {
		sessionId: options.sessionId,
	});
}
```

#### 2.2 Add clear Method

**File**: `server/memory/working-context/working-context.ts`

```typescript
/** Full reset - clear all state (called after compaction) */
clear(): void {
  this.entitiesById.clear();
  this.entityOrder = [];
  this.discoveredTools.clear();
  this.usedTools.clear();
  this._version++;
  this._cachedContextString = null;
}
```

Also add individual clear methods for flexibility:

```typescript
/** Clear all discovered tools (called after compaction) */
clearDiscoveredTools(): void {
  this.discoveredTools.clear();
  this._version++;
}
```

---

### Phase 3: Update Compaction Prompt

**Goal**: Summary describes outcomes, not tool names.

#### 3.1 Update Compaction Prompt

**File**: `server/prompts/compaction/compaction-prompt.xml`

```xml
<system>
You are summarizing a CMS agent conversation to help continue it in a new context window.

The AI continuing this conversation will NOT have access to the original messages.
Your summary becomes the starting context - make it actionable and specific.

IMPORTANT: Describe WHAT was done, not HOW. Do not mention tool names.

❌ "Used updateSectionContent to change the hero title"
✅ "Changed the hero title on Home page to 'Welcome'"

❌ "Called searchImages and attachImage to add a photo"
✅ "Added a mountain landscape image to the hero section"

Provide a detailed but concise summary that captures:

## What Was Accomplished
- Pages created/modified (include names and slugs)
- Sections added/updated (describe the content, not the tools)
- Content written or edited
- Site settings changed (navigation, header, footer)
- Images added or changed

## Current State
- Which page/section is being worked on now
- What the user is trying to achieve
- Any partially completed tasks

## User Preferences (Critical)
- Design choices mentioned (colors, layouts, styles)
- Content tone/style preferences
- Any explicit "I want..." or "Make it..." instructions
- Rejected options (things the user said NO to)

## What Comes Next
- Remaining tasks from user's original request
- Any follow-up actions needed
- Unresolved questions or decisions

## Technical Context
- Relevant IDs (pageId, sectionId, postId) for continuing work
- Error states if any occurred

Be specific. Use actual names, IDs, and values. Don't summarize with vague phrases.
Keep under 2000 tokens while preserving all critical context.

Format your response as a continuation prompt that starts with:
"Continuing our conversation about [topic]. Here's where we are:"
</system>
```

Key changes:

-   Added explicit instruction to NOT mention tool names
-   Added examples of good vs bad summaries
-   Removed "Tools used" from Technical Context section

---

### Phase 4: Remove Dead Code

**Goal**: Clean up unused session memory injection code.

#### 4.1 Remove Dead [CONTEXT] Injection

**File**: `server/execution/context-coordinator.ts`

The condition `previousMessages.length === 0 && workingContext.size() > 0` never fires in practice.

```typescript
// REMOVE this block (lines ~142-151):
// if (previousMessages.length === 0 && workingContext.size() > 0) {
//   const contextMessages = createContextRestorationMessages(workingContext);
//   messages.push(...contextMessages);
//   ...
// }
```

#### 4.2 Remove or Deprecate Context Messages

**File**: `server/prompts/messages/context-messages.ts`

Either:

-   Delete the file entirely, OR
-   Keep `createDatetimeMessage` if used elsewhere, remove the rest

#### 4.3 Update System Prompt

**File**: `server/prompts/agent/main-agent-prompt.xml`

Remove or simplify `<context-awareness>` section since `[CONTEXT]` blocks won't exist:

```xml
<context-awareness>
  Your conversation may include:
  - [TOOL GUIDANCE] blocks: Instructions for how to use discovered tools

  After a long conversation, you may see a summary of previous work.
  Use searchTools to find capabilities for new tasks.
</context-awareness>
```

---

### Phase 5: Rename Tool Tips to Tool Guidance

**Goal**: Consistent terminology - these are rules, not tips.

#### 5.1 Update Message Factory

**File**: `server/prompts/messages/tool-guidance-messages.ts`

Already named correctly. Just update the block label in the message content:

```typescript
// Change from:
content: `[TOOL TIPS] Additional guidance for tools...`;

// To:
content: `[TOOL GUIDANCE] Instructions for discovered tools...`;
```

---

## File Changes Summary

| File                                                | Action                                                |
| --------------------------------------------------- | ----------------------------------------------------- |
| `server/execution/stream-processor.ts`              | Add `addDiscoveredTools` call for searchTools results |
| `server/memory/working-context/working-context.ts`  | Add `clear()` method for full reset                   |
| `server/execution/context-coordinator.ts`           | Clear WorkingContext after compaction, remove dead code |
| `server/prompts/compaction/compaction-prompt.xml`   | Update to not mention tool names                      |
| `server/prompts/messages/context-messages.ts`       | Remove or deprecate                                   |
| `server/prompts/agent/main-agent-prompt.xml`        | Simplify context-awareness section                    |
| `server/prompts/messages/tool-guidance-messages.ts` | Rename TOOL TIPS to TOOL GUIDANCE                     |

---

## Flow After Implementation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NEW SESSION                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  activeTools: [searchTools, finalAnswer, acknowledgeRequest]                │
│  discoveredTools (DB): []                                                   │
│  toolsWithGuidanceInjected: [core]                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TURN 1: User asks to update home page                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. searchTools("page update section")                                      │
│  2. Returns: [getPage, getPageSections, updateSectionContent]               │
│  3. stream-processor: workingContext.addDiscoveredTools([...])  ◄── NEW     │
│  4. prepareStep: Inject [TOOL GUIDANCE] for 3 new tools                     │
│  5. Agent uses tools                                                        │
│  6. End of turn: workingContext saved to DB with discoveredTools            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TURN 2: User continues (same task)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Load workingContext from DB (has discoveredTools)                       │
│  2. prepareCall: persistedDiscoveredTools = [getPage, ...]                  │
│  3. Tools already active, guidance already injected (in history)            │
│  4. Agent continues work                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TURN N: Context overflow → COMPACTION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. prepareContext detects overflow                                         │
│  2. LLM generates summary (no tool names, just outcomes)                    │
│  3. Messages replaced: [summary, recent 3 turns]                            │
│  4. workingContext.clearDiscoveredTools()  ◄── NEW                          │
│  5. Save cleared workingContext to DB                                       │
│  6. activeTools reset to [core only]                                        │
│  7. toolsWithGuidanceInjected reset to [core only]                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TURN N+1: User continues after compaction                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Agent reads summary: "Changed hero title on Home page to 'Welcome'"     │
│  2. User: "Now update the footer"                                           │
│  3. Agent: searchTools("footer navigation update")                          │
│  4. Discovers: [getNavItem, updateNavItem]                                  │
│  5. Inject [TOOL GUIDANCE] for 2 tools                                      │
│  6. Agent completes task with fresh, relevant guidance                      │
│                                                                             │
│  ✅ No bloat from irrelevant tools                                          │
│  ✅ Agent has guidance for tools it actually needs                          │
│  ✅ Clean context                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Testing Plan

### Unit Tests

1. **WorkingContext.addDiscoveredTools()** - Tools added and persisted
2. **WorkingContext.clearDiscoveredTools()** - Tools cleared
3. **WorkingContext.toJSON/fromJSON** - Discovered tools survive serialization

### Integration Tests

1. **Tool persistence between turns** - Discover tools in turn 1, verify present in turn 2
2. **Compaction clears tools** - After compaction, discoveredTools is empty
3. **Summary format** - Verify no tool names in generated summary

### Manual Tests

1. Start session, discover tools, refresh page, verify tools still active
2. Have long conversation until compaction, verify clean slate after
3. Verify agent can rediscover tools after compaction

---

## Rollback Plan

If issues arise:

1. Remove `clearDiscoveredTools()` call after compaction
2. Revert compaction prompt changes
3. Tools will accumulate but system will still work

---

## Design Decisions (Resolved)

1. **Tool usage stats**: Cleared with compaction. No need to persist separately.

2. **Entity IDs in summary**: Yes, include them. Agent can read IDs from prose and use directly.

3. **Entities in WorkingContext after compaction**: Clear them. Summary has the IDs in prose form, agent starts accumulating fresh entities as it works.

**Full reset after compaction:**
- Clear discovered tools ✓
- Clear entities ✓
- Clear tool usage stats ✓
- Summary contains all context needed in prose form
