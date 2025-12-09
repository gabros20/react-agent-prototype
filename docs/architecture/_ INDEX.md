# Architecture Documentation Index

> **ReAct AI Agent CMS** - Full-stack TypeScript architecture overview
> **Updated**: 2025-12-03

This index provides a high-level view of the system's major architectural layers. Each layer document is self-contained but references related layers where integration occurs.

---

## AI SDK 6 Migration Summary

The codebase was migrated to **AI SDK v6 native patterns** in commit `1e1963e`. Key changes:

| Component | Before | After |
|-----------|--------|-------|
| Agent Loop | Custom `generateText` + while loop | Native `ToolLoopAgent` class (singleton) |
| Call Options | Manual context injection | Type-safe `callOptionsSchema` via Zod |
| Instructions | Static system prompt | Dynamic via `prepareCall` hook |
| Stop Conditions | Manual step counting | Native `stopWhen` array (OR logic) |
| Context Trimming | Manual message slicing | Native `prepareStep` hook |
| Retry Logic | Custom `executeWithRetry` | Native `maxRetries: 2` |
| HITL | `confirmed` flag only | Confirmed flag + conversational pattern |
| Checkpoints | Every 3 steps (dead code) | Removed - messages at end only |
| Cost Tracking | None | Tokenizer + OpenRouter pricing + trace metrics |
| Debug Logging | Basic logs | 20+ trace entry types + conversation logs |
| Worker Events | None | Redis pub/sub → SSE real-time updates |

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  Next.js 16 • React 19 • Zustand • AI SDK UI Protocol           │
├─────────────────────────────────────────────────────────────────┤
│                      RENDERING LAYER                            │
│  Nunjucks Templates • Section Variants • Asset Pipeline         │
├─────────────────────────────────────────────────────────────────┤
│                        AGENT LAYER                              │
│  AI SDK 6 ToolLoopAgent • stopWhen • Confirmed Flag Pattern     │
├─────────────────────────────────────────────────────────────────┤
│                       SERVICES LAYER                            │
│  PageService • SessionService • ConversationLogService • Vector │
│  Tokenizer • OpenRouter Pricing • WorkerEventsService           │
├─────────────────────────────────────────────────────────────────┤
│                    BACKGROUND LAYER                             │
│  BullMQ • Redis • Image Worker • Redis Pub/Sub Events           │
├─────────────────────────────────────────────────────────────────┤
│                      DATABASE LAYER                             │
│  SQLite + Drizzle ORM • LanceDB Vector Store                    │
├─────────────────────────────────────────────────────────────────┤
│                      SERVER CORE                                │
│  Express.js • Dependency Injection • Middleware • Routes        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer Documentation

| #   | Layer                                            | File                     | Description                                         |
| --- | ------------------------------------------------ | ------------------------ | --------------------------------------------------- |
| 1   | [Server Core](./LAYER_1_SERVER_CORE.md)          | `LAYER_1_SERVER_CORE.md` | Express setup, DI container, routing, middleware    |
| 2   | [Database & Persistence](./LAYER_2_DATABASE.md)  | `LAYER_2_DATABASE.md`    | SQLite/Drizzle schema, LanceDB vectors, migrations  |
| 3   | [Agent System](./LAYER_3_AGENT.md)               | `LAYER_3_AGENT.md`       | ReAct loop, tool registry, working memory, HITL     |
| 4   | [Services](./LAYER_4_SERVICES.md)                | `LAYER_4_SERVICES.md`    | Business logic, data access, cross-cutting concerns |
| 5   | [Background Processing](./LAYER_5_BACKGROUND.md) | `LAYER_5_BACKGROUND.md`  | Job queues, workers, async image processing         |
| 6   | [Client](./LAYER_6_CLIENT.md)                    | `LAYER_6_CLIENT.md`      | Next.js frontend, state management, SSE handling    |
| 7   | [Rendering & Templates](./LAYER_7_RENDERING.md)  | `LAYER_7_RENDERING.md`   | Nunjucks templates, section system, asset pipeline  |

