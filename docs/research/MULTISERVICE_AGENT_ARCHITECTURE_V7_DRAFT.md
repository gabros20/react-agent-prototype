# Multiservice Agent Architecture V7 Draft

**Date**: 2025-12-31
**Status**: DRAFT
**Evolution**: V6 Simplified → Router + Single Orchestrator + Specialists
**Key Concept**: "Three Levels Maximum, One Orchestrator, Domain Knowledge in Specialists"

---

## 1. The Core Model: 3 Levels, 7 Agents

```
Level 1: ROUTER
         │
         ├── [Simple] ────→ SPECIALIST ────→ User
         │
         └── [Complex] ───→ ORCHESTRATOR ───→ N SPECIALISTS ───→ ORCHESTRATOR ───→ User
                            (Level 2)         (Level 3)
```

**Maximum depth: 3. No exceptions.**

| Level | Agent Type | Count | Responsibility |
|-------|------------|-------|----------------|
| 1 | Router | 1 | Classify intent + complexity, route to handler |
| 2 | Orchestrator | 1 | Decompose, spawn specialists, track progress, synthesize |
| 2 | Specialists | 5 | Execute domain-specific tasks with tools |
| 3 | Specialists | (spawned by orchestrator) | Same specialists, spawned for subtasks |

**Total: 7 agent configurations**

---

## 2. Why This Structure?

### Why ONE Orchestrator (Not Domain-Specific)?

The orchestrator's job is **coordination**, not domain knowledge:
- Decompose complex task into subtasks
- Decide which specialist handles each subtask
- Spawn them (parallel or sequential)
- Track progress
- Synthesize results

**Domain knowledge lives in specialists and their prompts.** The orchestrator just coordinates.

### Why Max Depth = 3?

| Depth | What Happens |
|-------|--------------|
| 1 | Router classifies |
| 2 | Orchestrator decomposes OR Specialist executes directly |
| 3 | Specialists execute subtasks |
| 4+ | ❌ Not allowed - complexity explosion, debugging nightmare |

### Why Specialists Don't Spawn?

Specialists have **tools**, not sub-agents:
- `page_specialist` needs images? Calls `image_search` tool directly
- `research_specialist` needs to fetch a page? Calls `web_fetch` tool directly

No specialist-to-specialist spawning. Tools are sufficient.

---

## 3. Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER MESSAGE                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LEVEL 1: ROUTER                                      │
│                                                                              │
│  Agent: router                                                               │
│  Model: gpt-4o-mini (fast, cheap, deterministic)                            │
│                                                                              │
│  Job:                                                                        │
│    1. Classify INTENT (page_building, research, qa, etc.)                   │
│    2. Assess COMPLEXITY (simple vs complex)                                  │
│    3. Route to appropriate Level 2 agent                                     │
│                                                                              │
│  Output: { intent, complexity, targetAgent }                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   │                                     │
            [complexity: simple]                  [complexity: complex]
                   │                                     │
                   ▼                                     ▼
┌────────────────────────────────┐   ┌────────────────────────────────────────┐
│  LEVEL 2: SPECIALIST           │   │  LEVEL 2: ORCHESTRATOR                 │
│  (direct execution)            │   │  (coordination layer)                  │
│                                │   │                                        │
│  One of:                       │   │  Agent: orchestrator                   │
│  • page_specialist             │   │  Model: gpt-4o                         │
│  • post_specialist             │   │                                        │
│  • research_specialist         │   │  Job:                                  │
│  • image_specialist            │   │    1. Decompose task into subtasks     │
│  • qa_specialist               │   │    2. Assign specialist to each        │
│                                │   │    3. Spawn specialists (Level 3)      │
│  Executes task with tools      │   │    4. Track progress (todo list)       │
│  Returns result to user        │   │    5. Synthesize results               │
│                                │   │    6. Return to user                   │
│  DEPTH STOPS HERE: 2           │   │                                        │
└────────────────────────────────┘   └────────────────────────────────────────┘
                                                      │
                                                      ▼
                                     ┌────────────────────────────────────────┐
                                     │  LEVEL 3: SPAWNED SPECIALISTS          │
                                     │                                        │
                                     │  Same 5 specialists, but spawned by    │
                                     │  orchestrator for subtasks:            │
                                     │                                        │
                                     │  • page_specialist                     │
                                     │  • post_specialist                     │
                                     │  • research_specialist                 │
                                     │  • image_specialist                    │
                                     │  • qa_specialist                       │
                                     │                                        │
                                     │  Execute subtask with tools            │
                                     │  Return result to orchestrator         │
                                     │                                        │
                                     │  DEPTH STOPS HERE: 3                   │
                                     │  NO FURTHER SPAWNING ALLOWED           │
                                     └────────────────────────────────────────┘
                                                      │
                                                      ▼
                                              Back to Orchestrator
                                                      │
                                                      ▼
                                               Back to User
