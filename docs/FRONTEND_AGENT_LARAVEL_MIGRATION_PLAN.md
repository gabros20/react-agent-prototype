# Frontend Agent + Laravel Backend Migration Plan

**Status**: Comprehensive Refactor Plan  
**Target Stack**: Next.js (Frontend Agent) + Laravel 11 (CMS Backend)  
**Created**: 2024-11-16  
**Objective**: Migrate AI agent to Next.js frontend with full AI SDK 6 integration while preserving all features

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current vs Target Architecture](#current-vs-target-architecture)
3. [Migration Benefits & Trade-offs](#migration-benefits--trade-offs)
4. [Critical Decision Points (A/B Options)](#critical-decision-points-ab-options)
5. [Detailed Migration Plan](#detailed-migration-plan)
6. [File/Folder Structure Reorganization](#filefolder-structure-reorganization)
7. [State Management Strategy](#state-management-strategy)
8. [Streaming Architecture](#streaming-architecture)
9. [Testing & Validation](#testing--validation)
10. [Risk Mitigation](#risk-mitigation)
11. [Timeline & Milestones](#timeline--milestones)

---

## Executive Summary

### Current Architecture (Express Backend Agent)

```
┌─────────────────────────────────────┐
│     Frontend (Next.js)              │
│  - Passive UI layer                 │
│  - Custom SSE parsing               │
│  - Zustand state management         │
│  - Manual useAgent hook             │
└─────────────────────────────────────┘
                 ↓ SSE
┌─────────────────────────────────────┐
│   Backend (Express + Node.js)       │
│  - ToolLoopAgent orchestrator       │
│  - Direct DB access (SQLite)        │
│  - LanceDB vector search            │
│  - Working memory                   │
│  - Tool execution                   │
│  - Preview server (Nunjucks)        │
└─────────────────────────────────────┘
```

### Target Architecture (Frontend Agent + Laravel)

```
┌─────────────────────────────────────────────────────────┐
│         Frontend (Next.js on Vercel)                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  AI Agent Layer                                   │  │
│  │  - ToolLoopAgent (AI SDK 6)                      │  │
│  │  - useChat hook integration                       │  │
│  │  - AI Elements components                         │  │
│  │  - Working memory (client-side)                   │  │
│  │  - OpenRouter API key (env var)                   │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Tool Library (HTTP Clients)                      │  │
│  │  - CMS tools → Laravel API                        │  │
│  │  - Search tools → Laravel/Typesense               │  │
│  │  - Preview tools → Laravel render API             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↓ HTTPS/REST
┌─────────────────────────────────────────────────────────┐
│           Backend (Laravel 11 + PHP)                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  RESTful API Layer                                │  │
│  │  - Laravel Sanctum authentication                 │  │
│  │  - CMS CRUD endpoints                             │  │
│  │  - Vector search endpoints                        │  │
│  │  - Preview render endpoints                       │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Business Logic Layer                             │  │
│  │  - Eloquent ORM (MySQL/PostgreSQL)               │  │
│  │  - Meilisearch/Typesense integration             │  │
│  │  - Blade template rendering                       │  │
│  │  - Queue jobs                                     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Why This Migration?

1. **Team Alignment**: JS/TS devs own AI logic, PHP devs own CMS/DB
2. **AI SDK 6 Full Integration**: Access all React hooks, AI Elements, streaming features
3. **Independent Scaling**: Frontend and backend scale separately
4. **Modern DX**: Better type safety, tooling, and developer experience
5. **Production Ready**: Vercel edge/serverless + Laravel hosting

---

## Current vs Target Architecture

### Current Implementation Inventory

#### **Frontend (Next.js)**

-   **Location**: `/app/assistant/`
-   **Components**:
    -   `page.tsx` - Main assistant UI
    -   `_components/` - Custom chat UI components
    -   `_hooks/use-agent.ts` - Manual SSE stream parser (custom hook)
    -   `_stores/chat-store.ts` - Zustand chat state with localStorage
    -   `_stores/log-store.ts` - Debug logs
    -   `_stores/approval-store.ts` - HITL approval queue
-   **Features**:
    -   Custom message rendering
    -   Manual SSE event parsing (text-delta, tool-call, tool-result, approval-required)
    -   localStorage persistence
    -   Session management

#### **Backend (Express + Node)**

-   **Location**: `/server/`
-   **Key Files**:
    -   `agent/orchestrator.ts` - ToolLoopAgent with ReAct loop (15 max steps)
    -   `tools/all-tools.ts` - 20 CMS tools with metadata
    -   `routes/agent.ts` - SSE streaming endpoint
    -   `routes/cms.ts` - CMS CRUD operations (410 lines)
    -   `routes/sessions.ts` - Session/message persistence
    -   `services/working-memory/` - Entity extraction & reference resolution
    -   `services/vector-index.ts` - LanceDB operations
    -   `services/cms/*.ts` - PageService, SectionService, EntryService
    -   `db/schema.ts` - Drizzle ORM schema (18 tables)
    -   `prompts/react.xml` - System prompt template with Handlebars
-   **Dependencies**:
    -   `ai` v6.0.0-beta.95
    -   `@lancedb/lancedb` ^0.22.3
    -   `drizzle-orm` ^0.44.7
    -   `better-sqlite3` ^12.4.1
    -   `express` ^5.1.0
    -   `@openrouter/ai-sdk-provider` ^1.2.1

#### **Database Schema** (18 tables)

-   **Core**: teams, sites, environments, locales
-   **Pages**: pages, page_sections, page_section_contents
-   **Sections**: section_definitions
-   **Collections**: collection_definitions, collection_entries, entry_contents
-   **Sessions**: sessions, messages
-   **Media**: media_files, media_metadata
-   **Navigation**: navigations, navigation_items
-   **Current**: SQLite (development)
-   **Target**: MySQL/PostgreSQL (Laravel)

#### **Current Tools** (20 total)

**CMS Operations (15 tools)**:

1. `cms_getPage` - Get page by slug/ID (hybrid content fetching)
2. `cms_createPage` - Create new page
3. `cms_updatePage` - Update page metadata
4. `cms_deletePage` - Delete page (requires confirmation)
5. `cms_listPages` - List all pages
6. `cms_listSectionDefs` - List section templates
7. `cms_getSectionDef` - Get section schema
8. `cms_addSectionToPage` - Add section instance
9. `cms_syncPageContent` - Update section content
10. `cms_deletePageSection` - Delete one section (requires confirmation)
11. `cms_deletePageSections` - Delete multiple sections (requires confirmation)
12. `cms_getPageSections` - Granular section fetch (lightweight)
13. `cms_getSectionContent` - Granular content fetch (single section)
14. `cms_getCollectionEntries` - Get collection entries (hybrid)
15. `cms_getEntryContent` - Granular entry content fetch

**Search Tools (2 tools)**: 16. `search_vector` - Semantic vector search (LanceDB) 17. `cms_findResource` - Fuzzy resource search (typo-tolerant)

**HTTP Tools (2 tools)**: 18. `http_get` - External HTTP GET 19. `http_post` - External HTTP POST (requires approval)

**Planning Tools (1 tool)**: 20. `plan_analyzeTask` - Task planning and analysis

---

## Migration Benefits & Trade-offs

### ✅ Benefits

#### 1. **AI SDK 6 Full Integration**

-   **useChat Hook**: Built-in message management, streaming, status tracking
-   **AI Elements**: Native component support (Conversation, Message, Context, ChainOfThought, Plan)
-   **Type Safety**: `InferAgentUIMessage` for end-to-end types
-   **Streaming**: Built-in optimistic updates, message deduplication
-   **Error Handling**: Automatic retry logic, error states
-   **Real Example**:

    ```typescript
    // ❌ Current: Manual SSE parsing
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
    	const { done, value } = await reader.read();
    	// ... manual event parsing ...
    }

    // ✅ Target: Built-in useChat
    const { messages, sendMessage, status } = useChat({
    	transport: new DefaultChatTransport({ api: "/api/chat" }),
    });
    ```

#### 2. **Team Workflow Alignment**

-   **Frontend Team**: Full ownership of AI logic in TypeScript
-   **Backend Team**: Focus on CMS business logic in PHP
-   **Clear API Contract**: OpenAPI/Swagger spec as source of truth
-   **Parallel Development**: Teams can work independently
-   **Deployment Independence**: Vercel for Next.js, separate Laravel hosting

#### 3. **Developer Experience**

-   **Hot Reload**: Next.js fast refresh for agent code
-   **Type Safety**: Full TypeScript for tools and agent
-   **Modern Tooling**: AI SDK 6 debugging, tracing
-   **Component Library**: AI Elements out of the box
-   **Better Error Messages**: AI SDK provides detailed error context

#### 4. **Scalability**

-   **Independent Scaling**: Vercel serverless functions + Laravel API
-   **Edge Deployment**: Vercel Edge Runtime for low latency
-   **Caching**: Edge caching, Laravel response caching
-   **CDN**: Static assets on Vercel CDN
-   **Auto-scaling**: Both platforms handle traffic spikes automatically

#### 5. **Production Ready**

-   **Vercel**: Zero-config deployment, automatic HTTPS, preview deployments
-   **Laravel**: Battle-tested for high-traffic applications
-   **Monitoring**: Vercel Analytics + Laravel Telescope
-   **Error Tracking**: Native integrations (Sentry, etc.)

### ⚠️ Trade-offs

#### 1. **Network Latency**

-   **Current**: Direct SQLite queries (~1ms)
-   **Target**: HTTP API calls (~50-100ms)
-   **Impact**: Each tool call adds network round-trip
-   **Mitigation**: Response caching, batch operations, edge functions

#### 2. **Complexity**

-   **Current**: Single codebase (monolith)
-   **Target**: Two separate codebases + API contract
-   **Impact**: More moving parts to coordinate
-   **Mitigation**: Strong typing, contract testing, OpenAPI spec

#### 3. **Development Setup**

-   **Current**: `pnpm dev` (one command starts everything)
-   **Target**: Next.js dev server + Laravel dev server + MySQL + Meilisearch
-   **Impact**: More complex local development
-   **Mitigation**: Docker Compose for one-command setup

#### 4. **Debugging**

-   **Current**: Single stack trace from frontend to database
-   **Target**: Distributed tracing across services
-   **Impact**: Harder to debug issues across boundaries
-   **Mitigation**: Structured logging, trace IDs, monitoring tools

---

## Critical Decision Points (A/B Options)

This section presents 6 critical architectural decisions with detailed A/B options, recommendations, and implementation examples.

### Decision 1: Vector Search Location

This decision determines WHERE vector search operations execute and WHO manages the vector index.

#### **Option A: Laravel-Managed Vector Search (RECOMMENDED)**

**Overview**: Laravel backend manages Meilisearch/Typesense, frontend tools call Laravel API endpoints for search.

**Architecture**:

```typescript
// Frontend tool (HTTP client)
export const semanticSearchTool = tool({
	description: "Search CMS resources semantically",
	inputSchema: z.object({
		query: z.string(),
		limit: z.number().default(10),
	}),
	execute: async ({ query, limit }) => {
		const response = await laravelApi.post("/api/search/semantic", {
			query,
			limit,
		});
		return response.data;
	},
});
```

```php
// Laravel controller
class SearchController extends Controller
{
    public function semantic(Request $request)
    {
        $validated = $request->validate([
            'query' => 'required|string',
            'limit' => 'nullable|integer|min:1|max:20',
        ]);

        $results = app(MeilisearchService::class)->vectorSearch(
            query: $validated['query'],
            limit: $validated['limit'] ?? 10
        );

        return SearchResultResource::collection($results);
    }
}
```

**Pros**:

-   ✅ Centralized vector management - PHP team controls indexing
-   ✅ Easier cache invalidation - clear Laravel cache
-   ✅ Consistent with other Laravel services
-   ✅ Single source of truth for search logic
-   ✅ Can leverage Laravel queue for background indexing

**Cons**:

-   ⚠️ Additional API latency (~50ms per search)
-   ⚠️ Cannot optimize search ranking on frontend
-   ⚠️ Frontend depends on backend for search features

**PHP Requirements**:

-   Meilisearch PHP SDK or Typesense PHP client
-   Vector embeddings generation (OpenRouter/OpenAI API from PHP)
-   Scheduled indexing jobs (Laravel queues)
-   Search result caching

---

#### **Option B: Frontend Direct Vector Client**

**Overview**: Frontend connects directly to Meilisearch/Typesense using read-only API key.

**Architecture**:

```typescript
// Frontend tool (direct Typesense client)
import Typesense from "typesense";

const client = new Typesense.Client({
	nodes: [
		{
			host: process.env.TYPESENSE_HOST!,
			port: 443,
			protocol: "https",
		},
	],
	apiKey: process.env.TYPESENSE_SEARCH_KEY!, // Read-only key
});

export const semanticSearchTool = tool({
	description: "Search CMS resources",
	execute: async ({ query, limit }) => {
		const results = await client.collections("pages").documents().search({
			q: query,
			query_by: "title,content",
			prefix: false,
			per_page: limit,
		});

		return results.hits;
	},
});
```

**Pros**:

-   ✅ Lower latency - direct connection to search engine
-   ✅ Frontend can optimize ranking algorithms
-   ✅ Real-time search updates
-   ✅ Reduced load on Laravel API

**Cons**:

-   ⚠️ Frontend needs Typesense credentials (read-only, but still exposed)
-   ⚠️ Indexing still needs Laravel (separate concern)
-   ⚠️ Search logic split across stacks
-   ⚠️ Harder to enforce business rules (permissions, filtering)

**Requirements**:

-   Typesense/Meilisearch JS SDK in Next.js
-   Read-only search API key (safe for frontend exposure)
-   Laravel still handles indexing pipeline
-   CORS configuration for search engine

---

**RECOMMENDATION**: Start with **Option A** (Laravel-managed) for:

-   Simpler architecture
-   Centralized control
-   Easier to add permissions/filtering
-   Consistent API patterns

Migrate to **Option B** if search latency becomes a bottleneck after measuring with real data.

---

### Decision 2: Working Memory Storage

This decision determines WHERE entity tracking and reference resolution happens.

#### **Option A: Client-Side Working Memory (RECOMMENDED)**

**Overview**: Working memory lives in browser (sessionStorage), injected into system prompt.

**Implementation**:

```typescript
// lib/working-memory/working-context.ts
export class WorkingContext {
  private entities: Map<string, Entity> = new Map();
  private maxEntities: number = 10;

  constructor() {
    this.loadFromStorage();
  }

  track(entity: Entity): void {
    entity.accessedAt = new Date();
    this.entities.set(entity.id, entity);

    // Keep only most recent N entities
    if (this.entities.size > this.maxEntities) {
      const sorted = Array.from(this.entities.values())
        .sort((a, b) => b.accessedAt.getTime() - a.accessedAt.getTime());

      this.entities = new Map(
        sorted.slice(0, this.maxEntities).map(e => [e.id, e])
      );
    }

    this.saveToStorage();
  }

  resolve(type?: Entity['type']): Entity | null {
    const entities = Array.from(this.entities.values())
      .sort((a, b) => b.accessedAt.getTime() - a.accessedAt.getTime());

    return type ? entities.find(e => e.type === type) || null : entities[0] || null;
  }

  serialize(): string {
    const entities = this.getAll();
    if (entities.length === 0) return '';

    return \`**WORKING MEMORY**:\n\${entities.map(e =>
      \`- \${e.type}: \${e.name} (id: \${e.id})\`
    ).join('\\n')}\`;
  }

  private saveToStorage(): void {
    sessionStorage.setItem('working-memory', JSON.stringify(this.getAll()));
  }

  private loadFromStorage(): void {
    const stored = sessionStorage.getItem('working-memory');
    if (stored) {
      const entities = JSON.parse(stored);
      this.entities = new Map(entities.map(e => [e.id, e]));
    }
  }
}

// Usage in agent
const systemPrompt = \`\${basePrompt}\n\n\${workingContext.serialize()}\`;
```

**Pros**:

-   ✅ Zero latency - no API calls
-   ✅ Instant reference resolution
-   ✅ Persists across page reloads (sessionStorage)
-   ✅ Privacy-friendly - stays client-side
-   ✅ Simpler implementation

**Cons**:

-   ⚠️ Memory cleared on session end (browser close)
-   ⚠️ No cross-device continuity
-   ⚠️ Limited to ~5MB browser storage
-   ⚠️ Can't share context between users

---

#### **Option B: Laravel-Backed Working Memory**

**Overview**: Laravel stores entity tracking in database, API provides memory operations.

**Implementation**:

```typescript
// Frontend tool
export const trackEntityTool = tool({
  description: 'Track entity in working memory',
  execute: async ({ entity }) => {
    await laravelApi.post(\`/api/sessions/\${sessionId}/memory\`, { entity });
  }
});
```

```php
// Laravel
Schema::create('working_memory', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('session_id')->constrained()->cascadeOnDelete();
    $table->string('entity_type'); // page, section, etc.
    $table->uuid('entity_id');
    $table->string('entity_name');
    $table->json('metadata')->nullable();
    $table->timestamp('accessed_at');
    $table->timestamps();
});

class WorkingMemoryController extends Controller
{
    public function track(Request $request, Session $session)
    {
        $session->workingMemory()->updateOrCreate(
            ['entity_id' => $request->entity_id],
            [
                'entity_type' => $request->entity_type,
                'entity_name' => $request->entity_name,
                'metadata' => $request->metadata,
                'accessed_at' => now(),
            ]
        );
    }

    public function get(Session $session)
    {
        return $session->workingMemory()
            ->orderBy('accessed_at', 'desc')
            ->limit(10)
            ->get();
    }
}
```

**Pros**:

-   ✅ Persistent across sessions
-   ✅ Cross-device continuity
-   ✅ Unlimited storage
-   ✅ Shareable memory state
-   ✅ Can analyze memory usage patterns

**Cons**:

-   ⚠️ API latency for every memory operation
-   ⚠️ More complex implementation
-   ⚠️ Requires DB schema changes
-   ⚠️ Additional database load

---

**RECOMMENDATION**: Start with **Option A** (client-side) because:

-   Simpler to implement
-   Matches current pattern (already using in-memory WorkingContext)
-   Good enough for single-user sessions
-   Can migrate to Option B later if cross-device becomes requirement

---

### Decision 3: Session & Message Storage

This decision determines HOW and WHERE chat sessions and messages are persisted.

#### **Option A: Laravel Database Sessions with Local Cache (SELECTED)**

**Overview**: Primary storage in Laravel MySQL/PostgreSQL, but aggressively cached in localStorage for instant loads and offline capability.

**Architecture**:

```typescript
// lib/session-sync.ts
export class SessionSyncManager {
	private syncQueue: Array<SyncOperation> = [];
	private syncInterval: NodeJS.Timeout | null = null;

	constructor(private sessionId: string) {
		this.startBackgroundSync();
	}

	async saveMessage(message: Message): Promise<void> {
		// 1. Instant local cache
		const cached = this.getCachedSession();
		cached.messages.push(message);
		this.setCachedSession(cached);

		// 2. Queue for background sync
		this.syncQueue.push({
			type: "save-message",
			data: message,
			timestamp: Date.now(),
		});

		// 3. Immediate sync if online
		if (navigator.onLine) {
			await this.flushSyncQueue();
		}
	}

	async loadSession(sessionId: string): Promise<Session> {
		// 1. Check local cache first (instant)
		const cached = this.getCachedSession();
		if (cached && this.isCacheFresh(cached)) {
			return cached;
		}

		// 2. Fetch from Laravel (with stale-while-revalidate pattern)
		try {
			const [session, messages] = await Promise.all([
				laravelApi.get<{ data: Session }>(`/api/sessions/${sessionId}`),
				laravelApi.get<{ data: Message[] }>(`/api/sessions/${sessionId}/messages`),
			]);

			const freshSession = {
				...session.data,
				messages: messages.data,
				cachedAt: Date.now(),
			};

			// 3. Update cache
			this.setCachedSession(freshSession);

			return freshSession;
		} catch (error) {
			// 4. Fallback to cached if network fails
			if (cached) {
				console.warn("Using cached session due to network error");
				return cached;
			}
			throw error;
		}
	}

	private async flushSyncQueue(): Promise<void> {
		while (this.syncQueue.length > 0) {
			const op = this.syncQueue[0];

			try {
				if (op.type === "save-message") {
					await laravelApi.post(`/api/sessions/${this.sessionId}/messages`, op.data);
				}

				// Remove from queue on success
				this.syncQueue.shift();
			} catch (error) {
				console.error("Sync failed, will retry:", error);
				break; // Stop and retry later
			}
		}
	}

	private startBackgroundSync(): void {
		// Sync every 5 seconds
		this.syncInterval = setInterval(() => {
			if (navigator.onLine && this.syncQueue.length > 0) {
				this.flushSyncQueue();
			}
		}, 5000);
	}

	private getCachedSession(): CachedSession | null {
		const cached = localStorage.getItem(`session:${this.sessionId}`);
		return cached ? JSON.parse(cached) : null;
	}

	private setCachedSession(session: CachedSession): void {
		localStorage.setItem(`session:${this.sessionId}`, JSON.stringify(session));
	}

	private isCacheFresh(cached: CachedSession): boolean {
		// Cache valid for 5 minutes
		return Date.now() - cached.cachedAt < 5 * 60 * 1000;
	}
}
```

```typescript
// app/assistant/_stores/chat-store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface ChatState {
	sessionId: string | null;
	messages: Message[];
	syncManager: SessionSyncManager | null;

	createSession: (title?: string) => Promise<void>;
	loadSession: (sessionId: string) => Promise<void>;
	addMessage: (message: Omit<Message, "id">) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
	persist(
		(set, get) => ({
			sessionId: null,
			messages: [],
			syncManager: null,

			createSession: async (title) => {
				// Create in Laravel
				const response = await laravelApi.post<{ data: Session }>("/api/sessions", {
					title: title || "New Conversation",
				});

				const syncManager = new SessionSyncManager(response.data.id);

				set({
					sessionId: response.data.id,
					messages: [],
					syncManager,
				});
			},

			loadSession: async (sessionId) => {
				const syncManager = new SessionSyncManager(sessionId);
				const session = await syncManager.loadSession(sessionId);

				set({
					sessionId: session.id,
					messages: session.messages,
					syncManager,
				});
			},

			addMessage: async (message) => {
				const { sessionId, syncManager } = get();
				if (!sessionId || !syncManager) {
					throw new Error("No active session");
				}

				const fullMessage: Message = {
					id: `temp-${Date.now()}`,
					session_id: sessionId,
					...message,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};

				// Optimistic update + background sync
				set((state) => ({ messages: [...state.messages, fullMessage] }));
				await syncManager.saveMessage(fullMessage);
			},
		}),
		{
			name: "chat-store",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				sessionId: state.sessionId,
				// Messages cached separately by SessionSyncManager
			}),
		}
	)
);
```

```php
// Laravel - Standard endpoints, aggressive caching
class SessionController extends Controller
{
    public function show(string $id)
    {
        // Cache for 5 minutes
        $session = Cache::remember("session:{$id}", 300, function () use ($id) {
            return Session::findOrFail($id);
        });

        return new SessionResource($session);
    }

    public function messages(string $id)
    {
        // Cache messages for 5 minutes
        $messages = Cache::remember("session:{$id}:messages", 300, function () use ($id) {
            return Message::where('session_id', $id)
                ->orderBy('created_at')
                ->get();
        });

        return MessageResource::collection($messages);
    }

    public function storeMessage(Request $request, string $id)
    {
        $message = Message::create([
            'id' => Str::uuid(),
            'session_id' => $id,
            'role' => $request->role,
            'content' => $request->content,
        ]);

        // Invalidate cache
        Cache::forget("session:{$id}:messages");

        return new MessageResource($message);
    }
}
```

**Pros**:

-   ✅ Instant UI loads from localStorage
-   ✅ Works offline (queued syncs when back online)
-   ✅ Persistent across devices (via Laravel DB)
-   ✅ Best of both worlds - speed + persistence
-   ✅ Handles network failures gracefully

**Cons**:

-   ⚠️ More complex implementation (sync queue)
-   ⚠️ Potential conflicts if editing same session on multiple devices
-   ⚠️ Cache invalidation complexity

**Why This Option**:

-   User experience is instant (no loading spinners)
-   Network resilience (works offline, syncs later)
-   Full persistence when needed
-   Matches modern app patterns (optimistic updates)

---

### Decision 4: System Prompt Location

This decision determines WHERE the agent's system prompt template lives and how it's managed.

#### **Option A: Frontend Prompt Template (SELECTED)**

**Overview**: System prompt as TypeScript template in Next.js, compiled with Handlebars client-side.

**Implementation**:

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
- Works in ANY language - no translation needed

**DESTRUCTIVE OPERATIONS:**
- Deletion tools require user confirmation via 'confirmed' flag
- WORKFLOW: Call without confirmed → Get requiresConfirmation → Wait for approval → Call with confirmed: true
- NEVER auto-confirm deletions
- Recognize YES: "yes", "y", "ok", "proceed", "confirm", "do it"
- Recognize NO: "no", "n", "cancel", "stop", "abort"

**CONTENT RETRIEVAL (Hybrid Pattern):**
- Default: Lightweight fetch (metadata only)
- On-demand: Full content when needed
- Pattern: cms_getPage → {sectionIds} → cms_getSectionContent(id)
- Saves 40-96% tokens

**AVAILABLE TOOLS:** ({{toolCount}})
{{toolsFormatted}}

**EXAMPLE WORKFLOWS:**
[Include 2-3 complete examples showing Think→Act→Observe loops]
`;

// lib/prompts/compiler.ts
import Handlebars from "handlebars";

const template = Handlebars.compile(REACT_PROMPT_TEMPLATE);

export function compileSystemPrompt(context: { workingMemory?: string; toolCount: number; toolsList: string[] }): string {
	return template({
		workingMemory: context.workingMemory || "",
		toolCount: context.toolCount,
		toolsFormatted: context.toolsList.map((t) => `- ${t}`).join("\n"),
	});
}
```

```typescript
// app/api/chat/route.ts - Usage
import { compileSystemPrompt } from "@/lib/prompts/compiler";
import { workingContext } from "@/lib/working-memory/working-context";
import { allTools } from "@/tools";

export async function POST(req: Request) {
	const { messages } = await req.json();

	// Compile prompt with current context
	const systemPrompt = compileSystemPrompt({
		workingMemory: workingContext.serialize(),
		toolCount: Object.keys(allTools).length,
		toolsList: Object.keys(allTools),
	});

	const agent = new ToolLoopAgent({
		model: openrouter.languageModel("openai/gpt-4o-mini"),
		instructions: systemPrompt,
		tools: allTools,
	});

	return createAgentUIStreamResponse({ agent, messages });
}
```

**Pros**:

-   ✅ Frontend team controls prompt iterations
-   ✅ Fast iteration - no backend deploy needed
-   ✅ Version control in Next.js repo with agent code
-   ✅ Type-safe prompt variables
-   ✅ Easy A/B testing with feature flags
-   ✅ Can customize per user/session instantly

**Cons**:

-   ⚠️ Prompt updates require frontend deploy (but that's fast on Vercel)
-   ⚠️ Not centralized if multiple frontend clients exist

**Why This Option**:

-   Prompts ARE code - should live with the agent
-   Frontend team iterates on AI behavior daily
-   Vercel deployments are instant (faster than Laravel deploy)
-   Easier to experiment and rollback
-   TypeScript provides better tooling than Blade templates

---

### Decision 5: Approval Flow (HITL)

This decision determines HOW human-in-the-loop approvals are handled for dangerous operations.

#### **Option A: Frontend-Only Approvals (SELECTED)**

**Overview**: Use AI SDK 6 native `needsApproval` feature, handle approvals entirely in React UI.

**Implementation**:

```typescript
// tools/http/post.ts - Tool with approval
export const httpPostTool = tool({
	description: "Make HTTP POST request to external API",
	inputSchema: z.object({
		url: z.string().url(),
		body: z.record(z.string(), z.any()),
		headers: z.record(z.string(), z.string()).optional(),
	}),
	needsApproval: true, // AI SDK 6 native approval
	execute: async (input, { logger }) => {
		logger?.info?.("HTTP POST request", { url: input.url });

		const response = await fetch(input.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...input.headers,
			},
			body: JSON.stringify(input.body),
		});

		const data = await response.json();
		return { status: response.status, data };
	},
});
```

```typescript
// app/assistant/_components/approval-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ApprovalDialogProps {
	toolName: string;
	toolInput: any;
	onApprove: () => void;
	onReject: () => void;
	isOpen: boolean;
}

export function ApprovalDialog({ toolName, toolInput, onApprove, onReject, isOpen }: ApprovalDialogProps) {
	return (
		<AlertDialog open={isOpen}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Approval Required</AlertDialogTitle>
					<AlertDialogDescription>
						The agent wants to execute <code className='font-mono'>{toolName}</code>
					</AlertDialogDescription>
				</AlertDialogHeader>

				<div className='my-4 p-4 bg-muted rounded-md'>
					<pre className='text-sm overflow-auto'>{JSON.stringify(toolInput, null, 2)}</pre>
				</div>

				<AlertDialogFooter>
					<AlertDialogCancel onClick={onReject}>Reject</AlertDialogCancel>
					<AlertDialogAction onClick={onApprove}>Approve</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
```

```typescript
// app/assistant/page.tsx - Handle approval events
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { ApprovalDialog } from "./_components/approval-dialog";

export default function AssistantPage() {
	const [pendingApproval, setPendingApproval] = useState<{
		toolName: string;
		toolCallId: string;
		input: any;
	} | null>(null);

	const { messages, sendMessage, addToolOutput } = useChat({
		transport: new DefaultChatTransport({ api: "/api/chat" }),

		// AI SDK 6 approval event handler
		onToolCall: async ({ toolCall }) => {
			// Check if tool needs approval
			if (toolCall.needsApproval) {
				// Show approval dialog
				setPendingApproval({
					toolName: toolCall.toolName,
					toolCallId: toolCall.toolCallId,
					input: toolCall.input,
				});

				// Don't execute yet - wait for user decision
				return;
			}
		},
	});

	const handleApprove = () => {
		if (!pendingApproval) return;

		// Add approval output (AI SDK will resume execution)
		addToolOutput({
			tool: pendingApproval.toolName,
			toolCallId: pendingApproval.toolCallId,
			output: { approved: true },
		});

		setPendingApproval(null);
	};

	const handleReject = () => {
		if (!pendingApproval) return;

		// Add rejection output
		addToolOutput({
			tool: pendingApproval.toolName,
			toolCallId: pendingApproval.toolCallId,
			state: "output-error",
			errorText: "User rejected tool execution",
		});

		setPendingApproval(null);
	};

	return (
		<>
			{/* Chat UI */}
			<div className='flex flex-col h-screen'>
				{/* Messages */}
				{messages.map((m) => (
					<div key={m.id}>{/* Render message */}</div>
				))}
			</div>

			{/* Approval Dialog */}
			<ApprovalDialog
				isOpen={!!pendingApproval}
				toolName={pendingApproval?.toolName || ""}
				toolInput={pendingApproval?.input}
				onApprove={handleApprove}
				onReject={handleReject}
			/>
		</>
	);
}
```

**Pros**:

-   ✅ Native AI SDK 6 feature - well-tested
-   ✅ Zero backend involvement - instant response
-   ✅ Simpler implementation
-   ✅ Works offline (local decision)
-   ✅ Better UX - no network delay

**Cons**:

-   ⚠️ No audit trail (unless manually logged)
-   ⚠️ Can't enforce org-wide approval policies
-   ⚠️ Can't delegate approvals to other users

**Why This Option**:

-   Perfect for single-user prototype/development
-   AI SDK 6 provides excellent DX for approvals
-   Can add audit logging later if needed (optional Laravel endpoint)
-   Most CMS operations don't need complex approval workflows
-   Keeps frontend independent

**Optional Enhancement** (add later if needed):

```typescript
// Log approval to Laravel for audit trail (fire-and-forget)
const handleApprove = async () => {
	// ... existing approval code ...

	// Optional: Log to Laravel (don't await)
	laravelApi
		.post("/api/audit/approvals", {
			tool: pendingApproval.toolName,
			input: pendingApproval.input,
			decision: "approved",
			timestamp: new Date().toISOString(),
		})
		.catch(console.error); // Don't block on failure
};
```

---

### Decision 6: Preview Rendering

This decision determines HOW page previews are generated and served.

#### **Option A: Laravel Blade Renderer (SELECTED)**

**Overview**: Migrate Nunjucks templates to Laravel Blade, render pages via Laravel API.

**Implementation**:

```php
// app/Http/Controllers/API/PreviewController.php
namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Page;
use Illuminate\Http\Request;

class PreviewController extends Controller
{
    public function render(Request $request)
    {
        $validated = $request->validate([
            'pageId' => 'required|uuid|exists:pages,id',
            'locale' => 'nullable|string|default:en',
        ]);

        $page = Page::with([
            'pageSections.sectionDefinition',
            'pageSections.contents' => fn($q) =>
                $q->where('locale_code', $validated['locale'] ?? 'en')
        ])
        ->findOrFail($validated['pageId']);

        // Render using Blade
        $html = view('preview.page', [
            'page' => $page,
            'sections' => $page->pageSections,
            'locale' => $validated['locale'] ?? 'en',
        ])->render();

        return response($html)->header('Content-Type', 'text/html');
    }

    public function iframe(string $pageId)
    {
        $page = Page::with([
            'pageSections.sectionDefinition',
            'pageSections.contents',
        ])->findOrFail($pageId);

        return view('preview.iframe', compact('page'));
    }
}
```

```php
// routes/web.php - Preview routes (not API, web routes for iframe)
Route::get('/preview/pages/{page}', [PreviewController::class, 'iframe'])
    ->name('preview.page');
```

```blade
{{-- resources/views/preview/page.blade.php --}}
<!DOCTYPE html>
<html lang="{{ $locale }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $page->name }} - Preview</title>

    {{-- Include section CSS bundles --}}
    @foreach($sections as $section)
        @if($section->sectionDefinition->css_bundle)
            <style>{!! $section->sectionDefinition->css_bundle !!}</style>
        @endif
    @endforeach
</head>
<body>
    <div class="page-preview" data-page-id="{{ $page->id }}">
        @foreach($sections as $section)
            @include('preview.sections.' . $section->sectionDefinition->template_key, [
                'content' => $section->contentForLocale($locale)?->content ?? [],
                'section' => $section,
            ])
        @endforeach
    </div>

    {{-- Preview toolbar --}}
    <div class="preview-toolbar">
        <span>Preview Mode</span>
        <button onclick="parent.postMessage({type: 'close-preview'}, '*')">
            Close
        </button>
    </div>
</body>
</html>
```

```blade
{{-- resources/views/preview/sections/hero.blade.php --}}
<section class="hero-section" data-section-id="{{ $section->id }}">
    <div class="hero-content">
        <h1>{{ $content['title'] ?? 'Untitled' }}</h1>
        <p>{{ $content['subtitle'] ?? '' }}</p>

        @if(isset($content['ctaText']) && isset($content['ctaLink']))
            <a href="{{ $content['ctaLink'] }}" class="cta-button">
                {{ $content['ctaText'] }}
            </a>
        @endif

        @if(isset($content['image']))
            <img src="{{ $content['image'] }}" alt="{{ $content['title'] ?? '' }}">
        @endif
    </div>
</section>
```

```typescript
// tools/preview/render-preview.ts - Frontend tool
export const renderPreviewTool = tool({
	description: "Generate preview of a page",
	inputSchema: z.object({
		pageId: z.string().uuid(),
		locale: z.string().optional().default("en"),
	}),
	execute: async ({ pageId, locale }) => {
		// Laravel renders the page
		const previewUrl = `${process.env.LARAVEL_API_URL}/preview/pages/${pageId}?locale=${locale}`;

		return {
			success: true,
			previewUrl,
			message: `Preview available at: ${previewUrl}`,
		};
	},
});
```

```typescript
// app/assistant/_components/preview-iframe.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PreviewIframeProps {
	pageId: string;
	locale?: string;
	isOpen: boolean;
	onClose: () => void;
}

export function PreviewIframe({ pageId, locale = "en", isOpen, onClose }: PreviewIframeProps) {
	const previewUrl = `${process.env.NEXT_PUBLIC_LARAVEL_URL}/preview/pages/${pageId}?locale=${locale}`;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className='max-w-6xl h-[80vh]'>
				<iframe src={previewUrl} className='w-full h-full border-0' title='Page Preview' />
			</DialogContent>
		</Dialog>
	);
}
```

**Pros**:

-   ✅ Consolidates stack - one less service (no Node preview server)
-   ✅ PHP team owns templates (matches their expertise)
-   ✅ Blade templating is powerful and well-documented
-   ✅ Can use Laravel's full feature set (localization, caching, etc.)
-   ✅ Easier to add authentication to previews

**Cons**:

-   ⚠️ Requires migrating Nunjucks templates to Blade
-   ⚠️ Preview performance depends on Laravel response time

**Why This Option**:

-   Simplifies architecture (fewer services to maintain)
-   Aligns with team structure (PHP devs manage templates)
-   Blade and Nunjucks are similar (easy migration)
-   Laravel can optimize preview rendering better than standalone Node
-   Future-proof for adding features (auth, analytics, etc.)

**Migration Path**:

1. Keep current Nunjucks preview server initially
2. Build Blade equivalents in parallel
3. Test both side-by-side
4. Switch traffic to Laravel Blade
5. Deprecate Node preview server

---

## Summary of Selected Options

Based on team structure and requirements, here are the **SELECTED** options:

1. ✅ **Vector Search**: Laravel-Managed (Option A)
2. ✅ **Working Memory**: Client-Side (Option A)
3. ✅ **Session Storage**: Hybrid localStorage + Laravel DB with aggressive caching (Option A)
4. ✅ **System Prompt**: Frontend Template (Option A)
5. ✅ **Approval Flow**: Frontend-Only with AI SDK 6 native approvals (Option A)
6. ✅ **Preview Rendering**: Laravel Blade (Option A)

These decisions create a **clean, modern architecture** that:

-   Maximizes AI SDK 6 features
-   Aligns with team expertise
-   Balances performance and persistence
-   Simplifies long-term maintenance

---

## Detailed Migration Plan

This section provides step-by-step implementation with complete code examples for all 4 phases.

### Phase 1: Laravel API Foundation (Week 1-2)

**Objective**: Build Laravel API that mirrors current Express endpoints with full database migration.

#### 1.1 Database Migration (SQLite → MySQL/PostgreSQL)

**Step 1**: Create Laravel migration matching current Drizzle schema

```bash
php artisan make:migration create_cms_tables
```

```php
// database/migrations/2024_11_16_create_cms_tables.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Teams
        Schema::create('teams', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->timestamps();
        });

        // Sites
        Schema::create('sites', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('domain')->nullable();
            $table->string('preview_domain')->nullable();
            $table->uuid('default_environment_id')->nullable();
            $table->timestamps();
        });

        // Environments
        Schema::create('environments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('site_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_protected')->default(false);
            $table->timestamps();
        });

        // Pages
        Schema::create('pages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('site_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('environment_id')->constrained()->cascadeOnDelete();
            $table->string('slug')->unique();
            $table->string('name');
            $table->boolean('indexing')->default(true);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['site_id', 'environment_id']);
        });

        // All other tables following same pattern...
        // (section_definitions, page_sections, page_section_contents,
        //  collection_definitions, collection_entries, entry_contents,
        //  sessions, messages, etc.)
    }

    public function down()
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('sessions');
        // ... drop all tables in reverse order
    }
};
```

**Step 2**: Data migration script from SQLite

```bash
php artisan make:seeder MigrateFromSQLiteSeeder
```

```php
// database/seeders/MigrateFromSQLiteSeeder.php
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MigrateFromSQLiteSeeder extends Seeder
{
    public function run()
    {
        $sqlitePath = env('SQLITE_PATH', database_path('../../data/sqlite.db'));
        $sqlite = new \PDO("sqlite:$sqlitePath");

        // Migrate teams
        $teams = $sqlite->query('SELECT * FROM teams')->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($teams as $team) {
            DB::table('teams')->insert([
                'id' => $team['id'],
                'name' => $team['name'],
                'created_at' => date('Y-m-d H:i:s', $team['created_at']),
                'updated_at' => date('Y-m-d H:i:s', $team['updated_at']),
            ]);
        }

        $this->command->info("Migrated {count($teams)} teams");

        // Migrate all other tables...
        $this->migratePages($sqlite);
        $this->migrateSections($sqlite);
        // etc.
    }

    private function migratePages(\PDO $sqlite)
    {
        $pages = $sqlite->query('SELECT * FROM pages')->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($pages as $page) {
            DB::table('pages')->insert([
                'id' => $page['id'],
                'site_id' => $page['site_id'],
                'environment_id' => $page['environment_id'],
                'slug' => $page['slug'],
                'name' => $page['name'],
                'indexing' => (bool)$page['indexing'],
                'meta' => $page['meta'],
                'created_at' => date('Y-m-d H:i:s', $page['created_at']),
                'updated_at' => date('Y-m-d H:i:s', $page['updated_at']),
            ]);
        }

        $this->command->info("Migrated {count($pages)} pages");
    }
}
```

```bash
# Run migration
php artisan migrate
php artisan db:seed --class=MigrateFromSQLiteSeeder
```

#### 1.2 Eloquent Models

**Create all 18 models matching current schema:**

```php
// app/Models/Page.php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Laravel\Scout\Searchable;

