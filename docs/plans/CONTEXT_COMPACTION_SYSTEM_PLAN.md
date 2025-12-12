# Context Compaction System Plan

---

## Executive Summary (Read This First When Resuming)

### What We're Building

A **context compaction system** for our CMS agent that prevents AI drift during long conversations. When context approaches the model's limit, instead of blindly trimming messages (causing the AI to "forget" what it was doing), we:

1. **Prune tool outputs first** - Keep tool call structure, clear verbose results (cheap, 50%+ savings)
2. **Summarize if still needed** - LLM generates a continuation prompt capturing intent, actions, and state
3. **Inject summary as user-assistant pair** - NOT into system prompt (preserves LLM caching)

### Why We're Building It

**The Core Problem**: Current context trimming just deletes old messages. The AI loses:
- Original user intent ("build me a landing page")
- Actions already taken ("created hero, added 3 features")
- Current state ("working on CTA button")
- What's next ("need pricing section")

**Real Impact**: After trimming, the AI might repeat work, contradict itself, or lose the thread entirely.

### Key Research Insights

1. **OpenCode Pattern**: Production-tested compaction from coding assistant with millions of requests
   - Two-stage: prune first (cheap), summarize second (expensive)
   - PRUNE_PROTECT threshold protects recent turns
   - User-assistant pair injection (not system prompt)

2. **LLM Caching Discovery** (Critical):
   - All providers use **prefix-based caching**
   - Changing system prompt = cache invalidated = MORE expensive
   - Summary MUST be injected as conversation turn, not system prompt modification
   - This led to Phase 8: Cache-Safe Dynamic Injection Plan

3. **Multi-Provider Compatibility**:
   - OpenAI: 50% automatic savings on cached prefixes
   - Anthropic: 90% savings but requires `cache_control` markers
   - DeepSeek: Up to 90% automatic savings
   - All benefit from stable system prompts

### Architecture At A Glance

```
User sends message
       ↓
┌──────────────────────────────┐
│   OverflowDetector           │ ← Check: tokens > 80% of model limit?
│   (token counting)           │
└──────────────────────────────┘
       ↓ overflow detected
┌──────────────────────────────┐
│   ToolOutputPruner           │ ← First: prune old tool outputs
│   (cheap, fast)              │    Keep tool calls, clear results
└──────────────────────────────┘
       ↓ still over limit?
┌──────────────────────────────┐
│   CompactionService          │ ← Second: LLM summarization
│   (expensive, powerful)      │    Generate continuation prompt
└──────────────────────────────┘
       ↓
┌──────────────────────────────┐
│   User-Assistant Pair        │ ← Inject as conversation:
│   Injection                  │    user: "summarize progress"
│                              │    assistant: "[summary]"
└──────────────────────────────┘
       ↓
Continue with reduced context + preserved intent
```

### Key Decisions Made

| Decision | Choice | Why |
|----------|--------|-----|
| Overflow detection | Token-based (not message count) | Messages vary wildly in size |
| Pruning target | Tool outputs only | Preserve structure, clear verbose data |
| Summary injection | User-assistant pair | Preserves LLM cache (NOT system prompt) |
| Message storage | New `message_parts` table | AI SDK v6 multi-part messages |
| Compaction indicator | Frontend UI components | User sees "Optimizing..." during compaction |

### Related Plans

- **Phase 8** links to: [CACHE_SAFE_DYNAMIC_INJECTION_PLAN.md](./CACHE_SAFE_DYNAMIC_INJECTION_PLAN.md)
  - Addresses: Working memory and tool prompts also inject into system prompt
  - Solution: Move ALL dynamic content to conversation history

### Knowledge Base Entry

Our research is documented in: [2.2.5 Prompt Caching & Context Compaction](../knowledge-base/2-context/2.2.5-prompt-caching.md)

---

## Overview

Complete reimplementation of context management to prevent AI drift and maintain task continuity during long sessions. Based on OpenCode's battle-tested compaction strategy, adapted for our CMS agent with AI SDK v6.

**Problem Statement**: When context trimming occurs, the AI loses track of:
- Original user intent
- What actions were taken
- Current state of the task
- What needs to be done next

**Solution**: Implement a multi-layer context management system with:
1. Token-based overflow detection (not message count)
2. Smart tool output pruning (keep calls, clear old outputs)
3. Conversation summarization before trimming
4. Proper AI SDK v6 message format preservation

---

## Progress Tracking

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Done | Foundation - Types, Token Service, Model Limits |
| Phase 2 | ✅ Done | Tool Output Pruning |
| Phase 3 | ✅ Done | Message Store Redesign (schema + message-store.ts) |
| Phase 4 | ✅ Done | Compaction/Summarization Service |
| Phase 5 | ✅ Done | Context Preparation (message-converter, context-preparation) |
| Phase 6 | ✅ Done | Backend Integration (context-coordinator, feature flag) |
| Phase 7 | ⬜ Pending | Frontend Integration - UI, Debugging & Chat History |
| Phase 8 | ⬜ Pending | **[EXTERNAL]** Cache-Safe Dynamic Injection → See [CACHE_SAFE_DYNAMIC_INJECTION_PLAN.md](./CACHE_SAFE_DYNAMIC_INJECTION_PLAN.md) |

**Implementation Notes:**
- Feature flag `useCompaction` in `context-coordinator.ts` defaults to `false`
- Set to `true` to enable the new compaction system
- MessageStore created but not yet integrated into Services (deferred for future rich message storage)
- message_parts table exists but not used yet (future use for per-part token tracking)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ContextCoordinator                            │
│                   (Orchestrates all below)                       │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐       ┌─────────────────┐       ┌──────────────────┐
│ OverflowDetector│     │ ToolOutputPruner │     │ CompactionService │
│ - Token counting│     │ - PRUNE_PROTECT  │     │ - Summarization   │
│ - Model limits  │     │ - Mark compacted │     │ - Continuation    │
│ - Reserve calc  │     │ - Keep calls     │     │   prompt          │
└───────────────┘       └─────────────────┘       └──────────────────┘
        │                         │                         │
        └─────────────────────────┼─────────────────────────┘
                                  │
                                  ▼
                    ┌───────────────────────┐
                    │     MessageStore      │
                    │ - Rich part structure │
                    │ - Compaction markers  │
                    │ - Token tracking      │
                    └───────────────────────┘
```

---

## Phase 1: Foundation - Types, Token Service, Model Limits

### Objective
Create the foundational types and services for token-based context management.

### Files to Create

#### 1.1 `server/memory/compaction/types.ts`

```typescript
/**
 * Compaction System Types
 *
 * Core types for the context compaction system.
 * Based on OpenCode's battle-tested approach.
 */

// ============================================================================
// Configuration
// ============================================================================

export interface CompactionConfig {
  /** Minimum tokens worth of tool outputs to consider pruning (default: 20,000) */
  pruneMinimum: number;

  /** Token threshold - protect this many tokens of recent tool outputs (default: 40,000) */
  pruneProtect: number;

  /** Reserve tokens for model output (default: 4,096) */
  outputReserve: number;

  /** Minimum conversation turns to always keep (default: 2) */
  minTurnsToKeep: number;
}

export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  pruneMinimum: 20_000,
  pruneProtect: 40_000,
  outputReserve: 4_096,
  minTurnsToKeep: 2,
};

// ============================================================================
// Token Tracking
// ============================================================================

export interface TokenUsage {
  input: number;
  output: number;
  cache: {
    read: number;
    write: number;
  };
}

export interface ModelLimits {
  /** Total context window size */
  contextLimit: number;
  /** Maximum output tokens */
  maxOutput: number;
}

// ============================================================================
// Message Parts (Rich Structure)
// ============================================================================

export type MessagePartType =
  | 'text'
  | 'tool-call'
  | 'tool-result'
  | 'reasoning'
  | 'step-start'
  | 'compaction-marker';

export interface BaseMessagePart {
  id: string;
  type: MessagePartType;
  /** Estimated token count for this part */
  tokens?: number;
}

export interface TextPart extends BaseMessagePart {
  type: 'text';
  text: string;
}

export interface ToolCallPart extends BaseMessagePart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export interface ToolResultPart extends BaseMessagePart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  output: unknown;
  /** Timestamp when this output was compacted (cleared) */
  compactedAt?: number;
  /** Original output before compaction (for debugging) */
  originalTokens?: number;
}

export interface ReasoningPart extends BaseMessagePart {
  type: 'reasoning';
  text: string;
}

export interface StepStartPart extends BaseMessagePart {
  type: 'step-start';
}

export interface CompactionMarkerPart extends BaseMessagePart {
  type: 'compaction-marker';
  summary: string;
  compactedAt: number;
  /** Number of messages compacted */
  messagesCompacted: number;
  /** Original token count before compaction */
  originalTokens: number;
}

export type MessagePart =
  | TextPart
  | ToolCallPart
  | ToolResultPart
  | ReasoningPart
  | StepStartPart
  | CompactionMarkerPart;

// ============================================================================
// Rich Message Structure
// ============================================================================

export interface RichMessageBase {
  id: string;
  sessionId: string;
  createdAt: number;
  /** Total estimated tokens for this message */
  tokens: number;
}

