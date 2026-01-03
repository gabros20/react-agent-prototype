# Layer 3.4: Prompt System

> Static system prompt with cache-safe message-based injection

## Overview

The prompt system uses a **completely static system prompt** to preserve LLM caching, with all dynamic content injected as **conversation messages**. This architecture achieves 50-90% cost reduction through LLM prefix caching.

**Key Innovation**: System prompt never changes during execution. Dynamic content (working memory, tool guidance) is injected as user-assistant message pairs.

**Key Files:**

-   `server/agents/system-prompt.ts` - Static prompt loader
-   `server/prompts/agent/main-agent-prompt.xml` - Static system prompt
-   `server/prompts/messages/tool-guidance-messages.ts` - Tool guidance message factory
-   `server/prompts/tools/` - Per-tool prompt files
-   `server/prompts/_builder/tool-prompt-injector.ts` - Prompt building

---

## The Problem

### Old Approach (Dynamic System Prompt)

```typescript
// PROBLEM: System prompt changes every step
getSystemPrompt({
  workingMemory: "pages:\n  - About (page-123)",
  activeProtocols: "createPage: ...\nupdatePage: ...",
});
```

Every change to working memory or discovered tools invalidates the LLM cache:
- OpenAI charges full price for new prefixes
- Anthropic charges full price for uncached content
- **Cost: $$$**

### New Approach (Static System Prompt + Message Injection)

```typescript
// SOLUTION: System prompt never changes
getStaticSystemPrompt(); // Same every time

// Dynamic content as messages
[
  { role: "user", content: "[WORKING MEMORY]\n..." },
  { role: "assistant", content: "I understand..." },
  { role: "user", content: "[TOOL GUIDANCE]\n..." },
  { role: "assistant", content: "I now have access to..." },
]
```

System prompt stays constant → LLM cache hit → **50-90% cost reduction**

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                 Cache-Safe Prompt Architecture                     │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │               STATIC System Prompt                          │  │
│  │                                                             │  │
│  │   main-agent-prompt.xml (never changes)                     │  │
│  │   - Agent identity                                          │  │
│  │   - ReAct pattern                                           │  │
│  │   - Core behaviors                                          │  │
│  │   - NO dynamic injection points                             │  │
│  │                                                             │  │
│  │   Loaded once at startup, cached                            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              ║                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │           DYNAMIC Content (as Messages)                     │  │
│  │                                                             │  │
│  │  Working Memory Message:                                    │  │
│  │  ┌─────────────────────────────────────────────────────┐    │  │
│  │  │ [USER] [WORKING MEMORY]                             │    │  │
│  │  │ pages:                                              │    │  │
│  │  │   - "About Us" (page-123)                           │    │  │
│  │  ├─────────────────────────────────────────────────────┤    │  │
│  │  │ [ASSISTANT] I understand. I'll use these entities.  │    │  │
│  │  └─────────────────────────────────────────────────────┘    │  │
│  │                                                             │  │
│  │  Tool Guidance Messages:                                    │  │
│  │  ┌─────────────────────────────────────────────────────┐    │  │
│  │  │ [USER] [TOOL GUIDANCE] New tools: createPage, ...   │    │  │
│  │  │ <usage guidelines>                                  │    │  │
│  │  ├─────────────────────────────────────────────────────┤    │  │
│  │  │ [ASSISTANT] I now have access to: createPage, ...   │    │  │
│  │  └─────────────────────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│   LLM Request Structure:                                          │
│   ┌─────────────────────────────────────────────────────────────┐ │
│   │ System: [STATIC - always cached]                            │ │
│   │ Messages: [History] + [Working Memory] + [Tool Guidance]    │ │
│   └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

---

## Static System Prompt

### Loader

```typescript
// server/agents/system-prompt.ts
let cachedSystemPrompt: string | null = null;

export function getStaticSystemPrompt(): string {
  if (!cachedSystemPrompt) {
    const promptPath = path.join(PROMPTS_DIR, 'agent', 'main-agent-prompt.xml');
    cachedSystemPrompt = fs.readFileSync(promptPath, 'utf-8');
  }
  return cachedSystemPrompt;
}
```

### Content

```xml
<!-- server/prompts/agent/main-agent-prompt.xml -->
<agent>
  <identity>
    You are a CMS Assistant that helps users manage website content.
    You use the ReAct pattern: THINK → ACT → OBSERVE → REPEAT.
  </identity>

  <react-pattern>
    1. THINK: Analyze what needs to be done
    2. ACT: Call a tool (or searchTools to discover tools)
    3. OBSERVE: Check the result
    4. REPEAT: Continue until task complete
    5. COMPLETE: Call finalAnswer with your response
  </react-pattern>

  <tool-discovery>
    You start with three core tools:
    - searchTools: Find tools by describing what you need
    - finalAnswer: Complete the task with a response
    - acknowledgeRequest: Acknowledge user's request (Step 0)

    Use searchTools to discover capabilities:
    - "create page tools" → discovers createPage, getPage
    - "image management" → discovers browseImages, importImage
  </tool-discovery>

  <core-behaviors>
    - Confirm destructive actions before executing
    - Use entity IDs from working memory for references
    - Always call finalAnswer when done
    - Search for tools before claiming you can't do something
  </core-behaviors>
</agent>
```