class Page extends Model
{
    use HasUuids, Searchable;

    protected $fillable = [
        'site_id', 'environment_id', 'slug', 'name', 'indexing', 'meta',
    ];

    protected $casts = [
        'indexing' => 'boolean',
        'meta' => 'array',
    ];

    public function site() {
        return $this->belongsTo(Site::class);
    }

    public function environment() {
        return $this->belongsTo(Environment::class);
    }

    public function pageSections() {
        return $this->hasMany(PageSection::class)->orderBy('sort_order');
    }

    // Scout searchable array
    public function toSearchableArray() {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'meta' => $this->meta,
        ];
    }

    public function shouldBeSearchable() {
        return $this->indexing === true;
    }
}
```

```php
// app/Models/PageSection.php
class PageSection extends Model
{
    use HasUuids;

    protected $fillable = [
        'page_id', 'section_def_id', 'sort_order', 'status',
    ];

    public function page() {
        return $this->belongsTo(Page::class);
    }

    public function sectionDefinition() {
        return $this->belongsTo(SectionDefinition::class, 'section_def_id');
    }

    public function contents() {
        return $this->hasMany(PageSectionContent::class);
    }

    public function contentForLocale(string $locale = 'en') {
        return $this->contents()->where('locale_code', $locale)->first();
    }
}
```

#### 1.3 API Routes & Controllers

**Routes matching current Express structure:**

```php
// routes/api.php
use App\Http\Controllers\API;

