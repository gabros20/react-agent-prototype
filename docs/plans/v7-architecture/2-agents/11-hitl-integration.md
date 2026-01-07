# Human-in-the-Loop Integration

> **Summary**: HITL is triggered based on agent permissions and action types. Destructive operations (delete) default to 'ask'. Agents can be configured to 'allow', 'ask', or 'deny' for write and delete operations.
>
> **Prerequisites**: [08-agent-model.md](08-agent-model.md), [09-agent-catalog.md](09-agent-catalog.md)

## Overview

Human-in-the-Loop (HITL) integration ensures users approve sensitive operations before they execute. The system pauses agent execution and waits for user approval.

---

## Permission Model

Each agent defines permissions for write and delete operations:

```typescript
interface AgentConfig {
  // ... other fields
  permission: {
    write: 'allow' | 'ask' | 'deny';
    delete: 'allow' | 'ask' | 'deny';
  };
}
```

| Setting | Behavior |
|---------|----------|
| `allow` | Execute immediately without asking |
| `ask` | Pause and wait for user approval |
| `deny` | Block the operation, return error to agent |

---

## Permission Matrix by Agent

| Agent | Write | Delete | Rationale |
|-------|-------|--------|-----------|
| `router` | deny | deny | Classification only, no modifications |
| `orchestrator` | allow | ask | Can create, needs approval to delete |
| `page_specialist` | allow | ask | Building pages, careful with deletion |
| `post_specialist` | allow | ask | Writing posts, careful with deletion |
| `research_specialist` | deny | deny | Read-only research |
| `image_specialist` | allow | ask | Upload ok, delete needs approval |
| `qa_specialist` | deny | deny | Read-only Q&A |

---

## Permission Check Flow

```typescript
async function checkPermission(
  agent: AgentConfig,
  toolCall: ToolCall,
  ctx: ToolContext
): Promise<'allow' | 'ask' | 'deny'> {
  const action = categorizeAction(toolCall.name);  // 'read' | 'write' | 'delete'

  if (action === 'delete') {
    return agent.permission.delete;
  }
  if (action === 'write') {
    return agent.permission.write;
  }
  return 'allow';  // reads are always allowed
}

function categorizeAction(toolName: string): 'read' | 'write' | 'delete' {
  if (toolName.includes('delete') || toolName.includes('remove')) {
    return 'delete';
  }
  if (toolName.includes('create') || toolName.includes('update') || toolName.includes('add')) {
    return 'write';
  }
  return 'read';
}
```

---

## Execution with HITL

```typescript
async function executeTool(toolCall: ToolCall, ctx: ToolContext) {
  const permission = await checkPermission(agent, toolCall, ctx);

  if (permission === 'deny') {
    return {
      success: false,
      error: 'Action not permitted for this agent'
    };
  }

  if (permission === 'ask') {
    // Pause and wait for user approval
    ctx.eventBus.publish('approval.required', {
      sessionId: ctx.sessionId,
      action: toolCall.name,
      payload: toolCall.arguments,
      preview: await generatePreview(toolCall),
    });

    // Session pauses here until approval received
    const approval = await ctx.approvalQueue.waitForApproval(ctx.sessionId);

    if (!approval.approved) {
      return {
        success: false,
        error: 'Action rejected by user',
        feedback: approval.feedback
      };
    }
  }

  // Execute the tool
  return await tool.execute(toolCall.arguments, ctx);
}
```

---

## Approval Events

### approval.required

Emitted when agent needs user approval:

```typescript
{
  sessionId: string;
  action: string;           // Tool name
  payload: unknown;         // Tool arguments
  preview: {
    description: string;    // Human-readable description
    affectedEntities: string[];  // IDs of entities affected
    reversible: boolean;    // Can this be undone?
  };
}
```

### approval.received

Emitted when user responds:

```typescript
{
  sessionId: string;
  action: string;
  approved: boolean;
  feedback?: string;  // User's reason for rejection
}
```

---

## Preview Generation

Generate human-readable preview for approval UI:

```typescript
async function generatePreview(toolCall: ToolCall): Promise<ApprovalPreview> {
  switch (toolCall.name) {
    case 'cms_deletePage':
      const page = await cmsService.getPage(toolCall.arguments.pageId);
      return {
        description: `Delete page "${page.title}" (${page.slug})`,
        affectedEntities: [page.id],
        reversible: false,
      };

    case 'cms_deleteSection':
      const section = await cmsService.getSection(toolCall.arguments.sectionId);
      return {
        description: `Delete section from page`,
        affectedEntities: [section.id],
        reversible: false,
      };

    default:
      return {
        description: `Execute ${toolCall.name}`,
        affectedEntities: [],
        reversible: true,
      };
  }
}
```

---

## UI Integration

The approval flow integrates with the chat UI:

```
1. Agent requests delete operation
2. EventBus emits 'approval.required'
3. SSE sends event to client
4. UI shows approval modal with preview
5. User clicks Approve or Reject
6. Client sends POST /api/sessions/:id/approve
7. Backend emits 'approval.received'
8. Session processor resumes or returns error
```

### Approval Modal Content

```
┌─────────────────────────────────────────┐
│  ⚠️  Approval Required                  │
├─────────────────────────────────────────┤
│                                         │
│  The agent wants to:                    │
│                                         │
│  Delete page "Pricing" (/pricing)       │
│                                         │
│  This action cannot be undone.          │
│                                         │
├─────────────────────────────────────────┤
│  [Reject]              [Approve]        │
└─────────────────────────────────────────┘
```

---

## Doom Loop as HITL

Doom loop detection can also trigger HITL:

```typescript
interface AgentConfig {
  doomLoop: 'ask' | 'deny' | 'allow';
}
```

| Mode | Behavior |
|------|----------|
| `ask` | Pause and request HITL guidance |
| `deny` | Block the repeated call, return error |
| `allow` | Allow the call (agent may have valid reason) |

When `doomLoop: 'ask'`:

```typescript
// Doom loop detected
ctx.eventBus.publish('agent.stuck', {
  sessionId: ctx.sessionId,
  lastToolCalls: recentCalls,
  reason: 'Same tool called 3 times with identical parameters',
});

// Wait for user guidance
const guidance = await ctx.approvalQueue.waitForGuidance(ctx.sessionId);
// User can: provide new instructions, skip this step, or abort
```

---

## Batch Operation Approval

For bulk operations, approval covers the entire batch:

```
User: "Delete all draft pages"

Agent decomposes:
1. List draft pages → found 5
2. Request approval for batch delete

Approval modal:
┌─────────────────────────────────────────┐
│  ⚠️  Batch Delete                       │
├─────────────────────────────────────────┤
│                                         │
│  Delete 5 draft pages:                  │
│  - /draft-page-1                        │
│  - /draft-page-2                        │
│  - /draft-page-3                        │
│  - /draft-page-4                        │
│  - /draft-page-5                        │
│                                         │
│  This action cannot be undone.          │
│                                         │
├─────────────────────────────────────────┤
│  [Reject]              [Approve All]    │
└─────────────────────────────────────────┘
```

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Delete always requires approval by default | Destructive, non-reversible |
| Write allowed for builder agents | Building is the primary use case |
| Read always allowed | No risk, no approval needed |
| Doom loop triggers HITL | User guidance better than hard block |
| Preview generation | Users need context to decide |

---

## Related Documents

- → [09-agent-catalog.md](09-agent-catalog.md) - Permission settings per agent
- → [../3-implementation/12-session-processor.md](../3-implementation/12-session-processor.md) - Execution flow
- → [../3-implementation/13-event-bus.md](../3-implementation/13-event-bus.md) - Approval events