export interface UserMessage extends RichMessageBase {
  role: 'user';
  parts: Array<TextPart>;
  /** If this is a compaction trigger message */
  isCompactionTrigger?: boolean;
}

export interface AssistantMessage extends RichMessageBase {
  role: 'assistant';
  parts: Array<MessagePart>;
  /** If this is a summary message from compaction */
  isSummary?: boolean;
  /** Parent message ID (for compaction chain) */
  parentId?: string;
  /** Model ID used */
  modelId?: string;
  /** Finish reason */
  finishReason?: string;
  /** Error if any */
  error?: unknown;
}

export interface ToolMessage extends RichMessageBase {
  role: 'tool';
  parts: Array<ToolResultPart>;
}

export type RichMessage = UserMessage | AssistantMessage | ToolMessage;

// ============================================================================
// Compaction Results
// ============================================================================

export interface OverflowCheckResult {
  isOverflow: boolean;
  currentTokens: number;
  availableTokens: number;
  modelLimit: number;
  outputReserve: number;
}

export interface PruneResult {
  /** Messages after pruning */
  messages: RichMessage[];
  /** Number of tool outputs pruned */
  outputsPruned: number;
  /** Tokens saved by pruning */
  tokensSaved: number;
  /** Tool names that were pruned */
  prunedTools: string[];
}

export interface CompactionResult {
  /** Summary message to prepend */
  summaryMessage: AssistantMessage;
  /** Messages after compaction */
  messages: RichMessage[];
  /** Number of messages compacted */
  messagesCompacted: number;
  /** Tokens saved */
  tokensSaved: number;
}

export interface ContextPrepareResult {
  /** Final messages ready for LLM */
  messages: RichMessage[];
  /** Was pruning applied? */
  wasPruned: boolean;
  /** Was compaction applied? */
  wasCompacted: boolean;
  /** Token counts */
  tokens: {
    before: number;
    afterPrune: number;
    afterCompact: number;
    final: number;
  };
  /** Debugging info */
  debug: {
    prunedOutputs: number;
    compactedMessages: number;
    removedTools: string[];
  };
}
```

#### 1.2 `server/memory/compaction/token-service.ts`

```typescript
/**
 * Token Service
 *
 * Centralized token counting for messages and parts.
 * Uses gpt-tokenizer for accurate counting with fallback.
 */

import { countTokens, countChatTokens } from '../../../lib/tokenizer';
import type {
  RichMessage,
  MessagePart,
  TokenUsage,
  ModelLimits
} from './types';

// ============================================================================
// Model Limits Registry
// ============================================================================

/**
 * Known model context limits.
 * Add more as needed.
 */
const MODEL_LIMITS: Record<string, ModelLimits> = {
  // OpenAI
  'openai/gpt-4o': { contextLimit: 128_000, maxOutput: 16_384 },
  'openai/gpt-4o-mini': { contextLimit: 128_000, maxOutput: 16_384 },
  'openai/gpt-4-turbo': { contextLimit: 128_000, maxOutput: 4_096 },
  'openai/gpt-4': { contextLimit: 8_192, maxOutput: 4_096 },
  'openai/gpt-3.5-turbo': { contextLimit: 16_385, maxOutput: 4_096 },

  // Anthropic
  'anthropic/claude-3.5-sonnet': { contextLimit: 200_000, maxOutput: 8_192 },
  'anthropic/claude-3-opus': { contextLimit: 200_000, maxOutput: 4_096 },
  'anthropic/claude-3-sonnet': { contextLimit: 200_000, maxOutput: 4_096 },
  'anthropic/claude-3-haiku': { contextLimit: 200_000, maxOutput: 4_096 },

  // Google
  'google/gemini-pro': { contextLimit: 32_000, maxOutput: 8_192 },
  'google/gemini-1.5-pro': { contextLimit: 1_000_000, maxOutput: 8_192 },

  // Default fallback
  'default': { contextLimit: 16_000, maxOutput: 4_096 },
};

/**
 * Get model limits, with fallback to default
 */
export function getModelLimits(modelId: string): ModelLimits {
  return MODEL_LIMITS[modelId] || MODEL_LIMITS['default'];
}

// ============================================================================
// Token Counting
// ============================================================================

/**
 * Count tokens in a message part
 */
export function countPartTokens(part: MessagePart): number {
  switch (part.type) {
    case 'text':
    case 'reasoning':
      return countTokens(part.text);

    case 'tool-call':
      // Tool name + JSON input
      return countTokens(part.toolName) + countTokens(JSON.stringify(part.input));

    case 'tool-result':
      // If compacted, output is just a placeholder
      if (part.compactedAt) {
        return countTokens('[Output cleared]');
      }
      return countTokens(JSON.stringify(part.output));

    case 'step-start':
      return 4; // Minimal overhead

    case 'compaction-marker':
      return countTokens(part.summary);

    default:
      return 0;
  }
}

/**
 * Count tokens in a rich message
 */
export function countMessageTokens(message: RichMessage): number {
  const roleOverhead = 4; // Token overhead for role markers
  const partsTotal = message.parts.reduce((sum, part) => sum + countPartTokens(part), 0);
  return roleOverhead + partsTotal;
}

/**
 * Count total tokens in message array
 */
export function countTotalTokens(messages: RichMessage[]): number {
  return messages.reduce((sum, msg) => sum + countMessageTokens(msg), 0);
}

/**
 * Estimate tokens for a string (quick estimate without encoding)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}

// ============================================================================
// Token Budget Calculations
// ============================================================================

/**
 * Calculate available tokens for conversation given model and current usage
 */
export function calculateAvailableTokens(
  modelId: string,
  currentTokens: number,
  outputReserve?: number
): number {
  const limits = getModelLimits(modelId);
  const reserve = outputReserve ?? limits.maxOutput;
  const usable = limits.contextLimit - reserve;
  return usable - currentTokens;
}

/**
 * Check if we're approaching overflow
 */
export function isApproachingOverflow(
  modelId: string,
  currentTokens: number,
  outputReserve?: number,
  threshold = 0.9 // 90% of available space
): boolean {
  const limits = getModelLimits(modelId);
  const reserve = outputReserve ?? limits.maxOutput;
  const usable = limits.contextLimit - reserve;
  return currentTokens > usable * threshold;
}
```

#### 1.3 `server/memory/compaction/index.ts`

```typescript
/**
 * Compaction Module Exports
 */

export * from './types';
export * from './token-service';
// Will add more exports as phases complete
```

### Files to Modify

#### 1.4 Update `server/memory/index.ts`

Add export for the new compaction module.

### Testing Phase 1

```bash
# Create a test script to verify token counting
pnpm tsx scripts/test-token-service.ts
```

Test cases:
- [ ] Token counting for text messages
- [ ] Token counting for tool call/result pairs
- [ ] Model limit retrieval
- [ ] Overflow detection

---

## Phase 2: Tool Output Pruning

### Objective
Implement smart tool output pruning that preserves tool calls but clears old outputs.

### Key Insight from OpenCode
```typescript
// They go backwards through messages, protecting recent 40k tokens of tool outputs
// Older tool outputs get replaced with "[Old tool result content cleared]"
// The tool CALL is preserved - just the verbose OUTPUT is cleared
```

### Files to Create

#### 2.1 `server/memory/compaction/tool-pruner.ts`

```typescript
/**
 * Tool Output Pruner
 *
 * Prunes old tool outputs while preserving:
 * - Tool call information (name, input)
 * - Recent tool outputs (within PRUNE_PROTECT threshold)
 * - Message sequence integrity
 *
 * Based on OpenCode's pruning strategy.
 */

import {
  CompactionConfig,
  DEFAULT_COMPACTION_CONFIG,
  RichMessage,
  ToolResultPart,
  PruneResult
} from './types';
import { countPartTokens, countMessageTokens } from './token-service';

/**
 * Prune old tool outputs from messages
 *
 * Strategy:
 * 1. Go backwards through messages
 * 2. Skip first 2 turns (minTurnsToKeep)
 * 3. Accumulate tool output tokens
 * 4. Once past PRUNE_PROTECT threshold, start clearing outputs
 * 5. Mark cleared outputs with compactedAt timestamp
 */