// CMS routes with team/site/env context
Route::prefix('v1/teams/{team}/sites/{site}/environments/{env}')
    ->middleware('auth:sanctum')
    ->group(function () {

    // Search
    Route::post('search/resources', [API\SearchController::class, 'semantic']);

    // Pages
    Route::get('pages', [API\PageController::class, 'index']);
    Route::post('pages', [API\PageController::class, 'store']);
    Route::get('pages/{page}', [API\PageController::class, 'show']);
    Route::put('pages/{page}', [API\PageController::class, 'update']);
    Route::delete('pages/{page}', [API\PageController::class, 'destroy']);
    Route::get('pages/{page}/contents', [API\PageController::class, 'contents']);

    // Page Sections
    Route::post('pages/{page}/section', [API\PageSectionController::class, 'store']);
    Route::post('pages/{page}/sections/{section}/contents',
        [API\PageSectionController::class, 'syncContent']);
    Route::delete('sections/{section}', [API\PageSectionController::class, 'destroy']);

    // Section Definitions
    Route::get('section-defs', [API\SectionDefinitionController::class, 'index']);
    Route::get('section-defs/{sectionDef}', [API\SectionDefinitionController::class, 'show']);
});

// Sessions (no team/site prefix)
Route::prefix('api')->middleware('auth:sanctum')->group(function () {
    Route::apiResource('sessions', API\SessionController::class);
    Route::get('sessions/{session}/messages', [API\SessionController::class, 'messages']);
    Route::post('sessions/{session}/messages', [API\SessionController::class, 'addMessage']);
});
```

**Page Controller Example:**

```php
// app/Http/Controllers/API/PageController.php
namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\PageRequest;
use App\Http\Resources\PageResource;
use App\Models\Page;
use App\Services\PageService;
use Illuminate\Http\Request;

