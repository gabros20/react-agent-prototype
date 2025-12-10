# Agent Module Reorganization Plan

> Restructure agent-related code into a modular, self-contained architecture following React component patterns

## Overview

This plan reorganizes the agent system into four domain modules with self-contained folders:

```
server/agent/
├── tools/           # Self-contained tool folders
├── agents/          # Agent types (orchestrator, planning, worker)
├── memory/          # Memory systems (session, working, semantic)
├── observation/     # Logging and telemetry
└── shared/          # Shared utilities (only if needed)
```

**Goals:**
- Enable multi-agent orchestration (planning agent, worker agents)
- Each tool is self-contained with implementation + instructions (colocated)
- Each agent is self-contained with config + prompt (colocated)
- Clear domain boundaries for memory and observation
- Scalable pattern for adding new tools/agents

**Naming Convention:**
- Files: `kebab-case.suffix.ts` (e.g., `list-pages.tool.ts`, `orchestrator.agent.ts`)
- Folders: `kebab-case/`
- Suffixes: `.tool.ts`, `.agent.ts`, `.service.ts` for typed files

---

## Target Architecture

```
server/agent/
├── tools/
│   ├── tool-search/
│   │   ├── tool-search.tool.ts      # Main tool definition
│   │   ├── bm25-search.ts           # BM25 algorithm
│   │   ├── vector-search.ts         # Vector similarity
│   │   ├── smart-search.ts          # Hybrid search
│   │   ├── tool-index.ts            # Tool metadata index
│   │   ├── instructions.ts          # Per-tool instructions (colocated)
│   │   ├── types.ts
│   │   └── index.ts                 # Barrel export
│   ├── list-pages/
│   │   ├── list-pages.tool.ts
│   │   ├── instructions.ts
│   │   └── index.ts
│   ├── create-page/
│   │   ├── create-page.tool.ts
│   │   ├── instructions.ts
│   │   └── index.ts
│   ├── get-page/
│   ├── update-page/
│   ├── delete-page/
│   ├── list-posts/
│   ├── create-post/
│   ├── get-post/
│   ├── update-post/
│   ├── publish-post/
│   ├── archive-post/
│   ├── delete-post/
│   ├── search-images/
│   ├── find-image/
│   ├── update-section-image/
│   ├── pexels-search/
│   ├── pexels-download/
│   ├── web-quick-search/
│   ├── web-deep-research/
│   ├── web-fetch-content/
│   ├── final-answer/
│   │   ├── final-answer.tool.ts
│   │   ├── instructions.ts
│   │   └── index.ts
│   ├── types.ts                     # Shared tool types (AgentContext)
│   └── _index.ts                    # Tool registry (aggregates all)
│
├── agents/
│   ├── orchestrator/
│   │   ├── orchestrator.agent.ts    # Agent config + service + prompt loading
│   │   ├── prompt.xml               # Full agent prompt (colocated)
│   │   └── index.ts
│   ├── planning/
│   │   ├── planning.agent.ts
│   │   ├── prompt.xml
│   │   └── index.ts
│   ├── worker/
│   │   ├── worker.agent.ts
│   │   ├── prompt.xml
│   │   └── index.ts
│   └── index.ts
│
├── memory/
│   ├── session-history/
│   │   ├── session.service.ts       # Chat persistence
│   │   └── index.ts
│   ├── working-memory/
│   │   ├── entity-extractor.ts      # Extract entities from results
│   │   ├── working-context.ts       # Sliding window context
│   │   ├── types.ts
│   │   └── index.ts
│   ├── semantic-memory/
│   │   ├── vector-index.ts          # LanceDB operations
│   │   └── index.ts
│   └── index.ts
│
├── observation/
│   ├── event-log/
│   │   ├── conversation-log.ts      # Tool calls, agent events
│   │   └── index.ts
│   ├── usage-log/
│   │   ├── token-tracker.ts         # Token usage
│   │   ├── cost-calculator.ts       # OpenRouter pricing
│   │   └── index.ts
│   └── index.ts
│
├── shared/                          # Only if genuinely needed
│
└── index.ts                         # Main agent module export
```

---

## Migration Mapping

### Phase 1: Tools Reorganization

