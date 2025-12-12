/**
 * Context Coordinator
 *
 * Handles context lifecycle:
 * - Session management
 * - Working context loading/saving
 * - Message loading and compaction
 * - CMS target resolution
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
} from '../memory';
import { getModelLimits } from '../memory/compaction/token-service';
import { getSiteAndEnv } from '../utils/get-context';
import type { AgentLogger } from '../tools/types';
import type { SSEEventEmitter } from '../events';
import type {
  ExecuteOptions,
  ResolvedExecuteOptions,
  OrchestratorDependencies,
  PreparedContext,
} from './types';
import { AGENT_CONFIG } from '../agents/main-agent';

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

    // Build messages array with current prompt
    const messages: ModelMessage[] = [
      ...previousMessages,
      { role: 'user', content: options.prompt },
    ];

    // If compaction disabled, return full history (no trimming, no compaction)
    if (!ENABLE_COMPACTION) {
      logger.info('Compaction disabled, using full history', {
        messageCount: messages.length,
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

    // Get model limits for compaction start event
    const modelLimits = getModelLimits(options.modelId);

    // Emit compaction start event
    if (emitter) {
      const estimatedTokens = messages.length * 500; // Rough estimate before actual count
      emitter.emitCompactionStart(estimatedTokens, modelLimits.contextLimit);
    }

    // Compaction enabled - prepare context with pruning and summarization
    const { messages: preparedMessages, result } = await prepareContextForLLM(
      messages,
      {
        sessionId: options.sessionId,
        modelId: options.modelId,
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
   * Converts ModelMessage to RichMessage and saves with parts
   */
  async saveSessionData(
    sessionId: string,
    previousMessages: ModelMessage[],
    userPrompt: string,
    responseMessages: ModelMessage[],
    workingContext: WorkingContext,
    logger: AgentLogger,
    displayContent?: string
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

      // Convert and save response messages (assistant + tool messages)
      for (const msg of responseMessages) {
        // Convert ModelMessage to RichMessage with parts
        const richMessage = modelMessageToRich(msg, sessionId);
        await this.deps.messageStore.saveRichMessage(richMessage);
      }

      // Save working context (still via SessionService - it handles session metadata)
      await this.deps.sessionService.saveWorkingContext(sessionId, workingContext);

      // Update session timestamp
      await this.deps.sessionService.updateSession(sessionId, {});

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
