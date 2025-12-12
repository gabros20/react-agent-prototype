# Agent System Optimization Plan

**Status: ✅ COMPLETED** (2025-12-11)

## Overview

This plan implements practical improvements learned from the AI SDK Tools architecture, filtered through what actually benefits our CMS agent prototype. Focus areas: **performance**, **code organization**, **developer experience**.

**Guiding Principles:**
- No overengineering - each change must have clear, measurable benefit
- This is a prototype - delete old code freely, no backward compatibility needed
- Test everything after implementation

---

## Current State Analysis

### What We Already Have (Good)
- ✅ Tool registry with pre-computed caches (`toolMap`, `searchCorpusCache`)
- ✅ Model pricing cache with 1-hour TTL
- ✅ Prompt file caching (production mode)
- ✅ Working context version-based memoization
- ✅ Vector embeddings cached in memory at startup
- ✅ BM25 index initialized once at startup
- ✅ Redis infrastructure for background jobs (BullMQ)

### What's Missing (Opportunities)
- ❌ **No query result caching** - DB queries execute fresh every time
- ❌ **No embedding generation cache** - search queries regenerate embeddings
- ❌ **`useAgent` hook is 394 lines** - does too much, hard to maintain
- ❌ **Trace store is 951 lines** - complex state management

---

## Implementation Plan

### Sprint 1: Query & Embedding Cache (Performance)

**Goal**: Reduce redundant DB queries and expensive embedding API calls

#### 1.1 Create Simple Cache Utility

```typescript
// server/cache/simple-cache.ts
export class SimpleCache<T> {
  private cache = new Map<string, { value: T; expires: number }>();
  private readonly defaultTTL: number;

  constructor(defaultTTLMs: number = 60_000) {
    this.defaultTTL = defaultTTLMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // For cache-aside pattern
  async getOrFetch<R extends T>(
    key: string,
    fetcher: () => Promise<R>,
    ttlMs?: number
  ): Promise<R> {
    const cached = this.get(key);
    if (cached !== undefined) return cached as R;

    const value = await fetcher();
    this.set(key, value, ttlMs);
    return value;
  }
}
```

#### 1.2 Add CMS Query Caching

```typescript
// server/services/cms/cache.ts
import { SimpleCache } from '../../cache/simple-cache';
import type { Page, Section } from '../../db/schema';

// Short TTL - CMS data can change
const PAGE_CACHE_TTL = 30_000;     // 30 seconds
const SECTION_CACHE_TTL = 30_000;  // 30 seconds

export const pageCache = new SimpleCache<Page>(PAGE_CACHE_TTL);
export const sectionCache = new SimpleCache<Section>(SECTION_CACHE_TTL);
export const sectionsByPageCache = new SimpleCache<Section[]>(SECTION_CACHE_TTL);

// Cache invalidation helpers
export function invalidatePageCache(pageId: string): void {
  pageCache.delete(`page:${pageId}`);
  pageCache.delete(`page:slug:*`); // Invalidate slug lookups too
}

export function invalidateSectionCache(sectionId: string, pageId?: string): void {
  sectionCache.delete(`section:${sectionId}`);
  if (pageId) {
    sectionsByPageCache.delete(`sections:page:${pageId}`);
  }
}
```

#### 1.3 Integrate with PageService

```typescript
// In server/services/cms/page-service.ts
import { pageCache, invalidatePageCache } from './cache';

class PageService {
  async getPage(pageId: string): Promise<Page | null> {
    return pageCache.getOrFetch(
      `page:${pageId}`,
      () => this.db.query.pages.findFirst({ where: eq(pages.id, pageId) })
    );
  }

  async getPageBySlug(slug: string, siteId: string): Promise<Page | null> {
    return pageCache.getOrFetch(
      `page:slug:${siteId}:${slug}`,
      () => this.db.query.pages.findFirst({
        where: and(eq(pages.slug, slug), eq(pages.siteId, siteId))
      })
    );
  }

  async updatePage(pageId: string, data: Partial<Page>): Promise<Page> {
    const result = await this.db.update(pages).set(data).where(eq(pages.id, pageId)).returning();
    invalidatePageCache(pageId); // Invalidate on write
    return result[0];
  }
}
```

#### 1.4 Embedding Cache for Search Queries

The vector search currently generates embeddings for EVERY search query:

```typescript
// server/services/search/vector-search.ts - CURRENT
export async function vectorSearch(query: string, limit: number = 5) {
  const queryEmbedding = await embed(query); // API call every time!
  // ...
}
```

**Fix**: Add query embedding cache