export function pruneToolOutputs(
  messages: RichMessage[],
  config: Partial<CompactionConfig> = {}
): PruneResult {
  const cfg = { ...DEFAULT_COMPACTION_CONFIG, ...config };

  // Clone messages to avoid mutation
  const result = structuredClone(messages);

  let totalToolTokens = 0;
  let prunedTokens = 0;
  let outputsPruned = 0;
  const prunedTools: string[] = [];
  let turns = 0;

  // Go backwards through messages
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];

    // Count turns (user messages)
    if (msg.role === 'user') {
      turns++;
    }

    // Skip recent turns
    if (turns < cfg.minTurnsToKeep) {
      continue;
    }

    // Stop if we hit a compaction marker (previous summary)
    if (msg.role === 'assistant' && msg.isSummary) {
      break;
    }

    // Process tool results in assistant and tool messages
    if (msg.role === 'assistant' || msg.role === 'tool') {
      for (let j = msg.parts.length - 1; j >= 0; j--) {
        const part = msg.parts[j];

        if (part.type === 'tool-result' && !part.compactedAt) {
          const partTokens = countPartTokens(part);
          totalToolTokens += partTokens;

          // If past protection threshold, prune this output
          if (totalToolTokens > cfg.pruneProtect) {
            const toolPart = part as ToolResultPart;

            // Store original token count for debugging
            toolPart.originalTokens = partTokens;

            // Clear the output
            toolPart.output = '[Tool output cleared - see conversation summary]';
            toolPart.compactedAt = Date.now();

            prunedTokens += partTokens - countPartTokens(toolPart);
            outputsPruned++;

            if (!prunedTools.includes(toolPart.toolName)) {
              prunedTools.push(toolPart.toolName);
            }
          }
        }
      }
    }
  }

  // Only report as pruned if we actually saved significant tokens
  const wasPruned = prunedTokens >= cfg.pruneMinimum;

  return {
    messages: result,
    outputsPruned: wasPruned ? outputsPruned : 0,
    tokensSaved: wasPruned ? prunedTokens : 0,
    prunedTools: wasPruned ? prunedTools : [],
  };
}

/**
 * Check if messages need pruning
 */
