# Multiservice Agent Architecture Plan V7 (Complete System Design)

**Date**: 2025-12-31
**Status**: FINAL ARCHITECTURE
**Evolution**: V6 + Router/Orchestrator/Specialist Model + Feature Flags
**Key Concept**: "Production-Grade CMS Agent with 3-Level Agent Architecture"

---

## 1. Executive Summary

V7 is the **complete, production-ready architecture** that builds on V6 with a refined agent model:

**Foundation (from V6):**
- 4-service separation, adapter pattern, configurable agents
- Tool search, compaction, background jobs
- Event bus, retry strategy, doom loop detection

**V7 Enhancements:**
- Router → Orchestrator → Specialist model
- Context modes (fresh/inherited/selective)
- Feature flags for incremental rollout

### Key Changes from V6

| Aspect | V6 | V7 |
|--------|----|----|
| Agent types | `mode: 'primary' \| 'general' \| 'domain'` | `type: 'router' \| 'orchestrator' \| 'specialist'` |
| Orchestrators | Multiple domain-specific | ONE general-purpose orchestrator |
| Max depth | Configurable (default 3) | Fixed at 3, enforced by `canSpawn: false` |
| spawn_agent tool | Exposed to LLM | Internal to orchestrator only |
| Routing | Implicit in primary agent prompt | Explicit router with complexity assessment |
| Context passing | Always inherited | fresh/inherited/selective modes |
| Feature flags | None | SystemConfig for incremental rollout |

### V7 Agent Model

```
7 agents total:
  1 router         (intent + complexity classification)
  1 orchestrator   (task decomposition + coordination)
  5 specialists    (page, post, research, image, qa)

3 levels max:
  Router → Orchestrator → Specialists (complex tasks)
  Router → Specialist (simple tasks)
```

This document specifies **where each subsystem lives** and **how they integrate**.

---

## 2. Complete System Architecture

The system is divided into **4 services**. We break down the architecture into 4 diagrams for clarity.

### 2.1 High-Level Service Overview

Shows the 4 main services and how they connect.

```mermaid
graph TD
    subgraph "Client Layer"
        Web[Next.js Chat UI]
        Mobile[React Native]
    end

    AgentServer[Agent Server<br/>NestJS @ 8787<br/>Stateless AI Runtime]
    InternalCMS[Internal CMS Server<br/>NestJS @ 3001<br/>All Persistent Data]
    ThirdPartyCMS[Third-Party CMS<br/>Contentful / Sanity<br/>Website Content Only]
    WebsiteRenderer[Website Renderer<br/>Next.js @ 3000]

    Web <-->|REST + SSE| AgentServer
    Mobile <-->|REST + SSE| AgentServer
    AgentServer <-->|HTTP| InternalCMS
    AgentServer <-->|HTTP| ThirdPartyCMS
    InternalCMS -->|Webhook| WebsiteRenderer
    ThirdPartyCMS -->|Webhook| WebsiteRenderer
```

### 2.2 Data Storage Architecture (Critical)

**Our Internal CMS Server is the single source of truth for ALL persistent agent data**, regardless of which CMS the user chooses for their website content.

```mermaid
graph TD
    subgraph "Internal CMS Server @ 3001 (PostgreSQL/SQLite)"
        subgraph "Agent Data (Always Stored Here)"
            Users[Users & Auth]
            Sessions[Sessions]
            Messages[Chat Messages]
            Todos[Todos / Plans]
            TokenUsage[Token Usage & Metrics]
        end
        
        subgraph "Website Content (If Using Internal CMS)"
            Pages[Pages]
            Sections[Sections]
            Posts[Posts]
            Media[Media Library]
        end
    end

    subgraph "Third-Party CMS (If User Chooses)"
        ExtContent[Website Content<br/>Pages, Posts, Assets]
    end

    AgentServer[Agent Server] -->|Read/Write Agent Data| Users
    AgentServer -->|Read/Write Agent Data| Sessions
    AgentServer -->|Read/Write Agent Data| Messages
    AgentServer -->|Read/Write Agent Data| Todos
    AgentServer -->|Read/Write Agent Data| TokenUsage

    AgentServer -->|"If Internal CMS"| Pages
    AgentServer -->|"If Third-Party CMS"| ExtContent
```

**Key Insight**: Even if a user connects Contentful or Sanity for their website content, they still have an account in our Internal CMS Server. This is where we store:

| Data Type | Stored In | Notes |
|-----------|-----------|-------|
| **Users & Authentication** | Internal CMS Server | All users register here |
| **Sessions** | Internal CMS Server | Parent/child session hierarchy |
| **Chat Messages** | Internal CMS Server | Full conversation history |
| **Todos** | Internal CMS Server | Simple plan tracking (OpenCode-style) |
| **Token Usage & Metrics** | Internal CMS Server | Observability, billing |
| **Website Content** | User's chosen CMS | Internal CMS OR Contentful/Sanity |

This design allows the Agent to be a **standalone product** that works with any CMS while maintaining consistent user management and observability.

### 2.3 Agent Server Internal Architecture

The Agent Server is **stateless** - all persistent data is stored in the Internal CMS Server (see 2.2). Connects to CMS backends via Adapters (see 2.4).

```mermaid
graph TD
    subgraph "Agent Server (NestJS @ 8787) - Stateless"
        API[REST API / SSE Stream]
        EventBus[Event Bus]
        
        subgraph "Core Runtime"
            Orchestrator[Session Orchestrator]
            Processor[Session Processor]
            Factory[Agent Factory]
            PromptComposer[Prompt Composer]
        end
        
        subgraph "Session & Memory (Stateless Services)"
            SessionSvc[Session Service]
            TodoSvc[Todo Service]
            CompactionSvc[Compaction Service]
        end
        
        subgraph "Tool Subsystem"
            Registry[Tool Registry]
            ToolSearch[Hybrid Tool Search]
        end
        
        subgraph "Background Jobs"
            Queue[BullMQ]
            Workers[Media + Content Workers]
        end
        
        subgraph "Local Services"
            Vector[(LanceDB - Embeddings)]
            Redis[(Redis - Job Queue)]
        end
    end

    API --> EventBus
    EventBus --> Orchestrator
    Orchestrator --> Processor
    Orchestrator --> SessionSvc
    Processor --> Factory
    Processor --> TodoSvc
    Processor --> Registry

    InternalCMS[(Internal CMS Server<br/>--- see 2.2 ---)]
    SessionSvc -->|HTTP| InternalCMS
    TodoSvc -->|HTTP| InternalCMS
    CompactionSvc -->|HTTP| InternalCMS

    Adapters[Adapter Layer<br/>--- see 2.4 ---]
    Registry --> Adapters
```

### 2.4 Adapter Layer & CMS Connections

Each adapter is a **self-contained bundle** with tools, prompts, agents, and schemas. The Internal Adapter talks to our CMS Server for website content. Third-party adapters talk to external APIs.

```mermaid
graph LR
    subgraph "Adapter Layer (in Agent Server)"
        subgraph "Internal Adapter"
            IA_T[tools/]
            IA_P[prompts/]
            IA_A[agents/]
        end
        
        subgraph "Contentful Adapter"
            CA_T[tools/]
            CA_P[prompts/]
            CA_A[agents/]
        end
        
        subgraph "Sanity Adapter"
            SA_T[tools/]
            SA_P[prompts/]
            SA_A[agents/]
        end
    end

    subgraph "Website Content Sources"
        InternalCMS[Internal CMS<br/>@ 3001<br/>Website Content]
        ContentfulAPI[Contentful API]
        SanityAPI[Sanity API]
    end

    IA_T -->|HTTP| InternalCMS
    CA_T -->|HTTP| ContentfulAPI
    SA_T -->|HTTP| SanityAPI

    InternalCMS -->|Webhook| AgentWebhook[Agent Server<br/>Webhook Receiver]
    ContentfulAPI -->|Webhook| AgentWebhook
    SanityAPI -->|Webhook| AgentWebhook
```

**Key Architecture Principles**:
1. **Internal CMS Server stores all agent data** - sessions, messages, memory, metrics
2. **Agent Server is stateless** - can be horizontally scaled
3. **Adapters are portable bundles** - adding a new CMS = new adapter folder
4. **Website content source is user's choice** - Internal CMS or third-party

---

## 3. Subsystem Placement Matrix

### 3.1 Agent Server Subsystems (Stateless Runtime)

| Subsystem | Location | Responsibility | Persists Data To |
|-----------|----------|----------------|------------------|
| **Event Bus** | Agent Server | Typed pub/sub for all agent events | - (in-memory) |
| **Session Orchestrator** | Agent Server | Entry point for all session operations; manages session lifecycle, parent/child relationships, cancellation propagation | Internal CMS Server |
| **Session Processor** | Agent Server | Runs the agent loop for ONE session; handles tool execution, streaming, retry | Internal CMS Server |
| **Agent Factory** | Agent Server | Loads and caches AgentConfig by ID; merges shared + adapter-specific agents | - (in-memory cache) |
| **Session Service** | Agent Server | CRUD for sessions, messages | Internal CMS Server |
| **Todo Service** | Agent Server | Simple plan tracking (OpenCode-style) | Internal CMS Server |
| **Compaction Service** | Agent Server | Summarizes long contexts | Internal CMS Server |
| **Tool Registry** | Agent Server | Loads built-in + adapter + MCP tools | - (in-memory) |
| **MCP Loader** | Agent Server | Connects to MCP plugin servers | External MCP servers |
| **Hybrid Tool Search** | Agent Server | BM25 + Vector search for tools | LanceDB (local) |
| **Vector Store (LanceDB)** | Agent Server | Embeddings for RAG + tool search | LanceDB (local) |
| **BullMQ + Redis** | Agent Server | Job queue for async tasks | Redis (local) |
| **Media Worker** | Agent Server | Generates metadata, embeddings | Internal CMS Server + LanceDB |
| **Content Worker** | Agent Server | Generates RAG embeddings | LanceDB |

### 3.2 Internal CMS Server Data (Persistent Storage)

| Data Type | Stored In | Used By |
|-----------|-----------|---------|
| **Users & Auth** | Internal CMS Server (PostgreSQL/SQLite) | Agent Server (future) |
| **Sessions** | Internal CMS Server | Session Service |
| **Messages (Chat History)** | Internal CMS Server | Session Service, Compaction |
| **Todos (Plan Tracking)** | Internal CMS Server | Todo Service |
| **Token Usage & Metrics** | Internal CMS Server | Observability (future) |
| **Website Content** | Internal CMS Server OR Third-Party CMS | Adapters |

**Note**: The Agent Server is stateless - all persistent agent data (sessions, messages, todos) is stored in the Internal CMS Server via HTTP calls. This allows horizontal scaling of Agent Server instances.

---

## 4. Detailed Subsystem Specifications

### 4.1 Tool Subsystem (Agent Server)

The tool system is **modular and searchable**. Tools come from three sources:

1. **Built-in tools** - Core tools bundled with Agent Server (web_search, vector_search, spawn_agent, etc.)
2. **Adapter tools** - CMS-specific tools from the active adapter (cms_list_pages, cms_create_post, etc.)
3. **MCP Plugin tools** - External tools from Model Context Protocol servers

#### 4.1.1 Tool Sources

```mermaid
graph LR
    subgraph "Tool Registry"
        Registry[Tool Registry Service]
    end
    
    subgraph "Tool Sources"
        BuiltIn[Built-in Tools<br/>shared/]
        Adapter[Adapter Tools<br/>adapters/internal/tools/]
        MCP[MCP Plugin Tools<br/>External Servers]
    end
    
    BuiltIn --> Registry
    Adapter --> Registry
    MCP --> Registry
    
    Registry --> Processor[Session Processor]
```

#### 4.1.2 Folder Structure

```
agent-server/src/tools/
├── _registry/
│   ├── tool-registry.service.ts    # Central registry
│   ├── mcp-loader.ts               # Loads tools from MCP servers
│   └── tool-types.ts               # Tool interface definitions
├── _search/
│   ├── hybrid-search.service.ts    # BM25 + Vector blending
│   ├── bm25-search.ts              # Lexical search
│   └── vector-search.ts            # Semantic search
├── _loaders/
│   └── dynamic-loader.ts           # Loads tools from adapters
└── shared/                         # Built-in tools (not CMS-specific)
    ├── web_search/
    │   ├── web_search.metadata.ts
    │   ├── web_search.tool.ts
    │   └── index.ts
    ├── vector_search/
    ├── spawn_agent/
    ├── todowrite/
    └── todoread/
```

#### 4.1.2 Tool Interface

```typescript
interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'cms' | 'search' | 'media' | 'utility';
  
  // For search indexing
  searchMetadata: {
    keywords: string[];
    useCases: string[];
  };
  
  // AI SDK compatible schema
  parameters: z.ZodSchema;
  
  // Execution
  execute: (input: unknown, ctx: ToolContext) => Promise<ToolResult>;
}

interface ToolContext {
  sessionId: string;
  agentId: string;
  userId: string;
  cmsType: string;
  abortSignal: AbortSignal;
  eventBus: EventBus;
  orchestrator: SessionOrchestrator;  // For spawn_agent tool
}
```

#### 4.1.3 Hybrid Tool Search

When an agent has access to **many tools** (e.g., 50+), we don't load all into context. Instead:

```typescript
// Tool Search Service
class HybridToolSearchService {
  async search(query: string, limit: number = 10): Promise<ToolDefinition[]> {
    // 1. BM25 lexical search (fast, keyword match)
    const bm25Results = await this.bm25Search.search(query, limit * 2);
    
    // 2. Vector semantic search (understands intent)
    const vectorResults = await this.vectorSearch.search(query, limit * 2);
    
    // 3. Blend results (reciprocal rank fusion)
    return this.blendResults(bm25Results, vectorResults, limit);
  }
}
```

**When to use**: Agents with `tools: ['*']` or `tools: ['cms_*']` patterns use search. Agents with explicit tool lists don't.

#### 4.1.5 MCP Client Support

The Agent Server acts as an **MCP client** to connect to external MCP servers and consume their tools. This allows integrating third-party data sources without modifying core code.

```typescript
// MCP server connection config (stored in Internal CMS Server)
// SSE-only: Agent Server is stateless with no terminal access
interface McpConnectionConfig {
  id: string;
  name: string;
  url: string;             // SSE endpoint URL
  apiKey?: string;         // Optional auth
  enabled: boolean;
}

// MCP Client loads tools from external MCP servers
class McpClient {
  async loadTools(config: McpConnectionConfig): Promise<ToolDefinition[]> {
    const connection = await this.connect(config);
    const mcpTools = await connection.listTools();
    
    return mcpTools.map(tool => ({
      id: `mcp_${config.id}_${tool.name}`,
      name: tool.name,
      description: tool.description,
      category: 'utility',
      parameters: tool.inputSchema,
      execute: async (input, ctx) => {
        return await connection.callTool(tool.name, input);
      },
    }));
  }
}
```

**Example MCP servers to connect to:**
- Airtable MCP - access Airtable bases
- Google Sheets MCP - read/write spreadsheets
- Notion MCP - access Notion databases
- Slack MCP - send messages, read channels

---

### 4.2 Memory Subsystem (Agent Server)

Memory is kept simple. **Chat history + compaction** handles context. A lightweight **Todo system** (like OpenCode) handles plan tracking for multi-step agents.

#### 4.2.1 Todo System (OpenCode-style)

A simple task list for agents that need to track multi-step plans. Not all agents need this.

```typescript
// Simple todo item (matches OpenCode's design)
interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
}

// Todo storage per session
interface SessionTodos {
  sessionId: string;
  todos: TodoItem[];
}
```

**Tools**: `todowrite` and `todoread` - available to agents with `planTrackingEnabled: true`.

```typescript
// todowrite tool
const todoWriteTool: ToolDefinition = {
  id: 'todowrite',
  name: 'todowrite',
  description: 'Update the todo list to track your current plan and progress',
  parameters: z.object({
    todos: z.array(z.object({
      id: z.string(),
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
      priority: z.enum(['high', 'medium', 'low']),
    })),
  }),
  execute: async (input, ctx) => {
    await todoService.update(ctx.sessionId, input.todos);
    ctx.eventBus.publish('todo.updated', { sessionId: ctx.sessionId, todos: input.todos });
    return { success: true };
  },
};
```

**When to use**: Multi-step domain agents (page_builder, post_writer, bulk_editor) that benefit from explicit plan tracking.

**When NOT needed**: Simple agents (qa, research) where chat history is sufficient.

#### 4.2.2 Compaction Service

Two-phase context management (like OpenCode and current prototype):

1. **Pruning**: Trim large tool outputs first (replace with `[trimmed]` placeholder)
2. **Summarization**: When still over limit, summarize older conversation into a summary message

```typescript
class CompactionService {
  async shouldCompact(session: Session, provider: Provider): Promise<boolean> {
    const tokenCount = await this.countTokens(session.messages);
    const limit = provider.contextWindow;
    const outputBuffer = Math.min(provider.maxOutput, 32000);
    
    return tokenCount > (limit - outputBuffer);
  }
  
  async compact(session: Session): Promise<void> {
    // 1. First pass: prune large tool outputs
    await this.pruneToolOutputs(session);
    
    // 2. If still over limit, summarize older messages
    if (await this.shouldCompact(session, provider)) {
      const toSummarize = session.messages.slice(0, -4);
      const summary = await this.generateSummary(toSummarize);
      await this.sessionStore.replaceWithSummary(session.id, summary);
    }
    
    this.eventBus.publish('session.compacted', { sessionId: session.id });
  }
}
```

**Provider-Anchored**: Uses the provider's reported context window as source of truth, not hardcoded values.

---

### 4.3 Background Jobs (Agent Server)

#### 4.3.1 Architecture

**Key Insight**: Background jobs (image processing, embedding generation) must live in the **Agent Server**, not the CMS Server. This is because:
1. Third-party CMSs (Contentful, Sanity) don't allow custom workers
2. We need a unified pipeline regardless of CMS source
3. Embeddings feed into the Agent Server's vector store

```mermaid
graph TD
    subgraph "Agent Server (NestJS @ 8787)"
        WebhookReceiver[Webhook Receiver]
        JobQueue[Job Queue - BullMQ]
        Redis[(Redis)]
        
        subgraph "Workers"
            MediaWorker[Media Worker]
            ContentWorker[Content Worker]
        end
        
        VectorStore[(Vector Store - LanceDB)]
        
        MediaWorker -->|"Generate: metadata, embeddings, descriptions"| VectorStore
        ContentWorker -->|"Generate: RAG embeddings"| VectorStore
    end
    
    subgraph "CMS Sources"
        InternalCMS[Internal CMS Server]
        Contentful[Contentful Cloud]
        Sanity[Sanity Cloud]
    end
    
    InternalCMS -->|"Webhook: asset.created"| WebhookReceiver
    Contentful -->|"Webhook: asset.created"| WebhookReceiver
    Sanity -->|"Webhook: asset.created"| WebhookReceiver
    
    WebhookReceiver -->|"Dispatch Job"| JobQueue
    JobQueue --> Redis
    Redis --> MediaWorker
    Redis --> ContentWorker
```

**Why workers live in Agent Server:**
- **Contentful/Sanity** don't allow custom background workers on their cloud
- **Unified pipeline**: Same processing logic regardless of CMS source
- **Direct vector store access**: No HTTP overhead for embeddings

#### 4.3.2 Job Types

All jobs run in the **Agent Server** to ensure consistency across any CMS source.

| Job | Trigger | Input | Output |
|-----|---------|-------|--------|
| `media.process` | Webhook or API call | Image URL from any CMS | Metadata (dimensions, format, colors) |
| `media.embed` | After `media.process` | Image + metadata | Embedding → Vector Store |
| `media.describe` | After `media.process` | Image URL | AI-generated alt text, tags |
| `content.embed` | Webhook: `entry.published` | Content JSON | RAG embedding → Vector Store |
| `tool.index` | Tool registration | Tool metadata | BM25 + Vector index |

#### 4.3.3 Webhook Flow (Third-Party CMS)

```typescript
// Agent Server: Webhook receiver
@Post('/webhooks/:adapterId')
async handleCmsWebhook(
  @Param('adapterId') adapterId: string,
  @Body() payload: unknown,
) {
  const adapter = this.adapterRegistry.get(adapterId);
  const event = adapter.parseWebhook(payload);
  
  switch (event.type) {
    case 'asset.created':
    case 'asset.updated':
      await this.queue.add('media.process', {
        adapterId,
        assetId: event.assetId,
        assetUrl: event.url,
      });
      break;
      
    case 'entry.published':
      await this.queue.add('content.embed', {
        adapterId,
        entryId: event.entryId,
        content: event.content,
      });
      break;
  }
}
```

---

### 4.4 Adapter Layer (Agent Server)

Each adapter is a **self-contained, pluggable module** that bundles everything needed for a specific CMS:

```mermaid
graph TB
    subgraph "Agent Server Core"
        Core[Core Agent Module]
        ToolRegistry[Tool Registry]
        PromptComposer[Prompt Composer]
        AgentFactory[Agent Factory]
    end
    
    subgraph "Adapter Layer"
        AdapterInterface[CmsAdapter Interface]
        
        subgraph "Internal CMS Adapter"
            IT[tools/]
            IP[prompts/]
            IA[agents/]
            IS[schemas/]
        end
        
        subgraph "Contentful Adapter"
            CT[tools/]
            CP[prompts/]
            CA[agents/]
            CS[schemas/]
        end
        
        subgraph "Sanity Adapter"
            ST[tools/]
            SP[prompts/]
            SA[agents/]
            SS[schemas/]
        end
    end
    
    Core --> AdapterInterface
    AdapterInterface --> IT & IP & IA & IS
    AdapterInterface --> CT & CP & CA & CS
    AdapterInterface --> ST & SP & SA & SS
    
    IT --> ToolRegistry
    CT --> ToolRegistry
    ST --> ToolRegistry
    
    IP --> PromptComposer
    CP --> PromptComposer
    SP --> PromptComposer
    
    IA --> AgentFactory
    CA --> AgentFactory
    SA --> AgentFactory
```

#### 4.4.1 Adapter Bundle Structure

Each adapter folder contains **everything bundled together**:

```
adapters/
├── adapter.interface.ts        # Common interface all adapters implement
├── adapter.registry.ts         # Loads and manages active adapters
│
├── internal/                   # Internal CMS Adapter (full bundle)
│   ├── tools/
│   │   ├── list-pages.tool.ts
│   │   ├── create-page.tool.ts
│   │   ├── update-section.tool.ts
│   │   └── index.ts            # Exports all tools
│   ├── prompts/
│   │   ├── page-builder.prompt.txt
│   │   ├── post-writer.prompt.txt
│   │   └── index.ts            # Exports all prompts
│   ├── agents/
│   │   ├── page-builder.agent.ts
│   │   ├── post-writer.agent.ts
│   │   └── index.ts            # Exports agent configs
│   ├── schemas/
│   │   ├── page.schema.ts
│   │   ├── section.schema.ts
│   │   └── index.ts
│   ├── auth.ts                 # Auth handler for this CMS
│   └── index.ts                # Adapter entry point
│
├── contentful/                 # Contentful Adapter (full bundle)
│   ├── tools/
│   │   ├── list-entries.tool.ts
│   │   ├── create-entry.tool.ts
│   │   ├── publish-entry.tool.ts
│   │   └── index.ts
│   ├── prompts/
│   │   ├── content-editor.prompt.txt
│   │   └── index.ts
│   ├── agents/
│   │   ├── content-editor.agent.ts
│   │   └── index.ts
│   ├── schemas/
│   │   ├── content-type.schema.ts
│   │   └── index.ts
│   ├── auth.ts                 # Contentful API key handling
│   ├── webhook-parser.ts       # Parse Contentful webhook payloads
│   └── index.ts
│
└── sanity/                     # Sanity Adapter (full bundle)
    ├── tools/
    ├── prompts/
    ├── agents/
    ├── schemas/
    ├── auth.ts
    ├── webhook-parser.ts
    └── index.ts
```

#### 4.4.2 Adapter Interface

```typescript
// adapter.interface.ts
interface CmsAdapter {
  id: string;                    // 'internal' | 'contentful' | 'sanity'
  name: string;                  // Human-readable name
  
  // ═══════════════════════════════════════════════════════════
  // BUNDLED COMPONENTS - Each adapter provides ALL of these
  // ═══════════════════════════════════════════════════════════
  
  // Tools specific to this CMS
  getTools(): Promise<Record<string, ToolDefinition>>;
  
  // Prompts specific to this CMS
  getPrompts(): Promise<Record<string, string>>;
  
  // Agent configurations specific to this CMS
  getAgents(): Promise<Record<string, AgentConfig>>;
  
  // Schema validators for this CMS's data models
  getSchemas(): Record<string, z.ZodSchema>;
  
  // ═══════════════════════════════════════════════════════════
  // RUNTIME METHODS
  // ═══════════════════════════════════════════════════════════
  
  // Context injected into all prompts when using this adapter
  getPromptContext(): Promise<string>;
  
  // Parse incoming webhooks from this CMS
  parseWebhook(payload: unknown): CmsWebhookEvent;
  
  // Authenticate with this CMS
  authenticate(credentials: unknown): Promise<void>;
}
```

#### 4.4.3 Adapter Implementation Example

```typescript
// adapters/internal/index.ts
import { tools } from './tools/index.js';
import { prompts } from './prompts/index.js';
import { agents } from './agents/index.js';
import { schemas } from './schemas/index.js';
import type { CmsAdapter } from '../adapter.interface.js';

export class InternalCmsAdapter implements CmsAdapter {
  id = 'internal';
  name = 'Internal CMS';
  
  constructor(private config: { baseUrl: string; apiKey: string }) {}
  
  // Return all tools bundled in this adapter
  async getTools() {
    return tools;  // { cms_list_pages, cms_create_page, ... }
  }
  
  // Return all prompts bundled in this adapter
  async getPrompts() {
    return prompts;  // { page_builder: '...', post_writer: '...' }
  }
  
  // Return all agent configs bundled in this adapter  
  async getAgents() {
    return agents;  // { page_builder: AgentConfig, post_writer: AgentConfig }
  }
  
  // Return schema validators
  getSchemas() {
    return schemas;  // { page: z.object(...), section: z.object(...) }
  }
  
  // Runtime: inject CMS-specific context into prompts
  async getPromptContext(): Promise<string> {
    const templates = await this.fetchTemplateList();
    return `
      You are working with the Internal CMS.
      - Pages contain Sections
      - Sections use Templates: ${templates.join(', ')}
      - All content supports localization
    `;
  }
  
  // Runtime: parse webhooks from Internal CMS
  parseWebhook(payload: unknown): CmsWebhookEvent {
    // Internal CMS webhook format
    return {
      type: payload.event,  // 'page.created', 'asset.uploaded'
      entityId: payload.id,
      entityType: payload.type,
      data: payload.data,
    };
  }
}
```

