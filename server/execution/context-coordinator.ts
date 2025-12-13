/**
 * Context Coordinator (Cache-Safe Architecture)
 *
 * Handles context lifecycle:
 * - Session management
 * - Working context loading/saving
 * - Message loading and compaction
 * - CMS target resolution
 * - Context injection via messages (preserves LLM cache)
 *
 * IMPORTANT: Dynamic content is injected as conversation messages,
 * NOT into the system prompt. This preserves LLM prefix caching.
 *
 * Extracted from orchestrator.ts for single responsibility.
 */

import { randomUUID } from 'crypto';
import type { ModelMessage } from 'ai';
import {
  WorkingContext,
  prepareContextForLLM,
  type ContextPrepareResult,
  richMessagesToModel,
  modelMessageToRich,
  type RichMessage,
  isOverflowFromProviderTokens,
} from '../memory';
import { getModelLimits } from '../memory/compaction/token-service';
import { getSiteAndEnv } from '../utils/get-context';
import type { ProviderTokens } from '../services/message-store';
// NOTE: createContextRestorationMessages removed - the condition for using it never fired
// (new sessions have empty workingContext, existing sessions have messages)
import type { AgentLogger } from '../tools/types';
import type { SSEEventEmitter } from '../events';
import type {
  ExecuteOptions,
  ResolvedExecuteOptions,
  OrchestratorDependencies,
  PreparedContext,
} from './types';
import { AGENT_CONFIG } from '../agents/main-agent';

// Maximum compaction attempts per session to prevent infinite loops
const MAX_COMPACTION_ATTEMPTS = 10;

// ============================================================================
// Context Coordinator
// ============================================================================

/**
 * Environment variable to enable/disable compaction.
 * When false: full chat history is sent (no trimming, no compaction)
 * When true: token-based compaction with pruning and summarization
 */
const ENABLE_COMPACTION = process.env.ENABLE_COMPACTION === 'true';

export class ContextCoordinator {
  private readonly deps: OrchestratorDependencies;

  constructor(deps: OrchestratorDependencies) {
    this.deps = deps;
  }

  // ============================================================================
  // Option Resolution
  // ============================================================================

  /**
   * Resolve execution options with defaults
   */
  async resolveOptions(options: ExecuteOptions): Promise<ResolvedExecuteOptions> {
    const traceId = randomUUID();
    const sessionId = options.sessionId || randomUUID();
    const modelId = options.modelId || AGENT_CONFIG.modelId;
    const cmsTarget = await this.resolveCmsTarget(options.cmsTarget);

    return {
      prompt: options.prompt,
      sessionId,
      traceId,
      modelId,
      cmsTarget,
    };
  }

  /**
   * Resolve CMS target (site/environment IDs)
   */
  private async resolveCmsTarget(
    target?: { siteId?: string; environmentId?: string }
  ): Promise<{ siteId: string; environmentId: string }> {
    try {
      // Use provided IDs if they look like UUIDs
      if (target?.siteId && target.siteId.includes('-')) {
        return {
          siteId: target.siteId,
          environmentId: target.environmentId || 'main',
        };
      }

      // Lookup by name (default: local-site/main)
      const siteName = target?.siteId || 'local-site';
      const envName = target?.environmentId || 'main';
      return await getSiteAndEnv(this.deps.db, siteName, envName);
    } catch {
      // Fallback: get first available site/env
      const site = await this.deps.db.query.sites.findFirst();
      const env = await this.deps.db.query.environments.findFirst();
      if (!site || !env) {
        throw new Error('No site/environment configured. Run seed script first.');
      }
      return { siteId: site.id, environmentId: env.id };
    }
  }

  // ============================================================================
  // Context Preparation
  // ============================================================================

