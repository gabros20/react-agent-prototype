/**
 * Service Factory
 *
 * Creates all application services with proper dependency injection.
 * This replaces the ServiceContainer singleton pattern.
 *
 * @example
 * ```typescript
 * // Standard usage
 * const services = await createServices({ db });
 *
 * // With custom providers
 * const services = await createServices({
 *   db,
 *   memory: new RedisMemoryProvider(redisUrl),
 *   logger: createPinoLogger(),
 * });
 * ```
 */

import type { Services, CreateServicesOptions } from './types';
import {
  createMemoryProvider,
  createLoggerProvider,
  type MemoryProvider,
  type LoggerProvider,
} from '../providers';
import { VectorIndexService } from './vector-index';
import { ToolSearchService } from './search';
import { PageService } from './cms/page-service';
import { SectionService } from './cms/section-service';
import { EntryService } from './cms/entry-service';
import { ImageService } from './cms/image-service';
import { SiteSettingsService } from './cms/site-settings-service';
import { ConversationLogService } from './conversation-log-service';
import { SessionService } from './session-service';
import { createMessageStore } from './message-store';
import { AgentOrchestrator } from '../execution';

// ============================================================================
// Service Factory
// ============================================================================

/**
 * Create all application services
 *
 * This is the main entry point for service creation.
 * All dependencies are injected explicitly - no global state.
 */
export async function createServices(options: CreateServicesOptions): Promise<Services> {
  const { db } = options;

  // Create or use provided logger
  const logger: LoggerProvider = options.logger ?? createLoggerProvider({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    json: process.env.NODE_ENV === 'production',
  });

  logger.info('Creating services...');
  const startTime = Date.now();

  // Create or use provided memory provider
  const memory: MemoryProvider = options.memory ?? createMemoryProvider({ db });

  // Initialize vector index
  const lanceDbDir = options.lanceDbDir ?? process.env.LANCEDB_DIR ?? 'data/lancedb';
  const vectorIndex = new VectorIndexService(lanceDbDir);
  await vectorIndex.initialize();
  logger.info('Vector index initialized', { dir: lanceDbDir });

  // Initialize tool search
  const toolSearch = new ToolSearchService();
  await toolSearch.initialize();
  logger.info('Tool search initialized');

  // Create CMS services
  const pageService = new PageService(db, vectorIndex);
  const sectionService = new SectionService(db, vectorIndex);
  const entryService = new EntryService(db, vectorIndex);
  const imageService = new ImageService(db, vectorIndex);
  const siteSettingsService = new SiteSettingsService(db);

  // Create session services
  const conversationLogService = new ConversationLogService(db);
  const sessionService = new SessionService(db);
  const messageStore = createMessageStore(db);
  logger.info('Message store initialized');

  // Build services object (will be completed with agentOrchestrator)
  const servicesBase = {
    db,
    memory,
    logger,
    vectorIndex,
    toolSearch,
    pageService,
    sectionService,
    entryService,
    imageService,
    siteSettingsService,
    conversationLogService,
    sessionService,
    messageStore,
  };

  // Create orchestrator with services reference
  const agentOrchestrator = new AgentOrchestrator({
    db,
    services: servicesBase as Services, // Cast needed due to circular reference (orchestrator is part of services)
    sessionService,
    messageStore,
    vectorIndex,
  });

  const duration = Date.now() - startTime;
  logger.info('Services created', { durationMs: duration });

  // Create dispose function
  const dispose = async (): Promise<void> => {
    logger.info('Disposing services...');
    await vectorIndex.close();
    logger.info('Services disposed');
  };

  return {
    ...servicesBase,
    agentOrchestrator,
    dispose,
  };
}

