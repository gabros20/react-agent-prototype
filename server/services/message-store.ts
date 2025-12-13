/**
 * Message Store v2
 *
 * Handles rich message structure with parts for the compaction system.
 * Extends existing session-service message handling with:
 * - Token tracking
 * - Compaction markers
 * - Message parts storage
 */

import { randomUUID } from "node:crypto";
import { eq, and, asc, desc } from "drizzle-orm";
import type { DrizzleDB } from "../db/client";
import * as schema from "../db/schema";
import {
  type RichMessage,
  type UserMessage,
  type AssistantMessage,
  type ToolMessage,
  type MessagePart,
  type TextPart,
  type ToolCallPart,
  type ToolResultPart,
  type CompactionMarkerPart,
  countMessageTokens,
  countPartTokens,
  isToolResultPart,
} from "../memory/compaction";

// ============================================================================
// Types
// ============================================================================

export interface MessageStoreOptions {
  db: DrizzleDB;
}

export interface SaveMessageResult {
  messageId: string;
  partsCount: number;
  tokens: number;
}

// ============================================================================
// Message Store
// ============================================================================

export class MessageStore {
  private db: DrizzleDB;

  constructor(options: MessageStoreOptions) {
    this.db = options.db;
  }

  /**
   * Save a rich message with parts to the database
   *
   * NOTE: SQLite with better-sqlite3 doesn't support async transactions
   * (drizzle-orm's tx.insert() returns void, not a promise in sync mode).
   * We use sequential inserts without transaction wrapper for now.
   * The trade-off is potential partial writes, but this is acceptable
   * since message loss is recoverable (user can re-send).
   */
  async saveRichMessage(message: RichMessage): Promise<SaveMessageResult> {
    // Calculate total tokens for the message
    const tokens = countMessageTokens(message);

    // Determine display content for UI
    let displayContent: string | null = null;
    if (message.role === "user") {
      displayContent = (message as UserMessage).parts.map((p) => p.text).join("\n") || null;
    } else if (message.role === "assistant") {
      const textParts = (message as AssistantMessage).parts.filter((p): p is TextPart => p.type === "text");
      displayContent = textParts.map((p) => p.text).join("\n") || null;
    }

    // Convert parts to AI SDK format for the content field
    const content = this.partsToAISDKContent(message);

    // Insert the message first
    await this.db.insert(schema.messages).values({
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
      content: JSON.stringify(content),
      displayContent,
      tokens,
      isSummary: message.role === "assistant" && "isSummary" in message ? (message as AssistantMessage).isSummary : false,
      isCompactionTrigger: message.role === "user" && "isCompactionTrigger" in message ? (message as UserMessage).isCompactionTrigger : false,
      createdAt: new Date(message.createdAt),
    });

    // Insert message parts sequentially
    for (let i = 0; i < message.parts.length; i++) {
      const part = message.parts[i];
      const partTokens = countPartTokens(part);

      await this.db.insert(schema.messageParts).values({
        id: part.id,
        messageId: message.id,
        sessionId: message.sessionId,
        type: part.type as "text" | "tool-call" | "tool-result" | "compaction-marker" | "reasoning" | "step-start",
        content: JSON.stringify(this.partToStorageFormat(part)),
        tokens: partTokens,
        compactedAt: isToolResultPart(part) && part.compactedAt ? part.compactedAt : null,
        sortOrder: i,
        createdAt: new Date(message.createdAt),
      });
    }

    return {
      messageId: message.id,
      partsCount: message.parts.length,
      tokens,
    };
  }

  /**
   * Load messages for a session as RichMessage array
   */
  async loadRichMessages(sessionId: string): Promise<RichMessage[]> {
    const dbMessages = await this.db.query.messages.findMany({
      where: eq(schema.messages.sessionId, sessionId),
      with: {
        parts: {
          orderBy: asc(schema.messageParts.sortOrder),
        },
      },
      orderBy: asc(schema.messages.createdAt),
    });

    return dbMessages.map((msg) => this.dbToRichMessage(msg));
  }