export function needsPruning(
  messages: RichMessage[],
  config: Partial<CompactionConfig> = {}
): boolean {
  const cfg = { ...DEFAULT_COMPACTION_CONFIG, ...config };

  let toolOutputTokens = 0;
  let turns = 0;

  // Go backwards, counting tool output tokens
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    if (msg.role === 'user') turns++;
    if (turns < cfg.minTurnsToKeep) continue;

    if (msg.role === 'assistant' || msg.role === 'tool') {
      for (const part of msg.parts) {
        if (part.type === 'tool-result' && !part.compactedAt) {
          toolOutputTokens += countPartTokens(part);
        }
      }
    }
  }

  return toolOutputTokens > cfg.pruneProtect + cfg.pruneMinimum;
}
```

### Testing Phase 2

Test cases:
- [ ] Pruning preserves recent tool outputs
- [ ] Pruning clears old tool outputs
- [ ] Tool call information is preserved
- [ ] Message sequence remains valid
- [ ] Compacted outputs have timestamp

---

## Phase 3: Message Store Redesign

### Objective
Redesign message storage to support rich part structure and compaction tracking.

### Database Schema Changes

#### 3.1 Add to `server/db/schema.ts`

```typescript
// New table for message parts (normalized structure)
export const messageParts = sqliteTable('message_parts', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // text, tool-call, tool-result, reasoning, step-start, compaction-marker
  content: text('content', { mode: 'json' }).notNull(), // JSON content based on type
  tokens: integer('tokens').default(0),
  compactedAt: integer('compacted_at'), // Unix timestamp if compacted
  order: integer('order').notNull(), // Order within message
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Add to sessions table
// workingContext already exists, add:
// - compactionCount: integer (how many times compaction occurred)
// - lastCompactionAt: integer (timestamp)
```

#### 3.2 Create `server/services/message-store.ts`

```typescript
/**
 * Message Store v2
 *
 * Handles rich message structure with parts.
 * Supports efficient token tracking and compaction.
 */

import type { DrizzleDB } from '../db/client';
import type { RichMessage, MessagePart } from '../memory/compaction/types';

export class MessageStore {
  constructor(private db: DrizzleDB) {}

  /**
   * Save a rich message with parts
   */
  async saveMessage(message: RichMessage): Promise<void> {
    // Implementation
  }

  /**
   * Load messages for a session as RichMessage[]
   */
  async loadMessages(sessionId: string): Promise<RichMessage[]> {
    // Implementation
  }

  /**
   * Update a message part (e.g., mark as compacted)
   */
  async updatePart(partId: string, updates: Partial<MessagePart>): Promise<void> {
    // Implementation
  }

  /**
   * Convert to AI SDK ModelMessage format
   */
  toModelMessages(messages: RichMessage[]): ModelMessage[] {
    // Implementation - handles compacted outputs
  }

  /**
   * Get messages since last compaction
   */
  async getMessagesSinceCompaction(sessionId: string): Promise<RichMessage[]> {
    // Implementation
  }
}
```

### Migration

Create migration for new schema elements.

---

## Phase 4: Compaction/Summarization Service

### Objective
Implement conversation summarization when overflow is detected.

### Key Insight from OpenCode
```
Prompt: "Provide a detailed prompt for continuing our conversation above.
Focus on information that would be helpful for continuing the conversation,
including what we did, what we're doing, which files we're working on,
and what we're going to do next considering new session will not have
access to our conversation."
```

### Files to Create

#### 4.1 `server/prompts/compaction/compaction-prompt.xml`

```xml
<system>
You are summarizing a CMS agent conversation to help continue it in a new context window.

The AI continuing this conversation will NOT have access to the original messages.
Your summary becomes the starting context - make it actionable and specific.

Provide a detailed but concise summary that captures:

## What Was Accomplished
- Pages created/modified (include IDs and slugs)
- Sections added/updated (include section types)
- Content written or edited
- Site settings changed (navigation, header, footer)
- Images uploaded or attached

## Current State
- Which page/section is being worked on now
- What the user is trying to achieve
- Any partially completed tasks

## User Preferences (Critical)
- Design choices mentioned (colors, layouts, styles)
- Content tone/style preferences
- Any explicit "I want..." or "Make it..." instructions
- Rejected options (things the user said NO to)

## What Comes Next
- Remaining tasks from user's original request
- Any follow-up actions needed
- Unresolved questions or decisions

## Technical Context
- Relevant IDs (pageId, sectionId, postId, imageId)
- Error states if any occurred
- Tool calls that were in progress

Be specific. Use actual names, IDs, and values. Don't summarize with vague phrases.
Keep under 2000 tokens while preserving all critical context.
</system>
```

#### 4.2 `server/memory/compaction/compaction-service.ts`

```typescript
/**
 * Compaction Service
 *
 * Generates conversation summaries for context continuity.
 * Triggered when overflow is detected after pruning.
 */

import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type {
  RichMessage,
  AssistantMessage,
  CompactionResult,
  CompactionConfig
} from './types';
import { countTotalTokens, countMessageTokens } from './token-service';
import { loadPrompt } from '../../prompts/builder';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Use a fast, cheap model for summarization
const COMPACTION_MODEL = 'openai/gpt-4o-mini';

export class CompactionService {
  private systemPrompt: string;

  constructor() {
    // Load compaction prompt on init
    this.systemPrompt = loadPrompt('compaction/compaction-prompt.xml');
  }

  /**
   * Generate a summary of the conversation
   */
  async compact(
    messages: RichMessage[],
    config: Partial<CompactionConfig> = {}
  ): Promise<CompactionResult> {
    const originalTokens = countTotalTokens(messages);

    // Convert messages to text for summarization
    const conversationText = this.messagesToText(messages);

    // Generate summary
    const result = await generateText({
      model: openrouter.languageModel(COMPACTION_MODEL),
      system: this.systemPrompt,
      prompt: `Summarize this conversation:\n\n${conversationText}\n\nProvide a continuation prompt:`,
      maxOutputTokens: 2000,
    });

    // Create summary message
    const summaryMessage: AssistantMessage = {
      id: crypto.randomUUID(),
      sessionId: messages[0]?.sessionId || '',
      role: 'assistant',
      parts: [{
        id: crypto.randomUUID(),
        type: 'compaction-marker',
        summary: result.text,
        compactedAt: Date.now(),
        messagesCompacted: messages.length,
        originalTokens,
      }],
      createdAt: Date.now(),
      tokens: countMessageTokens({
        id: '',
        sessionId: '',
        role: 'assistant',
        parts: [{ id: '', type: 'text', text: result.text }],
        createdAt: 0,
        tokens: 0,
      }),
      isSummary: true,
    };

    // Keep only the summary + recent messages (minTurnsToKeep)
    const recentMessages = this.getRecentTurns(messages, config.minTurnsToKeep || 2);

    return {
      summaryMessage,
      messages: [summaryMessage, ...recentMessages],
      messagesCompacted: messages.length - recentMessages.length,
      tokensSaved: originalTokens - countTotalTokens([summaryMessage, ...recentMessages]),
    };
  }

  /**
   * Convert messages to readable text for summarization
   */
  private messagesToText(messages: RichMessage[]): string {
    return messages.map(msg => {
      const role = msg.role.toUpperCase();
      const content = msg.parts.map(part => {
        switch (part.type) {
          case 'text':
            return part.text;
          case 'tool-call':
            return `[Called ${part.toolName} with: ${JSON.stringify(part.input)}]`;
          case 'tool-result':
            if (part.compactedAt) {
              return `[${part.toolName} result: cleared]`;
            }
            return `[${part.toolName} result: ${JSON.stringify(part.output).slice(0, 500)}...]`;
          default:
            return '';
        }
      }).filter(Boolean).join('\n');

      return `${role}:\n${content}`;
    }).join('\n\n---\n\n');
  }

  /**
   * Get the most recent N turns
   */
  private getRecentTurns(messages: RichMessage[], n: number): RichMessage[] {
    const result: RichMessage[] = [];
    let turns = 0;

    for (let i = messages.length - 1; i >= 0 && turns < n; i--) {
      result.unshift(messages[i]);
      if (messages[i].role === 'user') {
        turns++;
      }
    }

    return result;
  }
}
```

---

## Phase 5: Context Manager (replaces existing)

### Objective
Orchestrate all compaction components into a unified context manager that replaces the existing implementation.

### Files to Create

#### 5.1 `server/memory/context-manager/index.ts` (replace existing)

```typescript
/**
 * Context Manager
 *
 * Orchestrates:
 * 1. Overflow detection (token-based, checked before each response)
 * 2. Tool output pruning (cheaper - try first)
 * 3. Compaction/summarization (when pruning isn't enough)
 * 4. Message format conversion for AI SDK
 *
 * Key Pattern from OpenCode:
 * - Check overflow BEFORE generating response (not after)
 * - Prune runs at END of session processing (cleanup)
 * - Track `time.compacting` state for UI feedback
 */

import type { ModelMessage } from 'ai';
import {
  CompactionConfig,
  DEFAULT_COMPACTION_CONFIG,
  RichMessage,
  ContextPrepareResult,
  OverflowCheckResult
} from '../compaction/types';
import {
  countTotalTokens,
  getModelLimits,
  calculateAvailableTokens
} from '../compaction/token-service';
import { pruneToolOutputs, needsPruning } from '../compaction/tool-pruner';
import { CompactionService } from '../compaction/compaction-service';
import { convertRichToModel } from '../compaction/message-converter';

export class ContextManager {
  private config: CompactionConfig;
  private compactionService: CompactionService;

  constructor(config: Partial<CompactionConfig> = {}) {
    this.config = { ...DEFAULT_COMPACTION_CONFIG, ...config };
    this.compactionService = new CompactionService();
  }

  /**
   * Check if context is overflowing
   */
  checkOverflow(messages: RichMessage[], modelId: string): OverflowCheckResult {
    const limits = getModelLimits(modelId);
    const currentTokens = countTotalTokens(messages);
    const availableTokens = calculateAvailableTokens(modelId, currentTokens, this.config.outputReserve);

    return {
      isOverflow: availableTokens < 0,
      currentTokens,
      availableTokens: Math.max(0, availableTokens),
      modelLimit: limits.contextLimit,
      outputReserve: this.config.outputReserve,
    };
  }

  /**
   * Prepare context for LLM - the main entry point
   *
   * Steps:
   * 1. Check if overflow
   * 2. If overflow, try pruning tool outputs first
   * 3. If still overflow, run compaction (summarization)
   * 4. Convert to ModelMessage format
   */
  async prepareContext(
    messages: RichMessage[],
    modelId: string
  ): Promise<ContextPrepareResult> {
    const tokensBefore = countTotalTokens(messages);
    let currentMessages = messages;
    let wasPruned = false;
    let wasCompacted = false;
    let tokensAfterPrune = tokensBefore;
    let tokensAfterCompact = tokensBefore;
    let prunedOutputs = 0;
    let compactedMessages = 0;
    let removedTools: string[] = [];

    // Step 1: Check overflow
    let overflow = this.checkOverflow(currentMessages, modelId);

    if (overflow.isOverflow) {
      // Step 2: Try pruning tool outputs first
      if (needsPruning(currentMessages, this.config)) {
        const pruneResult = pruneToolOutputs(currentMessages, this.config);
        currentMessages = pruneResult.messages;
        wasPruned = pruneResult.outputsPruned > 0;
        prunedOutputs = pruneResult.outputsPruned;
        removedTools = pruneResult.prunedTools;
        tokensAfterPrune = countTotalTokens(currentMessages);

        // Check again
        overflow = this.checkOverflow(currentMessages, modelId);
      }

      // Step 3: If still overflow, run compaction
      if (overflow.isOverflow) {
        const compactResult = await this.compactionService.compact(
          currentMessages,
          this.config
        );
        currentMessages = compactResult.messages;
        wasCompacted = true;
        compactedMessages = compactResult.messagesCompacted;
        tokensAfterCompact = countTotalTokens(currentMessages);
      }
    }

    const tokensFinal = countTotalTokens(currentMessages);

    return {
      messages: currentMessages,
      wasPruned,
      wasCompacted,
      tokens: {
        before: tokensBefore,
        afterPrune: tokensAfterPrune,
        afterCompact: tokensAfterCompact,
        final: tokensFinal,
      },
      debug: {
        prunedOutputs,
        compactedMessages,
        removedTools,
      },
    };
  }

  /**
   * Convert prepared context to AI SDK ModelMessage format
   */
  toModelMessages(messages: RichMessage[]): ModelMessage[] {
    return convertRichToModel(messages);
  }
}
```

#### 5.2 `server/memory/compaction/message-converter.ts`

```typescript
/**
 * Message Converter
 *
 * Converts between RichMessage and AI SDK ModelMessage formats.
 * Handles compacted tool outputs appropriately.
 */

import type { ModelMessage } from 'ai';
import type { RichMessage, MessagePart } from './types';

/**
 * Convert RichMessage[] to ModelMessage[] for AI SDK
 */
export function convertRichToModel(messages: RichMessage[]): ModelMessage[] {
  const result: ModelMessage[] = [];

  for (const msg of messages) {
    if (msg.parts.length === 0) continue;

    switch (msg.role) {
      case 'user':
        result.push({
          role: 'user',
          content: msg.parts
            .filter(p => p.type === 'text')
            .map(p => (p as any).text)
            .join('\n'),
        });
        break;

      case 'assistant':
        const assistantContent: any[] = [];

        for (const part of msg.parts) {
          switch (part.type) {
            case 'text':
              assistantContent.push({
                type: 'text',
                text: (part as any).text,
              });
              break;

            case 'tool-call':
              assistantContent.push({
                type: 'tool-call',
                toolCallId: (part as any).toolCallId,
                toolName: (part as any).toolName,
                args: (part as any).input,
              });
              break;

            // Note: compaction-marker is in USER message, not assistant
            // Handled in user message conversion below
          }
        }

        if (assistantContent.length > 0) {
          result.push({
            role: 'assistant',
            content: assistantContent,
          });
        }
        break;

      case 'tool':
        const toolContent: any[] = msg.parts
          .filter(p => p.type === 'tool-result')
          .map(p => {
            const tp = p as any;
            return {
              type: 'tool-result',
              toolCallId: tp.toolCallId,
              toolName: tp.toolName,
              result: tp.compactedAt
                ? { status: 'compacted', message: 'Output cleared - see summary' }
                : tp.output,
            };
          });

        if (toolContent.length > 0) {
          result.push({
            role: 'tool',
            content: toolContent,
          });
        }
        break;
    }
  }

  return result;
}

/**
 * Convert AI SDK ModelMessage[] to RichMessage[]
 * Used when loading from AI SDK format
 */
export function convertModelToRich(
  messages: ModelMessage[],
  sessionId: string
): RichMessage[] {
  // Implementation for converting back
  // Needed when loading messages from AI SDK response
}
```

---

## Phase 6: Integration & Testing

### Objective
Integrate the new context manager into the existing orchestrator and test thoroughly.

### Files to Modify

#### 6.1 Update `server/execution/context-coordinator.ts`

Replace the old ContextManager usage with ContextManagerV2.

```typescript
// Replace
import { ContextManager } from '../memory';

// With
import { ContextManagerV2 } from '../memory/compaction';

// Update prepareContext method to use new system
```

#### 6.2 Update `server/services/session-service.ts`

Add methods to work with RichMessage format.

#### 6.3 Update `server/agents/main-agent.ts`

Ensure WorkingContext sync works with new compaction system.

### Integration Tests

```typescript
// scripts/test-compaction-system.ts

/**
 * Test the full compaction flow
 */

async function testCompactionFlow() {
  // 1. Create a session with many messages
  // 2. Simulate tool calls with large outputs
  // 3. Trigger overflow
  // 4. Verify pruning happens
  // 5. Verify compaction generates summary
  // 6. Verify AI can continue conversation
}
```

### Manual Testing Checklist

- [ ] Long conversation doesn't cause AI drift
- [ ] Tool outputs are pruned after threshold
- [ ] Summary captures user intent
- [ ] AI can reference compacted context
- [ ] No API errors (tool call/result pairing valid)
- [ ] WorkingContext stays in sync
- [ ] SSE events emit compaction info

---

## Implementation Notes

### AI SDK v6 Compatibility

The AI SDK v6 provides `pruneMessages()` which we use as a foundation, but we extend it with:
- Token-based thresholds (not just message count)
- Summarization (not just removal)
- Rich part structure preservation

### Architectural Decision: Summary Injection Method

**The Problem**: After compaction, how do we inject the conversation summary back into context?

**Research Sources**:
- [Our Knowledge Base: 2.2.5 Prompt Caching & Context Compaction](../knowledge-base/2-context/2.2.5-prompt-caching.md) - Comprehensive analysis of caching patterns
- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Anthropic Context Engineering Guide](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Factory.ai Compressing Context](https://factory.ai/news/compressing-context)
- OpenCode implementation in digest.txt

**Three Options Analyzed**:

| Option | Description | Caching Impact |
|--------|-------------|----------------|
| A. Fake assistant message only | Put summary in assistant role | ❌ Puts words in LLM's mouth |
| B. User-assistant pair | User asks, assistant answers with summary | ✅ **Industry standard** - preserves caching |
| C. System prompt injection | Add summary to system prompt | ❌ **Breaks entire cache** - invalidates tools + system + messages |

**Decision: Option B - User-Assistant Compaction Pair**

### Why System Prompt Injection Is Wrong

From Anthropic's docs:
> "Cache keys are cumulative: the cache hash key is generated by hashing all previous blocks sequentially."

If we modify the system prompt:
1. System prompt content changes → **entire cache invalidated**
2. Tool definitions need reprocessing (25% premium on cache writes)
3. All messages need reprocessing
4. **Every compaction becomes a full cache miss = expensive**

OpenCode explicitly does:
```typescript
// max 2 system prompt messages for caching purposes
const [first, ...rest] = system
system = [first, rest.join("\n")]
```

They keep system prompts stable to preserve caching.

### Why User-Assistant Pair Is Correct

From Anthropic's Context Engineering Guide:
> "In Claude Code, compaction is implemented by passing the message history to the model to summarize."

Summaries are injected **as conversation history**, not system prompt.

**Benefits**:
1. **System prompt stays constant** → cache preserved (90% cost savings on reads)
2. **Tools stay constant** → cache preserved
3. **Only messages section changes** → minimal invalidation
4. **Natural conversation flow** → LLM understands this is context
5. **Follows industry best practice** → Claude Code, Factory.ai, etc.

**Implementation**:

```typescript
// When compaction occurs, insert synthetic turn at compaction point:
const compactionTurn: RichMessage[] = [
  {
    id: uuid(),
    role: 'user',
    parts: [{
      type: 'compaction-marker',
      // The user "asks" for summary - triggers assistant to provide it
    }],
  },
  {
    id: uuid(),
    role: 'assistant',
    parts: [{
      type: 'text',
      text: compactionSummary, // LLM-generated summary
    }],
  }
];

// Message history becomes:
// [compaction user message, compaction assistant summary, ...remaining messages]
```

**Conversion to ModelMessage**:

```typescript
// In message-converter.ts
case 'compaction-marker':
  // Convert to natural prompt
  return {
    type: 'text',
    text: 'What have we accomplished so far in this conversation?',
  };
```

The assistant's summary response is already a normal text part - no special handling needed.

**Flow After Compaction**:
1. Old messages are removed from history
2. Compaction summary is generated via LLM call
3. User-assistant pair is inserted at the start of remaining messages
4. System prompt and tools remain **completely unchanged**
5. On API call: tools cached, system cached, only messages section processed

**Cache Savings Example**:
- System prompt: 2,000 tokens (stable, cached)
- Tools: 8,000 tokens (stable, cached)
- Compaction summary: 500 tokens
- New messages: 1,000 tokens

With system prompt injection: All 11,500 tokens reprocessed (cache miss)
With user-assistant pair: Only 1,500 tokens processed, 10,000 cached (90% savings)

### Multi-Provider Caching Compatibility

**This decision applies to ALL providers, not just Anthropic.**

| Provider | Caching Type | Prefix Stability Impact |
|----------|--------------|------------------------|
| OpenAI (GPT-4o, 4o-mini) | Automatic | ✅ Prefix matching - system prompt changes = cache miss |
| DeepSeek (V3, R1) | Automatic | ✅ Prefix matching - system prompt changes = cache miss |
| Anthropic (Claude) | Manual (`cache_control`) | ✅ Cumulative hash - system prompt changes = full invalidation |
| Groq (Kimi K2) | Automatic | ✅ Prefix matching |
| Google Gemini 2.5 | Implicit | ✅ Prefix matching |

From [OpenAI docs](https://platform.openai.com/docs/guides/prompt-caching):
> "Caching is based on prefix matching... even a single character difference will cause a cache miss"

From [DeepSeek docs](https://api-docs.deepseek.com/guides/kv_cache):
> "The hard disk cache only matches the prefix part of the user's input"

**Conclusion**: Keeping system prompts stable benefits ALL providers:
- Automatic caching providers get prefix-based cache hits
- Manual caching providers preserve explicit cache breakpoints
- OpenRouter routes to same provider for cache affinity

**Our user-assistant pair approach is universally cache-friendly.**

---

### Critical: Overflow Check Timing (from OpenCode)

OpenCode checks for overflow **BEFORE** each AI response, not after:

```typescript
// In session processing loop (from OpenCode digest.txt:41908-41918)
if (
  lastFinished &&
  lastFinished.summary !== true &&
  SessionCompaction.isOverflow({ tokens: lastFinished.tokens, model })
) {
  // Trigger compaction BEFORE generating next response
  await SessionCompaction.create({ sessionID, agent, model, auto: true });
}

// Prune runs at END of processing (digest.txt:42136)
SessionCompaction.prune({ sessionID });
```

**Our Integration Point**: In `orchestrator.ts`, before calling `agent.generateStream()`:
1. Check `contextManager.checkOverflow(messages, modelId)`
2. If overflow, run compaction first
3. Then proceed with generation
4. After loop completion, run `contextManager.prune(sessionId)` for cleanup

### Key Differences from OpenCode

1. **CMS Domain Focus**: Our summaries focus on:
   - Page/section/post names and IDs
   - Content changes (created, modified, deleted)
   - User design preferences (colors, layouts, styling)
   - Site structure modifications
   - NOT files/code like OpenCode

2. **Simpler Message Structure**: We don't need their complex part types (step-start, reasoning). Focus on:
   - text
   - tool-call
   - tool-result
   - compaction-marker

3. **AI SDK v6**: OpenCode may use an older AI SDK version. We ensure full v6 compatibility with `ModelMessage` format.

4. **Modular design**: Each component (pruner, compactor, converter) is independent and testable.

### SSE Event Integration

Add new SSE event types for frontend visibility:

```typescript
// In server/execution/sse-writer.ts
type CompactionEventType = 'compaction:start' | 'compaction:complete' | 'prune:complete';

interface CompactionStartEvent {
  type: 'compaction:start';
  data: {
    tokensBefore: number;
    modelLimit: number;
    reason: 'overflow';
  };
}

interface CompactionCompleteEvent {
  type: 'compaction:complete';
  data: {
    tokensBefore: number;
    tokensAfter: number;
    messagesCompacted: number;
    wasPruned: boolean;
    wasSummarized: boolean;
  };
}
```

Frontend can show a status like "Summarizing conversation..." when compacting.

### Configuration

The system is configurable via `CompactionConfig`:

```typescript
const config: CompactionConfig = {
  pruneMinimum: 20_000,    // Start pruning when this many tokens can be saved
  pruneProtect: 40_000,    // Protect this many recent tokens
  outputReserve: 4_096,    // Reserve for model output
  minTurnsToKeep: 2,       // Always keep at least 2 recent turns
};
```

---

## Success Criteria

1. **No AI Drift**: After compaction, AI maintains awareness of:
   - Original user request
   - Actions taken
   - Current state
   - Next steps

2. **Valid Messages**: All message sequences are valid for OpenAI/Anthropic APIs:
   - Tool calls have matching results
   - No orphaned tool messages

3. **Efficient**:
   - Pruning happens before expensive summarization
   - Token counting is fast (cached where possible)

4. **Observable**:
   - SSE events show when pruning/compaction occurs
   - Debug panel displays context management info

---

## File Summary

### New Files to Create

| File | Phase | Description |
|------|-------|-------------|
| `server/memory/compaction/types.ts` | 1 | Core types for compaction system |
| `server/memory/compaction/token-service.ts` | 1 | Token counting and model limits |
| `server/memory/compaction/index.ts` | 1 | Module exports |
| `server/memory/compaction/tool-pruner.ts` | 2 | Tool output pruning |
| `server/services/message-store.ts` | 3 | Rich message storage |
| `server/prompts/compaction/compaction-prompt.xml` | 4 | CMS-specific summarization prompt |
| `server/memory/compaction/compaction-service.ts` | 4 | Summarization service |
| `server/memory/compaction/message-converter.ts` | 5 | Format conversion |
| `scripts/test-compaction-system.ts` | 6 | Integration tests |

### Files to Replace

| File | Phase | Changes |
|------|-------|---------|
| `server/memory/context-manager/index.ts` | 5 | Complete rewrite with new ContextManager |
| `server/memory/context-manager/types.ts` | 5 | Update types to use RichMessage |

### Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `server/db/schema.ts` | 3 | Add message_parts table, compaction fields to sessions |
| `server/memory/index.ts` | 1 | Export compaction module |
| `server/execution/context-coordinator.ts` | 6 | Use new ContextManager, add overflow check |
| `server/execution/orchestrator.ts` | 6 | Add pre-generation overflow check, post-processing prune |
| `server/services/session-service.ts` | 6 | RichMessage support, compaction state tracking |
| `server/agents/main-agent.ts` | 6 | WorkingContext sync with compaction |

---

## Gaps & Edge Cases Identified (Second Review)

### Gap 1: Error Message Filtering Before Compaction

**OpenCode Pattern** (digest.txt:39663-39675):
```typescript
// Before compacting, filter out error messages that aren't useful
input.messages.filter((m) => {
  if (m.info.role !== "assistant" || m.info.error === undefined) {
    return true; // Keep non-error messages
  }
  if (
    MessageV2.AbortedError.isInstance(m.info.error) &&
    m.parts.some((part) => part.type !== "step-start" && part.type !== "reasoning")
  ) {
    return true; // Keep aborted messages that have actual content
  }
  return false; // Discard pure error messages with no useful content
});
```

**Our Gap**: Plan doesn't mention filtering error/aborted messages before summarization.

**Fix**: Add to Phase 4 compaction service:
```typescript
// Filter before compaction
private filterMessagesForCompaction(messages: RichMessage[]): RichMessage[] {
  return messages.filter(msg => {
    // Keep all user messages
    if (msg.role === 'user') return true;

    // For assistant messages, check if they have errors
    if (msg.role === 'assistant') {
      const asst = msg as AssistantMessage;
      // If no error, keep
      if (!asst.error) return true;
      // If error but has actual content (not just reasoning), keep
      if (asst.parts.some(p => p.type === 'text' || p.type === 'tool-call')) {
        return true;
      }
      // Otherwise discard - no useful context
      return false;
    }

    return true;
  });
}
```

---

### Gap 2: Session Compaction State Tracking

**OpenCode Pattern** (digest.txt:39836):
```typescript
time: z.object({
  created: z.number(),
  updated: z.number(),
  compacting: z.number().optional(), // Timestamp when compaction started
  archived: z.number().optional(),
}),
```

**Our Gap**: Sessions table doesn't track compaction state for UI feedback.

**Fix**: Add to Phase 3 schema changes:
```typescript
// Add to sessions table
export const sessions = sqliteTable("sessions", {
  // ... existing fields
  compactionCount: integer("compaction_count").default(0),      // How many times compaction occurred
  lastCompactionAt: integer("last_compaction_at"),              // Timestamp
  currentlyCompacting: integer("currently_compacting", { mode: "boolean" }).default(false),
});
```

---

### Gap 3: Message Storage Schema Change (Clean Migration)

**Current State**:
- `messages.content` stores JSON string (AI SDK format)
- Single flat content field, not rich parts structure

**New State**:
- `messages` table with `tokens` column for token count caching
- New `message_parts` table for rich part structure
- Sessions table with compaction tracking fields

**Migration Approach**: Clean slate - delete DB and reseed.

#### Files Requiring Updates for New Schema:

**Database Schema** (`server/db/schema.ts`):
```typescript
// Update sessions table - add:
compactionCount: integer("compaction_count").default(0),
lastCompactionAt: integer("last_compaction_at"),
currentlyCompacting: integer("currently_compacting", { mode: "boolean" }).default(false),

// Update messages table - add:
tokens: integer("tokens").default(0),  // Cached token count

// NEW: message_parts table
export const messageParts = sqliteTable("message_parts", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["text", "tool-call", "tool-result", "compaction-marker"] }).notNull(),
  content: text("content", { mode: "json" }).notNull(),
  tokens: integer("tokens").default(0),
  compactedAt: integer("compacted_at"),
  sortOrder: integer("sort_order").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

