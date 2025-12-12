/**
 * Stream Processor
 *
 * Handles processing of AI SDK stream chunks:
 * - Text delta accumulation
 * - Tool call/result tracking
 * - Entity extraction from results
 * - SSE event emission
 *
 * Extracted from orchestrator.ts for single responsibility.
 */

import { randomUUID } from 'crypto';
import { EntityExtractor, type WorkingContext } from '../memory';
import { SSEEventEmitter } from '../events';
import type { AgentLogger } from '../tools/types';
import type { StreamProcessingResult } from './types';
import type { cmsAgent } from '../agents/main-agent';

// ============================================================================
// Stream Processor
// ============================================================================

export class StreamProcessor {
  private readonly extractor: EntityExtractor;

  constructor() {
    this.extractor = new EntityExtractor();
  }

  /**
   * Process the full stream from the agent
   */
  async processStream(
    streamResult: Awaited<ReturnType<typeof cmsAgent.stream>>,
    workingContext: WorkingContext,
    logger: AgentLogger,
    emitter: SSEEventEmitter
  ): Promise<StreamProcessingResult> {
    const toolCalls: StreamProcessingResult['toolCalls'] = [];
    const toolResults: StreamProcessingResult['toolResults'] = [];
    let finalText = '';
    let finishReason = 'unknown';
    let usage: Record<string, unknown> = {};
    let currentStep = 0;
    let stepStartTime = Date.now();

    // Message tracking
    let currentMessageId = randomUUID();
    let currentMessageText = '';
    let messageStarted = false;
    const displayTexts: string[] = [];

    for await (const chunk of streamResult.fullStream) {
      switch (chunk.type) {
        case 'text-delta':
          this.handleTextDelta(
            chunk,
            emitter,
            currentMessageId,
            { messageStarted, currentMessageText, finalText },
            (updates) => {
              if (updates.messageStarted !== undefined) messageStarted = updates.messageStarted;
              if (updates.currentMessageText !== undefined) currentMessageText = updates.currentMessageText;
              if (updates.finalText !== undefined) finalText = updates.finalText;
            }
          );
          finalText += chunk.text;
          currentMessageText += chunk.text;
          if (!messageStarted) {
            messageStarted = true;
            emitter.emitMessageStart(currentMessageId);
          }
          emitter.emitTextDelta(currentMessageId, chunk.text);
          break;

        case 'tool-call':
          // Finalize pending message before tool
          if (messageStarted && currentMessageText.trim()) {
            displayTexts.push(currentMessageText);
            emitter.emitMessageComplete(currentMessageId, currentMessageText);
            currentMessageId = randomUUID();
            currentMessageText = '';
            messageStarted = false;
          }

          logger.info('Tool called', {
            toolName: chunk.toolName,
            toolCallId: chunk.toolCallId,
          });

          toolCalls.push({
            toolName: chunk.toolName,
            toolCallId: chunk.toolCallId,
            args: chunk.input,
          });

          emitter.emitToolCall(chunk.toolName, chunk.toolCallId, chunk.input);
          break;

        case 'tool-result':
          logger.info('Tool result received', {
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
          });

          toolResults.push({
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            result: chunk.output,
          });

          // Handle finalAnswer specially
          if (chunk.toolName === 'finalAnswer' && chunk.output) {
            const finalAnswerResult = chunk.output as { content?: string; summary?: string };
            const answerContent = finalAnswerResult.content || finalAnswerResult.summary || '';
            if (answerContent) {
              displayTexts.push(answerContent);
            }
          }

          // Handle acknowledgeRequest for preflight text
          if (chunk.toolName === 'acknowledgeRequest' && chunk.output) {
            const ackResult = chunk.output as { message?: string };
            if (ackResult.message) {
              displayTexts.push(ackResult.message);
            }
          }

          // Extract entities for working memory
          this.extractEntities(chunk.toolName, chunk.output, workingContext);

          emitter.emitToolResult(chunk.toolCallId, chunk.toolName, chunk.output);
          break;

        case 'start-step':
          currentStep++;
          stepStartTime = Date.now();
          emitter.emitStepStart(currentStep);
          break;

        case 'finish-step': {
          const stepDuration = Date.now() - stepStartTime;
          const stepUsage = (chunk as unknown as { usage?: { promptTokens?: number; completionTokens?: number } }).usage;
          emitter.emitStepFinish(
            currentStep,
            stepDuration,
            chunk.finishReason,
            stepUsage ? { promptTokens: stepUsage.promptTokens || 0, completionTokens: stepUsage.completionTokens || 0 } : undefined
          );
          break;
        }

        case 'finish':
          finishReason = chunk.finishReason || 'stop';
          usage = chunk.totalUsage || {};
          emitter.emitFinish(
            finishReason,
            usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number },
            toolCalls.length
          );
          break;

        case 'error':
          logger.error('Stream error', { error: chunk.error });
          emitter.emitError(String(chunk.error));
          break;
      }
    }

    // Finalize any remaining message
    if (messageStarted && currentMessageText.trim()) {
      displayTexts.push(currentMessageText);
      emitter.emitMessageComplete(currentMessageId, currentMessageText);
    }

    return {
      toolCalls,
      toolResults,
      finalText,
      finishReason,
      usage,
      displayTexts,
    };
  }

  /**
   * Handle text delta chunk (helper for cleaner switch)
   */
  private handleTextDelta(
    _chunk: { text: string },
    _emitter: SSEEventEmitter,
    _messageId: string,
    _state: { messageStarted: boolean; currentMessageText: string; finalText: string },
    _updateState: (updates: Partial<{ messageStarted: boolean; currentMessageText: string; finalText: string }>) => void
  ): void {
    // State updates handled inline in processStream for performance
    // This method exists for future extensibility (e.g., text buffering)
  }

  /**
   * Extract entities from tool results
   */
  private extractEntities(
    toolName: string,
    result: unknown,
    workingContext: WorkingContext
  ): void {
    try {
      const entities = this.extractor.extract(toolName, result);
      if (entities.length > 0) {
        workingContext.addMany(entities);
      }
    } catch (error) {
      // Silently ignore extraction errors
      console.warn('[StreamProcessor] Entity extraction failed:', error);
    }
  }
}
