/**
 * Agent Orchestrator (Thin)
 *
 * Thin coordinator that composes:
 * - ContextCoordinator: Session & context management
 * - StreamProcessor: Stream handling & entity extraction
 * - SSEEventEmitter: Typed event emission
 *
 * This file is now ~150 lines (down from 879).
 * Business logic is delegated to specialized modules.
 */

import { cmsAgent, AGENT_CONFIG, getLastInjectedInstructions, type AgentCallOptions } from '../agents/main-agent';
import { getSystemPrompt } from '../agents/system-prompt';
import { SSEEventEmitter, type SSEWriter } from '../events';
import { countTokens, countChatTokens } from '../../lib/tokenizer';
import { getModelPricing } from '../services/openrouter-pricing';
import { ContextCoordinator } from './context-coordinator';
import { StreamProcessor } from './stream-processor';
import type { AgentLogger } from '../tools/types';
import type {
  ExecuteOptions,
  OrchestratorDependencies,
  OrchestratorResult,
} from './types';

// ============================================================================
// Orchestrator
// ============================================================================

export class AgentOrchestrator {
  private readonly deps: OrchestratorDependencies;
  private readonly contextCoordinator: ContextCoordinator;
  private readonly streamProcessor: StreamProcessor;

  constructor(deps: OrchestratorDependencies) {
    this.deps = deps;
    this.contextCoordinator = new ContextCoordinator(deps);
    this.streamProcessor = new StreamProcessor();
  }

  // ============================================================================
  // Streaming Execution
  // ============================================================================

