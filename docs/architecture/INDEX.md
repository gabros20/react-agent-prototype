# Architecture Documentation Index

> **ReAct AI Agent CMS** - Full-stack TypeScript architecture overview

This index provides a high-level view of the system's major architectural layers. Each layer document is self-contained but references related layers where integration occurs.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  Next.js 16 • React 19 • Zustand • SSE Streaming                │
├─────────────────────────────────────────────────────────────────┤
│                      RENDERING LAYER                             │
│  Nunjucks Templates • Section Variants • Asset Pipeline         │
├─────────────────────────────────────────────────────────────────┤
│                        AGENT LAYER                               │
│  ReAct Loop • Tool Registry • Working Memory • HITL Approval    │
├─────────────────────────────────────────────────────────────────┤
│                       SERVICES LAYER                             │
│  PageService • SectionService • SessionService • VectorIndex    │
├─────────────────────────────────────────────────────────────────┤
│                    BACKGROUND LAYER                              │
│  BullMQ • Redis • Image Worker • Async Processing               │
├─────────────────────────────────────────────────────────────────┤
│                      DATABASE LAYER                              │
│  SQLite + Drizzle ORM • LanceDB Vector Store                    │
├─────────────────────────────────────────────────────────────────┤
│                      SERVER CORE                                 │
│  Express.js • Dependency Injection • Middleware • Routes        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer Documentation

| # | Layer | File | Description |
|---|-------|------|-------------|
| 1 | [Server Core](./LAYER_1_SERVER_CORE.md) | `LAYER_1_SERVER_CORE.md` | Express setup, DI container, routing, middleware |
| 2 | [Database & Persistence](./LAYER_2_DATABASE.md) | `LAYER_2_DATABASE.md` | SQLite/Drizzle schema, LanceDB vectors, migrations |
| 3 | [Agent System](./LAYER_3_AGENT.md) | `LAYER_3_AGENT.md` | ReAct loop, tool registry, working memory, HITL |
| 4 | [Services](./LAYER_4_SERVICES.md) | `LAYER_4_SERVICES.md` | Business logic, data access, cross-cutting concerns |
| 5 | [Background Processing](./LAYER_5_BACKGROUND.md) | `LAYER_5_BACKGROUND.md` | Job queues, workers, async image processing |
| 6 | [Client](./LAYER_6_CLIENT.md) | `LAYER_6_CLIENT.md` | Next.js frontend, state management, SSE handling |
| 7 | [Rendering & Templates](./LAYER_7_RENDERING.md) | `LAYER_7_RENDERING.md` | Nunjucks templates, section system, asset pipeline |

---

## Layer 3: Agent System (Deep Dive)

The Agent System is the core of the AI capabilities. These sub-documents provide detailed explanations of each pattern:

| # | Topic | File | Description |
|---|-------|------|-------------|
| 3.1 | [ReAct Loop](./LAYER_3.1_REACT_LOOP.md) | `LAYER_3.1_REACT_LOOP.md` | Orchestrator, Think→Act→Observe cycle, step limits |
| 3.2 | [Tools](./LAYER_3.2_TOOLS.md) | `LAYER_3.2_TOOLS.md` | Tool anatomy, categories, Zod schemas, composition |
| 3.3 | [Working Memory](./LAYER_3.3_WORKING_MEMORY.md) | `LAYER_3.3_WORKING_MEMORY.md` | Entity tracking, sliding window, reference resolution |
| 3.4 | [Prompts](./LAYER_3.4_PROMPTS.md) | `LAYER_3.4_PROMPTS.md` | System prompt structure, XML/Handlebars, injection |
| 3.5 | [Human-in-the-Loop](./LAYER_3.5_HITL.md) | `LAYER_3.5_HITL.md` | Approval queue, confirmation patterns, dangerous ops |
| 3.6 | [Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md) | `LAYER_3.6_ERROR_RECOVERY.md` | Retry logic, backoff, stuck detection, degradation |
| 3.7 | [Streaming](./LAYER_3.7_STREAMING.md) | `LAYER_3.7_STREAMING.md` | SSE events, real-time feedback, frontend parsing |
| 3.8 | [Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) | `LAYER_3.8_CONTEXT_INJECTION.md` | AgentContext, multi-tenant, tracing |

