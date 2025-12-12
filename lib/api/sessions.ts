/**
 * Sessions API - CRUD operations for chat sessions
 */

import { api, parseDates } from "./client";

// ============================================================================
// Types
// ============================================================================

export interface SessionMetadata {
  id: string;
  title: string;
  modelId: string | null;
  messageCount: number;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  title: string;
  modelId: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

/**
 * Message part types (from MessageStore/RichMessage pattern)
 */
export interface MessagePart {
  id: string;
  type: "text" | "tool-call" | "tool-result" | "compaction-marker";
  // Text part
  text?: string;
  // Tool call part
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  // Tool result part
  output?: unknown;
  isError?: boolean;
  compactedAt?: number | null;
}

/**
 * Rich message structure (aligned with backend MessageStore)
 *
 * Messages from MessageStore have `parts` array.
 * Messages reconstructed from trace logs may only have `content`.
 */
export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  /** Parts array from MessageStore (present for DB messages) */
  parts?: MessagePart[];
  /** Content field - derived from parts or raw content for trace-reconstructed messages */
  content?: unknown;
  /** Total tokens for this message */
  tokens?: number;
  createdAt: Date;
}

export interface CreateSessionInput {
  title?: string;
}

export interface UpdateSessionInput {
  title?: string;
  archived?: boolean;
  modelId?: string;
}

export interface ConversationLogInput {
  userPrompt: string;
  entries: unknown[];
  metrics: {
    totalDuration: number;
    toolCallCount: number;
    stepCount: number;
    tokens: { input: number; output: number };
    cost: number;
    errorCount: number;
  };
  modelInfo?: {
    modelId: string;
    pricing: { prompt: number; completion: number } | null;
  };
  startedAt: string;
  completedAt?: string;
}

interface RawSessionMetadata {
  id: string;
  title: string;
  modelId: string | null;
  messageCount: number;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

interface RawMessagePart {
  id: string;
  type: "text" | "tool-call" | "tool-result" | "compaction-marker";
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  output?: unknown;
  isError?: boolean;
  compactedAt?: number | null;
}

interface RawSession {
  id: string;
  title: string;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    sessionId: string;
    role: "user" | "assistant" | "system" | "tool";
    parts: RawMessagePart[];
    tokens?: number;
    createdAt: number; // Unix timestamp from backend
  }>;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * List all sessions with metadata
 */
export async function list(): Promise<SessionMetadata[]> {
  const sessions = await api.get<RawSessionMetadata[]>("/api/sessions");

  return sessions.map((session) => ({
    ...session,
    modelId: session.modelId || null,
    lastActivity: new Date(session.lastActivity),
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
  }));
}

/**
 * Helper: Derive display content from message parts
 */
function deriveContentFromParts(parts: RawMessagePart[]): unknown {
  // For single text part, return the text directly
  if (parts.length === 1 && parts[0].type === "text") {
    return parts[0].text || "";
  }
  // For multiple parts, return the parts array (UI can handle this)
  return parts;
}

/**
 * Get single session with messages
 */
export async function get(sessionId: string): Promise<Session> {
  const session = await api.get<RawSession>(`/api/sessions/${sessionId}`);

  return {
    ...session,
    modelId: session.modelId || null,
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
    messages: session.messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      parts: msg.parts,
      content: deriveContentFromParts(msg.parts),
      tokens: msg.tokens,
      createdAt: new Date(msg.createdAt),
    })),
  };
}

/**
 * Create a new session
 */
export async function create(input?: CreateSessionInput): Promise<SessionMetadata> {
  const session = await api.post<RawSessionMetadata>("/api/sessions", input);

  return {
    ...session,
    modelId: session.modelId || null,
    messageCount: 0,
    lastActivity: new Date(session.updatedAt),
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
  };
}

/**
 * Update session (title, modelId, archived)
 */
export async function update(
  sessionId: string,
  input: UpdateSessionInput
): Promise<SessionMetadata> {
  const session = await api.patch<RawSessionMetadata>(
    `/api/sessions/${sessionId}`,
    input
  );

  return {
    ...session,
    modelId: session.modelId || null,
    lastActivity: new Date(session.updatedAt),
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
  };
}

/**
 * Delete session permanently
 */
export async function remove(sessionId: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/api/sessions/${sessionId}`);
}

/**
 * Clear all messages (keep session)
 */
export async function clearMessages(
  sessionId: string
): Promise<{ cleared: number }> {
  return api.delete<{ cleared: number }>(`/api/sessions/${sessionId}/messages`);
}

/**
 * Get conversation logs for a session
 */
export async function getLogs(sessionId: string): Promise<unknown[]> {
  return api.get<unknown[]>(`/api/sessions/${sessionId}/logs`);
}

/**
 * Save a conversation log
 */
export async function saveLog(
  sessionId: string,
  log: ConversationLogInput
): Promise<unknown> {
  return api.post<unknown>(`/api/sessions/${sessionId}/logs`, log);
}

/**
 * Delete all conversation logs for a session
 */
export async function deleteLogs(sessionId: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/api/sessions/${sessionId}/logs`);
}

// ============================================================================
// Context & Compaction
// ============================================================================

/**
 * Context statistics response type
 */
export interface ContextStats {
  modelId: string;
  currentTokens: number;
  availableTokens: number;
  contextLimit: number;
  outputReserve: number;
  usagePercent: number;
  messageCount: number;
  compactedResults: number;
  isApproachingLimit: boolean;
  isOverLimit: boolean;
}

/**
 * Compaction result response type
 */
export interface CompactionResult {
  compacted: boolean;
  reason?: string;
  wasPruned?: boolean;
  wasCompacted?: boolean;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved?: number;
  compressionRatio?: number;
  prunedOutputs?: number;
  compactedMessages?: number;
  removedTools?: string[];
  messageCountBefore?: number;
  messageCountAfter?: number;
}

/**
 * Get context usage statistics for a session
 */
export async function getContextStats(
  sessionId: string,
  modelId?: string
): Promise<ContextStats> {
  const query = modelId ? `?modelId=${encodeURIComponent(modelId)}` : "";
  return api.get<ContextStats>(`/api/sessions/${sessionId}/context-stats${query}`);
}

/**
 * Manually trigger context compaction
 */
export async function compactContext(
  sessionId: string,
  options?: { modelId?: string; force?: boolean }
): Promise<CompactionResult> {
  return api.post<CompactionResult>(`/api/sessions/${sessionId}/compact`, options || {});
}

/**
 * Working memory entity type
 */
export interface WorkingMemoryEntity {
  type: string;
  id: string;
  name: string;
  timestamp: string | Date;
}

/**
 * Tool usage record type
 */
export interface ToolUsageRecord {
  name: string;
  count: number;
  lastUsed: string;
  lastResult: "success" | "error";
}

/**
 * Working memory response type
 */
export interface WorkingMemoryResponse {
  entities: WorkingMemoryEntity[];
  discoveredTools: string[];
  usedTools: ToolUsageRecord[];
  size: number;
  discoveredToolsCount: number;
}

/**
 * Get working memory entities for a session
 */
export async function getWorkingMemory(
  sessionId: string
): Promise<WorkingMemoryResponse> {
  return api.get<WorkingMemoryResponse>(
    `/api/sessions/${sessionId}/working-memory`
  );
}

// Export as namespace for cleaner imports
export const sessionsApi = {
  list,
  get,
  create,
  update,
  remove,
  clearMessages,
  getLogs,
  saveLog,
  deleteLogs,
  getWorkingMemory,
  getContextStats,
  compactContext,
};