class PageController extends Controller
{
    public function __construct(private PageService $pageService) {}

    public function index(Request $request)
    {
        $pages = $this->pageService->list(
            siteId: $request->route('site'),
            environmentId: $request->route('env'),
            search: $request->query('q')
        );

        return PageResource::collection($pages);
    }

    public function store(PageRequest $request)
    {
        $page = $this->pageService->create(
            siteId: $request->route('site'),
            environmentId: $request->route('env'),
            data: $request->validated()
        );

        return new PageResource($page);
    }

    public function show(string $team, string $site, string $env, string $page)
    {
        $page = Page::with(['pageSections.sectionDefinition'])
            ->findOrFail($page);

        return new PageResource($page);
    }

    public function contents(Request $request, string $team, string $site, string $env, string $page)
    {
        $locale = $request->query('locale', 'en');

        $page = Page::with([
            'pageSections.sectionDefinition',
            'pageSections.contents' => fn($q) => $q->where('locale_code', $locale)
        ])->findOrFail($page);

        return new PageResource($page);
    }
}
```

**Service Layer:**

```php
// app/Services/PageService.php
namespace App\Services;

use App\Models\Page;
use Illuminate\Support\Str;

class PageService
{
    public function list(string $siteId, string $environmentId, ?string $search = null)
    {
        $query = Page::where('site_id', $siteId)
            ->where('environment_id', $environmentId);

        if ($search) {
            $query->where(fn($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('slug', 'like', "%{$search}%")
            );
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    public function create(string $siteId, string $environmentId, array $data): Page
    {
        return Page::create([
            'id' => Str::uuid(),
            'site_id' => $siteId,
            'environment_id' => $environmentId,
            ...$data,
        ]);
    }
}
```

---

### Phase 2: Next.js Tool Library (Week 2-3)

**Objective**: Convert all 20 backend tools to HTTP clients calling Laravel APIs.

#### 2.1 Laravel API Client

```typescript
// lib/laravel-api/client.ts
class LaravelAPIClient {
	private baseURL: string;
	private apiToken: string;

	constructor() {
		this.baseURL = process.env.LARAVEL_API_URL || "http://localhost:8000";
		this.apiToken = process.env.LARAVEL_API_TOKEN || "";

		if (!this.apiToken) {
			throw new Error("LARAVEL_API_TOKEN is required");
		}
	}

	async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const url = `${this.baseURL}${endpoint}`;

		const response = await fetch(url, {
			...options,
			headers: {
				Authorization: `Bearer ${this.apiToken}`,
				"Content-Type": "application/json",
				Accept: "application/json",
				...options.headers,
			},
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: response.statusText }));
			throw new APIError(error.message, response.status, error);
		}

		const data = await response.json();
		return data.data || data; // Unwrap Laravel resource envelope
	}

