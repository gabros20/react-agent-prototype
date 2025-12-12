/**
 * Server Types - Barrel Export
 *
 * Central export for all shared server types.
 */

// Result types (Rust-inspired)
export {
  type Result,
  type OkResult,
  type ErrResult,
  Ok,
  Err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  mapResult,
  mapError,
  tryCatch,
  tryCatchAsync,
} from './result';

// Context types
export {
  type RequestContext,
  type SessionContext,
  type CMSTarget,
  type CMSContext,
  createRequestContext,
  createSessionContext,
  createCMSContext,
} from './context';

// Re-export existing types for convenience
export type { ApiResponse, ApiError, ResponseMeta, PaginationMeta } from './api-response';
export { ApiResponse as ApiResponseHelper, ErrorCodes, HttpStatus } from './api-response';