**Type Files to Update**:
| File | Change |
|------|--------|
| `server/providers/memory/types.ts` | Add `RichMessage`, `MessagePart` types; update `StoredMessage` |
| `server/memory/context-manager/types.ts` | Import from compaction types |

**Service Files to Update**:
| File | Change |
|------|--------|
| `server/services/session-service.ts` | Update `addMessage`, `loadMessages` for parts structure |
| `server/providers/memory/sqlite-provider.ts` | Update message CRUD for parts table |

**Execution Files to Update**:
| File | Change |
|------|--------|
| `server/execution/context-coordinator.ts` | Use new ContextManager, handle RichMessage |
| `server/execution/orchestrator.ts` | Add overflow check, prune call, compaction events |

**Route Files (minimal changes)**:
| File | Change |
|------|--------|
| `server/routes/sessions.ts` | Add compaction status endpoint (optional) |

**No Changes Needed**:
- `scripts/seed.ts` - Doesn't seed messages
- `scripts/seed-images.ts` - Unrelated to messages
- CMS services (`section-service.ts`, `page-service.ts`, `entry-service.ts`) - Different `content` field, not message content

---

### Gap 4: ToolLoopAgent Integration Point

**Our System** (main-agent.ts:174):
- Uses `ToolLoopAgent` with `prepareStep` callback
- `persistedDiscoveredTools` stored at module level

