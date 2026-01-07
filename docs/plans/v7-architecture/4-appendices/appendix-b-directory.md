# Appendix B: Directory Structure

> **Summary**: Complete monorepo structure for the V7 architecture.
>
> **Prerequisites**: [../00-overview.md](../00-overview.md)

## Complete Monorepo Structure

```
monorepo/
├── apps/
│   ├── agent-server/              # NestJS @ 8787
│   │   ├── src/
│   │   │   ├── core/
│   │   │   │   ├── event-bus/
│   │   │   │   │   ├── event-bus.service.ts
│   │   │   │   │   ├── event-types.ts
│   │   │   │   │   └── event-bus.module.ts
│   │   │   │   ├── session/
│   │   │   │   │   ├── session.orchestrator.ts
│   │   │   │   │   ├── session.processor.ts
│   │   │   │   │   ├── session.store.ts
│   │   │   │   │   ├── doom-loop.detector.ts
│   │   │   │   │   └── session.module.ts
│   │   │   │   └── agent/
│   │   │   │       ├── agent.factory.ts
│   │   │   │       ├── agent.config.ts
│   │   │   │       └── agent.module.ts
│   │   │   ├── memory/
│   │   │   │   ├── todo.service.ts
│   │   │   │   ├── compaction.service.ts
│   │   │   │   └── memory.module.ts
│   │   │   ├── tools/
│   │   │   │   ├── _registry/
│   │   │   │   │   ├── tool-registry.service.ts
│   │   │   │   │   ├── mcp-loader.ts
│   │   │   │   │   └── tool-types.ts
│   │   │   │   ├── _search/
│   │   │   │   │   ├── hybrid-search.service.ts
│   │   │   │   │   ├── bm25-search.ts
│   │   │   │   │   └── vector-search.ts
│   │   │   │   ├── _loaders/
│   │   │   │   │   └── dynamic-loader.ts
│   │   │   │   └── shared/
│   │   │   │       ├── web_search/
│   │   │   │       │   ├── web_search.metadata.ts
│   │   │   │       │   ├── web_search.tool.ts
│   │   │   │       │   └── index.ts
│   │   │   │       ├── vector_search/
│   │   │   │       ├── spawn_agent/
│   │   │   │       ├── todowrite/
│   │   │   │       └── todoread/
│   │   │   ├── adapters/
│   │   │   │   ├── adapter.interface.ts
│   │   │   │   ├── adapter.registry.ts
│   │   │   │   ├── internal/
│   │   │   │   │   ├── tools/
│   │   │   │   │   │   ├── list-pages.tool.ts
│   │   │   │   │   │   ├── create-page.tool.ts
│   │   │   │   │   │   ├── update-section.tool.ts
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── prompts/
│   │   │   │   │   │   ├── page-builder.prompt.txt
│   │   │   │   │   │   ├── post-writer.prompt.txt
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── 2-agents/
│   │   │   │   │   │   ├── page-specialist.agent.ts
│   │   │   │   │   │   ├── post-specialist.agent.ts
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── schemas/
│   │   │   │   │   │   ├── page.schema.ts
│   │   │   │   │   │   ├── section.schema.ts
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── auth.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── contentful/
│   │   │   │   │   ├── tools/
│   │   │   │   │   ├── prompts/
│   │   │   │   │   ├── 2-agents/
│   │   │   │   │   ├── schemas/
│   │   │   │   │   ├── auth.ts
│   │   │   │   │   ├── webhook-parser.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── sanity/
│   │   │   │   │   └── ...
│   │   │   │   └── adapters.module.ts
│   │   │   ├── 2-agents/
│   │   │   │   └── shared/
│   │   │   │       ├── router.agent.ts
│   │   │   │       ├── orchestrator.agent.ts
│   │   │   │       ├── qa-specialist.agent.ts
│   │   │   │       └── research-specialist.agent.ts
│   │   │   ├── workers/
│   │   │   │   ├── media.worker.ts
│   │   │   │   └── content.worker.ts
│   │   │   ├── services/
│   │   │   │   ├── vector-store.service.ts
│   │   │   │   ├── queue.service.ts
│   │   │   │   └── sse.service.ts
│   │   │   └── api/
│   │   │       ├── agent.controller.ts
│   │   │       └── session.controller.ts
│   │   └── package.json
│   │
│   ├── cms-server/                # NestJS @ 3001
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── pages.controller.ts
│   │   │   │   └── pages.service.ts
│   │   │   ├── sections/
│   │   │   ├── posts/
│   │   │   ├── media/
│   │   │   │   ├── media.controller.ts
│   │   │   │   └── media.service.ts
│   │   │   └── templates/
│   │   └── package.json
│   │
│   ├── chat-ui/                   # Next.js Chat Interface
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   ├── approval-modal/
│   │   │   └── session-tree/
│   │   ├── hooks/
│   │   │   ├── use-agent.ts
│   │   │   └── use-sse.ts
│   │   └── package.json
│   │
│   └── website-renderer/          # Next.js @ 3000
│       └── ...
│
├── packages/
│   ├── shared-types/              # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── session.ts
│   │   │   ├── agent.ts
│   │   │   ├── tool.ts
│   │   │   ├── events.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── db-schema/                 # Shared Drizzle schema
│   │   ├── src/
│   │   │   └── schema.ts
│   │   └── package.json
│   │
│   ├── config/                    # Shared configs
│   │   ├── tsconfig.base.json
│   │   └── biome.json
│   │
│   └── cms-adapter-sdk/           # SDK for building adapters
│       └── ...
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── Dockerfile.agent-server
│   └── Dockerfile.cms-server
│
├── .env.example
├── .env
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── biome.json
```