**Important**: No `{{{workingMemory}}}` or `{{{activeProtocols}}}` placeholders. Content is truly static.

---

## Message-Based Injection

### Tool Guidance Messages

```typescript
// server/prompts/messages/tool-guidance-messages.ts
import type { ModelMessage } from 'ai';
import { ToolPromptInjector } from '../_builder/tool-prompt-injector';

export function createToolGuidanceMessages(
  newTools: string[],
  existingTools: string[]
): ModelMessage[] {
  if (newTools.length === 0) return [];

  // Load per-tool prompts
  const injector = new ToolPromptInjector();
  injector.addTools(newTools);
  const toolGuidance = injector.build();

  const allKnownTools = [...new Set([...existingTools, ...newTools])];

  return [
    {
      role: 'user',
      content: `[TOOL GUIDANCE] New tools now available: ${newTools.join(', ')}

Here are the usage guidelines:

${toolGuidance}

You now have access to: ${allKnownTools.join(', ')}.
Please follow these guidelines when using these tools.`,
    },
    {
      role: 'assistant',
      content: `I understand. I now have access to: ${newTools.join(', ')}. I'll follow the provided guidelines when using these tools.`,
    },
  ];
}
```

### Working Memory Messages

```typescript
// In context-coordinator.ts
function createWorkingMemoryMessages(
  contextString: string
): ModelMessage[] {
  if (!contextString || contextString === 'No entities tracked yet.') {
    return [];
  }

  return [
    {
      role: 'user',
      content: `[WORKING MEMORY]
${contextString}

When I refer to "this page", "that image", etc., use the entities above.`,
    },
    {
      role: 'assistant',
      content: `I understand. I'll reference these entities when you use pronouns or descriptions.`,
    },
  ];
}
```

---

## Per-Tool Prompt Files

### Directory Structure

```
server/prompts/tools/
├── createSection-prompt.xml
├── createPost-prompt.xml
├── updateSection-prompt.xml
├── deletePost-prompt.xml
├── importImage-prompt.xml
├── searchTools-prompt.xml
└── finalAnswer-prompt.xml
```

### Example Tool Prompt

```xml
<!-- server/prompts/tools/createSection-prompt.xml -->
<tool-prompt name="createSection">
  <clarification>
    - "add another section" = CREATE new section
    - "change the heading" = UPDATE existing section
    - "move the section up" = UPDATE section order
  </clarification>

  <best-practices>
    - Always specify section template (hero, feature, cta, etc.)
    - Provide content matching template schema
    - Position defaults to end of page
  </best-practices>

  <workflow>
    BEFORE: Get page ID if not in working memory
    AFTER: Confirm section was added, ask about content
  </workflow>
</tool-prompt>
```

### Tool Prompt Injector

```typescript
// server/prompts/_builder/tool-prompt-injector.ts
export class ToolPromptInjector {
  private tools: string[] = [];

  addTools(tools: string[]): void {
    this.tools.push(...tools);
  }

  build(): string {
    const prompts: string[] = [];

    for (const tool of this.tools) {
      const promptPath = path.join(PROMPTS_DIR, 'tools', `${tool}-prompt.xml`);
      if (fs.existsSync(promptPath)) {
        prompts.push(fs.readFileSync(promptPath, 'utf-8'));
      }
    }

    if (prompts.length === 0) {
      return '';
    }

    return prompts.join('\n\n');
  }
}
```

---

## Integration with prepareStep

```typescript
// server/agents/main-agent.ts
prepareStep: async ({ stepNumber, steps, messages }) => {
  // Extract newly discovered tools
  const fromCurrentSteps = toolSearchManager.extractFromSteps(steps);
  const newlyDiscovered = fromCurrentSteps.filter(
    tool => !toolsWithGuidanceInjected.has(tool)
  );

  let updatedMessages = [...messages];

  // Inject guidance as MESSAGES (not instructions)
  if (newlyDiscovered.length > 0 && stepNumber > 0) {
    const guidanceMessages = createToolGuidanceMessages(
      newlyDiscovered,
      [...toolsWithGuidanceInjected]
    );
    updatedMessages = [...updatedMessages, ...guidanceMessages];

    // Track which tools have guidance
    newlyDiscovered.forEach(tool => toolsWithGuidanceInjected.add(tool));

    // Emit SSE event for debugging
    if (onInstructionsInjectedCallback) {
      onInstructionsInjectedCallback({
        tools: newlyDiscovered,
        instructions: guidanceMessages.map(m => m.content).join('\n'),
        stepNumber,
      });
    }
  }

  // Return updated messages (system prompt unchanged)
  return {
    activeTools: [...CORE_TOOLS, ...discoveredTools],
    messages: updatedMessages,
    // NO instructions override - keeps system prompt static
  };
},
```

---

## Why This Architecture Works

### LLM Caching Mechanics

All major LLM providers cache request prefixes:

```
Request 1: [System Prompt] + [Message A] + [Message B]
                ↑
         Cached after first request

