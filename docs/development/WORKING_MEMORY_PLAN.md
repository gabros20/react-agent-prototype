# Universal Working Memory System - Design & Implementation Plan

## Research Foundation

This design is based on comprehensive research into:
- **Mem0**: Production memory systems for LLM agents (91% latency reduction, 90% token savings)
- **A-MEM**: Agentic memory with Zettelkasten-inspired dynamic knowledge networks
- **AWS AgentCore Memory**: Semantic memory extraction and intelligent memory management
- **Anthropic Context Engineering**: RAM vs hard drive analogy - working memory vs long-term storage
- **Galileo AI Context Engineering**: 100:1 input-to-output token ratio optimization strategies
- **AI SDK v6**: `experimental_context`, `prepareStep`, and `onStepFinish` native patterns

---

## Problem Statement

### Current State
After page refresh, when user asks "what sections are on this page?", the agent cannot resolve the reference "this page" → "About page" even though:
- ✅ Full conversation history is loaded from database
- ✅ Agent has access to all previous messages
- ✅ Backend correctly retrieves session data

### Root Cause
**Reference Resolution Failure**: The agent sees tool calls and results in history, but cannot infer that "this page" refers to the "About page" mentioned 4 messages ago, especially after:
- Multiple tool executions occurred
- Task was completed (deletion finished)
- No explicit "current working context" maintained

### Research Insights
From Context Engineering research:
> "Context is working memory (RAM) - what the agent sees RIGHT NOW during inference. Memory is long-term storage (hard drive) - historical data that must be explicitly retrieved and presented. LLMs lose focus as context window grows (context rot)."

**Key Finding**: Storing full tool results (500+ tokens each) in chat history creates:
1. **Context Rot**: Agent loses focus scanning thousands of tokens
2. **Token Bloat**: 5 messages × 500 tokens = 2500 tokens vs 100 tokens with working memory
3. **Reference Ambiguity**: No structured "current entities" - agent must infer from narrative

---

## Solution Architecture

### Core Principle
**"Extract entities from tool results → Store in working memory → Inject ALWAYS → Let LLM ignore if not needed"**

Based on research: Working memory should be **complementary** to chat history, not redundant.

---

## Design Components

### 1. Entity Extractor (Universal, Type-Agnostic)

**Purpose**: Extract structured entities from ANY tool result

**Interface**:
```typescript
interface Entity {
  type: string;        // 'page' | 'section' | 'collection' | 'media' | 'entry' | 'task'
  id: string;          // UUID
  name: string;        // Human-readable name
  slug?: string;       // URL slug (if applicable)
  timestamp: Date;     // When last accessed
}

class EntityExtractor {
  extract(toolName: string, toolResult: any): Entity[]
}
```

**Universal Patterns** (works for ANY CMS resource):
1. **Single Resource Result**: `{id, name, slug}` → Extract as single entity
2. **Search Results**: `{matches: [...]}` → Extract top 3-5 entities
3. **List Results**: `[{id, name}, ...]` → Extract top 5 entities

**Type Inference**: Derive type from tool name (`cms_getPage` → `page`, `cms_findResource` → from result)

**Language-Agnostic**: No hardcoded patterns - works for ANY entity in ANY language

---

### 2. Working Context (Sliding Window)

**Purpose**: Maintain recent entity access history

**Interface**:
```typescript
class WorkingContext {
  private entities: Entity[] = [];
  private readonly MAX_ENTITIES = 10; // Sliding window
  
  add(entity: Entity): void
  addMany(entities: Entity[]): void
  getRecent(count: number = 5): Entity[]
  toContextString(): string  // Format for injection
  clear(): void
}
```

**Sliding Window Strategy**:
- Keep only **last 10 accessed entities**
- Most recent entities at the front
- Automatically prunes old entries (FIFO)
- Prevents unbounded growth

**Context String Format**:
```
[WORKING MEMORY]
pages:
  - "About Us" (abc-123)
  - "Homepage" (def-456)
sections:
  - "Hero Section" (ghi-789)
collections:
  - "Blog Posts" (jkl-012)
```

**Token Efficiency**: ~100 tokens vs ~2000+ tokens for full history (95% reduction)

---

### 3. Context Injection (No Detection Needed)

**Strategy**: **ALWAYS inject** working memory into system prompt

**Why No Detection**:
- ❌ Avoid extra LLM call (~100ms latency, $0.01/month cost)
- ❌ Avoid hardcoded language patterns (English-only regex)
- ✅ LLM naturally ignores irrelevant context (trained behavior)
- ✅ Simpler implementation (no heuristics needed)