---

## Layer 1: Server Core (Deep Dive)

The Server Core layer handles Express.js initialization, middleware configuration, routing, and request handling. These sub-documents explain each pattern in detail:

| #   | Topic                                                 | File                             | Description                                      |
| --- | ----------------------------------------------------- | -------------------------------- | ------------------------------------------------ |
| 1.1 | [Express Bootstrap](./LAYER_1.1_EXPRESS_BOOTSTRAP.md) | `LAYER_1.1_EXPRESS_BOOTSTRAP.md` | Async startup, environment config, health checks |
| 1.2 | [Service Container](./LAYER_1.2_SERVICE_CONTAINER.md) | `LAYER_1.2_SERVICE_CONTAINER.md` | Singleton DI pattern, service initialization     |
| 1.3 | [Middleware Stack](./LAYER_1.3_MIDDLEWARE.md)         | `LAYER_1.3_MIDDLEWARE.md`        | CORS, body parsing, logging, execution order     |
| 1.4 | [Error Handling](./LAYER_1.4_ERROR_HANDLING.md)       | `LAYER_1.4_ERROR_HANDLING.md`    | Error normalization, API response format         |
| 1.5 | [Route Architecture](./LAYER_1.5_ROUTES.md)           | `LAYER_1.5_ROUTES.md`            | Router factories, URL patterns, Zod validation   |
| 1.6 | [File Upload](./LAYER_1.6_FILE_UPLOAD.md)             | `LAYER_1.6_FILE_UPLOAD.md`       | Multer config, validation, rate limiting         |

### Server Core Reading Order

**Getting Started:**

1. [1.1 Express Bootstrap](./LAYER_1.1_EXPRESS_BOOTSTRAP.md) - Server initialization
2. [1.2 Service Container](./LAYER_1.2_SERVICE_CONTAINER.md) - Dependency injection

**Request Pipeline:**

3. [1.3 Middleware Stack](./LAYER_1.3_MIDDLEWARE.md) - Request processing order
4. [1.5 Route Architecture](./LAYER_1.5_ROUTES.md) - Endpoint patterns

**Specialized Topics:**

5. [1.4 Error Handling](./LAYER_1.4_ERROR_HANDLING.md) - Error normalization
6. [1.6 File Upload](./LAYER_1.6_FILE_UPLOAD.md) - File handling and security

---

## Layer 2: Database & Persistence (Deep Dive)

The Database layer handles all data storage and retrieval. These sub-documents explain each pattern in detail:

| #   | Topic                                               | File                            | Description                                        |
| --- | --------------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| 2.1 | [Drizzle ORM](./LAYER_2.1_DRIZZLE_ORM.md)           | `LAYER_2.1_DRIZZLE_ORM.md`      | Schema definitions, type inference, Zod validation |
| 2.2 | [Entity Hierarchy](./LAYER_2.2_ENTITY_HIERARCHY.md) | `LAYER_2.2_ENTITY_HIERARCHY.md` | Multi-tenant model, relations, cascade rules       |
| 2.3 | [Content Model](./LAYER_2.3_CONTENT_MODEL.md)       | `LAYER_2.3_CONTENT_MODEL.md`    | Page-Section-Content architecture, localization    |
| 2.4 | [Image Storage](./LAYER_2.4_IMAGE_STORAGE.md)       | `LAYER_2.4_IMAGE_STORAGE.md`    | SHA256 dedup, variants, inline JSON pattern        |
| 2.5 | [Vector Storage](./LAYER_2.5_VECTOR_STORAGE.md)     | `LAYER_2.5_VECTOR_STORAGE.md`   | LanceDB, embeddings, semantic search               |
| 2.6 | [Migrations](./LAYER_2.6_MIGRATIONS.md)             | `LAYER_2.6_MIGRATIONS.md`       | Drizzle Kit workflow, seeding, reset scripts       |
| 2.7 | [Connection](./LAYER_2.7_CONNECTION.md)             | `LAYER_2.7_CONNECTION.md`       | WAL mode, pragmas, lifecycle management            |