**Gap**: Plan doesn't mention how compaction interacts with discovered tools in `WorkingContext`.

**Fix**: Add to Phase 6 integration:
```markdown
### WorkingContext Sync During Compaction

When compaction occurs:
1. Keep discovered tools that are still referenced in kept messages
2. Remove tools only referenced in compacted (removed) messages
3. Update `WorkingContext` state before save

// In ContextManager.prepareContext():
if (wasCompacted) {
  const keptToolNames = this.extractToolNamesFromMessages(result.messages);
  workingContext.syncDiscoveredTools(keptToolNames);
}
```

---

### Gap 5: Prune Timing - End of Session Processing

**OpenCode Pattern** (digest.txt:42136):
```typescript
// Prune runs at END of processing, after the agent loop completes
SessionCompaction.prune({ sessionID });
```

**Our Gap**: Plan mentions prune but doesn't specify exact integration point in our flow.

**Fix**: Clarify in Phase 6:
```typescript
// In orchestrator.ts executeStream():
async *executeStream(options, writeSSE) {
  // ... existing code ...

  try {
    // Execute agent
    const streamResult = await cmsAgent.stream({ ... });

    // Process stream
    const result = await this.streamProcessor.processStream(...);

    // Save session data
    await this.contextCoordinator.saveSessionData(...);

    // Emit final events
    emitter.emitResult(...);
    emitter.emitDone();
  } finally {
    // PRUNE runs at END, even on error (cleanup)
    await this.contextCoordinator.pruneToolOutputs(resolved.sessionId);
  }
}
```

---

### Gap 6: Token Counting Source Discrepancy

**Our Tokenizer** (lib/tokenizer.ts):
- Uses `gpt-tokenizer` for OpenAI token estimation
- Different models have different tokenizers (Claude uses different tokenization)

**Gap**: Token counts may be inaccurate for non-OpenAI models (Anthropic, Google).

**Fix**: Add to Phase 1 token-service notes:
```markdown
### Model-Specific Tokenization

Token counting is an approximation:
- OpenAI models: Use gpt-tokenizer (accurate)
- Anthropic/Google: Use gpt-tokenizer as estimate (conservative - may undercount)
- Add 10% safety margin for non-OpenAI models

// In token-service.ts
export function countTokensWithModelAdjustment(text: string, modelId: string): number {
  const baseCount = countTokens(text);

  // Add safety margin for non-OpenAI models
  if (!modelId.startsWith('openai/')) {
    return Math.ceil(baseCount * 1.1);
  }

  return baseCount;
}
```

---

### Gap 7: Streaming During Compaction

**OpenCode Pattern**: Shows session status "compacting" in UI.

**Our Gap**: Need to handle what happens if user sends message while compaction is in progress.

**Fix**: Add to Phase 6:
```typescript
// In orchestrator.ts, before processing:
const isCompacting = await this.contextCoordinator.isSessionCompacting(sessionId);
if (isCompacting) {
  emitter.emitError('Session is currently being optimized. Please wait a moment.');
  return;
}
```

---

### Gap 8: System Prompt Stability for Caching (NEW)

**OpenCode Pattern** (digest.txt:42176-42178):
```typescript
// max 2 system prompt messages for caching purposes
const [first, ...rest] = system
system = [first, rest.join("\n")]
```

**Why This Matters** (from our 2.2.5-prompt-caching.md research):
- All providers use prefix-based caching
- System prompt changes invalidate entire cache
- Tools are part of the prefix - must also stay stable

**Our Gap**: Plan doesn't explicitly ensure system prompt stability across compaction.

**Fix**: Add to Phase 5 ContextManager:
```typescript
// In ContextManager initialization
private readonly systemPromptHash: string;

constructor() {
  // Cache the system prompt hash to detect accidental changes
  this.systemPromptHash = this.hashSystemPrompt();
}

// Validate system prompt hasn't changed before each call
validateSystemPromptStability(): void {
  const currentHash = this.hashSystemPrompt();
  if (currentHash !== this.systemPromptHash) {
    console.warn('[ContextManager] System prompt changed - cache will be invalidated');
  }
}
```

**Key Insight**: Our user-assistant compaction pair pattern already handles this correctly, but we should add validation to catch accidental system prompt modifications.

---

### Gap 9: Compaction Summary as User-Assistant Pair Implementation Detail (NEW)

**OpenCode Pattern** (digest.txt:39678-39685):
```typescript
{
  role: "user",
  content: [
    {
      type: "text",
      text: "Provide a detailed prompt for continuing our conversation above...",
    },
  ],
},
```

**Our Gap**: Plan mentions user-assistant pair but doesn't show exact message format for injection.

