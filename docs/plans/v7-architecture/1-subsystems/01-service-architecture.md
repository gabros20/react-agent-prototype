# Service Architecture

> **Summary**: The system is divided into 4 services: Agent Server (stateless AI runtime), Internal CMS Server (all persistent data), Third-Party CMS (optional website content), and Website Renderer. This separation enables horizontal scaling and CMS flexibility.
>
> **Prerequisites**: [00-overview.md](../00-overview.md)

## Overview

The architecture uses **4 services** with clear responsibilities:

| Service | Port | Purpose |
|---------|------|---------|
| **Agent Server** | 8787 | Stateless AI runtime, tool execution, agent orchestration |
| **Internal CMS Server** | 3001 | All persistent data (users, sessions, messages, todos) |
| **Third-Party CMS** | External | Optional - Contentful, Sanity for website content |
| **Website Renderer** | 3000 | Next.js frontend for published website |

---

## Service Responsibilities

### Agent Server (NestJS @ 8787)

**Role**: Stateless AI runtime

**Owns**:
- Event Bus (in-memory pub/sub)
- Session Orchestrator (lifecycle management)
- Session Processor (agent loop execution)
- Agent Factory (config loading/caching)
- Tool Registry (built-in + adapter + MCP tools)
- Hybrid Tool Search (BM25 + Vector)
- Background Jobs (BullMQ workers)
- Local Vector Store (LanceDB)

**Does NOT own**:
- Any persistent data
- User authentication state
- Session history

**Key Design**: All persistent data is stored in Internal CMS Server via HTTP calls. This allows horizontal scaling - any Agent Server instance can handle any request.

### Internal CMS Server (NestJS @ 3001)

**Role**: Single source of truth for all persistent data

**Always stores** (regardless of website CMS choice):
- Users & Authentication
- Sessions (parent/child hierarchy)
- Chat Messages
- Todos / Plans
- Token Usage & Metrics

**Optionally stores** (if user chooses internal CMS):
- Pages
- Sections
- Posts
- Media Library

**Key Design**: Even if users connect Contentful or Sanity for website content, they still have an account here. This enables:
- Consistent user management
- Centralized observability
- Agent data persistence independent of CMS choice

### Third-Party CMS (External)

**Role**: Optional alternative for website content

**Supported**:
- Contentful
- Sanity
- (Future: Strapi, WordPress, etc.)

**Contains**:
- Website pages, posts, assets only
- NO agent data

**Integration**:
- Agent Server connects via adapters
- Webhooks notify Agent Server of content changes

### Website Renderer (Next.js @ 3000)

**Role**: Public-facing website

**Receives**:
- Webhooks from Internal CMS Server
- Webhooks from Third-Party CMS

**Renders**:
- Published pages and posts
- Static generation + ISR

---

## Data Flow Patterns

### Pattern 1: User Sends Message

```
Client → Agent Server → Internal CMS (persist message)
                     → Agent Processor (run loop)
                     → Tool Registry (get tools)
                     → Adapter (execute CMS operations)
                     → Internal CMS (persist result)
         Client ← Agent Server (stream response via SSE)
```

### Pattern 2: Content Change Webhook

```
CMS (Internal or External) → Agent Server Webhook Receiver
                          → BullMQ Queue
                          → Worker (generate embeddings)
                          → LanceDB (store vectors)
```

### Pattern 3: Website Publish

```
Agent → CMS (create/update page)
CMS → Website Renderer (webhook)
Website Renderer → regenerate static page
```

---

## Inter-Service Communication

| From | To | Protocol | Purpose |
|------|-----|----------|---------|
| Client | Agent Server | REST + SSE | Chat, streaming responses |
| Agent Server | Internal CMS | HTTP | Persist sessions, messages, todos |
| Agent Server | Third-Party CMS | HTTP | Read/write website content |
| Internal CMS | Website Renderer | Webhook | Trigger rebuild |
| Third-Party CMS | Website Renderer | Webhook | Trigger rebuild |
| Third-Party CMS | Agent Server | Webhook | Content change notification |

---

## Scaling Considerations

### Agent Server Scaling

Because Agent Server is **stateless**:
- Multiple instances can run behind a load balancer
- No session affinity required
- Each request is independent

**Local state** (LanceDB, Redis) considerations:
- LanceDB: Can be shared via network mount or replicated
- Redis: Single instance or Redis Cluster for HA

### Internal CMS Server Scaling

**Database options**:
- SQLite: Development, single-node production
- PostgreSQL: Multi-node production with read replicas

**Scaling pattern**: Read replicas for heavy read loads, single write primary.

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Agent Server is stateless | Enables horizontal scaling, any instance can handle any request |
| Internal CMS stores all agent data | Single source of truth regardless of website CMS choice |
| Adapters bundle everything | Tools, prompts, agents, schemas co-located for portability |
| Workers in Agent Server | Third-party CMSs don't allow custom workers |

---

## Related Documents

- → [02-agent-server.md](02-agent-server.md) - Agent Server internals
- → [07-internal-cms.md](07-internal-cms.md) - Internal CMS data model
- → [05-adapter-layer.md](05-adapter-layer.md) - CMS adapter pattern
- ↗ [../4-appendices/appendix-c-docker.md](../4-appendices/appendix-c-docker.md) - Docker setup
