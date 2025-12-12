/**
 * Request Context Types
 *
 * Context objects that flow through the request lifecycle.
 * These provide request-scoped data without global state.
 */

// ============================================================================
// Request Context
// ============================================================================

/**
 * Base context available for all requests
 */
export interface RequestContext {
  /** Unique identifier for this request */
  readonly requestId: string;

  /** Trace ID for distributed tracing/logging */
  readonly traceId: string;

  /** When the request started */
  readonly startedAt: Date;
}

/**
 * Create a new request context
 */
export function createRequestContext(
  traceId: string,
  requestId?: string
): RequestContext {
  return {
    requestId: requestId ?? crypto.randomUUID(),
    traceId,
    startedAt: new Date(),
  };
}

// ============================================================================
// Session Context
// ============================================================================

/**
 * Context for requests associated with a session
 */
export interface SessionContext extends RequestContext {
  /** Session identifier */
  readonly sessionId: string;
}

/**
 * Create a session context
 */
export function createSessionContext(
  sessionId: string,
  traceId: string,
  requestId?: string
): SessionContext {
  return {
    ...createRequestContext(traceId, requestId),
    sessionId,
  };
}

// ============================================================================
// CMS Context
// ============================================================================

/**
 * CMS target for multi-tenant operations
 */
export interface CMSTarget {
  readonly siteId: string;
  readonly environmentId: string;
}

/**
 * Context for CMS operations
 */
export interface CMSContext extends SessionContext {
  readonly cmsTarget: CMSTarget;
}

/**
 * Create a CMS context
 */
export function createCMSContext(
  sessionId: string,
  traceId: string,
  cmsTarget: CMSTarget,
  requestId?: string
): CMSContext {
  return {
    ...createSessionContext(sessionId, traceId, requestId),
    cmsTarget,
  };
}