  /**
   * Prepare context for agent execution
   *
   * - Ensures session exists
   * - Loads working context
   * - Loads previous messages
   * - Compacts context if ENABLE_COMPACTION is true
   */
  async prepareContext(
    options: ResolvedExecuteOptions,
    logger: AgentLogger,
    emitter?: SSEEventEmitter
  ): Promise<{ context: PreparedContext; workingContext: WorkingContext; compactionResult?: ContextPrepareResult }> {
    // Ensure session exists
    await this.deps.sessionService.ensureSession(options.sessionId);

    // Load working context
    const workingContext = await this.deps.sessionService.loadWorkingContext(options.sessionId);

    // Load previous messages
    const previousMessages = await this.loadPreviousMessages(options.sessionId, logger);

    // Build messages array
    let messages: ModelMessage[] = [...previousMessages];

    // Add current user prompt
    messages.push({ role: 'user', content: options.prompt });

    // Check if compaction is disabled or max attempts reached
    const session = await this.deps.sessionService.getSessionById(options.sessionId);
    const compactionDisabled = !ENABLE_COMPACTION;
    const maxAttemptsReached = (session.compactionCount || 0) >= MAX_COMPACTION_ATTEMPTS;

    // Get model limits (use session's stored context length if available)
    const modelLimits = getModelLimits(options.modelId, session.modelContextLength);

    // Provider-anchored compaction decision (OpenCode pattern)
    // Get provider-reported tokens from last assistant message - this is the source of truth
    const lastProviderTokens = await this.deps.messageStore.getLastAssistantTokens(options.sessionId);

    // Skip compaction check entirely for new sessions (0 messages = full context available)
    if (!lastProviderTokens) {
      logger.info('New session or no provider tokens, skipping compaction check', {
        sessionId: options.sessionId,
        messageCount: previousMessages.length,
      });

      return {
        context: {
          messages,
          workingMemoryString: workingContext.toContextString(),
          discoveredTools: workingContext.getDiscoveredTools(),
          previousMessages,
          trimInfo: {
            messagesRemoved: 0,
            turnsRemoved: 0,
            invalidTurnsRemoved: 0,
            removedTools: [],
            activeTools: workingContext.getDiscoveredTools(),
          },
        },
        workingContext,
      };
    }

    // Check overflow using provider tokens
    const shouldCompact = isOverflowFromProviderTokens(lastProviderTokens, modelLimits);

    if (compactionDisabled || maxAttemptsReached || !shouldCompact) {
      if (maxAttemptsReached) {
        logger.warn('Maximum compaction attempts reached, using full history', {
          sessionId: options.sessionId,
          compactionCount: session.compactionCount,
          maxAttempts: MAX_COMPACTION_ATTEMPTS,
        });
      } else if (compactionDisabled) {
        logger.info('Compaction disabled, using full history', {
          messageCount: messages.length,
        });
      } else {
        logger.info('Context within limits, no compaction needed', {
          providerTokens: lastProviderTokens,
          contextLimit: modelLimits.contextLimit,
          threshold: 0.9,
        });
      }

      return {
        context: {
          messages,
          workingMemoryString: workingContext.toContextString(),
          discoveredTools: workingContext.getDiscoveredTools(),
          previousMessages,
          trimInfo: {
            messagesRemoved: 0,
            turnsRemoved: 0,
            invalidTurnsRemoved: 0,
            removedTools: [],
            activeTools: workingContext.getDiscoveredTools(),
          },
        },
        workingContext,
      };
    }

    // Emit compaction start event with provider-reported token count
    if (emitter) {
      const providerTokenCount = lastProviderTokens.input + lastProviderTokens.output;
      emitter.emitCompactionStart(providerTokenCount, modelLimits.contextLimit);
    }

    logger.info('Compaction triggered by provider tokens', {
      providerTokens: lastProviderTokens,
      contextLimit: modelLimits.contextLimit,
      usable: modelLimits.contextLimit - modelLimits.maxOutput,
    });

    // Compaction enabled and needed - prepare context with pruning and summarization
    let preparedMessages: typeof messages;
    let result: ContextPrepareResult;

    try {
      const compactionResult = await prepareContextForLLM(
        messages,
        {
          sessionId: options.sessionId,
          modelId: options.modelId,
          sessionContextLength: session.modelContextLength, // Use stored context length from OpenRouter
          onProgress: (status) => {
            logger.info('Compaction progress', { status });
            // Emit progress events
            if (emitter) {
              if (status === 'checking-overflow') {
                emitter.emitCompactionProgress('pruning', 10);
              } else if (status === 'pruning') {
                emitter.emitCompactionProgress('pruning', 50);
              } else if (status === 'summarizing') {
                emitter.emitCompactionProgress('summarizing', 75);
              }
            }
          },
        }
      );
      preparedMessages = compactionResult.messages;
      result = compactionResult.result;
    } catch (compactionError) {
      // Compaction failed - fall back to full messages without compaction
      // This prevents LLM API failures from crashing the entire request
      logger.error('Compaction failed, using full messages', {
        sessionId: options.sessionId,
        error: (compactionError as Error).message,
      });
      if (emitter) {
        emitter.emitLog('error', `Compaction failed: ${(compactionError as Error).message}`, {
          sessionId: options.sessionId,
        });
      }

      // Return context without compaction (may exceed token limit, but LLM will handle truncation)
      return {
        context: {
          messages,
          workingMemoryString: workingContext.toContextString(),
          discoveredTools: workingContext.getDiscoveredTools(),
          previousMessages,
          trimInfo: {
            messagesRemoved: 0,
            turnsRemoved: 0,
            invalidTurnsRemoved: 0,
            removedTools: [],
            activeTools: workingContext.getDiscoveredTools(),
          },
        },
        workingContext,
      };
    }

    // Log and emit compaction results
    if (result.wasPruned || result.wasCompacted) {
      logger.info('Context compacted', {
        wasPruned: result.wasPruned,
        wasCompacted: result.wasCompacted,
        tokensBefore: result.tokens.before,
        tokensAfter: result.tokens.final,
        tokensSaved: result.tokens.before - result.tokens.final,
        prunedOutputs: result.debug.prunedOutputs,
        compactedMessages: result.debug.compactedMessages,
      });

      // Emit compaction complete event
      if (emitter) {
        emitter.emitCompactionComplete({
          tokensBefore: result.tokens.before,
          tokensAfter: result.tokens.final,
          wasPruned: result.wasPruned,
          wasCompacted: result.wasCompacted,
          prunedOutputs: result.debug.prunedOutputs,
          compactedMessages: result.debug.compactedMessages,
          removedTools: result.debug.removedTools,
        });
      }

      // Update session compaction tracking if summarization occurred
      if (result.wasCompacted) {
        await this.updateSessionCompactionTracking(options.sessionId, logger);

        // Clear only discovered tools after compaction - agent will rediscover via searchTools
        // Preserve entities since they may still be relevant (pages, sections being worked on)
        // Summary prose contains conversation context, but entity IDs are still useful
        workingContext.clearDiscoveredTools();
        await this.deps.sessionService.saveWorkingContext(options.sessionId, workingContext);
        logger.info('Cleared discovered tools after compaction (entities preserved)', {
          sessionId: options.sessionId,
          entitiesRemaining: workingContext.size(),
        });
      }
    }

    // Update removed tools in working context
    if (result.debug.removedTools.length > 0) {
      workingContext.removeTools(result.debug.removedTools);
    }

    return {
      context: {
        messages: preparedMessages,
        workingMemoryString: workingContext.toContextString(),
        discoveredTools: workingContext.getDiscoveredTools(),
        previousMessages,
        trimInfo: {
          messagesRemoved: messages.length - preparedMessages.length,
          turnsRemoved: 0,
          invalidTurnsRemoved: 0,
          removedTools: result.debug.removedTools,
          activeTools: workingContext.getDiscoveredTools(),
        },
      },
      workingContext,
      compactionResult: result,
    };
  }