**Injection Point**: System prompt template

**Handlebars Variable**:
```xml
<system>
You are an AI agent managing a CMS.

{{workingMemory}}

## Available Tools
...
</system>
```

**Agent Instruction**:
```xml
## Reference Resolution
- When user mentions "this page", "that section", "it", "them", check WORKING MEMORY above
- WORKING MEMORY shows recently accessed resources
- If reference is ambiguous, use MOST RECENT resource of appropriate type
```

---

## Integration Architecture

### Orchestrator Integration

**Location**: `server/agent/orchestrator.ts`

**Hook Points**:
1. **On Tool Result** (`onStepFinish`): Extract entities, update working context
2. **Before Agent Call** (`getSystemPrompt`): Inject working memory string
3. **Session Lifecycle**: Load/save working context with session

**Flow**:
```
User Message
  ↓
Load Session (chat history + working context)
  ↓
Inject Working Memory → System Prompt
  ↓
Agent Execution
  ↓
Tool Results → Extract Entities → Update Working Context
  ↓
Save Session (chat history + working context)
  ↓
Return Response
```

---

### Session Service Integration

**Location**: `server/services/session-service.ts`

**Schema Addition**:
```typescript
// Add to sessions table
export const sessions = sqliteTable("sessions", {
  // ... existing fields
  workingContext: text("working_context", { mode: "json" }), // NEW
});
```

**Methods**:
```typescript
class SessionService {
  async saveWorkingContext(sessionId: string, context: WorkingContext): Promise<void>
  async loadWorkingContext(sessionId: string): Promise<WorkingContext>
}
```

**Storage Format** (JSON):
```json
{
  "entities": [
    {"type": "page", "id": "abc", "name": "About", "slug": "about", "timestamp": "2025-11-15T10:30:00Z"},
    {"type": "section", "id": "def", "name": "Hero", "timestamp": "2025-11-15T10:29:00Z"}
  ]
}
```

---

## Modular Implementation Plan

### Module Structure

```
server/
└── services/
    └── working-memory/
        ├── index.ts                    # Public exports
        ├── entity-extractor.ts         # Universal entity extraction
        ├── working-context.ts          # Sliding window manager
        ├── types.ts                    # Shared types
        └── __tests__/
            ├── entity-extractor.test.ts
            └── working-context.test.ts
```

### Design Principles

1. **Plug-and-Play**: Can be disabled via feature flag
2. **No Breaking Changes**: Existing code works without it
3. **Self-Contained**: All logic in `working-memory/` module
4. **Testable**: Pure functions, dependency injection
5. **Observable**: Logs all entity extractions for debugging

---

## Feature Flag

**Environment Variable**: `ENABLE_WORKING_MEMORY=true|false`

**Graceful Degradation**:
```typescript
if (process.env.ENABLE_WORKING_MEMORY === 'true') {
  // Extract entities and inject context
} else {
  // Skip working memory logic
}
```

**Benefits**:
- Easy A/B testing
- Rollback without code changes
- Performance comparison

---

## Token Economics

### Without Working Memory
```
Chat History: 5 messages × 400 tokens = 2000 tokens
- User message (50 tokens)
- Tool call (100 tokens)
- Tool result with full JSON (500 tokens)
- Agent response (200 tokens)
- Repeat...

Total Input Tokens: ~2000 tokens/request
Cost: ~$0.002/request (at $0.001/1K tokens)
```

### With Working Memory
```
Chat History: 5 messages × 100 tokens = 500 tokens
- User message (50 tokens)
- Tool call (50 tokens)
- Entity extracted → stored separately
- Agent response (100 tokens)

Working Memory: ~100 tokens (structured entities)

Total Input Tokens: ~600 tokens/request
Cost: ~$0.0006/request (70% cheaper)
```

**Savings**: $0.0014/request × 1000 requests/day = **$1.40/day = $42/month**

---

## Testing Strategy

### Unit Tests

**Entity Extractor**:
- ✅ Extracts single resource (cms_getPage)
- ✅ Extracts search results (cms_findResource)
- ✅ Extracts list results (cms_listPages)
- ✅ Handles empty results gracefully
- ✅ Infers type from tool name correctly
- ✅ Handles unknown tool names (returns empty)