**Key Principle**: An adapter is a **portable, self-contained package**. You can add a new CMS by creating a new adapter folder with its tools, prompts, agents, and schemas - no changes to core code required.

#### 4.4.4 Adapter Lifecycle

| Phase | Behavior |
|-------|----------|
| **Initialization** | Adapters are instantiated at server startup based on configuration |
| **Per-request context** | Each request receives adapter instance with user's credentials injected |
| **Caching** | Adapters may cache CMS metadata (templates, content types) with TTL-based invalidation |
| **Shutdown** | Adapters release connections on server shutdown |

Adapters are **stateless between requests** - any cached data is for performance only and can be rebuilt from the CMS source.

---

### 4.5 Agent Factory (Agent Server)

The Agent Factory is responsible for loading and providing `AgentConfig` objects. It merges shared agents with adapter-specific agents and caches them for performance.

#### 4.5.1 Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Load agent configs** | Read from shared agents + active adapter's agents |
| **Merge configs** | Adapter agents can override shared agent defaults |
| **Cache configs** | In-memory cache with TTL-based invalidation |
| **Validate configs** | Ensure all required fields are present |

#### 4.5.2 Agent Sources

```mermaid
graph LR
    subgraph "Agent Factory"
        Factory[AgentFactory]
        Cache[(In-Memory Cache)]
    end
    
    subgraph "Agent Sources"
        Shared[Shared Agents<br/>primary, qa, research]
        Adapter[Adapter Agents<br/>page_builder, post_writer]
    end
    
    Shared --> Factory
    Adapter --> Factory
    Factory --> Cache
    
    Processor[Session Processor] --> Factory
```

#### 4.5.3 Implementation

```typescript
class AgentFactory {
  private cache: Map<string, AgentConfig> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 60_000;  // 1 minute
  
  constructor(
    private readonly sharedAgents: Record<string, AgentConfig>,
    private readonly adapterRegistry: AdapterRegistry,
  ) {}
  
  /**
   * Get an agent config by ID.
   * Checks shared agents first, then active adapter's agents.
   */
  async get(agentId: string, cmsType: string): Promise<AgentConfig> {
    const cacheKey = `${cmsType}:${agentId}`;
    
    // Check cache
    if (this.isCacheValid() && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Load from sources
    const config = await this.loadAgent(agentId, cmsType);
    
    // Cache and return
    this.cache.set(cacheKey, config);
    return config;
  }
  
  private async loadAgent(agentId: string, cmsType: string): Promise<AgentConfig> {
    // 1. Check shared agents (primary, qa, research)
    if (this.sharedAgents[agentId]) {
      return this.sharedAgents[agentId];
    }
    
    // 2. Check adapter-specific agents
    const adapter = await this.adapterRegistry.get(cmsType);
    const adapterAgents = await adapter.getAgents();
    
    if (adapterAgents[agentId]) {
      return adapterAgents[agentId];
    }
    
    throw new Error(`Agent not found: ${agentId}`);
  }
  
  /**
   * List all available agents for a given CMS type.
   * Used by spawn_agent tool to show available options.
   */
  async listAvailable(cmsType: string): Promise<AgentConfig[]> {
    const adapter = await this.adapterRegistry.get(cmsType);
    const adapterAgents = await adapter.getAgents();
    
    return [
      ...Object.values(this.sharedAgents),
      ...Object.values(adapterAgents),
    ];
  }
  
  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS;
  }
  
  invalidateCache(): void {
    this.cache.clear();
    this.cacheTimestamp = 0;
  }
}
```

#### 4.5.4 Shared vs Adapter Agents

| Agent Type | Location | Examples | Override Behavior |
|------------|----------|----------|-------------------|
| **Shared** | `agent-server/src/agents/shared/` | `primary`, `qa`, `research` | Used across all adapters |
| **Adapter-specific** | `adapters/{cms}/agents/` | `page_builder`, `post_writer` | CMS-specific implementations |

**Note**: The same agent ID can exist in both shared and adapter locations. Adapter agents take precedence, allowing CMS-specific customization of prompts and tool sets.

---

### 4.6 Session Orchestrator (Agent Server)

The Session Orchestrator is the **entry point for all session operations**. It owns session lifecycle and coordinates multi-agent execution. The Session Processor is a lower-level component that the Orchestrator uses to run individual agent loops.

#### Why Not Just Tool-Wrapped Sub-Agents?

A simpler approach would be wrapping sub-agents as AI SDK tools (each tool runs its own `generateText` loop). That works for basic multi-agent, but this architecture adds production requirements:

- **Cancellation propagation** - Abort parent → automatically aborts all children
- **Timeout enforcement** - Prevent runaway sub-agents from running forever
- **Session persistence** - Save conversation history for debugging and resume
- **Metrics rollup** - Track total tokens/cost across the entire agent tree
- **UI observability** - Stream nested agent progress to the frontend via EventBus

These are hard to retrofit. The Orchestrator layer provides them from the start.

#### 4.6.1 Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Session lifecycle** | Create, run, complete, abort sessions |
| **Parent/child management** | Track session hierarchy, propagate cancellation |
| **Child spawning** | Create and run child sessions (called by spawn_agent tool) |
| **Timeout enforcement** | Abort sessions that exceed maxDuration |
| **Metrics aggregation** | Roll up token usage from child sessions to parent |

#### 4.6.2 Architecture

```mermaid
graph TD
    subgraph "External"
        API[REST API]
        SpawnTool[spawn_agent Tool]
    end
    
    subgraph "Session Orchestrator"
        Orch[SessionOrchestrator]
        
        subgraph "Managed State"
            ActiveSessions[(Active Sessions)]
            Timeouts[(Timeout Handles)]
        end
    end
    
    subgraph "Lower-Level Components"
        Processor[SessionProcessor]
        SessionStore[SessionStore]
        EventBus[EventBus]
    end
    
    API -->|"runSession()"| Orch
    SpawnTool -->|"spawnChild()"| Orch
    
    Orch --> ActiveSessions
    Orch --> Timeouts
    Orch -->|"creates & runs"| Processor
    Orch -->|"CRUD"| SessionStore
    Orch -->|"publishes events"| EventBus
```

#### 4.6.3 Implementation

```typescript
interface SessionResult {
  sessionId: string;
  status: 'completed' | 'error' | 'aborted';
  finalResponse?: string;
  artifacts?: string[];
  error?: string;
  metrics: {
    totalTokens: number;
    totalSteps: number;
    durationMs: number;
  };
}

interface SpawnChildOptions {
  parentSessionId: string;
  agentId: string;
  task: string;
  context?: string;
  sessionId?: string;  // Optional: resume existing child session
}

class SessionOrchestrator {
  private activeSessions: Map<string, AbortController> = new Map();
  private timeoutHandles: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly agentFactory: AgentFactory,
    private readonly processorFactory: () => SessionProcessor,
    private readonly eventBus: EventBus,
    private readonly config: {
      defaultMaxDuration: number;  // 5 minutes default
    },
  ) {}
  
  /**
   * Run a session to completion.
   * This is the main entry point for user messages.
   */
  async runSession(sessionId: string, userMessage: string): Promise<SessionResult> {
    const session = await this.sessionStore.get(sessionId);
    const startTime = Date.now();
    
    // Setup abort controller for cancellation
    const abortController = new AbortController();
    this.activeSessions.set(sessionId, abortController);
    
    // Setup timeout
    const maxDuration = this.config.defaultMaxDuration;
    const timeoutHandle = setTimeout(() => {
      this.abortSession(sessionId, 'timeout');
    }, maxDuration);
    this.timeoutHandles.set(sessionId, timeoutHandle);
    
    try {
      // Emit session started
      this.eventBus.publish('session.started', {
        sessionId,
        agentId: session.agentId,
        userId: session.userId,
        parentId: session.parentId,
      });
      
      // Create processor and run
      const processor = this.processorFactory();
      const result = await processor.run(sessionId, userMessage, abortController.signal);
      
      // Update session with results
      await this.sessionStore.update(sessionId, {
        status: 'completed',
        finalResponse: result.finalResponse,
        artifacts: result.artifacts,
        metadata: {
          ...session.metadata,
          totalTokens: result.totalTokens,
          totalSteps: result.totalSteps,
        },
      });
      
      // Emit completion
      this.eventBus.publish('session.completed', {
        sessionId,
        result: result.finalResponse,
        artifacts: result.artifacts,
      });
      
      return {
        sessionId,
        status: 'completed',
        finalResponse: result.finalResponse,
        artifacts: result.artifacts,
        metrics: {
          totalTokens: result.totalTokens,
          totalSteps: result.totalSteps,
          durationMs: Date.now() - startTime,
        },
      };
      
    } catch (error) {
      const status = abortController.signal.aborted ? 'aborted' : 'error';
      
      await this.sessionStore.update(sessionId, { status });
      
      this.eventBus.publish('session.error', {
        sessionId,
        error: error.message,
        recoverable: status === 'aborted',
      });
      
      return {
        sessionId,
        status,
        error: error.message,
        metrics: {
          totalTokens: 0,
          totalSteps: 0,
          durationMs: Date.now() - startTime,
        },
      };
      
    } finally {
      // Cleanup
      this.activeSessions.delete(sessionId);
      const handle = this.timeoutHandles.get(sessionId);
      if (handle) {
        clearTimeout(handle);
        this.timeoutHandles.delete(sessionId);
      }
    }
  }
  
  /**
   * Spawn a child session. Called by spawn_agent tool.
   * Blocks until child completes (synchronous spawning).
   * 
   * Supports session continuity: pass sessionId to resume an existing child session
   * instead of creating a new one. This allows multi-step workflows where a sub-agent
   * maintains context across multiple invocations.
   */
  async spawnChild(options: SpawnChildOptions): Promise<SessionResult> {
    const { parentSessionId, agentId, task, context, sessionId } = options;
    
    // Get parent session to check depth
    const parentSession = await this.sessionStore.get(parentSessionId);
    
    let childSession: Session;
    let isResuming = false;
    
    if (sessionId) {
      // Resume existing session
      const existingSession = await this.sessionStore.get(sessionId).catch(() => null);
      
      if (existingSession) {
        // Validate: must be a child of this parent (or any ancestor)
        if (!this.isDescendantOf(existingSession, parentSessionId)) {
          throw new Error(`Cannot resume session ${sessionId}: not a descendant of current session`);
        }
        
        // Validate: must use same agent type
        if (existingSession.agentId !== agentId) {
          throw new Error(`Cannot resume session ${sessionId}: agent mismatch (expected ${agentId}, got ${existingSession.agentId})`);
        }
        
        childSession = existingSession;
        isResuming = true;
      } else {
        // Session not found, create new one (graceful fallback)
        childSession = await this.createChildSession(parentSession, agentId);
      }
    } else {
      // Check depth limit only for new sessions
      if (parentSession.depth >= parentSession.maxDepth) {
        throw new Error('Maximum agent depth reached. Cannot spawn more agents.');
      }
      
      childSession = await this.createChildSession(parentSession, agentId);
    }
    
    // Track child in parent (if new)
    if (!isResuming) {
      await this.sessionStore.update(parentSessionId, {
        metadata: {
          ...parentSession.metadata,
          childSessions: [...(parentSession.metadata.childSessions || []), childSession.id],
        },
      });
    }
    
    // Emit spawn event
    this.eventBus.publish('agent.spawned', {
      parentSessionId,
      childSessionId: childSession.id,
      agentId,
      task,
      resumed: isResuming,
    });
    
    // Build initial message with context
    const initialMessage = context 
      ? `Context from parent agent:\n${context}\n\nTask: ${task}`
      : task;
    
    // Run child session (blocking) - resets timeout for resumed sessions
    const result = await this.runSession(childSession.id, initialMessage);
    
    // Emit completion event
    this.eventBus.publish('agent.child_completed', {
      parentSessionId,
      childSessionId: childSession.id,
      agentId,
      result: result.finalResponse,
    });
    
    // Roll up metrics to parent
    await this.rollUpMetrics(parentSessionId, result.metrics);
    
    return result;
  }
  
  /**
   * Create a new child session.
   */
  private async createChildSession(parentSession: Session, agentId: string): Promise<Session> {
    return await this.sessionStore.create({
      parentId: parentSession.id,
      agentId,
      userId: parentSession.userId,
      cmsType: parentSession.cmsType,
      depth: parentSession.depth + 1,
      maxDepth: parentSession.maxDepth,
    });
  }
  
  /**
   * Check if a session is a descendant of another session.
   */
  private async isDescendantOf(session: Session, ancestorId: string): Promise<boolean> {
    let current = session;
    while (current.parentId) {
      if (current.parentId === ancestorId) return true;
      current = await this.sessionStore.get(current.parentId);
    }
    return false;
  }
  
  /**
   * Abort a session and all its children.
   */
  async abortSession(sessionId: string, reason: 'timeout' | 'user_cancelled' | 'parent_aborted'): Promise<void> {
    const session = await this.sessionStore.get(sessionId);
    
    // Abort this session
    const controller = this.activeSessions.get(sessionId);
    if (controller) {
      controller.abort();
    }
    
    // Abort all children (recursive)
    const childIds = session.metadata.childSessions || [];
    for (const childId of childIds) {
      await this.abortSession(childId, 'parent_aborted');
    }
    
    this.eventBus.publish('session.aborted', { sessionId, reason });
  }
  
  /**
   * Roll up token usage from child to parent session.
   */
  private async rollUpMetrics(parentSessionId: string, childMetrics: SessionResult['metrics']): Promise<void> {
    const parent = await this.sessionStore.get(parentSessionId);
    
    await this.sessionStore.update(parentSessionId, {
      metadata: {
        ...parent.metadata,
        totalTokens: (parent.metadata.totalTokens || 0) + childMetrics.totalTokens,
      },
    });
  }
}
```