Request 2: [System Prompt] + [Message A] + [Message C]
                ↑              ↑
         Cache hit        Cache hit (same prefix)

Request 3: [Modified System Prompt] + [Message A]
                ↑
         Cache miss (different prefix)
```

### Cost Savings

| Provider   | Cache Discount | Old Cost | New Cost |
| ---------- | -------------- | -------- | -------- |
| OpenAI     | 50%            | $1.00    | $0.50    |
| Anthropic  | 90%            | $1.00    | $0.10    |

With typical 5-step agent runs, savings multiply significantly.

---

## SSE Event for Debugging

When tool guidance is injected, an event is emitted:

```typescript
// Emitted during prepareStep
emitter.emitInstructionsInjected(
  newTools,      // ['createPage', 'updatePage']
  instructions,  // Combined prompt content
  stepNumber     // 2
);
```

Frontend can display this in the debug panel:

```
Step 2: Tool guidance injected
  Tools: createPage, updatePage
  Instructions: 245 chars
```

---

## Migration Notes

### Old Architecture (Pre-Migration)

```typescript
// OLD: Dynamic injection in system prompt
const dynamicInstructions = getSystemPrompt({
  currentDate: new Date().toISOString(),
  workingMemory: context.workingMemory || '',
});

return {
  instructions: dynamicInstructions, // Changes every call
  ...
};
```

### New Architecture

```typescript
// NEW: Static system prompt + message injection
return {
  instructions: getStaticSystemPrompt(), // Never changes
  ...
};

// Dynamic content in prepareStep
prepareStep: ({ messages }) => {
  const guidanceMessages = createToolGuidanceMessages(newTools, existing);
  return { messages: [...messages, ...guidanceMessages] };
};
```

---

## Token Budget

| Component                   | Tokens (approx) |
| --------------------------- | --------------- |
| Static system prompt        | ~600            |
| Working memory (10 entities)| ~150            |
| Tool guidance (5 tools)     | ~400            |
| **Total**                   | **~1150**       |

Much smaller than old architecture (~2400 tokens) because:
- No redundant injection points
- Guidance only for discovered tools
- Minimal static prompt

---

## Design Decisions

### Why No Handlebars?

Old architecture used Handlebars for template compilation:

```typescript
// OLD
Handlebars.compile(template)({
  workingMemory: '...',
  activeProtocols: '...',
});
```

New architecture doesn't need it:
- System prompt is static (no variables)
- Dynamic content is simple string concatenation in messages
- Reduces dependencies and complexity

### Why User-Assistant Pairs?

```typescript
// Why not just user messages?
[
  { role: 'user', content: '[TOOL GUIDANCE] ...' },
  { role: 'assistant', content: 'I understand...' }, // Important!
]
```

The assistant acknowledgment:
1. Creates natural conversation flow
2. Confirms context was received
3. Some LLMs perform better with acknowledgments
4. Matches expected chat turn-taking

### Why Per-Tool Prompt Files?

| Alternative                  | Issue                              |
| ---------------------------- | ---------------------------------- |
| All prompts in system prompt | Massive, wastes tokens             |
| Prompts in tool metadata     | Mixes concerns, clutters metadata  |
| Prompts in code              | Hard to edit, review               |
| **Separate XML files**       | Clean, editable, version-controlled|

---

## Adding Tool Prompts

### 1. Create Prompt File

```xml
<!-- server/prompts/tools/myNewTool-prompt.xml -->
<tool-prompt name="myNewTool">
  <usage>When to use this tool</usage>
  <parameters>
    - param1: Description
    - param2: Description
  </parameters>
  <gotchas>
    - Important edge case
    - Common mistake to avoid
  </gotchas>
</tool-prompt>
```

### 2. Done

The `ToolPromptInjector` automatically finds and loads it when the tool is discovered.

---

## Integration Points

| Connects To                                         | How                                |
| --------------------------------------------------- | ---------------------------------- |
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md)         | prepareStep injects messages       |
| [3.2 Tools](./LAYER_3.2_TOOLS.md)                   | Tool prompts loaded for discovered |
| [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) | Context injected as message        |
| SSE Events                                          | Injection events for debugging     |

---

## Debugging

### View Injected Prompts

```typescript
// In main-agent.ts prepareStep
console.log('New tools:', newlyDiscovered);
console.log('Guidance content:', toolGuidance);
console.log('Updated messages count:', updatedMessages.length);
```

### Check SSE Events

Frontend debug panel shows:
- `instructions-injected` events
- Tools that triggered injection
- Instruction content length

### Verify Static Prompt

```typescript
// Should always return exact same string
console.log(getStaticSystemPrompt() === getStaticSystemPrompt()); // true
```

---

## Further Reading

-   [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - prepareStep integration
-   [3.2 Tools](./LAYER_3.2_TOOLS.md) - Per-tool folder structure
-   [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) - Entity context
-   [3.7 Streaming](./LAYER_3.7_STREAMING.md) - SSE events
