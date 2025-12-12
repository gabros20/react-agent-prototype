/**
 * Memory Provider - Barrel Export
 *
 * Provides pluggable memory storage backends for session metadata
 * and working context. Message content is handled by MessageStore.
 */

// Types
export type {
  MemoryProvider,
  Session,
  SessionWithMetadata,
  CreateSessionInput,
  UpdateSessionInput,
} from './types';

// Implementations
export { SQLiteMemoryProvider } from './sqlite-provider';

// Factory
import type { DrizzleDB } from '../../db/client';
import type { MemoryProvider } from './types';
import { SQLiteMemoryProvider } from './sqlite-provider';

export interface MemoryProviderConfig {
  /** SQLite database instance */
  db?: DrizzleDB;
  /** Redis URL (future implementation) */
  redisUrl?: string;
}

/**
 * Create a memory provider based on configuration
 *
 * Currently supports SQLite only. Redis support planned for production scaling.
 *
 * @example
 * ```typescript
 * // Development (SQLite)
 * const memory = createMemoryProvider({ db });
 *
 * // Production (Redis - future)
 * const memory = createMemoryProvider({ redisUrl: process.env.REDIS_URL });
 * ```
 */
export function createMemoryProvider(config: MemoryProviderConfig): MemoryProvider {
  // Future: Check for Redis configuration
  // if (config.redisUrl) {
  //   return new RedisMemoryProvider(config.redisUrl);
  // }

  if (!config.db) {
    throw new Error('Memory provider requires db instance');
  }

  return new SQLiteMemoryProvider(config.db);
}
