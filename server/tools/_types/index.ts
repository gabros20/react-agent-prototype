/**
 * Tool Types - Barrel Export
 *
 * All types related to tool execution and results.
 */

// Context types
export {
  type AgentContext,
  type AgentLogger,
  type StreamWriter,
} from './agent-context';

// Generic result types
export {
  type ToolResult,
  type ToolSuccess,
  type ToolFailure,
  type ToolErrorCode,
  type ToolErrorDetails,
  toolSuccess,
  toolError,
  notFound,
  alreadyExists,
  validationError,
  permissionDenied,
  internalError,
  externalServiceError,
  timeoutError,
  isToolSuccess,
  isToolFailure,
  unwrapToolResult,
  mapToolResult,
  tryToolExecution,
} from './result';

// CMS-specific result types
export {
  type CMSToolResult,
  type CMSSuccess,
  type CMSFailure,
  cmsSuccess,
  cmsError,
  cmsNotFound,
  cmsAlreadyExists,
  cmsValidationError,
  isCMSSuccess,
  isCMSFailure,
} from './cms-result';