```typescript
// server/services/search/embedding-cache.ts
import { createHash } from 'crypto';
import { SimpleCache } from '../../cache/simple-cache';

// Embeddings are deterministic - cache for longer
const EMBEDDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const embeddingCache = new SimpleCache<number[]>(EMBEDDING_CACHE_TTL);

export async function getCachedEmbedding(
  text: string,
  generator: (text: string) => Promise<number[]>
): Promise<number[]> {
  // Hash the text for consistent keys
  const hash = createHash('sha256').update(text.slice(0, 500)).digest('hex').slice(0, 16);

  return embeddingCache.getOrFetch(
    `emb:${hash}`,
    () => generator(text)
  );
}
```

**Update vector-search.ts:**

```typescript
import { getCachedEmbedding } from './embedding-cache';

export async function vectorSearch(query: string, limit: number = 5) {
  const queryEmbedding = await getCachedEmbedding(query, embed);
  // ... rest unchanged
}
```

**Files to Create/Modify:**
- CREATE: `server/cache/simple-cache.ts`
- CREATE: `server/cache/index.ts` (exports)
- CREATE: `server/services/cms/cache.ts`
- CREATE: `server/services/search/embedding-cache.ts`
- MODIFY: `server/services/cms/page-service.ts`
- MODIFY: `server/services/cms/section-service.ts`
- MODIFY: `server/services/search/vector-search.ts`

---

### Sprint 2: Frontend Hook Decomposition (Maintainability)

**Goal**: Break up the 394-line `useAgent` hook into focused, testable pieces

#### 2.1 Extract SSE Event Handlers

```typescript
// app/assistant/_hooks/sse-handlers.ts
import type { TraceLogger } from '@/lib/debug-logger';
import type { SSEEvent } from '@/lib/api';

export interface SSEHandlerContext {
  store: {
    appendToStreamingMessage: (delta: string) => void;
    setAgentStatus: (status: { state: string; toolName?: string } | null) => void;
    startStreamingMessage: (id: string) => void;
    finalizeStreamingMessage: () => void;
    setSessionId: (id: string) => void;
    setCurrentTraceId: (id: string) => void;
  };
  trace: TraceLogger | null;
  refs: {
    streamingText: React.MutableRefObject<string>;
    userPrompt: React.MutableRefObject<string>;
  };
}

export function createSSEHandlers(ctx: SSEHandlerContext) {
  return {
    'text-delta': (data: { delta?: string; text?: string }) => {
      const delta = data.delta || data.text || '';
      ctx.refs.streamingText.current += delta;
      ctx.store.appendToStreamingMessage(delta);
      ctx.trace?.textDelta(delta);
    },

    'message-start': (data: { messageId?: string }) => {
      const messageId = data.messageId || crypto.randomUUID();
      ctx.store.startStreamingMessage(messageId);
    },

    'message-complete': () => {
      ctx.store.finalizeStreamingMessage();
    },

    'tool-call': (data: { toolName: string; args: unknown; toolCallId: string }) => {
      ctx.store.setAgentStatus({ state: 'tool-call', toolName: data.toolName });
      ctx.trace?.toolCall(data.toolName, data.args, data.toolCallId);
    },

    'tool-result': (data: { toolCallId: string; result: unknown; toolName?: string }) => {
      ctx.store.setAgentStatus({ state: 'thinking' });
      const result = data.result as Record<string, unknown>;
      if (result?.requiresConfirmation) {
        ctx.trace?.toolConfirmation(data.toolCallId, data.toolName || '', result);
      } else {
        ctx.trace?.toolResult(data.toolCallId, result);
      }
    },

    'step-start': (data: { stepNumber: number; activeTools?: string[]; discoveredTools?: string[] }) => {
      ctx.refs.streamingText.current = '';
      ctx.trace?.stepStart(data.stepNumber, {
        activeTools: data.activeTools,
        discoveredTools: data.discoveredTools,
      });
    },

    'step-finish': (data: { stepNumber: number; duration?: number; usage?: { promptTokens?: number; completionTokens?: number } }) => {
      const finalText = ctx.refs.streamingText.current;
      if (finalText) {
        ctx.trace?.textFinalize(data.stepNumber, finalText, data.duration);
      }
      ctx.refs.streamingText.current = '';
      ctx.trace?.stepComplete(data.stepNumber, {
        duration: data.duration,
        tokens: data.usage ? { input: data.usage.promptTokens || 0, output: data.usage.completionTokens || 0 } : undefined,
      });
    },

    'result': (data: { traceId: string; sessionId?: string; text?: string; usage?: unknown }, currentSessionId: string | null) => {
      ctx.store.setCurrentTraceId(data.traceId);
      if (data.sessionId && data.sessionId !== currentSessionId) {
        ctx.store.setSessionId(data.sessionId);
      }
      const usage = data.usage as { promptTokens?: number; completionTokens?: number } | undefined;
      ctx.trace?.llmResponse(data.text || '', {
        input: usage?.promptTokens || 0,
        output: usage?.completionTokens || 0,
      });
      return { traceId: data.traceId, text: data.text };
    },

    'error': (data: { error?: string; stack?: string }) => {
      ctx.trace?.error(data.error || 'Unknown error', data.stack);
      return new Error(data.error || 'Unknown error');
    },
  };
}
```

