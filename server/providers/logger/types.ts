/**
 * Logger Provider Interface
 *
 * Abstraction for logging throughout the application.
 * Implementations can use console, Pino, Winston, or any logging backend.
 *
 * This enables:
 * - Structured logging in production
 * - Simple console logging in development
 * - Easy testing with mock/noop loggers
 */

// ============================================================================
// Log Levels
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ============================================================================
// Logger Provider Interface
// ============================================================================

/**
 * Logger provider interface
 *
 * Provides structured logging with support for metadata and child loggers.
 */
export interface LoggerProvider {
  /**
   * Log debug message (verbose, development only)
   */
  debug(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log info message (normal operations)
   */
  info(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log warning message (potential issues)
   */
  warn(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log error message (failures)
   */
  error(message: string, meta?: Record<string, unknown>): void;

  /**
   * Create a child logger with additional context bindings
   *
   * @example
   * ```typescript
   * const reqLogger = logger.child({ requestId: '123', traceId: 'abc' });
   * reqLogger.info('Processing request'); // Includes requestId and traceId
   * ```
   */
  child(bindings: Record<string, unknown>): LoggerProvider;
}

// ============================================================================
// Logger Options
// ============================================================================

/**
 * Options for logger creation
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  level?: LogLevel;
  /** Whether to output in JSON format */
  json?: boolean;
  /** Base context bindings */
  bindings?: Record<string, unknown>;
}
