/**
 * SQLite Memory Provider
 *
 * Implementation of MemoryProvider using SQLite via Drizzle ORM.
 * This is the default provider for development and single-instance deployments.
 */

import { randomUUID } from 'node:crypto';
import { count, desc, eq } from 'drizzle-orm';
import type { DrizzleDB } from '../../db/client';
import * as schema from '../../db/schema';
import type {
  MemoryProvider,
  Session,
  SessionWithMetadata,
  CreateSessionInput,
  UpdateSessionInput,
  StoredMessage,
  NewMessage,
  ModelMessage,
} from './types';
import type { WorkingContextState } from '../../memory';

// ============================================================================
// SQLite Memory Provider
// ============================================================================

export class SQLiteMemoryProvider implements MemoryProvider {
  constructor(private readonly db: DrizzleDB) {}

  // ============================================================================
  // Session Operations
  // ============================================================================

  async createSession(input: CreateSessionInput = {}): Promise<Session> {
    const session = {
      id: input.id ?? randomUUID(),
      title: input.title ?? 'New Session',
      modelId: input.modelId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(schema.sessions).values(session);

    return {
      id: session.id,
      title: session.title,
      modelId: session.modelId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async ensureSession(sessionId: string): Promise<void> {
    const existing = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!existing) {
      await this.createSession({ id: sessionId });
    }
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) return null;

    return {
      id: session.id,
      title: session.title,
      modelId: session.modelId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async listSessions(): Promise<SessionWithMetadata[]> {
    // Get all sessions with their last message
    const sessionsData = await this.db.query.sessions.findMany({
      with: {
        messages: {
          orderBy: desc(schema.messages.createdAt),
          limit: 1,
        },
      },
      orderBy: desc(schema.sessions.updatedAt),
    });

    // Get message counts
    const messageCounts = await this.db
      .select({
        sessionId: schema.messages.sessionId,
        count: count(),
      })
      .from(schema.messages)
      .groupBy(schema.messages.sessionId);

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
        messageCount,
        lastActivity,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
    });
  }

  async updateSession(sessionId: string, input: UpdateSessionInput): Promise<Session> {
    const existing = await this.getSession(sessionId);
    if (!existing) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await this.db
      .update(schema.sessions)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schema.sessions.id, sessionId));

    const updated = await this.getSession(sessionId);
    return updated!;
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Delete children first (defense in depth)
    await this.db.delete(schema.conversationLogs).where(eq(schema.conversationLogs.sessionId, sessionId));
    await this.db.delete(schema.messages).where(eq(schema.messages.sessionId, sessionId));
    await this.db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  async addMessage(sessionId: string, message: NewMessage): Promise<StoredMessage> {
    // Serialize content
    const serializedContent = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);

    const stored = {
      id: randomUUID(),
      sessionId,
      role: message.role,
      content: serializedContent,
      displayContent: message.displayContent ?? null,
      toolName: message.toolName ?? null,
      stepIdx: message.stepIdx ?? null,
      createdAt: new Date(),
    };

    await this.db.insert(schema.messages).values(stored);

    // Update session timestamp
    await this.db
      .update(schema.sessions)
      .set({ updatedAt: new Date() })
      .where(eq(schema.sessions.id, sessionId));

    // Generate smart title from first user message
    await this.maybeUpdateTitle(sessionId, message);

    return {
      id: stored.id,
      sessionId: stored.sessionId,
      role: stored.role as StoredMessage['role'],
      content: message.content,
      displayContent: stored.displayContent,
      toolName: stored.toolName,
      stepIdx: stored.stepIdx,
      createdAt: stored.createdAt,
    };
  }

  async loadMessages(sessionId: string): Promise<ModelMessage[]> {
    const messages = await this.db.query.messages.findMany({
      where: eq(schema.messages.sessionId, sessionId),
      orderBy: schema.messages.createdAt,
    });

    return messages.map((msg) => {
      let content = msg.content;

      // Parse JSON content if string
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch {
          // Keep as string if not valid JSON
        }
      }

      return {
        role: msg.role as ModelMessage['role'],
        content,
      };
    });
  }

  async saveMessages(sessionId: string, messages: ModelMessage[]): Promise<void> {
    // Ensure session exists
    await this.ensureSession(sessionId);

    // Clear existing messages
    await this.db.delete(schema.messages).where(eq(schema.messages.sessionId, sessionId));

    // Insert all messages
    for (const msg of messages) {
      await this.addMessage(sessionId, {
        role: msg.role,
        content: msg.content,
      });
    }

    // Update session timestamp
    await this.db
      .update(schema.sessions)
      .set({ updatedAt: new Date() })
      .where(eq(schema.sessions.id, sessionId));
  }

  async clearMessages(sessionId: string): Promise<void> {
    // Delete conversation logs
    await this.db.delete(schema.conversationLogs).where(eq(schema.conversationLogs.sessionId, sessionId));

    // Delete messages
    await this.db.delete(schema.messages).where(eq(schema.messages.sessionId, sessionId));

    // Reset working context
    await this.db
      .update(schema.sessions)
      .set({ workingContext: null, updatedAt: new Date() })
      .where(eq(schema.sessions.id, sessionId));
  }

  // ============================================================================
  // Working Context Operations
  // ============================================================================

  async loadWorkingContext(sessionId: string): Promise<WorkingContextState | null> {
    const session = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session?.workingContext) {
      return null;
    }

    try {
      return typeof session.workingContext === 'string'
        ? JSON.parse(session.workingContext) as WorkingContextState
        : session.workingContext as WorkingContextState;
    } catch {
      return null;
    }
  }

  async saveWorkingContext(sessionId: string, context: WorkingContextState): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({ workingContext: JSON.stringify(context) })
      .where(eq(schema.sessions.id, sessionId));
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async maybeUpdateTitle(sessionId: string, message: NewMessage): Promise<void> {
    if (message.role !== 'user') return;

    const messageCount = await this.db.query.messages.findMany({
      where: eq(schema.messages.sessionId, sessionId),
    });

    // Only update title on first user message
    if (messageCount.length !== 1) return;

    const content = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);

    const title = content
      .slice(0, 40)
      .replace(/\n/g, ' ')
      .trim();

    const smartTitle = title.length < content.length ? `${title}...` : title;

    await this.db
      .update(schema.sessions)
      .set({ title: smartTitle })
      .where(eq(schema.sessions.id, sessionId));
  }
}