#### 2.2 Simplified useAgent Hook

```typescript
// app/assistant/_hooks/use-agent.ts (REWRITTEN - ~100 lines)
'use client';

import { useCallback, useState, useRef } from 'react';
import { useChatStore } from '../_stores/chat-store';
import { useTraceStore } from '../_stores/trace-store';
import { useSessionStore } from '../_stores/session-store';
import { agentApi, sessionsApi } from '@/lib/api';
import { debugLogger } from '@/lib/debug-logger';
import { createSSEHandlers, type SSEHandlerContext } from './sse-handlers';
import type { TraceLogger } from '@/lib/debug-logger';

export function useAgent() {
  const store = useChatStore();
  const sessionStore = useSessionStore();
  const [error, setError] = useState<Error | null>(null);

  // Refs for cross-event state
  const traceRef = useRef<TraceLogger | null>(null);
  const traceStartTimeRef = useRef<number>(0);
  const userPromptRef = useRef<string>('');
  const streamingTextRef = useRef<string>('');

  const sendMessage = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;

    setError(null);
    store.setIsStreaming(true);
    store.setAgentStatus({ state: 'thinking' });

    // Track for logging
    userPromptRef.current = prompt;
    traceStartTimeRef.current = Date.now();
    streamingTextRef.current = '';

    // Add user message
    store.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      createdAt: new Date(),
    });

    try {
      const modelId = sessionStore.getCurrentSessionModel();
      const stream = await agentApi.stream({
        sessionId: store.sessionId || undefined,
        prompt,
        modelId: modelId || undefined,
      });

      // Create handler context
      const handlerCtx: SSEHandlerContext = {
        store: {
          appendToStreamingMessage: store.appendToStreamingMessage,
          setAgentStatus: store.setAgentStatus,
          startStreamingMessage: store.startStreamingMessage,
          finalizeStreamingMessage: store.finalizeStreamingMessage,
          setSessionId: store.setSessionId,
          setCurrentTraceId: store.setCurrentTraceId,
        },
        trace: traceRef.current,
        refs: {
          streamingText: streamingTextRef,
          userPrompt: userPromptRef,
        },
      };

      const handlers = createSSEHandlers(handlerCtx);

      for await (const event of stream) {
        // Initialize trace on first event with traceId
        if (!traceRef.current && event.data?.traceId) {
          traceRef.current = debugLogger.trace(event.data.traceId as string);
          traceRef.current.start({
            sessionId: store.sessionId || undefined,
            userPrompt: userPromptRef.current,
          });
          handlerCtx.trace = traceRef.current;
        }

        // Dispatch to handler
        const handler = handlers[event.type as keyof typeof handlers];
        if (handler) {
          (handler as Function)(event.data, store.sessionId);
        }

        // Handle done event specially (save logs)
        if (event.type === 'done') {
          await handleDone(traceRef.current, store.sessionId);
          traceRef.current = null;
        }
      }
    } catch (err) {
      const e = err as Error;
      console.error('Agent error:', e);
      setError(e);
      debugLogger.error(e.message, e);
    } finally {
      store.setIsStreaming(false);
      store.setAgentStatus(null);
    }
  }, [store.sessionId, store, sessionStore]);

  return {
    messages: store.messages,
    streamingMessage: store.streamingMessage,
    sendMessage,
    isStreaming: store.isStreaming,
    error,
  };
}

// Helper to save conversation log
async function handleDone(trace: TraceLogger | null, sessionId: string | null) {
  if (!trace || !sessionId) return;

  trace.complete({ metrics: useTraceStore.getState().getMetrics() });

  const traceStore = useTraceStore.getState();
  const entries = traceStore.entriesByTrace[trace.traceId] || [];
  const metrics = traceStore.getMetrics();
  const modelInfo = traceStore.modelInfoByTrace[trace.traceId];

  await sessionsApi.saveLog(sessionId, {
    userPrompt: '', // Already stored in ref
    entries: entries.map(e => ({ ...e })),
    metrics,
    modelInfo: modelInfo || undefined,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  }).catch(err => console.error('Failed to save log:', err));
}
```