| Current Location | New Location |
|------------------|--------------|
| `server/tools/discovery/tool-search.ts` | `server/agent/tools/tool-search/tool-search.tool.ts` |
| `server/tools/discovery/bm25-search.ts` | `server/agent/tools/tool-search/bm25-search.ts` |
| `server/tools/discovery/vector-search.ts` | `server/agent/tools/tool-search/vector-search.ts` |
| `server/tools/discovery/smart-search.ts` | `server/agent/tools/tool-search/smart-search.ts` |
| `server/tools/discovery/tool-index.ts` | `server/agent/tools/tool-search/tool-index.ts` |
| `server/tools/discovery/types.ts` | `server/agent/tools/tool-search/types.ts` |
| `server/tools/discovery/utils.ts` | `server/agent/tools/tool-search/utils.ts` |
| `server/tools/discovery/validate.ts` | `server/agent/tools/tool-search/validate.ts` |
| `server/tools/discovery/custom-extractors.ts` | `server/agent/tools/tool-search/custom-extractors.ts` |
| `server/tools/core/final-answer.ts` | `server/agent/tools/final-answer/final-answer.tool.ts` |
| `server/tools/instructions/index.ts` | Split into per-tool `instructions.ts` files |
| `server/tools/all-tools.ts` | `server/agent/tools/_index.ts` |
| `server/tools/types.ts` | `server/agent/tools/types.ts` (shared types) |

**Tools to split from grouped files:**

| Current File | Tools to Extract |
|--------------|------------------|
| `server/tools/image-tools.ts` | `search-images/`, `find-image/`, `list-images/`, `update-section-image/`, `replace-image/`, `delete-image/` |
| `server/tools/post-tools.ts` | `list-posts/`, `get-post/`, `create-post/`, `update-post/`, `publish-post/`, `archive-post/`, `delete-post/` |
| `server/tools/pexels-tools.ts` | `pexels-search/`, `pexels-download/` |
| `server/tools/web-research-tools.ts` | `web-quick-search/`, `web-deep-research/`, `web-fetch-content/` |
| `server/tools/site-settings-tools.ts` | `get-site-settings/`, `update-site-settings/` |

### Phase 2: Agents Consolidation

| Current Location | New Location |
|------------------|--------------|
| `server/agent/cms-agent.ts` | Merge into `server/agent/agents/orchestrator/orchestrator.agent.ts` |
| `server/agent/system-prompt.ts` | Merge into `server/agent/agents/orchestrator/orchestrator.agent.ts` |
| `server/services/agent/orchestrator.ts` | Merge into `server/agent/agents/orchestrator/orchestrator.agent.ts` |
| `server/services/agent/types.ts` | `server/agent/agents/orchestrator/types.ts` (if needed) |
| `server/services/agent/validation-service.ts` | Merge into `server/agent/agents/orchestrator/orchestrator.agent.ts` |
| `server/prompts/core/agent.xml` | `server/agent/agents/orchestrator/prompt.xml` |

**Note:** All agent logic consolidated into single `orchestrator.agent.ts` + `prompt.xml`

### Phase 3: Memory Module

| Current Location | New Location |
|------------------|--------------|
| `server/services/working-memory/entity-extractor.ts` | `server/agent/memory/working-memory/entity-extractor.ts` |
| `server/services/working-memory/working-context.ts` | `server/agent/memory/working-memory/working-context.ts` |
| `server/services/working-memory/types.ts` | `server/agent/memory/working-memory/types.ts` |
| `server/services/working-memory/index.ts` | `server/agent/memory/working-memory/index.ts` |
| `server/services/session-service.ts` | `server/agent/memory/session-history/session.service.ts` |
| `server/services/vector-index.ts` | `server/agent/memory/semantic-memory/vector-index.ts` |

### Phase 4: Observation Module

| Current Location | New Location |
|------------------|--------------|
| `server/services/conversation-log-service.ts` | `server/agent/observation/event-log/conversation-log.ts` |
| `server/services/openrouter-pricing.ts` | `server/agent/observation/usage-log/cost-calculator.ts` |
| `lib/tokenizer.ts` | `server/agent/observation/usage-log/token-tracker.ts` |

### Phase 5: Cleanup

Remove old directories after all imports updated:
- `server/prompts/` (prompt moved to agent folder)
- `server/tools/` (moved to `server/agent/tools/`)
- `server/services/agent/` (merged into orchestrator)
- `server/services/working-memory/` (moved to memory module)
- `server/agent/` old files (replaced by new structure)

---

## Tool Folder Pattern

Each tool follows this structure:

