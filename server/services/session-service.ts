import { randomUUID } from "node:crypto";
import { count, desc, eq } from "drizzle-orm";
import type { DrizzleDB } from "../db/client";
import * as schema from "../db/schema";
import { WorkingContext, type WorkingContextState } from "../memory";

// ============================================================================
// Types
// ============================================================================

export interface CreateSessionInput {
  title?: string;
}

export interface UpdateSessionInput {
  title?: string;
  archived?: boolean;
  modelId?: string;
  modelContextLength?: number;
}

export interface SessionWithMetadata {
  id: string;
  title: string;
  modelId: string | null;
  modelContextLength: number | null;
  messageCount: number;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
  archived?: boolean;
}

// ============================================================================
// Session Service
// ============================================================================

/**
 * SessionService handles session metadata only.
 *
 * Responsibilities:
 * - Create/update/delete sessions
 * - Session listing with metadata
 * - Working context persistence
 * - Compaction tracking (count, timestamps)
 *
 * Message content is handled by MessageStore.
 */
export class SessionService {
  constructor(private db: DrizzleDB) {}

  /**
   * Create a new session
   */
  async createSession(input: CreateSessionInput = {}) {
    const session = {
      id: randomUUID(),
      title: input.title || "New Session",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.sessions).values(session);

    return session;
  }

  /**
   * Ensure session exists (create if not exists)
   * Used by agent routes to create session before tool execution
   */
  async ensureSession(sessionId: string): Promise<void> {
    const existing = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!existing) {
      await this.db.insert(schema.sessions).values({
        id: sessionId,
        title: "New Session",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * List all sessions with metadata (message count, last activity)
   */
  async listSessions(): Promise<SessionWithMetadata[]> {
    // Get all sessions with their last message for activity timestamp
    const sessionsData = await this.db.query.sessions.findMany({
      with: {
        messages: {
          orderBy: desc(schema.messages.createdAt),
          limit: 1, // Get only last message for timestamp
        },
      },
      orderBy: desc(schema.sessions.updatedAt),
    });

    // Get message counts for all sessions
    const messageCounts = await this.db
      .select({
        sessionId: schema.messages.sessionId,
        count: count(),
      })
      .from(schema.messages)
      .groupBy(schema.messages.sessionId);

    // Create a map for quick lookup
    const countMap = new Map(
      messageCounts.map((mc) => [mc.sessionId, mc.count])
    );

    return sessionsData.map((session) => {
      const messageCount = countMap.get(session.id) || 0;
      const lastMessage = session.messages[0];
      const lastActivity = lastMessage?.createdAt || session.updatedAt;

      return {
        id: session.id,
        title: session.title,
        modelId: session.modelId,
        modelContextLength: session.modelContextLength,
        messageCount,
        lastActivity,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
    });
  }

  /**
   * Get session by ID (metadata only, use MessageStore for messages)
   */
  async getSessionById(sessionId: string) {
    const session = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session;
  }

  /**
   * Update session metadata (title, archived, modelId)
   */
  async updateSession(sessionId: string, input: UpdateSessionInput) {
    const existing = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!existing) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updated = {
      ...input,
      updatedAt: new Date(),
    };

    await this.db.update(schema.sessions).set(updated).where(eq(schema.sessions.id, sessionId));

    return this.getSessionById(sessionId);
  }

  /**
   * Delete session permanently with all child records
   * Defense in depth: explicit child deletion + FK cascade
   */
  async deleteSession(sessionId: string) {
    const existing = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!existing) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Delete all children explicitly (defense in depth - works regardless of FK pragma state)
    // messageParts will cascade from messages via FK
    await this.db.delete(schema.conversationLogs).where(eq(schema.conversationLogs.sessionId, sessionId));
    await this.db.delete(schema.messageParts).where(eq(schema.messageParts.sessionId, sessionId));
    await this.db.delete(schema.messages).where(eq(schema.messages.sessionId, sessionId));

    // Delete session
    await this.db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));

    return { success: true, deletedId: sessionId };
  }

  /**
   * Clear all messages and conversation logs from session (keep session)
   * Deletes from both messages and messageParts tables
   */
  async clearMessages(sessionId: string) {
    const session = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Delete conversation logs
    await this.db.delete(schema.conversationLogs).where(eq(schema.conversationLogs.sessionId, sessionId));

    // Delete message parts first (FK constraint)
    await this.db.delete(schema.messageParts).where(eq(schema.messageParts.sessionId, sessionId));

    // Delete messages
    await this.db.delete(schema.messages).where(eq(schema.messages.sessionId, sessionId));

    // Reset working memory and update timestamp
    await this.db
      .update(schema.sessions)
      .set({
        workingContext: null,
        updatedAt: new Date()
      })
      .where(eq(schema.sessions.id, sessionId));

    return { success: true, clearedSessionId: sessionId };
  }

  /**
   * Update session title based on first user message content
   */
  async updateTitleFromContent(sessionId: string, content: string): Promise<void> {
    const smartTitle = this.generateSmartTitle(content);
    await this.db
      .update(schema.sessions)
      .set({ title: smartTitle })
      .where(eq(schema.sessions.id, sessionId));
  }

  /**
   * Generate smart title from content (first 40 chars)
   */
  private generateSmartTitle(content: string): string {
    if (!content) {
      return "New Session";
    }

    // Extract first 40 chars, clean up
    const title = content
      .slice(0, 40)
      .replace(/\n/g, " ")
      .trim();

    return title.length < content.length ? `${title}...` : title;
  }

  // ============================================================================
  // Working Context
  // ============================================================================

  /**
   * Save working context to session
   */
  async saveWorkingContext(sessionId: string, context: WorkingContext): Promise<void> {
    const state = context.toJSON();
    await this.db.update(schema.sessions)
      .set({ workingContext: JSON.stringify(state) })
      .where(eq(schema.sessions.id, sessionId));
  }

  /**
   * Load working context from session
   */
  async loadWorkingContext(sessionId: string): Promise<WorkingContext> {
    const session = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session?.workingContext) {
      return new WorkingContext();
    }

    try {
      // With mode: "json", Drizzle auto-parses the stored JSON
      // If it's already an object, use directly; if string, parse it
      const state = typeof session.workingContext === 'string'
        ? JSON.parse(session.workingContext) as WorkingContextState
        : session.workingContext as WorkingContextState;
      return WorkingContext.fromJSON(state);
    } catch (error) {
      // If parsing fails, return empty context
      return new WorkingContext();
    }
  }
}
