# Cache-Safe Dynamic Injection Architecture Plan

**Status**: Draft
**Created**: 2025-12-12
**Related**: [Context Compaction System Plan](./CONTEXT_COMPACTION_SYSTEM_PLAN.md)

---

## Executive Summary (Read This First When Resuming)

### What We're Building

A **cache-safe injection architecture** that moves all dynamic content (working memory, tool prompts, discovered tools) OUT of the system prompt and INTO conversation history. This preserves LLM provider caching while maintaining our dynamic tool discovery features.

### Why We're Building It

**The Problem We Discovered**: While planning the Context Compaction System, we realized our current architecture has a critical flaw:

```
Current Flow (BREAKS CACHING):
┌─────────────────────────────────────────┐
│ System Prompt (changes every turn)      │ ← Cache key changes
│   - {{{workingMemory}}}                 │ ← Dynamic content
│   - {{{activeProtocols}}}               │ ← Dynamic content
└─────────────────────────────────────────┘
Result: Every request = cache miss = FULL cost
```

**Cost Impact**:
- Without caching: 100% of input tokens charged
- With caching (OpenAI): 50% discount on cached prefix
- With caching (Anthropic): 90% discount on cached prefix
- Our system: Gets ZERO savings because system prompt changes every turn

### The Solution

Keep system prompt **completely static**. Inject dynamic content as **user-assistant message pairs**:

```
New Flow (PRESERVES CACHING):
┌─────────────────────────────────────────┐
│ System Prompt (STATIC - never changes)  │ ← Cache key stable = CACHED
│   - Agent identity, rules, examples     │
│   - Generic tool usage instructions     │
└─────────────────────────────────────────┘
│
│ Messages:
│ ├─ [CONTEXT] user-assistant pair        │ ← Session context
│ ├─ [TOOL GUIDANCE] user-assistant pair  │ ← When tools discovered
│ ├─ ... conversation history ...         │
│ └─ Current user message                 │
└─────────────────────────────────────────┘
Result: System prompt cached = 50-90% savings
```

### Key Files Currently Affected

| File | Current Problem |
|------|-----------------|
| `server/prompts/agent/main-agent-prompt.xml` | Has `{{{workingMemory}}}` placeholder |
| `server/prompts/builder/prompt-builder.ts` | Injects into system prompt |
| `server/agents/main-agent.ts` | `prepareStep()` modifies `instructions` |
| `server/memory/working-context/working-context.ts` | `toContextString()` for system prompt |

### Key Research Sources