**Fix**: Update Phase 4 CompactionService with exact format:
```typescript
// The compaction trigger is a USER message asking for summary
const compactionTrigger: UserMessage = {
  id: crypto.randomUUID(),
  sessionId,
  role: 'user',
  parts: [{
    id: crypto.randomUUID(),
    type: 'text',
    text: 'What have we accomplished in our conversation so far? Summarize our progress, current state, and next steps.',
  }],
  isCompactionTrigger: true,  // Flag for debugging/logging
  createdAt: Date.now(),
  tokens: 0,
};

// The summary is the ASSISTANT response (generated by LLM)
const summaryResponse: AssistantMessage = {
  id: crypto.randomUUID(),
  sessionId,
  role: 'assistant',
  parts: [{
    id: crypto.randomUUID(),
    type: 'text',
    text: generatedSummary,  // From compaction LLM call
  }],
  isSummary: true,
  createdAt: Date.now(),
  tokens: countMessageTokens(...),
};

// Final messages: [trigger, summary, ...recentMessages]
```

This ensures:
1. System prompt unchanged → cached
2. Tools unchanged → cached
3. Summary appears as natural conversation → LLM understands context
4. Multi-provider cache compatible

---

### Gap 10: Anthropic cache_control Integration (NEW)

**From our 2.2.5-prompt-caching.md research**:
- Anthropic requires explicit `cache_control` markers
- AI SDK supports `providerOptions.anthropic.cacheControl`

**Our Gap**: Plan doesn't mention Anthropic-specific cache control for maximum savings.

**Fix**: Add to Phase 5 when converting to ModelMessages for Anthropic:
```typescript
// In message-converter.ts for Anthropic provider
export function convertRichToModelWithCaching(
  messages: RichMessage[],
  providerId: string
): ModelMessage[] {
  const result = convertRichToModel(messages);

  // For Anthropic, add cache_control to system message
  if (providerId.includes('anthropic') && result[0]?.role === 'system') {
    result[0] = {
      ...result[0],
      providerMetadata: {
        anthropic: {
          cacheControl: { type: 'ephemeral' }
        }
      }
    };
  }

  return result;
}

// In orchestrator, use providerOptions
const streamResult = await cmsAgent.stream({
  messages: modelMessages,
  providerOptions: {
    anthropic: {
      cacheControl: true
    }
  }
});
```

**Impact**: 90% cost reduction on cached portions for Claude models.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Token count inaccuracy | Medium | Add 10% safety margin for non-OpenAI models |
| Compaction loses critical context | High | Test summarization quality manually; CMS-specific prompt |
| Prune removes needed tool output | Medium | Protect recent 2 turns minimum (PRUNE_PROTECT=40k) |
| Concurrent compaction requests | Low | Lock with `currentlyCompacting` flag |
| Schema change breaks app | None | Clean migration - just delete DB and reseed (prototype) |
| Cache invalidation on compaction | Medium | User-assistant pair pattern preserves prefix cache |
| Anthropic cache not utilized | Low | Add explicit cache_control for Claude models |

---

## Phase 7: Frontend Integration - UI, Debugging & Chat History

### Objective

Integrate compaction visibility throughout the frontend:
1. **Chat Interface**: Show compaction status indicator, error states, and "start new session" suggestion
2. **Debugging Panel**: Add compaction events to trace logs with full details
3. **Chat History**: Display compaction summary messages visibly in conversation

### 7.1 New SSE Event Types

Add compaction-specific events to `sse-handlers.ts`:

```typescript
// Add to SSEEventType union
| "compaction-start"      // Compaction triggered
| "compaction-prune"      // Tool outputs being pruned
| "compaction-summarize"  // LLM summarization in progress
| "compaction-complete"   // Compaction finished
| "compaction-error"      // Compaction failed
| "context-overflow"      // Context limit reached, needs action

// Handler functions
export function handleCompactionStart(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const tokensBefore = data.tokensBefore as number;
  const modelLimit = data.modelLimit as number;
  const reason = data.reason as string; // 'overflow' | 'manual'

  ctx.store.setAgentStatus({ state: 'compacting' });
  ctx.trace?.compactionStart(tokensBefore, modelLimit, reason);
}

export function handleCompactionPrune(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const outputsPruned = data.outputsPruned as number;
  const tokensSaved = data.tokensSaved as number;
  const prunedTools = data.prunedTools as string[];

  ctx.trace?.compactionPrune(outputsPruned, tokensSaved, prunedTools);
}

export function handleCompactionSummarize(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const messagesCount = data.messagesCount as number;
  ctx.trace?.compactionSummarize(messagesCount);
}

export function handleCompactionComplete(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const result = {
    tokensBefore: data.tokensBefore as number,
    tokensAfter: data.tokensAfter as number,
    messagesCompacted: data.messagesCompacted as number,
    wasPruned: data.wasPruned as boolean,
    wasSummarized: data.wasSummarized as boolean,
    summary: data.summary as string | undefined,
  };

  ctx.store.setAgentStatus({ state: 'thinking' });
  ctx.trace?.compactionComplete(result);
}

export function handleCompactionError(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const error = data.error as string;
  const canRetry = data.canRetry as boolean;
  const suggestNewSession = data.suggestNewSession as boolean;

  ctx.store.setCompactionError({ error, canRetry, suggestNewSession });
  ctx.trace?.compactionError(error, canRetry, suggestNewSession);
}

export function handleContextOverflow(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const currentTokens = data.currentTokens as number;
  const limit = data.limit as number;
  const percentUsed = data.percentUsed as number;

  ctx.store.setContextOverflow({ currentTokens, limit, percentUsed });
  ctx.trace?.contextOverflow(currentTokens, limit, percentUsed);
}
```

### 7.2 Chat Store Updates

Update `chat-store.ts` with compaction state:

```typescript
// Add new state fields
interface ChatState {
  // ... existing fields ...

  // Compaction state
  isCompacting: boolean;
  compactionProgress: {
    phase: 'idle' | 'pruning' | 'summarizing' | 'complete';
    tokensBefore?: number;
    tokensAfter?: number;
    percentSaved?: number;
  } | null;

  // Error handling
  compactionError: {
    error: string;
    canRetry: boolean;
    suggestNewSession: boolean;
  } | null;

  // Context usage indicator
  contextUsage: {
    currentTokens: number;
    limit: number;
    percentUsed: number;
    isWarning: boolean;  // > 80%
    isCritical: boolean; // > 95%
  } | null;

  // Actions
  setIsCompacting: (isCompacting: boolean) => void;
  setCompactionProgress: (progress: ChatState['compactionProgress']) => void;
  setCompactionError: (error: ChatState['compactionError']) => void;
  setContextUsage: (usage: ChatState['contextUsage']) => void;
  clearCompactionError: () => void;
}

// Add new AgentStatus state
export interface AgentStatus {
  state: 'thinking' | 'tool-call' | 'compacting';  // Add 'compacting'
  toolName?: string;
  compactionPhase?: 'pruning' | 'summarizing';
}
```

### 7.3 Trace Store Updates

Update `trace-store.ts` with compaction entry types:

```typescript
// Add to TraceEntryType union
export type TraceEntryType =
  | // ... existing types ...
  // Compaction events
  | "compaction-start"     // Compaction triggered
  | "compaction-prune"     // Tool outputs pruned
  | "compaction-summarize" // LLM summarizing
  | "compaction-complete"  // Compaction finished
  | "compaction-error"     // Compaction failed
  | "context-overflow";    // Hit context limit

// Add colors for new types
export const ENTRY_TYPE_COLORS: Record<TraceEntryType, string> = {
  // ... existing colors ...
  "compaction-start": "bg-yellow-500",
  "compaction-prune": "bg-yellow-400",
  "compaction-summarize": "bg-yellow-300",
  "compaction-complete": "bg-green-500",
  "compaction-error": "bg-red-500",
  "context-overflow": "bg-red-600",
};

// Add labels for new types
export const ENTRY_TYPE_LABELS: Record<TraceEntryType, string> = {
  // ... existing labels ...
  "compaction-start": "Compacting",
  "compaction-prune": "Pruning",
  "compaction-summarize": "Summarizing",
  "compaction-complete": "Compacted",
  "compaction-error": "Compact Fail",
  "context-overflow": "Overflow",
};
```

### 7.4 Debug Logger Updates

Add compaction methods to `lib/debug-logger/trace-logger.ts`:

```typescript
export interface TraceLogger {
  // ... existing methods ...

  // Compaction logging
  compactionStart(tokensBefore: number, modelLimit: number, reason: string): void;
  compactionPrune(outputsPruned: number, tokensSaved: number, prunedTools: string[]): void;
  compactionSummarize(messagesCount: number): void;
  compactionComplete(result: {
    tokensBefore: number;
    tokensAfter: number;
    messagesCompacted: number;
    wasPruned: boolean;
    wasSummarized: boolean;
    summary?: string;
  }): void;
  compactionError(error: string, canRetry: boolean, suggestNewSession: boolean): void;
  contextOverflow(currentTokens: number, limit: number, percentUsed: number): void;
}
```

### 7.5 Chat Pane UI Updates

Update `chat-pane.tsx` with compaction indicators:

```typescript
// Compaction Status Indicator Component
function CompactionIndicator() {
  const isCompacting = useChatStore(s => s.isCompacting);
  const progress = useChatStore(s => s.compactionProgress);

  if (!isCompacting) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border-b border-yellow-200">
      <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
      <span className="text-sm text-yellow-700">
        {progress?.phase === 'pruning' && 'Optimizing conversation...'}
        {progress?.phase === 'summarizing' && 'Summarizing context...'}
      </span>
      {progress?.tokensBefore && progress?.tokensAfter && (
        <span className="text-xs text-yellow-600 ml-auto">
          {Math.round((1 - progress.tokensAfter / progress.tokensBefore) * 100)}% reduced
        </span>
      )}
    </div>
  );
}

// Context Usage Bar Component (shows in header)
function ContextUsageBar() {
  const usage = useChatStore(s => s.contextUsage);

  if (!usage) return null;

  const bgColor = usage.isCritical ? 'bg-red-500'
    : usage.isWarning ? 'bg-yellow-500'
    : 'bg-green-500';

  return (
    <div className="h-1 w-full bg-gray-200">
      <div
        className={`h-full ${bgColor} transition-all`}
        style={{ width: `${Math.min(usage.percentUsed, 100)}%` }}
      />
    </div>
  );
}

// Compaction Error Banner Component
function CompactionErrorBanner() {
  const error = useChatStore(s => s.compactionError);
  const clearError = useChatStore(s => s.clearCompactionError);

  if (!error) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border-b border-red-200">
      <AlertTriangle className="h-4 w-4 text-red-600" />
      <span className="text-sm text-red-700 flex-1">{error.error}</span>
      {error.suggestNewSession && (
        <Button size="sm" variant="outline" onClick={handleNewSession}>
          Start New Session
        </Button>
      )}
      {error.canRetry && (
        <Button size="sm" variant="outline" onClick={handleRetry}>
          Retry
        </Button>
      )}
      <button onClick={clearError} className="text-red-400 hover:text-red-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Compaction Summary Message Component (in chat history)
function CompactionSummaryMessage({ summary }: { summary: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mx-4 my-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center gap-2 text-amber-700">
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium">Conversation Summarized</span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-auto text-amber-500 hover:text-amber-700"
        >
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </button>
      </div>
      {isExpanded && (
        <div className="mt-2 text-sm text-amber-800 whitespace-pre-wrap">
          {summary}
        </div>
      )}
    </div>
  );
}
```

### 7.6 Chat Message Type Updates

Update `ChatMessage` type to support compaction summaries:

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'compaction';  // Add 'compaction'
  content: string;
  createdAt: Date;

  // Compaction-specific fields
  isCompactionSummary?: boolean;
  compactionMetadata?: {
    tokensBefore: number;
    tokensAfter: number;
    messagesCompacted: number;
    compactedAt: number;
  };
}
```

### 7.7 Session Item Updates

Update `session-item.tsx` to show compaction history:

```typescript
// Show compaction count in session list
interface SessionItemProps {
  session: Session & {
    compactionCount?: number;
    lastCompactionAt?: number;
  };
}

function SessionItem({ session }: SessionItemProps) {
  return (
    <div className="...">
      {/* ... existing content ... */}

      {session.compactionCount && session.compactionCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Sparkles className="h-3 w-3" />
          <span>{session.compactionCount} compactions</span>
        </div>
      )}
    </div>
  );
}
```

### 7.8 Debug Panel Compaction Section

Add dedicated compaction section to debug panel:

```typescript
// CompactionDebugSection component
function CompactionDebugSection() {
  const entries = useTraceStore(s => s.filteredEntries);

  const compactionEntries = entries.filter(e =>
    e.type.startsWith('compaction-') || e.type === 'context-overflow'
  );

  if (compactionEntries.length === 0) return null;

  return (
    <div className="border-t pt-2 mt-2">
      <h4 className="text-xs font-medium text-gray-500 mb-2">Context Management</h4>
      {compactionEntries.map(entry => (
        <CompactionEntryRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function CompactionEntryRow({ entry }: { entry: TraceEntry }) {
  const isComplete = entry.type === 'compaction-complete';
  const isError = entry.type === 'compaction-error';

  return (
    <div className={`text-xs p-2 rounded ${
      isComplete ? 'bg-green-50' :
      isError ? 'bg-red-50' :
      'bg-yellow-50'
    }`}>
      <div className="flex items-center gap-2">
        <span className={ENTRY_TYPE_COLORS[entry.type] + ' px-1.5 py-0.5 rounded text-white'}>
          {ENTRY_TYPE_LABELS[entry.type]}
        </span>
        <span className="text-gray-600">{entry.summary}</span>
        {entry.duration && (
          <span className="ml-auto text-gray-400">{formatDuration(entry.duration)}</span>
        )}
      </div>

      {entry.type === 'compaction-complete' && entry.output && (
        <div className="mt-1 grid grid-cols-3 gap-2 text-gray-500">
          <div>Before: {(entry.output as any).tokensBefore?.toLocaleString()} tokens</div>
          <div>After: {(entry.output as any).tokensAfter?.toLocaleString()} tokens</div>
          <div>Saved: {Math.round((1 - (entry.output as any).tokensAfter / (entry.output as any).tokensBefore) * 100)}%</div>
        </div>
      )}

      {entry.type === 'compaction-prune' && entry.output && (
        <div className="mt-1 text-gray-500">
          Pruned {(entry.output as any).outputsPruned} tool outputs
          ({(entry.output as any).tokensSaved?.toLocaleString()} tokens)
        </div>
      )}
    </div>
  );
}
```

### 7.9 Files to Create/Modify

#### New Files

| File | Description |
|------|-------------|
| `app/assistant/_components/compaction-indicator.tsx` | Status indicator during compaction |
| `app/assistant/_components/context-usage-bar.tsx` | Visual context usage indicator |
| `app/assistant/_components/compaction-error-banner.tsx` | Error state with actions |
| `app/assistant/_components/compaction-summary-message.tsx` | Chat history compaction display |
| `app/assistant/_components/compaction-debug-section.tsx` | Debug panel compaction view |

#### Files to Modify

| File | Changes |
|------|---------|
| `app/assistant/_hooks/sse-handlers.ts` | Add compaction event handlers |
| `app/assistant/_stores/chat-store.ts` | Add compaction state and actions |
| `app/assistant/_stores/trace-store.ts` | Add compaction entry types and colors |
| `lib/debug-logger/trace-logger.ts` | Add compaction logging methods |
| `lib/debug-logger/index.ts` | Export compaction methods |
| `app/assistant/_components/chat-pane.tsx` | Integrate compaction components |
| `app/assistant/_components/session-item.tsx` | Show compaction count |

### 7.10 Testing Checklist

- [ ] Compaction indicator appears during compaction
- [ ] Progress shows pruning vs summarizing phase
- [ ] Context usage bar updates in real-time
- [ ] Error banner shows with correct actions
- [ ] "Start New Session" button works when suggested
- [ ] Compaction summary appears in chat history
- [ ] Summary can be expanded/collapsed
- [ ] Debug panel shows all compaction events
- [ ] Compaction metrics (tokens saved, time) are accurate
- [ ] Session list shows compaction count
- [ ] SSE events are properly parsed and dispatched

### 7.11 UX Considerations

**During Compaction**:
- Disable send button while compacting (prevent race conditions)
- Show animated indicator with clear phase information
- Display token reduction percentage in real-time

**On Error**:
- Clear, actionable error messages
- Suggest starting new session when context is irrecoverable
- Allow retry when transient failure

**In Chat History**:
- Compaction summaries are visually distinct (amber/yellow theme)
- Collapsible to avoid cluttering conversation
- Show metadata (tokens saved, messages compacted) on expand

**In Debug Panel**:
- Compaction events grouped in dedicated section
- Full details available for debugging
- Timing information for performance analysis

---

## Phase 8: Cache-Safe Dynamic Injection (External Plan)

### Why This Phase Exists

During the planning of context compaction, we discovered a critical issue: our current system injects dynamic content (working memory, discovered tools, tool prompts) into the **system prompt**, which **destroys LLM provider caching** on every change.

**The Problem**:
- All major LLM providers use prefix-based caching
- Changing the system prompt invalidates the entire cache
- We inject working memory and tool guidance into `<working-memory>` and `<tool-usage-instructions>` sections
- This happens every turn → cache invalidated every request → no cost savings

**The Solution**:
Keep the system prompt completely static and inject dynamic content as **conversation history** (user-assistant message pairs) instead.

This is documented in a separate plan because:
1. It's a significant architectural change affecting multiple systems
2. It can be implemented independently of compaction
3. It requires careful coordination with AI SDK patterns

### Link to External Plan

**See**: [CACHE_SAFE_DYNAMIC_INJECTION_PLAN.md](./CACHE_SAFE_DYNAMIC_INJECTION_PLAN.md)

**Key Files Affected**:
- `server/prompts/agent/main-agent-prompt.xml` → becomes static
- `server/prompts/builder/prompt-builder.ts` → deprecated
- `server/agents/main-agent.ts` → inject via messages, not instructions
- `server/memory/working-context/working-context.ts` → new message factory

---

## Next Steps

Ready to begin Phase 1. Start with:
1. Create `server/memory/compaction/` directory
2. Implement types (including error message tracking)
3. Implement token service (with model adjustment)
4. Test token counting