#### 4.6.4 Orchestrator vs Processor Responsibilities

| Aspect | SessionOrchestrator | SessionProcessor |
|--------|---------------------|------------------|
| **Scope** | All sessions (tree management) | Single session only |
| **Creates** | Sessions, processors | Nothing |
| **Lifecycle** | Start, complete, abort, timeout | Run loop until done |
| **Child sessions** | Creates and runs them | Calls orchestrator.spawnChild() |
| **Events** | session.*, agent.spawned, agent.child_completed | tool.*, agent.thinking |
| **State** | Active sessions map, timeout handles | Agent loop state |

**Key Principle**: The Processor focuses on running ONE agent loop well. The Orchestrator handles everything else - lifecycle, hierarchy, coordination.

---

## 5. Multi-Agent Architecture

This is a **routed multi-agent system** where a Primary agent orchestrates specialized sub-agents. Each sub-agent is configured as a focused workflow with specific tools, autonomy limits, and behaviors.

### 5.1 Architecture Overview (V7)

```mermaid
graph TD
    User((User)) -->|Message| Router[Router<br/>Intent + Complexity Classification]

    Router -->|"Simple: page_building"| PageS[page_specialist]
    Router -->|"Simple: qa"| QAS[qa_specialist]
    Router -->|"Simple: research"| ResS[research_specialist]
    Router -->|"Complex"| Orch[Orchestrator]

    subgraph "Level 2: Simple Path"
        PageS -->|Response| User
        QAS -->|Response| User
        ResS -->|Response| User
    end

    subgraph "Level 2: Complex Path"
        Orch -->|"Decompose"| SubTasks[Subtasks]
        SubTasks -->|"spawn (fresh)"| RS1[research_specialist]
        SubTasks -->|"spawn (fresh)"| RS2[research_specialist]
        SubTasks -->|"spawn (selective)"| PS[page_specialist]
    end

    subgraph "Level 3: Spawned Specialists"
        RS1 -->|Result| Orch
        RS2 -->|Result| Orch
        PS -->|Result| Orch
    end

    Orch -->|"Synthesize"| Response[Response]
    Response -->|Response| User
```

**V7 Key Architecture Points:**
- **Router** is the mandatory entry point (Level 1)
- **Simple tasks** go directly to specialists (2 levels: Router → Specialist)
- **Complex tasks** go through orchestrator (3 levels: Router → Orchestrator → Specialists)
- **Specialists never spawn** - they use tools only
- **Orchestrator spawns internally** - no spawn_agent tool exposed to LLM

### 5.2 Agent Catalog (V7 Architecture)

Agents are **configuration-driven workflows**, not hardcoded classes. V7 introduces a **3-level architecture** with explicit agent types:

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
| 2 | Specialists | 5 | Execute domain-specific tasks with tools (direct route) |
| 3 | Specialists | (spawned) | Same specialists, spawned by orchestrator for subtasks |

**Total: 7 agent configurations**

#### 5.2.1 Agent Type Overview

| ID | Type | Model | Purpose |
|----|------|-------|---------|
| `router` | router | gpt-4o-mini | Classify intent + complexity, route |
| `orchestrator` | orchestrator | gpt-4o | Decompose, spawn, track, synthesize |
| `page_specialist` | specialist | gpt-4o | Create/edit pages and sections |
| `post_specialist` | specialist | gpt-4o | Create/edit blog posts |
| `research_specialist` | specialist | gpt-4o | Web research, information gathering |
| `image_specialist` | specialist | gpt-4o | Image search, upload, management |
| `qa_specialist` | specialist | gpt-4o-mini | Answer questions about CMS content |

#### 5.2.2 The Router Agent

| Property | Value |
|----------|-------|
| **ID** | `router` |
| **Role** | Classify intent + assess complexity, route to appropriate handler |
| **Model** | Fast (gpt-4o-mini) |
| **Tools** | None (classification only) |
| **Type** | `router` |

The Router agent is the **single entry point** for all user messages. It:
1. Classifies user intent (page_building, research, qa, etc.)
2. Assesses complexity (simple vs complex)
3. Routes simple tasks directly to specialists
4. Routes complex tasks to the orchestrator

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

#### 5.2.3 The Orchestrator Agent (ONE Orchestrator)

| Property | Value |
|----------|-------|
| **ID** | `orchestrator` |
| **Role** | Decompose complex tasks, spawn specialists, track progress, synthesize results |
| **Model** | High (gpt-4o) |
| **Tools** | Internal spawning only (no spawn_agent tool exposed) |
| **Type** | `orchestrator` |

The Orchestrator is the **coordination layer**. It does NOT execute tasks directly. It:
1. Decomposes complex requests into subtasks
2. Assigns each subtask to the appropriate specialist
3. Decides execution order (parallel vs sequential)
4. Tracks progress via todo list
5. Synthesizes results into a coherent response

**Key Design: ONE orchestrator.** Domain knowledge lives in specialists and their prompts. The orchestrator is domain-agnostic.

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

#### 5.2.4 Specialist Agents

All specialists share these characteristics:
- **Type**: `specialist`
- **canSpawn**: `false` (enforced - specialists NEVER spawn sub-agents)
- **Tools only**: Use tools for capabilities, not delegation

| Agent | Role | Model | Tools | Max Steps |
|-------|------|-------|-------|-----------|
| **`qa_specialist`** | Answer questions about CMS, content | Fast (gpt-4o-mini) | `vector_search`, `cms_read_*` | 5 |
| **`research_specialist`** | Web research, information gathering | Medium (gpt-4o) | `web_search`, `web_fetch`, `vector_search` | 10 |
| **`page_specialist`** | Create/edit pages and sections | High (gpt-4o) | `cms_*` page tools, `image_search` | 15 |
| **`post_specialist`** | Create/edit blog posts | High (gpt-4o) | `cms_*` post tools, `image_search` | 12 |
| **`image_specialist`** | Image search, upload, management | Medium (gpt-4o) | `image_*` tools | 8 |

```typescript
const qaSpecialist: AgentConfig = {
  id: 'qa_specialist',
  name: 'Q&A Specialist',
  description: 'Answers questions about CMS content',
  type: 'specialist',
  model: { default: 'gpt-4o-mini', temperature: 0.5 },
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
    canSpawn: false,  // Enforced
  },

  permission: { write: 'deny', delete: 'deny' },
  memory: {
    compactionEnabled: false,
    todoEnabled: false,
  },
};

const researchSpecialist: AgentConfig = {
  id: 'research_specialist',
  name: 'Research Specialist',
  description: 'Researches topics from web and internal sources',
  type: 'specialist',
  model: { default: 'gpt-4o', temperature: 0.5 },
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

#### 5.2.5 Additional Specialist Configurations

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
    canSpawn: false,
  },

  permission: { write: 'allow', delete: 'ask' },
  memory: {
    compactionEnabled: true,
    todoEnabled: true,
  },
};

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

const imageSpecialist: AgentConfig = {
  id: 'image_specialist',
  name: 'Image Specialist',
  description: 'Manages images - search, upload, organize',
  type: 'specialist',
  model: { default: 'gpt-4o', temperature: 0.3 },
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

#### 5.2.6 Key V7 Design Rules

| Rule | Enforcement |
|------|-------------|
| **Max depth = 3** | Orchestrator spawns specialists. Specialists cannot spawn. |
| **ONE orchestrator** | Only one orchestrator agent exists. No domain-specific orchestrators. |
| **Specialists have tools, not sub-agents** | `canSpawn: false` in all specialist configs |
| **Router is mandatory entry point** | All requests start at router |
| **Orchestrator decides parallelism** | Based on task dependencies, not hardcoded |
| **Fresh context for independent items** | `contextModes.independent: 'fresh'` |
| **Selective context for dependent steps** | `contextModes.dependent: 'selective'` |

### 5.3 Specialist Spawning (V7: Internal Orchestrator Mechanism)

> **V7 Change**: The `spawn_agent` tool has been **removed** from the public tool API. Spawning is now an **internal orchestrator capability**, not an LLM-accessible tool. This prevents LLM hallucination of invalid agent IDs and enforces the 3-level depth limit.

#### 5.3.1 Why Remove spawn_agent Tool?

| Issue with Tool-Based Spawning | V7 Solution |
|-------------------------------|-------------|
| LLM hallucinates invalid agent IDs | Orchestrator has hardcoded `availableSpecialists` list |
| Depth limit bypassed by creative prompting | Specialists have `canSpawn: false` enforced in config |
| Inconsistent parallel/sequential decisions | Orchestrator decides based on task dependencies |
| Redundant session management | Centralized in orchestrator |

#### 5.3.2 How Orchestrator Spawns Specialists

The orchestrator spawns specialists **internally** based on its decomposition plan:

```typescript
// Inside orchestrator logic (not a tool)
class SessionOrchestrator {
  async spawnSpecialists(
    parentSessionId: string,
    subtasks: Subtask[],
    contextMode: 'fresh' | 'inherited' | 'selective'
  ): Promise<SpecialistResult[]> {
    // Validate specialists exist
    for (const subtask of subtasks) {
      if (!this.availableSpecialists.includes(subtask.specialist)) {
        throw new Error(`Unknown specialist: ${subtask.specialist}`);
      }
    }

    // Group by dependency for parallel execution
    const { parallel, sequential } = this.groupByDependency(subtasks);

    // Execute parallel tasks with fresh context
    const parallelResults = await Promise.all(
      parallel.map(subtask =>
        this.spawnSingle(parentSessionId, subtask, contextMode)
      )
    );

    // Execute sequential tasks with selective context
    const sequentialResults = [];
    for (const subtask of sequential) {
      const result = await this.spawnSingle(
        parentSessionId,
        subtask,
        'selective',
        parallelResults  // Pass previous results as context
      );
      sequentialResults.push(result);
    }

    return [...parallelResults, ...sequentialResults];
  }
}
```

#### 5.3.3 Context Modes for Spawned Specialists

| Mode | Use Case | Context Passed |
|------|----------|----------------|
| `fresh` | Independent parallel items (research 5 competitors) | Clean context, no cross-contamination |
| `inherited` | Continuation of parent task | Full parent context |
| `selective` | Dependent step in workflow | Only relevant previous results |

#### 5.3.4 Child Agent Failure & Timeout

| Scenario | Behavior |
|----------|----------|
| **Child completes successfully** | Result collected for synthesis |
| **Child errors** | Error preserved in context (Manus pattern), orchestrator can retry or skip |
| **Child times out** | After `maxDuration` (5 min), child aborted, error recorded |
| **All children complete** | Orchestrator synthesizes results into unified response |

#### 5.3.5 Session Hierarchy

Sessions form a **tree structure** with enforced depth limiting:

```
Root (router, depth: 1)
├── Orchestrator (depth: 2) - for complex tasks
│   ├── research_specialist (depth: 3)
│   ├── research_specialist (depth: 3)
│   └── page_specialist (depth: 3)
│       └── ❌ Cannot spawn (depth limit + canSpawn: false)
│
└── page_specialist (depth: 2) - for simple tasks
    └── ❌ Cannot spawn (canSpawn: false)
```

### 5.4 Session Hierarchy (V7 Depth Enforcement)

Sessions form a **tree structure** with **fixed 3-level maximum depth**. This is not configurable.

```typescript
interface Session {
  id: string;
  parentId: string | null;      // null for root sessions
  agentId: string;              // Which agent config to use
  userId: string;
  cmsType: string;
  status: 'active' | 'paused' | 'completed' | 'error';

  // V7: Fixed 3-level hierarchy
  depth: number;                // 1 = router, 2 = orchestrator/specialist, 3 = spawned specialist
  // maxDepth removed - always 3, enforced by canSpawn: false on specialists

  // Results
  finalResponse?: string;
  artifacts?: string[];         // IDs of created/modified entities

  metadata: {
    totalTokens?: number;
    totalSteps?: number;
    childSessions?: string[];   // IDs of spawned children
  };

