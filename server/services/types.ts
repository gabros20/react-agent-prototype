/**
 * Service Types
 *
 * Interfaces for the service layer.
 * These define the contracts that services must implement.
 */

import type { DrizzleDB } from '../db/client';
import type { MemoryProvider, LoggerProvider } from '../providers';
import type { VectorIndexService } from './vector-index';
import type { ToolSearchService } from './search';
import type { PageService } from './cms/page-service';
import type { SectionService } from './cms/section-service';
import type { EntryService } from './cms/entry-service';
import type { ImageService } from './cms/image-service';
import type { SiteSettingsService } from './cms/site-settings-service';
import type { ConversationLogService } from './conversation-log-service';
import type { SessionService } from './session-service';
import type { AgentOrchestrator } from '../execution';

// ============================================================================
// Services Interface
// ============================================================================

/**
 * All application services
 *
 * This interface defines the complete set of services available.
 * Services are created via `createServices()` factory.
 */
export interface Services {
  // Database
  readonly db: DrizzleDB;

  // Providers (pluggable backends)
  readonly memory: MemoryProvider;
  readonly logger: LoggerProvider;

  // Infrastructure
  readonly vectorIndex: VectorIndexService;
  readonly toolSearch: ToolSearchService;

  // CMS Services
  readonly pageService: PageService;
  readonly sectionService: SectionService;
  readonly entryService: EntryService;
  readonly imageService: ImageService;
  readonly siteSettingsService: SiteSettingsService;

  // Session Services
  readonly conversationLogService: ConversationLogService;
  readonly sessionService: SessionService;

  // Agent Orchestrator (created lazily to avoid circular deps)
  readonly agentOrchestrator: AgentOrchestrator;

  // Cleanup method
  dispose(): Promise<void>;
}

// ============================================================================
// Service Creation Options
// ============================================================================

/**
 * Options for creating services
 */
export interface CreateServicesOptions {
  /** Database instance (required) */
  db: DrizzleDB;

  /** Memory provider (optional - defaults to SQLite) */
  memory?: MemoryProvider;

  /** Logger provider (optional - defaults to console) */
  logger?: LoggerProvider;

  /** LanceDB directory (optional - defaults to data/lancedb) */
  lanceDbDir?: string;
}
