/**
 * Compaction Module Exports
 *
 * Context compaction system based on OpenCode's battle-tested approach.
 * Prevents AI drift during long conversations through:
 * 1. Provider-token-based overflow detection (source of truth)
 * 2. Smart tool output pruning (heuristic)
 * 3. Conversation summarization
 *
 * NOTE: Local token counting has been removed. Provider tokens are the
 * ONLY source of truth for context window usage.
 */

// Types
export type {
  CompactionConfig,
  TokenUsage,
  ModelLimits,
  MessagePartType,
  BaseMessagePart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  ReasoningPart,
  StepStartPart,
  CompactionMarkerPart,
  MessagePart,
  RichMessageBase,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  RichMessage,
  PruneResult,
  CompactionResult,
  ContextPrepareResult,
} from './types';

// Config defaults
export { DEFAULT_COMPACTION_CONFIG } from './types';

// Type guards
export {
  isTextPart,
  isToolCallPart,
  isToolResultPart,
  isCompactionMarkerPart,
  isUserMessage,
  isAssistantMessage,
  isToolMessage,
} from './types';

// Token service (provider-only)
export {
  getModelLimits,
  countPartTokens,  // ONLY for tool pruning heuristics
  isOverflowFromProviderTokens,
  COMPACTION_THRESHOLD,
  DEFAULT_CONTEXT_LIMIT,
  DEFAULT_MAX_OUTPUT,
  type ProviderTokens,
} from './token-service';

// Tool pruner
export {
  pruneToolOutputs,
  needsPruning,
  estimatePruneSavings,
} from './tool-pruner';

// Compaction service
export {
  CompactionService,
  getCompactionService,
} from './compaction-service';

// Message converter
export {
  modelMessagesToRich,
  modelMessageToRich,
  richMessagesToModel,
  richMessageToModel,
} from './message-converter';

// Context preparation (main entry point)
export {
  prepareContext,
  prepareContextForLLM,
  type ContextPrepareOptions,
} from './context-preparation';