### Database Reading Order

**Getting Started:**

1. [2.7 Connection](./LAYER_2.7_CONNECTION.md) - How SQLite is configured
2. [2.1 Drizzle ORM](./LAYER_2.1_DRIZZLE_ORM.md) - Schema and query patterns

**Understanding the Data Model:** 3. [2.2 Entity Hierarchy](./LAYER_2.2_ENTITY_HIERARCHY.md) - Multi-tenant structure 4. [2.3 Content Model](./LAYER_2.3_CONTENT_MODEL.md) - Pages and sections

**Advanced Features:** 5. [2.4 Image Storage](./LAYER_2.4_IMAGE_STORAGE.md) - Image handling 6. [2.5 Vector Storage](./LAYER_2.5_VECTOR_STORAGE.md) - Semantic search 7. [2.6 Migrations](./LAYER_2.6_MIGRATIONS.md) - Schema evolution

---

## Layer 3: Agent System (Deep Dive)

The Agent System is the core of the AI capabilities. These sub-documents provide detailed explanations of each pattern:

| #   | Topic                                                 | File                             | Description                                           |
| --- | ----------------------------------------------------- | -------------------------------- | ----------------------------------------------------- |
| 3.1 | [ReAct Loop](./LAYER_3.1_REACT_LOOP.md)               | `LAYER_3.1_REACT_LOOP.md`        | Orchestrator, Think→Act→Observe cycle, step limits    |
| 3.2 | [Tools](./LAYER_3.2_TOOLS.md)                         | `LAYER_3.2_TOOLS.md`             | Tool anatomy, categories, Zod schemas, composition    |
| 3.3 | [Working Memory](./LAYER_3.3_WORKING_MEMORY.md)       | `LAYER_3.3_WORKING_MEMORY.md`    | Entity tracking, sliding window, reference resolution |
| 3.4 | [Prompts](./LAYER_3.4_PROMPTS.md)                     | `LAYER_3.4_PROMPTS.md`           | System prompt structure, XML/Handlebars, injection    |
| 3.5 | [Human-in-the-Loop](./LAYER_3.5_HITL.md)              | `LAYER_3.5_HITL.md`              | Confirmed flag pattern, conversational confirmations  |
| 3.6 | [Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md)       | `LAYER_3.6_ERROR_RECOVERY.md`    | Retry logic, backoff, stuck detection, degradation    |
| 3.7 | [Streaming](./LAYER_3.7_STREAMING.md)                 | `LAYER_3.7_STREAMING.md`         | SSE events, real-time feedback, frontend parsing      |
| 3.8 | [Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) | `LAYER_3.8_CONTEXT_INJECTION.md` | AgentContext, multi-tenant, tracing                   |

### Agent System Reading Order

**Getting Started:**