  /**
   * Load messages since the last compaction summary
   */
  async loadMessagesSinceCompaction(sessionId: string): Promise<RichMessage[]> {
    // Find the last compaction summary message
    const lastSummary = await this.db.query.messages.findFirst({
      where: and(
        eq(schema.messages.sessionId, sessionId),
        eq(schema.messages.isSummary, true)
      ),
      orderBy: desc(schema.messages.createdAt),
    });

    // If no summary, return all messages
    if (!lastSummary) {
      return this.loadRichMessages(sessionId);
    }

    // Get messages after the summary
    const dbMessages = await this.db.query.messages.findMany({
      where: eq(schema.messages.sessionId, sessionId),
      with: {
        parts: {
          orderBy: asc(schema.messageParts.sortOrder),
        },
      },
      orderBy: asc(schema.messages.createdAt),
    });

    // Filter to messages >= lastSummary.createdAt (include the summary)
    const filtered = dbMessages.filter(
      (msg) => msg.createdAt >= lastSummary.createdAt
    );

    return filtered.map((msg) => this.dbToRichMessage(msg));
  }

  /**
   * Update a message part (e.g., mark as compacted)
   */
  async updatePart(partId: string, updates: { compactedAt?: number; tokens?: number }): Promise<void> {
    const updateData: Record<string, unknown> = {};

    if (updates.compactedAt !== undefined) {
      updateData.compactedAt = updates.compactedAt;
    }

    if (updates.tokens !== undefined) {
      updateData.tokens = updates.tokens;
    }

    if (Object.keys(updateData).length > 0) {
      await this.db
        .update(schema.messageParts)
        .set(updateData)
        .where(eq(schema.messageParts.id, partId));
    }
  }

  /**
   * Bulk update parts for pruning
   */
  async markPartsCompacted(
    partIds: string[],
    compactedAt: number
  ): Promise<void> {
    for (const partId of partIds) {
      await this.updatePart(partId, { compactedAt });
    }
  }