**Files to Create/Modify:**
- CREATE: `app/assistant/_hooks/sse-handlers.ts`
- REWRITE: `app/assistant/_hooks/use-agent.ts` (394 → ~100 lines)

---

### Sprint 3: Cleanup & Organization

**Goal**: Remove dead code, consolidate types, improve organization

#### 3.1 Delete Old Analysis Document

The analysis file was for planning - delete it now that we have a concrete plan:

```bash
rm docs/analysis/AI_SDK_TOOLS_ANALYSIS.md
```

#### 3.2 Consolidate Cache Exports

```typescript
// server/cache/index.ts
export { SimpleCache } from './simple-cache';
export { pageCache, sectionCache, invalidatePageCache, invalidateSectionCache } from './cms-cache';
export { getCachedEmbedding } from './embedding-cache';
```

#### 3.3 Add Cache Stats Endpoint (Dev Only)

```typescript
// server/routes/debug.ts (add to existing or create)
router.get('/cache-stats', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not available' });
  }

  res.json({
    pageCache: pageCache.stats(),
    sectionCache: sectionCache.stats(),
    embeddingCache: embeddingCache.stats(),
  });
});
```

---

## Testing Checklist

After each sprint, verify:

### Sprint 1 Tests
- [ ] `pnpm typecheck` passes
- [ ] Page queries use cache (check logs for cache hits)
- [ ] Section queries use cache
- [ ] Embedding cache reduces API calls (search same query twice)
- [ ] Cache invalidation works (update page, then fetch - should get new data)
- [ ] Tool search still works correctly

### Sprint 2 Tests
- [ ] `pnpm typecheck` passes
- [ ] Agent streaming works end-to-end
- [ ] All SSE events handled correctly
- [ ] Tool calls display in debug panel
- [ ] Conversation logs saved to DB
- [ ] Error handling works

### Sprint 3 Tests
- [ ] No unused imports/exports
- [ ] All tests pass
- [ ] Dev server starts cleanly
- [ ] No console errors

---

## Implementation Order

```
Sprint 1: Query & Embedding Cache
├── 1.1 Create SimpleCache utility
├── 1.2 Create CMS cache module
├── 1.3 Integrate with PageService
├── 1.4 Integrate with SectionService
├── 1.5 Create embedding cache
├── 1.6 Integrate with vector-search
└── TEST: Verify caching works

Sprint 2: Hook Decomposition
├── 2.1 Create sse-handlers.ts
├── 2.2 Rewrite use-agent.ts
└── TEST: Verify streaming works

Sprint 3: Cleanup
├── 3.1 Delete analysis doc
├── 3.2 Consolidate exports
├── 3.3 Add cache stats (optional)
└── TEST: Final verification
```

---

## Files Summary

### New Files
- `server/cache/simple-cache.ts` - Generic cache utility
- `server/cache/index.ts` - Cache exports
- `server/services/cms/cache.ts` - CMS-specific caches
- `server/services/search/embedding-cache.ts` - Query embedding cache
- `app/assistant/_hooks/sse-handlers.ts` - Extracted SSE handlers

### Modified Files
- `server/services/cms/page-service.ts` - Add caching
- `server/services/cms/section-service.ts` - Add caching
- `server/services/search/vector-search.ts` - Use embedding cache
- `app/assistant/_hooks/use-agent.ts` - Simplify (394 → ~100 lines)

### Deleted Files
- `docs/analysis/AI_SDK_TOOLS_ANALYSIS.md` - Planning doc, no longer needed

---

## Expected Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| DB queries per agent turn | ~5-10 | ~1-3 (cache hits) | 60-70% reduction |
| Embedding API calls | 1 per search | 1 per unique query | Significant for repeated searches |
| `useAgent` lines | 394 | ~100 | 75% reduction |
| Maintainability | Low (monolithic) | High (focused modules) | Easier to debug/extend |

---

## Out of Scope (Future Consideration)

These were identified in the AI SDK Tools analysis but NOT included in this plan:

1. **Multi-agent routing** - Our 41 tools fit single agent well
2. **Artifact streaming** - No current use case for rich previews
3. **Memory provider abstraction** - SQLite works fine for prototype
4. **User profile persistence** - Not needed yet
5. **Follow-up suggestions** - Nice-to-have, not critical

These can be reconsidered if/when the prototype grows.
