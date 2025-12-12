/**
 * Result Type - Rust-inspired Result for explicit error handling
 *
 * Use this for operations that can fail in expected ways.
 * Prefer throwing for unexpected/unrecoverable errors.
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return Err('Division by zero');
 *   return Ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.ok) {
 *   console.log(result.value); // 5
 * } else {
 *   console.error(result.error); // never reached
 * }
 * ```
 */

// ============================================================================
// Result Type
// ============================================================================

export type Result<T, E = Error> = OkResult<T> | ErrResult<E>;

export interface OkResult<T> {
  readonly ok: true;
  readonly value: T;
}

export interface ErrResult<E> {
  readonly ok: false;
  readonly error: E;
}

// ============================================================================
// Constructors
// ============================================================================

/**
 * Create a successful result
 */
export function Ok<T>(value: T): OkResult<T> {
  return { ok: true, value };
}

/**
 * Create an error result
 */
export function Err<E>(error: E): ErrResult<E> {
  return { ok: false, error };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result.ok;
}

/**
 * Check if result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return !result.ok;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Unwrap a result, throwing if it's an error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error instanceof Error ? result.error : new Error(String(result.error));
}

/**
 * Unwrap a result with a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * Map a successful result
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) return Ok(fn(result.value));
  return result;
}

/**
 * Map an error result
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (!result.ok) return Err(fn(result.error));
  return result;
}

/**
 * Try to execute a function, returning a Result
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    return Ok(fn());
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Try to execute an async function, returning a Result
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    return Ok(await fn());
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}
