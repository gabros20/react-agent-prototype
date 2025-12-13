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
  /** Input parameters for the tool call (matches AI SDK v6 naming) */
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
  /** User message asking for summary */
  triggerMessage: UserMessage;
  /** Summary message (assistant response) */
  summaryMessage: AssistantMessage;
  /** Messages after compaction (trigger + summary + recent messages) */
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

// ============================================================================
// Type Guards
// ============================================================================

export function isTextPart(part: MessagePart): part is TextPart {
  return part.type === 'text';
}

export function isToolCallPart(part: MessagePart): part is ToolCallPart {
  return part.type === 'tool-call';
}

export function isToolResultPart(part: MessagePart): part is ToolResultPart {
  return part.type === 'tool-result';
}

export function isCompactionMarkerPart(part: MessagePart): part is CompactionMarkerPart {
  return part.type === 'compaction-marker';
}

export function isUserMessage(msg: RichMessage): msg is UserMessage {
  return msg.role === 'user';
}

export function isAssistantMessage(msg: RichMessage): msg is AssistantMessage {
  return msg.role === 'assistant';
}

export function isToolMessage(msg: RichMessage): msg is ToolMessage {
  return msg.role === 'tool';
}
