/**
 * Console Logger Provider
 *
 * Simple implementation of LoggerProvider using console.
 * Suitable for development and simple deployments.
 */

import type { LoggerProvider, LogLevel, LoggerOptions } from './types';

// ============================================================================
// Log Level Priority
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ============================================================================
// Console Logger Provider
// ============================================================================

export class ConsoleLoggerProvider implements LoggerProvider {
  private readonly level: LogLevel;
  private readonly json: boolean;
  private readonly bindings: Record<string, unknown>;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.json = options.json ?? false;
    this.bindings = options.bindings ?? {};
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  child(bindings: Record<string, unknown>): LoggerProvider {
    return new ConsoleLoggerProvider({
      level: this.level,
      json: this.json,
      bindings: { ...this.bindings, ...bindings },
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    // Check log level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const combinedMeta = { ...this.bindings, ...meta };

    if (this.json) {
      // JSON format for production/structured logging
      const logEntry = {
        timestamp,
        level,
        message,
        ...combinedMeta,
      };
      this.output(level, JSON.stringify(logEntry));
    } else {
      // Human-readable format for development
      const metaStr = Object.keys(combinedMeta).length > 0
        ? ` ${JSON.stringify(combinedMeta)}`
        : '';
      this.output(level, `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`);
    }
  }

  private output(level: LogLevel, message: string): void {
    switch (level) {
      case 'debug':
        console.debug(message);
        break;
      case 'info':
        console.log(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'error':
        console.error(message);
        break;
    }
  }
}

// ============================================================================
// Noop Logger (for testing)
// ============================================================================

/**
 * No-operation logger that discards all logs.
 * Useful for testing or suppressing logs in specific contexts.
 */
export class NoopLoggerProvider implements LoggerProvider {
  debug(): void { /* noop */ }
  info(): void { /* noop */ }
  warn(): void { /* noop */ }
  error(): void { /* noop */ }
  child(): LoggerProvider {
    return this;
  }
}
