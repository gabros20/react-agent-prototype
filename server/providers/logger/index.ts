/**
 * Logger Provider - Barrel Export
 *
 * Provides pluggable logging backends.
 */

// Types
export type { LoggerProvider, LogLevel, LoggerOptions } from './types';

// Implementations
export { ConsoleLoggerProvider, NoopLoggerProvider } from './console-provider';

// Factory
import type { LoggerProvider, LoggerOptions } from './types';
import { ConsoleLoggerProvider } from './console-provider';

/**
 * Create a logger provider
 *
 * @example
 * ```typescript
 * // Development
 * const logger = createLoggerProvider({ level: 'debug' });
 *
 * // Production (JSON output)
 * const logger = createLoggerProvider({ level: 'info', json: true });
 *
 * // With context
 * const reqLogger = logger.child({ requestId: '123' });
 * ```
 */
export function createLoggerProvider(options: LoggerOptions = {}): LoggerProvider {
  // Future: Could auto-detect and use Pino/Winston if available
  return new ConsoleLoggerProvider(options);
}
