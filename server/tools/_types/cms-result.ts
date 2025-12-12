/**
 * CMS Tool Result Types
 *
 * Domain-specific result types for CMS operations.
 * These extend the base ToolResult pattern with CMS-specific fields.
 *
 * @example
 * ```typescript
 * // Success with items
 * return cmsSuccess([page1, page2]);
 *
 * // Success with single item
 * return cmsSuccess([page]);
 *
 * // Error
 * return cmsError('NOT_FOUND', 'Page "home" not found');
 * ```
 */

import type { ToolErrorCode } from './result';

// ============================================================================
// Types
// ============================================================================

/**
 * Successful CMS operation result
 */
export interface CMSSuccess<T> {
  readonly success: true;
  readonly count: number;
  readonly items: T[];
}

/**
 * Failed CMS operation result
 */
export interface CMSFailure {
  readonly success: false;
  readonly count: 0;
  readonly items: [];
  readonly error: string;
  /** Optional error code for programmatic handling */
  readonly code?: ToolErrorCode;
}

/**
 * Union type for CMS tool results
 */
export type CMSToolResult<T> = CMSSuccess<T> | CMSFailure;

// ============================================================================
// Constructors
// ============================================================================

/**
 * Create a successful CMS result
 */
export function cmsSuccess<T>(items: T[]): CMSSuccess<T> {
  return {
    success: true,
    count: items.length,
    items,
  };
}

/**
 * Create a failed CMS result
 */
export function cmsError(code: ToolErrorCode, message: string): CMSFailure {
  return {
    success: false,
    count: 0,
    items: [],
    error: message,
    code,
  };
}

// ============================================================================
// Common CMS Error Helpers
// ============================================================================

/**
 * Entity not found error
 */
export function cmsNotFound(entity: string, identifier: string): CMSFailure {
  return cmsError('NOT_FOUND', `${entity} not found: ${identifier}`);
}

/**
 * Entity already exists error
 */
export function cmsAlreadyExists(entity: string, identifier: string): CMSFailure {
  return cmsError('ALREADY_EXISTS', `${entity} already exists: ${identifier}`);
}

/**
 * Validation error
 */
export function cmsValidationError(message: string): CMSFailure {
  return cmsError('VALIDATION_ERROR', message);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if result is successful
 */
export function isCMSSuccess<T>(result: CMSToolResult<T>): result is CMSSuccess<T> {
  return result.success;
}

/**
 * Check if result is a failure
 */
export function isCMSFailure<T>(result: CMSToolResult<T>): result is CMSFailure {
  return !result.success;
}