```typescript
// server/agent/tools/create-page/

// create-page.tool.ts
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../../types";

export const createPageTool = tool({
  description: "Create a new page with optional sections",
  inputSchema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    sections: z.array(z.object({...})).optional(),
  }),
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    const page = await ctx.services.pageService.createPage(input);
    return { success: true, page };
  },
});

// instructions.ts
export const CREATE_PAGE_INSTRUCTIONS = `BEFORE: cms_listPages to check slug availability
AFTER: Offer to add sections, add to navigation
NEXT: cms_addSectionToPage, cms_addNavigationItem
GOTCHA: Creates empty page. Use cms_createPageWithContent for page with sections.`;

// index.ts
export { createPageTool } from "./create-page.tool";
export { CREATE_PAGE_INSTRUCTIONS } from "./instructions";
```

---

## Import Updates Required

After reorganization, update imports across the codebase:

```typescript
// Before
import { ALL_TOOLS } from "../tools/all-tools";
import { AgentOrchestrator } from "../services/agent";
import { WorkingContext } from "../services/working-memory";
import { SessionService } from "../services/session-service";

// After
import { ALL_TOOLS } from "./tools";
import { AgentOrchestrator } from "./agents/orchestrator";
import { WorkingContext } from "./memory/working-memory";
import { SessionService } from "./memory/session-history";
```

---

## Files to Remove After Migration

```
server/tools/                    # Moved to server/agent/tools/
server/services/agent/           # Merged into server/agent/agents/orchestrator/
server/services/working-memory/  # Moved to server/agent/memory/working-memory/
server/agent/cms-agent.ts        # Merged into orchestrator.agent.ts
server/agent/system-prompt.ts    # Merged into orchestrator.agent.ts
server/prompts/                  # prompt.xml moved to orchestrator folder
```

---

## Migration Phases

> **Note:** This is a prototype - no backwards compatibility. Rip and replace approach.

### Phase 1: Create New Structure
1. Create `server/agent/tools/` directory structure
2. Create `server/agent/agents/orchestrator/` directory
3. Create `server/agent/memory/` directory structure
4. Create `server/agent/observation/` directory structure

### Phase 2: Migrate Tools
1. Move `tool-search` (discovery system) to `tools/tool-search/`
2. Split `image-tools.ts` into individual tool folders
3. Split `post-tools.ts` into individual tool folders
4. Split `pexels-tools.ts` into individual tool folders
5. Split `web-research-tools.ts` into individual tool folders
6. Split `site-settings-tools.ts` into individual tool folders
7. Move `final-answer` tool to `tools/final-answer/`
8. Split `instructions/index.ts` into per-tool `instructions.ts` files
9. Create `_index.ts` that aggregates all tools

### Phase 3: Migrate Agents
1. Create `agents/orchestrator/orchestrator.agent.ts` consolidating:
   - `server/agent/cms-agent.ts` (ToolLoopAgent config)
   - `server/agent/system-prompt.ts` (prompt loading)
   - `server/services/agent/orchestrator.ts` (orchestrator service)
   - `server/services/agent/validation-service.ts` (validation)
2. Move `server/prompts/core/agent.xml` to `agents/orchestrator/prompt.xml`

### Phase 4: Migrate Memory
1. Move `working-memory/` to `memory/working-memory/`
2. Move `session-service.ts` to `memory/session-history/session.service.ts`
3. Move `vector-index.ts` to `memory/semantic-memory/`

### Phase 5: Migrate Observation
1. Move `conversation-log-service.ts` to `observation/event-log/`
2. Move `openrouter-pricing.ts` to `observation/usage-log/cost-calculator.ts`
3. Move `lib/tokenizer.ts` to `observation/usage-log/token-tracker.ts`

### Phase 6: Cleanup & Fix Imports
1. Delete old directories (`server/tools/`, `server/services/agent/`, `server/prompts/`)
2. Update all import paths project-wide
3. Update documentation
4. Verify build passes

---

## Future Multi-Agent Support

The `agents/` structure enables:

```
server/agent/agents/
├── orchestrator/     # Current: single agent handling all tasks
├── planning/         # Future: decomposes complex tasks into subtasks
│   ├── planning.agent.ts
│   ├── task-decomposer.ts
│   └── index.ts
├── worker/           # Future: specialized task executors
│   ├── cms-worker.agent.ts
│   ├── research-worker.agent.ts
│   └── index.ts
└── coordinator/      # Future: manages agent communication
    ├── coordinator.ts
    └── index.ts
```

---

## Success Criteria

- [ ] All tools accessible via `server/agent/tools`
- [ ] Each tool folder is self-contained with implementation + instructions
- [ ] Agents accessible via `server/agent/agents/orchestrator`
- [ ] Memory systems in `server/agent/memory/`
- [ ] Observation in `server/agent/observation/`
- [ ] No circular dependencies
- [ ] All existing tests pass
- [ ] Import paths are clean and intuitive
- [ ] Documentation updated