	get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
		const query = params ? `?${new URLSearchParams(params).toString()}` : "";
		return this.request<T>(`${endpoint}${query}`, { method: "GET" });
	}

	post<T = any>(endpoint: string, data?: any): Promise<T> {
		return this.request<T>(endpoint, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	put<T = any>(endpoint: string, data?: any): Promise<T> {
		return this.request<T>(endpoint, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	delete<T = any>(endpoint: string): Promise<T> {
		return this.request<T>(endpoint, { method: "DELETE" });
	}
}

class APIError extends Error {
	constructor(message: string, public status: number, public data?: any) {
		super(message);
		this.name = "APIError";
	}
}

export const laravelApi = new LaravelAPIClient();
```

#### 2.2 Example Tool Migration (cms_getPage)

**Before (Express backend)**:

```typescript
// server/tools/all-tools.ts
export const cmsGetPage = tool({
	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext;
		const page = await ctx.services.pageService.getPageBySlug(input.slug);
		return page;
	},
});
```

**After (Next.js HTTP client)**:

```typescript
// tools/cms/get-page.ts
import { tool } from "ai";
import { z } from "zod";
import { laravelApi } from "@/lib/laravel-api/client";
import { cmsContext } from "@/lib/laravel-api/cms-context";

export const cmsGetPageTool = tool({
	description: "Get a page by slug or ID",
	inputSchema: z.object({
		slug: z.string().optional(),
		id: z.string().optional(),
		includeContent: z.boolean().optional().default(false),
		localeCode: z.string().optional().default("en"),
	}),
	execute: async (input, { logger }) => {
		if (!input.slug && !input.id) {
			throw new Error("Either slug or id required");
		}

		logger?.info?.("Fetching page", { slug: input.slug, id: input.id });

		try {
			let page;

			if (input.id) {
				// Fetch by ID
				const endpoint = input.includeContent
					? cmsContext.cmsPath(`pages/${input.id}/contents?locale=${input.localeCode}`)
					: cmsContext.cmsPath(`pages/${input.id}`);

				page = await laravelApi.get(endpoint);
			} else {
				// Fetch by slug (list + filter)
				const pages = await laravelApi.get(cmsContext.cmsPath("pages"), { q: input.slug });

				page = pages.find((p: any) => p.slug === input.slug);
				if (!page) throw new Error(`Page not found: ${input.slug}`);

				if (input.includeContent) {
					page = await laravelApi.get(cmsContext.cmsPath(`pages/${page.id}/contents`), { locale: input.localeCode });
				}
			}

			// Return in same format as before
			return input.includeContent
				? {
						id: page.id,
						slug: page.slug,
						name: page.name,
						sections: page.sections || [],
				  }
				: {
						id: page.id,
						slug: page.slug,
						name: page.name,
						sectionIds: page.sections?.map((s: any) => s.id) || [],
						sectionCount: page.sections?.length || 0,
				  };
		} catch (error) {
			logger?.error?.("Failed to fetch page", { error });
			throw error;
		}
	},
});
```

#### 2.3 All 20 Tools Migrated

Create similar HTTP client wrappers for:

-   ✅ cms_createPage → POST /pages
-   ✅ cms_updatePage → PUT /pages/{id}
-   ✅ cms_deletePage → DELETE /pages/{id}
-   ✅ cms_listPages → GET /pages
-   ✅ cms_addSectionToPage → POST /pages/{id}/section
-   ✅ cms_syncPageContent → POST /pages/{id}/sections/{section}/contents
-   ✅ search_vector → POST /search/resources
-   ✅ (All 20 tools following same pattern)

---

### Phase 3: Frontend Agent Migration (Week 3-4)

**Objective**: Move ToolLoopAgent to Next.js with full AI SDK 6 integration.

#### 3.1 Agent Setup

```typescript
// app/api/chat/route.ts
import { ToolLoopAgent, createAgentUIStreamResponse, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { allTools } from "@/tools";
import { compileSystemPrompt } from "@/lib/prompts/compiler";
import { workingContext } from "@/lib/working-memory/working-context";
import { entityExtractor } from "@/lib/working-memory/entity-extractor";

export const runtime = "edge"; // Deploy on Vercel Edge
export const maxDuration = 60;

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY!,
});

export async function POST(req: Request) {
	const { messages } = await req.json();

	// Compile system prompt with working memory
	const systemPrompt = compileSystemPrompt({
		workingMemory: workingContext.serialize(),
		toolCount: Object.keys(allTools).length,
		toolsList: Object.keys(allTools),
	});

	// Create agent
	const agent = new ToolLoopAgent({
		model: openrouter.languageModel("openai/gpt-4o-mini"),
		instructions: systemPrompt,
		tools: allTools,
		stopWhen: stepCountIs(15),
	});

	// Stream response
	return createAgentUIStreamResponse({
		agent,
		messages,
		onFinish: async ({ messages: finalMessages }) => {
			// Extract and track entities from tool results
			// (Optional: can do this in real-time via onToolExecuted)
		},
	});
}
```

#### 3.2 Frontend UI with useChat

```typescript
// app/assistant/page.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

export default function AssistantPage() {
	const [input, setInput] = useState("");

	const { messages, sendMessage, status, stop } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/chat",
		}),
	});

	return (
		<div className='flex flex-col h-screen'>
			{/* Messages */}
			<div className='flex-1 overflow-auto p-4'>
				{messages.map((message) => (
					<div key={message.id} className={message.role}>
						{message.parts.map((part, i) => {
							if (part.type === "text") return <div key={i}>{part.text}</div>;
							if (part.type === "tool-call") return <div key={i}>🔧 {part.toolName}</div>;
							return null;
						})}
					</div>
				))}
			</div>

			{/* Input */}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (input.trim()) {
						sendMessage({ text: input });
						setInput("");
					}
				}}
				className='border-t p-4'
			>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					disabled={status !== "ready"}
					placeholder='Ask anything...'
					className='w-full px-4 py-2 border rounded'
				/>
			</form>
		</div>
	);
}
```

---

## File/Folder Structure Reorganization

### Current Structure (Monolith)

```
react-agent-prototype/
├── app/                    # Next.js frontend
│   ├── assistant/
│   └── api/agent/route.ts  # Proxy to Express
├── server/                 # Express backend (ALL logic here)
│   ├── agent/orchestrator.ts
│   ├── tools/all-tools.ts
│   ├── services/
│   ├── routes/
│   └── db/
├── data/
│   ├── sqlite.db
│   └── lancedb/
└── package.json
```

### Target Structure (Microservices)

#### Next.js Repository

```
nextjs-cms-assistant/
├── app/
│   ├── assistant/
│   │   ├── _components/
│   │   │   ├── chat-pane.tsx
│   │   │   ├── session-sidebar.tsx
│   │   │   ├── message-item.tsx
│   │   │   ├── approval-dialog.tsx
│   │   │   └── preview-iframe.tsx
│   │   ├── _stores/
│   │   │   ├── chat-store.ts       # Zustand with Laravel sync
│   │   │   └── ui-store.ts
│   │   └── page.tsx
│   └── api/
│       └── chat/
│           └── route.ts             # ToolLoopAgent HERE
├── lib/
│   ├── laravel-api/
│   │   ├── client.ts                # HTTP client
│   │   ├── types.ts                 # API types
│   │   └── cms-context.ts           # Team/site/env
│   ├── working-memory/
│   │   ├── working-context.ts       # Client-side memory
│   │   ├── entity-extractor.ts
│   │   └── types.ts
│   ├── prompts/
│   │   ├── react.ts                 # System prompt template
│   │   └── compiler.ts              # Handlebars compiler
│   └── session-sync.ts              # Hybrid sync manager
├── tools/
│   ├── cms/
│   │   ├── get-page.ts
│   │   ├── create-page.ts
│   │   └── ... (15 CMS tools)
│   ├── search/
│   │   └── vector-search.ts
│   ├── http/
│   │   ├── get.ts
│   │   └── post.ts
│   ├── planning/
│   │   └── analyze-task.ts
│   └── index.ts                     # Export allTools
├── components/ui/                   # shadcn components
├── .env.local
├── next.config.mjs
├── package.json
└── tsconfig.json
```

#### Laravel Repository

```
laravel-cms-backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/API/
│   │   │   ├── PageController.php
│   │   │   ├── PageSectionController.php
│   │   │   ├── SectionDefinitionController.php
│   │   │   ├── SessionController.php
│   │   │   ├── SearchController.php
│   │   │   └── PreviewController.php
│   │   ├── Requests/
│   │   │   ├── PageRequest.php
│   │   │   └── ...
│   │   └── Resources/
│   │       ├── PageResource.php
│   │       └── ...
│   ├── Models/
│   │   ├── Page.php
│   │   ├── PageSection.php
│   │   └── ... (18 models)
│   └── Services/
│       ├── PageService.php
│       ├── SectionService.php
│       └── VectorSearchService.php
├── database/
│   ├── migrations/
│   │   └── 2024_11_16_create_cms_tables.php
│   └── seeders/
│       └── MigrateFromSQLiteSeeder.php
├── resources/
│   └── views/
│       └── preview/
│           ├── page.blade.php
│           └── sections/
│               ├── hero.blade.php
│               └── ...
├── routes/
│   ├── api.php
│   └── web.php
├── config/
│   ├── sanctum.php
│   └── scout.php
├── .env
├── composer.json
└── artisan
```

---

## State Management Strategy

### Client State (Next.js)

**Zustand Stores:**

```typescript
// Local UI state
useUIStore: {
  sidebarOpen: boolean;
  debugPanelOpen: boolean;
  toggleSidebar(), toggleDebugPanel()
}

