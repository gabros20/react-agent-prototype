# Implementation Stages

> **Summary**: V7 is implemented in 8 stages over approximately 8-9 weeks. Each stage builds on the previous, with clear deliverables and dependencies.
>
> **Prerequisites**: [../00-overview.md](../00-overview.md)

## Overview

The implementation follows a bottom-up approach:
1. Infrastructure first
2. Core runtime
3. Tool and memory subsystems
4. Adapter pattern
5. Multi-agent agents
6. CMS Server
7. Integration and UI

---

## Stage 1: Core Infrastructure

**Focus**: Foundation services and data layer

**Deliverables**:
- NestJS Agent Server scaffold
- Event Bus implementation
- Session Store (SQLite/Postgres) with parent/child hierarchy
- Session Service (CRUD operations)
- Redis + BullMQ setup

**Key Files**:
```
agent-server/src/
├── core/
│   ├── event-bus/
│   │   ├── event-bus.service.ts
│   │   ├── event-types.ts
│   │   └── event-bus.module.ts
│   └── session/
│       ├── session.store.ts
│       └── session.module.ts
├── services/
│   └── queue.service.ts
```

**Exit Criteria**:
- [ ] Event Bus publishes and subscribes
- [ ] Sessions persist to database
- [ ] Redis connection working
- [ ] BullMQ queues created

---

## Stage 2: Agent Runtime Core

**Focus**: Core agent loop execution

**Deliverables**:
- Agent Factory - loads and caches AgentConfig
- Session Processor - runs single agent loop
- Session Orchestrator - manages lifecycle and multi-agent coordination
- Doom loop detector
- Retry strategy (with `retry-after` header support)
- Tool name repair

**Key Files**:
```
agent-server/src/core/
├── session/
│   ├── session.orchestrator.ts
│   ├── session.processor.ts
│   └── doom-loop.detector.ts
└── agent/
    ├── agent.factory.ts
    └── agent.config.ts
```

**Exit Criteria**:
- [ ] Single agent runs to completion
- [ ] Retry on transient errors
- [ ] Doom loop detected and handled
- [ ] Tool names repaired on case mismatch

---

## Stage 3: Tool Subsystem

**Focus**: Tool loading, registration, and search

**Deliverables**:
- Tool Registry
- Per-tool folder structure for shared tools
- Hybrid Search (BM25 + Vector)
- Tool Context injection (with orchestrator reference)
- spawn_agent tool implementation (delegates to orchestrator)

**Key Files**:
```
agent-server/src/tools/
├── _registry/
│   ├── tool-registry.service.ts
│   └── tool-types.ts
├── _search/
│   ├── hybrid-search.service.ts
│   ├── bm25-search.ts
│   └── vector-search.ts
├── _loaders/
│   └── dynamic-loader.ts
└── shared/
    ├── web_search/
    ├── vector_search/
    └── todowrite/
```

**Exit Criteria**:
- [ ] Tools load from folders
- [ ] Hybrid search finds relevant tools
- [ ] Context injection works
- [ ] spawn_agent tool creates child sessions

---

## Stage 4: Memory Subsystem

**Focus**: Context management and plan tracking

**Deliverables**:
- Todo Service (OpenCode-style plan tracking)
- Compaction Service
- Provider token counting integration

**Key Files**:
```
agent-server/src/memory/
├── todo.service.ts
├── compaction.service.ts
└── memory.module.ts
```

**Exit Criteria**:
- [ ] Todos persist and update
- [ ] Compaction triggers when over limit
- [ ] Large tool outputs pruned
- [ ] Old messages summarized

---

## Stage 5: Adapter Pattern

**Focus**: CMS abstraction layer

**Deliverables**:
- CmsAdapter interface
- InternalCmsAdapter implementation
- Dynamic tool loading from adapters
- Agent configs bundled in adapters (merged by AgentFactory)

**Key Files**:
```
agent-server/src/adapters/
├── adapter.interface.ts
├── adapter.registry.ts
├── internal/
│   ├── tools/
│   ├── prompts/
│   ├── 2-agents/
│   ├── schemas/
│   └── index.ts
└── adapters.module.ts
```