**Working Context**:
- ✅ Adds entity to front of list
- ✅ Prunes old entities (sliding window)
- ✅ Returns recent N entities
- ✅ Formats context string correctly
- ✅ Groups entities by type
- ✅ Handles empty context (returns empty string)

### Integration Tests

**Orchestrator**:
- ✅ Extracts entities from tool results
- ✅ Injects working memory into system prompt
- ✅ Saves working context to session
- ✅ Loads working context from session
- ✅ Works with disabled feature flag

**End-to-End**:
- ✅ User: "delete all sections from about page"
- ✅ Agent: Uses cms_getPage → Entity extracted: "About page"
- ✅ User: "what sections are on this page?"
- ✅ Agent: Resolves "this page" → "About page" ✅

---

## Rollout Plan

### Phase 1: Core Implementation (Sprint 15)
1. Create working-memory module
2. Implement EntityExtractor
3. Implement WorkingContext
4. Add unit tests (90%+ coverage)

### Phase 2: Integration (Sprint 15 continued)
5. Add orchestrator hooks (onStepFinish, getSystemPrompt)
6. Update session schema + service
7. Update system prompt template
8. Add feature flag

### Phase 3: Testing & Validation (Sprint 15 continued)
9. Write integration tests
10. Test with real scenarios (HITL flow)
11. Measure token reduction (before/after)
12. Document usage in QUICK_REFERENCE.md

### Phase 4: Production (Post-Sprint 15)
13. Enable feature flag in production
14. Monitor performance metrics
15. Gather user feedback
16. Iterate based on findings

---

## Success Metrics

**Performance**:
- ✅ 70%+ token reduction in input context
- ✅ No latency increase (<10ms overhead)
- ✅ 95%+ reference resolution accuracy

**Code Quality**:
- ✅ 90%+ test coverage
- ✅ Zero breaking changes to existing code
- ✅ Clean module boundaries

**User Experience**:
- ✅ Agent resolves "this/that/it" references correctly
- ✅ Works in all languages (no hardcoded patterns)
- ✅ Graceful degradation when disabled

---

## Future Enhancements

### Phase 5: Advanced Features (Post-Sprint 16)

**1. Entity Relationships**
```typescript
interface Entity {
  // ... existing fields
  relationships?: {
    parentId?: string;    // Section belongs to Page
    childIds?: string[];  // Page has Sections
  }
}
```

**2. Task Tracking**
```typescript
interface WorkingContext {
  // ... existing fields
  currentTask?: {
    type: 'deletion' | 'creation' | 'update';
    status: 'pending' | 'in-progress' | 'completed';
    entities: string[];  // Entity IDs involved
  }
}
```

**3. Semantic Clustering**
- Group related entities (e.g., "About page" + its sections)
- Reduce clutter in working memory
- Improve context relevance

**4. Adaptive Window Size**
- Shrink window for simple tasks (5 entities)
- Expand window for complex workflows (15 entities)
- Based on task complexity detection

**5. Entity Expiry**
- Remove entities not accessed for >5 minutes
- Keep frequently accessed entities longer
- Balance between relevance and staleness

---

## Appendix: Research References

1. **Mem0 Paper**: "Building Production-Ready AI Agents with Scalable Long-Term Memory" (arXiv:2504.19413)
2. **A-MEM Paper**: "Agentic Memory for LLM Agents" (arXiv:2502.12110)
3. **AWS AgentCore Memory**: https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-agentcore-memory
4. **Anthropic Context Engineering**: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
5. **Galileo AI Context Engineering**: https://galileo.ai/blog/context-engineering-for-agents
6. **AI SDK v6 Documentation**: https://ai-sdk.dev/docs/ai-sdk-core
7. **Context Compression Research**: "A Human-Inspired Reading Agent with Gist Memory" (arXiv:2402.09727)
8. **Multilingual Coreference Resolution**: "Findings of the Fourth Shared Task on Multilingual Coreference Resolution" (arXiv:2509.17796)

---

## Conclusion

This universal working memory system solves the reference resolution problem through:
- ✅ **Entity extraction** from tool results (universal patterns)
- ✅ **Sliding window** context management (auto-pruning)
- ✅ **Always-on injection** (no detection needed)
- ✅ **Language-agnostic** (no hardcoded patterns)
- ✅ **Token-efficient** (70%+ reduction)
- ✅ **Modular design** (plug-and-play)

Based on production-proven patterns from Mem0, A-MEM, and AWS AgentCore Memory, this design provides a scalable foundation for stateful context tracking in LLM agents.
