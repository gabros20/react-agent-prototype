/**
 * Compaction Module Exports
 *
 * Context compaction system based on OpenCode's battle-tested approach.
 * Prevents AI drift during long conversations through:
 * 1. Token-based overflow detection
 * 2. Smart tool output pruning
 * 3. Conversation summarization
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
  OverflowCheckResult,
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

// Token service
export {
  getModelLimits,
  countPartTokens,
  countMessageTokens,
  countTotalTokens,
  estimateTokens,
  countTokensWithModelAdjustment,
  calculateAvailableTokens,
  isApproachingOverflow,
  calculateContextUsagePercent,
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
  checkOverflow,
  prepareContext,
  prepareContextForLLM,
  type ContextPrepareOptions,
} from './context-preparation';