  /**
   * Get session compaction stats
   */
  async getCompactionStats(sessionId: string): Promise<{
    totalMessages: number;
    totalTokens: number;
    compactedParts: number;
    summaryCount: number;
  }> {
    const messages = await this.db.query.messages.findMany({
      where: eq(schema.messages.sessionId, sessionId),
    });

    const parts = await this.db.query.messageParts.findMany({
      where: eq(schema.messageParts.sessionId, sessionId),
    });

    const totalTokens = messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
    const compactedParts = parts.filter((p) => p.compactedAt !== null).length;
    const summaryCount = messages.filter((m) => m.isSummary).length;

    return {
      totalMessages: messages.length,
      totalTokens,
      compactedParts,
      summaryCount,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Convert message parts to AI SDK content format
   */
  private partsToAISDKContent(message: RichMessage): unknown {
    if (message.role === "user") {
      // User messages: join text parts
      const textParts = message.parts.filter((p): p is TextPart => p.type === "text");
      return textParts.map((p) => p.text).join("\n");
    }

    if (message.role === "assistant") {
      // Assistant messages: array of parts
      return message.parts.map((part) => {
        switch (part.type) {
          case "text":
            return { type: "text", text: (part as TextPart).text };

          case "tool-call": {
            const tc = part as ToolCallPart;
            return {
              type: "tool-call",
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              input: tc.input ?? {},
            };
          }

          case "compaction-marker": {
            const cm = part as CompactionMarkerPart;
            return { type: "text", text: cm.summary };
          }

          case "reasoning":
            // Extended thinking from o1/deepseek models
            return { type: "reasoning", text: (part as { text: string }).text };

          case "step-start":
            // Internal marker - skip for AI SDK content
            return null;

          default:
            // Unknown type - log and skip
            console.warn(`[MessageStore] Unknown part type in partsToAISDKContent: ${part.type}`);
            return null;
        }
      }).filter(Boolean);
    }

    if (message.role === "tool") {
      // Tool messages: array of results (AI SDK v6 uses 'output')
      return message.parts.map((part) => {
        if (part.type === "tool-result") {
          const tr = part as ToolResultPart;
          return {
            type: "tool-result",
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            output: tr.compactedAt
              ? { status: "compacted", message: "Output cleared - see summary" }
              : tr.output,
          };
        }
        return null;
      }).filter(Boolean);
    }

    return "";
  }

  /**
   * Convert a part to storage format
   */
  private partToStorageFormat(part: MessagePart): Record<string, unknown> {
    const base = { id: part.id, type: part.type };

    switch (part.type) {
      case "text":
        return { ...base, text: (part as TextPart).text };

      case "tool-call":
        const tc = part as ToolCallPart;
        return {
          ...base,
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: tc.input,
        };

      case "tool-result":
        const tr = part as ToolResultPart;
        return {
          ...base,
          toolCallId: tr.toolCallId,
          toolName: tr.toolName,
          output: tr.output,
          compactedAt: tr.compactedAt,
          originalTokens: tr.originalTokens,
        };

      case "compaction-marker":
        const cm = part as CompactionMarkerPart;
        return {
          ...base,
          summary: cm.summary,
          compactedAt: cm.compactedAt,
          messagesCompacted: cm.messagesCompacted,
          originalTokens: cm.originalTokens,
        };

      case "reasoning":
        // ReasoningPart from models with extended thinking (o1, deepseek-r1)
        return {
          ...base,
          text: (part as { text: string }).text,
        };

      case "step-start":
        // StepStartPart is a marker with no additional data
        return base;

      default: {
        // Log unexpected part types for debugging
        // Cast to any for error logging since we've handled all known types
        const unknownPart = part as unknown as { type: string };
        console.warn(`[MessageStore] Unknown part type in partToStorageFormat: ${unknownPart.type}`);
        return base;
      }
    }
  }

  /**
   * Convert DB message to RichMessage
   */
  private dbToRichMessage(
    dbMessage: typeof schema.messages.$inferSelect & {
      parts: Array<typeof schema.messageParts.$inferSelect>;
    }
  ): RichMessage {
    const base = {
      id: dbMessage.id,
      sessionId: dbMessage.sessionId,
      createdAt: dbMessage.createdAt.getTime(),
      tokens: dbMessage.tokens || 0,
    };

    // Convert parts from DB format (AI SDK v6 format with 'input' field)
    const parts = dbMessage.parts.map((dbPart) => {
      const content = typeof dbPart.content === "string"
        ? JSON.parse(dbPart.content)
        : dbPart.content;

      return {
        ...content,
        id: dbPart.id,
        type: dbPart.type,
        tokens: dbPart.tokens || undefined,
        compactedAt: dbPart.compactedAt || undefined,
      } as MessagePart;
    });

    if (dbMessage.role === "user") {
      return {
        ...base,
        role: "user",
        parts: parts.filter((p) => p.type === "text") as TextPart[],
        isCompactionTrigger: dbMessage.isCompactionTrigger || false,
      } as UserMessage;
    }

    if (dbMessage.role === "assistant") {
      return {
        ...base,
        role: "assistant",
        parts,
        isSummary: dbMessage.isSummary || false,
      } as AssistantMessage;
    }

    if (dbMessage.role === "tool") {
      return {
        ...base,
        role: "tool",
        parts: parts.filter((p) => p.type === "tool-result") as ToolResultPart[],
      } as ToolMessage;
    }

    // Fallback for system messages (shouldn't happen in compaction flow)
    return {
      ...base,
      role: "assistant",
      parts,
    } as AssistantMessage;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMessageStore(db: DrizzleDB): MessageStore {
  return new MessageStore({ db });
}
