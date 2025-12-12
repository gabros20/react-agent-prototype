/**
 * Memory Provider Interface
 *
 * Abstraction for session memory storage.
 * Implementations can use SQLite, Redis, or any other storage backend.
 *
 * This enables:
 * - Easy testing with mock providers
 * - Production scaling with Redis
 * - Development simplicity with SQLite
 *
 * NOTE: Message content storage is now handled by MessageStore.
 * This provider handles session metadata and working context only.
 */

import type { WorkingContextState } from '../../memory';

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session metadata
 */
export interface Session {
  id: string;
  title: string;
  modelId?: string | null;
  archived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session with message count and activity
 */
export interface SessionWithMetadata extends Session {
  messageCount: number;
  lastActivity: Date;
}

/**
 * Session creation input
 */
export interface CreateSessionInput {
  id?: string;
  title?: string;
  modelId?: string;
}

/**
 * Session update input
 */
export interface UpdateSessionInput {
  title?: string;
  archived?: boolean;
  modelId?: string;
}

// ============================================================================
// Memory Provider Interface
// ============================================================================

/**
 * Memory provider interface
 *
 * Responsible for:
 * - Session CRUD operations
 * - Working context storage
 *
 * Note: Message content is handled by MessageStore, not this provider.
 */
export interface MemoryProvider {
  // ============================================================================
  // Session Operations
  // ============================================================================

  /**
   * Create a new session
   */
  createSession(input?: CreateSessionInput): Promise<Session>;

  /**
   * Ensure session exists (create if not exists)
   */
  ensureSession(sessionId: string): Promise<void>;

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Promise<Session | null>;

  /**
   * List all sessions with metadata
   */
  listSessions(): Promise<SessionWithMetadata[]>;

  /**
   * Update session
   */
  updateSession(sessionId: string, input: UpdateSessionInput): Promise<Session>;

  /**
   * Delete session and all related data
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * Clear all messages from session (keep session)
   */
  clearMessages(sessionId: string): Promise<void>;

  // ============================================================================
  // Working Context Operations
  // ============================================================================

  /**
   * Load working context for a session
   */
  loadWorkingContext(sessionId: string): Promise<WorkingContextState | null>;

  /**
   * Save working context for a session
   */
  saveWorkingContext(sessionId: string, context: WorkingContextState): Promise<void>;
}
