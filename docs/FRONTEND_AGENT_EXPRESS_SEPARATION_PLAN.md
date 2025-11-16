# Frontend Agent + Express Backend Separation Plan

**Status**: Comprehensive Refactor Plan  
**Target Stack**: Next.js (Frontend Agent) + Express/Node.js (Backend API)  
**Created**: 2024-11-16  
**Objective**: Move AI agent to Next.js frontend with full AI SDK 6 integration while keeping existing Express backend

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current vs Target Architecture](#current-vs-target-architecture)
3. [Why This Separation (vs Laravel Migration)](#why-this-separation-vs-laravel-migration)
4. [Critical Decision Points](#critical-decision-points)
5. [Detailed Migration Plan](#detailed-migration-plan)
6. [File/Folder Structure Reorganization](#filefolder-structure-reorganization)
7. [State Management Strategy](#state-management-strategy)
8. [Testing & Validation](#testing--validation)
9. [Timeline & Milestones](#timeline--milestones)

---

## Executive Summary

### Current Architecture (Backend-Heavy)

```
┌─────────────────────────────────────┐
│     Frontend (Next.js)              │
│  - Passive UI layer                 │
│  - Custom SSE parsing               │
│  - Zustand state management         │
│  - Manual useAgent hook             │
│  - Proxy: app/api/agent/route.ts   │
└─────────────────────────────────────┘
                 ↓ SSE Proxy
┌─────────────────────────────────────┐
│   Backend (Express + Node.js)       │
│  ✅ ToolLoopAgent orchestrator      │
│  ✅ All 20 tools (direct DB)        │
│  ✅ SQLite + Drizzle ORM            │
│  ✅ LanceDB vector search           │
│  ✅ Working memory                  │
│  ✅ CMS routes (already built!)     │
│  ✅ Session routes                  │
│  ✅ Preview server (Nunjucks)       │
└─────────────────────────────────────┘
```

**Problem**: Agent logic in backend, can't use AI SDK 6 React hooks and AI Elements.

### Target Architecture (Frontend Agent)

```
┌─────────────────────────────────────────────────────────┐
│         Frontend (Next.js on Vercel)                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  AI Agent Layer                                   │  │
│  │  ✅ ToolLoopAgent (moved here)                    │  │
│  │  ✅ useChat hook integration                      │  │
│  │  ✅ AI Elements components                        │  │
│  │  ✅ Working memory (client-side)                  │  │
│  │  ✅ System prompt template                        │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Tool Library (HTTP Clients)                      │  │
│  │  ✅ 20 tools → Express API endpoints              │  │
│  │  ✅ CMS operations via HTTP                       │  │
│  │  ✅ Vector search via HTTP                        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↓ HTTP/REST
┌─────────────────────────────────────────────────────────┐
│           Backend (Express + Node.js)                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │  RESTful API Layer (ALREADY EXISTS!)             │  │
│  │  ✅ server/routes/cms.ts (410 lines)              │  │
│  │  ✅ server/routes/sessions.ts                     │  │
│  │  ✅ server/routes/agent.ts (DELETE - move logic)  │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Services Layer (KEEP AS-IS!)                     │  │
│  │  ✅ PageService, SectionService, EntryService    │  │
│  │  ✅ VectorIndex (LanceDB)                         │  │
│  │  ✅ SessionService                                │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Data Layer (KEEP AS-IS!)                         │  │
│  │  ✅ SQLite + Drizzle ORM                          │  │
│  │  ✅ LanceDB vector store                          │  │
│  │  ✅ 18 database tables                            │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Preview Server (KEEP AS-IS!)                     │  │
│  │  ✅ Nunjucks templates on port 4000               │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Key Insight: 90% Already Built!

**What we already have:**
- ✅ Express API routes (`server/routes/cms.ts` - 410 lines of endpoints)
- ✅ All services (`PageService`, `SectionService`, etc.)
- ✅ Database layer (SQLite + Drizzle)
- ✅ Vector search (LanceDB)
- ✅ Preview server (Nunjucks on port 4000)
- ✅ Session persistence

**What needs to move:**
- 🔄 `server/agent/orchestrator.ts` → `app/api/chat/route.ts`
- 🔄 `server/tools/all-tools.ts` → `tools/*` (convert to HTTP clients)
- 🔄 `server/prompts/react.xml` → `lib/prompts/react.ts`
- 🔄 `server/services/working-memory/` → `lib/working-memory/`

**What gets deleted:**
- ❌ `server/routes/agent.ts` (SSE streaming route - replaced by frontend agent)
- ❌ `app/api/agent/route.ts` (proxy - no longer needed)

---

## Why This Separation (vs Laravel Migration)

### Advantages Over Laravel Migration

| Aspect | Laravel Migration | Express Separation |
|--------|------------------|-------------------|
| **Backend Work** | Rebuild everything in PHP | **Keep existing Express code** |
| **Database Migration** | SQLite → MySQL + data migration | **Keep SQLite** (no migration) |
| **Vector Search** | Setup Meilisearch/Typesense | **Keep LanceDB** (already works) |
| **Preview Server** | Migrate Nunjucks → Blade | **Keep Nunjucks** (already works) |
| **Team Learning** | PHP team learns new stack | **Use existing Node.js knowledge** |
| **Migration Risk** | High (new stack) | **Low (same stack)** |
| **Timeline** | 7 weeks | **2-3 weeks** |
| **API Changes** | Build new Laravel endpoints | **Use existing Express routes** |

### When to Choose Express Separation

✅ **Choose This If:**
- Team is comfortable with Node.js/TypeScript
- Want faster migration (2-3 weeks vs 7 weeks)
- SQLite/Drizzle is working well
- LanceDB vector search is sufficient
- Don't need Laravel's ecosystem (Eloquent, Blade, Scout, etc.)
- Want to minimize risk

### When to Choose Laravel Migration

✅ **Choose Laravel If:**
- Backend team prefers PHP
- Need Laravel ecosystem (queues, events, broadcasting)
- Want stronger ORM (Eloquent vs Drizzle)
- Production database will be MySQL/PostgreSQL anyway
- Team structure: JS frontend, PHP backend

---

## Critical Decision Points

All 6 decisions map directly to Laravel plan, adapted for Express.

### Decision 1: Vector Search Location

**SELECTED: Express-Managed (Keep LanceDB)**

```typescript
// Frontend tool - HTTP client to Express
export const searchVectorTool = tool({
  description: 'Search CMS resources semantically',
  execute: async ({ query, limit }) => {
    return await expressApi.post('/v1/teams/t/sites/s/environments/e/search/resources', {
      query, limit
    });
  }
});
```

```typescript
// Express route - ALREADY EXISTS in server/routes/cms.ts
router.post('/search/resources', async (req, res) => {
  const { query, type, limit } = req.body;
  const results = await services.vectorIndex.search(query, type, limit);
  res.json({ data: results });
});
```

**Why**: LanceDB already works, no migration needed.

---

### Decision 2: Working Memory Storage

**SELECTED: Client-Side (same as Laravel plan)**

```typescript
// lib/working-memory/working-context.ts
// Move from server/services/working-memory/ → lib/working-memory/
export class WorkingContext {
  private entities: Map<string, Entity> = new Map();
  
  track(entity: Entity) {
    this.entities.set(entity.id, entity);
    sessionStorage.setItem('working-memory', this.serialize());
  }
  
  serialize(): string {
    return JSON.stringify(Array.from(this.entities.values()));
  }
}
```

---

### Decision 3: Session Storage

**SELECTED: Hybrid (localStorage + Express/SQLite with sync)**

```typescript
// Frontend - same SessionSyncManager pattern
class SessionSyncManager {
  async saveMessage(message: Message) {
    // 1. Local cache
    this.cacheLocally(message);
    
    // 2. Sync to Express
    await expressApi.post(`/api/sessions/${sessionId}/messages`, message);
  }
}
```

```typescript
// Express routes - ALREADY EXISTS in server/routes/sessions.ts
router.post('/sessions/:sessionId/messages', async (req, res) => {
  const message = await sessionService.saveMessage(req.params.sessionId, req.body);
  res.json({ data: message });
});
```

---

### Decision 4: System Prompt Location

**SELECTED: Frontend Template**

```typescript
// lib/prompts/react.ts
// Move server/prompts/react.xml → lib/prompts/react.ts
export const REACT_PROMPT_TEMPLATE = `
You are an autonomous AI assistant using the ReAct pattern.
{{#if workingMemory}}{{{workingMemory}}}{{/if}}
...
`;

// Compile with Handlebars
export function compileSystemPrompt(context) {
  return Handlebars.compile(REACT_PROMPT_TEMPLATE)(context);
}
```

---

### Decision 5: Approval Flow

**SELECTED: Frontend-Only (AI SDK 6 native)**

```typescript
// tools/http/post.ts
export const httpPostTool = tool({
  description: 'HTTP POST request',
  needsApproval: true, // AI SDK 6 handles this
  execute: async ({ url, body }) => {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json();
  }
});
```

**Delete**: `server/services/approval-queue.ts` (no longer needed)

---

### Decision 6: Preview Rendering

**SELECTED: Keep Express Nunjucks Server**

```typescript
// Frontend tool
export const previewPageTool = tool({
  description: 'Preview page',
  execute: async ({ pageId, locale }) => {
    return {
      previewUrl: `http://localhost:4000/pages/${pageId}?locale=${locale}`,
    };
  }
});
```

**Keep**: `server/preview.ts` (port 4000) - no changes needed!

---

## Detailed Migration Plan

### Phase 1: Express API Client (Week 1)

**Objective**: Build HTTP client for existing Express endpoints.

#### 1.1 Create Express API Client

```typescript
// lib/express-api/client.ts
class ExpressAPIClient {
  private baseURL: string;

  constructor() {
    // In development: http://localhost:8787
    // In production: your Express API URL
    this.baseURL = process.env.EXPRESS_API_URL || 'http://localhost:8787';
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new APIError(error.message, response.status);
    }

    const data = await response.json();
    return data.data || data; // Unwrap Express response envelope
  }

  get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<T>(`${endpoint}${query}`, { method: 'GET' });
  }

  post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

class APIError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const expressApi = new ExpressAPIClient();
```

#### 1.2 CMS Context Helper

```typescript
// lib/express-api/cms-context.ts
export class CMSContext {
  constructor(
    public teamId: string = 'default-team',
    public siteId: string = 'default-site',
    public environmentId: string = 'main'
  ) {}

  cmsPath(resource: string): string {
    return `/v1/teams/${this.teamId}/sites/${this.siteId}/environments/${this.environmentId}/${resource}`;
  }
}

export const cmsContext = new CMSContext(
  process.env.NEXT_PUBLIC_DEFAULT_TEAM || 'default-team',
  process.env.NEXT_PUBLIC_DEFAULT_SITE || 'default-site',
  process.env.NEXT_PUBLIC_DEFAULT_ENV || 'main'
);
```

---

### Phase 2: Tool Migration (Week 1-2)

**Objective**: Convert all 20 tools from direct DB access to HTTP clients.

#### 2.1 Example Tool Migration

**BEFORE** (Direct DB access):
```typescript
// server/tools/all-tools.ts
export const cmsGetPage = tool({
  execute: async (input, { experimental_context }) => {
    const ctx = experimental_context as AgentContext;
    
    // Direct service call
    const page = await ctx.services.pageService.getPageBySlug(
      input.slug,
      input.includeContent,
      input.localeCode
    );
    
    return page;
  }
});
```

**AFTER** (HTTP client):
```typescript
// tools/cms/get-page.ts
import { tool } from 'ai';
import { z } from 'zod';
import { expressApi } from '@/lib/express-api/client';
import { cmsContext } from '@/lib/express-api/cms-context';

export const cmsGetPageTool = tool({
  description: 'Get a page by slug or ID',
  inputSchema: z.object({
    slug: z.string().optional(),
    id: z.string().optional(),
    includeContent: z.boolean().optional().default(false),
    localeCode: z.string().optional().default('en'),
  }),
  execute: async (input, { logger }) => {
    if (!input.slug && !input.id) {
      throw new Error('Either slug or id required');
    }

    logger?.info?.('Fetching page', { slug: input.slug, id: input.id });

    try {
      let page;
      
      if (input.id) {
        // GET /v1/teams/:team/sites/:site/environments/:env/pages/:page
        const endpoint = input.includeContent
          ? cmsContext.cmsPath(`pages/${input.id}/contents?locale=${input.localeCode}`)
          : cmsContext.cmsPath(`pages/${input.id}`);
        
        page = await expressApi.get(endpoint);
      } else {
        // GET /v1/teams/:team/sites/:site/environments/:env/pages?q=slug
        const pages = await expressApi.get(
          cmsContext.cmsPath('pages'),
          { q: input.slug }
        );
        
        page = pages.find((p: any) => p.slug === input.slug);
        if (!page) throw new Error(`Page not found: ${input.slug}`);
        
        // Fetch full content if requested
        if (input.includeContent) {
          page = await expressApi.get(
            cmsContext.cmsPath(`pages/${page.id}/contents?locale=${input.localeCode}`)
          );
        }
      }

      // Return in same format as before
      if (!input.includeContent) {
        return {
          id: page.id,
          slug: page.slug,
          name: page.name,
          indexing: page.indexing,
          meta: page.meta,
          sectionIds: page.sections?.map((s: any) => s.id) || [],
          sectionCount: page.sections?.length || 0,
          message: 'Use cms_getPageSections or cms_getSectionContent for content',
        };
      }

      return {
        id: page.id,
        slug: page.slug,
        name: page.name,
        indexing: page.indexing,
        meta: page.meta,
        sections: page.sections || [],
      };
    } catch (error) {
      logger?.error?.('Failed to fetch page', { error });
      throw error;
    }
  },
});
```

#### 2.2 Express Endpoint Mapping

**All 20 tools map to existing Express endpoints:**

| Tool | Express Endpoint (ALREADY EXISTS) |
|------|----------------------------------|
| `cms_getPage` | `GET /pages/:page` or `GET /pages?q=slug` |
| `cms_createPage` | `POST /pages` |
| `cms_updatePage` | `PUT /pages/:page` |
| `cms_deletePage` | `DELETE /pages/:page` |
| `cms_listPages` | `GET /pages` |
| `cms_listSectionDefs` | `GET /section-defs` |
| `cms_getSectionDef` | `GET /section-defs/:sectionDef` |
| `cms_addSectionToPage` | `POST /pages/:page/section` |
| `cms_syncPageContent` | `POST /pages/:page/sections/:section/contents` |
| `cms_deletePageSection` | `DELETE /sections/:section` |
| `cms_getPageSections` | Custom (need to add) |
| `cms_getSectionContent` | Custom (need to add) |
| `cms_getCollectionEntries` | `GET /collections/:collection/entries` |
| `cms_getEntryContent` | Custom (need to add) |
| `search_vector` | `POST /search/resources` |
| `cms_findResource` | `GET /pages?q=query` (fuzzy) |
| `http_get` | N/A (direct fetch) |
| `http_post` | N/A (direct fetch) |
| `plan_analyzeTask` | N/A (client-side logic) |

#### 2.3 Add Missing Express Endpoints

**Need to add 3 new granular endpoints:**

```typescript
// server/routes/cms.ts - ADD these routes

// GET /v1/teams/:team/sites/:site/environments/:env/pages/:page/sections
router.get('/pages/:page/sections', async (req, res, next) => {
  try {
    const { locale = 'en', includeContent = 'false' } = req.query;
    
    const sections = await services.sectionService.getPageSections(
      req.params.page,
      includeContent === 'true',
      locale as string
    );
    
    res.json({ data: sections });
  } catch (error) {
    next(error);
  }
});

// GET /v1/teams/:team/sites/:site/environments/:env/sections/:section/content
router.get('/sections/:section/content', async (req, res, next) => {
  try {
    const { locale = 'en' } = req.query;
    
    const content = await services.sectionService.getSectionContent(
      req.params.section,
      locale as string
    );
    
    res.json({ data: content });
  } catch (error) {
    next(error);
  }
});

// GET /v1/teams/:team/sites/:site/environments/:env/entries/:entry/content
router.get('/entries/:entry/content', async (req, res, next) => {
  try {
    const { locale = 'en' } = req.query;
    
    const content = await services.entryService.getEntryContent(
      req.params.entry,
      locale as string
    );
    
    res.json({ data: content });
  } catch (error) {
    next(error);
  }
});
```

#### 2.4 All Tools Export

```typescript
// tools/index.ts
import { cmsGetPageTool } from './cms/get-page';
import { cmsCreatePageTool } from './cms/create-page';
// ... import all 20 tools

export const allTools = {
  cms_getPage: cmsGetPageTool,
  cms_createPage: cmsCreatePageTool,
  cms_updatePage: cmsUpdatePageTool,
  cms_deletePage: cmsDeletePageTool,
  cms_listPages: cmsListPagesTool,
  cms_listSectionDefs: cmsListSectionDefsTool,
  cms_getSectionDef: cmsGetSectionDefTool,
  cms_addSectionToPage: cmsAddSectionToPageTool,
  cms_syncPageContent: cmsSyncPageContentTool,
  cms_deletePageSection: cmsDeletePageSectionTool,
  cms_deletePageSections: cmsDeletePageSectionsTool,
  cms_getPageSections: cmsGetPageSectionsTool,
  cms_getSectionContent: cmsGetSectionContentTool,
  cms_getCollectionEntries: cmsGetCollectionEntriesTool,
  cms_getEntryContent: cmsGetEntryContentTool,
  search_vector: searchVectorTool,
  cms_findResource: cmsFindResourceTool,
  http_get: httpGetTool,
  http_post: httpPostTool,
  plan_analyzeTask: planAnalyzeTaskTool,
};
```

---

### Phase 3: Frontend Agent Setup (Week 2)

**Objective**: Move agent orchestrator to Next.js.

#### 3.1 Working Memory Migration

**Move files** from `server/services/working-memory/` → `lib/working-memory/`:

```bash
# Move working memory to frontend
mv server/services/working-memory/types.ts lib/working-memory/types.ts
mv server/services/working-memory/working-context.ts lib/working-memory/working-context.ts
mv server/services/working-memory/entity-extractor.ts lib/working-memory/entity-extractor.ts
mv server/services/working-memory/index.ts lib/working-memory/index.ts
```

**Adapt for client-side** (add sessionStorage):

```typescript
// lib/working-memory/working-context.ts
export class WorkingContext {
  private entities: Map<string, Entity> = new Map();
  private maxEntities: number = 10;

  constructor() {
    this.loadFromStorage(); // NEW: Load from sessionStorage
  }

  track(entity: Entity): void {
    entity.accessedAt = new Date();
    this.entities.set(entity.id, entity);
    
    // Keep only recent entities
    if (this.entities.size > this.maxEntities) {
      const sorted = Array.from(this.entities.values())
        .sort((a, b) => b.accessedAt.getTime() - a.accessedAt.getTime());
      
      this.entities = new Map(
        sorted.slice(0, this.maxEntities).map(e => [e.id, e])
      );
    }
    
    this.saveToStorage(); // NEW: Persist to sessionStorage
  }

  // ... rest of methods same as before

  // NEW: Storage methods
  private saveToStorage(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem('working-memory', JSON.stringify(this.getAll()));
  }

  private loadFromStorage(): void {
    if (typeof sessionStorage === 'undefined') return;
    const stored = sessionStorage.getItem('working-memory');
    if (stored) {
      const entities = JSON.parse(stored);
      this.entities = new Map(entities.map((e: Entity) => [e.id, e]));
    }
  }
}
```

#### 3.2 System Prompt Migration

**Convert** `server/prompts/react.xml` → `lib/prompts/react.ts`:

```typescript
// lib/prompts/react.ts
export const REACT_PROMPT_TEMPLATE = `
You are an autonomous AI assistant using the ReAct (Reasoning and Acting) pattern.

{{#if workingMemory}}
{{{workingMemory}}}
{{/if}}

**CORE LOOP:**
Think → Act → Observe → Repeat until completion

Think step-by-step:
1. Analyze the question and identify what information/actions you need
2. Execute ONE tool at a time with the appropriate input
3. Observe the result and integrate it into your reasoning
4. Continue until you have enough information or the task is complete
5. When done, provide a final answer

**CRITICAL RULES:**
1. **THINK before acting** - Explain your reasoning for each step
2. **EXECUTE immediately** - Don't ask unnecessary clarifying questions
3. **CHAIN operations** - Complete multi-step tasks in one conversation turn
4. **OBSERVE results** - Use tool outputs to inform your next action
5. **RECURSE when needed** - Continue until the task is fully complete

**REFERENCE RESOLUTION:**
- When user mentions "this page", "that section", "it", "them", check WORKING MEMORY
- WORKING MEMORY shows recently accessed resources
- If ambiguous, use MOST RECENT resource of appropriate type

**DESTRUCTIVE OPERATIONS:**
- Deletion tools require user confirmation via 'confirmed' flag
- NEVER auto-confirm deletions
- Recognize YES: "yes", "y", "ok", "proceed", "confirm"
- Recognize NO: "no", "n", "cancel", "stop"

**CONTENT RETRIEVAL (Hybrid Pattern):**
- Default: Lightweight fetch (metadata only)
- On-demand: Full content when needed
- Saves 40-96% tokens

**AVAILABLE TOOLS:** ({{toolCount}})
{{toolsFormatted}}
`;

// Compiler
import Handlebars from 'handlebars';

export function compileSystemPrompt(context: {
  workingMemory?: string;
  toolCount: number;
  toolsList: string[];
}): string {
  const template = Handlebars.compile(REACT_PROMPT_TEMPLATE);
  return template({
    workingMemory: context.workingMemory || '',
    toolCount: context.toolCount,
    toolsFormatted: context.toolsList.map(t => `- ${t}`).join('\n'),
  });
}
```

#### 3.3 Agent Orchestrator Migration

**Move** `server/agent/orchestrator.ts` → `app/api/chat/route.ts`:

```typescript
// app/api/chat/route.ts
import { ToolLoopAgent, createAgentUIStreamResponse, stepCountIs } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { allTools } from '@/tools';
import { compileSystemPrompt } from '@/lib/prompts/compiler';
import { workingContext } from '@/lib/working-memory/working-context';
import { entityExtractor } from '@/lib/working-memory/entity-extractor';

export const runtime = 'edge'; // Vercel Edge Runtime
export const maxDuration = 60;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const AGENT_CONFIG = {
  maxSteps: 15,
  modelId: 'openai/gpt-4o-mini',
};

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Compile system prompt with working memory
  const systemPrompt = compileSystemPrompt({
    workingMemory: workingContext.serialize(),
    toolCount: Object.keys(allTools).length,
    toolsList: Object.keys(allTools),
  });

  // Create agent (SAME as before, but with HTTP tools)
  const agent = new ToolLoopAgent({
    model: openrouter.languageModel(AGENT_CONFIG.modelId),
    instructions: systemPrompt,
    tools: allTools, // Now HTTP clients instead of direct DB

    stopWhen: stepCountIs(AGENT_CONFIG.maxSteps),

    // Track entities from tool results
    onToolResult: async ({ toolName, result }) => {
      const entities = entityExtractor.extract(toolName, result);
      entities.forEach(entity => workingContext.track(entity));
    },
  });

  // Stream response (AI SDK 6 handles everything)
  return createAgentUIStreamResponse({
    agent,
    messages,
  });
}
```

#### 3.4 Frontend UI with useChat

```typescript
// app/assistant/page.tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AssistantPage() {
  const [input, setInput] = useState('');
  
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b p-4">
        <h1 className="text-xl font-semibold">CMS Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Status: {status}
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {message.parts.map((part, i) => {
                  if (part.type === 'text') {
                    return <div key={i}>{part.text}</div>;
                  }
                  if (part.type === 'tool-call') {
                    return (
                      <div key={i} className="text-xs opacity-70 mt-1">
                        🔧 {part.toolName}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {/* Loading */}
          {status === 'streaming' && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim() && status === 'ready') {
              sendMessage({ text: input });
              setInput('');
            }
          }}
          className="flex space-x-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your CMS..."
            disabled={status !== 'ready'}
            className="flex-1"
          />
          <Button type="submit" disabled={status !== 'ready' || !input.trim()}>
            Send
          </Button>
          {(status === 'streaming' || status === 'submitted') && (
            <Button type="button" variant="destructive" onClick={stop}>
              Stop
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
```

---

## File/Folder Structure Reorganization

### Current Monolith
```
react-agent-prototype/
├── app/
│   ├── assistant/
│   └── api/agent/route.ts      # ❌ DELETE (proxy)
├── server/
│   ├── agent/
│   │   └── orchestrator.ts     # 🔄 MOVE to app/api/chat/route.ts
│   ├── tools/
│   │   └── all-tools.ts        # 🔄 MIGRATE to tools/*
│   ├── prompts/
│   │   └── react.xml           # 🔄 MOVE to lib/prompts/react.ts
│   ├── services/
│   │   ├── working-memory/     # 🔄 MOVE to lib/working-memory/
│   │   ├── approval-queue.ts   # ❌ DELETE (use AI SDK 6 native)
│   │   └── ...                 # ✅ KEEP (PageService, etc.)
│   ├── routes/
│   │   ├── agent.ts            # ❌ DELETE (no longer needed)
│   │   ├── cms.ts              # ✅ KEEP (API endpoints)
│   │   └── sessions.ts         # ✅ KEEP
│   ├── db/                     # ✅ KEEP
│   └── preview.ts              # ✅ KEEP
└── data/
    ├── sqlite.db               # ✅ KEEP
    └── lancedb/                # ✅ KEEP
```

### Target Separation
```
nextjs-cms-assistant/
├── app/
│   ├── assistant/
│   │   ├── _components/
│   │   ├── _stores/
│   │   └── page.tsx
│   └── api/
│       └── chat/
│           └── route.ts        # ⭐ Agent orchestrator HERE
├── lib/
│   ├── express-api/
│   │   ├── client.ts           # ⭐ HTTP client
│   │   ├── types.ts
│   │   └── cms-context.ts
│   ├── working-memory/         # ⭐ Moved from server
│   │   ├── working-context.ts
│   │   ├── entity-extractor.ts
│   │   └── types.ts
│   ├── prompts/                # ⭐ Moved from server
│   │   ├── react.ts
│   │   └── compiler.ts
│   └── session-sync.ts
├── tools/                      # ⭐ HTTP clients
│   ├── cms/
│   │   ├── get-page.ts
│   │   └── ... (15 tools)
│   ├── search/
│   ├── http/
│   └── index.ts
└── .env.local

express-cms-backend/            # ✅ KEEP MOST AS-IS
├── server/
│   ├── services/               # ✅ KEEP (no changes)
│   ├── routes/
│   │   ├── cms.ts              # ✅ KEEP + add 3 endpoints
│   │   └── sessions.ts         # ✅ KEEP
│   ├── db/                     # ✅ KEEP
│   ├── preview.ts              # ✅ KEEP
│   └── index.ts                # ✅ KEEP
├── data/
│   ├── sqlite.db               # ✅ KEEP
│   └── lancedb/                # ✅ KEEP
└── package.json
```

---

## State Management Strategy

### Client State (Next.js)

**Zustand stores** (same as Laravel plan):
```typescript
useChatStore: {
  sessionId, messages, isStreaming,
  createSession(), loadSession(), addMessage()
}

useUIStore: {
  sidebarOpen, debugPanelOpen,
  toggleSidebar(), toggleDebugPanel()
}

workingContext: {
  entities, track(), resolve(), serialize()
}
```

### Server State (Express)

**SQLite + Drizzle** (no changes):
- sessions, messages (already exists)
- pages, sections, contents (already exists)
- All 18 tables (already exists)

### Sync Pattern

**Hybrid localStorage + Express/SQLite** (same as Laravel plan):
```typescript
class SessionSyncManager {
  async saveMessage(message) {
    // 1. Optimistic update
    this.cacheLocally(message);
    
    // 2. Background sync to Express
    await expressApi.post(`/api/sessions/${sessionId}/messages`, message);
  }
}
```

---

## Testing & Validation

### Unit Tests (Frontend)

```typescript
// tools/cms/get-page.test.ts
import { describe, it, expect, vi } from 'vitest';
import { cmsGetPageTool } from './get-page';
import { expressApi } from '@/lib/express-api/client';

vi.mock('@/lib/express-api/client');

describe('cmsGetPageTool', () => {
  it('fetches page via Express API', async () => {
    const mockPage = { id: '123', slug: 'about', name: 'About' };
    vi.mocked(expressApi.get).mockResolvedValue([mockPage]);

    const result = await cmsGetPageTool.execute({ slug: 'about' }, { logger: console });

    expect(result.slug).toBe('about');
    expect(expressApi.get).toHaveBeenCalledWith(
      expect.stringContaining('/pages'),
      { q: 'about' }
    );
  });
});
```

### Integration Tests (Express)

```typescript
// server/routes/cms.test.ts - Already exists!
// Just ensure existing tests still pass
```

---

## Timeline & Milestones

### Week 1: API Client & Tool Migration
- ✅ Create Express API client
- ✅ Add 3 missing Express endpoints
- ✅ Migrate all 20 tools to HTTP clients
- ✅ Unit test all tools

**Deliverable**: Complete tool library calling Express

### Week 2: Agent Migration & UI
- ✅ Move working memory to frontend
- ✅ Convert system prompt to TypeScript
- ✅ Move agent to app/api/chat/route.ts
- ✅ Integrate useChat hook
- ✅ Update UI components

**Deliverable**: Functional frontend agent

### Week 3: Testing & Polish
- ✅ Integration tests
- ✅ Session management with hybrid sync
- ✅ Performance optimization
- ✅ Documentation

**Deliverable**: Production-ready system

---

## Success Criteria

- [ ] All 20 tools working via Express API
- [ ] Agent runs on frontend with AI SDK 6
- [ ] useChat hook integrated
- [ ] Working memory on client-side
- [ ] Session persistence works
- [ ] Zero data loss (Express backend unchanged)
- [ ] Preview server still works
- [ ] Vector search still works
- [ ] All existing tests pass

---

## What Gets Deleted

```bash
# Files to DELETE
rm app/api/agent/route.ts           # Proxy no longer needed
rm server/routes/agent.ts            # SSE streaming moved to frontend
rm server/agent/orchestrator.ts     # Moved to app/api/chat/route.ts
rm server/services/approval-queue.ts # Use AI SDK 6 native approvals

# Directories to DELETE
rm -rf server/tools/                 # Migrated to tools/
rm -rf server/prompts/               # Moved to lib/prompts/
rm -rf server/services/working-memory/ # Moved to lib/working-memory/
```

## What Gets Kept

```bash
# KEEP these (no changes needed)
server/services/cms/
server/services/vector-index.ts
server/services/session-service.ts
server/routes/cms.ts               # Add 3 endpoints only
server/routes/sessions.ts
server/db/
server/preview.ts                  # Preview server on port 4000
data/sqlite.db
data/lancedb/
```

---

## Conclusion

This separation plan leverages **90% of existing Express infrastructure** while gaining **full AI SDK 6 benefits**.

**Key Advantages**:
- ✅ **2-3 weeks** vs 7 weeks for Laravel
- ✅ Keep existing Express backend (proven, working)
- ✅ Keep SQLite + Drizzle
- ✅ Keep LanceDB vector search
- ✅ Keep Nunjucks preview server
- ✅ Minimal backend changes (add 3 endpoints)
- ✅ Low migration risk

**Team Ownership**:
- Frontend devs: Agent logic, tools, UI (TypeScript)
- Backend devs: Express API, services, DB (TypeScript/Node)

Ready to execute! 🚀
