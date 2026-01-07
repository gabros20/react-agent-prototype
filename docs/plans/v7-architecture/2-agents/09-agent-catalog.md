# Agent Catalog

> **Summary**: V7 has 7 agent configurations: 1 router, 1 orchestrator, and 5 specialists. Each is defined by AgentConfig with type, tools, permissions, and behavior settings.
>
> **Prerequisites**: [00-overview.md](../00-overview.md), [08-agent-model.md](08-agent-model.md)

## Overview

| ID | Type | Model | Purpose |
|----|------|-------|---------|
| `router` | router | gpt-4o-mini | Classify intent + complexity, route |
| `orchestrator` | orchestrator | gpt-4o | Decompose, spawn, track, synthesize |
| `page_specialist` | specialist | gpt-4o | Create/edit pages and sections |
| `post_specialist` | specialist | gpt-4o | Create/edit blog posts |
| `research_specialist` | specialist | gpt-4o | Web research, information gathering |
| `image_specialist` | specialist | gpt-4o | Image search, upload, management |
| `qa_specialist` | specialist | gpt-4o-mini | Answer questions about CMS content |

---

## Router Agent

```typescript
const routerAgent: AgentConfig = {
  id: 'router',
  name: 'Intent Router',
  description: 'Classifies requests and routes to appropriate handlers',
  type: 'router',

  model: {
    default: 'gpt-4o-mini',
    temperature: 0,  // Deterministic routing
  },

  prompt: { file: 'prompts/router.prompt.md' },

  routing: {
    intents: [
      'page_building',
      'post_writing',
      'image_management',
      'cms_query',
      'web_research',
      'general_qa',
    ],
    complexityRules: {
      escalateToOrchestrator: [
        'multi_entity',         // "Create 3 landing pages"
        'research_then_action', // "Research competitors then create page"
        'multi_step_workflow',  // "Find images, create page, write post"
        'explicit_thorough',    // User asks for "comprehensive" or "thorough"
      ],
    },
    simpleRoutes: {
      page_building: 'page_specialist',
      post_writing: 'post_specialist',
      image_management: 'image_specialist',
      cms_query: 'qa_specialist',
      web_research: 'research_specialist',
      general_qa: 'qa_specialist',
    },
    complexRoute: 'orchestrator',
  },

  permission: { write: 'deny', delete: 'deny' },

  memory: {
    compactionEnabled: false,
    todoEnabled: false,
  },
};
```

**Behavior**:
- No tools (classification only)
- Zero temperature for deterministic routing
- Routes based on intent + complexity

---

## Orchestrator Agent

```typescript
const orchestratorAgent: AgentConfig = {
  id: 'orchestrator',
  name: 'Task Orchestrator',
  description: 'Coordinates complex multi-step tasks',
  type: 'orchestrator',

  model: {
    default: 'gpt-4o',
    temperature: 0.3,
  },

  prompt: { file: 'prompts/orchestrator.prompt.md' },

  orchestration: {
    decomposition: {
      enabled: true,
      maxSubtasks: 10,  // Safety limit
    },
    availableSpecialists: [
      'page_specialist',
      'post_specialist',
      'research_specialist',
      'image_specialist',
      'qa_specialist',
    ],
    spawning: {
      maxConcurrent: 5,
    },
    contextModes: {
      independent: 'fresh',      // Wide research: clean slate per item
      dependent: 'selective',    // Workflows: pass relevant context
    },
    todoTracking: true,
    synthesis: {
      enabled: true,
    },
  },

  permission: { write: 'allow', delete: 'ask' },

  memory: {
    compactionEnabled: true,
    todoEnabled: true,
    preserveErrorsInContext: true,  // Manus pattern: keep errors visible
  },
};
```

**Behavior**:
- Decomposes complex requests into subtasks
- Spawns specialists (internal, not via tool)
- Tracks progress via todo list
- Synthesizes results

---

## Page Specialist

```typescript
const pageSpecialist: AgentConfig = {
  id: 'page_specialist',
  name: 'Page Specialist',
  description: 'Creates and edits pages and sections',
  type: 'specialist',

  model: {
    default: 'gpt-4o',
    temperature: 0.3,
  },

  prompt: { file: 'prompts/page-specialist.prompt.md' },

  specialist: {
    domain: 'page_building',
    tools: [
      'cms_createPage',
      'cms_getPage',
      'cms_updatePage',
      'cms_listPages',
      'cms_deletePage',
      'cms_addSection',
      'cms_updateSection',
      'cms_deleteSection',
      'cms_reorderSections',
      'cms_listTemplates',
      'image_search',  // Can search for images directly
    ],
    maxSteps: 15,
    canSpawn: false,  // Enforced
  },

  loop: {
    maxSteps: 15,
    stopConditions: [
      { onToolCall: 'page_complete' },
      { onTextContains: '[PAGE_READY]' },
    ],
    stepBehavior: {
      restrictToolsAfterStep: {
        step: 12,
        tools: ['page_complete', 'cms_preview'],
      },
    },
  },

  streaming: {
    smoothStream: true,
    delayMs: 20,
  },

  permission: { write: 'allow', delete: 'ask' },
  doomLoop: 'ask',

  memory: {
    compactionEnabled: true,
    todoEnabled: true,
  },
};
```

