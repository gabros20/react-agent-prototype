# Layer 3.5: Human-in-the-Loop (HITL)

> Human oversight for dangerous operations through conversational confirmation

## Overview

Human-in-the-Loop ensures users maintain control over dangerous or irreversible operations. Our system implements a **unified confirmation flag pattern** where destructive tools return a confirmation request, the agent asks the user conversationally, and only proceeds when the user explicitly confirms.

**Key Files:**
- `server/tools/all-tools.ts` - Tool definitions with `confirmed` parameter
- `server/tools/post-tools.ts` - Post tools (publish, archive, delete)
- `server/tools/image-tools.ts` - Image deletion tool
- `server/prompts/react.xml` - Confirmation workflow instructions

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

Are you sure you want to proceed?

User: yes

Agent: Deleted 5 pages.
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│               Human-in-the-Loop: Confirmed Flag Pattern          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   All destructive operations use the same pattern:              │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  CONFIRMATION FLAG PATTERN (Conversational)             │   │
│   │                                                         │   │
│   │  Used for: deletePage, deletePageSection,               │   │
│   │            deletePageSections, publishPost, archivePost,│   │
│   │            deletePost, deleteImage, httpPost            │   │
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

## Tools Using Confirmation Pattern

| Tool | Risk | Reason |
|------|------|--------|
| `cms_deletePage` | High | Removes page and all sections (cascade) |
| `cms_deletePageSection` | High | Removes section |
| `cms_deletePageSections` | High | Bulk section removal |
| `cms_publishPost` | High | Makes content publicly visible |
| `cms_archivePost` | High | Hides published content |
| `cms_deletePost` | High | Permanent deletion |
| `cms_deleteImage` | High | Removes media permanently |
| `http_post` | High | External API write operation |

---

## Implementation

### Tool Definition Pattern

All destructive tools follow the same pattern:

