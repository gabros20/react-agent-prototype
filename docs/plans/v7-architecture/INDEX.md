# Multiservice Agent Architecture V7 — Documentation Index

> **Version**: V7 (Final Architecture)
> **Last Updated**: 2025-12-31
> **Status**: Production-Ready Specification

## Quick Start

| I need to... | Read this first |
|--------------|-----------------|
| Understand the whole system | [00-overview.md](00-overview.md) |
| Know where data is stored | [00-overview.md#22-data-storage-architecture](00-overview.md#22-data-storage-architecture) |
| Understand the 3-level agent model | [2-agents/08-agent-model.md](2-agents/08-agent-model.md) |
| See all 7 agent configs | [2-agents/09-agent-catalog.md](2-agents/09-agent-catalog.md) |
| Implement a new CMS adapter | [1-subsystems/05-adapter-layer.md](1-subsystems/05-adapter-layer.md) |
| Add a new tool | [1-subsystems/03-tool-subsystem.md](1-subsystems/03-tool-subsystem.md) |
| Set up the monorepo | [4-appendices/appendix-b-directory.md](4-appendices/appendix-b-directory.md) |
| Configure feature flags | [3-implementation/14-feature-flags.md](3-implementation/14-feature-flags.md) |

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│                   Next.js Chat UI / React Native                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST + SSE
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT SERVER (NestJS @ 8787)                 │
│                      Stateless AI Runtime                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │   Router    │→ │ Orchestrator │→ │     5 Specialists      │  │
│  │  (Level 1)  │  │  (Level 2)   │  │      (Level 3)         │  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
│                                                                  │
│  Tool Registry │ Memory/Compaction │ Adapters │ Background Jobs │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────────┐  ┌────────────────────────────────────┐
│  INTERNAL CMS SERVER     │  │      THIRD-PARTY CMS               │
│     (NestJS @ 3001)      │  │   (Contentful / Sanity / etc.)     │
│                          │  │                                    │
│  • Users & Auth          │  │  • Website Content Only            │
│  • Sessions              │  │                                    │
│  • Chat Messages         │  └────────────────────────────────────┘
│  • Todos/Plans           │
│  • Token Metrics         │
│  • Website Content (opt) │
└──────────────────────────┘
```

### Key Numbers
- **4 Services**: Agent Server, Internal CMS, Third-Party CMS, Website Renderer
- **3 Agent Levels**: Router → Orchestrator → Specialists (fixed depth)
- **7 Agents Total**: 1 router + 1 orchestrator + 5 specialists
- **5 Specialists**: page, post, research, image, qa

---

## Document Map

```
v7-architecture/
│
├── INDEX.md ←─────────────────────── YOU ARE HERE
│   └── Navigation, quick reference, system overview
│
├── 00-overview.md ················· COMPLETE SYSTEM UNDERSTANDING
│   ├── Executive summary
│   ├── All Mermaid diagrams (4 diagrams)
│   ├── V6 → V7 changes table
│   └── Tokens: ~3,500 | Read: 10 min
│
├── 1-subsystems/ ···················· INFRASTRUCTURE LAYER
│   │
│   ├── 01-service-architecture.md · 4-service separation
│   │   ├── Service responsibilities
│   │   ├── Data flow patterns
│   │   └── Tokens: ~2,000
│   │
│   ├── 02-agent-server.md ········· Stateless runtime internals
│   │   ├── Core runtime components
│   │   ├── Session & memory services
│   │   ├── Local services (LanceDB, Redis)
│   │   └── Tokens: ~2,500
│   │
│   ├── 03-tool-subsystem.md ······· Tool registry & search
│   │   ├── Hybrid search (semantic + keyword)
│   │   ├── Dynamic tool loading
│   │   ├── Tool schemas & validation
│   │   ├── MCP Client support
│   │   └── Tokens: ~4,000
│   │
│   ├── 04-memory-subsystem.md ····· Context management
│   │   ├── Provider-anchored compaction
│   │   ├── Todo list (OpenCode-style)
│   │   ├── Token counting strategy
│   │   └── Tokens: ~2,500
│   │
│   ├── 05-adapter-layer.md ········ CMS adapter pattern
│   │   ├── Adapter bundle structure
│   │   ├── Internal vs third-party adapters
│   │   ├── Adding new CMS support
│   │   └── Tokens: ~3,500
│   │
│   ├── 06-background-jobs.md ······ Async processing
│   │   ├── BullMQ configuration
│   │   ├── Media & content workers
│   │   ├── Webhook flow
│   │   └── Tokens: ~2,000
│   │
│   └── 07-internal-cms.md ········· Persistence layer
│       ├── PostgreSQL/SQLite schema
│       ├── What's stored where
│       ├── Session/message storage
│       └── Tokens: ~2,000
│
├── 2-agents/ ························ MULTI-AGENT ARCHITECTURE
│   │
│   ├── 08-agent-model.md ·········· Core agent concepts
│   │   ├── Router/Orchestrator/Specialist model
│   │   ├── Why ONE orchestrator
│   │   ├── Context modes (fresh/inherited/selective)
│   │   ├── Agent behavior patterns
│   │   └── Tokens: ~3,000
│   │
│   ├── 09-agent-catalog.md ········ All 7 agent configurations
│   │   ├── Router config + prompt
│   │   ├── Orchestrator config + prompt
│   │   ├── 5 specialist configs + prompts
│   │   └── Tokens: ~5,500
│   │
│   ├── 10-spawning-flow.md ········ Session hierarchy
│   │   ├── Parent/child sessions
│   │   ├── Depth enforcement (max 3)
│   │   ├── Result aggregation
│   │   ├── Execution flow diagrams
│   │   └── Tokens: ~3,000
│   │
│   └── 11-hitl-integration.md ····· Human-in-the-loop
│       ├── Approval patterns
│       ├── Destructive operation handling
│       ├── Permission levels
│       └── Tokens: ~1,500
│
├── 3-implementation/ ················ BUILD & DEPLOY
│   │
│   ├── 12-session-processor.md ···· Core processing loop
│   │   ├── Error handling strategy
│   │   ├── Doom loop detection
│   │   ├── Tool name repair
│   │   ├── AI SDK 6 integration
│   │   ├── Full flow diagram
│   │   └── Tokens: ~5,000
│   │
│   ├── 13-event-bus.md ············ Event definitions
│   │   ├── Session events
│   │   ├── Agent events
│   │   ├── Tool events
│   │   ├── Approval events
│   │   └── Tokens: ~1,500
│   │
│   ├── 14-feature-flags.md ········ Incremental rollout
│   │   ├── SystemConfig interface
│   │   ├── MVP preset
│   │   ├── Full production preset
│   │   ├── Emergency rollback preset
│   │   └── Tokens: ~2,000
│   │
│   └── 15-implementation-stages.md  8-week plan
│       ├── Stage 1-8 breakdown
│       ├── Week-by-week deliverables
│       └── Tokens: ~1,500
│
└── 4-appendices/ ···················· REFERENCE MATERIAL
    │
    ├── appendix-a-schemas.md ······ TypeScript interfaces
    │   ├── AgentConfig (complete)
    │   ├── SessionConfig
    │   ├── ToolDefinition
    │   ├── All event types
    │   └── Tokens: ~4,500
    │
    ├── appendix-b-directory.md ···· File structure
    │   ├── Complete monorepo tree
    │   ├── Package organization
    │   ├── Shared packages
    │   └── Tokens: ~3,000
    │
    ├── appendix-c-docker.md ······· Container setup
    │   ├── docker-compose.yml
    │   ├── Environment variables
    │   ├── Service ports
    │   ├── Production Dockerfiles
    │   └── Tokens: ~2,500
    │
    └── appendix-d-changelog.md ···· Version history
        ├── V5 → V6 changes
        ├── V6 → V7 changes
        ├── Design decisions log
        └── Tokens: ~1,500
```

---

## Cross-Reference Guide

### Subsystem Dependencies
```
Tool Subsystem ──────→ Adapter Layer (tools come from adapters)
       │
       └──────────────→ Memory Subsystem (context for tool selection)

Agent Server ─────────→ Internal CMS (all persistent data)
       │
       └──────────────→ Adapters (CMS-specific operations)

Session Processor ────→ Agent Factory (creates agent instances)
       │
       ├──────────────→ Tool Registry (provides tools)
       │
       └──────────────→ Memory/Compaction (manages context)
```

### Reading Paths

**Path A: "I'm building this"**
1. 00-overview.md
2. 4-appendices/appendix-b-directory.md
3. 3-implementation/15-implementation-stages.md
4. Then: subsystem docs as needed

**Path B: "I'm adding a CMS adapter"**
1. 00-overview.md (data storage section)
2. 1-subsystems/05-adapter-layer.md
3. 1-subsystems/03-tool-subsystem.md
4. 4-appendices/appendix-a-schemas.md#tooldefinition

**Path C: "I'm debugging agent behavior"**
1. 2-agents/08-agent-model.md
2. 3-implementation/12-session-processor.md
3. 2-agents/10-spawning-flow.md
4. 3-implementation/13-event-bus.md

**Path D: "I'm configuring for production"**
1. 3-implementation/14-feature-flags.md
2. 4-appendices/appendix-c-docker.md
3. 1-subsystems/06-background-jobs.md

---

## Legend

| Symbol | Meaning |
|--------|---------|
| → | Required reading / Continue here |
| ↗ | Optional deep-dive |
| ⚠️ | Critical implementation detail |
| 📋 | Code/schema reference |
| 📊 | Diagram reference |

---

## Key Concepts

- **4 Services**: Agent Server, Internal CMS, Third-Party CMS, Website Renderer
- **3 Agent Levels**: Router → Orchestrator → Specialists
- **7 Agents**: 1 router, 1 orchestrator, 5 specialists
- **Stateless Runtime**: Agent Server has no persistence; CMS Server stores everything

---

## Future Design Gaps

These areas are acknowledged but deferred (see [3-implementation/13-event-bus.md](3-implementation/13-event-bus.md)):

| Area | Status |
|------|--------|
| Authentication flow | Mentioned, not specified |
| Multi-tenancy schema | Implied, not detailed |
| Rate limiting | Not specified |
| Observability/tracing | Events defined, format TBD |
| Error recovery UI | Strategy mentioned, UI TBD |
