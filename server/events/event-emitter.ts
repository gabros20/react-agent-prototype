/**
 * Event Emitter - Typed SSE event emission
 *
 * Provides a type-safe interface for emitting SSE events.
 * Tracks event history for debugging and supports batching.
 */

import type {
  StreamEvent,
  TextDeltaEvent,
  MessageStartEvent,
  MessageCompleteEvent,
  ToolCallEvent,
  ToolResultEvent,
  ToolErrorEvent,
  StepStartEvent,
  StepFinishEvent,
  SystemPromptEvent,
  UserPromptEvent,
  LLMContextEvent,
  ContextCleanupEvent,
  ModelInfoEvent,
  LogEvent,
  FinishEvent,
  ResultEvent,
  DoneEvent,
  ErrorEvent,
  ToolInjectionEvent,
  CompactionStartEvent,
  CompactionProgressEvent,
  CompactionCompleteEvent,
} from './event-types';

// ============================================================================
// Types
// ============================================================================

/** SSE writer function type */
export type SSEWriter = (event: string, data: unknown) => void;

/** Event history entry with timing */
export interface EventHistoryEntry {
  event: StreamEvent;
  emittedAt: Date;
  order: number;
}

// ============================================================================
// SSE Event Emitter
// ============================================================================

export class SSEEventEmitter {
  private readonly writer: SSEWriter;
  private readonly traceId: string;
  private readonly sessionId: string;
  private readonly history: EventHistoryEntry[] = [];
  private eventOrder = 0;
  private readonly trackHistory: boolean;

  constructor(options: {
    writer: SSEWriter;
    traceId: string;
    sessionId: string;
    trackHistory?: boolean;
  }) {
    this.writer = options.writer;
    this.traceId = options.traceId;
    this.sessionId = options.sessionId;
    this.trackHistory = options.trackHistory ?? false;
  }

  // ============================================================================
  // Typed Emit Methods
  // ============================================================================

  emitTextDelta(messageId: string, delta: string): void {
    this.emit<TextDeltaEvent>('text-delta', {
      type: 'text-delta',
      messageId,
      delta,
      timestamp: this.timestamp(),
    });
  }

  emitMessageStart(messageId: string): void {
    this.emit<MessageStartEvent>('message-start', {
      type: 'message-start',
      messageId,
      timestamp: this.timestamp(),
    });
  }

  emitMessageComplete(messageId: string, content: string): void {
    this.emit<MessageCompleteEvent>('message-complete', {
      type: 'message-complete',
      messageId,
      content,
      timestamp: this.timestamp(),
    });
  }

  emitToolCall(toolName: string, toolCallId: string, args: unknown): void {
    this.emit<ToolCallEvent>('tool-call', {
      type: 'tool-call',
      toolName,
      toolCallId,
      args,
      timestamp: this.timestamp(),
    });
  }

  emitToolResult(toolCallId: string, toolName: string, result: unknown): void {
    this.emit<ToolResultEvent>('tool-result', {
      type: 'tool-result',
      toolCallId,
      toolName,
      result,
      timestamp: this.timestamp(),
    });
  }

  emitToolError(toolCallId: string, toolName: string, error: string): void {
    this.emit<ToolErrorEvent>('tool-error', {
      type: 'tool-error',
      toolCallId,
      toolName,
      error,
      timestamp: this.timestamp(),
    });
  }

  emitStepStart(stepNumber: number): void {
    this.emit<StepStartEvent>('step-start', {
      type: 'step-start',
      stepNumber,
      timestamp: this.timestamp(),
    });
  }

  emitStepFinish(stepNumber: number, duration: number, finishReason?: string, usage?: { promptTokens: number; completionTokens: number }): void {
    this.emit<StepFinishEvent>('step-finish', {
      type: 'step-finish',
      stepNumber,
      duration,
      finishReason,
      usage,
      timestamp: this.timestamp(),
    });
  }

  emitSystemPrompt(prompt: string, promptLength: number, tokens: number, workingMemory: string, workingMemoryTokens: number): void {
    this.emit<SystemPromptEvent>('system-prompt', {
      type: 'system-prompt',
      traceId: this.traceId,
      sessionId: this.sessionId,
      prompt,
      promptLength,
      tokens,
      workingMemory,
      workingMemoryTokens,
      timestamp: this.timestamp(),
    });
  }

  emitUserPrompt(prompt: string, tokens: number, messageHistoryTokens: number, messageCount: number, messages?: Array<{ role: string; content: string }>): void {
    this.emit<UserPromptEvent>('user-prompt', {
      type: 'user-prompt',
      traceId: this.traceId,
      sessionId: this.sessionId,
      prompt,
      tokens,
      messageHistoryTokens,
      messageCount,
      messages,
      timestamp: this.timestamp(),
    });
  }

  emitLLMContext(messages: Array<{ role: string; content: unknown }>, messageCount: number, tokens: number): void {
    this.emit<LLMContextEvent>('llm-context', {
      type: 'llm-context',
      traceId: this.traceId,
      sessionId: this.sessionId,
      messages,
      messageCount,
      tokens,
      timestamp: this.timestamp(),
    });
  }

