/**
 * Context Coordinator
 *
 * Handles context lifecycle:
 * - Session management
 * - Working context loading/saving
 * - Message loading and trimming
 * - CMS target resolution
 *
 * Extracted from orchestrator.ts for single responsibility.
 */

import { randomUUID } from 'crypto';
import type { ModelMessage } from 'ai';
import { WorkingContext, ContextManager } from '../memory';
import { getSiteAndEnv } from '../utils/get-context';
import type { AgentLogger } from '../tools/types';
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

export class ContextCoordinator {
  private readonly deps: OrchestratorDependencies;
  private readonly contextManager: ContextManager;

  constructor(deps: OrchestratorDependencies) {
    this.deps = deps;
    this.contextManager = new ContextManager({ maxMessages: 30, minTurnsToKeep: 2 });
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
   * - Trims context if needed
   */
  async prepareContext(
    options: ResolvedExecuteOptions,
    logger: AgentLogger
  ): Promise<{ context: PreparedContext; workingContext: WorkingContext }> {
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

    // Trim context if needed
    const trimResult = this.contextManager.trimContext(messages, workingContext);

    return {
      context: {
        messages: trimResult.messages,
        workingMemoryString: workingContext.toContextString(),
        discoveredTools: workingContext.getDiscoveredTools(),
        previousMessages,
        trimInfo: {
          messagesRemoved: trimResult.messagesRemoved,
          turnsRemoved: trimResult.turnsRemoved,
          invalidTurnsRemoved: trimResult.invalidTurnsRemoved,
          removedTools: trimResult.removedTools,
          activeTools: trimResult.activeTools,
        },
      },
      workingContext,
    };
  }

  /**
   * Load previous messages for a session
   */
  private async loadPreviousMessages(
    sessionId: string | undefined,
    logger: AgentLogger
  ): Promise<ModelMessage[]> {
    if (!sessionId) return [];

    try {
      const messages = await this.deps.sessionService.loadMessages(sessionId);
      logger.info('Loaded session history', {
        sessionId,
        messageCount: messages.length,
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
   * Save session data after execution
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
      // Save user message
      await this.deps.sessionService.addMessage(sessionId, {
        role: 'user',
        content: userPrompt,
        displayContent: userPrompt,
      });

      // Save response messages (assistant + tool messages)
      for (let i = 0; i < responseMessages.length; i++) {
        const msg = responseMessages[i];
        let msgDisplayContent: string | undefined;

        // Only include display content for the LAST assistant message (the final answer)
        if (msg.role === 'assistant' && i === responseMessages.length - 1) {
          msgDisplayContent = displayContent;
        }

        await this.deps.sessionService.addMessage(sessionId, {
          role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
          content: msg.content,
          displayContent: msgDisplayContent,
          stepIdx: Math.floor(i / 2), // Approximate step index
        });
      }

      // Save working context
      await this.deps.sessionService.saveWorkingContext(sessionId, workingContext);

      logger.info('Saved session data', {
        sessionId,
        messagesAdded: responseMessages.length + 1,
      });
    } catch (error) {
      logger.error('Failed to save session data', {
        sessionId,
        error: (error as Error).message,
      });
    }
  }
}
