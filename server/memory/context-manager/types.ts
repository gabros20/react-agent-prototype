/**
 * Context Manager Types
 *
 * Interfaces for turn-based context management with coordinated tool cleanup.
 *
 * Key Concepts:
 * - ConversationTurn: Atomic unit = user message + all assistant responses/tool calls
 * - AssistantExchange: One assistant message + its tool results (if any)
 * - toolCallId: Unique ID linking tool-call to tool-result (OpenAI requirement)
 */

import type { ModelMessage } from 'ai';

// ============================================================================
// Configuration
// ============================================================================

export interface ContextManagerConfig {
  /** Maximum messages to keep (default: 20) */
  maxMessages: number;

  /** Minimum conversation turns to always keep (default: 2) */
  minTurnsToKeep: number;
}

// ============================================================================
// Conversation Structure
// ============================================================================

/**
 * A complete conversation turn: user question + all assistant responses.
 *
 * Example turn:
 *   [user] "what pages?"
 *   [assistant] tool_call: listPages (id: call_1)
 *   [tool] result for call_1
 *   [assistant] tool_call: finalAnswer (id: call_2)
 *   [tool] result for call_2
 *
 * This is ONE turn with TWO exchanges.
 */
export interface ConversationTurn {
  /** The user's message that started this turn (null for preamble before first user) */
  userMessage: ModelMessage | null;

  /** Sequence of assistant actions with their tool results */
  exchanges: AssistantExchange[];

  /** Whether this turn has valid tool call/result pairing */
  isValid: boolean;

  /** Total message count in this turn (for budget calculation) */
  messageCount: number;
}

/**
 * One assistant action and its tool results.
 *
 * An assistant message may contain:
 * - Just text (no tool calls) → toolMessage is null
 * - One or more tool calls → toolMessage contains all results
 *
 * OpenAI requires: every tool-call ID must have a matching tool-result ID
 * in the immediately following tool message.
 */
export interface AssistantExchange {
  /** The assistant's message (may contain text, tool-calls, or both) */
  assistantMessage: ModelMessage;

  /** The tool message with results (null if assistant had no tool calls) */
  toolMessage: ModelMessage | null;

  /** Tool call IDs from assistant message (for validation) */
  toolCallIds: Set<string>;

  /** Tool result IDs from tool message (for validation) */
  toolResultIds: Set<string>;
}

// ============================================================================
// Result Types
// ============================================================================

export interface TrimResult {
  /** Trimmed message array ready for LLM */
  messages: ModelMessage[];

  /** Tools removed from working context */
  removedTools: string[];

  /** Tools still active after cleanup */
  activeTools: string[];

  /** Number of messages removed */
  messagesRemoved: number;

  /** Number of turns removed */
  turnsRemoved: number;

  /** Number of invalid turns repaired/removed */
  invalidTurnsRemoved: number;
}

export interface ParseResult {
  /** System prompt (always kept) */
  systemMessage: ModelMessage | null;

  /** Parsed conversation turns */
  turns: ConversationTurn[];

  /** Any orphaned messages that couldn't be parsed into turns */
  orphanedMessages: ModelMessage[];
}

export interface ValidationResult {
  /** Whether the turn is valid */
  isValid: boolean;

  /** Specific issues found (for debugging) */
  issues: string[];
}
