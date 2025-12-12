# Context Compaction System Plan

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
| Phase 1 | ⬜ Pending | Foundation - Types, Token Service, Model Limits |
| Phase 2 | ⬜ Pending | Tool Output Pruning |
| Phase 3 | ⬜ Pending | Message Store Redesign |
| Phase 4 | ⬜ Pending | Compaction/Summarization Service |
| Phase 5 | ⬜ Pending | Context Manager (replaces existing) |
| Phase 6 | ⬜ Pending | Integration & Testing |

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

            case 'compaction-marker':
              // Inject summary as context
              assistantContent.push({
                type: 'text',
                text: `[Previous conversation summary]\n${(part as any).summary}`,
              });
              break;
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

### Gap 3: Message Content Storage Discrepancy

**Our Current System**:
- `messages.content` stores JSON string (AI SDK format)
- Single flat content field, not rich parts structure

**Plan Assumes**:
- Rich parts structure with separate `message_parts` table

**Gap**: The plan creates a new `message_parts` table but doesn't address migration of existing messages or how to handle backward compatibility during transition.

**Fix**: Add migration strategy to Phase 3:
```markdown
### Migration Strategy

1. **New messages**: Use new RichMessage format with parts table
2. **Legacy messages**: Load via converter that parses JSON content to parts on-the-fly
3. **Incremental migration**: Can optionally backfill old messages to new format

// Converter for legacy messages
function legacyToRichMessage(dbMessage: LegacyMessage): RichMessage {
  const content = JSON.parse(dbMessage.content);

  if (dbMessage.role === 'user') {
    return {
      id: dbMessage.id,
      role: 'user',
      parts: [{ id: uuid(), type: 'text', text: typeof content === 'string' ? content : content.text }],
      // ...
    };
  }

  // Parse AI SDK content format to parts
  if (Array.isArray(content)) {
    return parseAISDKContentToParts(content);
  }
  // ...
}
```

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

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Token count inaccuracy | Medium | Add safety margin, test with different models |
| Migration breaks existing sessions | High | Keep legacy parser, gradual migration |
| Compaction loses critical context | High | Test summarization quality manually |
| Prune removes needed tool output | Medium | Protect recent 2 turns minimum |
| Concurrent compaction requests | Low | Lock with `currentlyCompacting` flag |

---

## Next Steps

Ready to begin Phase 1. Start with:
1. Create `server/memory/compaction/` directory
2. Implement types (including error message tracking)
3. Implement token service (with model adjustment)
4. Test token counting