1. [Sankalp's Blog: How Prompt Caching Works](https://sankalp.bearblog.dev/how-prompt-caching-works/)
   - "Remove all user-specific or dynamic content from system prompt"
   - "Keep context append-only"

2. [Google ADK: Context-Aware Multi-Agent Framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)
   - Two-zone architecture: stable prefixes + variable suffixes
   - "Frequently reused segments stable at the front"

3. [JetBrains: Efficient Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)
   - Observation masking outperforms summarization
   - Simple approaches often win

### Relationship to Compaction Plan

This plan is **Phase 8** of the [Context Compaction System Plan](./CONTEXT_COMPACTION_SYSTEM_PLAN.md).

During compaction planning, we designed summary injection as user-assistant pairs. Then we realized: "Wait, we're ALREADY breaking caching with working memory and tool prompts!" This plan fixes the root cause.

### Knowledge Base Entry

See: [2.2.5 Prompt Caching & Context Compaction](../knowledge-base/2-context/2.2.5-prompt-caching.md)

---

## Technical Summary

Our current system injects dynamic content (working memory, discovered tools, tool prompts) into the **system prompt**, which destroys LLM provider caching on every change. This plan redesigns the injection architecture to preserve prefix caching while maintaining dynamic tool discovery and working memory features.

**Key Insight**: All major LLM providers use **prefix-based caching**. Changing the system prompt invalidates the entire cache. The solution is to keep the system prompt static and inject dynamic content as **conversation history** instead.

---

## Progress Tracking

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ⬜ Pending | System Prompt Stabilization |
| Phase 2 | ⬜ Pending | Tool Prompt Injection Redesign |
| Phase 3 | ⬜ Pending | Working Memory Injection Redesign |
| Phase 4 | ⬜ Pending | AI SDK Integration |
| Phase 5 | ⬜ Pending | Migration & Testing |

---

## Problem Analysis

### Current Architecture (Cache-Breaking)

```
Request Flow:
┌─────────────────────────────────────────────────────────────────┐
│ System Prompt                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ <agent> identity, rules, examples                           │ │
│ │ <working-memory>                                            │ │
│ │   [WORKING MEMORY]                   ← DYNAMIC (per-turn)   │ │
│ │   Pages: Home (page-123)                                    │ │
│ │   [DISCOVERED TOOLS]                                        │ │
│ │   getPage, updatePage, createSection ← DYNAMIC (per-turn)   │ │
│ │ </working-memory>                                           │ │
│ │ <tool-usage-instructions>                                   │ │
│ │   [Tool prompts for discovered tools] ← DYNAMIC (per-step)  │ │
│ │ </tool-usage-instructions>                                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ Messages: [user, assistant, tool, ...]                          │
└─────────────────────────────────────────────────────────────────┘

Problem: System prompt changes EVERY turn/step
→ Cache invalidated EVERY request
→ No cost savings from caching
→ Actually 25% MORE expensive (Anthropic cache write premium)
```

### Files Involved in Current Implementation

| File | What It Does | Problem |
|------|--------------|---------|
| `server/prompts/agent/main-agent-prompt.xml` | Template with `{{{workingMemory}}}` and `{{{activeProtocols}}}` placeholders | Dynamic content in system prompt |
| `server/prompts/builder/prompt-builder.ts` | Injects content into `<working-memory>` and `<tool-usage-instructions>` tags | Modifies system prompt |
| `server/prompts/builder/injection-points.ts` | Defines injection points in system prompt | All in system prompt |
| `server/memory/working-context/working-context.ts` | `toContextString()` formats working memory for system prompt | Designed for system prompt injection |
| `server/agents/main-agent.ts` | `prepareCall()` and `prepareStep()` modify `instructions` (system prompt) | Changes system prompt per-step |
| `server/agents/system-prompt.ts` | `getSystemPrompt()` builds dynamic system prompt | Dynamic by design |
| `server/execution/context-coordinator.ts` | Passes `workingMemoryString` to agent options | Feeds into system prompt |

---

## Research Findings

### Key Sources

1. [How Prompt Caching Works](https://sankalp.bearblog.dev/how-prompt-caching-works/) - Practical tips for prefix stability
2. [Efficient Context Management for LLM Agents](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) - JetBrains research on observation masking
3. [Architecting Context-Aware Multi-Agent Framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/) - Google ADK patterns
4. [MemTool: Dynamic Tool Calling](https://arxiv.org/html/2507.21428v1) - Short-term memory for tool management
5. [Context Engineering Guide](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - Anthropic best practices

### Core Principles Discovered

1. **System Prompt Must Be Static**
   - Remove ALL user-specific or dynamic content from system prompt
   - Different users can share cached blocks for common prefixes
   - "I ended up removing all the user specific or dynamic content from my system prompt"

2. **Keep Context Append-Only**
   - Avoid truncating or modifying previous messages
   - "In the feature I was building...I decided to stop the truncation as I preferred the cost and latency benefits"

3. **Tool Definitions Before Conversation**
   - "Changing or removing certain tool call definitions will break the entire prefix afterwards"
   - Finalize tools before conversation starts OR use append-only strategies

4. **Optimal Prompt Structure**
   ```
   1. Tool Definitions (if static)
   2. System Prompt (static)
   3. Static Content (documents, images)
   4. User Prompts and Previous Responses
   5. Current User Prompt
   ```

5. **Two-Zone Architecture** (Google ADK)
   - **Stable prefixes**: System instructions remain immutable
   - **Variable suffixes**: Latest user turns and tool outputs at the end

---

## Proposed Architecture

### New Request Flow (Cache-Preserving)

```
Request Flow:
┌─────────────────────────────────────────────────────────────────┐
│ System Prompt (STATIC - never changes)                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ <agent> identity, rules, examples                           │ │
│ │ <tools> Generic instructions for using tools                │ │
│ │   - Use searchTools to discover capabilities                │ │
│ │   - Check [TOOL GUIDANCE] in conversation for specifics     │ │
│ │ </tools>                                                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ [CACHED - reused across all users and sessions]                 │
├─────────────────────────────────────────────────────────────────┤
│ Messages:                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [Session Start Injection - if has prior context]            │ │
│ │ user: "Continue our conversation..."                        │ │
│ │ assistant: "[CONTEXT] Pages: Home, About. Tools: getPage"   │ │
│ │                                                              │ │
│ │ [Conversation History]                                       │ │
│ │ user: "Show me the home page"                               │ │
│ │ assistant: [tool_call: getPage]                             │ │
│ │ tool: [result]                                              │ │
│ │                                                              │ │
│ │ [Tool Guidance Injection - when new tools discovered]       │ │
│ │ user: "[TOOL GUIDANCE] How to use getPage, updatePage..."   │ │
│ │ assistant: "I'll follow these guidelines when using tools." │ │
│ │                                                              │ │
│ │ [Current User Message]                                       │ │
│ │ user: "Update the hero title"                               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ [DYNAMIC - only these change per turn]                          │
└─────────────────────────────────────────────────────────────────┘

Result: System prompt cached, only messages recomputed
→ 50-90% cost savings
→ Lower latency
```

### Injection Points Redesign

| Current | New | When Injected | Format |
|---------|-----|---------------|--------|
| `<working-memory>` in system prompt | User-assistant pair at session start | Once per session (or after compaction) | User asks for context, assistant provides |
| `<tool-usage-instructions>` in system prompt | User-assistant pair when tools discovered | After searchTools returns new tools | User provides guidance, assistant acknowledges |
| Dynamic datetime | User message metadata | Each request | Part of user message content or separate injection |

---

## Phase 1: System Prompt Stabilization

### Objective

Create a completely static system prompt with no injection points.

### 1.1 New Static System Prompt Template

**File**: `server/prompts/agent/main-agent-prompt-static.xml`

```xml
<agent>
  <identity>
    You are an autonomous AI assistant operating on the ReAct pattern.
    You think before acting, act precisely, observe results, and complete thoroughly.
  </identity>

  <reason-and-act>
    1. **THINK** - What does the user need?
    2. **ACT** - One precise tool call with correct parameters
    3. **OBSERVE** - Did this complete the task? Need more actions?
    4. **REPEAT** - Until complete, then call finalAnswer
  </reason-and-act>

  <communication>
    - Generate text AND call tools in the same response
    - Never mention tool names to user
    - Concise follow-ups: answer only what's asked
  </communication>

  <context-awareness>
    Your conversation may include:
    - [CONTEXT] blocks: Session state, recent entities, available tools
    - [TOOL GUIDANCE] blocks: Specific instructions for discovered tools

    Pay attention to these blocks - they contain important context.
  </context-awareness>

  <verification>
    Tool results are facts. Chat history shows past, not present.
    When user questions an outcome: STOP → verify with tool → then respond.
  </verification>

  <rules>
    - **Language:** English by default, or user-specified
    - **References:** "this page" → check conversation for recent entities
    - **Efficiency:** Lightweight fetches by default
    - **Images:** Use searchImages before attaching. Relative `/uploads/...` only.
  </rules>

  <confirmations>
    When tool has `requiresConfirmation: true`:
    1. Call `finalAnswer` explaining what you're about to do
    2. Wait for user approval
    3. After confirmation → call tool with `confirmed: true`
  </confirmations>

  <output-format>
    Response is rendered as markdown in chat UI.

    **Guardrails:**
    - Bullets for 2+ items; no headers for single-item responses
    - Bold for labels, backticks for ids/slugs/fields
    - Skip empty fields, summarize directly
  </output-format>

  <tools>
    Use `searchTools` to discover capabilities not already available.
    Keywords not narrative: "list image hero section update attach"
  </tools>
</agent>
```

**Key Changes**:
- Removed `<working-memory>` section
- Removed `<tool-usage-instructions>` section
- Removed `{{{workingMemory}}}` and `{{{activeProtocols}}}` placeholders
- Added `<context-awareness>` section explaining conversation-based context
- No Handlebars variables - pure static content

### 1.2 Update System Prompt Generator

**File**: `server/agents/system-prompt.ts`

```typescript
import fs from 'node:fs';
import path from 'node:path';

// Cache the static prompt (it never changes)
let cachedStaticPrompt: string | null = null;

/**
 * Get the static agent system prompt (cached)
 *
 * IMPORTANT: This prompt is completely static.
 * Dynamic content (working memory, tool guidance) is injected
 * as conversation history, NOT into the system prompt.
 */
export function getSystemPrompt(): string {
  if (cachedStaticPrompt) {
    return cachedStaticPrompt;
  }

  const promptPath = path.join(__dirname, '../prompts/agent/main-agent-prompt-static.xml');
  cachedStaticPrompt = fs.readFileSync(promptPath, 'utf-8');
  return cachedStaticPrompt;
}

// Legacy interface - throw helpful error
export function getSystemPromptWithContext(context: unknown): never {
  throw new Error(
    '[DEPRECATED] getSystemPromptWithContext is deprecated. ' +
    'Dynamic context should be injected as conversation history, not system prompt. ' +
    'See CACHE_SAFE_DYNAMIC_INJECTION_PLAN.md'
  );
}
```

### 1.3 Files to Delete/Deprecate

| File | Action |
|------|--------|
| `server/prompts/builder/prompt-builder.ts` | Deprecate (keep for reference) |
| `server/prompts/builder/injection-points.ts` | Deprecate |
| `server/prompts/builder/tool-prompt-injector.ts` | Modify to support conversation injection |

---

## Phase 2: Tool Prompt Injection Redesign

### Objective

Inject tool guidance as user-assistant message pairs in conversation, not system prompt.

### 2.1 Tool Guidance Message Factory

**File**: `server/prompts/messages/tool-guidance-messages.ts`

```typescript
import type { ModelMessage } from 'ai';
import { ToolPromptInjector } from '../builder/tool-prompt-injector';

/**
 * Create tool guidance messages for injection into conversation
 *
 * Returns a user-assistant pair that teaches the agent about newly discovered tools.
 * This preserves the static system prompt while providing tool-specific guidance.
 */
export function createToolGuidanceMessages(
  newTools: string[],
  existingTools: string[]
): ModelMessage[] {
  if (newTools.length === 0) {
    return [];
  }

  // Get prompts only for NEW tools (not already known)
  const injector = new ToolPromptInjector();
  injector.addTools(newTools);
  const toolGuidance = injector.build();

  if (!toolGuidance.trim()) {
    return [];
  }

  const toolList = newTools.join(', ');

  return [
    {
      role: 'user',
      content: `[TOOL GUIDANCE] The following tools are now available: ${toolList}

Here are the usage guidelines:

${toolGuidance}

Please acknowledge and follow these guidelines when using these tools.`,
    },
    {
      role: 'assistant',
      content: `I understand. I now have access to: ${toolList}. I'll follow the provided guidelines when using these tools.`,
    },
  ];
}

/**
 * Create a compact tool reminder (for subsequent steps)
 * Lightweight - just lists available tools without full guidance
 */
export function createToolReminderMessage(
  availableTools: string[]
): ModelMessage {
  return {
    role: 'user',
    content: `[AVAILABLE TOOLS] ${availableTools.join(', ')}`,
  };
}
```

### 2.2 Update Main Agent prepareStep

**File**: `server/agents/main-agent.ts` (modification)

```typescript
prepareStep: async ({ stepNumber, steps, messages }) => {
  type ToolName = keyof typeof ALL_TOOLS;

  // Extract tools from current execution steps
  const fromCurrentSteps = toolSearchManager.extractFromSteps(steps);

  // Combine: persisted tools + current step discoveries
  const allTools = [...new Set([...persistedDiscoveredTools, ...fromCurrentSteps])] as ToolName[];

  // Find NEW tools (discovered in this step, not seen before)
  const previouslyKnown = new Set([...persistedDiscoveredTools, ...CORE_TOOLS]);
  const newlyDiscovered = fromCurrentSteps.filter(t => !previouslyKnown.has(t));

  // If new tools discovered, inject guidance into messages
  let updatedMessages = messages;
  if (newlyDiscovered.length > 0 && stepNumber > 0) {
    const guidanceMessages = createToolGuidanceMessages(newlyDiscovered, allTools);
    // Insert guidance BEFORE the last user message
    const insertIndex = messages.length - 1; // Before current turn
    updatedMessages = [
      ...messages.slice(0, insertIndex),
      ...guidanceMessages,
      ...messages.slice(insertIndex),
    ];

    console.log(`[prepareStep] Injected guidance for: ${newlyDiscovered.join(', ')}`);
  }

  // Active tools for this step
  const activeTools = [...new Set([...CORE_TOOLS, ...allTools])] as ToolName[];

  return {
    activeTools,
    toolChoice: stepNumber === 0 ? { type: 'tool', toolName: 'acknowledgeRequest' } : 'auto',
    messages: updatedMessages,
    // NO instructions override - use static system prompt
  };
},
```

**Key Change**: Instead of modifying `instructions` (system prompt), we modify `messages` (conversation history).

---

## Phase 3: Working Memory Injection Redesign

### Objective

Inject working memory as a conversation turn at session start, not in system prompt.

### 3.1 Context Messages Factory

**File**: `server/prompts/messages/context-messages.ts`

```typescript
import type { ModelMessage } from 'ai';
import type { WorkingContext } from '../../memory/working-context';

/**
 * Create context restoration messages for session continuation
 *
 * Injected at the START of messages when resuming a session.
 * Provides the agent with previous session context.
 */
export function createContextRestorationMessages(
  workingContext: WorkingContext
): ModelMessage[] {
  const entities = workingContext.getAll();
  const discoveredTools = workingContext.getDiscoveredTools();

  // Skip if no context to restore
  if (entities.length === 0 && discoveredTools.length === 0) {
    return [];
  }

  const contextParts: string[] = [];

  // Entities section
  if (entities.length > 0) {
    contextParts.push('[RECENT ENTITIES]');
    const grouped: Record<string, typeof entities> = {};
    for (const entity of entities) {
      (grouped[entity.type] ??= []).push(entity);
    }
    for (const [type, items] of Object.entries(grouped)) {
      contextParts.push(`${type}s:`);
      for (const item of items.slice(0, 5)) {
        contextParts.push(`  - "${item.name}" (${item.id})`);
      }
    }
  }

  // Discovered tools section
  if (discoveredTools.length > 0) {
    contextParts.push('');
    contextParts.push('[AVAILABLE TOOLS]');
    contextParts.push(discoveredTools.join(', '));
  }

  const contextString = contextParts.join('\n');

  return [
    {
      role: 'user',
      content: `[CONTEXT] Continuing our conversation. Here's the current session state:

${contextString}

Please keep this context in mind as we continue.`,
    },
    {
      role: 'assistant',
      content: `I understand the current context. I'm ready to continue where we left off.`,
    },
  ];
}

/**
 * Create a lightweight context update (entity added during conversation)
 */
export function createContextUpdateMessage(
  entityType: string,
  entityName: string,
  entityId: string
): ModelMessage {
  return {
    role: 'user',
    content: `[CONTEXT UPDATE] New ${entityType}: "${entityName}" (${entityId})`,
  };
}
```

### 3.2 Update Context Coordinator

**File**: `server/execution/context-coordinator.ts` (modification)

```typescript
async prepareContext(
  options: ResolvedExecuteOptions,
  logger: AgentLogger
): Promise<{ context: PreparedContext; workingContext: WorkingContext }> {
  // Ensure session exists
  await this.deps.sessionService.ensureSession(options.sessionId);

  // Load working context
  const workingContext = await this.deps.sessionService.loadWorkingContext(options.sessionId);

  // Load previous messages
  const previousMessages = await this.loadPreviousMessages(options.sessionId, logger);

  // Build messages array
  let messages: ModelMessage[] = [];

  // Session has prior context but no message history (new session with restored context)
  // OR first message in a resumed session
  if (previousMessages.length === 0 && workingContext.size() > 0) {
    // Inject context restoration messages at the start
    const contextMessages = createContextRestorationMessages(workingContext);
    messages.push(...contextMessages);
  }

  // Add previous conversation history
  messages.push(...previousMessages);

  // Add current user prompt
  messages.push({ role: 'user', content: options.prompt });

  // Trim context if needed (using new trimmer that respects context messages)
  const trimResult = this.contextManager.trimContext(messages, workingContext);

  return {
    context: {
      messages: trimResult.messages,
      // NO workingMemoryString - not used anymore
      discoveredTools: workingContext.getDiscoveredTools(),
      previousMessages,
      trimInfo: { /* ... */ },
    },
    workingContext,
  };
}
```

### 3.3 Update WorkingContext Class

**File**: `server/memory/working-context/working-context.ts` (modification)

```typescript
/**
 * DEPRECATED: Use createContextRestorationMessages() instead.
 * System prompt injection breaks LLM caching.
 */
toContextString(): string {
  console.warn(
    '[WorkingContext.toContextString] DEPRECATED - ' +
    'Use createContextRestorationMessages() for cache-safe injection'
  );
  return this.computeContextString();
}

/**
 * Get structured context for message injection
 */
getContextData(): {
  entities: Entity[];
  discoveredTools: string[];
  usedTools: ToolUsageRecord[];
} {
  return {
    entities: this.getAll(),
    discoveredTools: Array.from(this.discoveredTools),
    usedTools: Array.from(this.usedTools.values()),
  };
}
```

---

## Phase 4: AI SDK Integration

### Objective

Ensure the new architecture works with AI SDK v6's ToolLoopAgent pattern.

### 4.1 Main Agent Configuration Update

**File**: `server/agents/main-agent.ts` (full rewrite of key sections)

```typescript
export const cmsAgent = new ToolLoopAgent({
  model: openrouter.languageModel(AGENT_CONFIG.modelId),

  // STATIC instructions - never changes
  instructions: getSystemPrompt(),

  tools: ALL_TOOLS,

  callOptionsSchema: AgentCallOptionsSchema,

  prepareCall: ({ options, ...settings }) => {
    // Store discovered tools from previous turns
    persistedDiscoveredTools = options.discoveredTools || [];

    // Dynamic model selection
    const model = options.modelId
      ? openrouter.languageModel(options.modelId)
      : openrouter.languageModel(AGENT_CONFIG.modelId);

    return {
      ...settings,
      model,
      // NO instructions override - use static from constructor
      maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
      activeTools: [...CORE_TOOLS] as (keyof typeof ALL_TOOLS)[],
      experimental_context: {
        db: options.db,
        services: options.services,
        vectorIndex: options.vectorIndex,
        logger: options.logger,
        stream: options.stream,
        traceId: options.traceId,
        sessionId: options.sessionId,
        cmsTarget: options.cmsTarget,
      } as AgentContext,
    };
  },

  stopWhen: [stepCountIs(AGENT_CONFIG.maxSteps), hasToolCall('finalAnswer')],

  prepareStep: async ({ stepNumber, steps, messages }) => {
    // ... (as shown in Phase 2.2)
  },

  onStepFinish: async () => {},

  experimental_repairToolCall: async ({ toolCall, error }) => {
    // ... (unchanged)
  },
});
```

### 4.2 Anthropic Cache Control

For Anthropic models, add cache_control markers:

**File**: `server/agents/anthropic-adapter.ts` (new)

```typescript
import type { ModelMessage } from 'ai';

/**
 * Add Anthropic cache_control to messages for optimal caching
 */
export function addAnthropicCacheControl(
  messages: ModelMessage[],
  providerId: string
): ModelMessage[] {
  if (!providerId.includes('anthropic')) {
    return messages;
  }

  // First message (usually context restoration) gets cache breakpoint
  if (messages.length > 0 && messages[0].role === 'user') {
    return [
      {
        ...messages[0],
        providerMetadata: {
          anthropic: {
            cacheControl: { type: 'ephemeral' }
          }
        }
      },
      ...messages.slice(1)
    ];
  }

  return messages;
}
```

---

## Phase 5: Migration & Testing

### 5.1 Migration Checklist

- [ ] Create `main-agent-prompt-static.xml`
- [ ] Update `getSystemPrompt()` to be static
- [ ] Create `tool-guidance-messages.ts`
- [ ] Create `context-messages.ts`
- [ ] Update `main-agent.ts` prepareCall/prepareStep
- [ ] Update `context-coordinator.ts`
- [ ] Add deprecation warnings to old injection code
- [ ] Update tests
- [ ] Run full integration test

### 5.2 Testing Strategy

1. **Unit Tests**
   - Context message factory produces valid messages
   - Tool guidance messages contain correct tools
   - Empty context produces no messages

2. **Integration Tests**
   - Multi-turn conversation maintains context
   - Tool discovery triggers guidance injection
   - Session resumption restores context correctly

3. **Cache Validation**
   - Verify system prompt hash is identical across requests
   - Monitor cache hit rates via provider logs
   - Measure cost reduction vs baseline

### 5.3 Rollback Plan

Keep old injection code (deprecated) for 1 sprint. If issues arise:
1. Re-enable `prompt-builder.ts`
2. Switch back to dynamic system prompt
3. Analyze failure cases

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| AI SDK doesn't support message modification in prepareStep | High | Verify with AI SDK docs; fallback to prepareCall |
| Context messages confuse the LLM | Medium | Clear formatting with [BRACKETS]; test with real tasks |
| Tool guidance injection happens too late | Low | Inject immediately after searchTools returns |
| Existing sessions break | Medium | Clear sessions on migration (prototype stage) |
| Performance regression | Low | Benchmark before/after |

---

## Files Summary

### New Files

| File | Description |
|------|-------------|
| `server/prompts/agent/main-agent-prompt-static.xml` | Static system prompt (no injection points) |
| `server/prompts/messages/context-messages.ts` | Context restoration message factory |
| `server/prompts/messages/tool-guidance-messages.ts` | Tool guidance message factory |
| `server/agents/anthropic-adapter.ts` | Anthropic cache_control helper |

### Modified Files

| File | Changes |
|------|---------|
| `server/agents/system-prompt.ts` | Return static prompt, deprecate dynamic version |
| `server/agents/main-agent.ts` | Remove instructions override, inject via messages |
| `server/execution/context-coordinator.ts` | Use message injection, remove workingMemoryString |
| `server/memory/working-context/working-context.ts` | Deprecate toContextString() |

### Deprecated Files

| File | Reason |
|------|--------|
| `server/prompts/builder/prompt-builder.ts` | System prompt injection deprecated |
| `server/prompts/builder/injection-points.ts` | No more injection points |

---

## Research Sources

- [How Prompt Caching Works](https://sankalp.bearblog.dev/how-prompt-caching-works/)
- [Efficient Context Management for LLM Agents (JetBrains)](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)
- [Architecting Context-Aware Multi-Agent Framework (Google ADK)](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)
- [MemTool: Dynamic Tool Calling](https://arxiv.org/html/2507.21428v1)
- [LLM Inference Handbook - Prefix Caching](https://bentoml.com/llm/inference-optimization/prefix-caching)
- [Optimizing LLM Costs with Context Caching](https://phase2online.com/2025/04/28/optimizing-llm-costs-with-context-caching/)
- [Our Knowledge Base: 2.2.5 Prompt Caching](../knowledge-base/2-context/2.2.5-prompt-caching.md)

---

## Next Steps

After this plan is approved:
1. Begin Phase 1 (System Prompt Stabilization)
2. Test with single-turn requests first
3. Expand to multi-turn after validation
4. Monitor cache hit rates