// Chat state with hybrid sync
useChatStore: {
  sessionId: string | null;
  messages: Message[];
  syncManager: SessionSyncManager;
  createSession(), loadSession(), addMessage()
}
```

**Working Memory (Singleton)**:

```typescript
// lib/working-memory/working-context.ts
workingContext: {
  entities: Map<string, Entity>;
  track(entity), resolve(type?), serialize()
}
```

### Server State (Laravel)

**Database Tables:**

-   sessions, messages (chat persistence)
-   pages, sections, contents (CMS data)
-   All 18 tables from schema

**Caching Strategy:**

```php
// Laravel aggressive caching
Cache::remember("session:{$id}", 300, fn() => Session::find($id));
Cache::remember("page:{$slug}", 600, fn() => Page::where('slug', $slug)->first());
```

### Sync Pattern: Optimistic Updates

```typescript
// Example: Add message
async addMessage(message) {
  // 1. Optimistic update (instant UI)
  const tempId = `temp-${Date.now()}`;
  set(state => ({
    messages: [...state.messages, { id: tempId, ...message }]
  }));

  // 2. Queue for sync
  syncManager.enqueue({ type: 'save-message', data: message });

  // 3. Background sync (or immediate if online)
  try {
    const saved = await laravelApi.post('/api/sessions/{id}/messages', message);

    // 4. Replace temp with real
    set(state => ({
      messages: state.messages.map(m => m.id === tempId ? saved : m)
    }));
  } catch (error) {
    // 5. Rollback on failure
    set(state => ({
      messages: state.messages.filter(m => m.id !== tempId)
    }));
    throw error;
  }
}
```

---

## Streaming Architecture

### Current (Manual SSE)

```typescript
// Manual Server-Sent Events parsing
const reader = response.body.getReader();
while (true) {
	const { done, value } = await reader.read();
	buffer += decoder.decode(value);

	const lines = buffer.split("\n\n");
	for (const line of lines) {
		const match = line.match(/^event: (.+)\ndata: (.+)$/);
		// Manual event handling...
	}
}
```

### Target (AI SDK 6 Built-in)

```typescript
// AI SDK handles everything automatically
const { messages, sendMessage } = useChat({
	transport: new DefaultChatTransport({ api: "/api/chat" }),
});