**Exit Criteria**:
- [ ] Adapter loads tools, prompts, agents
- [ ] Internal CMS operations work through adapter
- [ ] Agent configs merged correctly
- [ ] Webhook parsing works

---

## Stage 6: Multi-Agent Agents

**Focus**: All agent configurations and multi-agent flow

**Deliverables**:
- AgentConfig definitions for all agent types
- Router agent implementation
- Orchestrator agent implementation
- Domain specialists (page, post, image)
- Shared specialists (qa, research)
- End-to-end multi-agent flow testing

**Key Files**:
```
agent-server/src/2-agents/
├── shared/
│   ├── router.agent.ts
│   ├── orchestrator.agent.ts
│   ├── qa-specialist.agent.ts
│   └── research-specialist.agent.ts
adapters/internal/2-agents/
├── page-specialist.agent.ts
├── post-specialist.agent.ts
└── image-specialist.agent.ts
```

**Exit Criteria**:
- [ ] Router classifies intent and complexity
- [ ] Orchestrator decomposes and spawns
- [ ] All 5 specialists execute domain tasks
- [ ] 3-level hierarchy works end-to-end
- [ ] Context modes (fresh/selective) work

---

## Stage 7: CMS Server

**Focus**: Internal CMS API

**Deliverables**:
- NestJS CMS Server scaffold (Internal CMS only)
- REST API for Pages, Sections, Posts, Media
- Webhook dispatch to Agent Server on content changes
- No workers here - all processing happens in Agent Server

**Key Files**:
```
cms-server/src/
├── pages/
│   ├── pages.controller.ts
│   └── pages.service.ts
├── sections/
├── posts/
├── media/
└── templates/
```

**Exit Criteria**:
- [ ] CRUD for pages, sections, posts, media
- [ ] Webhooks dispatch to Agent Server
- [ ] Agent Server can call CMS Server APIs

---

## Stage 8: Integration & UI

**Focus**: End-to-end integration and user interface

**Deliverables**:
- SSE streaming from Event Bus
- Next.js Chat UI with session hierarchy view
- HITL approval flow
- Child agent progress indicators
- Website Renderer connection

**Key Files**:
```
chat-ui/
├── components/
│   ├── chat/
│   ├── approval-modal/
│   └── session-tree/
├── hooks/
│   ├── use-agent.ts
│   └── use-sse.ts
```

**Exit Criteria**:
- [ ] Chat UI streams agent responses
- [ ] Approval modal shows for destructive ops
- [ ] Session tree shows parent/child hierarchy
- [ ] Progress indicators for child agents
- [ ] Website preview updates

---

## Dependency Graph

```
Stage 1 (Infrastructure)
    ↓
Stage 2 (Runtime Core)
    ↓
Stage 3 (Tool Subsystem) ←→ Stage 4 (Memory Subsystem)
    ↓
Stage 5 (Adapter Pattern)
    ↓
Stage 6 (Multi-Agent) ←→ Stage 7 (CMS Server)
    ↓
Stage 8 (Integration & UI)
```

---

## Parallel Workstreams

Some stages can be done in parallel:

| Workstream A | Workstream B |
|--------------|--------------|
| Stage 1-2 | - |
| Stage 3 | Stage 4 |
| Stage 5 | - |
| Stage 6 | Stage 7 |
| Stage 8 | - |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI SDK 6 changes | Pin version, follow changelog |
| Orchestration complexity | Feature flags allow MVP without orchestrator |
| Performance issues | Benchmark at Stage 3 (tools) and Stage 6 (multi-agent) |
| Third-party CMS integration | Internal CMS first, adapters later |

---

## Related Documents

- → [../00-overview.md](../00-overview.md) - Architecture overview
- → [14-feature-flags.md](14-feature-flags.md) - Incremental rollout
- ↗ [../4-appendices/appendix-b-directory.md](../4-appendices/appendix-b-directory.md) - Full directory structure