---

## Package Dependencies

```
┌─────────────────────┐
│   shared-types      │
└─────────┬───────────┘
          │
          ├──────────────────────────────┐
          │                              │
┌─────────▼───────────┐      ┌───────────▼─────────┐
│   agent-server      │      │    cms-server       │
└─────────┬───────────┘      └───────────┬─────────┘
          │                              │
          │      ┌───────────────────────┘
          │      │
┌─────────▼──────▼────┐
│     db-schema       │
└─────────────────────┘
```

---

## Key Directories Explained

### `/apps/agent-server/src/core/`

Core runtime components:
- **event-bus/**: In-memory pub/sub for all events
- **session/**: Orchestrator, processor, doom loop detection
- **agent/**: Factory for loading agent configs

### `/apps/agent-server/src/tools/`

Tool infrastructure:
- **_registry/**: Central tool registry, MCP loader
- **_search/**: Hybrid search (BM25 + vector)
- **_loaders/**: Dynamic loading from adapters
- **shared/**: Built-in tools (not CMS-specific)

### `/apps/agent-server/src/adapters/`

CMS adapter bundles:
- Each adapter folder contains tools, prompts, agents, schemas
- **internal/**: Our own CMS
- **contentful/**: Contentful integration
- **sanity/**: Sanity integration

### `/apps/agent-server/src/2-agents/shared/`

Shared agent configurations:
- Router, orchestrator
- CMS-agnostic specialists (qa, research)

### `/packages/`

Shared code across apps:
- **shared-types/**: TypeScript interfaces
- **db-schema/**: Drizzle ORM schema
- **config/**: Shared tsconfig, biome config

---

## Service Ports

| Service | Port | Description |
|---------|------|-------------|
| **website-renderer** | 3000 | Public website (Next.js) |
| **cms-server** | 3001 | Internal CMS API (NestJS) |
| **chat-ui** | 3002 | Agent chat interface (Next.js) |
| **agent-server** | 8787 | AI agent runtime (NestJS) |
| **PostgreSQL** | 5432 | Database |
| **Redis** | 6379 | Job queue |

---

## Related Documents

- → [appendix-c-docker.md](appendix-c-docker.md) - Container configuration
- → [../3-implementation/15-implementation-stages.md](../3-implementation/15-implementation-stages.md) - Build order
