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
 */

import type { WorkingContextState } from '../../memory';

// ============================================================================
// Message Types
// ============================================================================

/**
 * Stored message structure
 */
export interface StoredMessage {
  id: string;
  sessionId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: unknown; // JSON content (AI SDK format)
  displayContent?: string | null; // Plain text for UI
  toolName?: string | null;
  stepIdx?: number | null;
  createdAt: Date;
}

/**
 * New message input
 */
export interface NewMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: unknown;
  displayContent?: string;
  toolName?: string;
  stepIdx?: number;
}

/**
 * Model message format (for AI SDK)
 */
export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: unknown;
}

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
 * - Message persistence
 * - Working context storage
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

  // ============================================================================
  // Message Operations
  // ============================================================================

  /**
   * Add message to session
   */
  addMessage(sessionId: string, message: NewMessage): Promise<StoredMessage>;

  /**
   * Load messages for a session (as ModelMessage for AI SDK)
   */
  loadMessages(sessionId: string): Promise<ModelMessage[]>;

  /**
   * Save/replace all messages for a session
   */
  saveMessages(sessionId: string, messages: ModelMessage[]): Promise<void>;

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