// createAgentUIStreamResponse does ALL streaming logic
return createAgentUIStreamResponse({ agent, messages });
```

**Benefits:**

-   ✅ Automatic SSE formatting
-   ✅ Built-in message part streaming
-   ✅ Tool call/result streaming
-   ✅ Error handling & retry logic
-   ✅ Connection management
-   ✅ Backpressure handling

---

## Testing & Validation

### Unit Tests (Frontend)

```typescript
// tools/cms/get-page.test.ts
import { describe, it, expect, vi } from "vitest";
import { cmsGetPageTool } from "./get-page";
import { laravelApi } from "@/lib/laravel-api/client";

vi.mock("@/lib/laravel-api/client");

describe("cmsGetPageTool", () => {
	it("fetches page by slug", async () => {
		const mockPage = { id: "123", slug: "about", name: "About" };
		vi.mocked(laravelApi.get).mockResolvedValue([mockPage]);

		const result = await cmsGetPageTool.execute({ slug: "about" }, { logger: console });

		expect(result.slug).toBe("about");
		expect(laravelApi.get).toHaveBeenCalledWith(expect.stringContaining("/pages"), { q: "about" });
	});
});
```

### Integration Tests (Laravel)

```php
// tests/Feature/API/PageControllerTest.php
class PageControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_pages()
    {
        Page::factory()->count(3)->create();

        $response = $this->getJson('/v1/teams/t1/sites/s1/environments/e1/pages');

        $response->assertStatus(200)
                 ->assertJsonCount(3, 'data');
    }
}
```

---

## Risk Mitigation

### Risk 1: API Latency

**Problem**: HTTP slower than direct DB  
**Solution**: Response caching, batch operations, edge functions

### Risk 2: Breaking Changes

**Problem**: Frontend/backend must stay in sync  
**Solution**: OpenAPI contract, versioned API, feature flags

### Risk 3: Data Loss

**Problem**: SQLite → MySQL migration  
**Solution**: Backup, dry run, validation, rollback plan

### Risk 4: Complex State Sync

**Problem**: localStorage + Laravel conflicts  
**Solution**: Optimistic updates, conflict resolution, retry queue

### Risk 5: Working Memory Loss

**Problem**: Browser session ends  
**Solution**: Optional Laravel sync, session resume from server

---

## Timeline & Milestones

### Week 1-2: Laravel Foundation

-   ✅ Database migration
-   ✅ Eloquent models
-   ✅ API controllers
-   ✅ Laravel Sanctum auth
-   ✅ Meilisearch integration

**Deliverable**: Working Laravel API

### Week 2-3: Frontend Tool Library

-   ✅ Laravel API client
-   ✅ All 20 tools as HTTP clients
-   ✅ Tool unit tests

**Deliverable**: Complete tool library

### Week 3-4: Agent Migration

-   ✅ Working memory (client-side)
-   ✅ System prompt
-   ✅ Agent setup
-   ✅ useChat integration

**Deliverable**: Functional frontend agent

### Week 4-5: State & UI

-   ✅ Session management
-   ✅ Optimistic updates
-   ✅ AI Elements components

**Deliverable**: Production-ready UI

### Week 5-6: Testing & Optimization

-   ✅ Integration tests
-   ✅ Performance tuning
-   ✅ Error handling

**Deliverable**: Tested application

### Week 6-7: Preview & Deploy

-   ✅ Laravel Blade previews
-   ✅ Deploy to Vercel + Laravel
-   ✅ Documentation

**Deliverable**: Deployed system

---

## Success Criteria

### Functional Parity

-   [ ] All 20 tools working via Laravel API
-   [ ] Working memory reference resolution
-   [ ] Multi-step task execution
-   [ ] Approval flow (HITL)
-   [ ] Session persistence
-   [ ] Vector search

### Performance

-   [ ] API response < 200ms (p95)
-   [ ] Agent response < 5s (simple tasks)
-   [ ] Zero data loss in migration

### Developer Experience

-   [ ] useChat hook integration
-   [ ] AI Elements components
-   [ ] Type-safe tools
-   [ ] Hot reload working

### Production Ready

-   [ ] 90%+ test coverage
-   [ ] OpenAPI contract validated
-   [ ] Deployed to Vercel + Laravel
-   [ ] Monitoring active
-   [ ] Documentation complete

---

## Appendix

### Environment Variables

**Next.js (.env.local)**:

```bash
LARAVEL_API_URL=http://localhost:8000
LARAVEL_API_TOKEN=<sanctum-token>
OPENROUTER_API_KEY=<key>
NEXT_PUBLIC_DEFAULT_TEAM=default-team
NEXT_PUBLIC_DEFAULT_SITE=default-site
NEXT_PUBLIC_DEFAULT_ENV=main
```

**Laravel (.env)**:

```bash
DB_CONNECTION=mysql
DB_DATABASE=cms_db
SCOUT_DRIVER=meilisearch
MEILISEARCH_HOST=http://127.0.0.1:7700
SANCTUM_STATEFUL_DOMAINS=localhost:3000
FRONTEND_URL=http://localhost:3000
```

### Development Commands

```bash
# Next.js
pnpm dev          # Port 3000
pnpm build
pnpm test