```

---

## 4. The 7 Agents

### 4.1 Agent Overview

| ID | Type | Model | Purpose |
|----|------|-------|---------|
| `router` | router | gpt-4o-mini | Classify intent + complexity, route |
| `orchestrator` | orchestrator | gpt-4o | Decompose, spawn, track, synthesize |
| `page_specialist` | specialist | gpt-4o | Create/edit pages and sections |
| `post_specialist` | specialist | gpt-4o | Create/edit blog posts |
| `research_specialist` | specialist | gpt-4o | Web research, information gathering |
| `image_specialist` | specialist | gpt-4o | Image search, upload, management |
| `qa_specialist` | specialist | gpt-4o-mini | Answer questions about CMS content |

### 4.2 Router Agent

```typescript
const routerAgent: AgentConfig = {
  id: 'router',
  name: 'Intent Router',
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

    // Simple tasks go directly to specialist
    simpleRoutes: {
      page_building: 'page_specialist',
      post_writing: 'post_specialist',
      image_management: 'image_specialist',
      cms_query: 'qa_specialist',
      web_research: 'research_specialist',
      general_qa: 'qa_specialist',
    },

    // Complex tasks always go to orchestrator
    complexRoute: 'orchestrator',
  },

  permissions: { write: 'deny', delete: 'deny' },
};
```

### 4.3 Orchestrator Agent (The ONE Orchestrator)

```typescript
const orchestratorAgent: AgentConfig = {
  id: 'orchestrator',
  name: 'Task Orchestrator',
  type: 'orchestrator',

  model: {
    default: 'gpt-4o',
    temperature: 0.3,
  },

  prompt: { file: 'prompts/orchestrator.prompt.md' },

  orchestration: {
    // Task decomposition
    decomposition: {
      enabled: true,
      maxSubtasks: 10,  // Safety limit
    },

    // Which specialists can be spawned
    availableSpecialists: [
      'page_specialist',
      'post_specialist',
      'research_specialist',
      'image_specialist',
      'qa_specialist',
    ],

    // Spawning configuration
    spawning: {
      maxConcurrent: 5,
      // Orchestrator decides per-task:
      // - parallel for independent items (research 5 competitors)
      // - sequential for dependent steps (research, then create page)
    },

    // Context mode for spawned specialists
    contextModes: {
      // For independent items (wide research): fresh context each
      independent: 'fresh',
      // For dependent workflow: pass relevant context
      dependent: 'selective',
    },

    // Progress tracking
    todoTracking: true,

    // Result synthesis
    synthesis: {
      enabled: true,
      // 'structured' for data, 'narrative' for reports
    },
  },

  permissions: { write: 'allow', delete: 'ask' },

  memory: {
    compactionEnabled: true,
    preserveErrorsInContext: true,
  },
};
```

### 4.4 Specialist Agents

#### Page Specialist
```typescript
const pageSpecialist: AgentConfig = {
  id: 'page_specialist',
  name: 'Page Builder',
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
    canSpawn: false,  // Specialists NEVER spawn
  },

  permissions: { write: 'allow', delete: 'ask' },
};
```

#### Post Specialist
```typescript
const postSpecialist: AgentConfig = {
  id: 'post_specialist',
  name: 'Post Writer',
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

  permissions: { write: 'allow', delete: 'ask' },
};
```

#### Research Specialist
```typescript
const researchSpecialist: AgentConfig = {
  id: 'research_specialist',
  name: 'Research Assistant',
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

  permissions: { write: 'deny', delete: 'deny' },
};
```

#### Image Specialist
```typescript
const imageSpecialist: AgentConfig = {
  id: 'image_specialist',
  name: 'Image Manager',
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

  permissions: { write: 'allow', delete: 'ask' },
};
```

#### Q&A Specialist
```typescript
const qaSpecialist: AgentConfig = {
  id: 'qa_specialist',
  name: 'Q&A Assistant',
  type: 'specialist',

  model: {
    default: 'gpt-4o-mini',  // Fast for simple questions
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

  permissions: { write: 'deny', delete: 'deny' },
};
```

---

## 5. AgentConfig Schema (Unified)

```typescript
interface AgentConfig {
  id: string;
  name: string;
  type: 'router' | 'orchestrator' | 'specialist';

  model: {
    default: string;
    temperature?: number;
    maxOutputTokens?: number;
  };

  prompt: string | { file: string };

  // ═══════════════════════════════════════════════════════════════════════
  // TYPE-SPECIFIC CONFIG (only one of these based on type)
  // ═══════════════════════════════════════════════════════════════════════

  // For type: 'router'
  routing?: {
    intents: string[];
    complexityRules: {
      escalateToOrchestrator: string[];
    };
    simpleRoutes: Record<string, string>;  // intent → specialist ID
    complexRoute: string;                   // Always 'orchestrator'
  };

  // For type: 'orchestrator'
  orchestration?: {
    decomposition: {
      enabled: boolean;
      maxSubtasks: number;
    };
    availableSpecialists: string[];
    spawning: {
      maxConcurrent: number;
    };
    contextModes: {
      independent: 'fresh' | 'inherited';
      dependent: 'selective' | 'inherited';
    };
    todoTracking: boolean;
    synthesis: {
      enabled: boolean;
    };
  };

  // For type: 'specialist'
  specialist?: {
    domain: string;
    tools: string[];
    maxSteps: number;
    canSpawn: false;  // Always false - specialists don't spawn
  };

  // ═══════════════════════════════════════════════════════════════════════
  // COMMON CONFIG (all types)
  // ═══════════════════════════════════════════════════════════════════════

  permissions: {
    write: 'allow' | 'ask' | 'deny';
    delete: 'allow' | 'ask' | 'deny';
  };

  memory?: {
    compactionEnabled: boolean;
    preserveErrorsInContext: boolean;
  };
}
```

---

## 6. Execution Examples

### Example 1: Simple Task

**User**: "Create a pricing page"

```
Step 1: Router
        Input: "Create a pricing page"
        Analysis: intent=page_building, complexity=simple (single entity)
        Output: route to page_specialist

Step 2: page_specialist
        Executes with tools: cms_createPage, cms_addSection, etc.
        Returns: Page created successfully

Step 3: User receives result

DEPTH: 2 (Router → Specialist)
```

### Example 2: Complex Single-Domain Task

**User**: "Research our top 3 competitors and create a comparison page"

```
Step 1: Router
        Input: "Research our top 3 competitors and create a comparison page"
        Analysis: intent=page_building, complexity=complex (research_then_action)
        Output: route to orchestrator

Step 2: Orchestrator
        Decomposes into subtasks:
          1. "Research competitor A" → research_specialist
          2. "Research competitor B" → research_specialist
          3. "Research competitor C" → research_specialist
          4. "Create comparison page with research findings" → page_specialist

        Execution plan:
          - Tasks 1-3: parallel (independent research)
          - Task 4: sequential (depends on 1-3)

Step 3: Spawned Specialists (Level 3)
        research_specialist (x3) - parallel, fresh context each
        Returns: Research findings for each competitor

Step 4: Orchestrator receives results, updates todo

Step 5: Spawned Specialist (Level 3)
        page_specialist - with context from research
        Returns: Comparison page created

Step 6: Orchestrator synthesizes
        "I've researched competitors A, B, C and created a comparison page at /comparison"

Step 7: User receives result

DEPTH: 3 (Router → Orchestrator → Specialists)
```

### Example 3: Wide Research (Manus Pattern)

**User**: "Research 5 competitors in the CMS space"

```
Step 1: Router
        Input: "Research 5 competitors in the CMS space"
        Analysis: intent=web_research, complexity=complex (multi_entity)
        Output: route to orchestrator

Step 2: Orchestrator
        Decomposes into subtasks:
          1. "Research Contentful" → research_specialist
          2. "Research Sanity" → research_specialist
          3. "Research Strapi" → research_specialist
          4. "Research Payload" → research_specialist
          5. "Research Directus" → research_specialist

        Execution plan: ALL parallel (independent items)
        Context mode: FRESH (prevents cross-contamination)

Step 3: Spawned Specialists (Level 3)
        research_specialist (x5) - parallel, FRESH context each
        Each researches independently without knowledge of others
        Returns: 5 independent research reports

Step 4: Orchestrator synthesizes
        Combines 5 reports into comprehensive comparison

Step 5: User receives synthesized report

DEPTH: 3 (Router → Orchestrator → Specialists)
```

### Example 4: Simple Q&A

**User**: "What pages do I have?"

```
Step 1: Router
        Input: "What pages do I have?"
        Analysis: intent=cms_query, complexity=simple
        Output: route to qa_specialist

Step 2: qa_specialist
        Executes: cms_listPages
        Returns: "You have 5 pages: Home, About, Pricing, Blog, Contact"

Step 3: User receives result

DEPTH: 2 (Router → Specialist)
```

---

## 7. The Rules (Enforced)

| Rule | Enforcement |
|------|-------------|
| **Max depth = 3** | Orchestrator spawns specialists. Specialists cannot spawn. |
| **ONE orchestrator** | Only one orchestrator agent exists. No domain-specific orchestrators. |
| **Specialists have tools, not sub-agents** | `canSpawn: false` in all specialist configs |
| **Router is mandatory entry point** | All requests start at router |
| **Orchestrator decides parallelism** | Based on task dependencies, not hardcoded |
| **Fresh context for independent items** | `contextModes.independent: 'fresh'` |
| **Selective context for dependent steps** | `contextModes.dependent: 'selective'` |

---

## 8. Feature Flags for Incremental Rollout

```typescript
interface SystemConfig {
  features: {
    // Core
    routerEnabled: boolean;           // false = direct to default specialist

    // Orchestration
    orchestrationEnabled: boolean;    // false = all tasks treated as simple
    complexityAssessment: boolean;    // false = skip complexity check

    // Advanced
    parallelSpawning: boolean;        // false = always sequential
    freshContextMode: boolean;        // false = always inherit context

    // Future
    visualBuilderEnabled: boolean;
  };

  defaults: {
    simpleSpecialist: string;         // Fallback for simple tasks
    complexHandler: string;           // 'orchestrator' when enabled
  };
}
```

### MVP Configuration
```typescript
const mvpConfig: SystemConfig = {
  features: {
    routerEnabled: true,
    orchestrationEnabled: false,      // Ship without orchestration
    complexityAssessment: false,      // All tasks are "simple"
    parallelSpawning: false,
    freshContextMode: false,
    visualBuilderEnabled: false,
  },
  defaults: {
    simpleSpecialist: 'qa_specialist',
    complexHandler: 'qa_specialist',  // Fallback when orchestration disabled
  },
};
```

### Full Configuration
```typescript
const fullConfig: SystemConfig = {
  features: {
    routerEnabled: true,
    orchestrationEnabled: true,
    complexityAssessment: true,
    parallelSpawning: true,
    freshContextMode: true,
    visualBuilderEnabled: false,
  },
  defaults: {
    simpleSpecialist: 'qa_specialist',
    complexHandler: 'orchestrator',
  },
};
```

---

## 9. Router Prompt

```markdown
# Intent Router

You classify user requests and route them to the appropriate handler.

## Your Task

For each user message, determine:

### 1. INTENT - What domain does this belong to?

| Intent | Description | Examples |
|--------|-------------|----------|
| `page_building` | Creating, editing pages/sections | "Create a pricing page", "Add a hero section" |
| `post_writing` | Blog posts, articles | "Write a blog post about X", "Update the latest post" |
| `image_management` | Finding, uploading images | "Find images of mountains", "Upload this logo" |
| `cms_query` | Questions about existing content | "What pages do I have?", "Show me all posts" |
| `web_research` | Research requiring web search | "Research competitors", "Find information about X" |
| `general_qa` | General questions, help | "How do I use this?", "What can you do?" |

### 2. COMPLEXITY - Is this simple or complex?

**SIMPLE** (direct to specialist):
- Single entity: "Create a pricing page" ✓
- Clear, bounded task: "Add a hero section to homepage" ✓
- No research required: "List all my pages" ✓
- Straightforward execution

**COMPLEX** (requires orchestrator):
- Multiple entities: "Create 3 landing pages" ✗
- Research before action: "Research competitors and create comparison page" ✗
- Multi-step workflow: "Find images, create page, write announcement" ✗
- User asks for "thorough", "comprehensive", "detailed" work ✗

## Output Format

Respond with JSON only:

```json
{
  "intent": "page_building",
  "complexity": "simple",
  "reasoning": "Single page creation with clear requirements"
}
```

## Examples

User: "Create a pricing page"
→ {"intent": "page_building", "complexity": "simple", "reasoning": "Single page, clear task"}

User: "Research our competitors and create a comparison page"
→ {"intent": "page_building", "complexity": "complex", "reasoning": "Requires research before page creation"}

User: "What pages do I have?"
→ {"intent": "cms_query", "complexity": "simple", "reasoning": "Simple query about existing content"}

User: "Research 5 CMS platforms and summarize their features"
→ {"intent": "web_research", "complexity": "complex", "reasoning": "Multiple entities requiring parallel research"}
```

---

## 10. Orchestrator Prompt

```markdown
# Task Orchestrator

You coordinate complex tasks by decomposing them into subtasks and delegating to specialists.

## Your Role

You are the coordination layer. You do NOT execute tasks directly. You:
1. Decompose the user's complex request into subtasks
2. Assign each subtask to the appropriate specialist
3. Decide execution order (parallel vs sequential)
4. Track progress
5. Synthesize results into a coherent response

## Available Specialists

| Specialist | Use For |
|------------|---------|
| `page_specialist` | Creating/editing pages, sections, templates |
| `post_specialist` | Writing/editing blog posts, articles |
| `research_specialist` | Web research, information gathering |
| `image_specialist` | Finding, uploading, managing images |
| `qa_specialist` | Answering questions about CMS content |

## Decomposition Rules

1. **Independent items → Parallel execution**
   - "Research 5 competitors" → 5 parallel research_specialist calls
   - Each gets FRESH context (no cross-contamination)

2. **Dependent steps → Sequential execution**
   - "Research X, then create page about X" → research first, then page
   - Later steps receive context from earlier steps

3. **Mixed workflows → Parallel where possible, sequential where needed**
   - "Research A and B, then create comparison" → A and B parallel, comparison after both

## Output Format

For each step, output your plan:

```json
{
  "subtasks": [
    {"id": 1, "task": "Research competitor A", "specialist": "research_specialist", "dependsOn": []},
    {"id": 2, "task": "Research competitor B", "specialist": "research_specialist", "dependsOn": []},
    {"id": 3, "task": "Create comparison page", "specialist": "page_specialist", "dependsOn": [1, 2]}
  ],
  "executionPlan": {
    "parallel": [[1, 2]],
    "sequential": [3]
  }
}
```

## Progress Tracking

Update the todo list after each subtask completes:
- Mark completed tasks
- Note any errors (keep them visible for learning)
- Adjust remaining plan if needed

## Synthesis

After all subtasks complete, synthesize results into a coherent response for the user.
Do not just concatenate - create a unified narrative or structured output.
```

---

## 11. Comparison: V6 vs V7

| Aspect | V6 | V7 |
|--------|----|----|
| Agent types | `mode: 'primary' \| 'general' \| 'domain'` | `type: 'router' \| 'orchestrator' \| 'specialist'` |
| Orchestrators | Multiple domain-specific | ONE general-purpose |
| Max depth | Configurable (default 3) | Fixed at 3 |
| Specialist spawning | Could spawn via `spawn_agent` tool | Cannot spawn (`canSpawn: false`) |
| Router | Implicit in 'primary' mode | Explicit agent type |
| Complexity assessment | Not specified | First-class routing concern |
| spawn_agent tool | Exposed to agents | Internal to orchestrator only |

---

## 12. Session Hierarchy (Unchanged from V6)

```typescript
interface Session {
  id: string;
  parentId: string | null;    // null for root (from router)
  agentId: string;            // Which agent config
  depth: number;              // 1=router, 2=orchestrator/specialist, 3=spawned specialist
  status: 'active' | 'completed' | 'error';

  // Results
  result?: unknown;
  error?: string;

  // Metrics
  tokenUsage: number;
  steps: number;
}
```

**Depth enforcement:**
- Router creates session at depth 1
- Routes to orchestrator/specialist at depth 2
- Orchestrator spawns specialists at depth 3
- Depth 3 agents CANNOT spawn (enforced by `canSpawn: false`)

---

## 13. Manus Patterns Adopted

| Pattern | Implementation | Where Used |
|---------|----------------|------------|
| **Fresh context for parallel items** | `contextModes.independent: 'fresh'` | Wide research (5 competitors) |
| **Error preservation** | `preserveErrorsInContext: true` | All agents with memory |
| **Todo recitation** | `todoTracking: true` in orchestrator | Complex workflows |
| **Decompose → Parallelize → Synthesize** | Orchestrator's core job | Complex tasks |

### Patterns NOT Needed (For CMS Product)

| Pattern | Why Skip |
|---------|----------|
| KV-cache optimization | Not at scale where 10x cost matters |
| Restorable compression | Simple compaction sufficient |
| Controlled variation | Edge case for few-shot mimicry |
| Unlimited depth | 3 levels handles all CMS use cases |

---

## 14. Summary

**V7 is simple:**

```
7 agents:
  1 router
  1 orchestrator
  5 specialists

3 levels max:
  Router → Orchestrator → Specialists
  Router → Specialist (simple tasks)

Clear rules:
  - ONE orchestrator coordinates everything
  - Specialists execute with tools, never spawn
  - Domain knowledge in specialist prompts
  - Orchestrator is domain-agnostic coordinator
```

**This architecture:**
- Ships simple (disable orchestration for MVP)
- Scales to complex (enable orchestration for enterprise)
- Supports visual builder (agents are just JSON configs)
- Avoids refactoring (unified model from day one)

---

## 15. V6 → V7 Migration: Surgical Refinement

This section details exactly what changes from V6 to V7. The key insight: **90% of V6 stays unchanged**. This is a surgical refinement, not a rewrite.

### 15.1 What Stays the Same (From V6)

These V6 concepts remain unchanged in V7:

| V6 Section | Status | Notes |
|------------|--------|-------|
| Session hierarchy model | ✓ Keep | `parentId`, `depth`, tree structure |
| AgentContext interface | ✓ Keep | Same injection pattern |
| Tool registry architecture | ✓ Keep | Discovery + registration |
| Permission system | ✓ Keep | `write`/`delete` with ask/allow/deny |
| Memory compaction | ✓ Keep | Token management unchanged |
| Working memory extraction | ✓ Keep | Entity detection |
| SSE streaming | ✓ Keep | Event format unchanged |
| Result synthesis | ✓ Keep | Orchestrator responsibility |
| Error handling | ✓ Keep | Propagation patterns |
| Database schema | ✓ Keep | Sessions, messages, tools tables |
| Service layer | ✓ Keep | SessionService, AgentService |
| Background jobs | ✓ Keep | BullMQ integration |

### 15.2 What Changes (V6 → V7)

#### Schema Change: Agent Types

```diff
// V6
interface AgentConfig {
-   mode: 'primary' | 'general' | 'domain';
+   type: 'router' | 'orchestrator' | 'specialist';

// Type-specific blocks replace mode-specific inference
+   routing?: { ... };       // For type: 'router'
+   orchestration?: { ... }; // For type: 'orchestrator'
+   specialist?: { ... };    // For type: 'specialist'
}
```

#### Agent Catalog Change

| V6 Agent | V7 Agent | Change |
|----------|----------|--------|
| `main_agent` | `router` | Rename + add `routing` config |
| `page_agent` | `page_specialist` | Rename + add `specialist` config |
| `post_agent` | `post_specialist` | Rename + add `specialist` config |
| `research_agent` | `research_specialist` | Rename + add `specialist` config |
| `image_agent` | `image_specialist` | Rename + add `specialist` config |
| `qa_agent` | `qa_specialist` | Rename + add `specialist` config |
| *(new)* | `orchestrator` | NEW agent for complex coordination |

**Agent count: 6 → 7** (adding orchestrator)

#### spawn_agent Tool Removal

```diff
// V6: spawn_agent exposed to LLM
tools: [
  'cms_createPage',
-   'spawn_agent',  // LLM decides when to spawn
]

// V7: Orchestrator spawns internally
orchestration: {
+   availableSpecialists: ['page_specialist', 'research_specialist'],
  // Spawning is orchestrator logic, NOT a tool call
}
```

**Why:** Prevents hallucination of invalid agent IDs. Orchestrator has hardcoded list.

#### Depth Enforcement

```diff
// V6: Configurable max depth
const MAX_DEPTH = config.get('maxAgentDepth') ?? 3;

// V7: Fixed max depth = 3
+const MAX_DEPTH = 3; // Not configurable
+// Enforced by: specialists have canSpawn: false
```

#### Routing Separation

```diff
// V6: main_agent does routing implicitly in prompt
prompt: "You decide whether to handle this yourself or spawn..."

// V7: Explicit router agent with structured output
+const routerAgent = {
+  type: 'router',
+  routing: {
+    intents: ['page_building', 'research', ...],
+    complexityRules: { escalateToOrchestrator: [...] },
+    simpleRoutes: { page_building: 'page_specialist', ... },
+    complexRoute: 'orchestrator',
+  }
+};
```

#### Complexity Assessment

```diff
// V6: No formal complexity assessment
// Router decides on its own based on prompt

// V7: First-class complexity concept
+routing: {
+  complexityRules: {
+    escalateToOrchestrator: [
+      'multi_entity',           // "Create 3 pages"
+      'research_then_action',   // "Research then create"
+      'multi_step_workflow',    // Chain of actions
+      'explicit_thorough',      // User says "comprehensive"
+    ],
+  },
+}
```

#### Context Modes (New from Manus)

```diff
// V6: Always inherit full context
const childContext = parentContext; // Everything passed

// V7: Mode-based context passing
+orchestration: {
+  contextModes: {
+    independent: 'fresh',      // Wide research: clean slate
+    dependent: 'selective',    // Workflows: relevant parts only
+  }
+}
```

#### Feature Flags (New)

```diff
// V6: Hard-coded behavior

// V7: Runtime configuration
+interface SystemConfig {
+  features: {
+    routerEnabled: boolean;
+    orchestrationEnabled: boolean;
+    complexityAssessment: boolean;
+    parallelSpawning: boolean;
+    freshContextMode: boolean;
+  };
+}
```

### 15.3 Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `core/agent/agent.config.ts` | MODIFY | Update `AgentConfig` interface: `mode` → `type`, add type-specific blocks |
| `core/agent/agent.factory.ts` | MODIFY | Load agents by `type`, handle routing/orchestration/specialist configs |
| `core/session/session.orchestrator.ts` | MODIFY | Add router logic, complexity assessment, orchestrator spawning |
| `agents/*.config.ts` | MODIFY | Rename agents, add `type` field, add specialist/routing config |
| `tools/shared/spawn_agent/` | DELETE | Remove tool entirely |
| `core/config/system.config.ts` | NEW | Feature flags configuration |
| `prompts/router.prompt.md` | NEW | Router classification prompt |
| `prompts/orchestrator.prompt.md` | NEW | Orchestrator coordination prompt |

### 15.4 V6 Document Sections to Update

| V6 Section | Update Required |
|------------|-----------------|
| §4.2 Agent Configuration Schema | Add `type`, routing/orchestration/specialist blocks |
| §4.3 Agent Catalog | Rename all agents, add orchestrator |
| §5.2 spawn_agent Tool | Remove section entirely |
| §6.1 Session Hierarchy | Add depth enforcement documentation |
| §6.3 Routing Flow | Add router agent, complexity assessment |
| §7.2 Context Injection | Add `contextModes` for fresh/selective |
| §8.x Feature Flags | NEW section |

### 15.5 Migration Path (4 Phases)

#### Phase 1: Schema Update (No Behavior Change)

```typescript
// Add 'type' field, keep backward compatibility
interface AgentConfig {
  mode?: 'primary' | 'general' | 'domain';  // Deprecated
  type?: 'router' | 'orchestrator' | 'specialist';  // New

  // If type not specified, infer from mode
  // mode: 'primary' → type: 'router'
  // mode: 'general' → type: 'orchestrator'
  // mode: 'domain' → type: 'specialist'
}
```

**Deliverable:** Agents still work with `mode`, but `type` can be used.

#### Phase 2: Add Router Agent

```typescript
// New router agent
const routerAgent: AgentConfig = {
  id: 'router',
  type: 'router',
  routing: {
    intents: [...],
    simpleRoutes: { ... },
    complexRoute: 'orchestrator',
  },
};

// Feature flag: routerEnabled
// false = bypass router, go direct to qa_specialist
// true = all requests start at router
```

**Deliverable:** Router classifies intent and routes to specialists.

#### Phase 3: Add Orchestrator

```typescript
// New orchestrator agent
const orchestratorAgent: AgentConfig = {
  id: 'orchestrator',
  type: 'orchestrator',
  orchestration: {
    availableSpecialists: [...],
    contextModes: { independent: 'fresh', dependent: 'selective' },
    todoTracking: true,
  },
};

// Feature flag: orchestrationEnabled
// false = complex tasks still go to single specialist
// true = orchestrator decomposes and spawns
```

**Deliverable:** Complex tasks get decomposed and parallelized.

#### Phase 4: Remove Deprecated

```diff
- Remove spawn_agent tool
- Remove mode field from schema
- Remove mode inference logic
- Set feature flags to production defaults
```

**Deliverable:** Clean V7 architecture.

---

## 16. Implementation Checklist

### Phase 1: Schema (Week 1)
- [ ] Update `AgentConfig` interface with `type` field
- [ ] Add routing/orchestration/specialist config blocks
- [ ] Keep `mode` as deprecated with inference
- [ ] Add `SystemConfig` for feature flags
- [ ] Update agent factory to handle both `mode` and `type`

### Phase 2: Router (Week 2)
- [ ] Create `router.config.ts` with routing configuration
- [ ] Create `prompts/router.prompt.md`
- [ ] Implement router logic in session orchestrator
- [ ] Add complexity assessment rules
- [ ] Add `routerEnabled` feature flag
- [ ] Rename existing agents: `*_agent` → `*_specialist`

### Phase 3: Orchestrator (Week 3)
- [ ] Create `orchestrator.config.ts`
- [ ] Create `prompts/orchestrator.prompt.md`
- [ ] Implement task decomposition logic
- [ ] Implement parallel spawning with `contextModes`
- [ ] Implement todo tracking for progress
- [ ] Implement result synthesis
- [ ] Add `orchestrationEnabled` feature flag

### Phase 4: Cleanup (Week 4)
- [ ] Remove `spawn_agent` tool
- [ ] Remove `mode` field from schema
- [ ] Remove backward compatibility code
- [ ] Update all documentation
- [ ] Set production feature flag defaults

---

## 17. Testing Strategy

### Router Testing
```typescript
describe('Router', () => {
  test('classifies simple page task', () => {
    const result = router.classify('Create a pricing page');
    expect(result.intent).toBe('page_building');
    expect(result.complexity).toBe('simple');
    expect(result.target).toBe('page_specialist');
  });

  test('escalates multi-entity to orchestrator', () => {
    const result = router.classify('Create 3 landing pages');
    expect(result.complexity).toBe('complex');
    expect(result.target).toBe('orchestrator');
  });

  test('escalates research-then-action to orchestrator', () => {
    const result = router.classify('Research competitors and create comparison');
    expect(result.complexity).toBe('complex');
    expect(result.target).toBe('orchestrator');
  });
});
```

### Orchestrator Testing
```typescript
describe('Orchestrator', () => {
  test('decomposes parallel research', () => {
    const plan = orchestrator.decompose('Research 3 competitors');
    expect(plan.subtasks).toHaveLength(3);
    expect(plan.subtasks.every(t => t.dependsOn.length === 0)).toBe(true);
    expect(plan.executionPlan.parallel).toContainEqual([1, 2, 3]);
  });

  test('decomposes sequential workflow', () => {
    const plan = orchestrator.decompose('Research X, then create page about X');
    expect(plan.subtasks[0].specialist).toBe('research_specialist');
    expect(plan.subtasks[1].dependsOn).toContain(1);
  });

  test('spawns with fresh context for independent items', async () => {
    const contexts = await orchestrator.spawnParallel([task1, task2, task3]);
    // Each context should be independent
    expect(contexts[0]).not.toContain(contexts[1].history);
  });
});
```

### Depth Enforcement Testing
```typescript
describe('Depth Enforcement', () => {
  test('specialist cannot spawn', () => {
    const specialist = loadAgent('page_specialist');
    expect(specialist.specialist?.canSpawn).toBe(false);
  });

  test('max depth is 3', () => {
    const session = await createSession({ depth: 3, agentId: 'page_specialist' });
    expect(() => session.spawn('another_specialist')).toThrow('Max depth exceeded');
  });
});
```

---

## 18. Rollback Strategy

If V7 causes issues, feature flags allow instant rollback:

```typescript
// Emergency rollback
const emergencyConfig: SystemConfig = {
  features: {
    routerEnabled: false,        // Bypass router
    orchestrationEnabled: false, // No orchestrator
    complexityAssessment: false, // Skip assessment
    parallelSpawning: false,
    freshContextMode: false,
  },
  defaults: {
    simpleSpecialist: 'qa_specialist',  // Direct to QA
    complexHandler: 'qa_specialist',
  },
};
```

This makes the system behave like a single-agent setup until issues are resolved.