  /**
   * Update session compaction tracking in DB
   */
  private async updateSessionCompactionTracking(
    sessionId: string,
    logger: AgentLogger
  ): Promise<void> {
    try {
      const { eq, sql } = await import('drizzle-orm');
      const schema = await import('../db/schema');

      await this.deps.db.update(schema.sessions)
        .set({
          compactionCount: sql`${schema.sessions.compactionCount} + 1`,
          lastCompactionAt: Date.now(),
          updatedAt: new Date(),
        })
        .where(eq(schema.sessions.id, sessionId));

      logger.info('Updated session compaction tracking', { sessionId });
    } catch (error) {
      logger.warn('Failed to update session compaction tracking', {
        sessionId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Load previous messages for a session using MessageStore
   */
  private async loadPreviousMessages(
    sessionId: string | undefined,
    logger: AgentLogger
  ): Promise<ModelMessage[]> {
    if (!sessionId) return [];

    try {
      // Load rich messages from MessageStore (with parts)
      const richMessages = await this.deps.messageStore.loadRichMessages(sessionId);

      // Convert to ModelMessage for AI SDK
      const messages = richMessagesToModel(richMessages);

      logger.info('Loaded session history from MessageStore', {
        sessionId,
        messageCount: messages.length,
        partsCount: richMessages.reduce((sum, m) => sum + m.parts.length, 0),
      });
      return messages;
    } catch (error) {
      logger.warn('Could not load session history', {
        sessionId,
        error: (error as Error).message,
      });
      return [];
    }
  }

  // ============================================================================
  // Session Data Persistence
  // ============================================================================

  /**
   * Save session data after execution using MessageStore
   *
   * Converts ModelMessage to RichMessage and saves with parts.
   *
   * IMPORTANT: AI SDK's responseMessages only contain tool-call parts for assistant
   * messages. The actual text content comes from text-delta stream events and is
   * captured in displayTexts. We merge displayTexts into the first assistant message
   * that only has tool-calls (no text content).
   *
   * @param usage - Provider-reported token usage (stored on last assistant message for compaction decisions)
   */
  async saveSessionData(
    sessionId: string,
    previousMessages: ModelMessage[],
    userPrompt: string,
    responseMessages: ModelMessage[],
    workingContext: WorkingContext,
    logger: AgentLogger,
    displayTexts?: string[],
    usage?: { promptTokens?: number; completionTokens?: number }
  ): Promise<void> {
    try {
      // Convert and save user message as RichMessage
      const userRichMessage = modelMessageToRich(
        { role: 'user', content: userPrompt },
        sessionId
      );
      await this.deps.messageStore.saveRichMessage(userRichMessage);

      // Update session title if this is the first message
      if (previousMessages.length === 0) {
        await this.deps.sessionService.updateTitleFromContent(sessionId, userPrompt);
      }

      // Convert response messages to RichMessage format
      const richMessages = responseMessages.map(msg => modelMessageToRich(msg, sessionId));

      // Merge displayTexts into assistant messages that are missing text content
      // AI SDK only includes tool-calls in responseMessages, text comes from stream
      if (displayTexts && displayTexts.length > 0) {
        const combinedText = displayTexts.join('\n\n').trim();

        if (combinedText) {
          // Find first assistant message without text parts and add the display text
          let textMerged = false;
          for (const msg of richMessages) {
            if (msg.role === 'assistant') {
              const hasTextPart = msg.parts.some(p => p.type === 'text');
              if (!hasTextPart) {
                // Add text part at the beginning of the message
                const { randomUUID } = await import('crypto');
                msg.parts.unshift({
                  id: randomUUID(),
                  type: 'text',
                  text: combinedText,
                });
                logger.info('Merged streamed text into assistant message', {
                  messageId: msg.id,
                  textLength: combinedText.length,
                  toolCallCount: msg.parts.filter(p => p.type === 'tool-call').length,
                });
                textMerged = true;
                break;
              }
            }
          }

          // If no suitable assistant message found, create a new one with just the text
          // This handles edge case where LLM outputs text but no tool calls
          if (!textMerged) {
            const { randomUUID } = await import('crypto');
            const textOnlyMessage = {
              id: randomUUID(),
              sessionId,
              role: 'assistant' as const,
              parts: [{
                id: randomUUID(),
                type: 'text' as const,
                text: combinedText,
              }],
              createdAt: Date.now(),
              tokens: 0,
            };
            richMessages.push(textOnlyMessage);
            logger.info('Created text-only assistant message from streamed text', {
              messageId: textOnlyMessage.id,
              textLength: combinedText.length,
            });
          }
        }
      }

      // Save all response messages
      // Provider tokens go on the LAST assistant message (OpenCode pattern)
      // AI SDK uses inputTokens/outputTokens, not promptTokens/completionTokens
      const usageObj = usage as { inputTokens?: number; outputTokens?: number; promptTokens?: number; completionTokens?: number } | undefined;
      const inputTokens = usageObj?.inputTokens ?? usageObj?.promptTokens;
      const outputTokens = usageObj?.outputTokens ?? usageObj?.completionTokens;

      const providerTokens: ProviderTokens | undefined = inputTokens !== undefined && outputTokens !== undefined
        ? { input: inputTokens, output: outputTokens }
        : undefined;

      if (providerTokens) {
        logger.info('Provider tokens extracted from usage', { providerTokens });
      } else {
        logger.warn('No provider tokens in usage', { usage });
      }

      // Find the last assistant message index to attach provider tokens
      let lastAssistantIdx = -1;
      for (let i = richMessages.length - 1; i >= 0; i--) {
        if (richMessages[i].role === 'assistant') {
          lastAssistantIdx = i;
          break;
        }
      }

      // Save messages - provider tokens go on last assistant message
      await Promise.all(richMessages.map((msg, idx) => {
        const isLastAssistant = idx === lastAssistantIdx && providerTokens;
        return this.deps.messageStore.saveRichMessage(
          msg,
          isLastAssistant ? providerTokens : undefined
        );
      }));

      if (providerTokens && lastAssistantIdx >= 0) {
        logger.info('Saved provider tokens on assistant message', {
          messageId: richMessages[lastAssistantIdx].id,
          providerTokens,
        });
      }

      // Save working context and update session timestamp in parallel
      await Promise.all([
        this.deps.sessionService.saveWorkingContext(sessionId, workingContext),
        this.deps.sessionService.updateSession(sessionId, {}),
      ]);

      logger.info('Saved session data via MessageStore', {
        sessionId,
        messagesAdded: responseMessages.length + 1,
        partsCreated: responseMessages.reduce((sum, msg) => {
          if (Array.isArray(msg.content)) {
            return sum + msg.content.length;
          }
          return sum + 1;
        }, 1), // +1 for user message
      });
    } catch (error) {
      logger.error('Failed to save session data', {
        sessionId,
        error: (error as Error).message,
      });
    }
  }
}
