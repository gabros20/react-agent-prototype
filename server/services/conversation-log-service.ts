import { randomUUID } from "node:crypto";
import { desc, eq, and, count } from "drizzle-orm";
import type { DrizzleDB } from "../db/client";
import * as schema from "../db/schema";

// Types matching trace-store.ts
export interface TraceEntryData {
  id: string;
  traceId: string;
  parentId?: string;
  timestamp: number;
  duration?: number;
  type: string;
  level: string;
  stepNumber?: number;
  toolName?: string;
  toolCallId?: string;
  summary: string;
  input?: unknown;
  output?: unknown;
  tokens?: { input: number; output: number };
  error?: { message: string; stack?: string };
  jobId?: string;
  jobProgress?: number;
}

export interface ConversationMetrics {
  totalDuration: number;
  toolCallCount: number;
  stepCount: number;
  tokens: { input: number; output: number };
  cost: number;
  errorCount: number;
}

export interface ModelInfo {
  modelId: string;
  pricing: { prompt: number; completion: number } | null;
}

export interface CreateConversationLogInput {
  sessionId: string;
  userPrompt: string;
  entries: TraceEntryData[];
  metrics: ConversationMetrics;
  modelInfo?: ModelInfo;
  startedAt: Date;
  completedAt?: Date;
}

export interface ConversationLog {
  id: string;
  sessionId: string;
  conversationIndex: number;
  userPrompt: string;
  startedAt: Date;
  completedAt: Date | null;
  metrics: ConversationMetrics | null;
  modelInfo: ModelInfo | null;
  entries: TraceEntryData[] | null;
}

export class ConversationLogService {
  constructor(private db: DrizzleDB) {}

  /**
   * Save a conversation log after agent completes
   */
  async saveConversationLog(input: CreateConversationLogInput): Promise<ConversationLog> {
    // Get the next conversation index for this session
    const existingLogs = await this.db
      .select({ count: count() })
      .from(schema.conversationLogs)
      .where(eq(schema.conversationLogs.sessionId, input.sessionId));

    const conversationIndex = (existingLogs[0]?.count || 0) + 1;

    const log = {
      id: randomUUID(),
      sessionId: input.sessionId,
      conversationIndex,
      userPrompt: input.userPrompt,
      startedAt: input.startedAt,
      completedAt: input.completedAt || new Date(),
      metrics: input.metrics,
      modelInfo: input.modelInfo || null,
      entries: input.entries,
    };

    await this.db.insert(schema.conversationLogs).values(log as any);

    return {
      id: log.id,
      sessionId: log.sessionId,
      conversationIndex,
      userPrompt: log.userPrompt,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      metrics: input.metrics,
      modelInfo: input.modelInfo || null,
      entries: input.entries,
    };
  }

  /**
   * Get all conversation logs for a session
   */
  async getSessionLogs(sessionId: string): Promise<ConversationLog[]> {
    const logs = await this.db.query.conversationLogs.findMany({
      where: eq(schema.conversationLogs.sessionId, sessionId),
      orderBy: schema.conversationLogs.conversationIndex,
    });

    return logs.map((log) => ({
      id: log.id,
      sessionId: log.sessionId,
      conversationIndex: log.conversationIndex,
      userPrompt: log.userPrompt,
      startedAt: log.startedAt!,
      completedAt: log.completedAt,
      metrics: log.metrics ? (typeof log.metrics === 'string' ? JSON.parse(log.metrics) : log.metrics) : null,
      modelInfo: log.modelInfo ? (typeof log.modelInfo === 'string' ? JSON.parse(log.modelInfo) : log.modelInfo) : null,
      entries: log.entries ? (typeof log.entries === 'string' ? JSON.parse(log.entries) : log.entries) : null,
    }));
  }

  /**
   * Get a single conversation log by ID
   */
  async getLogById(logId: string): Promise<ConversationLog | null> {
    const log = await this.db.query.conversationLogs.findFirst({
      where: eq(schema.conversationLogs.id, logId),
    });

    if (!log) return null;

    return {
      id: log.id,
      sessionId: log.sessionId,
      conversationIndex: log.conversationIndex,
      userPrompt: log.userPrompt,
      startedAt: log.startedAt!,
      completedAt: log.completedAt,
      metrics: log.metrics ? (typeof log.metrics === 'string' ? JSON.parse(log.metrics) : log.metrics) : null,
      modelInfo: log.modelInfo ? (typeof log.modelInfo === 'string' ? JSON.parse(log.modelInfo) : log.modelInfo) : null,
      entries: log.entries ? (typeof log.entries === 'string' ? JSON.parse(log.entries) : log.entries) : null,
    };
  }

  /**
   * Delete all conversation logs for a session
   */
  async deleteSessionLogs(sessionId: string): Promise<void> {
    await this.db.delete(schema.conversationLogs).where(eq(schema.conversationLogs.sessionId, sessionId));
  }

  /**
   * Get aggregated stats for a session (total tokens, cost, etc.)
   */
  async getSessionStats(sessionId: string): Promise<{
    totalConversations: number;
    totalDuration: number;
    totalToolCalls: number;
    totalSteps: number;
    totalTokens: { input: number; output: number };
    totalCost: number;
    totalErrors: number;
  }> {
    const logs = await this.getSessionLogs(sessionId);

    return logs.reduce(
      (acc, log) => {
        if (log.metrics) {
          acc.totalDuration += log.metrics.totalDuration || 0;
          acc.totalToolCalls += log.metrics.toolCallCount || 0;
          acc.totalSteps += log.metrics.stepCount || 0;
          acc.totalTokens.input += log.metrics.tokens?.input || 0;
          acc.totalTokens.output += log.metrics.tokens?.output || 0;
          acc.totalCost += log.metrics.cost || 0;
          acc.totalErrors += log.metrics.errorCount || 0;
        }
        acc.totalConversations++;
        return acc;
      },
      {
        totalConversations: 0,
        totalDuration: 0,
        totalToolCalls: 0,
        totalSteps: 0,
        totalTokens: { input: 0, output: 0 },
        totalCost: 0,
        totalErrors: 0,
      }
    );
  }
}