### Agent System Reading Order

**Getting Started:**
1. [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Understand how the agent executes
2. [3.2 Tools](./LAYER_3.2_TOOLS.md) - How capabilities are defined

**Deep Understanding:**
3. [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - How behavior is guided
4. [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) - How context is maintained

**Advanced Patterns:**
5. [3.5 HITL](./LAYER_3.5_HITL.md) - Human oversight
6. [3.6 Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md) - Handling failures
7. [3.7 Streaming](./LAYER_3.7_STREAMING.md) - Real-time communication
8. [3.8 Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) - Dependency management

---

## Quick Reference

### Tech Stack

| Component | Technology |
|-----------|------------|
| Server | Express.js (port 8787) |
| Database | SQLite + Drizzle ORM (WAL mode) |
| Vector Store | LanceDB |
| Queue | BullMQ + Redis |
| Agent | AI SDK v6 + OpenRouter (GPT-4o-mini) |
| Templates | Nunjucks |
| Frontend | Next.js 16 + React 19 (port 3000) |
| State | Zustand |
| UI | Radix UI + Tailwind CSS |

### Process Architecture

```
pnpm start
├── dev:server  → Express API          :8787
├── dev:preview → Template preview     :4000
├── dev:web     → Next.js frontend     :3000
└── dev:worker  → Image processor      (background)

External:
└── Redis       → Job queue            :6379
```

### Key Directory Structure

```
server/
├── agent/           # ReAct orchestrator
├── db/              # Schema, migrations
├── middleware/      # Express middleware
├── prompts/         # System prompts (Handlebars)
├── queues/          # BullMQ job definitions
├── routes/          # API endpoints
├── services/        # Business logic
├── templates/       # Nunjucks templates
├── tools/           # Agent tools (21 total)
├── utils/           # Shared utilities
└── workers/         # Background processors

app/
├── assistant/       # Chat UI (main interface)
│   ├── _components/ # React components
│   ├── _hooks/      # Custom hooks
│   └── _stores/     # Zustand stores
├── api/             # Next.js API routes
└── components/      # Shared UI components

scripts/
├── seed.ts          # Demo data
├── reset-*.ts       # Cleanup utilities
└── start-*.ts       # Service management
```

---

## How to Navigate

1. **New to the codebase?** → Start with [Layer 1: Server Core](./LAYER_1_SERVER_CORE.md)
2. **Working on agent features?** → See [Layer 3: Agent System](./LAYER_3_AGENT.md)
3. **Adding new tools?** → [Layer 3](./LAYER_3_AGENT.md) + [Layer 4: Services](./LAYER_4_SERVICES.md)
4. **Frontend changes?** → [Layer 6: Client](./LAYER_6_CLIENT.md)
5. **Template/section work?** → [Layer 7: Rendering](./LAYER_7_RENDERING.md)
6. **Background jobs?** → [Layer 5: Background Processing](./LAYER_5_BACKGROUND.md)

---

## Cross-Layer Integration Points

| From | To | Integration |
|------|----|-------------|
| Client | Agent | SSE stream via `/v1/agent/stream` |
| Agent | Services | Tool execution via `AgentContext` |
| Agent | Working Memory | Entity extraction between steps |
| Services | Database | Drizzle ORM queries |
| Services | Vector Store | LanceDB embeddings |
| Routes | Background | BullMQ job dispatch |
| Worker | Services | Image metadata/variant storage |
| Rendering | Database | Page/section data for templates |

---

## Status

| Layer | Status | Last Updated |
|-------|--------|--------------|
| Server Core | ✅ Current | 2025-11 |
| Database | ✅ Current | 2025-11 |
| Agent System | ✅ Current | 2025-11 |
| Services | ✅ Current | 2025-11 |
| Background | ✅ Current | 2025-11 |
| Client | ✅ Current | 2025-11 |
| Rendering | ✅ Current | 2025-11 |

---

*For deep dives into specific concepts, see the [Knowledge Base](/docs/knowledge-base/).*
