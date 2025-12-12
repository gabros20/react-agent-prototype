/**
 * Memory Module - Unified exports for all memory-related functionality
 *
 * Contains:
 * - WorkingContext: Entity sliding window and tool tracking
 * - ToolSearchState: Immutable state for dynamic tool discovery
 * - Compaction: Token-based context compaction with summarization
 */

// Working Context - Entity and tool tracking
export {
  WorkingContext,
  EntityExtractor,
  type Entity,
  type WorkingContextState,
  type ToolUsageRecord,
  type ExtractionSchema,
} from './working-context';

// Tool Search - Dynamic tool discovery state
export {
  ToolSearchState,
  ToolSearchManager,
  type InjectionRecord,
  type ToolSearchStateData,
  type StepResult,
  type ActiveToolsResult,
} from './tool-search';

// Compaction - Token-based context compaction
export {
  // Types
  type CompactionConfig,
  type TokenUsage,
  type ModelLimits,
  type MessagePartType,
  type MessagePart,
  type TextPart,
  type ToolCallPart,
  type ToolResultPart,
  type CompactionMarkerPart,
  type RichMessage,
  type UserMessage,
  type AssistantMessage,
  type ToolMessage,
  type OverflowCheckResult,
  type PruneResult,
  type CompactionResult,
  type ContextPrepareResult,
  // Config
  DEFAULT_COMPACTION_CONFIG,
  // Type guards
  isTextPart,
  isToolCallPart,
  isToolResultPart,
  isCompactionMarkerPart,
  isUserMessage,
  isAssistantMessage,
  isToolMessage,
  // Token service
  getModelLimits,
  countPartTokens,
  countMessageTokens,
  countTotalTokens,
  estimateTokens,
  countTokensWithModelAdjustment,
  calculateAvailableTokens,
  isApproachingOverflow,
  calculateContextUsagePercent,
  // Tool pruner
  pruneToolOutputs,
  needsPruning,
  estimatePruneSavings,
  // Compaction service
  CompactionService,
  getCompactionService,
  // Message converter
  modelMessagesToRich,
  modelMessageToRich,
  richMessagesToModel,
  richMessageToModel,
  // Context preparation (main entry point)
  checkOverflow,
  prepareContext,
  prepareContextForLLM,
  type ContextPrepareOptions,
} from './compaction';