---

## Post Specialist

```typescript
const postSpecialist: AgentConfig = {
  id: 'post_specialist',
  name: 'Post Specialist',
  description: 'Creates and edits blog posts',
  type: 'specialist',

  model: {
    default: 'gpt-4o',
    temperature: 0.7,  // More creative for writing
  },

  prompt: { file: 'prompts/post-specialist.prompt.md' },

  specialist: {
    domain: 'post_writing',
    tools: [
      'cms_createPost',
      'cms_getPost',
      'cms_updatePost',
      'cms_listPosts',
      'cms_deletePost',
      'cms_publishPost',
      'image_search',
    ],
    maxSteps: 12,
    canSpawn: false,
  },

  permission: { write: 'allow', delete: 'ask' },

  memory: {
    compactionEnabled: true,
    todoEnabled: true,
  },
};
```

---

## Research Specialist

```typescript
const researchSpecialist: AgentConfig = {
  id: 'research_specialist',
  name: 'Research Specialist',
  description: 'Researches topics from web and internal sources',
  type: 'specialist',

  model: {
    default: 'gpt-4o',
    temperature: 0.5,
  },

  prompt: { file: 'prompts/research-specialist.prompt.md' },

  specialist: {
    domain: 'web_research',
    tools: [
      'web_search',
      'web_fetch',
      'vector_search',
    ],
    maxSteps: 10,
    canSpawn: false,
  },

  permission: { write: 'deny', delete: 'deny' },

  memory: {
    compactionEnabled: true,
    todoEnabled: false,
  },
};
```

---

## Image Specialist

```typescript
const imageSpecialist: AgentConfig = {
  id: 'image_specialist',
  name: 'Image Specialist',
  description: 'Manages images - search, upload, organize',
  type: 'specialist',

  model: {
    default: 'gpt-4o',
    temperature: 0.3,
  },

  prompt: { file: 'prompts/image-specialist.prompt.md' },

  specialist: {
    domain: 'image_management',
    tools: [
      'image_search',
      'image_upload',
      'image_list',
      'image_delete',
      'image_getMetadata',
    ],
    maxSteps: 8,
    canSpawn: false,
  },

  permission: { write: 'allow', delete: 'ask' },

  memory: {
    compactionEnabled: false,
    todoEnabled: false,
  },
};
```

---

## QA Specialist

```typescript
const qaSpecialist: AgentConfig = {
  id: 'qa_specialist',
  name: 'Q&A Specialist',
  description: 'Answers questions about CMS content',
  type: 'specialist',

  model: {
    default: 'gpt-4o-mini',
    temperature: 0.5,
  },

  prompt: { file: 'prompts/qa-specialist.prompt.md' },

  specialist: {
    domain: 'cms_query',
    tools: [
      'cms_listPages',
      'cms_getPage',
      'cms_listPosts',
      'cms_getPost',
      'cms_listSections',
      'vector_search',
    ],
    maxSteps: 5,
    canSpawn: false,
  },

  permission: { write: 'deny', delete: 'deny' },

  memory: {
    compactionEnabled: false,
    todoEnabled: false,
  },
};
```

---

## Specialist Comparison Table

| Agent | Model | Tools | Max Steps | Todo | Compaction |
|-------|-------|-------|-----------|------|------------|
| **qa_specialist** | gpt-4o-mini | 6 read-only | 5 | ❌ | ❌ |
| **research_specialist** | gpt-4o | 3 search | 10 | ❌ | ✅ |
| **image_specialist** | gpt-4o | 5 image | 8 | ❌ | ❌ |
| **post_specialist** | gpt-4o | 7 post | 12 | ✅ | ✅ |
| **page_specialist** | gpt-4o | 11 page | 15 | ✅ | ✅ |

---

## Shared vs Adapter-Specific Agents

| Agent | Location | Notes |
|-------|----------|-------|
| `router` | Shared | Same across all adapters |
| `orchestrator` | Shared | Same across all adapters |
| `qa_specialist` | Shared | Read-only, works with any CMS |
| `research_specialist` | Shared | Web-only, no CMS tools |
| `page_specialist` | Adapter | Different tools per CMS |
| `post_specialist` | Adapter | Different tools per CMS |
| `image_specialist` | Adapter | Different tools per CMS |

Shared agents live in `agent-server/src/2-agents/shared/`.
Adapter-specific agents live in `adapters/{cms}/2-agents/`.

---

## Related Documents

- → [08-agent-model.md](08-agent-model.md) - Agent type concepts
- → [10-spawning-flow.md](10-spawning-flow.md) - How orchestrator spawns
- → [11-hitl-integration.md](11-hitl-integration.md) - Permission handling
- ↗ [../4-appendices/appendix-a-schemas.md](../4-appendices/appendix-a-schemas.md) - Full AgentConfig schema
