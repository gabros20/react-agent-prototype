/**
 * Memory Module - Unified exports for all memory-related functionality
 *
 * Contains:
 * - WorkingContext: Entity sliding window and tool tracking
 * - ContextManager: Message sequence validation and trimming
 * - ToolSearchState: Immutable state for dynamic tool discovery
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

// Context Manager - Message sequence management
export {
  ContextManager,
  type ContextManagerConfig,
  type TrimResult,
  type ParseResult,
  type ConversationTurn,
  type AssistantExchange,
  type ValidationResult,
} from './context-manager';

// Tool Search - Dynamic tool discovery state
export {
  ToolSearchState,
  ToolSearchManager,
  type InjectionRecord,
  type ToolSearchStateData,
  type StepResult,
  type ActiveToolsResult,
} from './tool-search';
