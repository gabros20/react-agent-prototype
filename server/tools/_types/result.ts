/**
 * Tool Result Types
 *
 * Standardized result types for all tool executions.
 * Provides consistent success/error handling across all tools.
 *
 * @example
 * ```typescript
 * async function execute(input): Promise<ToolResult<Page>> {
 *   const page = await pageService.getById(input.id);
 *   if (!page) return notFound('Page', input.id);
 *   return toolSuccess(page);
 * }
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Successful tool result
 */
export interface ToolSuccess<T> {
  readonly success: true;
  readonly data: T;
}

/**
 * Error details for tool failures
 */
export interface ToolErrorDetails {
  /** Error code for programmatic handling */
  readonly code: ToolErrorCode;
  /** Human-readable error message */
  readonly message: string;
  /** Additional context (optional) */
  readonly details?: unknown;
}

/**
 * Failed tool result
 */
export interface ToolFailure {
  readonly success: false;
  readonly error: ToolErrorDetails;
}

/**
 * Union type for tool results
 */
export type ToolResult<T> = ToolSuccess<T> | ToolFailure;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Standard error codes for tool failures
 */
export type ToolErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED';

// ============================================================================
// Constructors
// ============================================================================

/**
 * Create a successful tool result
 */
export function toolSuccess<T>(data: T): ToolSuccess<T> {
  return { success: true, data };
}

/**
 * Create a failed tool result
 */
export function toolError(
  code: ToolErrorCode,
  message: string,
  details?: unknown
): ToolFailure {
  return {
    success: false,
    error: { code, message, details },
  };
}

// ============================================================================
// Common Error Helpers
// ============================================================================

/**
 * Entity not found error
 */
export function notFound(entity: string, identifier: string): ToolFailure {
  return toolError('NOT_FOUND', `${entity} "${identifier}" not found`);
}

/**
 * Entity already exists error
 */
export function alreadyExists(entity: string, identifier: string): ToolFailure {
  return toolError('ALREADY_EXISTS', `${entity} "${identifier}" already exists`);
}

/**
 * Validation error
 */
export function validationError(message: string, details?: unknown): ToolFailure {
  return toolError('VALIDATION_ERROR', message, details);
}

/**
 * Permission denied error
 */
export function permissionDenied(action: string, resource?: string): ToolFailure {
  const message = resource
    ? `Permission denied: cannot ${action} ${resource}`
    : `Permission denied: ${action}`;
  return toolError('PERMISSION_DENIED', message);
}

/**
 * Internal error (unexpected failures)
 */
export function internalError(message: string, details?: unknown): ToolFailure {
  return toolError('INTERNAL_ERROR', message, details);
}

/**
 * External service error
 */
export function externalServiceError(
  service: string,
  message: string,
  details?: unknown
): ToolFailure {
  return toolError('EXTERNAL_SERVICE_ERROR', `${service}: ${message}`, details);
}

/**
 * Timeout error
 */
export function timeoutError(operation: string, timeoutMs: number): ToolFailure {
  return toolError('TIMEOUT', `${operation} timed out after ${timeoutMs}ms`);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if result is successful
 */
export function isToolSuccess<T>(result: ToolResult<T>): result is ToolSuccess<T> {
  return result.success;
}

/**
 * Check if result is a failure
 */
export function isToolFailure<T>(result: ToolResult<T>): result is ToolFailure {
  return !result.success;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Unwrap a tool result, throwing if it's an error
 */
export function unwrapToolResult<T>(result: ToolResult<T>): T {
  if (result.success) return result.data;
  throw new Error(`Tool error [${result.error.code}]: ${result.error.message}`);
}

/**
 * Map a successful tool result
 */
export function mapToolResult<T, U>(
  result: ToolResult<T>,
  fn: (data: T) => U
): ToolResult<U> {
  if (result.success) return toolSuccess(fn(result.data));
  return result;
}

/**
 * Try to execute a function, returning a ToolResult
 */
export async function tryToolExecution<T>(
  fn: () => Promise<T>,
  errorMessage = 'Operation failed'
): Promise<ToolResult<T>> {
  try {
    const data = await fn();
    return toolSuccess(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : errorMessage;
    return internalError(message, error);
  }
}