  emitContextCleanup(messagesRemoved: number, turnsRemoved: number, invalidTurnsRemoved: number, removedTools: string[], activeTools: string[]): void {
    this.emit<ContextCleanupEvent>('context-cleanup', {
      type: 'context-cleanup',
      messagesRemoved,
      turnsRemoved,
      invalidTurnsRemoved,
      removedTools,
      activeTools,
      timestamp: this.timestamp(),
    });
  }

  emitModelInfo(modelId: string, pricing: { prompt: number; completion: number } | null): void {
    this.emit<ModelInfoEvent>('model-info', {
      type: 'model-info',
      traceId: this.traceId,
      sessionId: this.sessionId,
      modelId,
      pricing,
      timestamp: this.timestamp(),
    });
  }

  emitLog(level: 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>): void {
    this.emit<LogEvent>('log', {
      type: 'log',
      traceId: this.traceId,
      level,
      message,
      metadata,
      timestamp: this.timestamp(),
    });
  }

  emitFinish(finishReason: string, usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }, toolCallsCount: number): void {
    this.emit<FinishEvent>('finish', {
      type: 'finish',
      finishReason,
      usage,
      toolCallsCount,
      timestamp: this.timestamp(),
    });
  }

  emitResult(
    text: string,
    toolCalls: Array<{ toolName: string; toolCallId: string; args: unknown }>,
    toolResults: Array<{ toolCallId: string; toolName: string; result: unknown }>,
    finishReason: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  ): void {
    this.emit<ResultEvent>('result', {
      type: 'result',
      traceId: this.traceId,
      sessionId: this.sessionId,
      text,
      toolCalls,
      toolResults,
      finishReason,
      usage,
      timestamp: this.timestamp(),
    });
  }

  emitDone(): void {
    this.emit<DoneEvent>('done', {
      type: 'done',
      traceId: this.traceId,
      sessionId: this.sessionId,
      timestamp: this.timestamp(),
    });
  }

  emitError(error: string): void {
    this.emit<ErrorEvent>('error', {
      type: 'error',
      traceId: this.traceId,
      error,
      timestamp: this.timestamp(),
    });
  }

  emitToolInjection(tools: string[], instructions: string, stepNumber: number): void {
    this.emit<ToolInjectionEvent>('tool-injection', {
      type: 'tool-injection',
      tools,
      instructions,
      stepNumber,
      timestamp: this.timestamp(),
    });
  }

  // ============================================================================
  // Compaction Events
  // ============================================================================

  emitCompactionStart(tokensBefore: number, modelLimit: number): void {
    this.emit<CompactionStartEvent>('compaction-start', {
      type: 'compaction-start',
      traceId: this.traceId,
      sessionId: this.sessionId,
      tokensBefore,
      modelLimit,
      timestamp: this.timestamp(),
    });
  }

  emitCompactionProgress(stage: 'pruning' | 'summarizing', progress: number): void {
    this.emit<CompactionProgressEvent>('compaction-progress', {
      type: 'compaction-progress',
      traceId: this.traceId,
      sessionId: this.sessionId,
      stage,
      progress,
      timestamp: this.timestamp(),
    });
  }

  emitCompactionComplete(options: {
    tokensBefore: number;
    tokensAfter: number;
    wasPruned: boolean;
    wasCompacted: boolean;
    prunedOutputs: number;
    compactedMessages: number;
    removedTools: string[];
  }): void {
    const tokensSaved = options.tokensBefore - options.tokensAfter;
    const compressionRatio = options.tokensBefore > 0
      ? Math.round((tokensSaved / options.tokensBefore) * 100)
      : 0;

    this.emit<CompactionCompleteEvent>('compaction-complete', {
      type: 'compaction-complete',
      traceId: this.traceId,
      sessionId: this.sessionId,
      tokensBefore: options.tokensBefore,
      tokensAfter: options.tokensAfter,
      tokensSaved,
      compressionRatio,
      wasPruned: options.wasPruned,
      wasCompacted: options.wasCompacted,
      prunedOutputs: options.prunedOutputs,
      compactedMessages: options.compactedMessages,
      removedTools: options.removedTools,
      timestamp: this.timestamp(),
    });
  }

  // ============================================================================
  // Generic Emit (for custom events)
  // ============================================================================

  emitRaw(eventType: string, data: unknown): void {
    this.writer(eventType, data);
  }

  // ============================================================================
  // History
  // ============================================================================

  getHistory(): ReadonlyArray<EventHistoryEntry> {
    return this.history;
  }

  getEventCount(): number {
    return this.eventOrder;
  }

  // ============================================================================
  // Private
  // ============================================================================

  private emit<T extends StreamEvent>(eventType: string, event: T): void {
    this.writer(eventType, event);

    if (this.trackHistory) {
      this.history.push({
        event,
        emittedAt: new Date(),
        order: this.eventOrder++,
      });
    } else {
      this.eventOrder++;
    }
  }

  private timestamp(): string {
    return new Date().toISOString();
  }
}