  createdAt: number;
  updatedAt: number;
}
```

**V7 Depth Enforcement** (Fixed, not configurable):

| Depth | Agent Type | Can Spawn? | Example |
|-------|------------|------------|---------|
| 1 | Router | Routes only | Routes to orchestrator or specialist |
| 2 | Orchestrator | Yes (internal) | Spawns specialists for subtasks |
| 2 | Specialist | No | Direct from router for simple tasks |
| 3 | Specialist | No | Spawned by orchestrator |

**Enforcement Mechanisms**:
1. `specialist.canSpawn: false` in all specialist configs
2. Orchestrator's `availableSpecialists` list is hardcoded
3. No `spawn_agent` tool exposed to LLM
4. Depth check in orchestrator before spawning

### 5.5 Multi-Agent Execution Flow (V7 Architecture)

V7 introduces a clear 3-level flow: **Router → Orchestrator → Specialists**

#### Example 1: Simple Task (2 Levels)

**User**: "Create a pricing page"

```mermaid
sequenceDiagram
    participant U as User
    participant R as Router
    participant PS as page_specialist
    participant CMS as CMS Server

    U->>R: "Create a pricing page"

    Note over R: Classify: intent=page_building, complexity=simple
    R->>PS: Route to page_specialist

    activate PS
    PS->>CMS: cms_createPage("pricing")
    CMS-->>PS: page_id: "page_123"
    PS->>CMS: cms_addSection(hero)
    PS->>CMS: cms_addSection(pricing_table)
    PS-->>U: "Created pricing page at /pricing"
    deactivate PS
```

**Depth: 2** (Router → Specialist)

#### Example 2: Complex Task (3 Levels)

**User**: "Research our competitors and create a comparison page"

```mermaid
sequenceDiagram
    participant U as User
    participant R as Router
    participant O as Orchestrator
    participant RS as research_specialist
    participant PS as page_specialist
    participant CMS as CMS Server

    U->>R: "Research competitors and create comparison page"

    Note over R: Classify: intent=page_building, complexity=complex (research_then_action)
    R->>O: Route to orchestrator

    activate O
    Note over O: Decompose into subtasks

    O->>RS: Spawn (fresh context): "Research Competitor A"
    O->>RS: Spawn (fresh context): "Research Competitor B"
    O->>RS: Spawn (fresh context): "Research Competitor C"

    Note over RS: 3 parallel research specialists

    RS-->>O: Competitor A analysis
    RS-->>O: Competitor B analysis
    RS-->>O: Competitor C analysis

    Note over O: Collect results, update todo

    O->>PS: Spawn (selective context): "Create comparison page"

    activate PS
    PS->>CMS: cms_createPage("comparison")
    PS->>CMS: cms_addSection(comparison_table)
    PS-->>O: Page created
    deactivate PS

    Note over O: Synthesize results
    O-->>U: "Researched 3 competitors and created comparison at /comparison"
    deactivate O
```

**Depth: 3** (Router → Orchestrator → Specialists)

#### Example 3: Wide Research (Manus Pattern)

**User**: "Research 5 CMS platforms"

```mermaid
sequenceDiagram
    participant U as User
    participant R as Router
    participant O as Orchestrator
    participant RS1 as research_specialist
    participant RS2 as research_specialist
    participant RS3 as research_specialist

    U->>R: "Research 5 CMS platforms"

    Note over R: Classify: intent=web_research, complexity=complex (multi_entity)
    R->>O: Route to orchestrator

    activate O
    Note over O: Decompose: 5 independent research tasks

    par Fresh Context (no cross-contamination)
        O->>RS1: "Research Contentful"
        O->>RS2: "Research Sanity"
        O->>RS3: "Research Strapi"
    end

    RS1-->>O: Contentful report
    RS2-->>O: Sanity report
    RS3-->>O: Strapi report

    Note over O: Synthesize 5 reports into comparison
    O-->>U: Comprehensive CMS comparison report
    deactivate O
```

**Key Pattern**: Fresh context prevents cross-contamination between parallel items.

#### Execution Flow in Code

```typescript
// API Controller: Entry point
@Post('/sessions/:sessionId/message')
async handleUserMessage(
  @Param('sessionId') sessionId: string,
  @Body() body: { message: string },
) {
  // 1. Always starts at router
  const routerResult = await this.routerService.classify(body.message);

  // 2. Route based on complexity
  if (routerResult.complexity === 'simple') {
    // Direct to specialist
    return await this.sessionOrchestrator.runSpecialist(
      sessionId,
      routerResult.targetAgent,
      body.message
    );
  } else {
    // Route to orchestrator for complex tasks
    return await this.sessionOrchestrator.runOrchestrator(
      sessionId,
      body.message,
      routerResult.intent
    );
  }
}
```

**V7 Key Flow Changes**:

| Aspect | V6 | V7 |
|--------|----|----|
| Entry point | Primary agent routes via spawn_agent | Router classifies, routes directly |
| Spawning | LLM calls spawn_agent tool | Orchestrator spawns internally |
| Depth control | maxDepth config | Fixed 3 levels, canSpawn: false |
| Context passing | Always inherited | fresh/inherited/selective modes |
| Complexity assessment | Implicit in prompt | Explicit router config |

### 5.6 Agent Behavior Patterns

Different agents exhibit different behavioral patterns based on their configuration:

#### Pattern A: Simple Q&A (qa agent)
```
User Query → Vector Search → Direct Answer
```
- No planning, no state tracking
- Single-shot retrieval and response
- maxSteps: 3

#### Pattern B: Research Loop (research agent)
```
Query → Search → Analyze → [Need more?] → Search → Synthesize → Report
```
- Multi-step search with synthesis
- Plan tracking enabled
- maxSteps: 10

#### Pattern C: Workflow Execution (page_builder, post_writer)
```
Goal → Plan → [Execute Step → Verify → Update Plan] → Preview → Complete
```
- Full plan tracking with step-by-step execution
- Self-correction on errors
- Can spawn research sub-agents
- Todo list tracks progress
- maxSteps: 15-20

#### Pattern D: Batch Operations (bulk_editor)
```
Goal → List Targets → Plan Changes → [HITL Approval] → Execute Batch → Report
```
- Always requires human approval before execution
- High autonomy but gated by HITL
- maxSteps: 25

### 5.7 Human-in-the-Loop (HITL) Integration

HITL is triggered based on agent permissions and action types:

```typescript
// Permission check before tool execution
async function checkPermission(
  agent: AgentConfig,
  toolCall: ToolCall,
  ctx: ToolContext
): Promise<'allow' | 'ask' | 'deny'> {
  const action = categorizeAction(toolCall.name);  // 'read' | 'write' | 'delete'
  
  if (action === 'delete') {
    return agent.permission.delete;
  }
  if (action === 'write') {
    return agent.permission.write;
  }
  return 'allow';  // reads are always allowed
}

// In SessionProcessor
async function executeTool(toolCall: ToolCall, ctx: ToolContext) {
  const permission = await checkPermission(agent, toolCall, ctx);
  
  if (permission === 'deny') {
    return { success: false, error: 'Action not permitted for this agent' };
  }
  
  if (permission === 'ask') {
    // Pause and wait for user approval
    ctx.eventBus.publish('approval.required', {
      sessionId: ctx.sessionId,
      action: toolCall.name,
      payload: toolCall.arguments,
      preview: await generatePreview(toolCall),
    });
    
    // Session pauses here until approval received
    const approval = await ctx.approvalQueue.waitForApproval(ctx.sessionId);
    
    if (!approval.approved) {
      return { success: false, error: 'Action rejected by user', feedback: approval.feedback };
    }
  }
  
  // Execute the tool
  return await tool.execute(toolCall.arguments, ctx);
}
```

---

## 6. Agent Configuration Schema (Complete)

The `AgentConfig` schema defines how each agent behaves. This schema is designed to expose the full power of AI SDK 6's agent loop capabilities while remaining declarative. See Section 5.2 for concrete examples.

### 6.1 Full AgentConfig Interface

```typescript
interface AgentConfig {
  // ─────────────────────────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────────────────────────
  id: string;
  name: string;
  description: string;

  // V7: Explicit agent types replace implicit mode
  type: 'router' | 'orchestrator' | 'specialist';  // See Section 5.2
  
  // ─────────────────────────────────────────────────────────────
  // MODEL CONFIGURATION
  // Maps to AI SDK model settings
  // ─────────────────────────────────────────────────────────────
  model: {
    default: string;              // e.g., 'gpt-4o', 'claude-sonnet-4-20250514'
    reasoning?: string;           // For complex planning (e.g., 'o1-mini')
    temperature?: number;         // 0-1, controls randomness (default: 0.7)
    topP?: number;                // 0-1, nucleus sampling
    maxOutputTokens?: number;     // Max tokens per response (default: 4096)
  };
  
  // ─────────────────────────────────────────────────────────────
  // SYSTEM PROMPT
  // ─────────────────────────────────────────────────────────────
  prompt: string | { file: string };
  
  // ─────────────────────────────────────────────────────────────
  // TOOL CONFIGURATION
  // Maps to AI SDK tools, activeTools, toolChoice
  // ─────────────────────────────────────────────────────────────
  tools: {
    include: string[];            // ['cms_*', 'web_search'] - patterns allowed
    exclude?: string[];           // ['cms_delete_*']
    searchEnabled?: boolean;      // Use hybrid search for tool discovery
    maxTools?: number;            // Max tools in context (default: 20)
    
    // AI SDK 6: toolChoice parameter
    toolChoice?: 'auto' | 'required' | 'none' | { tool: string };
    // 'auto' = model decides (default)
    // 'required' = must call at least one tool
    // 'none' = no tools this step
    // { tool: 'name' } = force specific tool
  };
  
  // ─────────────────────────────────────────────────────────────
  // LOOP CONTROL (AI SDK 6 stopWhen + prepareStep)
  // Fine-grained control over agent loop behavior
  // ─────────────────────────────────────────────────────────────
  loop: {
    maxSteps: number;             // Maps to stopWhen: stepCountIs(n)
    
    // Additional stop conditions (any triggers stop)
    // Maps to AI SDK 6 stopWhen array
    stopConditions?: {
      onToolCall?: string;        // Stop when this tool is called → hasToolCall()
      onTextContains?: string;    // Stop when response contains string
      custom?: string;            // Reference to custom StopCondition function
    }[];
    
    // Per-step behavior modifications
    // Maps to AI SDK 6 prepareStep callback
    stepBehavior?: {
      // After N steps, restrict available tools
      restrictToolsAfterStep?: {
        step: number;
        tools: string[];          // Only these tools available after step N
      };
      
      // Switch to different model after N steps
      switchModelAfterStep?: {
        step: number;
        model: string;            // Model to switch to
      };
      
      // Change tool choice strategy after N steps
      changeToolChoiceAfterStep?: {
        step: number;
        toolChoice: 'auto' | 'required' | 'none' | { tool: string };
      };
    };
  };
  
  // ─────────────────────────────────────────────────────────────
  // TYPE-SPECIFIC CONFIGURATION (V7)
  // Only one of these should be set based on agent type
  // ─────────────────────────────────────────────────────────────

  // For type: 'router' - Intent classification and routing
  routing?: {
    intents: string[];                          // Recognized intents
    complexityRules: {
      escalateToOrchestrator: string[];         // Patterns that trigger orchestrator
    };
    simpleRoutes: Record<string, string>;       // intent → specialist ID
    complexRoute: string;                       // Always 'orchestrator'
  };

  // For type: 'orchestrator' - Task decomposition and coordination
  orchestration?: {
    decomposition: {
      enabled: boolean;
      maxSubtasks: number;                      // Safety limit (default: 10)
    };
    availableSpecialists: string[];             // Which specialists can be spawned
    spawning: {
      maxConcurrent: number;                    // Max parallel specialists
    };
    contextModes: {
      independent: 'fresh' | 'inherited';       // For parallel items
      dependent: 'selective' | 'inherited';     // For sequential workflow
    };
    todoTracking: boolean;                      // Enable progress tracking
    synthesis: {
      enabled: boolean;                         // Combine results into unified response
    };
  };

  // For type: 'specialist' - Domain-specific execution
  specialist?: {
    domain: string;                             // Domain identifier
    tools: string[];                            // Allowed tools for this specialist
    maxSteps: number;                           // Max execution steps
    canSpawn: false;                            // Specialists NEVER spawn (enforced)
  };

  // ─────────────────────────────────────────────────────────────
  // SPAWNING CONFIGURATION (DEPRECATED - use orchestration config)
  // Kept for backward compatibility during migration
  // ─────────────────────────────────────────────────────────────
  spawning?: {
    enabled: boolean;             // Can use spawn_agent tool (replaces canSpawnAgents)
    mode: 'parallel' | 'sequential';  // How multiple spawn calls execute
    // 'parallel' = Promise.all (default, faster)
    // 'sequential' = one at a time (predictable, ordered)
    maxConcurrent?: number;       // Max parallel children (default: 5)
  };
  
  // ─────────────────────────────────────────────────────────────
  // STREAMING CONFIGURATION
  // Maps to AI SDK 6 experimental_transform
  // ─────────────────────────────────────────────────────────────
  streaming?: {
    smoothStream?: boolean;       // Enable smooth streaming transform
    delayMs?: number;             // Delay between chunks (default: 15ms)
    chunking?: 'word' | 'line';   // How to chunk output
  };
  
  // ─────────────────────────────────────────────────────────────
  // PERMISSIONS (affects HITL triggers)
  // ─────────────────────────────────────────────────────────────
  permission: {
    write: 'allow' | 'ask' | 'deny';
    delete: 'allow' | 'ask' | 'deny';
  };
  
  // ─────────────────────────────────────────────────────────────
  // SAFETY & ERROR HANDLING
  // ─────────────────────────────────────────────────────────────
  doomLoop?: 'ask' | 'deny' | 'allow';  // Doom loop handling (default: 'ask')
  