  /**
   * Execute agent with streaming response
   */
  async *executeStream(
    options: ExecuteOptions,
    writeSSE: SSEWriter
  ): AsyncGenerator<void, void, unknown> {
    const resolved = await this.contextCoordinator.resolveOptions(options);
    const emitter = new SSEEventEmitter({
      writer: writeSSE,
      traceId: resolved.traceId,
      sessionId: resolved.sessionId,
    });
    const logger = this.createSSELogger(resolved.traceId, emitter);

    try {
      // Prepare context
      const { context, workingContext } = await this.contextCoordinator.prepareContext(
        resolved,
        logger
      );

      // Emit context events
      await this.emitContextEvents(resolved, context, emitter);

      logger.info('Starting agent execution', {
        traceId: resolved.traceId,
        sessionId: resolved.sessionId,
        prompt: resolved.prompt.slice(0, 100),
      });

      // Build agent options
      const agentOptions = this.buildAgentOptions(resolved, context, logger, {
        write: (event) => {
          const eventType = (event as { type?: string }).type || 'step';
          writeSSE(eventType, event);
        },
      });

      // Execute agent
      const streamResult = await cmsAgent.stream({
        messages: context.messages,
        options: agentOptions,
      });

      // Process stream
      const result = await this.streamProcessor.processStream(
        streamResult,
        workingContext,
        logger,
        emitter
      );

      // Get response messages
      const responseData = await streamResult.response;

      logger.info('Agent execution completed', {
        traceId: resolved.traceId,
        toolCallsCount: result.toolCalls.length,
        finishReason: result.finishReason,
      });

      // Save session data
      const combinedDisplayContent = result.displayTexts.join('\n\n').trim() || result.finalText;
      await this.contextCoordinator.saveSessionData(
        resolved.sessionId,
        context.previousMessages,
        resolved.prompt,
        responseData.messages,
        workingContext,
        logger,
        combinedDisplayContent
      );

      // Emit final events
      emitter.emitResult(
        result.finalText,
        result.toolCalls,
        result.toolResults,
        result.finishReason,
        result.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number }
      );
      emitter.emitDone();
    } catch (error) {
      logger.error('Agent execution error', {
        traceId: resolved.traceId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      emitter.emitError((error as Error).message);
    }
  }

  // ============================================================================
  // Non-Streaming Execution
  // ============================================================================

  /**
   * Execute agent with non-streaming response
   */
  async executeGenerate(options: ExecuteOptions): Promise<OrchestratorResult> {
    const resolved = await this.contextCoordinator.resolveOptions(options);
    const logger = this.createConsoleLogger();

    // Prepare context
    const { context, workingContext } = await this.contextCoordinator.prepareContext(
      resolved,
      logger
    );

    logger.info('Starting agent execution (non-streaming)', {
      traceId: resolved.traceId,
      sessionId: resolved.sessionId,
      prompt: resolved.prompt.slice(0, 100),
    });

    // Build agent options
    const agentOptions = this.buildAgentOptions(resolved, context, logger);

    // Execute agent
    const result = await cmsAgent.generate({
      messages: context.messages,
      options: agentOptions,
    });

    logger.info('Agent execution completed', {
      traceId: resolved.traceId,
      stepsCount: result.steps?.length || 0,
    });

    // Save session data
    await this.contextCoordinator.saveSessionData(
      resolved.sessionId,
      context.previousMessages,
      resolved.prompt,
      result.response.messages,
      workingContext,
      logger
    );

    return {
      traceId: resolved.traceId,
      sessionId: resolved.sessionId,
      text: result.text,
      steps: result.steps || [],
      usage: result.usage || {},
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private buildAgentOptions(
    resolved: { sessionId: string; traceId: string; modelId: string; cmsTarget: { siteId: string; environmentId: string } },
    context: { workingMemoryString: string; discoveredTools: string[] },
    logger: AgentLogger,
    stream?: { write: (event: unknown) => void }
  ): AgentCallOptions {
    return {
      sessionId: resolved.sessionId,
      traceId: resolved.traceId,
      modelId: resolved.modelId,
      workingMemory: context.workingMemoryString,
      discoveredTools: context.discoveredTools,
      cmsTarget: resolved.cmsTarget,
      db: this.deps.db,
      services: this.deps.services,
      vectorIndex: this.deps.vectorIndex,
      logger,
      stream,
    };
  }

  private async emitContextEvents(
    resolved: { traceId: string; sessionId: string; modelId: string; prompt: string },
    context: { messages: unknown[]; workingMemoryString: string; previousMessages: unknown[]; trimInfo: { messagesRemoved: number; turnsRemoved: number; invalidTurnsRemoved: number; removedTools: string[]; activeTools: string[] } },
    emitter: SSEEventEmitter
  ): Promise<void> {
    // System prompt
    const systemPrompt = getSystemPrompt({
      currentDate: new Date().toISOString(),
      workingMemory: context.workingMemoryString,
    });
    const systemPromptTokens = countTokens(systemPrompt);
    const workingMemoryTokens = context.workingMemoryString ? countTokens(context.workingMemoryString) : 0;
    emitter.emitSystemPrompt(systemPrompt, systemPrompt.length, systemPromptTokens, context.workingMemoryString, workingMemoryTokens);

    // Model info
    const modelPricing = await getModelPricing(resolved.modelId);
    emitter.emitModelInfo(resolved.modelId, modelPricing);

    // User prompt
    const userPromptTokens = countTokens(resolved.prompt);
    const messageHistoryTokens = context.previousMessages.length > 0
      ? countChatTokens(
          (context.previousMessages as { role: string; content: unknown }[]).map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          }))
        )
      : 0;
    emitter.emitUserPrompt(
      resolved.prompt,
      userPromptTokens,
      messageHistoryTokens,
      context.previousMessages.length,
      (context.previousMessages as { role: string; content: unknown }[]).map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      }))
    );

    // Context cleanup
    if (context.trimInfo.messagesRemoved > 0 || context.trimInfo.removedTools.length > 0 || context.trimInfo.invalidTurnsRemoved > 0) {
      emitter.emitContextCleanup(
        context.trimInfo.messagesRemoved,
        context.trimInfo.turnsRemoved,
        context.trimInfo.invalidTurnsRemoved,
        context.trimInfo.removedTools,
        context.trimInfo.activeTools
      );
    }

    // LLM context
    const trimmedTokens = countChatTokens(
      (context.messages as { role: string; content: unknown }[]).map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      }))
    );
    emitter.emitLLMContext(
      (context.messages as { role: string; content: unknown }[]).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      context.messages.length,
      trimmedTokens
    );
  }

  private createSSELogger(traceId: string, emitter: SSEEventEmitter): AgentLogger {
    return {
      info: (msg, meta) => {
        const message = typeof msg === 'string' ? msg : JSON.stringify(msg);
        console.log('[INFO]', message, meta);
        emitter.emitLog('info', message, meta);
      },
      warn: (msg, meta) => {
        const message = typeof msg === 'string' ? msg : JSON.stringify(msg);
        console.warn('[WARN]', message, meta);
        emitter.emitLog('warn', message, meta);
      },
      error: (msg, meta) => {
        const message = typeof msg === 'string' ? msg : JSON.stringify(msg);
        console.error('[ERROR]', message, meta);
        emitter.emitLog('error', message, meta);
      },
    };
  }

  private createConsoleLogger(): AgentLogger {
    return {
      info: (msg, meta) => {
        console.log('[INFO]', typeof msg === 'string' ? msg : JSON.stringify(msg), meta);
      },
      warn: (msg, meta) => {
        console.warn('[WARN]', typeof msg === 'string' ? msg : JSON.stringify(msg), meta);
      },
      error: (msg, meta) => {
        console.error('[ERROR]', typeof msg === 'string' ? msg : JSON.stringify(msg), meta);
      },
    };
  }
}
