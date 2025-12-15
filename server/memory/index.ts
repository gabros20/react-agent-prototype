/**
 * Memory Module - Unified exports for all memory-related functionality
 *
 * Contains:
 * - WorkingContext: Entity sliding window and tool tracking
 * - ToolSearchState: Immutable state for dynamic tool discovery
 * - Compaction: Provider-token-based context compaction with summarization
 *
 * NOTE: Local token counting has been removed. Provider tokens are the
 * ONLY source of truth for context window usage.
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

// Compaction - Provider-token-based context compaction
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
  // Token service (provider-only)
  getModelLimits,
  countPartTokens,  // ONLY for tool pruning heuristics
  isOverflowFromProviderTokens,
  COMPACTION_THRESHOLD,
  DEFAULT_CONTEXT_LIMIT,
  DEFAULT_MAX_OUTPUT,
  type ProviderTokens,
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
  prepareContext,
  prepareContextForLLM,
  type ContextPrepareOptions,
} from './compaction';