```typescript
// server/tools/all-tools.ts
export const cmsDeletePage = tool({
  description: 'Delete a page permanently (CASCADE: deletes all sections). This cannot be undone. Requires confirmed: true.',
  inputSchema: z.object({
    slug: z.string().optional().describe('Page slug'),
    id: z.string().optional().describe('Page ID'),
    removeFromNavigation: z.boolean().optional().default(true),
    confirmed: z.boolean().optional().describe('Must be true to actually delete')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentCallOptions;

    // Validate at least one identifier
    if (!input.slug && !input.id) {
      return { error: 'Either slug or id must be provided' };
    }

    // Fetch page first
    const page = input.id
      ? await ctx.services.pageService.getPageById(input.id, ctx.cmsTarget)
      : await ctx.services.pageService.getPageBySlug(input.slug!, ctx.cmsTarget);

    if (!page) {
      return { error: `Page not found: ${input.slug || input.id}` };
    }

    // First call: Return confirmation request
    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to delete page "${page.name}"? This will permanently remove the page and all ${page.sections?.length || 0} sections. This action cannot be undone.`,
        page: { id: page.id, slug: page.slug, name: page.name }
      };
    }

    // Second call: Execute deletion
    await ctx.services.pageService.deletePage(page.id, ctx.cmsTarget);

    return {
      success: true,
      message: `Page "${page.name}" and all its sections have been deleted.`,
      deletedPage: { id: page.id, slug: page.slug, name: page.name }
    };
  }
});
```

### Post Tools Example

```typescript
// server/tools/post-tools.ts
export const cmsPublishPost = tool({
  description: 'Publish a draft post (makes it publicly visible). Requires confirmed: true.',
  inputSchema: z.object({
    postSlug: z.string().describe('Post slug to publish'),
    confirmed: z.boolean().optional().describe('Must be true to publish')
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentCallOptions;
    const entry = await ctx.services.entryService.getBySlug(input.postSlug, ctx.cmsTarget);

    if (!entry) {
      return { error: `Post not found: ${input.postSlug}` };
    }

    if (!input.confirmed) {
      return {
        requiresConfirmation: true,
        message: `Are you sure you want to publish "${entry.title}"? This will make it publicly visible.`,
        post: { slug: entry.slug, title: entry.title, status: entry.status }
      };
    }

    const updated = await ctx.services.entryService.updateEntry(entry.id, {
      status: 'published',
      publishedAt: new Date()
    }, ctx.cmsTarget);

    return { success: true, message: `Published "${entry.title}"`, post: updated };
  }
});
```

---

## Prompt Instructions

The agent is instructed on how to handle confirmations:

```xml
<!-- In react.xml -->
<destructive_operations>
  **THREE-STEP WORKFLOW**

  For tools with `confirmed` parameter (deletePage, deletePageSection,
  publishPost, archivePost, deletePost, deleteImage, httpPost):

  1. FIRST CALL (without confirmed: true)
     cms_deletePage({ slug: "about" })
     → Returns: { requiresConfirmation: true, message: "..." }

  2. STOP AND ASK USER
     Tell the user what will happen.
     DO NOT proceed until they explicitly confirm.
     Wait for their response.

  3. SECOND CALL (with confirmed: true)
     Only after user says yes/confirm/proceed:
     cms_deletePage({ slug: "about", confirmed: true })
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

---

## Flow Example

```
User: "Delete the about page"

Agent (internal):
  THINK: User wants to delete a page. Check working memory.
         Memory: pages: - "About Us" (page-123)
         This is destructive. Need to confirm first.

  ACT: cms_deletePage({ slug: "about" })

  OBSERVE: {
    requiresConfirmation: true,
    message: "Are you sure you want to delete 'About Us'?...",
    page: { id: "page-123", slug: "about", name: "About Us" }
  }

  THINK: Got confirmation requirement. Must ask user.

FINAL_ANSWER: This will permanently delete the "About Us" page
along with all its sections. This cannot be undone.

Are you sure you want to proceed?

---

User: "yes"

Agent (internal):
  THINK: User confirmed deletion. Proceed with confirmed: true.

  ACT: cms_deletePage({ slug: "about", confirmed: true })

  OBSERVE: { success: true, message: "Page deleted successfully." }

FINAL_ANSWER: Done! The About Us page has been deleted.
```

---

## Confirmation Detection

The frontend detects `requiresConfirmation: true` in tool results and logs it as a special trace entry type:

```typescript
// app/assistant/_hooks/use-agent.ts
case 'tool-result': {
  const result = data.result || {};
  const requiresConfirmation = result.requiresConfirmation === true;

  if (requiresConfirmation) {
    // Tool returned a confirmation request
    addEntry({
      traceId: currentTraceId,
      type: 'confirmation-required',
      level: 'warn',
      toolName: data.toolName,
      summary: `${data.toolName}: Confirmation required`,
      output: result,
    });
  }
  // ...
}
```

---

## Why Conversational Confirmation?

| Aspect | Modal Popup | Conversational (Our Approach) |
|--------|-------------|-------------------------------|
| **UI** | Interrupt with modal | Inline in chat |
| **User Experience** | Jarring, blocks everything | Natural conversation flow |
| **Context** | User must read modal | Agent explains consequences |
| **Implementation** | Complex (approval queue, SSE events, endpoints) | Simple (tool logic + prompt) |
| **Works with Express backend** | Requires special SDK integration | Yes, standard tool pattern |

### Key Advantages

1. **Natural Flow** - User confirms in the same conversation they started
2. **Agent Explains** - Agent can provide context about what will happen
3. **Simple Implementation** - No special infrastructure needed
4. **Backend Agnostic** - Works with any backend, not tied to SDK patterns
5. **Full Conversation Context** - User can ask follow-up questions before confirming

---

## Security Considerations

### Never Auto-Confirm

```typescript
// BAD: Don't do this
if (userSaidYesBefore) {
  return executeImmediately();
}

// GOOD: Always require explicit confirmation
if (!input.confirmed) {
  return { requiresConfirmation: true, message: '...' };
}
```

### Always Show Details

```typescript
// GOOD: Tell user exactly what will happen
return {
  requiresConfirmation: true,
  message: `Delete "${page.name}" and all ${page.sections.length} sections?`,
  page: { id: page.id, slug: page.slug, name: page.name }
};
```

### Don't Leak Sensitive Data

```typescript
// BAD: Exposing internal paths
message: `Delete image ${imageRecord.internalPath}?`

// GOOD: User-friendly description
message: `Delete image "${imageRecord.filename}"?`
```

---

## Testing HITL

### Manual Testing

1. Ask agent to delete a page
2. Verify agent asks for confirmation (doesn't delete immediately)
3. Say "no" - verify operation is cancelled
4. Ask again, say "yes" - verify operation executes
5. Check working memory is updated after deletion

### Example Test Scenarios

```
# Test 1: Cancellation
User: "Delete the homepage"
Agent: "Are you sure? This will delete..."
User: "no"
Agent: "Okay, I won't delete the homepage."

# Test 2: Confirmation
User: "Delete the test page"
Agent: "Are you sure? This will delete..."
User: "yes"
Agent: "Done! The test page has been deleted."

# Test 3: Multiple confirmations
User: "Delete all draft pages"
Agent: "I found 3 draft pages. Let me delete them one by one..."
Agent: "Delete 'Draft 1'?"
User: "yes"
Agent: "Deleted. Delete 'Draft 2'?"
...
```

---

## Integration Points

| Connects To | How |
|-------------|-----|
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) | Agent handles tool results with requiresConfirmation |
| [3.2 Tools](./LAYER_3.2_TOOLS.md) | Tool definitions include confirmed parameter |
| [3.4 Prompts](./LAYER_3.4_PROMPTS.md) | Confirmation workflow instructions |
| [3.7 Streaming](./LAYER_3.7_STREAMING.md) | tool-result events include confirmation state |
| Frontend Trace | confirmation-required type in trace store |

---

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Agent deletes without confirming | Prompt not followed | Add more examples to prompt |
| Agent auto-confirms | Previous "yes" cached | Ensure each deletion is fresh |
| Confirmation loop | User response not recognized | Check confirmation word detection |
| Wrong page deleted | Reference resolution | Verify working memory has correct page |

---

## Further Reading

- [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Agent execution flow
- [3.2 Tools](./LAYER_3.2_TOOLS.md) - Tool definitions
- [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - Confirmation instructions
- [3.7 Streaming](./LAYER_3.7_STREAMING.md) - SSE events
