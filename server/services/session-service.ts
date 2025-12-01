import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { DrizzleDB } from "../db/client";
import * as schema from "../db/schema";
import { WorkingContext, type WorkingContextState } from "./working-memory";

export interface CreateSessionInput {
  title?: string;
}

export interface UpdateSessionInput {
  title?: string;
  archived?: boolean;
}

export interface CreateMessageInput {
  role: "system" | "user" | "assistant" | "tool";
  content: any; // JSON content
  toolName?: string;
  stepIdx?: number;
}

export interface SessionWithMetadata {
  id: string;
  title: string;
  messageCount: number;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
  archived?: boolean;
}

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
   * List all sessions with metadata (message count, last activity)
   */
  async listSessions(): Promise<SessionWithMetadata[]> {
    const sessionsData = await this.db.query.sessions.findMany({
      with: {
        messages: {
          orderBy: desc(schema.messages.createdAt),
          limit: 1, // Get only last message for timestamp
        },
      },
      orderBy: desc(schema.sessions.updatedAt),
    });

    return sessionsData.map((session) => {
      const messageCount = session.messages.length;
      const lastMessage = session.messages[0];
      const lastActivity = lastMessage?.createdAt || session.updatedAt;

      return {
        id: session.id,
        title: session.title,
        messageCount,
        lastActivity,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
    });
  }

  /**
   * Get session by ID with all messages
   */
  async getSessionById(sessionId: string) {
    const session = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
      with: {
        messages: {
          orderBy: schema.messages.createdAt,
        },
      },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session;
  }

  /**
   * Update session (for title changes or archiving)
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
   * Delete session permanently (cascade deletes messages via FK)
   */
  async deleteSession(sessionId: string) {
    const existing = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!existing) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await this.db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));

    return { success: true, deletedId: sessionId };
  }

  /**
   * Add message to session
   */
  async addMessage(sessionId: string, input: CreateMessageInput) {
    // Verify session exists
    const session = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const message = {
      id: randomUUID(),
      sessionId,
      role: input.role,
      content: JSON.stringify(input.content),
      toolName: input.toolName || null,
      stepIdx: input.stepIdx || null,
      createdAt: new Date(),
    };

    await this.db.insert(schema.messages).values(message);

    // Update session updatedAt
    await this.db
      .update(schema.sessions)
      .set({ updatedAt: new Date() })
      .where(eq(schema.sessions.id, sessionId));

    // Generate smart title from first user message
    const messageCount = await this.db.query.messages.findMany({
      where: eq(schema.messages.sessionId, sessionId),
    });

    if (messageCount.length === 1 && input.role === "user") {
      const smartTitle = this.generateSmartTitle([input.content]);
      await this.db
        .update(schema.sessions)
        .set({ title: smartTitle })
        .where(eq(schema.sessions.id, sessionId));
    }

    return message;
  }

  /**
   * Clear all messages from session (keep session)
   */
  async clearMessages(sessionId: string) {
    const session = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await this.db.delete(schema.messages).where(eq(schema.messages.sessionId, sessionId));

    // Update session timestamp
    await this.db
      .update(schema.sessions)
      .set({ updatedAt: new Date() })
      .where(eq(schema.sessions.id, sessionId));

    return { success: true, clearedSessionId: sessionId };
  }

  /**
   * Load messages as CoreMessage array (for AI SDK v6)
   */
  async loadMessages(sessionId: string): Promise<any[]> {
    const session = await this.getSessionById(sessionId);
    
    return session.messages.map((msg: any) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content
    }));
  }

  /**
   * Save messages array (for AI SDK v6 checkpointing)
   */
  async saveMessages(sessionId: string, messages: any[]) {
    // Check if session exists, create if not
    let session = await this.db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (!session) {
      // Create session with the provided sessionId
      await this.db.insert(schema.sessions).values({
        id: sessionId,
        title: 'New Session',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Clear existing messages
    await this.db.delete(schema.messages).where(eq(schema.messages.sessionId, sessionId));

    // Insert all messages
    for (const msg of messages) {
      await this.addMessage(sessionId, {
        role: msg.role,
        content: msg.content,
        toolName: undefined,
        stepIdx: undefined
      });
    }

    // Update session timestamp
    await this.db
      .update(schema.sessions)
      .set({ updatedAt: new Date() })
      .where(eq(schema.sessions.id, sessionId));

    // Generate smart title from first user message
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length > 0) {
      const smartTitle = this.generateSmartTitle(userMessages);
      await this.db
        .update(schema.sessions)
        .set({ title: smartTitle })
        .where(eq(schema.sessions.id, sessionId));
    }

    return { success: true, messageCount: messages.length };
  }

  /**
   * Generate smart title from first user message
   */
  generateSmartTitle(messages: any[]): string {
    const firstUserMessage = messages.find(
      (m) => typeof m === "string" || (m && m.role === "user"),
    );

    if (!firstUserMessage) {
      return "New Session";
    }

    const content =
      typeof firstUserMessage === "string"
        ? firstUserMessage
        : firstUserMessage.content || "New Session";

    // Extract first 40 chars, clean up
    const title = content
      .slice(0, 40)
      .replace(/\n/g, " ")
      .trim();

    return title.length < content.length ? `${title}...` : title;
  }

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

    if (!session?.workingContext || typeof session.workingContext !== 'string') {
      return new WorkingContext();
    }

    try {
      const state = JSON.parse(session.workingContext) as WorkingContextState;
      return WorkingContext.fromJSON(state);
    } catch (error) {
      // If parsing fails, return empty context
      return new WorkingContext();
    }
  }
}
