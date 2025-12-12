/**
 * Providers - Barrel Export
 *
 * Pluggable provider abstractions for:
 * - Memory (session metadata, working context)
 * - Logger (structured logging)
 *
 * Note: Message content is handled by MessageStore, not MemoryProvider.
 */

// Memory provider
export {
  type MemoryProvider,
  type Session,
  type SessionWithMetadata,
  type CreateSessionInput,
  type UpdateSessionInput,
  type MemoryProviderConfig,
  SQLiteMemoryProvider,
  createMemoryProvider,
} from './memory';

// Logger provider
export {
  type LoggerProvider,
  type LogLevel,
  type LoggerOptions,
  ConsoleLoggerProvider,
  NoopLoggerProvider,
  createLoggerProvider,
} from './logger';