# Laravel
php artisan serve # Port 8000
php artisan test
php artisan scout:import

# Docker Compose (all services)
docker-compose up
```

### Docker Compose

```yaml
version: "3.8"
services:
    nextjs:
        build: ./nextjs-cms-assistant
        ports: ["3000:3000"]
        environment:
            - LARAVEL_API_URL=http://laravel:8000
        depends_on: [laravel]

    laravel:
        build: ./laravel-cms-backend
        ports: ["8000:8000"]
        depends_on: [mysql, meilisearch]

    mysql:
        image: mysql:8.0
        ports: ["3306:3306"]
        environment:
            - MYSQL_DATABASE=cms_db
            - MYSQL_ROOT_PASSWORD=root

    meilisearch:
        image: getmeili/meilisearch:latest
        ports: ["7700:7700"]
```

---

## Conclusion

This migration plan provides a **complete roadmap** to refactor your agent from Express backend to **Next.js frontend + Laravel 11 backend**.

**Key Decisions Made:**

1. ✅ Vector search: Laravel-managed
2. ✅ Working memory: Client-side
3. ✅ Sessions: Hybrid (localStorage + Laravel with sync)
4. ✅ System prompt: Frontend template
5. ✅ Approvals: Frontend-only (AI SDK 6)
6. ✅ Preview: Laravel Blade

**Next Steps:**

1. Review with frontend and backend teams
2. Create OpenAPI spec collaboratively
3. Start Week 1: Laravel API foundation
4. Iterate based on learnings

Good luck with the migration! 🚀