1. [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - Understand how the agent executes
2. [3.2 Tools](./LAYER_3.2_TOOLS.md) - How capabilities are defined

**Deep Understanding:** 3. [3.4 Prompts](./LAYER_3.4_PROMPTS.md) - How behavior is guided 4. [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) - How context is maintained

**Advanced Patterns:** 5. [3.5 HITL](./LAYER_3.5_HITL.md) - Human oversight 6. [3.6 Error Recovery](./LAYER_3.6_ERROR_RECOVERY.md) - Handling failures 7. [3.7 Streaming](./LAYER_3.7_STREAMING.md) - Real-time communication 8. [3.8 Context Injection](./LAYER_3.8_CONTEXT_INJECTION.md) - Dependency management

---

## Layer 4: Services (Deep Dive)

The Services layer contains all business logic and data access. These sub-documents explain each service pattern in detail:

| #   | Topic                                                   | File                              | Description                                           |
| --- | ------------------------------------------------------- | --------------------------------- | ----------------------------------------------------- |
| 4.1 | [CMS Services](./LAYER_4.1_CMS_SERVICES.md)             | `LAYER_4.1_CMS_SERVICES.md`       | PageService, SectionService, EntryService CRUD        |
| 4.2 | [Session Management](./LAYER_4.2_SESSION_MANAGEMENT.md) | `LAYER_4.2_SESSION_MANAGEMENT.md` | Chat persistence, AI SDK checkpointing                |
| 4.3 | [Vector Index](./LAYER_4.3_VECTOR_INDEX.md)             | `LAYER_4.3_VECTOR_INDEX.md`       | LanceDB operations, embeddings, semantic search       |
| 4.4 | [Image Processing](./LAYER_4.4_IMAGE_PROCESSING.md)     | `LAYER_4.4_IMAGE_PROCESSING.md`   | Upload pipeline, deduplication, async jobs            |
| 4.5 | [Renderer](./LAYER_4.5_RENDERER.md)                     | `LAYER_4.5_RENDERER.md`           | Nunjucks templates, page/post rendering               |
| 4.6 | [Working Memory](./LAYER_4.6_WORKING_MEMORY.md)         | `LAYER_4.6_WORKING_MEMORY.md`     | Sliding window entity tracking, context serialization |

### Services Reading Order

**Getting Started:**

1. [4.1 CMS Services](./LAYER_4.1_CMS_SERVICES.md) - Core CRUD operations
2. [4.2 Session Management](./LAYER_4.2_SESSION_MANAGEMENT.md) - Chat persistence

**Search & Content:**

3. [4.3 Vector Index](./LAYER_4.3_VECTOR_INDEX.md) - Semantic search
4. [4.5 Renderer](./LAYER_4.5_RENDERER.md) - Template rendering

**Advanced Features:**

5. [4.4 Image Processing](./LAYER_4.4_IMAGE_PROCESSING.md) - Image upload pipeline
6. [4.6 Working Memory](./LAYER_4.6_WORKING_MEMORY.md) - Agent context tracking

---

## Layer 5: Background Processing (Deep Dive)

The Background Processing layer handles async jobs via BullMQ and Redis. These sub-documents explain each component in detail:

| #   | Topic                                                    | File                            | Description                                           |
| --- | -------------------------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| 5.1 | [Redis Connection](./LAYER_5.1_REDIS_CONNECTION.md)      | `LAYER_5.1_REDIS_CONNECTION.md` | IORedis client config, connection events, health      |
| 5.2 | [Queue Definition](./LAYER_5.2_QUEUE_DEFINITION.md)      | `LAYER_5.2_QUEUE_DEFINITION.md` | BullMQ queue setup, job options, QueueEvents          |
| 5.3 | [Worker Lifecycle](./LAYER_5.3_WORKER_LIFECYCLE.md)      | `LAYER_5.3_WORKER_LIFECYCLE.md` | Worker startup, concurrency, graceful shutdown        |
| 5.4 | [Job Processors](./LAYER_5.4_JOB_PROCESSORS.md)          | `LAYER_5.4_JOB_PROCESSORS.md`   | Metadata generation, variant creation, embeddings     |
| 5.5 | [Retry & Error Handling](./LAYER_5.5_RETRY_AND_ERROR.md) | `LAYER_5.5_RETRY_AND_ERROR.md`  | Exponential backoff, failure handling, status updates |

### Background Processing Reading Order

**Getting Started:**

1. [5.1 Redis Connection](./LAYER_5.1_REDIS_CONNECTION.md) - Redis client setup
2. [5.2 Queue Definition](./LAYER_5.2_QUEUE_DEFINITION.md) - Queue configuration

**Worker & Jobs:**

3. [5.3 Worker Lifecycle](./LAYER_5.3_WORKER_LIFECYCLE.md) - Worker management
4. [5.4 Job Processors](./LAYER_5.4_JOB_PROCESSORS.md) - Processing implementations

**Reliability:**

5. [5.5 Retry & Error Handling](./LAYER_5.5_RETRY_AND_ERROR.md) - Error recovery patterns

---

## Layer 6: Client (Deep Dive)

The Client layer handles the Next.js frontend, React components, Zustand state management, and SSE streaming. These sub-documents explain each component in detail:

| #   | Topic                                               | File                            | Description                                           |
| --- | --------------------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| 6.1 | [State Management](./LAYER_6.1_STATE_MANAGEMENT.md) | `LAYER_6.1_STATE_MANAGEMENT.md` | Zustand stores, persistence, cross-store coordination |
| 6.2 | [SSE Streaming](./LAYER_6.2_SSE_STREAMING.md)       | `LAYER_6.2_SSE_STREAMING.md`    | Event parsing, buffer handling, store dispatch        |
| 6.3 | [Session UI](./LAYER_6.3_SESSION_UI.md)             | `LAYER_6.3_SESSION_UI.md`       | Session sidebar, switching, clear history             |
| 6.4 | [Chat Components](./LAYER_6.4_CHAT_COMPONENTS.md)   | `LAYER_6.4_CHAT_COMPONENTS.md`  | Message display, input form, markdown rendering       |
| 6.5 | [HITL UI](./LAYER_6.5_HITL_UI.md)                   | `LAYER_6.5_HITL_UI.md`          | Confirmation visualization, approval patterns         |
| 6.6 | [Trace Observability](./LAYER_6.6_TRACE_OBSERVABILITY.md) | `LAYER_6.6_TRACE_OBSERVABILITY.md` | Debug panel, trace entries, conversation logs |

### Client Reading Order

**Getting Started:**

1. [6.1 State Management](./LAYER_6.1_STATE_MANAGEMENT.md) - Zustand store architecture
2. [6.2 SSE Streaming](./LAYER_6.2_SSE_STREAMING.md) - Backend communication

**UI Components:**

3. [6.4 Chat Components](./LAYER_6.4_CHAT_COMPONENTS.md) - Main chat interface
4. [6.3 Session UI](./LAYER_6.3_SESSION_UI.md) - Session management

**Advanced Features:**

5. [6.5 HITL UI](./LAYER_6.5_HITL_UI.md) - Confirmation visualization
6. [6.6 Trace Observability](./LAYER_6.6_TRACE_OBSERVABILITY.md) - Debug panel, conversation logs

---

## Layer 7: Rendering & Templates (Deep Dive)

The Rendering layer handles server-side HTML generation using Nunjucks templates. These sub-documents explain each component in detail:

| #   | Topic                                                 | File                             | Description                                           |
| --- | ----------------------------------------------------- | -------------------------------- | ----------------------------------------------------- |
| 7.1 | [Nunjucks Engine](./LAYER_7.1_NUNJUCKS_ENGINE.md)     | `LAYER_7.1_NUNJUCKS_ENGINE.md`   | Environment config, custom filters, autoescape        |
| 7.2 | [Template Registry](./LAYER_7.2_TEMPLATE_REGISTRY.md) | `LAYER_7.2_TEMPLATE_REGISTRY.md` | Auto-discovery, variant resolution, fallback handling |
| 7.3 | [Page Rendering](./LAYER_7.3_PAGE_RENDERING.md)       | `LAYER_7.3_PAGE_RENDERING.md`    | Layout composition, section iteration, global context |
| 7.4 | [Section Templates](./LAYER_7.4_SECTION_TEMPLATES.md) | `LAYER_7.4_SECTION_TEMPLATES.md` | Section anatomy, content binding, BEM styling         |
| 7.5 | [Post Rendering](./LAYER_7.5_POST_RENDERING.md)       | `LAYER_7.5_POST_RENDERING.md`    | Blog posts, list views, collection routing            |
| 7.6 | [Preview Server](./LAYER_7.6_PREVIEW_SERVER.md)       | `LAYER_7.6_PREVIEW_SERVER.md`    | Express server, static assets, health endpoint        |

### Rendering Reading Order

**Getting Started:**

1. [7.1 Nunjucks Engine](./LAYER_7.1_NUNJUCKS_ENGINE.md) - Template engine setup
2. [7.2 Template Registry](./LAYER_7.2_TEMPLATE_REGISTRY.md) - Template discovery

**Core Flow:**

3. [7.3 Page Rendering](./LAYER_7.3_PAGE_RENDERING.md) - How pages are assembled
4. [7.5 Post Rendering](./LAYER_7.5_POST_RENDERING.md) - Blog/collection rendering

**Details:**

5. [7.4 Section Templates](./LAYER_7.4_SECTION_TEMPLATES.md) - Template anatomy
6. [7.6 Preview Server](./LAYER_7.6_PREVIEW_SERVER.md) - Development server

---

## Quick Reference

### Tech Stack

| Component    | Technology                              |
| ------------ | --------------------------------------- |
| Server       | Express.js (port 8787)                  |
| Database     | SQLite + Drizzle ORM (WAL mode)         |
| Vector Store | LanceDB                                 |
| Queue        | BullMQ + Redis                          |
| Agent        | AI SDK v6 + OpenRouter (GPT-4o-mini)    |
| Tokenizer    | js-tiktoken                             |
| Pricing      | OpenRouter pricing service              |
| Templates    | Nunjucks                                |
| Frontend     | Next.js 16 + React 19 (port 3000)       |
| State        | Zustand                                 |
| UI           | Radix UI + Tailwind CSS                 |

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
├── agent/           # CMS Agent module (AI SDK 6)
│   ├── cms-agent.ts     # ToolLoopAgent singleton
│   └── system-prompt.ts # Prompt compilation
├── db/              # Schema, migrations
├── middleware/      # Express middleware
├── prompts/         # XML prompts
│   └── core/            # agent.xml (~1400 tokens)
├── queues/          # BullMQ job definitions
├── routes/          # API endpoints
├── services/        # Business logic
│   ├── conversation-log-service.ts # Debug log persistence
│   ├── openrouter-pricing.ts       # Cost calculation
│   ├── worker-events.service.ts    # Redis pub/sub
│   └── ...
├── templates/       # Nunjucks templates
├── tools/           # Agent tools + instructions
│   └── instructions/    # Per-tool protocols
├── utils/           # Shared utilities
└── workers/         # Background processors

lib/
├── api/             # Frontend API client layer
├── debug-logger/    # Debug logging abstraction
├── tokenizer.ts     # Token counting
└── ...

app/
├── assistant/       # Chat UI (main interface)
│   ├── _components/ # React components (enhanced-debug panel)
│   ├── _hooks/      # Custom hooks (useAgent with AI SDK 6)
│   └── _stores/     # Zustand stores (chat, session, trace, models)
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

| From      | To             | Integration                       |
| --------- | -------------- | --------------------------------- |
| Client    | Agent          | SSE stream via `/v1/agent/stream` |
| Agent     | Services       | Tool execution via `AgentContext` |
| Agent     | Working Memory | Entity extraction between steps   |
| Services  | Database       | Drizzle ORM queries               |
| Services  | Vector Store   | LanceDB embeddings                |
| Routes    | Background     | BullMQ job dispatch               |
| Worker    | Redis          | Publish job events via pub/sub |
| Server    | Client         | Forward worker events via SSE |
| Agent     | ConversationLog | Save trace entries + metrics |
| Worker    | Services       | Image metadata/variant storage    |
| Rendering | Database       | Page/section data for templates   |

---

_For deep dives into specific concepts, see the [Knowledge Base](/docs/knowledge-base/)._
