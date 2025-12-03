/**
 * API Client Layer
 *
 * Centralized API client for all frontend HTTP calls.
 * Replaces scattered fetch() calls in stores and hooks.
 *
 * Usage:
 * ```ts
 * import { sessionsApi, modelsApi, agentApi } from '@/lib/api';
 *
 * const sessions = await sessionsApi.list();
 * const models = await modelsApi.list();
 * for await (const event of await agentApi.stream({ prompt: 'Hello' })) {
 *   console.log(event);
 * }
 * ```
 */

// Client utilities
export { api, ApiClientError, parseDates } from "./client";
export type { ApiResponse, ApiError, ResponseMeta } from "./client";

// Sessions API
export { sessionsApi } from "./sessions";
export type {
  SessionMetadata,
  Session,
  Message,
  CreateSessionInput,
  UpdateSessionInput,
  ConversationLogInput,
} from "./sessions";

// Models API
export { modelsApi } from "./models";
export type { Model } from "./models";

// Agent API
export { agentApi } from "./agent";
export type { AgentStreamOptions, SSEEvent } from "./agent";