  // ─────────────────────────────────────────────────────────────
  // MEMORY
  // ─────────────────────────────────────────────────────────────
  memory: {
    compactionEnabled: boolean;   // Auto-summarize long contexts
    todoEnabled: boolean;         // Enable todowrite/todoread tools
  };
}
```

### 6.2 Config to AI SDK 6 Mapping

The `SessionProcessor` translates `AgentConfig` to AI SDK 6 calls:

| AgentConfig Field | AI SDK 6 Parameter |
|-------------------|-------------------|
| `model.default` | `model` |
| `model.temperature` | `temperature` |
| `model.topP` | `topP` |
| `model.maxOutputTokens` | `maxOutputTokens` |
| `tools.toolChoice` | `toolChoice` |
| `loop.maxSteps` | `stopWhen: stepCountIs(n)` |
| `loop.stopConditions.onToolCall` | `stopWhen: hasToolCall(name)` |
| `loop.stepBehavior.*` | `prepareStep` callback |
| `streaming.smoothStream` | `experimental_transform: smoothStream()` |

### 6.3 Example: V7 Specialist with Loop Control

```typescript
const pageSpecialist: AgentConfig = {
  id: 'page_specialist',
  name: 'Page Specialist',
  description: 'Creates and composes pages from section templates',
  type: 'specialist',  // V7: uses type, not mode

  model: {
    default: 'gpt-4o',
    temperature: 0.3,
    maxOutputTokens: 4096,
  },

  prompt: { file: 'prompts/page-specialist.prompt.md' },

  // V7: Specialist-specific config
  specialist: {
    domain: 'page_building',
    tools: [
      'cms_createPage',
      'cms_getPage',
      'cms_updatePage',
      'cms_addSection',
      'cms_updateSection',
      'cms_listTemplates',
      'image_search',
    ],
    maxSteps: 15,
    canSpawn: false,  // V7: Specialists never spawn
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

### 6.4 Example: V7 Simple Specialist

```typescript
const qaSpecialist: AgentConfig = {
  id: 'qa_specialist',
  name: 'Q&A Specialist',
  description: 'Answers questions from knowledge base',
  type: 'specialist',  // V7: uses type, not mode

  model: {
    default: 'gpt-4o-mini',
    temperature: 0.5,
  },

  prompt: { file: 'prompts/qa-specialist.prompt.md' },

  // V7: Specialist-specific config
  specialist: {
    domain: 'cms_query',
    tools: ['vector_search', 'cms_listPages', 'cms_getPage'],
    maxSteps: 5,
    canSpawn: false,
  },

  loop: {
    maxSteps: 5,
  },

  permission: { write: 'deny', delete: 'deny' },
  
  memory: {
    compactionEnabled: false,
    todoEnabled: false,
  },
};
```

---

## 7. Session Processor Flow (Complete)

The Session Processor runs the core agent loop. It handles both root sessions (Primary agent) and child sessions (spawned specialists). See Section 5.5 for multi-agent execution flow.

### 7.1 Error Handling Strategy

The agent loop handles errors at three levels:

| Error Type | Behavior | Example |
|------------|----------|---------|
| **Retryable API error** | Retry with backoff (max 3 attempts, 30s max delay) | Network timeout, rate limit (429), server error (5xx) |
| **Non-retryable tool error** | Return error to agent, let it decide next action | Invalid input, resource not found, validation failure |
| **Fatal error** | Abort session, emit `session.error` event | Auth failure, malformed response, abort signal |

**Retry Logic (OpenCode-aligned):**

```typescript
interface RetryConfig {
  maxAttempts: 3;
  maxDelayMs: 30_000;  // Cap delay at 30 seconds
}

async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let attempt = 0;
  
  while (attempt < config.maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      // Only retry API errors with isRetryable flag
      if (!isRetryableError(error) || attempt >= config.maxAttempts) {
        throw error;
      }
      
      // Respect retry-after headers from API responses
      const delay = getRetryDelay(error, config.maxDelayMs);
      await sleep(delay);
    }
  }
}

function getRetryDelay(error: unknown, maxDelay: number): number {
  // 1. Check for retry-after-ms header (milliseconds)
  if (error.headers?.['retry-after-ms']) {
    return Math.min(parseInt(error.headers['retry-after-ms']), maxDelay);
  }
  
  // 2. Check for retry-after header (seconds)
  if (error.headers?.['retry-after']) {
    return Math.min(parseInt(error.headers['retry-after']) * 1000, maxDelay);
  }
  
  // 3. Default exponential backoff capped at maxDelay
  return Math.min(1000 * Math.pow(2, attempt), maxDelay);
}

function isRetryableError(error: unknown): boolean {
  // Only retry specific API error conditions
  return (
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    error.status === 429 ||  // Rate limit
    error.status === 503 ||  // Service unavailable
    error.status === 502 ||  // Bad gateway
    (error.status >= 500 && error.status < 600)  // Server errors
  );
}
```

The agent receives non-retryable tool errors as results and can self-correct (e.g., try different parameters). Fatal errors terminate the session immediately.

### 7.2 Doom Loop Detection

A doom loop occurs when the agent repeatedly takes the same ineffective action. Detection heuristic (OpenCode-aligned):

**Detection Criteria:**
- **Same tool called 3+ times** with **exactly identical parameters** (compared via `JSON.stringify`)
- Comparison is exact - no fuzzy matching or "near-identical" heuristics

**Permission Modes per Agent:**

Agents can be configured with different doom loop handling behaviors:

```typescript
interface AgentConfig {
  // ... other fields
  doomLoop: 'ask' | 'deny' | 'allow';
}
```

| Mode | Behavior | Use Case |
|------|----------|----------|
| `'ask'` | Pause and request HITL guidance | Default for most agents |
| `'deny'` | Block the repeated call, return error to agent | Strict agents that shouldn't retry |
| `'allow'` | Allow the call (agent may have valid reason) | Research agents doing iterative refinement |

**Detection Implementation:**

```typescript
class DoomLoopDetector {
  private recentCalls: Map<string, { params: string; count: number }[]> = new Map();
  
  check(sessionId: string, toolName: string, params: unknown): 'allow' | 'blocked' {
    const key = `${sessionId}:${toolName}`;
    const paramsStr = JSON.stringify(params);  // Exact comparison
    
    const history = this.recentCalls.get(key) || [];
    const matchingCall = history.find(h => h.params === paramsStr);
    
    if (matchingCall) {
      matchingCall.count++;
      if (matchingCall.count >= 3) {
        return 'blocked';  // Doom loop detected
      }
    } else {
      history.push({ params: paramsStr, count: 1 });
    }
    
    // Keep only last 5 unique calls per tool
    this.recentCalls.set(key, history.slice(-5));
    return 'allow';
  }
  
  reset(sessionId: string): void {
    // Clear history when session receives new user input
    for (const key of this.recentCalls.keys()) {
      if (key.startsWith(sessionId)) {
        this.recentCalls.delete(key);
      }
    }
  }
}
```

When detected, behavior depends on agent's `doomLoop` setting:
- `'ask'`: Emit `agent.stuck` event, pause for HITL. User can provide guidance or abort.
- `'deny'`: Return error to agent: `"Doom loop detected: same tool called 3 times with identical parameters"`
- `'allow'`: Log warning, allow the call to proceed

### 7.3 Tool Name Repair

LLMs occasionally call tools with incorrect casing (e.g., `WebSearch` instead of `web_search`). Before rejecting an unknown tool, the processor attempts case-insensitive repair:

```typescript
function repairToolName(
  requestedName: string, 
  availableTools: Map<string, ToolDefinition>
): string | null {
  // 1. Exact match - return as-is
  if (availableTools.has(requestedName)) {
    return requestedName;
  }
  
  // 2. Case-insensitive match
  const lowerRequested = requestedName.toLowerCase();
  for (const [name, tool] of availableTools) {
    if (name.toLowerCase() === lowerRequested) {
      return name;  // Return correct casing
    }
  }
  
  // 3. No match found
  return null;
}

// Usage in SessionProcessor
async function executeTool(call: ToolCall, ctx: ToolContext) {
  const repairedName = repairToolName(call.name, this.availableTools);
  
  if (!repairedName) {
    return { 
      success: false, 
      error: `Unknown tool: ${call.name}. Available tools: ${[...this.availableTools.keys()].join(', ')}` 
    };
  }
  
  // Use repaired name for execution
  const tool = this.availableTools.get(repairedName);
  return await tool.execute(call.arguments, ctx);
}
```

This reduces unnecessary failures from minor LLM mistakes without compromising security (only exact case-insensitive matches are allowed).

### 7.4 Session Processor Flow

The Session Processor runs the agent loop for **ONE session** using AI SDK 6. It translates `AgentConfig` into AI SDK parameters and handles tool execution.

#### 7.4.1 Processor Result Type

```typescript
interface ProcessorResult {
  finalResponse: string;
  artifacts: string[];
  totalTokens: number;
  totalSteps: number;
}
```

#### 7.4.2 AI SDK 6 Integration

The processor translates `AgentConfig` fields to AI SDK 6 parameters:

```typescript
import { 
  streamText, 
  stepCountIs, 
  hasToolCall, 
  smoothStream,
  type StopCondition 
} from 'ai';

class SessionProcessor {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly agentFactory: AgentFactory,
    private readonly adapterRegistry: AdapterRegistry,
    private readonly toolRegistry: ToolRegistry,
    private readonly toolSearch: HybridToolSearchService,
    private readonly compaction: CompactionService,
    private readonly doomLoopDetector: DoomLoopDetector,
    private readonly eventBus: EventBus,
    private readonly orchestrator: SessionOrchestrator,
  ) {}
  
  async run(
    sessionId: string, 
    userMessage: string,
    abortSignal: AbortSignal,
  ): Promise<ProcessorResult> {
    const session = await this.sessionStore.get(sessionId);
    const agent = await this.agentFactory.get(session.agentId, session.cmsType);
    const adapter = await this.adapterRegistry.get(session.cmsType);
    
    // 1. Check compaction
    if (await this.compaction.shouldCompact(session, agent.model)) {
      await this.compaction.compact(session);
    }
    
    // 2. Resolve tools
    const tools = await this.resolveTools(agent, adapter, userMessage);
    
    // 3. Build tool context
    const toolContext: ToolContext = {
      sessionId,
      agentId: session.agentId,
      userId: session.userId,
      cmsType: session.cmsType,
      abortSignal,
      eventBus: this.eventBus,
      orchestrator: this.orchestrator,
      spawningMode: agent.spawning?.mode || 'parallel',
    };
    
    // 4. Build AI SDK tools with context injection
    const aiSdkTools = this.buildAiSdkTools(tools, toolContext, agent);
    
    // 5. Build messages
    const systemPrompt = await this.buildSystemPrompt(agent, adapter);
    const messages = [
      ...session.messages,
      { role: 'user' as const, content: userMessage },
    ];
    
    // 6. Build stop conditions from AgentConfig
    const stopConditions = this.buildStopConditions(agent);
    
    // 7. Build prepareStep callback from AgentConfig
    const prepareStep = this.buildPrepareStep(agent, tools);
    
    // 8. Build streaming transform
    const transform = agent.streaming?.smoothStream
      ? smoothStream({ 
          delayInMs: agent.streaming.delayMs || 15,
          chunking: agent.streaming.chunking || 'word',
        })
      : undefined;
    
    // 9. Execute with AI SDK 6 streamText
    const result = await streamText({
      model: this.getModel(agent.model.default),
      system: systemPrompt,
      messages,
      tools: aiSdkTools,
      toolChoice: agent.tools.toolChoice || 'auto',
      
      // Loop control (AI SDK 6)
      stopWhen: stopConditions,
      prepareStep,
      
      // Model settings
      temperature: agent.model.temperature,
      topP: agent.model.topP,
      maxOutputTokens: agent.model.maxOutputTokens,
      
      // Streaming
      experimental_transform: transform,
      
      // Abort
      abortSignal,
      
      // Callbacks for event emission
      onStepFinish: ({ stepType, usage, toolCalls }) => {
        this.eventBus.publish('agent.thinking', {
          sessionId,
          stepType,
          toolCalls: toolCalls?.map(tc => tc.toolName),
        });
      },
    });
    
    // 10. Consume stream and collect results
    const artifacts: string[] = [];
    let finalResponse = '';
    
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        finalResponse += part.textDelta;
      }
      if (part.type === 'tool-result' && part.result?.artifacts) {
        artifacts.push(...part.result.artifacts);
      }
    }
    
    // 11. Get final metrics
    const { steps, usage } = await result;
    
    // 12. Persist final response
    await this.sessionStore.addMessage(sessionId, {
      role: 'assistant',
      content: finalResponse,
    });
    
    return {
      finalResponse,
      artifacts,
      totalTokens: usage?.totalTokens || 0,
      totalSteps: steps.length,
    };
  }
  
  /**
   * Build AI SDK 6 stopWhen conditions from AgentConfig.loop
   */
  private buildStopConditions(agent: AgentConfig): StopCondition<any>[] {
    const conditions: StopCondition<any>[] = [];
    
    // Always add maxSteps
    conditions.push(stepCountIs(agent.loop.maxSteps));
    
    // Add custom stop conditions
    if (agent.loop.stopConditions) {
      for (const cond of agent.loop.stopConditions) {
        if (cond.onToolCall) {
          conditions.push(hasToolCall(cond.onToolCall));
        }
        if (cond.onTextContains) {
          const marker = cond.onTextContains;
          conditions.push(({ steps }) => 
            steps.some(s => s.text?.includes(marker)) ?? false
          );
        }
        if (cond.custom) {
          conditions.push(this.customStopConditions[cond.custom]);
        }
      }
    }
    
    return conditions;
  }
  
  /**
   * Build AI SDK 6 prepareStep callback from AgentConfig.loop.stepBehavior
   */
  private buildPrepareStep(agent: AgentConfig, tools: Record<string, any>) {
    const behavior = agent.loop.stepBehavior;
    if (!behavior) return undefined;
    
    return async ({ stepNumber, steps }: { stepNumber: number; steps: any[] }) => {
      const result: any = {};
      
      // Restrict tools after N steps
      if (behavior.restrictToolsAfterStep && 
          stepNumber >= behavior.restrictToolsAfterStep.step) {
        result.activeTools = behavior.restrictToolsAfterStep.tools;
      }
      
      // Switch model after N steps
      if (behavior.switchModelAfterStep && 
          stepNumber >= behavior.switchModelAfterStep.step) {
        result.model = this.getModel(behavior.switchModelAfterStep.model);
      }
      
      // Change tool choice after N steps
      if (behavior.changeToolChoiceAfterStep && 
          stepNumber >= behavior.changeToolChoiceAfterStep.step) {
        result.toolChoice = behavior.changeToolChoiceAfterStep.toolChoice;
      }
      
      return Object.keys(result).length > 0 ? result : undefined;
    };
  }
  
  /**
   * Build AI SDK tools with spawn execution mode handling
   */
  private buildAiSdkTools(
    tools: Record<string, ToolDefinition>,
    ctx: ToolContext,
    agent: AgentConfig,
  ) {
    const aiSdkTools: Record<string, any> = {};
    
    for (const [name, toolDef] of Object.entries(tools)) {
      aiSdkTools[name] = {
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute: async (params: any) => {
          // Doom loop check
          const doomResult = this.doomLoopDetector.check(ctx.sessionId, name, params);
          if (doomResult === 'blocked') {
            return this.handleDoomLoop(agent, ctx, name);
          }
          
          this.eventBus.publish('tool.executing', { 
            sessionId: ctx.sessionId, 
            tool: name 
          });
          
          const result = await toolDef.execute(params, ctx);
          
          this.eventBus.publish('tool.completed', { 
            sessionId: ctx.sessionId, 
            tool: name, 
            result 
          });
          
          return result;
        },
      };
    }
    
    return aiSdkTools;
  }
  
  /**
   * Execute multiple tool calls respecting spawning mode
   */
  async executeToolCalls(
    calls: ToolCall[],
    ctx: ToolContext,
    tools: Record<string, any>,
  ): Promise<any[]> {
    if (ctx.spawningMode === 'sequential') {
      // Execute one at a time
      const results = [];
      for (const call of calls) {
        results.push(await tools[call.name].execute(call.arguments));
      }
      return results;
    } else {
      // Execute in parallel (default)
      return Promise.all(
        calls.map(call => tools[call.name].execute(call.arguments))
      );
    }
  }
}
```

#### 7.4.3 AgentConfig to AI SDK 6 Mapping Summary

| AgentConfig | AI SDK 6 | Notes |
|-------------|----------|-------|
| `model.default` | `model` | Provider model string |
| `model.temperature` | `temperature` | 0-1 |
| `model.topP` | `topP` | 0-1 |
| `model.maxOutputTokens` | `maxOutputTokens` | Per-response limit |
| `tools.toolChoice` | `toolChoice` | 'auto' \| 'required' \| 'none' |
| `loop.maxSteps` | `stopWhen: stepCountIs(n)` | Primary stop condition |
| `loop.stopConditions.onToolCall` | `stopWhen: hasToolCall(name)` | Stop on tool |
| `loop.stopConditions.onTextContains` | Custom `StopCondition` | Stop on text marker |
| `loop.stepBehavior.restrictToolsAfterStep` | `prepareStep → activeTools` | Dynamic tool filtering |
| `loop.stepBehavior.switchModelAfterStep` | `prepareStep → model` | Dynamic model switching |
| `loop.stepBehavior.changeToolChoiceAfterStep` | `prepareStep → toolChoice` | Dynamic tool choice |
| `streaming.smoothStream` | `experimental_transform: smoothStream()` | Smooth streaming |
| `spawning.mode` | Custom execution logic | parallel \| sequential |

#### 7.4.4 Key Design Points

| Aspect | Design Decision |
|--------|-----------------|
| **AI SDK 6 native** | Uses `streamText` with `stopWhen` and `prepareStep` |
| **Config-driven** | All behavior controlled via AgentConfig |
| **Spawning mode** | Parallel (Promise.all) or sequential (for loop) |
| **Stop conditions** | Multiple conditions via array, any triggers stop |
| **Dynamic behavior** | `prepareStep` enables per-step modifications |
| **Streaming** | Optional smooth streaming with configurable chunking |

---

## 8. Event Bus Events (Complete List)

### 8.1 Session Events
| Event | Payload | Subscribers |
|-------|---------|-------------|
| `session.started` | `{ sessionId, agentId, userId, parentId? }` | Logging, Analytics, UI |
| `session.compacted` | `{ sessionId, tokensBefore, tokensAfter }` | Logging |
| `session.completed` | `{ sessionId, result, artifacts }` | Logging, Parent Session |
| `session.error` | `{ sessionId, error, recoverable }` | Logging, UI, Alerting |

### 8.2 Agent Events
| Event | Payload | Subscribers |
|-------|---------|-------------|
| `agent.thinking` | `{ sessionId, step, maxSteps }` | UI (SSE) |
| `agent.stuck` | `{ sessionId, lastToolCalls, reason }` | UI (HITL prompt) |
| `agent.response` | `{ sessionId, content, finishReason }` | UI (SSE) |

### 8.3 Multi-Agent Events
| Event | Payload | Subscribers |
|-------|---------|-------------|
| `agent.spawned` | `{ parentSessionId, childSessionId, agentId, task }` | UI (hierarchy view), Logging |
| `agent.child_completed` | `{ parentSessionId, childSessionId, agentId, result }` | Parent Session, UI |
| `agent.handoff` | `{ fromAgent, toAgent, sessionId, reason }` | Logging, Analytics |

### 8.4 Tool Events
| Event | Payload | Subscribers |
|-------|---------|-------------|
| `tool.executing` | `{ sessionId, tool, input, step }` | UI (SSE), Logging |
| `tool.completed` | `{ sessionId, tool, result, durationMs }` | UI (SSE), Logging |
| `tool.error` | `{ sessionId, tool, error, isRetryable }` | UI (SSE), Alerting |

### 8.5 Approval Events (HITL)
| Event | Payload | Subscribers |
|-------|---------|-------------|
| `approval.required` | `{ sessionId, action, resource, preview }` | UI (HITL modal) |
| `approval.received` | `{ sessionId, action, approved, feedback? }` | Session Processor |

### 8.6 Todo Events
| Event | Payload | Subscribers |
|-------|---------|-------------|
| `todo.updated` | `{ sessionId, todos }` | UI (plan view) |

---

## 9. Implementation Stages (Revised)

### Stage 1: Core Infrastructure (Week 1)
- NestJS Agent Server scaffold
- Event Bus implementation
- Session Store (SQLite/Postgres) with parent/child hierarchy
- **Session Service** (CRUD operations)
- Redis + BullMQ setup

### Stage 2: Agent Runtime Core (Week 2)
- **Agent Factory** - loads and caches AgentConfig
- **Session Processor** - runs single agent loop
- **Session Orchestrator** - manages lifecycle and multi-agent coordination
- Doom loop detector
- Retry strategy (with `retry-after` header support)
- Tool name repair

### Stage 3: Tool Subsystem (Week 3)
- Tool Registry
- Per-tool folder structure for shared tools
- Hybrid Search (BM25 + Vector)
- Tool Context injection (with orchestrator reference)
- **spawn_agent tool implementation** (delegates to orchestrator)

### Stage 4: Memory Subsystem (Week 4)
- Todo Service (OpenCode-style plan tracking)
- Compaction Service
- Provider token counting integration

### Stage 5: Adapter Pattern (Week 5)
- CmsAdapter interface
- InternalCmsAdapter implementation
- Dynamic tool loading from adapters
- Agent configs bundled in adapters (merged by AgentFactory)

### Stage 6: Multi-Agent Agents (Week 6)
- AgentConfig definitions for all agent types
- **Primary agent (router) implementation**
- **Domain agents (page_builder, post_writer, etc.)**
- Shared agents (qa, research)
- End-to-end multi-agent flow testing

### Stage 7: CMS Server (Week 7)
- NestJS CMS Server scaffold (Internal CMS only)
- REST API for Pages, Sections, Posts, Media
- Webhook dispatch to Agent Server on content changes
- No workers here - all processing happens in Agent Server

### Stage 8: Integration & UI (Week 8-9)
- SSE streaming from Event Bus
- Next.js Chat UI with **session hierarchy view**
- HITL approval flow
- **Child agent progress indicators**
- Website Renderer connection

---

## 10. Directory Structure (Complete)

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
│   │   │   │   │   ├── session.orchestrator.ts  # Entry point, manages lifecycle
│   │   │   │   │   ├── session.processor.ts     # Runs single agent loop
│   │   │   │   │   ├── session.store.ts
│   │   │   │   │   ├── doom-loop.detector.ts
│   │   │   │   │   └── session.module.ts
│   │   │   │   └── agent/
│   │   │   │       ├── agent.factory.ts         # Loads/caches AgentConfig
│   │   │   │       ├── agent.config.ts          # AgentConfig interface
│   │   │   │       └── agent.module.ts
│   │   │   ├── memory/
│   │   │   │   ├── todo.service.ts
│   │   │   │   ├── compaction.service.ts
│   │   │   │   └── memory.module.ts
│   │   │   ├── tools/
│   │   │   │   ├── _registry/
│   │   │   │   ├── _search/
│   │   │   │   ├── _loaders/
│   │   │   │   └── shared/
│   │   │   ├── adapters/
│   │   │   │   ├── adapter.interface.ts
│   │   │   │   ├── adapter.registry.ts
│   │   │   │   ├── internal/              # Internal CMS Adapter Bundle
│   │   │   │   │   ├── tools/
│   │   │   │   │   ├── prompts/
│   │   │   │   │   ├── agents/
│   │   │   │   │   ├── schemas/
│   │   │   │   │   └── index.ts
│   │   │   │   ├── contentful/            # Contentful Adapter Bundle
│   │   │   │   │   ├── tools/
│   │   │   │   │   ├── prompts/
│   │   │   │   │   ├── agents/
│   │   │   │   │   ├── schemas/
│   │   │   │   │   └── index.ts
│   │   │   │   └── adapters.module.ts
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
│   ├── cms-server/                # NestJS @ 3001 (Internal CMS only)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── sections/
│   │   │   ├── posts/
│   │   │   ├── media/
│   │   │   │   ├── media.controller.ts
│   │   │   │   └── media.service.ts
│   │   │   └── templates/
│   │   └── package.json
│   │
│   ├── chat-ui/                   # Next.js Chat Interface
│   │   └── ...
│   │
│   └── website-renderer/          # Next.js @ 3000
│       └── ...
│
├── packages/
│   ├── shared-types/              # Shared TypeScript types
│   └── cms-adapter-sdk/           # SDK for building adapters
│
└── package.json                   # Monorepo root
```

---

## 10.1 Monorepo & Development Environment Setup

### 10.1.1 Tooling Stack

| Tool | Purpose | Version |
|------|---------|---------|
| **pnpm** | Package manager with workspace support | 9.x |
| **Turborepo** | Monorepo build orchestration, caching | 2.x |
| **Docker Compose** | Local infrastructure (Redis, PostgreSQL) | 3.8+ |
| **TypeScript** | Shared type safety across all apps | 5.x |
| **Biome** | Linting and formatting (fast, unified) | 1.x |

### 10.1.2 Root Configuration Files

```
cms-agent/                          # Monorepo root
├── apps/
│   ├── agent-server/
│   ├── cms-server/
│   ├── chat-ui/
│   └── website-renderer/
├── packages/
│   ├── shared-types/
│   ├── db-schema/                  # Shared Drizzle schema
│   └── config/                     # Shared configs (tsconfig, biome)
├── docker/
│   ├── docker-compose.yml          # Local infrastructure
│   ├── docker-compose.prod.yml     # Production setup
│   └── Dockerfile.agent-server     # Individual Dockerfiles
├── .env.example                    # Environment template
├── .env                            # Local environment (gitignored)
├── turbo.json                      # Turborepo config
├── pnpm-workspace.yaml             # Workspace definition
├── package.json                    # Root scripts
└── biome.json                      # Linting config
```

### 10.1.3 pnpm Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 10.1.4 Turborepo Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

### 10.1.5 Docker Compose (Local Development)

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  # ═══════════════════════════════════════════════════════════
  # INFRASTRUCTURE (Always running)
  # ═══════════════════════════════════════════════════════════
  
  postgres:
    image: postgres:16-alpine
    container_name: cms-postgres
    environment:
      POSTGRES_USER: cms
      POSTGRES_PASSWORD: cms_dev_password
      POSTGRES_DB: cms_agent
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cms"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: cms-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ═══════════════════════════════════════════════════════════
  # APPLICATIONS (Optional - can run locally with pnpm dev)
  # ═══════════════════════════════════════════════════════════
  
  # Uncomment to run apps in Docker instead of locally
  
  # agent-server:
  #   build:
  #     context: ..
  #     dockerfile: docker/Dockerfile.agent-server
  #   container_name: cms-agent-server
  #   ports:
  #     - "8787:8787"
  #   environment:
  #     - DATABASE_URL=postgresql://cms:cms_dev_password@postgres:5432/cms_agent
  #     - REDIS_URL=redis://redis:6379
  #     - CMS_SERVER_URL=http://cms-server:3001
  #   depends_on:
  #     postgres:
  #       condition: service_healthy
  #     redis:
  #       condition: service_healthy
  
  # cms-server:
  #   build:
  #     context: ..
  #     dockerfile: docker/Dockerfile.cms-server
  #   container_name: cms-cms-server
  #   ports:
  #     - "3001:3001"
  #   environment:
  #     - DATABASE_URL=postgresql://cms:cms_dev_password@postgres:5432/cms_agent
  #   depends_on:
  #     postgres:
  #       condition: service_healthy

volumes:
  postgres_data:
  redis_data:
```

### 10.1.6 Environment Variables

```bash
# .env.example

# ═══════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════
DATABASE_URL=postgresql://cms:cms_dev_password@localhost:5432/cms_agent

# ═══════════════════════════════════════════════════════════
# REDIS (Job Queue)
# ═══════════════════════════════════════════════════════════
REDIS_URL=redis://localhost:6379

# ═══════════════════════════════════════════════════════════
# SERVICE URLs (Inter-service communication)
# ═══════════════════════════════════════════════════════════
AGENT_SERVER_URL=http://localhost:8787
CMS_SERVER_URL=http://localhost:3001
WEBSITE_URL=http://localhost:3000

# ═══════════════════════════════════════════════════════════
# AI PROVIDERS
# ═══════════════════════════════════════════════════════════
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# ═══════════════════════════════════════════════════════════
# EXTERNAL SERVICES (Optional)
# ═══════════════════════════════════════════════════════════
# EXA_API_KEY=...
# CONTENTFUL_ACCESS_TOKEN=...
# SANITY_PROJECT_ID=...
```

### 10.1.7 Root package.json Scripts

```json
// package.json (root)
{
  "name": "cms-agent",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "biome format --write .",
    "clean": "turbo clean && rm -rf node_modules",
    
    "docker:up": "docker compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.yml down",
    "docker:logs": "docker compose -f docker/docker-compose.yml logs -f",
    "docker:reset": "docker compose -f docker/docker-compose.yml down -v && docker compose -f docker/docker-compose.yml up -d",
    
    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate",
    "db:studio": "pnpm --filter @cms-agent/cms-server db:studio",
    
    "dev:agent": "pnpm --filter @cms-agent/agent-server dev",
    "dev:cms": "pnpm --filter @cms-agent/cms-server dev",
    "dev:chat": "pnpm --filter @cms-agent/chat-ui dev",
    "dev:website": "pnpm --filter @cms-agent/website-renderer dev"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.14.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

### 10.1.8 Shared Packages

#### `packages/shared-types`

Shared TypeScript types used across all apps:

```typescript
// packages/shared-types/src/index.ts
export * from './session.js';
export * from './agent.js';
export * from './tool.js';
export * from './events.js';
```

```json
// packages/shared-types/package.json
{
  "name": "@cms-agent/shared-types",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

#### `packages/db-schema`

Shared Drizzle schema for both agent-server and cms-server:

```typescript
// packages/db-schema/src/schema.ts
import { pgTable, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  parentId: text('parent_id').references(() => sessions.id),
  userId: text('user_id').references(() => users.id),
  agentId: text('agent_id').notNull(),
  cmsType: text('cms_type').notNull(),
  status: text('status').notNull().default('active'),
  depth: integer('depth').notNull().default(0),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  toolCalls: jsonb('tool_calls'),
  toolResults: jsonb('tool_results'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const todos = pgTable('todos', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'),
  priority: text('priority').notNull().default('medium'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 10.1.9 Development Workflow

```bash
# 1. Clone and install
git clone <repo>
cd cms-agent
pnpm install

# 2. Start infrastructure (PostgreSQL + Redis)
pnpm docker:up

# 3. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 4. Run database migrations
pnpm db:migrate

# 5. Start all apps in development mode
pnpm dev

# Or start individual apps:
pnpm dev:agent    # Agent Server @ 8787
pnpm dev:cms      # CMS Server @ 3001
pnpm dev:chat     # Chat UI @ 3002
pnpm dev:website  # Website @ 3000
```

### 10.1.10 Service Ports Summary

| Service | Port | Description |
|---------|------|-------------|
| **website-renderer** | 3000 | Public website (Next.js) |
| **cms-server** | 3001 | Internal CMS API (NestJS) |
| **chat-ui** | 3002 | Agent chat interface (Next.js) |
| **agent-server** | 8787 | AI agent runtime (NestJS) |
| **PostgreSQL** | 5432 | Database |
| **Redis** | 6379 | Job queue |

### 10.1.11 Individual App Dockerfiles (Production)

```dockerfile
# docker/Dockerfile.agent-server
FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @cms-agent/agent-server build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/agent-server/dist ./dist
COPY --from=builder /app/apps/agent-server/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8787
CMD ["node", "dist/main.js"]
```

---

## 11. Summary: V7 Complete Feature Set

### 11.1 What V6 Added Over V5

| Aspect | V5 | V6 |
|--------|----|----|
| **Multi-Agent** | Agent catalog defined | Full orchestration with session hierarchy, depth limiting |
| **Tool Management** | Simple list | Hybrid Search + Per-folder structure |
| **Memory** | Basic compaction | Compaction + Simple Todo (OpenCode-style) |
| **Token Counting** | Not specified | Provider-anchored compaction |
| **Background Jobs** | Not specified | BullMQ + Redis in Agent Server |
| **Tool Loading** | Static | Dynamic from Adapters + Search |
| **Adapter Structure** | Conceptual | Bundled tools/prompts/agents/schemas |
| **Data Storage** | Not specified | Internal CMS Server stores all agent data |
| **Implementation Plan** | 4 weeks | 8 weeks (more complete) |

### 11.2 What V7 Adds Over V6

| Aspect | V6 | V7 |
|--------|----|----|
| **Agent Types** | `mode: primary/general/domain` | `type: router/orchestrator/specialist` |
| **Spawning** | spawn_agent tool exposed to LLM | Internal orchestrator mechanism |
| **Routing** | Implicit in primary agent prompt | Explicit router with complexity assessment |
| **Orchestrators** | Potentially multiple | ONE domain-agnostic orchestrator |
| **Depth Limiting** | Configurable maxDepth | Fixed at 3, enforced by canSpawn: false |
| **Context Passing** | Always inherited | fresh/inherited/selective modes |
| **Feature Flags** | None | SystemConfig for incremental rollout |

### 11.3 V7 Multi-Agent Architecture Summary

```mermaid
graph TD
    User((User)) -->|Message| Router

    subgraph "Level 1"
        Router[Router<br/>---<br/>Classifies intent<br/>Assesses complexity]
    end

    Router -->|"Simple"| PageS[page_specialist]
    Router -->|"Simple"| QAS[qa_specialist]
    Router -->|"Complex"| Orch[Orchestrator]

    subgraph "Level 2"
        Orch[Orchestrator<br/>---<br/>Decomposes tasks<br/>Spawns specialists<br/>Synthesizes results]
    end

    Orch -->|"spawn (fresh)"| RS1[research_specialist]
    Orch -->|"spawn (fresh)"| RS2[research_specialist]
    Orch -->|"spawn (selective)"| PS[page_specialist]

    subgraph "Level 3"
        RS1
        RS2
        PS
    end

    RS1 -->|result| Orch
    RS2 -->|result| Orch
    PS -->|result| Orch

    PageS -->|Response| User
    QAS -->|Response| User
    Orch -->|Response| User
```

### 11.4 Key Design Principles (V7 Updated)

1. **Agents are Configurations**: Not hardcoded classes. Each agent is defined by `AgentConfig` with `type`, tools, permissions, and autonomy settings.

2. **3-Level Maximum Depth**: Router → Orchestrator → Specialists. Fixed, not configurable.

3. **ONE Orchestrator**: Domain knowledge lives in specialists and their prompts. Orchestrator is a domain-agnostic coordinator.

4. **Specialists Cannot Spawn**: `canSpawn: false` enforced in all specialist configs. Tools only, no sub-agents.

5. **Context Modes**: Fresh context for independent parallel items, selective context for dependent workflow steps.

6. **Simple Memory**: Chat history + compaction handles context. Optional todo list for orchestrator.

7. **Feature Flags**: Incremental rollout via SystemConfig. MVP can ship without orchestration.

8. **HITL Integration**: Destructive operations require human approval based on agent permission settings.

9. **Adapter Modularity**: Each CMS adapter bundles its own tools, prompts, agents, and schemas.

10. **Stateless Agent Server**: All persistent data in Internal CMS Server enables horizontal scaling.

---

## 12. Feature Flags (V7 Incremental Rollout)

V7 introduces feature flags for incremental rollout and easy rollback.

### 12.1 SystemConfig Interface

```typescript
interface SystemConfig {
  features: {
    // Core routing
    routerEnabled: boolean;           // false = bypass router, direct to default specialist
    complexityAssessment: boolean;    // false = skip complexity check, all tasks are "simple"

    // Orchestration
    orchestrationEnabled: boolean;    // false = complex tasks still go to single specialist
    parallelSpawning: boolean;        // false = always sequential
    freshContextMode: boolean;        // false = always inherit context

    // Future
    visualBuilderEnabled: boolean;    // Visual agent builder UI
  };

  defaults: {
    simpleSpecialist: string;         // Fallback specialist for simple tasks
    complexHandler: string;           // 'orchestrator' when enabled, fallback when not
  };
}
```

### 12.2 Configuration Presets

#### MVP Configuration (Ship Fast)

```typescript
const mvpConfig: SystemConfig = {
  features: {
    routerEnabled: true,
    complexityAssessment: false,      // All tasks are "simple"
    orchestrationEnabled: false,       // No orchestrator yet
    parallelSpawning: false,
    freshContextMode: false,
    visualBuilderEnabled: false,
  },
  defaults: {
    simpleSpecialist: 'qa_specialist',
    complexHandler: 'qa_specialist',   // Fallback when orchestration disabled
  },
};
```

In MVP mode:
- Router classifies intent only (not complexity)
- All tasks go directly to specialists
- No orchestrator spawning

#### Full Configuration (Production)

```typescript
const fullConfig: SystemConfig = {
  features: {
    routerEnabled: true,
    complexityAssessment: true,
    orchestrationEnabled: true,
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

#### Emergency Rollback Configuration

```typescript
const rollbackConfig: SystemConfig = {
  features: {
    routerEnabled: false,              // Bypass router entirely
    complexityAssessment: false,
    orchestrationEnabled: false,
    parallelSpawning: false,
    freshContextMode: false,
    visualBuilderEnabled: false,
  },
  defaults: {
    simpleSpecialist: 'qa_specialist',
    complexHandler: 'qa_specialist',
  },
};
```

This reduces the system to single-agent mode for debugging.

### 12.3 Runtime Feature Checks

```typescript
class SessionOrchestrator {
  async handleMessage(sessionId: string, message: string) {
    const config = this.systemConfig;

    // Feature: Router
    if (!config.features.routerEnabled) {
      return this.runSpecialist(sessionId, config.defaults.simpleSpecialist, message);
    }

    const routerResult = await this.routerService.classify(message);

    // Feature: Complexity assessment
    if (!config.features.complexityAssessment) {
      routerResult.complexity = 'simple';
    }

    // Route based on complexity
    if (routerResult.complexity === 'simple') {
      return this.runSpecialist(sessionId, routerResult.targetAgent, message);
    }

    // Feature: Orchestration
    if (!config.features.orchestrationEnabled) {
      // Complex task but orchestration disabled - fallback to specialist
      return this.runSpecialist(sessionId, config.defaults.complexHandler, message);
    }

    return this.runOrchestrator(sessionId, message, routerResult.intent);
  }
}
```

---

## 13. Future Design Gaps

The following areas are acknowledged but intentionally deferred. They should be designed in detail during later implementation stages.

| Area | Current State | Future Design Needed |
|------|---------------|----------------------|
| **Authentication** | Mentioned but not specified | JWT/API key flow between services, token refresh, session validation |
| **Multi-tenancy** | Implied but not detailed | Database schema for tenant isolation, workspace separation, data boundaries |
| **Rate Limiting** | Not specified | Rate limits for external API calls (LLM providers, MCP servers, third-party CMSs) |
| **Observability** | Events defined, logging mentioned | Structured logging format, distributed tracing IDs, metrics collection |
| **Error Recovery** | Retry strategy mentioned | Dead letter queue for failed jobs, manual retry UI, error state recovery flows |

These are not architectural blockers - they are natural concerns for Stages 6-8 of implementation.

---

**V7 is the complete, production-ready specification** for a routed multi-agent CMS platform with:
- **3-level architecture**: Router → Orchestrator → Specialists
- **7 agent configurations**: 1 router, 1 orchestrator, 5 specialists
- **Feature flags** for incremental rollout and easy rollback
- **Context modes** for optimized parallel and sequential execution
