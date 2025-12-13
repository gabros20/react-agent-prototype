/**
 * Event Types - Typed SSE event definitions
 *
 * All events emitted during agent execution with proper typing.
 * Moved from services/agent/types.ts to centralize event definitions.
 */

// ============================================================================
// Base Event
// ============================================================================

export interface BaseStreamEvent {
  type: string;
  timestamp: string;
}

// ============================================================================
// Text & Message Events
// ============================================================================

export interface TextDeltaEvent extends BaseStreamEvent {
  type: 'text-delta';
  messageId: string;
  delta: string;
}

export interface MessageStartEvent extends BaseStreamEvent {
  type: 'message-start';
  messageId: string;
}

export interface MessageCompleteEvent extends BaseStreamEvent {
  type: 'message-complete';
  messageId: string;
  content: string;
}

// ============================================================================
// Tool Events
// ============================================================================

export interface ToolCallEvent extends BaseStreamEvent {
  type: 'tool-call';
  toolName: string;
  toolCallId: string;
  input: unknown;
}

export interface ToolResultEvent extends BaseStreamEvent {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
}

export interface ToolErrorEvent extends BaseStreamEvent {
  type: 'tool-error';
  toolCallId: string;
  toolName: string;
  error: string;
}

// ============================================================================
// Step Events
// ============================================================================

export interface StepStartEvent extends BaseStreamEvent {
  type: 'step-start';
  stepNumber: number;
}

export interface StepFinishEvent extends BaseStreamEvent {
  type: 'step-finish';
  stepNumber: number;
  duration: number;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// ============================================================================
// Context Events
// ============================================================================

export interface SystemPromptEvent extends BaseStreamEvent {
  type: 'system-prompt';
  traceId: string;
  sessionId: string;
  prompt: string;
  promptLength: number;
  tokens: number;
  workingMemory: string;
  workingMemoryTokens: number;
}

export interface UserPromptEvent extends BaseStreamEvent {
  type: 'user-prompt';
  traceId: string;
  sessionId: string;
  prompt: string;
  tokens: number;
  messageHistoryTokens: number;
  messageCount: number;
  messages?: Array<{ role: string; content: string }>;
}

export interface LLMContextEvent extends BaseStreamEvent {
  type: 'llm-context';
  traceId: string;
  sessionId: string;
  messages: Array<{ role: string; content: unknown }>;
  messageCount: number;
  tokens: number;
}

export interface ContextCleanupEvent extends BaseStreamEvent {
  type: 'context-cleanup';
  messagesRemoved: number;
  turnsRemoved: number;
  invalidTurnsRemoved: number;
  removedTools: string[];
  activeTools: string[];
}

// ============================================================================
// Model Events
// ============================================================================

export interface ModelInfoEvent extends BaseStreamEvent {
  type: 'model-info';
  traceId: string;
  sessionId: string;
  modelId: string;
  pricing: {
    prompt: number;
    completion: number;
  } | null;
}

// ============================================================================
// Log Events
// ============================================================================

export interface LogEvent extends BaseStreamEvent {
  type: 'log';
  traceId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Completion Events
// ============================================================================

export interface FinishEvent extends BaseStreamEvent {
  type: 'finish';
  finishReason: string;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  toolCallsCount: number;
}

export interface ResultEvent extends BaseStreamEvent {
  type: 'result';
  traceId: string;
  sessionId: string;
  text: string;
  toolCalls: Array<{
    toolName: string;
    toolCallId: string;
    input: unknown;
  }>;
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    result: unknown;
  }>;
  finishReason: string;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface DoneEvent extends BaseStreamEvent {
  type: 'done';
  traceId: string;
  sessionId: string;
}

export interface ErrorEvent extends BaseStreamEvent {
  type: 'error';
  traceId: string;
  error: string;
}

// ============================================================================
// Tool Discovery Events (Debug)
// ============================================================================

export interface ToolsDiscoveredEvent extends BaseStreamEvent {
  type: 'tools-discovered';
  tools: string[];
}

export interface InstructionsInjectedEvent extends BaseStreamEvent {
  type: 'instructions-injected';
  tools: string[];
  instructions: string;
  stepNumber: number;
  updatedSystemPrompt?: string;
}

// ============================================================================
// Compaction Events
// ============================================================================

export interface CompactionStartEvent extends BaseStreamEvent {
  type: 'compaction-start';
  traceId: string;
  sessionId: string;
  tokensBefore: number;
  modelLimit: number;
}

export interface CompactionProgressEvent extends BaseStreamEvent {
  type: 'compaction-progress';
  traceId: string;
  sessionId: string;
  stage: 'pruning' | 'summarizing';
  /** Progress percentage 0-100 */
  progress: number;
}

export interface CompactionCompleteEvent extends BaseStreamEvent {
  type: 'compaction-complete';
  traceId: string;
  sessionId: string;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  /** Compression ratio as percentage (e.g., 75 means 75% smaller) */
  compressionRatio: number;
  wasPruned: boolean;
  wasCompacted: boolean;
  prunedOutputs: number;
  compactedMessages: number;
  removedTools: string[];
}

// ============================================================================
// Union Type
// ============================================================================

export type StreamEvent =
  | TextDeltaEvent
  | MessageStartEvent
  | MessageCompleteEvent
  | ToolCallEvent
  | ToolResultEvent
  | ToolErrorEvent
  | StepStartEvent
  | StepFinishEvent
  | SystemPromptEvent
  | UserPromptEvent
  | LLMContextEvent
  | ContextCleanupEvent
  | ModelInfoEvent
  | LogEvent
  | FinishEvent
  | ResultEvent
  | DoneEvent
  | ErrorEvent
  | ToolsDiscoveredEvent
  | InstructionsInjectedEvent
  | CompactionStartEvent
  | CompactionProgressEvent
  | CompactionCompleteEvent;

// ============================================================================
// Type Guards
// ============================================================================

export function isTextDeltaEvent(event: StreamEvent): event is TextDeltaEvent {
  return event.type === 'text-delta';
}

export function isToolCallEvent(event: StreamEvent): event is ToolCallEvent {
  return event.type === 'tool-call';
}

export function isToolResultEvent(event: StreamEvent): event is ToolResultEvent {
  return event.type === 'tool-result';
}

export function isFinishEvent(event: StreamEvent): event is FinishEvent {
  return event.type === 'finish';
}

export function isErrorEvent(event: StreamEvent): event is ErrorEvent {
  return event.type === 'error';
}
